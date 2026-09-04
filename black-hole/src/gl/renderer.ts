import {
  BLUR_FRAGMENT,
  BRIGHT_FRAGMENT,
  COMPOSITE_FRAGMENT,
  DOWN_FRAGMENT,
  QUAD_VERTEX,
} from '../shaders/post';
import {SCENE_FRAGMENT} from '../shaders/blackhole';

export type FrameParams = {
  /** Normalised loop position in [0, 1). */
  t: number;
  /** 0 = mono, 1 = gold, 2 = blue. */
  palette: number;
  /** Horizon centre as a fraction of (width, height-from-top). */
  center: [number, number];
  /** Supersample factor per axis. */
  ss: number;
  exposure: number;
  grain: number;
  grainSeed: number;
  bloomTight: number;
  bloomWide: number;
  bloomThreshold: number;
};

type Target = {
  fb: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`Shader compile failed: ${log}`);
  }
  return sh;
};

const link = (gl: WebGL2RenderingContext, fs: string) => {
  const p = gl.createProgram()!;
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, QUAD_VERTEX));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`Program link failed: ${gl.getProgramInfoLog(p)}`);
  }
  return p;
};

/**
 * Five-stage renderer: the lensing scene into an HDR target, a thresholded
 * bright pass at half and eighth resolution, separable blurs on each, and a
 * composite that tone-maps and grains the result onto the canvas.
 */
export class BlackHoleRenderer {
  private gl: WebGL2RenderingContext;
  private progScene: WebGLProgram;
  private progBright: WebGLProgram;
  private progDown: WebGLProgram;
  private progBlur: WebGLProgram;
  private progComposite: WebGLProgram;
  private vao: WebGLVertexArrayObject;
  private targets: Record<string, Target> = {};
  private width = 0;
  private height = 0;
  private hdr: boolean;
  private gain: number;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      // Required: Remotion screenshots the page after the draw call returns.
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;

    // Float render targets keep the photon ring's headroom for the bright pass.
    // Without them we fall back to 8-bit with a fixed encode gain.
    this.hdr = Boolean(gl.getExtension('EXT_color_buffer_float'));
    gl.getExtension('OES_texture_float_linear');
    this.gain = this.hdr ? 1 : 1 / 12;

    this.progScene = link(gl, SCENE_FRAGMENT);
    this.progBright = link(gl, BRIGHT_FRAGMENT);
    this.progDown = link(gl, DOWN_FRAGMENT);
    this.progBlur = link(gl, BLUR_FRAGMENT);
    this.progComposite = link(gl, COMPOSITE_FRAGMENT);

    this.vao = gl.createVertexArray()!;
    gl.bindVertexArray(this.vao);
    const buf = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  private makeTarget(w: number, h: number): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (this.hdr) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete (0x${status.toString(16)})`);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return {fb, tex, w, h};
  }

  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return;
    const gl = this.gl;
    for (const key of Object.keys(this.targets)) {
      gl.deleteFramebuffer(this.targets[key].fb);
      gl.deleteTexture(this.targets[key].tex);
    }
    this.targets = {};
    this.width = width;
    this.height = height;
    const half = (n: number) => Math.max(1, Math.floor(n / 2));
    const w2 = half(width), h2 = half(height);
    const w4 = half(w2), h4 = half(h2);
    const w8 = half(w4), h8 = half(h4);
    this.targets.scene = this.makeTarget(width, height);
    this.targets.a = this.makeTarget(w2, h2);
    this.targets.aTmp = this.makeTarget(w2, h2);
    this.targets.q = this.makeTarget(w4, h4);
    this.targets.e = this.makeTarget(w8, h8);
    this.targets.eTmp = this.makeTarget(w8, h8);
  }

  private bindTarget(t: Target | null) {
    const gl = this.gl;
    if (t) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb);
      gl.viewport(0, 0, t.w, t.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
    }
  }

  private useTexture(prog: WebGLProgram, name: string, tex: WebGLTexture, unit: number) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(prog, name), unit);
  }

  private draw() {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  }

  private blur(src: Target, tmp: Target, dst: Target, radius: number) {
    const gl = this.gl;
    gl.useProgram(this.progBlur);
    const dir = gl.getUniformLocation(this.progBlur, 'uDir');
    this.bindTarget(tmp);
    this.useTexture(this.progBlur, 'uTex', src.tex, 0);
    gl.uniform2f(dir, radius / src.w, 0);
    this.draw();
    this.bindTarget(dst);
    this.useTexture(this.progBlur, 'uTex', tmp.tex, 0);
    gl.uniform2f(dir, 0, radius / src.h);
    this.draw();
  }

  render(p: FrameParams) {
    const gl = this.gl;
    const {scene, a, aTmp, q, e, eTmp} = this.targets;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    // 1. Lensing scene.
    gl.useProgram(this.progScene);
    this.bindTarget(scene);
    const u = (n: string) => gl.getUniformLocation(this.progScene, n);
    gl.uniform2f(u('uRes'), scene.w, scene.h);
    gl.uniform1f(u('uT'), p.t);
    gl.uniform2f(u('uCenter'), p.center[0], p.center[1]);
    gl.uniform1i(u('uPalette'), p.palette);
    gl.uniform1i(u('uSS'), p.ss);
    gl.uniform1f(u('uGain'), this.gain);
    this.draw();

    // 2. Bright pass, downsampling to half resolution as it goes.
    gl.useProgram(this.progBright);
    this.bindTarget(a);
    this.useTexture(this.progBright, 'uTex', scene.tex, 0);
    gl.uniform2f(gl.getUniformLocation(this.progBright, 'uTexel'), 1 / scene.w, 1 / scene.h);
    gl.uniform1f(gl.getUniformLocation(this.progBright, 'uThreshold'), p.bloomThreshold);
    gl.uniform1f(gl.getUniformLocation(this.progBright, 'uInvGain'), 1 / this.gain);
    this.draw();

    // 3. Tight bloom at half res.
    this.blur(a, aTmp, a, 1.0);
    this.blur(a, aTmp, a, 2.0);

    // 4. Wide halo: half -> quarter -> eighth, blurred at three radii.
    gl.useProgram(this.progDown);
    const dTexel = gl.getUniformLocation(this.progDown, 'uTexel');
    this.bindTarget(q);
    this.useTexture(this.progDown, 'uTex', a.tex, 0);
    gl.uniform2f(dTexel, 1 / a.w, 1 / a.h);
    this.draw();
    this.bindTarget(e);
    this.useTexture(this.progDown, 'uTex', q.tex, 0);
    gl.uniform2f(dTexel, 1 / q.w, 1 / q.h);
    this.draw();
    // Wide, soft diffusion. The look calls for blurry light, so the halo is
    // built from several passes at increasing radius rather than one tight one.
    this.blur(e, eTmp, e, 1.5);
    this.blur(e, eTmp, e, 3.0);
    this.blur(e, eTmp, e, 5.5);
    this.blur(e, eTmp, e, 9.0);

    // 5. Composite to the canvas.
    gl.useProgram(this.progComposite);
    this.bindTarget(null);
    const c = (n: string) => gl.getUniformLocation(this.progComposite, n);
    this.useTexture(this.progComposite, 'uScene', scene.tex, 0);
    this.useTexture(this.progComposite, 'uBloomA', a.tex, 1);
    this.useTexture(this.progComposite, 'uBloomB', e.tex, 2);
    gl.uniform1f(c('uBloomA_k'), p.bloomTight);
    gl.uniform1f(c('uBloomB_k'), p.bloomWide);
    gl.uniform1f(c('uExposure'), p.exposure);
    gl.uniform1f(c('uGrain'), p.grain);
    gl.uniform1f(c('uSeed'), p.grainSeed);
    gl.uniform1f(c('uInvGain'), 1 / this.gain);
    gl.uniform2f(c('uRes'), this.width, this.height);
    this.draw();

    gl.bindVertexArray(null);
    gl.finish();
  }

  dispose() {
    const gl = this.gl;
    for (const key of Object.keys(this.targets)) {
      gl.deleteFramebuffer(this.targets[key].fb);
      gl.deleteTexture(this.targets[key].tex);
    }
    this.targets = {};
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

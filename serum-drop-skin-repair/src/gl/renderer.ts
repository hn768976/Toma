/**
 * Minimal WebGL 2 multi-pass renderer used by the compositions.
 *
 * Pipeline per frame:
 *   1. scene    -> HDR colour + circle-of-confusion (alpha), at "internal" resolution
 *   2. half     -> 2x box downsample of the scene
 *   3. dof      -> depth-of-field gather blur (half res)
 *   4. bloom    -> bright pass + separable gaussian at 1/4, 1/8 and 1/16 res
 *   5. composite-> DOF mix, bloom, tone-map (display-referred, output res)
 *   6. fxaa     -> edge anti-aliasing + film grain -> canvas
 *
 * Static procedural maps (crack network, skin micro-relief) are baked once
 * into float textures when the renderer is created, so the per-frame scene
 * shader only needs cheap texture lookups.
 */

export type UniformMap = Record<
  string,
  number | number[] | Float32Array | WebGLTexture | null | undefined
>;

export type BakeSpec = {
  /** Sampler uniform name the baked texture is bound to in the scene shader */
  name: string;
  size: number;
  frag: string;
  uniforms: UniformMap;
};

export type RendererOptions = {
  /** Resolution the scene is shaded at (the composition resolution) */
  internalWidth: number;
  internalHeight: number;
  sceneFrag: string;
  bakes: BakeSpec[];
};

const VERT = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const HEADER = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
`;

const COPY_FRAG = `${HEADER}
in vec2 vUv; out vec4 o;
uniform sampler2D uTex;
void main() { o = texture(uTex, vUv); }`;

// Depth-of-field: golden-angle spiral gather, radius driven by the centre CoC.
const DOF_FRAG = `${HEADER}
in vec2 vUv; out vec4 o;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uMaxRadius;
const int TAPS = 28;
void main() {
  vec4 c0 = texture(uTex, vUv);
  float r0 = c0.a * uMaxRadius;
  vec3 acc = c0.rgb;
  float wsum = 1.0;
  if (r0 > 0.35) {
    for (int i = 0; i < TAPS; i++) {
      float fi = float(i) + 0.5;
      float rr = sqrt(fi / float(TAPS));
      float th = fi * 2.39996323;
      vec2 off = vec2(cos(th), sin(th)) * rr * r0;
      vec4 s = texture(uTex, vUv + off * uTexel);
      // samples that are themselves in focus contribute less (limits bleeding)
      float w = 0.25 + 0.75 * smoothstep(0.0, 1.0, s.a * uMaxRadius / max(rr * r0, 0.5));
      acc += s.rgb * w;
      wsum += w;
    }
  }
  o = vec4(acc / wsum, c0.a);
}`;

const BRIGHT_FRAG = `${HEADER}
in vec2 vUv; out vec4 o;
uniform sampler2D uTex;
uniform float uThreshold;
void main() {
  vec3 c = texture(uTex, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
  o = vec4(c * k, 1.0);
}`;

const BLUR_FRAG = `${HEADER}
in vec2 vUv; out vec4 o;
uniform sampler2D uTex;
uniform vec2 uDir;
void main() {
  // 9-tap gaussian using linear sampling (5 fetches)
  vec3 c = texture(uTex, vUv).rgb * 0.227027;
  c += texture(uTex, vUv + uDir * 1.384615).rgb * 0.316216;
  c += texture(uTex, vUv - uDir * 1.384615).rgb * 0.316216;
  c += texture(uTex, vUv + uDir * 3.230769).rgb * 0.070270;
  c += texture(uTex, vUv - uDir * 3.230769).rgb * 0.070270;
  o = vec4(c, 1.0);
}`;

const COMPOSITE_FRAG = `${HEADER}
in vec2 vUv; out vec4 o;
uniform sampler2D uScene;
uniform sampler2D uDof;
uniform sampler2D uBloom1;
uniform sampler2D uBloom2;
uniform sampler2D uBloom3;
uniform float uBloom;
uniform float uExposure;
uniform float uVignette;
uniform vec3 uBloomTint;

vec3 softClip(vec3 x) {
  // identity below the knee, smooth roll-off to 1.0 above it
  const float knee = 0.78;
  vec3 over = max(x - knee, 0.0);
  return min(x, vec3(knee)) + (1.0 - knee) * (1.0 - exp(-over / (1.0 - knee)));
}
void main() {
  vec4 sharp = texture(uScene, vUv);
  vec4 blur = texture(uDof, vUv);
  float k = smoothstep(0.04, 0.42, max(sharp.a, blur.a * 0.85));
  vec3 col = mix(sharp.rgb, blur.rgb, k);
  vec3 bloom = texture(uBloom1, vUv).rgb * 0.5
             + texture(uBloom2, vUv).rgb * 0.33
             + texture(uBloom3, vUv).rgb * 0.27;
  col += bloom * uBloom * uBloomTint;
  col *= uExposure;
  vec2 q = vUv - 0.5;
  col *= 1.0 - uVignette * dot(q, q) * 1.6;
  // hue-preserving highlight roll-off
  col = max(col, 0.0);
  float mx = max(col.r, max(col.g, col.b));
  col *= softClip(vec3(mx)).r / max(mx, 1e-4);
  col = pow(col, vec3(1.0 / 2.2));
  o = vec4(col, 1.0);
}`;


// FXAA (edge anti-aliasing on the tone-mapped image) + deterministic grain.
const FXAA_FRAG = `${HEADER}
in vec2 vUv; out vec4 o;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform vec2 uOutRes;
uniform float uFrame;
uniform float uGrain;

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec3 rgbNW = texture(uTex, vUv + vec2(-1.0, -1.0) * uTexel).rgb;
  vec3 rgbNE = texture(uTex, vUv + vec2(1.0, -1.0) * uTexel).rgb;
  vec3 rgbSW = texture(uTex, vUv + vec2(-1.0, 1.0) * uTexel).rgb;
  vec3 rgbSE = texture(uTex, vUv + vec2(1.0, 1.0) * uTexel).rgb;
  vec3 rgbM = texture(uTex, vUv).rgb;
  float lNW = luma(rgbNW), lNE = luma(rgbNE), lSW = luma(rgbSW), lSE = luma(rgbSE), lM = luma(rgbM);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE)));
  float lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
  float dirReduce = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0);
  float rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0)) * uTexel;
  vec3 rgbA = 0.5 * (texture(uTex, vUv + dir * (1.0 / 3.0 - 0.5)).rgb + texture(uTex, vUv + dir * (2.0 / 3.0 - 0.5)).rgb);
  vec3 rgbB = rgbA * 0.5 + 0.25 * (texture(uTex, vUv + dir * -0.5).rgb + texture(uTex, vUv + dir * 0.5).rgb);
  float lB = luma(rgbB);
  vec3 col = (lB < lMin || lB > lMax) ? rgbA : rgbB;
  // deterministic film grain / dither (also hides 8-bit banding in gradients)
  vec2 px = floor(vUv * uOutRes);
  float n = hash13(vec3(px, uFrame)) + hash13(vec3(px + 71.7, uFrame + 13.0)) - 1.0;
  col += n * uGrain;
  o = vec4(col, 1.0);
}`;

type Target = {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
};

type UniformInfo = {
  loc: WebGLUniformLocation;
  type: number;
  size: number;
};

class Program {
  readonly program: WebGLProgram;
  private readonly uniforms = new Map<string, UniformInfo>();

  constructor(
    private readonly gl: WebGL2RenderingContext,
    frag: string,
    label: string,
  ) {
    const vs = this.compile(gl.VERTEX_SHADER, VERT, label);
    const fs = this.compile(gl.FRAGMENT_SHADER, frag, label);
    const p = gl.createProgram()!;
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`[${label}] link failed: ${gl.getProgramInfoLog(p)}`);
    }
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    this.program = p;
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i)!;
      const name = info.name.replace(/\[0\]$/, "");
      const loc = gl.getUniformLocation(p, info.name)!;
      this.uniforms.set(name, { loc, type: info.type, size: info.size });
    }
  }

  private compile(type: number, src: string, label: string): WebGLShader {
    const gl = this.gl;
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s) ?? "";
      const lines = src
        .split("\n")
        .map((l, i) => `${i + 1}: ${l}`)
        .join("\n");
      throw new Error(`[${label}] shader compile failed:\n${log}\n${lines}`);
    }
    return s;
  }

  use(values: UniformMap) {
    const gl = this.gl;
    gl.useProgram(this.program);
    let unit = 0;
    for (const [name, u] of this.uniforms) {
      const v = values[name];
      if (v === undefined || v === null) {
        if (u.type === gl.SAMPLER_2D) {
          throw new Error(`Missing texture for sampler ${name}`);
        }
        continue;
      }
      switch (u.type) {
        case gl.SAMPLER_2D:
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, v as WebGLTexture);
          gl.uniform1i(u.loc, unit);
          unit++;
          break;
        case gl.FLOAT:
          if (typeof v === "number") gl.uniform1f(u.loc, v);
          else gl.uniform1fv(u.loc, v as Float32Array);
          break;
        case gl.INT:
        case gl.BOOL:
          gl.uniform1i(u.loc, v as number);
          break;
        case gl.FLOAT_VEC2:
          gl.uniform2fv(u.loc, v as Float32Array);
          break;
        case gl.FLOAT_VEC3:
          gl.uniform3fv(u.loc, v as Float32Array);
          break;
        case gl.FLOAT_VEC4:
          gl.uniform4fv(u.loc, v as Float32Array);
          break;
        case gl.FLOAT_MAT3:
          gl.uniformMatrix3fv(u.loc, false, v as Float32Array);
          break;
        default:
          throw new Error(`Unsupported uniform type for ${name}`);
      }
    }
  }
}

export type PostSettings = {
  dofMaxRadius: number; // in pixels at internal resolution
  bloom: number;
  bloomThreshold: number;
  bloomTint: number[];
  exposure: number;
  vignette: number;
  grain: number;
};

export class Renderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly floatTargets: boolean;
  private readonly tri: WebGLVertexArrayObject;
  private readonly vbo: WebGLBuffer;
  private readonly baked: Record<string, WebGLTexture> = {};
  private readonly scene: Program;
  private readonly copy: Program;
  private readonly dof: Program;
  private readonly bright: Program;
  private readonly blur: Program;
  private readonly composite: Program;
  private readonly fxaa: Program;
  private readonly tScene: Target;
  private readonly tHalf: Target;
  private readonly tDof: Target;
  private readonly tLdr: Target;
  private readonly tBloom: { a: Target; b: Target }[];
  private readonly iw: number;
  private readonly ih: number;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    opts: RendererOptions,
  ) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    if (!gl) {
      throw new Error("WebGL 2 is not available in this browser");
    }
    this.gl = gl;
    this.floatTargets =
      Boolean(gl.getExtension("EXT_color_buffer_float")) ||
      Boolean(gl.getExtension("EXT_color_buffer_half_float"));
    gl.getExtension("OES_texture_float_linear");

    this.iw = opts.internalWidth;
    this.ih = opts.internalHeight;

    // full-screen triangle
    this.tri = gl.createVertexArray()!;
    gl.bindVertexArray(this.tri);
    this.vbo = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);

    this.scene = new Program(gl, opts.sceneFrag, "scene");
    this.copy = new Program(gl, COPY_FRAG, "copy");
    this.dof = new Program(gl, DOF_FRAG, "dof");
    this.bright = new Program(gl, BRIGHT_FRAG, "bright");
    this.blur = new Program(gl, BLUR_FRAG, "blur");
    this.composite = new Program(gl, COMPOSITE_FRAG, "composite");
    this.fxaa = new Program(gl, FXAA_FRAG, "fxaa");

    for (const bake of opts.bakes) {
      this.baked[bake.name] = this.bake(bake);
    }

    const hw = Math.max(1, Math.round(this.iw / 2));
    const hh = Math.max(1, Math.round(this.ih / 2));
    this.tScene = this.createTarget(this.iw, this.ih, false);
    this.tHalf = this.createTarget(hw, hh, false);
    this.tDof = this.createTarget(hw, hh, false);
    this.tLdr = this.createTarget(canvas.width, canvas.height, false, true);
    this.tBloom = [4, 8, 16].map((d) => {
      const w = Math.max(1, Math.round(this.iw / d));
      const h = Math.max(1, Math.round(this.ih / d));
      return {
        a: this.createTarget(w, h, false),
        b: this.createTarget(w, h, false),
      };
    });
  }

  private createTarget(
    w: number,
    h: number,
    repeatMip: boolean,
    ldr = false,
  ): Target {
    const gl = this.gl;
    const tex = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    if (this.floatTargets && !ldr) {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA16F,
        w,
        h,
        0,
        gl.RGBA,
        gl.HALF_FLOAT,
        null,
      );
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA8,
        w,
        h,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null,
      );
    }
    const wrap = repeatMip ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(
      gl.TEXTURE_2D,
      gl.TEXTURE_MIN_FILTER,
      repeatMip ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR,
    );
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D,
      tex,
      0,
    );
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`Framebuffer incomplete: 0x${status.toString(16)}`);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, tex, w, h };
  }

  private bake(spec: BakeSpec): WebGLTexture {
    const gl = this.gl;
    const prog = new Program(gl, spec.frag, `bake:${spec.name}`);
    const target = this.createTarget(spec.size, spec.size, true);
    this.draw(prog, target, spec.uniforms);
    gl.bindTexture(gl.TEXTURE_2D, target.tex);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.deleteFramebuffer(target.fbo);
    gl.deleteProgram(prog.program);
    return target.tex;
  }

  private draw(prog: Program, target: Target | null, values: UniformMap) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
    if (target) gl.viewport(0, 0, target.w, target.h);
    else gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    prog.use(values);
    gl.bindVertexArray(this.tri);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  render(sceneUniforms: UniformMap, post: PostSettings, frame: number) {
    const gl = this.gl;
    if (gl.isContextLost()) {
      throw new Error("WebGL context was lost");
    }
    // 1. scene
    this.draw(this.scene, this.tScene, {
      ...sceneUniforms,
      ...this.baked,
      uRes: [this.iw, this.ih],
    });
    // 2. half-res copy
    this.draw(this.copy, this.tHalf, { uTex: this.tScene.tex });
    // 3. depth of field
    this.draw(this.dof, this.tDof, {
      uTex: this.tHalf.tex,
      uTexel: [1 / this.tHalf.w, 1 / this.tHalf.h],
      uMaxRadius: (post.dofMaxRadius * this.ih) / 2160 / 2,
    });
    // 4. bloom chain
    let src = this.tDof.tex;
    this.tBloom.forEach((lvl, i) => {
      if (i === 0) {
        this.draw(this.bright, lvl.a, {
          uTex: src,
          uThreshold: post.bloomThreshold,
        });
      } else {
        this.draw(this.copy, lvl.a, { uTex: src });
      }
      for (let pass = 0; pass < 2; pass++) {
        this.draw(this.blur, lvl.b, {
          uTex: lvl.a.tex,
          uDir: [1 / lvl.a.w, 0],
        });
        this.draw(this.blur, lvl.a, {
          uTex: lvl.b.tex,
          uDir: [0, 1 / lvl.a.h],
        });
      }
      src = lvl.a.tex;
    });
    // 5. composite (tone-mapped, output resolution)
    this.draw(this.composite, this.tLdr, {
      uScene: this.tScene.tex,
      uDof: this.tDof.tex,
      uBloom1: this.tBloom[0].a.tex,
      uBloom2: this.tBloom[1].a.tex,
      uBloom3: this.tBloom[2].a.tex,
      uBloom: post.bloom,
      uBloomTint: post.bloomTint,
      uExposure: post.exposure,
      uVignette: post.vignette,
    });
    // 6. FXAA + grain to the canvas
    this.draw(this.fxaa, null, {
      uTex: this.tLdr.tex,
      uTexel: [1 / this.tLdr.w, 1 / this.tLdr.h],
      uOutRes: [this.canvas.width, this.canvas.height],
      uFrame: frame,
      uGrain: post.grain,
    });
    gl.flush();
  }

  dispose() {
    const gl = this.gl;
    const targets = [
      this.tScene,
      this.tHalf,
      this.tDof,
      this.tLdr,
      ...this.tBloom.flatMap((l) => [l.a, l.b]),
    ];
    for (const t of targets) {
      gl.deleteFramebuffer(t.fbo);
      gl.deleteTexture(t.tex);
    }
    for (const t of Object.values(this.baked)) gl.deleteTexture(t);
    for (const p of [
      this.scene,
      this.copy,
      this.dof,
      this.bright,
      this.blur,
      this.composite,
      this.fxaa,
    ]) {
      gl.deleteProgram(p.program);
    }
    gl.deleteBuffer(this.vbo);
    gl.deleteVertexArray(this.tri);
  }
}

export const GLSL_HEADER = HEADER;

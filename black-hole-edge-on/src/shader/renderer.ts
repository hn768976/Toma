import { LENSING_FRAG } from "./lensing.frag";
import {
  COMPOSITE_FRAG,
  DOWNSAMPLE_FRAG,
  PREFILTER_FRAG,
  QUAD_VERT,
  UPSAMPLE_FRAG,
} from "./post.frag";
import type { Look } from "../presets";

type Uniforms = Record<string, WebGLUniformLocation | null>;

type Program = {
  program: WebGLProgram;
  uniforms: Uniforms;
};

type Level = {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
};

const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
  const sh = gl.createShader(type);
  if (!sh) throw new Error("could not create shader");
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader compile failed: ${log}`);
  }
  return sh;
};

const link = (gl: WebGL2RenderingContext, fragSrc: string, names: string[]): Program => {
  const vs = compile(gl, gl.VERTEX_SHADER, QUAD_VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();
  if (!program) throw new Error("could not create program");
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(program)}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  const uniforms: Uniforms = {};
  for (const n of names) uniforms[n] = gl.getUniformLocation(program, n);
  return { program, uniforms };
};

const SCENE_UNIFORMS = [
  "uRes", "uTime", "uTiltDeg", "uCamDist", "uZoom", "uDiscIn", "uDiscOut",
  "uAniso", "uAngScale", "uSpinTurns", "uSpinRef", "uSpinMax", "uOpacity", "uBeaming",
  "uShimmer", "uSecondary", "uPhotonRing", "uStars", "uHaze", "uHazeColor",
  "uBackground", "uRamp0", "uRamp1", "uRamp2", "uRamp3", "uRamp4", "uSteps",
  "uExposure",
];

export class BlackHoleRenderer {
  private gl: WebGL2RenderingContext;
  private scene: Program;
  private prefilter: Program;
  private downsample: Program;
  private upsample: Program;
  private composite: Program;
  private sceneLevel: Level;
  private mips: Level[];
  private hdr: boolean;
  readonly width: number;
  readonly height: number;

  constructor(canvas: HTMLCanvasElement, aa: number) {
    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      // Remotion screenshots the canvas after the draw call, so the backbuffer
      // has to survive past the end of the frame.
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    if (!gl) throw new Error("WebGL2 is not available in this browser");
    this.gl = gl;
    this.width = canvas.width;
    this.height = canvas.height;

    // Half-float render targets keep the disc's highlights well above 1.0 so
    // the bloom has real energy to spread. Without them the glow flattens out.
    this.hdr = Boolean(gl.getExtension("EXT_color_buffer_float"));

    const sceneSrc = LENSING_FRAG.replace(
      "precision highp float;",
      `precision highp float;\n#define AA ${aa}`,
    );

    this.scene = link(gl, sceneSrc, SCENE_UNIFORMS);
    this.prefilter = link(gl, PREFILTER_FRAG, ["uTex", "uTexel", "uThreshold", "uKnee"]);
    this.downsample = link(gl, DOWNSAMPLE_FRAG, ["uTex", "uTexel"]);
    this.upsample = link(gl, UPSAMPLE_FRAG, ["uTex", "uTexel", "uRadius"]);
    this.composite = link(gl, COMPOSITE_FRAG, [
      "uScene", "uBloom", "uBloomStrength", "uGrain", "uSeed", "uSaturation", "uRes",
    ]);

    this.sceneLevel = this.makeLevel(this.width, this.height);

    // Enough levels that the smallest is ~8px: at 1080p that is 7 levels, and
    // the top one covers most of the frame - the wide cinematic haze.
    const levels = Math.max(3, Math.min(7, Math.floor(Math.log2(Math.min(this.width, this.height))) - 3));
    this.mips = [];
    let w = this.width;
    let h = this.height;
    for (let i = 0; i < levels; i++) {
      w = Math.max(1, w >> 1);
      h = Math.max(1, h >> 1);
      this.mips.push(this.makeLevel(w, h));
    }

    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  private makeLevel(w: number, h: number): Level {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) throw new Error("could not create texture");
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

    const fbo = gl.createFramebuffer();
    if (!fbo) throw new Error("could not create framebuffer");
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      throw new Error(`incomplete framebuffer (0x${status.toString(16)}) at ${w}x${h}`);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, w, h };
  }

  private target(level: Level | null) {
    const gl = this.gl;
    if (level) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, level.fbo);
      gl.viewport(0, 0, level.w, level.h);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.width, this.height);
    }
  }

  private quad() {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  }

  private bind(tex: WebGLTexture, unit: number) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  /**
   * @param look   the version's uniform set
   * @param time   loop phase, frame / durationInFrames, in [0, 1)
   * @param seed   per-frame grain seed
   */
  render(look: Look, time: number, seed: number) {
    const gl = this.gl;

    // ---- 1. geodesic pass into the HDR scene buffer
    this.target(this.sceneLevel);
    gl.useProgram(this.scene.program);
    const u = this.scene.uniforms;
    gl.uniform2f(u.uRes, this.width, this.height);
    gl.uniform1f(u.uTime, time);
    gl.uniform1f(u.uTiltDeg, look.tiltDeg);
    gl.uniform1f(u.uCamDist, look.camDist);
    gl.uniform1f(u.uZoom, look.zoom);
    gl.uniform1f(u.uDiscIn, look.discIn);
    gl.uniform1f(u.uDiscOut, look.discOut);
    gl.uniform1f(u.uAniso, look.aniso);
    gl.uniform1f(u.uAngScale, look.angScale);
    gl.uniform1f(u.uSpinTurns, look.spinTurns);
    gl.uniform1f(u.uSpinRef, look.spinRef);
    gl.uniform1f(u.uSpinMax, look.spinMax);
    gl.uniform1f(u.uOpacity, look.opacity);
    gl.uniform1f(u.uBeaming, look.beaming);
    gl.uniform1f(u.uShimmer, look.shimmer);
    gl.uniform1f(u.uSecondary, look.secondary);
    gl.uniform1f(u.uPhotonRing, look.photonRing);
    gl.uniform1f(u.uStars, look.stars);
    gl.uniform1f(u.uHaze, look.haze);
    gl.uniform3fv(u.uHazeColor, look.hazeColor);
    gl.uniform3fv(u.uBackground, look.background);
    gl.uniform3fv(u.uRamp0, look.ramp[0]);
    gl.uniform3fv(u.uRamp1, look.ramp[1]);
    gl.uniform3fv(u.uRamp2, look.ramp[2]);
    gl.uniform3fv(u.uRamp3, look.ramp[3]);
    gl.uniform3fv(u.uRamp4, look.ramp[4]);
    gl.uniform1i(u.uSteps, look.steps);
    gl.uniform1f(u.uExposure, look.exposure);
    this.quad();

    // ---- 2. bright pass into the top of the pyramid
    this.target(this.mips[0]);
    gl.useProgram(this.prefilter.program);
    this.bind(this.sceneLevel.tex, 0);
    gl.uniform1i(this.prefilter.uniforms.uTex, 0);
    gl.uniform2f(this.prefilter.uniforms.uTexel, 1 / this.width, 1 / this.height);
    gl.uniform1f(this.prefilter.uniforms.uThreshold, look.bloomThreshold);
    gl.uniform1f(this.prefilter.uniforms.uKnee, look.bloomKnee);
    this.quad();

    // ---- 3. down the pyramid
    gl.useProgram(this.downsample.program);
    gl.uniform1i(this.downsample.uniforms.uTex, 0);
    for (let i = 1; i < this.mips.length; i++) {
      const src = this.mips[i - 1];
      this.target(this.mips[i]);
      this.bind(src.tex, 0);
      gl.uniform2f(this.downsample.uniforms.uTexel, 1 / src.w, 1 / src.h);
      this.quad();
    }

    // ---- 4. back up, adding each level into the one below it
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.useProgram(this.upsample.program);
    gl.uniform1i(this.upsample.uniforms.uTex, 0);
    gl.uniform1f(this.upsample.uniforms.uRadius, look.bloomRadius);
    for (let i = this.mips.length - 1; i > 0; i--) {
      const src = this.mips[i];
      this.target(this.mips[i - 1]);
      this.bind(src.tex, 0);
      gl.uniform2f(this.upsample.uniforms.uTexel, 1 / src.w, 1 / src.h);
      this.quad();
    }
    gl.disable(gl.BLEND);

    // ---- 5. composite to the canvas
    this.target(null);
    gl.useProgram(this.composite.program);
    this.bind(this.sceneLevel.tex, 0);
    this.bind(this.mips[0].tex, 1);
    gl.uniform1i(this.composite.uniforms.uScene, 0);
    gl.uniform1i(this.composite.uniforms.uBloom, 1);
    gl.uniform1f(this.composite.uniforms.uBloomStrength, look.bloomStrength);
    gl.uniform1f(this.composite.uniforms.uGrain, look.grain);
    gl.uniform1f(this.composite.uniforms.uSaturation, look.saturation);
    gl.uniform1f(this.composite.uniforms.uSeed, seed);
    gl.uniform2f(this.composite.uniforms.uRes, this.width, this.height);
    this.quad();

    // Make sure the pixels are actually there before Remotion screenshots.
    gl.finish();
  }

  dispose() {
    const gl = this.gl;
    for (const l of [this.sceneLevel, ...this.mips]) {
      gl.deleteTexture(l.tex);
      gl.deleteFramebuffer(l.fbo);
    }
    for (const p of [this.scene, this.prefilter, this.downsample, this.upsample, this.composite]) {
      gl.deleteProgram(p.program);
    }
  }
}

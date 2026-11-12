import {
  bindTarget,
  bindTex,
  createProgram,
  createTarget,
  drawFullscreen,
  loc,
  Program,
  Target,
} from "./glUtils";
import {
  BLUR_FS,
  BRIGHT_FS,
  COMPOSITE_FS,
  DOWN_FS,
  FIELD_FS,
  MAX_STOPS,
  MAX_STREAKS,
  SCENE_FS,
} from "./shaders";

export type Vec3 = [number, number, number];

export type FrameParams = {
  time: number;
  progress: number;
  camPos: Vec3;
  camTarget: Vec3;
  fovDeg: number;
  palette: { pos: number; color: Vec3 }[]; // linear-light colors
  streakColor: Vec3;
  fogColor: Vec3;
  fogStart: number;
  floorLo: number;
  floorHi: number;
  streaks: [number, number, number, number][];
  streakCenter: [number, number];
  exposure: number;
  bloomA: number;
  bloomB: number;
  bloomThreshold: number;
};

const DOMAIN = 5.0; // field texture covers [-5, 5]^2 world units
const FIELD_RES = 2048;
const DELTA = 0.12; // contour spacing in field units
const RIM_R = 0.0095; // rim tube radius in world units
const STEP = 0.014; // horizontal ray-march step in world units

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const norm = (a: Vec3): Vec3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

export class ContourRenderer {
  private gl: WebGL2RenderingContext;
  readonly width: number;
  readonly height: number;
  private pField: Program;
  private pScene: Program;
  private pBright: Program;
  private pDown: Program;
  private pBlur: Program;
  private pComp: Program;
  private field: Target;
  private scene: Target;
  private b1a: Target;
  private b1b: Target;
  private b2a: Target;
  private b2b: Target;
  private vao: WebGLVertexArrayObject;

  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2", {
      antialias: false,
      preserveDrawingBuffer: true,
      premultipliedAlpha: false,
      alpha: false,
    });
    if (!gl) throw new Error("WebGL 2 is not available in this browser.");
    if (!gl.getExtension("EXT_color_buffer_float")) {
      throw new Error("EXT_color_buffer_float is required for HDR render targets.");
    }
    this.gl = gl;
    this.width = canvas.width;
    this.height = canvas.height;

    this.pField = createProgram(gl, FIELD_FS);
    this.pScene = createProgram(gl, SCENE_FS);
    this.pBright = createProgram(gl, BRIGHT_FS);
    this.pDown = createProgram(gl, DOWN_FS);
    this.pBlur = createProgram(gl, BLUR_FS);
    this.pComp = createProgram(gl, COMPOSITE_FS);

    const vao = gl.createVertexArray();
    if (!vao) throw new Error("createVertexArray failed");
    this.vao = vao;

    const W = this.width;
    const H = this.height;
    const hdr = [gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT] as const;
    // R32F is only linearly filterable with OES_texture_float_linear; fall back to R16F.
    this.field = gl.getExtension("OES_texture_float_linear")
      ? createTarget(gl, FIELD_RES, FIELD_RES, gl.R32F, gl.RED, gl.FLOAT)
      : createTarget(gl, FIELD_RES, FIELD_RES, gl.R16F, gl.RED, gl.HALF_FLOAT);
    this.scene = createTarget(gl, W, H, ...hdr);
    const w1 = Math.max(1, Math.round(W / 4));
    const h1 = Math.max(1, Math.round(H / 4));
    const w2 = Math.max(1, Math.round(W / 8));
    const h2 = Math.max(1, Math.round(H / 8));
    this.b1a = createTarget(gl, w1, h1, ...hdr);
    this.b1b = createTarget(gl, w1, h1, ...hdr);
    this.b2a = createTarget(gl, w2, h2, ...hdr);
    this.b2b = createTarget(gl, w2, h2, ...hdr);
  }

  render(f: FrameParams) {
    const gl = this.gl;
    gl.bindVertexArray(this.vao);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    // 1. Bake the scalar field.
    bindTarget(gl, this.field);
    gl.useProgram(this.pField.program);
    gl.uniform1f(loc(gl, this.pField, "uDomain"), DOMAIN);
    gl.uniform1f(loc(gl, this.pField, "uTime"), f.time);
    gl.uniform1f(loc(gl, this.pField, "uProgress"), f.progress);
    drawFullscreen(gl);

    // 2. Ray-march the contour walls.
    const fwd = norm(sub(f.camTarget, f.camPos));
    const right = norm(cross(fwd, [0, 0, 1]));
    const up = cross(right, fwd);
    bindTarget(gl, this.scene);
    const s = this.pScene;
    gl.useProgram(s.program);
    bindTex(gl, 0, this.field.tex);
    gl.uniform1i(loc(gl, s, "uField"), 0);
    gl.uniform1f(loc(gl, s, "uDomain"), DOMAIN);
    gl.uniform2f(loc(gl, s, "uRes"), this.width, this.height);
    gl.uniform3fv(loc(gl, s, "uCamPos"), f.camPos);
    gl.uniform3fv(loc(gl, s, "uCamRight"), right);
    gl.uniform3fv(loc(gl, s, "uCamUp"), up);
    gl.uniform3fv(loc(gl, s, "uCamFwd"), fwd);
    gl.uniform1f(loc(gl, s, "uTanHalfFov"), Math.tan(((f.fovDeg / 2) * Math.PI) / 180));
    gl.uniform1f(loc(gl, s, "uDelta"), DELTA);
    gl.uniform1f(loc(gl, s, "uRimR"), RIM_R);
    gl.uniform1f(loc(gl, s, "uStep"), STEP);
    gl.uniform1f(loc(gl, s, "uTime"), f.time);
    gl.uniform1f(loc(gl, s, "uProgress"), f.progress);
    const pal = f.palette.slice(0, MAX_STOPS);
    const palCol = new Float32Array(MAX_STOPS * 3);
    const palPos = new Float32Array(MAX_STOPS);
    pal.forEach((p, i) => {
      palCol.set(p.color, i * 3);
      palPos[i] = p.pos;
    });
    gl.uniform3fv(loc(gl, s, "uPalCol"), palCol);
    gl.uniform1fv(loc(gl, s, "uPalPos"), palPos);
    gl.uniform1i(loc(gl, s, "uPalCount"), pal.length);
    gl.uniform3fv(loc(gl, s, "uStreakCol"), f.streakColor);
    const st = new Float32Array(MAX_STREAKS * 4);
    const streaks = f.streaks.slice(0, MAX_STREAKS);
    streaks.forEach((k, i) => st.set(k, i * 4));
    gl.uniform4fv(loc(gl, s, "uStreaks"), st);
    gl.uniform1i(loc(gl, s, "uStreakCount"), streaks.length);
    gl.uniform2fv(loc(gl, s, "uStreakCenter"), f.streakCenter);
    gl.uniform3fv(loc(gl, s, "uFogCol"), f.fogColor);
    gl.uniform1f(loc(gl, s, "uFogStart"), f.fogStart);
    gl.uniform1f(loc(gl, s, "uFloorLo"), f.floorLo);
    gl.uniform1f(loc(gl, s, "uFloorHi"), f.floorHi);
    gl.uniform3fv(loc(gl, s, "uLightDir"), norm([-0.4, -0.7, 0.6]));
    drawFullscreen(gl);

    // 3. Bloom: bright-pass downsample to 1/4, blur; then 1/8, blur.
    bindTarget(gl, this.b1a);
    gl.useProgram(this.pBright.program);
    bindTex(gl, 0, this.scene.tex);
    gl.uniform1i(loc(gl, this.pBright, "uSrc"), 0);
    gl.uniform2f(loc(gl, this.pBright, "uTexel"), 1 / this.width, 1 / this.height);
    gl.uniform1f(loc(gl, this.pBright, "uThreshold"), f.bloomThreshold);
    drawFullscreen(gl);
    this.blur(this.b1a, this.b1b);

    bindTarget(gl, this.b2a);
    gl.useProgram(this.pDown.program);
    bindTex(gl, 0, this.b1a.tex);
    gl.uniform1i(loc(gl, this.pDown, "uSrc"), 0);
    gl.uniform2f(loc(gl, this.pDown, "uTexel"), 1 / this.b1a.width, 1 / this.b1a.height);
    drawFullscreen(gl);
    this.blur(this.b2a, this.b2b);
    this.blur(this.b2a, this.b2b);

    // 4. Composite + tone-map to the canvas.
    bindTarget(gl, null, this.width, this.height);
    const c = this.pComp;
    gl.useProgram(c.program);
    bindTex(gl, 0, this.scene.tex);
    bindTex(gl, 1, this.b1a.tex);
    bindTex(gl, 2, this.b2a.tex);
    gl.uniform1i(loc(gl, c, "uScene"), 0);
    gl.uniform1i(loc(gl, c, "uBloom1"), 1);
    gl.uniform1i(loc(gl, c, "uBloom2"), 2);
    gl.uniform1f(loc(gl, c, "uBloomA"), f.bloomA);
    gl.uniform1f(loc(gl, c, "uBloomB"), f.bloomB);
    gl.uniform1f(loc(gl, c, "uExposure"), f.exposure);
    gl.uniform1f(loc(gl, c, "uVignette"), 0.55);
    drawFullscreen(gl);
    gl.finish();
  }

  dispose() {
    const gl = this.gl;
    for (const t of [this.field, this.scene, this.b1a, this.b1b, this.b2a, this.b2b]) {
      gl.deleteFramebuffer(t.fbo);
      gl.deleteTexture(t.tex);
    }
    for (const p of [this.pField, this.pScene, this.pBright, this.pDown, this.pBlur, this.pComp]) {
      gl.deleteProgram(p.program);
    }
    gl.deleteVertexArray(this.vao);
  }

  private blur(a: Target, b: Target) {
    const gl = this.gl;
    gl.useProgram(this.pBlur.program);
    gl.uniform1i(loc(gl, this.pBlur, "uSrc"), 0);
    bindTarget(gl, b);
    bindTex(gl, 0, a.tex);
    gl.uniform2f(loc(gl, this.pBlur, "uDir"), 1 / a.width, 0);
    drawFullscreen(gl);
    bindTarget(gl, a);
    bindTex(gl, 0, b.tex);
    gl.uniform2f(loc(gl, this.pBlur, "uDir"), 0, 1 / a.height);
    drawFullscreen(gl);
  }
}

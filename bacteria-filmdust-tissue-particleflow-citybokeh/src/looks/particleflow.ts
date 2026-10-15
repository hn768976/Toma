import { Geometry, GlProgram, Mesh, Shader, UniformGroup } from "pixi.js";
import { GLSL_COMMON, Pass, es300, validateProgram } from "../engine/gl";
import { hexToRgb, type Grade } from "../engine/post";
import { mulberry32, range } from "../engine/rng";
import type { LookFactory } from "../engine/types";

// ---------------------------------------------------------------------------
// Look 4 — Particle Flow. ~250k points on 4 curved sheets, projected in a
// custom vertex shader. Each point keeps a fixed (u0, v); its position along
// the sheet is u = fract(u0 + n * phase) with integer n, so it advances a
// whole number of sheet lengths per loop. Sheet undulation, hollows and the
// camera drift are whole-cycle functions of the phase.
// ---------------------------------------------------------------------------

export type ParticleFlowParams = {
  seed: number;
  count: number;
  deep: string; // sheet colour deep inside
  sheet: string; // sheet colour
  edge: string; // edge specks
  edge2: string; // secondary edge colour
  haze: string;
};


const VERT = /* glsl */ `
${GLSL_COMMON}
in vec2 aPosition;   // u0, v
in vec4 aRand;       // sheet index, r1, r2, r3
uniform float uPhase;
uniform float uFlip;
uniform float uAspect;
uniform float uFocal;
uniform float uPx;          // output pixels per 720p pixel
uniform vec3 uCamPos; uniform vec3 uCamR; uniform vec3 uCamU; uniform vec3 uCamF;
uniform float uFocusDepth;
uniform vec4 uSheetA[5];   // baseY, halfWidth, zOffset, curl
uniform vec4 uSheetB[5];   // amp1, freq1, amp2, freq2
uniform vec4 uSheetC[5];   // flow turns per loop, phase seed, hole density, brightness
uniform vec3 uDeep; uniform vec3 uSheet; uniform vec3 uEdge; uniform vec3 uEdge2;
out vec3 vColor;
out float vStar;

const float L = 72.0; // sheet length (world units)

float vn(vec2 p) { // cheap value noise for the hollows
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1, 0)), c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 sheetPos(int k, float x, float v, float ph) {
  vec4 A = uSheetA[k], B = uSheetB[k], C = uSheetC[k];
  float s = C.y;
  // cross-section (y, z) = (0, v * halfWidth), curled around the sheet axis
  float th = A.w * sin(x * 0.10 + v * 0.9 + TAU * ph + s) + 0.35 * A.w * sin(x * 0.23 - TAU * ph + s * 2.0);
  vec2 yz = vec2(0.0, v * A.y);
  yz = vec2(yz.x * cos(th) - yz.y * sin(th), yz.x * sin(th) + yz.y * cos(th));
  float y = A.x + yz.x
          + B.x * sin(x * B.y + v * 1.3 + TAU * ph + s)
          + B.z * sin(x * B.w - v * 2.1 - TAU * 2.0 * ph + s * 1.7);
  float z = A.z + yz.y + 0.8 * sin(x * 0.06 + TAU * ph + s * 0.5);
  return vec3(x, y, z);
}

void main() {
  int k = int(aRand.x + 0.5);
  float ph = uPhase;
  vec4 C = uSheetC[k];
  float u = fract(aPosition.x + C.x * ph);
  float v = aPosition.y;
  float x = (u - 0.5) * L;

  // sand-like thickness: jitter off the surface
  vec3 p = sheetPos(k, x, v, ph);
  vec3 px = sheetPos(k, x + 0.05, v, ph);
  vec3 pv = sheetPos(k, x, v + 0.02, ph);
  vec3 n = normalize(cross(px - p, pv - p));
  p += n * (aRand.y - 0.5) * 0.22 * (0.4 + aRand.z);

  vec3 d = p - uCamPos;
  vec3 view = vec3(dot(d, uCamR), dot(d, uCamU), dot(d, uCamF));
  float depth = max(view.z, 0.05);
  gl_Position = vec4(view.x * uFocal / uAspect, view.y * uFocal * uFlip, 0.0, depth);

  // grazing angle -> bright, larger edge specks
  vec3 vd = normalize(d);
  float graze = 1.0 - abs(dot(n, vd));
  float edgeT = pow(graze, 3.0);
  // dark hollows fixed on the sheet (in x, v); particles fade through them
  float h = 0.65 * vn(vec2(x * 0.16 + C.y * 7.0, v * 1.8 + C.y * 3.0)) + 0.35 * vn(vec2(x * 0.4 + 3.0, v * 4.0 + C.y));
  float hole = 1.0 - smoothstep(C.z, C.z + 0.08, h);
  // fade at sheet ends and side edges
  float ends = smoothstep(0.0, 0.08, u) * smoothstep(1.0, 0.92, u);
  float sides = smoothstep(1.0, 0.8, abs(v));

  float star = step(0.9965, aRand.w);
  vStar = star;
  // depth of field: points away from the focal depth grow and dim
  float coc = abs(depth - uFocusDepth) / uFocusDepth;
  float size = (1.0 + 0.9 * aRand.z + 0.8 * edgeT) * (1.0 + star * 2.2);
  float sizePx = size * uPx * (1.0 + 3.0 * coc) * clamp(17.0 / depth, 0.6, 2.0);
  gl_PointSize = max(sizePx, 1.0);
  float energy = (size * uPx) * (size * uPx) / (gl_PointSize * gl_PointSize);

  vec3 col = mix(uDeep, uSheet, clamp(0.45 + 0.75 * aRand.z + 0.4 * graze, 0.0, 1.0)) * 1.6;
  vec3 ec = mix(uEdge, uEdge2, aRand.y);
  col = mix(col, ec, clamp(edgeT * 1.6 + star, 0.0, 1.0));
  float a = C.w * hole * ends * sides * energy * (0.55 + 0.45 * aRand.z) * (1.0 + 0.6 * edgeT + 2.0 * star);
  a *= clamp(24.0 / depth, 0.5, 1.0); // distant sheets dimmer
  vColor = col * a;
}`;

const FRAG = /* glsl */ `
in vec3 vColor;
in float vStar;
out vec4 o;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  // round soft points; stars are little diamonds
  float r = mix(length(q), (abs(q.x) + abs(q.y)) * 0.85, vStar);
  float m = smoothstep(1.0, 0.55, r);
  o = vec4(vColor * m, 0.0);
}`;

const HAZE = /* glsl */ `
${GLSL_COMMON}
in vec2 vUV; out vec4 o;
uniform vec3 uHaze;
uniform float uPhase;
void main() {
  vec2 p = vUV - 0.5;
  // faint diagonal haze band following the flow
  float band = exp(-pow(dot(p, normalize(vec2(0.55, 0.85))) / 0.35, 2.0));
  float n = fbmP(vUV * vec2(3.0, 2.0) * 2.0 + vec2(cos(TAU * uPhase), sin(TAU * uPhase)) * 0.3, vec2(4096.0), 4);
  o = vec4(uHaze * band * (0.6 + 0.8 * n), 1.0);
}`;

const v3 = (hex: string) => new Float32Array(hexToRgb(hex));

export const createParticleFlow: LookFactory<ParticleFlowParams> = (ctx, params) => {
  const { W, H, px } = ctx;
  const rng = mulberry32(params.seed);
  const N = params.count;

  // sheet definitions (world units)
  const sheetA = new Float32Array(20);
  const sheetB = new Float32Array(20);
  const sheetC = new Float32Array(20);
  const defs = [
    // baseY, halfW, zOff, curl | amp1, f1, amp2, f2 | turns, seed, hole, bright | share of particles
    { A: [0.0, 4.5, -8.0, 0.55], B: [0.9, 0.16, 0.35, 0.41], C: [1, 0.3, 0.58, 0.55], share: 0.26 },
    { A: [2.0, 4.5, -1.0, 0.7], B: [0.7, 0.13, 0.4, 0.37], C: [1, 1.7, 0.6, 0.55], share: 0.26 },
    { A: [-1.5, 4.5, 6.0, 0.5], B: [1.0, 0.11, 0.3, 0.33], C: [2, 2.9, 0.58, 0.55], share: 0.24 },
    // a near sheet crossing the upper-left: sparse, larger, paler grains
    { A: [7.0, 4.0, 12.0, 0.35], B: [0.6, 0.1, 0.3, 0.27], C: [1, 5.3, 0.6, 0.4], share: 0.08 },
    { A: [-3.0, 5.0, 14.0, 0.45], B: [0.8, 0.09, 0.5, 0.29], C: [1, 4.1, 0.58, 0.4], share: 0.16 },
  ];
  defs.forEach((d, i) => {
    sheetA.set(d.A, i * 4);
    sheetB.set(d.B, i * 4);
    sheetC.set(d.C, i * 4);
  });

  const pos = new Float32Array(N * 2);
  const rnd = new Float32Array(N * 4);
  const cum = defs.map((_, i) => defs.slice(0, i + 1).reduce((a, d) => a + d.share, 0));
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const k = cum.findIndex((c) => t < c + 1e-9);
    pos[i * 2] = rng();
    // more particles towards the middle of each sheet, some spill to the sides
    const g = (rng() + rng() + rng()) / 3;
    pos[i * 2 + 1] = (g - 0.5) * 2.0 * 1.05 + range(rng, -0.03, 0.03);
    rnd[i * 4] = Math.max(0, k);
    rnd[i * 4 + 1] = rng();
    rnd[i * 4 + 2] = rng();
    rnd[i * 4 + 3] = rng();
  }
  const geometry = new Geometry({
    attributes: {
      aPosition: { buffer: pos, format: "float32x2" },
      aRand: { buffer: rnd, format: "float32x4" },
    },
    topology: "point-list",
  });
  const u = new UniformGroup({
    uPhase: { value: 0, type: "f32" },
    uFlip: { value: -1, type: "f32" },
    uAspect: { value: W / H, type: "f32" },
    uFocal: { value: 1.5, type: "f32" },
    uPx: { value: px, type: "f32" },
    uCamPos: { value: new Float32Array(3), type: "vec3<f32>" },
    uCamR: { value: new Float32Array(3), type: "vec3<f32>" },
    uCamU: { value: new Float32Array(3), type: "vec3<f32>" },
    uCamF: { value: new Float32Array(3), type: "vec3<f32>" },
    uFocusDepth: { value: 10, type: "f32" },
    uSheetA: { value: sheetA, type: "vec4<f32>", size: 5 },
    uSheetB: { value: sheetB, type: "vec4<f32>", size: 5 },
    uSheetC: { value: sheetC, type: "vec4<f32>", size: 5 },
    uDeep: { value: v3(params.deep), type: "vec3<f32>" },
    uSheet: { value: v3(params.sheet), type: "vec3<f32>" },
    uEdge: { value: v3(params.edge), type: "vec3<f32>" },
    uEdge2: { value: v3(params.edge2), type: "vec3<f32>" },
  } as never);
  const program = GlProgram.from({ vertex: es300(VERT), fragment: es300(FRAG), name: "particle-flow" });
  validateProgram(ctx.renderer, program);
  const shader = new Shader({ glProgram: program, resources: { flowUniforms: u } });
  const mesh = new Mesh({ geometry: geometry as never, shader });
  mesh.blendMode = "add";

  const haze = new Pass("flow-haze", HAZE, {
    uHaze: { value: v3(params.haze), type: "vec3<f32>" },
    uPhase: { value: 0, type: "f32" },
  });

  const grade: Grade = { mode: "rgb", bloom: 0.25, vignette: 0.35, vignetteShape: [0.5, 1.2], grain: 0.015, toneMap: true };
  ctx.post.setGrade(grade);

  const TAU = Math.PI * 2;
  type V = [number, number, number];
  const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a: V, b: V): V => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a: V): V => {
    const l = Math.hypot(...a);
    return [a[0] / l, a[1] / l, a[2] / l];
  };

  return {
    render(f) {
      const ph = f / 600;
      const uu = u.uniforms as Record<string, unknown>;
      uu.uPhase = ph;
      // camera: fixed framing, gentle closed drift
      const cam: V = [-3 + 0.6 * Math.sin(TAU * ph), 18 + 0.4 * Math.sin(TAU * ph * 2 + 1), -5 + 0.5 * Math.cos(TAU * ph)];
      const target: V = [2, 0, 1];
      const fwd = norm(sub(target, cam));
      let right = norm(cross(fwd, [0, 1, 0]));
      let up = cross(right, fwd);
      // roll so the flow runs diagonally across the frame
      const roll = -1.1 + 0.03 * Math.sin(TAU * ph);
      const cr = Math.cos(roll);
      const sr = Math.sin(roll);
      const r2: V = [right[0] * cr + up[0] * sr, right[1] * cr + up[1] * sr, right[2] * cr + up[2] * sr];
      const u2: V = [up[0] * cr - right[0] * sr, up[1] * cr - right[1] * sr, up[2] * cr - right[2] * sr];
      right = r2;
      up = u2;
      uu.uCamPos = new Float32Array(cam);
      uu.uCamR = new Float32Array(right);
      uu.uCamU = new Float32Array(up);
      uu.uCamF = new Float32Array(fwd);
      uu.uFocusDepth = 17;
      uu.uFlip = -1;

      haze.uniforms.uPhase = ph;
      haze.run(ctx.renderer, ctx.post.hdr);
      ctx.renderer.render({ container: mesh, target: ctx.post.hdr, clear: false });
      ctx.post.present(f);
    },
  };
};

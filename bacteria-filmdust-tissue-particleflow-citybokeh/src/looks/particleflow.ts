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
  grey: string; // the pale, desaturated near sheet
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
uniform vec4 uSheetC[5];   // flow turns per loop, phase seed, hole threshold, brightness
uniform vec4 uSheetD[5];   // grey amount, size multiplier, star rate, seam strength
uniform vec3 uDeep; uniform vec3 uSheet; uniform vec3 uEdge; uniform vec3 uEdge2; uniform vec3 uGrey;
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
  bool dust = k >= 5;            // index 5 = a fine dust haze filling the volume
  int ks = min(k, 4);
  float ph = uPhase;
  vec4 C = uSheetC[ks];
  vec4 D = uSheetD[ks];
  float u = fract(aPosition.x + (dust ? 1.0 : C.x) * ph);
  float v = aPosition.y;
  float x = (u - 0.5) * L;

  vec3 p;
  vec3 n;
  if (dust) {
    p = vec3(x, -5.0 + 14.0 * (v * 0.5 + 0.5), -16.0 + 40.0 * aRand.y);
    n = normalize(vec3(0.3, 1.0, 0.2));
  } else {
    // sand-like thickness: jitter off the surface
    p = sheetPos(ks, x, v, ph);
    vec3 px = sheetPos(ks, x + 0.05, v, ph);
    vec3 pv = sheetPos(ks, x, v + 0.02, ph);
    n = normalize(cross(px - p, pv - p));
    p += n * (aRand.y - 0.5) * 0.22 * (0.4 + aRand.z);
  }

  vec3 d = p - uCamPos;
  vec3 view = vec3(dot(d, uCamR), dot(d, uCamU), dot(d, uCamF));
  float depth = max(view.z, 0.05);
  gl_Position = vec4(view.x * uFocal / uAspect, view.y * uFocal * uFlip, 0.0, depth);

  // grazing angle -> slightly brighter, larger grains (kept subtle: no glowing streaks)
  vec3 vd = normalize(d);
  float graze = 1.0 - abs(dot(n, vd));
  float edgeT = pow(graze, 4.0) * 0.6;
  // a few elliptical voids fixed on the sheet (in x, v); particles thin out through them
  float h = vn(vec2(x * 0.05 + C.y * 7.0, v * 0.9 + C.y * 3.0));
  float hole = dust ? 1.0 : mix(1.0, 0.1, smoothstep(C.z, C.z + 0.08, h));
  // fade at sheet ends; crisp side edges with a bright seam of grains (the lips of the sheets)
  float ends = smoothstep(0.0, 0.08, u) * smoothstep(1.0, 0.92, u);
  float av = abs(v);
  float sides = dust ? 1.0 : smoothstep(1.02, 0.75, av);
  float seam = dust ? 1.0 : 1.0 + D.w * smoothstep(0.7, 0.95, av);

  float star = dust ? 0.0 : step(1.0 - D.z, aRand.w);
  vStar = star;
  // grain size: mostly fine dust, some medium specks, a few large soft grains
  float big = pow(aRand.z, 6.0);
  float size = (0.8 + 0.7 * aRand.z + 2.6 * big + 0.6 * edgeT) * D.y * (1.0 + star * 2.0);
  // depth of field: points away from the focal depth grow and soften
  float coc = abs(depth - uFocusDepth) / uFocusDepth;
  float sizePx = size * uPx * (1.0 + 3.0 * coc) * clamp(17.0 / depth, 0.6, 2.0);
  gl_PointSize = max(sizePx, 1.0);
  float energy = (size * uPx) * (size * uPx) / (gl_PointSize * gl_PointSize);
  energy = mix(energy, 1.0, 0.35); // keep soft grains visible as blobs

  vec3 blue = mix(uDeep, uSheet, clamp(0.5 + 0.7 * aRand.z + 0.3 * graze, 0.0, 1.0)) * 1.9;
  vec3 grey = mix(uGrey, uEdge2, aRand.y * 0.8) * 1.1;
  vec3 col = dust ? uGrey * 0.9 : mix(blue, grey, D.x);
  vec3 ec = mix(uEdge, uEdge2, aRand.y);
  col = mix(col, ec, clamp(edgeT + star + 0.35 * (seam - 1.0) / max(D.w, 0.01), 0.0, 1.0));
  float a = C.w * hole * ends * sides * seam * energy * (0.55 + 0.45 * aRand.z) * (1.0 + 2.0 * star);
  a *= clamp(24.0 / depth, 0.6, 1.0); // distant sheets a little dimmer
  if (dust) a = 0.4 * energy * (0.4 + 0.6 * aRand.z);
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
  o = vec4(uHaze * band * (0.6 + 0.8 * n) * 0.35, 1.0);
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
  const sheetD = new Float32Array(20);
  const defs = [
    // A: baseY, halfW, zOff, curl | B: amp1, f1, amp2, f2 | C: turns, seed, hole thr, bright
    // D: grey amount, size mult, star rate, seam strength | share of particles
    { A: [0.0, 5.5, -8.5, 0.4], B: [0.9, 0.16, 0.35, 0.41], C: [1, 0.3, 0.68, 0.85], D: [0, 0.72, 0.0003, 0.6], share: 0.27 },
    { A: [1.5, 5.0, -0.8, 0.45], B: [0.7, 0.13, 0.4, 0.37], C: [1, 1.7, 0.7, 0.85], D: [0.05, 0.72, 0.0003, 0.8], share: 0.25 },
    { A: [2.6, 5.0, 8.6, 0.4], B: [1.0, 0.11, 0.3, 0.33], C: [2, 2.9, 0.68, 0.42], D: [0.6, 0.85, 0.004, 0.6], share: 0.1 },
    // the near, sparse, grey-white sheet across the upper-left with big sparkles
    { A: [7.0, 6.0, 13.0, 0.3], B: [0.6, 0.1, 0.3, 0.27], C: [1, 5.3, 0.74, 0.42], D: [1.0, 1.1, 0.015, 0.4], share: 0.1 },
    { A: [-2.0, 7.0, 16.0, 0.35], B: [0.8, 0.09, 0.5, 0.29], C: [1, 4.1, 0.74, 0.4], D: [0.85, 0.9, 0.012, 0.4], share: 0.18 },
    // [5] dust haze (shape ignored; uses its own volume)
    { A: [0, 1, 0, 0], B: [0, 0, 0, 0], C: [1, 0, 1, 0.2], D: [1, 0.7, 0, 0], share: 0.1 },
  ];
  defs.slice(0, 5).forEach((d, i) => {
    sheetA.set(d.A, i * 4);
    sheetB.set(d.B, i * 4);
    sheetC.set(d.C, i * 4);
    sheetD.set(d.D, i * 4);
  });

  const pos = new Float32Array(N * 2);
  const rnd = new Float32Array(N * 4);
  const cum = defs.map((_, i) => defs.slice(0, i + 1).reduce((a, d) => a + d.share, 0));
  for (let i = 0; i < N; i++) {
    const t = i / N;
    const k = cum.findIndex((c) => t < c + 1e-9);
    pos[i * 2] = rng();
    // across the sheet: uniform, so the sheets stay dense right up to their lips
    pos[i * 2 + 1] = range(rng, -1, 1);
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
    uSheetD: { value: sheetD, type: "vec4<f32>", size: 5 },
    uDeep: { value: v3(params.deep), type: "vec3<f32>" },
    uSheet: { value: v3(params.sheet), type: "vec3<f32>" },
    uEdge: { value: v3(params.edge), type: "vec3<f32>" },
    uEdge2: { value: v3(params.edge2), type: "vec3<f32>" },
    uGrey: { value: v3(params.grey), type: "vec3<f32>" },
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

  const grade: Grade = { mode: "rgb", bloom: 0.12, vignette: 0.12, vignetteShape: [0.6, 1.3], grain: 0.015, toneMap: true };
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
      const roll = -1.4 + 0.03 * Math.sin(TAU * ph);
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

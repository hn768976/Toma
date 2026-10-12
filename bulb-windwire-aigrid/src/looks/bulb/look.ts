import {
  BufferGeometry,
  DoubleSide,
  GLSL3,
  Group,
  Mesh,
  PerspectiveCamera,
  RawShaderMaterial,
  Scene,
  Vector2,
  Vector3,
} from "three";
import { hexToSrgb, lin, type RGB } from "../../engine/color";
import { ADDITIVE, LineBatch, PointBatch } from "../../engine/lines";
import { Pipeline } from "../../engine/pipeline";
import { ease, mulberry32, range, TAU } from "../../engine/rng";
import { canvasTexture, SpriteBatch } from "../../engine/sprites";
import type { LookFactory } from "../../engine/Stage";
import {
  BASE_TIP,
  buildCap,
  buildContact,
  buildEnvelope,
  buildFilament,
  buildInsulator,
  buildScrew,
  buildStem,
  buildWires,
  ENVELOPE_GLSL,
  FILAMENT_A,
  FILAMENT_B,
} from "./geometry";
import { MAX_LINKS, PLEXUS_N, plexusFrame, type PlexusOut } from "./plexus";

export type BulbModelCheck = "off" | "lit" | "unlit";
export type BulbPalette = {
  filament: string;
  envelope: string;
  plexus: string;
  haze: string;
  bgDark: string;
  bgLight: string;
  metal: string;
  spark: string;
};

const LOOP = 600;

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------

const SOLID_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelMatrix, viewMatrix, projectionMatrix;
in vec3 position; in vec3 normal;
out vec3 vP; out vec3 vN;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vP = wp.xyz; vN = mat3(modelMatrix) * normal;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const LIGHT_GLSL = /* glsl */ `
uniform vec3 cameraPosition;
uniform float uLit, uVis, uSpark;
uniform vec3 uGlow, uFilCol, uSparkCol, uSparkPos;
const vec3 FA = vec3(${FILAMENT_A.x}, ${FILAMENT_A.y}, 0.0);
const vec3 FB = vec3(${FILAMENT_B.x}, ${FILAMENT_B.y}, 0.0);
float segDist(vec3 p, vec3 a, vec3 b) { vec3 ab = b - a; float t = clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0); return length(p - a - ab * t); }
vec3 filamentPoint(vec3 p) { vec3 ab = FB - FA; float t = clamp(dot(p - FA, ab) / dot(ab, ab), 0.0, 1.0); return FA + ab * t + vec3(0.0, sin(t * 3.14159) * 0.06, 0.0); }
// Studio-ish environment for reflections: a soft key box upper left, a strip right, dark floor.
float env(vec3 R) {
  // Crisp rectangular softbox upper left, a narrow vertical strip right, faint sky.
  vec3 kd = normalize(vec3(-0.55, 0.45, 0.7));
  vec3 kx = normalize(cross(vec3(0.0, 1.0, 0.0), kd)), ky = cross(kd, kx);
  float kz = dot(R, kd);
  vec2 kp = vec2(dot(R, kx), dot(R, ky)) / max(kz, 1e-3);
  float key = step(0.0, kz) * smoothstep(0.2, 0.17, abs(kp.x)) * smoothstep(0.3, 0.26, abs(kp.y)) * 2.2;
  vec3 sd = normalize(vec3(0.85, 0.1, 0.5));
  float strip = smoothstep(0.985, 0.995, dot(normalize(R.xz), normalize(sd.xz))) * smoothstep(-0.3, 0.2, R.y) * smoothstep(0.7, 0.4, R.y) * 1.3;
  float sky = smoothstep(-0.1, 0.9, R.y) * 0.03;
  return key + strip + sky;
}
`;

// Fake glass: fresnel rim and env highlights (no transmission), plus — when
// lit — an emissive volume integrated along the view ray inside the envelope.
const GLASS_FRAG = /* glsl */ `
precision highp float;
${LIGHT_GLSL}
${ENVELOPE_GLSL}
uniform vec3 uRim; uniform float uFill, uIsEnvelope, uRimGain, uLitGain;
in vec3 vP; in vec3 vN; out vec4 o;
float inside(vec3 q) {
  float r = envelopeRadius(q.y);
  float rr = length(q.xz);
  return smoothstep(r, r - 0.06, rr) * step(-0.02, q.y) * step(q.y, 2.6);
}
void main() {
  vec3 V = normalize(cameraPosition - vP);
  vec3 N = normalize(vN);
  if (dot(N, V) < 0.0) N = -N;
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 3.0);
  vec3 R = reflect(-V, N);
  bool front = gl_FrontFacing;
  // Highlights read stronger on the outer surface; the inner surface gives a faint second reflection.
  float side = front ? 1.0 : 0.3;
  float edge = pow(1.0 - ndv, 5.0);
  vec3 col = uRim * (edge * 0.3 + env(R) * 0.6) * side * uVis * uRimGain;
  // Light from the spark below catches the lower glass.
  col += uSparkCol * uSpark * fres * 0.6 * exp(-max(vP.y, 0.0) * 1.2) * side;
  if (uLit > 0.0) {
    // Lit glass: the surface glows (brighter toward the rim) ...
    float dF = segDist(vP, FA, FB);
    col += uGlow * uLit * uLitGain * (0.01 + edge * 0.25 + fres * 0.25) * (0.4 + 0.9 * exp(-dF * dF / 1.0)) * side;
    // ... and the volume behind it fills with light (front faces only, envelope only).
    if (front && uIsEnvelope > 0.5) {
      vec3 dir = -V;
      float sum = 0.0;
      const int STEPS = 22;
      float stp = 2.3 / float(STEPS);
      for (int i = 0; i < STEPS; i++) {
        vec3 q = vP + dir * (float(i) + 0.5) * stp;
        float m = inside(q);
        float d = segDist(q, FA, FB);
        sum += m * (0.22 * exp(-d * d / 0.01) + 0.3 * exp(-d * d / 0.12) + 0.12 * exp(-d * d / 0.5) + 0.02);
      }
      col += uGlow * uLit * uFill * uLitGain * sum * stp;
    }
  }
  o = vec4(col, 1.0);
}
`;

// Opaque metal / dark glass with env reflections, filament and spark lighting.
const METAL_FRAG = /* glsl */ `
precision highp float;
${LIGHT_GLSL}
uniform vec3 uBase; uniform float uSpec, uRough;
in vec3 vP; in vec3 vN; out vec4 o;
void main() {
  vec3 V = normalize(cameraPosition - vP);
  vec3 N = normalize(vN);
  if (dot(N, V) < 0.0) N = -N;
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  vec3 R = reflect(-V, N);
  float e = env(R) * uSpec * 1.3 + 0.06 + 0.12 * smoothstep(-0.2, 0.6, N.y);
  float rim = pow(1.0 - ndv, 4.0) * 0.35;
  vec3 col = uBase * (e + rim) * (0.25 + 0.75 * uVis);
  // Filament light from above (through the glass).
  vec3 Lf = filamentPoint(vP) - vP; float df = length(Lf);
  float dif = max(dot(N, Lf / df), 0.0);
  float spf = pow(max(dot(R, Lf / df), 0.0), 12.0);
  // Bare metal: mostly a specular reflection of the filament, little diffuse.
  col += uGlow * uLit * (uBase * dif * 0.35 + spf * uSpec * 1.6) / (0.25 + df * df * 0.8);
  // Spark light from below.
  vec3 Ls = uSparkPos - vP; float ds = length(Ls);
  float difs = max(dot(N, Ls / ds), 0.0) * 0.7 + 0.3;
  float sps = pow(max(dot(R, Ls / ds), 0.0), 8.0);
  col += uSparkCol * uSpark * (uBase * difs * 0.9 + sps * uSpec) * 1.2 / (0.03 + ds * ds * 3.0);
  o = vec4(col, 1.0);
}
`;

// Filament and wires: emissive when lit, dull metal when not.
const FIL_FRAG = /* glsl */ `
precision highp float;
${LIGHT_GLSL}
uniform float uHeat; // 1 = filament, <1 = wires (warm only near the top)
in vec3 vP; in vec3 vN; out vec4 o;
void main() {
  vec3 V = normalize(cameraPosition - vP);
  vec3 N = normalize(vN);
  if (dot(N, V) < 0.0) N = -N;
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  vec3 R = reflect(-V, N);
  vec3 col = vec3(0.75, 0.8, 0.88) * (env(R) * 0.9 + pow(1.0 - ndv, 3.0) * 0.5 + 0.12) * uVis;
  float heat = uHeat >= 0.99 ? 1.0 : uHeat * smoothstep(1.0, 1.45, vP.y);
  col += uFilCol * uLit * heat * 24.0;
  // Wires are lit by the filament.
  float df = segDist(vP, FA, FB);
  col += uGlow * uLit * (1.0 - step(0.99, uHeat)) * 1.2 / (0.12 + df * df * 4.0);
  o = vec4(col, 1.0);
}
`;

// ---------------------------------------------------------------------------

/** Soft cloud sprite (seeded value-noise fbm with a round falloff). */
const cloudDraw = (seed: number) => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const r = mulberry32(seed);
  const G = 16;
  const grid = Array.from({ length: (G + 1) * (G + 1) }, () => r());
  const vn = (x: number, y: number) => {
    const xi = Math.floor(x) % G,
      yi = Math.floor(y) % G;
    const xf = x - Math.floor(x),
      yf = y - Math.floor(y);
    const s = (t: number) => t * t * (3 - 2 * t);
    const g = (i: number, j: number) => grid[((j % G) * (G + 1) + (i % G)) % grid.length];
    const a = g(xi, yi),
      b = g(xi + 1, yi),
      c = g(xi, yi + 1),
      d = g(xi + 1, yi + 1);
    return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
  };
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const u = x / w,
        v = y / h;
      let f = 0,
        amp = 0.5,
        fr = 3;
      for (let o = 0; o < 5; o++) {
        f += amp * vn(u * fr + o * 3.1, v * fr + o * 1.7);
        amp *= 0.5;
        fr *= 2;
      }
      const dx = u - 0.5,
        dy = v - 0.5;
      const fall = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2);
      const a = Math.max(0, Math.min(1, (f - 0.25) * 1.6)) * fall * fall * (3 - 2 * fall);
      const k = (y * w + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 255;
      img.data[k + 3] = Math.round(a * 255);
    }
  ctx.putImageData(img, 0, 0);
};

const DUST_N = 1500;
const DUST = (() => {
  const r = mulberry32(0xd057);
  return Array.from({ length: DUST_N }, () => ({
    x: range(r, -6, 16),
    y: range(r, -8, 10),
    z: range(r, -14, 8),
    rho: range(r, 0.1, 0.5),
    ph: r() * TAU,
    n: r() < 0.5 ? 1 : -1,
    size: range(r, 0.8, 1.5),
    inten: r() < 0.03 ? range(r, 0.12, 0.25) : range(r, 0.015, 0.06),
  }));
})();

const HAZE = [
  { x: 0.2, y: 2.2, z: -4.5, s: 5, a: 0.22, ph: 0.3 },
  { x: 3.6, y: 3.2, z: -6, s: 6, a: 0.22, ph: 1.7 },
  { x: -2.5, y: 1.2, z: -5.5, s: 5, a: 0.12, ph: 3.1 },
  { x: 5.0, y: 0.2, z: -6, s: 4.5, a: 0.28, ph: 4.4 },
];

// ---------------------------------------------------------------------------

type Timeline = {
  vis: number; // unlit bulb visibility
  lit: number; // filament / glow
  spark: number; // base spark + flare
  ember: number; // 0..1 progress of the spark climbing, <0 = hidden
  reveal: number; // plexus draw-on radius
  bg: number; // background level
  bloomBoost: number;
  plexus: number; // global plexus/haze/dust level
};

const flick = (t: number) => 1 + 0.035 * Math.sin(TAU * 7 * t + 0.4) + 0.02 * Math.sin(TAU * 13 * t + 1.1) + 0.012 * Math.sin(TAU * 31 * t + 2.3);

const storyTimeline = (f: number): Timeline => {
  const t = f / LOOP;
  const fl = flick(t);
  const vis = ease(f / 40);
  const sparkOn = ease((f - 45) / 8);
  const sparkFlash = Math.exp(-((f - 52) ** 2) / 40) * 0.9;
  const litRamp = ease((f - 88) / 18);
  const litFlash = Math.exp(-((f - 104) ** 2) / 70) * 0.55;
  return {
    vis,
    lit: (litRamp + litFlash) * (f > 100 ? fl : 1),
    spark: sparkOn * (0.85 + sparkFlash + 0.2 * ease((f - 95) / 20)) * (f > 100 ? 0.92 + 0.08 * fl : 1),
    ember: f >= 58 && f <= 96 ? (f - 58) / 38 : -1,
    reveal: f < 95 ? 0 : ease((f - 95) / 60) * 10,
    bg: 0.28 + 0.12 * sparkOn + 0.6 * ease((f - 90) / 35),
    bloomBoost: 1 + 1.3 * Math.exp(-((f - 104) ** 2) / 140),
    plexus: ease((f - 92) / 40),
  };
};

const loopTimeline = (f: number): Timeline => {
  const t = (f % LOOP) / LOOP;
  const fl = flick(t);
  return { vis: 1, lit: fl, spark: 0.95 + 0.08 * fl, ember: -1, reveal: Infinity, bg: 1, bloomBoost: 1, plexus: 1 };
};

const emberPos = (p: number) => {
  // Up through the base (hidden by the metal), the stem, then the support wire to the filament.
  const pts = [new Vector3(0, -1.05, 0.02), new Vector3(0, -0.2, 0.02), new Vector3(0, 0.6, 0.02), new Vector3(0, 0.95, 0.02), new Vector3(0, 1.45, 0.02), new Vector3(0, 1.55, 0.01)];
  const x = Math.min(0.9999, Math.max(0, p)) * (pts.length - 1);
  const i = Math.floor(x);
  return pts[i].clone().lerp(pts[i + 1], x - i);
};

export const createBulb =
  (pal: BulbPalette, mode: "story" | "loop", check: BulbModelCheck): LookFactory =>
  (gl) => {
    const isCheck = check !== "off";
    const scene = new Scene();
    const camera = new PerspectiveCamera(28, 16 / 9, 0.1, 200);
    const glow = lin(pal.envelope);
    const filC = lin(pal.filament);
    const sparkC = lin(pal.spark);
    const metalC = lin(pal.metal);
    const common = {
      uLit: { value: 0 },
      uVis: { value: 1 },
      uSpark: { value: 0 },
      uGlow: { value: glow },
      uFilCol: { value: filC },
      uSparkCol: { value: sparkC },
      uSparkPos: { value: BASE_TIP.clone().add(new Vector3(0, -0.12, 0.25)) },
    };
    const solid = (frag: string, extra: Record<string, { value: unknown }>, glass = false) =>
      new RawShaderMaterial({
        glslVersion: GLSL3,
        vertexShader: SOLID_VERT,
        fragmentShader: frag,
        uniforms: { ...common, ...extra },
        side: DoubleSide,
        ...(glass ? { ...ADDITIVE, transparent: true, depthWrite: false, depthTest: true } : { depthWrite: true, depthTest: true }),
      });

    const bulb = new Group();
    const add = (g: BufferGeometry, m: RawShaderMaterial, order = 0) => {
      const mesh = new Mesh(g, m);
      mesh.renderOrder = order;
      bulb.add(mesh);
      return mesh;
    };
    add(buildScrew(), solid(METAL_FRAG, { uBase: { value: metalC }, uSpec: { value: 1.0 }, uRough: { value: 0.3 } }));
    add(buildCap(), solid(METAL_FRAG, { uBase: { value: metalC.map((x) => x * 0.8) as RGB }, uSpec: { value: 0.8 }, uRough: { value: 0.3 } }));
    add(buildInsulator(), solid(METAL_FRAG, { uBase: { value: [0.025, 0.028, 0.035] as RGB }, uSpec: { value: 1.4 }, uRough: { value: 0.1 } }));
    add(buildContact(), solid(METAL_FRAG, { uBase: { value: metalC.map((x) => x * 0.9) as RGB }, uSpec: { value: 1.0 }, uRough: { value: 0.3 } }));
    add(buildFilament(), solid(FIL_FRAG, { uHeat: { value: 1 } }));
    const wireMat = solid(FIL_FRAG, { uHeat: { value: 0.25 } });
    buildWires().forEach((g) => add(g, wireMat));
    add(buildStem(), solid(GLASS_FRAG, { uRim: { value: glow }, uFill: { value: 0 }, uIsEnvelope: { value: 0 }, uRimGain: { value: 1.0 }, uLitGain: { value: isCheck ? 1 : 1.3 } }, true), 20);
    const envMat = solid(GLASS_FRAG, { uRim: { value: glow }, uFill: { value: 1 }, uIsEnvelope: { value: 1 }, uRimGain: { value: isCheck ? 1 : 0.7 }, uLitGain: { value: isCheck ? 1 : 1.0 } }, true);
    add(buildEnvelope(), envMat, 21);
    scene.add(bulb);
    const allMats: RawShaderMaterial[] = [];
    bulb.traverse((o) => {
      const m = (o as Mesh).material as RawShaderMaterial | undefined;
      if (m && !allMats.includes(m)) allMats.push(m);
    });
    const setCommon = (k: keyof typeof common, v: unknown) => allMats.forEach((m) => (m.uniforms[k].value = v));

    // Plexus.
    const plexOut: PlexusOut = { positions: new Float32Array(PLEXUS_N * 3), si: new Float32Array(PLEXUS_N * 2), segs: new Float32Array(MAX_LINKS * 8), segCount: 0 };
    const plexC = lin(pal.plexus);
    const links = new LineBatch(new Float32Array(0), { color: plexC, width: 1.0, opacity: 1.5, maxSegments: MAX_LINKS });
    links.mat.depthTest = true;
    const nodes = new PointBatch(plexOut.positions, plexOut.si, { color: plexC, size: 1.5, opacity: 1.6, core: 0.0, dof: [13, 0.0008, 0.003] }, true);
    nodes.mat.depthTest = true;

    // Dust with per-speck depth of field.
    const dustPos = new Float32Array(DUST_N * 3);
    const dustSi = new Float32Array(DUST_N * 2);
    const dust = new PointBatch(dustPos, dustSi, { color: plexC, size: 1.3, opacity: 1, dof: [13, 0.0006, 0.002] }, true);
    dust.mat.depthTest = true;

    // Haze clouds behind.
    const hazeTex = canvasTexture(256, 256, cloudDraw(0xc10d));
    const haze = new SpriteBatch(HAZE.length, hazeTex, lin(pal.haze), { opacity: 1 });
    if (!isCheck) scene.add(links.mesh, nodes.points, dust.points, haze.mesh);

    // Ember (the spark climbing into the filament): a short trail of points.
    const EMB = 10;
    const embPos = new Float32Array(EMB * 3);
    const embSi = new Float32Array(EMB * 2);
    const ember = new PointBatch(embPos, embSi, { color: sparkC, size: 7, opacity: 1, core: 1 }, true);
    ember.mat.depthTest = true;
    if (!isCheck) scene.add(ember.points);

    const bgLin = (h: string) => hexToSrgb(h);
    const pipeline = new Pipeline(gl, {
      msaa: 4,
      dof: false,
      bloomStrength: 0.6,
      bloomLevelWeights: [0.7, 0.9, 1, 1, 1, 0.9],
      exposure: 1.0,
      vignette: isCheck ? 0 : 0.5,
      grain: 0.015,
      composite: {
        background: /* glsl */ `
uniform vec3 uBgDark, uBgLight; uniform vec2 uGlowPos; uniform float uBgLevel, uGrey;
vec3 background(vec2 uv) {
  if (uGrey > 0.5) return vec3(0.5);
  vec2 d = (uv - uGlowPos) * vec2(uAspect, 1.0);
  float g = exp(-dot(d, d) / 0.35);
  float broad = smoothstep(-0.3, 1.1, uv.x * 0.6 + uv.y * 0.3);
  vec3 c = mix(uBgDark, uBgLight, clamp(0.08 + g * 0.7 + broad * 0.3, 0.0, 1.0));
  return c * uBgLevel;
}`,
        extraUniforms: {
          uBgDark: { value: bgLin(pal.bgDark) },
          uBgLight: { value: bgLin(pal.bgLight) },
          uGlowPos: { value: [0.66, 0.55] },
          uBgLevel: { value: 1 },
          uGrey: { value: isCheck ? 1 : 0 },
        },
      },
    });

    const size = new Vector2();
    const tmp = new Vector3();
    const resTargets = [links, nodes, dust, ember];

    const render = (frame: number) => {
      gl.getDrawingBufferSize(size);
      resTargets.forEach((b) => b.setRes(size.x, size.y));
      const tl = isCheck
        ? { vis: 1, lit: check === "lit" ? 1 : 0, spark: 0, ember: -1, reveal: Infinity, bg: 1, bloomBoost: 1, plexus: 1 }
        : mode === "story"
          ? storyTimeline(frame)
          : loopTimeline(frame);
      const t = mode === "loop" ? (((frame % LOOP) + LOOP) % LOOP) / LOOP : frame / LOOP;

      // Camera.
      const target = new Vector3(0, 0.78, 0);
      let dist: number, yaw: number, pitch: number;
      if (isCheck) {
        dist = 9.5;
        yaw = 0.25;
        pitch = 0.12;
      } else if (mode === "story") {
        const k = ease(frame / 450) * 0.6 + (frame / 450) * 0.4;
        dist = 13.6 - 1.4 * k;
        yaw = -0.1 + 0.16 * k;
        pitch = 0.07;
      } else {
        dist = 13.0 + 0.45 * Math.cos(TAU * t);
        yaw = 0.09 * Math.sin(TAU * t);
        pitch = 0.07 + 0.015 * Math.sin(TAU * t + 1);
      }
      camera.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
      camera.lookAt(target);
      camera.aspect = size.x / size.y;
      // Lens shift puts the bulb right of centre (about 2/3 across), as in the reference.
      if (isCheck) camera.clearViewOffset();
      else camera.setViewOffset(1920, 1080, -0.165 * 1920, 0, 1920, 1080);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      // Bulb state.
      setCommon("uLit", tl.lit);
      setCommon("uVis", tl.vis);
      setCommon("uSpark", tl.spark);

      // Plexus.
      if (!isCheck) {
        plexusFrame(t, tl.reveal, plexOut);
        links.setSegments(plexOut.segs, plexOut.segCount);
        links.u.uOpacity.value = 1.5 * tl.plexus;
        nodes.u.uOpacity.value = 1.6 * tl.plexus;
        nodes.update();

        for (let i = 0; i < DUST_N; i++) {
          const d = DUST[i];
          const a = d.ph + TAU * d.n * t;
          dustPos[i * 3] = d.x + Math.cos(a) * d.rho;
          dustPos[i * 3 + 1] = d.y + Math.sin(a) * d.rho * 0.7;
          dustPos[i * 3 + 2] = d.z + Math.sin(a + 1) * d.rho * 0.5;
          dustSi[i * 2] = d.size;
          dustSi[i * 2 + 1] = d.inten * (0.25 + 0.75 * tl.plexus);
        }
        dust.update();

        HAZE.forEach((h, i) => {
          const a = TAU * t + h.ph;
          haze.pos.set([h.x + 0.5 * Math.cos(a), h.y + 0.35 * Math.sin(a), h.z], i * 3);
          haze.size.set([h.s * 1.3, h.s], i * 2);
          haze.rot[i] = 0.15 * Math.sin(a + 0.5);
          haze.inten[i] = h.a * (0.15 + 0.85 * tl.plexus);
        });
        haze.commit();

        // Ember trail.
        for (let k = 0; k < EMB; k++) {
          const p = tl.ember - k * 0.012;
          const on = tl.ember >= 0 && p >= 0 ? 1 : 0;
          emberPos(Math.max(0, p)).toArray(embPos, k * 3);
          embSi[k * 2] = 1 - k / EMB;
          embSi[k * 2 + 1] = on * (1.6 - k * 0.14) * Math.sin(Math.PI * Math.min(1, Math.max(0, tl.ember)) * 0.98 + 0.02);
        }
        ember.update();
      }

      // Spark flare at the bottom of the base and the background glow behind the bulb.
      tmp.copy(BASE_TIP).project(camera);
      const sparkUv: [number, number] = [tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5];
      tmp.set(0, 1.3, -1).project(camera);
      pipeline.uniforms.uGlowPos.value = [tmp.x * 0.5 + 0.5, tmp.y * 0.5 + 0.5];
      pipeline.uniforms.uBgLevel.value = tl.bg;
      pipeline.uniforms.uBloomStrength.value = 0.6 * tl.bloomBoost * (0.3 + 0.7 * Math.min(1, tl.lit + tl.spark * 0.5));

      pipeline.render({
        scene,
        camera,
        frame,
        grainPeriod: mode === "story" ? 450 : LOOP,
        flare: isCheck ? undefined : { pos: sparkUv, intensity: tl.spark, color: sparkC, streak: 1 },
      });
    };

    return {
      render,
      dispose: () => {
        pipeline.dispose();
        [links, nodes, dust, ember].forEach((b) => b.dispose());
        haze.dispose();
        hazeTex.dispose();
        allMats.forEach((m) => m.dispose());
      },
    };
  };

import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineSegments,
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
} from "three";
import type { BrainAssets } from "../engine/assets";
import { makeDrift } from "../engine/drift";
import { fibreLines, memo } from "../engine/geometry";
import { easeInOutSine, lin, smoothstep, srgb } from "../engine/math";
import { Post, pxScale } from "../engine/post";
import { ADDITIVE, buildSegments, FATLINE_FRAG_GLSL, FATLINE_GLSL, POINT_GLSL } from "../engine/primitives";
import { mulberry32 } from "../engine/random";
import type { LookFactory } from "../engine/Stage";

// Look 7 · Brain Particles Assemble (20 s). A small bright burst of cyan and
// violet particles swirls, grows and flows onto the brain's surface along
// curved paths while fibres draw along the folds; the finished plexus brain
// glows and turns ~90deg with pulses of light travelling through it.

export const ASSEMBLE_COLORS = {
  // One data row: cyan, violet, inner clusters, background, centre haze
  cyan: "#3AE0FF",
  violet: "#9A6AFF",
  cluster: "#8EF4FF",
  bg: "#03070A",
  haze: "#0F3346",
};

const F = (s: number) => s * 30;
const N_CORTEX = 110_000;
const N_INNER = 40_000;
const N_STREAKS = 70;

// brain yaw: front view while assembling, turning to a three-quarter side view,
// then ~90deg more from 11 s.
const yawAt = (f: number) => {
  const a = -Math.PI / 2 + 0.25;
  const b = -0.55;
  const c = b + Math.PI / 2;
  return a + (b - a) * easeInOutSine(smoothstep(F(4.5), F(10.5), f)) + (c - b) * easeInOutSine(smoothstep(F(11), F(20), f));
};

const particleGeometry = (a: BrainAssets) =>
  memo(a, "assemble-particles", () => {
    const P = a.points;
    const n = N_CORTEX + N_INNER;
    const rng = mulberry32(7007);
    const target = new Float32Array(n * 3);
    const swirl = new Float32Array(n * 4); // radius, angle, height, angular speed
    const time = new Float32Array(n * 4); // depart, duration, colour mix, inner flag
    const take = (src: number, k: number, inner: boolean) => {
      target.set(P.position.subarray(src * 3, src * 3 + 3), k * 3);
      const u = rng();
      const r = Math.pow(u, 0.55);
      swirl[k * 4] = r;
      swirl[k * 4 + 1] = rng() * Math.PI * 2;
      swirl[k * 4 + 2] = (rng() * 2 - 1) * (0.25 + 0.45 * (1 - r));
      swirl[k * 4 + 3] = (0.6 + 0.8 * rng()) / (0.25 + r);
      // lower and outer particles leave first; inner structures last
      const ty = P.position[src * 3 + 1];
      const dep = F(4) + (0.15 + 0.55 * rng() + 0.25 * (ty + 0.8) / 1.6) * F(4.2) + (inner ? F(0.8) : 0);
      time[k * 4] = dep;
      time[k * 4 + 1] = F(1.4) + rng() * F(1.2);
      time[k * 4 + 2] = rng() < 0.36 ? 1 : rng() * 0.2;
      time[k * 4 + 3] = inner ? 1 : 0;
    };
    for (let i = 0; i < N_CORTEX; i++) take(i, i, false);
    for (let i = 0; i < N_INNER; i++) take(P.cortex + i, N_CORTEX + i, true);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(target, 3));
    g.setAttribute("aSwirl", new BufferAttribute(swirl, 4));
    g.setAttribute("aTime", new BufferAttribute(time, 4));
    return g;
  });

const streakGeometry = (a: BrainAssets) =>
  memo(a, "assemble-streaks", () => {
    const rng = mulberry32(7008);
    const per = 2;
    const pts = new Float32Array(N_STREAKS * per * 3);
    for (let i = 0; i < N_STREAKS; i++) {
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      const d = new Vector3(Math.sin(ph) * Math.cos(th), Math.cos(ph) * 0.8, Math.sin(ph) * Math.sin(th));
      const c = new Vector3((rng() - 0.5) * 0.12, (rng() - 0.5) * 0.12, (rng() - 0.5) * 0.12);
      const L = 0.15 + 0.5 * Math.pow(rng(), 2);
      const p0 = c.clone().addScaledVector(d, -L * 0.5 * rng());
      const p1 = c.clone().addScaledVector(d, L);
      pts.set([p0.x, p0.y, p0.z, p1.x, p1.y, p1.z], i * per * 3);
    }
    void a;
    return buildSegments(pts, per, Array.from({ length: N_STREAKS }, (_, i) => i), () => [rng(), rng(), rng(), 0]);
  });

// Plexus: surface nodes joined to their nearest neighbours (spatial hash).
const plexusGeometry = (a: BrainAssets) =>
  memo(a, "assemble-plexus", () => {
    const N = 7000;
    const R = 0.085;
    const P = a.points.position;
    const cell = (x: number) => Math.floor((x + 1.2) / R);
    const grid = new Map<number, number[]>();
    const key = (i: number, j: number, k: number) => (i * 64 + j) * 64 + k;
    for (let n = 0; n < N; n++) {
      const kk = key(cell(P[n * 3]), cell(P[n * 3 + 1]), cell(P[n * 3 + 2]));
      const l = grid.get(kk);
      if (l) l.push(n);
      else grid.set(kk, [n]);
    }
    const seg: number[] = [];
    const rnd: number[] = [];
    const rng = mulberry32(7012);
    for (let n = 0; n < N; n++) {
      const cx = cell(P[n * 3]);
      const cy = cell(P[n * 3 + 1]);
      const cz = cell(P[n * 3 + 2]);
      const near: { m: number; d: number }[] = [];
      for (let i = -1; i <= 1; i++)
        for (let j = -1; j <= 1; j++)
          for (let k = -1; k <= 1; k++) {
            for (const m of grid.get(key(cx + i, cy + j, cz + k)) ?? []) {
              if (m <= n) continue;
              const dx = P[m * 3] - P[n * 3];
              const dy = P[m * 3 + 1] - P[n * 3 + 1];
              const dz = P[m * 3 + 2] - P[n * 3 + 2];
              const d = dx * dx + dy * dy + dz * dz;
              if (d < R * R) near.push({ m, d });
            }
          }
      near.sort((x, y) => x.d - y.d);
      for (const { m } of near.slice(0, 2)) {
        seg.push(P[n * 3], P[n * 3 + 1], P[n * 3 + 2], P[m * 3], P[m * 3 + 1], P[m * 3 + 2]);
        const r = rng();
        rnd.push(r, r);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(seg), 3));
    g.setAttribute("aR", new BufferAttribute(new Float32Array(rnd), 1));
    return g;
  });

const PLEX_VERT = /* glsl */ `
in float aR;
uniform float uFrame;
uniform float uPx;
out float vI;
out float vMix;
void main() {
  float on = smoothstep(${F(7.5).toFixed(1)} + aR * 60.0, ${F(9).toFixed(1)} + aR * 60.0, uFrame);
  vI = on * (0.35 + 0.65 * aR) * uPx * 3.0;
  vMix = step(0.78, aR);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const PLEX_FRAG = /* glsl */ `
uniform vec3 uCyan;
uniform vec3 uViolet;
in float vI;
in float vMix;
out vec4 outColor;
void main() {
  outColor = vec4(mix(uCyan, uViolet, vMix) * vI * 0.38, 0.0);
}`;

const BG = /* glsl */ `
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(q);
  return uBg + uHaze * exp(-r * r * 4.5) * 0.9;
`;

const PART_VERT = /* glsl */ `
${POINT_GLSL}
in vec4 aSwirl;
in vec4 aTime;
uniform float uFrame;
uniform float uSwirlR;
out float vI;
out float vMix;
out float vInner;
vec3 swirlPos(float f) {
  float ang = aSwirl.y + aSwirl.w * f * 0.035;
  // irregular nebula: tendrils from an angular / height modulation of the radius
  float tend = 1.0 + 0.55 * sin(3.0 * ang + aSwirl.z * 6.0) * sin(2.0 * aSwirl.y + 1.3);
  float r = aSwirl.x * uSwirlR * tend;
  float h = aSwirl.z * uSwirlR * 2.2 + sin(ang * 2.0 + aSwirl.x * 9.0) * 0.06 * uSwirlR;
  return vec3(cos(ang) * r, h, sin(ang) * r);
}
void main() {
  float dep = aTime.x;
  float dur = aTime.y;
  float s = clamp((uFrame - dep) / dur, 0.0, 1.0);
  float e = s * s * (3.0 - 2.0 * s);
  vec3 S = swirlPos(min(uFrame, dep));
  vec3 T = position;
  // curved path: control point swung around the vertical axis and pushed out
  vec3 mid = (S + T) * 0.5;
  float sw = 0.9;
  vec3 C = vec3(mid.x * cos(sw) - mid.z * sin(sw), mid.y + 0.15, mid.x * sin(sw) + mid.z * cos(sw)) * 1.35;
  vec3 p = mix(mix(S, C, e), mix(C, T, e), e);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float arrived = step(1.0, s);
  float flight = s > 0.0 && s < 1.0 ? 1.0 : 0.0;
  float flash = arrived * exp(-max(uFrame - dep - dur, 0.0) / 10.0);
  float size = mix(0.0065, 0.0085, arrived) * (0.6 + 1.1 * pow(fract(aSwirl.y * 13.7), 2.0));
  gl_PointSize = pointSize(size, mv.z, 2.0);
  float burstIn = smoothstep(0.0, 10.0, uFrame);
  // while swirling only a sparse subset shows; everything lights up in flight
  float lead = step(fract(aSwirl.y * 7.31 + aSwirl.x * 3.7), 0.12);
  float swirlVis = mix(0.03 + 1.4 * lead, 1.0, step(0.0001, s));
  vI = vPtAlpha * burstIn * swirlVis * (0.5 + 0.1 * flight + 0.8 * flash) * (aTime.w > 0.5 ? 0.16 : 1.0) * (1.0 - 0.45 * flight);
  vMix = aTime.z;
  vInner = aTime.w;
  gl_Position = projectionMatrix * mv;
}`;

const PART_FRAG = /* glsl */ `
uniform vec3 uCyan;
uniform vec3 uViolet;
uniform vec3 uCluster;
uniform float uGain;
in float vI;
in float vMix;
in float vInner;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float a = exp(-r2 * 3.0);
  vec3 c = mix(mix(uCyan, uViolet, vMix), uCluster, vInner);
  outColor = vec4(c * vI * a * uGain, 0.0);
}`;

const FIB_VERT = /* glsl */ `
in float aT;
in vec4 aCurve;
uniform float uFrame;
uniform float uPx;
uniform float uPulse;
out float vI;
out float vMix;
void main() {
  // draw-on along the folds, 5.5-9.5 s
  float start = ${F(5.5).toFixed(1)} + aCurve.y * ${F(3.2).toFixed(1)};
  float reveal = clamp((uFrame - start) / (35.0 + 30.0 * aCurve.z), 0.0, 1.0);
  float on = step(aT, reveal);
  float head = exp(-max(reveal - aT, 0.0) * 14.0) * (1.0 - step(1.0, reveal) * 0.0);
  // travelling pulses after 11 s
  float ph = fract((uFrame - ${F(11).toFixed(1)}) / 80.0 + aCurve.y * 3.0);
  float pulse = uPulse * exp(-pow((aT - ph) * 7.0, 2.0)) * step(0.6, aCurve.z);
  float w = mix(0.8, 2.0, aCurve.y) * uPx;
  vI = on * w * (0.30 + 0.9 * head * (1.0 - step(1.0, reveal)) + 1.6 * pulse) * (aCurve.x > 0.5 ? 0.6 : 1.0);
  vMix = step(0.72, aCurve.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FIB_FRAG = /* glsl */ `
uniform vec3 uCyan;
uniform vec3 uViolet;
in float vI;
in float vMix;
out vec4 outColor;
void main() {
  outColor = vec4(mix(uCyan, uViolet, vMix) * vI * 0.12, 0.0);
}`;

const STREAK_VERT = /* glsl */ `
${FATLINE_GLSL}
in vec3 aA;
in vec3 aB;
in vec4 aSeg;
in vec4 aCurve;
uniform float uFrame;
out float vI;
out float vMix;
void main() {
  float grow = smoothstep(0.0, 25.0 + aCurve.x * 30.0, uFrame);
  float fade = 1.0 - smoothstep(${F(3).toFixed(1)}, ${F(5).toFixed(1)}, uFrame);
  vec3 b = mix(aA, aB, grow);
  vI = fade * (0.5 + 0.8 * aCurve.y);
  vMix = step(0.75, aCurve.z);
  gl_Position = fade > 0.0 ? fatLine(aA, b, 2.2 + 2.5 * aCurve.y, position.x, position.y) : vec4(2.0, 2.0, 2.0, 1.0);
}`;

const STREAK_FRAG = /* glsl */ `
${FATLINE_FRAG_GLSL}
uniform vec3 uCyan;
uniform vec3 uViolet;
in float vI;
in float vMix;
out vec4 outColor;
void main() {
  outColor = vec4(mix(uCyan, uViolet, vMix) * vI * lineCoverage() * lineProfile() * 1.4, 0.0);
}`;

// glowing cyan and violet patches: inner clusters plus spots on the cortex
const clusterPoints = (a: BrainAssets) =>
  memo(a, "assemble-clusters", () => {
    const rng = mulberry32(7011);
    const pts: number[] = [-0.05, 0.1, 0.1, -0.05, 0.1, -0.1, 0.0, -0.17, 0.3, 0.0, -0.17, -0.3, 0.25, 0.3, 0.0];
    for (let k = 0; k < 16; k++) {
      const i = Math.floor(rng() * a.points.cortex);
      for (let d = 0; d < 3; d++) pts.push(a.points.position[i * 3 + d] * 0.8);
    }
    return new Float32Array(pts);
  });

const CL_VERT = /* glsl */ `
${POINT_GLSL}
in vec4 aR;
uniform float uFrame;
out float vI;
out float vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = step(0.55, aR.z);
  gl_PointSize = pointSize(0.2 + 0.2 * aR.x, mv.z, 8.0);
  float on = smoothstep(${F(8.5).toFixed(1)}, ${F(10.5).toFixed(1)}, uFrame);
  float pulse = 0.65 + 0.35 * sin(uFrame * 0.06 + aR.y * 6.28);
  vI = on * pulse;
  gl_Position = projectionMatrix * mv;
}`;
const CL_FRAG = /* glsl */ `
uniform vec3 uCluster;
uniform vec3 uViolet;
in float vI;
in float vV;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  outColor = vec4(mix(uCluster, uViolet, vV) * vI * exp(-r2 * 4.0) * 0.16, 0.0);
}`;

export const assembleLook: LookFactory = ({ gl, assets, width, height }) => {
  const post = new Post(
    gl,
    {
      msaa: 0,
      bloom: { strength: 0.22, threshold: 0.7, knee: 0.3, levels: 5, radius: 0.7 },
      background: BG,
      uniforms: { uBg: { value: srgb(ASSEMBLE_COLORS.bg) }, uHaze: { value: srgb(ASSEMBLE_COLORS.haze) } },
      key: null,
      exposure: 1,
    },
    assets.blueNoise,
  );
  const scene = new Scene();
  const fov = 30;
  const viewH = 2.3;
  const dist = viewH / 2 / Math.tan((fov / 2) * (Math.PI / 180));
  const cam = new PerspectiveCamera(fov, width / height, 0.05, 60);
  cam.position.set(0, 0.25, dist);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  const projY = cam.projectionMatrix.elements[5];
  const brain = new Group();
  scene.add(brain);

  const colors = {
    uCyan: { value: new Vector3(...lin(ASSEMBLE_COLORS.cyan)) },
    uViolet: { value: new Vector3(...lin(ASSEMBLE_COLORS.violet)) },
    uCluster: { value: new Vector3(...lin(ASSEMBLE_COLORS.cluster)) },
  };
  const common = {
    uRes: { value: post.size },
    uPx: { value: pxScale(post) },
    uNear: { value: 0.05 },
    uCap: { value: 1 },
    uProjY: { value: projY },
    uFrame: { value: 0 },
    uSwirlR: { value: 0.1 },
    uPulse: { value: 0 },
    uGain: { value: 0.34 },
  };
  const mk = (v: string, f: string) =>
    new ShaderMaterial({
      glslVersion: "300 es" as never,
      vertexShader: v,
      fragmentShader: f,
      uniforms: { ...common, ...colors },
      ...ADDITIVE,
      depthTest: false,
    });
  const partMat = mk(PART_VERT, PART_FRAG);
  const parts = new Points(particleGeometry(assets), partMat);
  parts.frustumCulled = false;
  brain.add(parts);
  const fibMat = mk(FIB_VERT, FIB_FRAG);
  const fibs = new LineSegments(fibreLines(assets, "assemble", (i) => i % 2 === 0), fibMat);
  fibs.frustumCulled = false;
  brain.add(fibs);
  const plexMat = mk(PLEX_VERT, PLEX_FRAG);
  const plex = new LineSegments(plexusGeometry(assets), plexMat);
  plex.frustumCulled = false;
  brain.add(plex);
  const clPos = clusterPoints(assets);
  const clGeo = new BufferGeometry();
  clGeo.setAttribute("position", new BufferAttribute(clPos, 3));
  const rr = mulberry32(7009);
  clGeo.setAttribute("aR", new BufferAttribute(Float32Array.from({ length: (clPos.length / 3) * 4 }, () => rr()), 4));
  const clMat = mk(CL_VERT, CL_FRAG);
  const cl = new Points(clGeo, clMat);
  cl.frustumCulled = false;
  brain.add(cl);
  const streakMat = mk(STREAK_VERT, STREAK_FRAG);
  const streaks = new Mesh(streakGeometry(assets), streakMat);
  streaks.frustumCulled = false;
  scene.add(streaks);

  const bokeh = makeDrift(
    {
      seed: 7010,
      count: 60,
      min: [-1.6, -1.0, 0.8],
      max: [1.6, 1.0, 3.6],
      laps: [0, 0, 0],
      period: 600,
      size: [0.01, 0.025],
      minPx: 4,
      color: lin("#BFF6FF"),
      colorB: lin(ASSEMBLE_COLORS.violet),
      intensity: 0.0,
      twinkle: 0.3,
      wobble: 0.12,
      focus: dist,
      coc: 0.025,
    },
    post,
    projY,
  );
  scene.add(bokeh.points);

  return {
    render(frame) {
      const f = frame;
      common.uFrame.value = f;
      // burst pops open, then the swirl grows (0-6 s)
      common.uSwirlR.value = 0.2 * (1 - Math.exp(-f / 12)) + 0.35 * smoothstep(F(1.5), F(6), f);
      common.uPulse.value = smoothstep(F(10.5), F(12), f);
      brain.rotation.set(0, yawAt(f), 0);
      brain.updateMatrixWorld(true);
      bokeh.set(f);
      bokeh.mat.uniforms.uIntensity.value = 0.35 * (1 - smoothstep(F(5), F(9), f));
      post.begin();
      gl.render(scene, cam);
      post.end(f);
    },
    dispose() {
      post.dispose();
      [partMat, fibMat, clMat, streakMat, plexMat].forEach((m) => m.dispose());
      bokeh.dispose();
      clGeo.dispose();
    },
  };
};

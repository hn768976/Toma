import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LineSegments,
  Matrix4,
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
} from "three";
import type { BrainAssets } from "../engine/assets";
import { fibreLines, fibreSegments, memo } from "../engine/geometry";
import { easeInOut, easeInOutSine, lin, smoothstep, srgb, TAU } from "../engine/math";
import { Post, pxScale } from "../engine/post";
import { ADDITIVE, FATLINE_FRAG_GLSL, FATLINE_GLSL, POINT_GLSL, PREMULT_OVER } from "../engine/primitives";
import { mulberry32 } from "../engine/random";
import { activeAt, hash01, makeSchedule, type Ev } from "../engine/schedule";
import type { LookFactory } from "../engine/Stage";

// Looks 2-3 · Brain Fibre Light. ~6000 translucent blue fibre curves wrapping
// the brain on a light-grey studio gradient, white-violet beads, and jagged
// yellow-white lightning signals crackling along fibre paths.
//   2 · Reveal (10 s): inside the tangle -> pull back through the surface -> turn.
//   3 · Loop (20 s): 360deg turn in 600 frames at a three-quarter elevation.

export const FIBRE_COLORS = {
  // One data row: fibre dark, fibre light, beads, signal, background centre, background corners
  fibreA: "#1E78D8",
  fibreB: "#6EC8FF",
  bead: "#F2ECFF",
  bokeh: "#D9CCF2",
  signal: "#FFF0A0",
  bgCentre: "#E4E6EA",
  bgCorner: "#B8BCC4",
  haze: "#A3B6CA",
};

const PERIOD = 600;
const N_BEADS = 2600;
const MAX_SIG = 14;
const SIG_PTS = 64;
const ELEV = 0.36; // three-quarter elevation (rad)
const FOV = 30;

const BG = /* glsl */ `
  vec2 q = (uv - vec2(0.5, 0.56)) * vec2(aspect, 1.0);
  float r = length(q) / length(vec2(aspect, 1.0) * 0.5);
  vec3 c = mix(uCentre, uCorner, smoothstep(0.0, 1.05, r));
  return mix(c, uHazeCol * (1.0 - 0.12 * r), uHaze);
`;

const LINE_VERT = /* glsl */ `
in float aT;
in vec4 aCurve;
uniform float uPx;
uniform vec3 uCentreView;
uniform float uDepthSpan;
out float vA;
out float vMix;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  // soft depth: the far side shows through, fainter
  float dz = (mv.z - uCentreView.z) / uDepthSpan; // >0 near, <0 far
  float depthFade = mix(0.42, 1.0, smoothstep(-1.0, 0.6, dz));
  float w = mix(0.8, 2.4, aCurve.y * aCurve.y) * uPx; // width carried as coverage
  float inner = aCurve.x > 0.5 ? 0.35 : 1.0;
  float ends = smoothstep(0.0, 0.08, aT) * smoothstep(1.0, 0.92, aT);
  vA = clamp(w, 0.0, 1.6) * 0.6 * depthFade * inner * ends;
  vMix = clamp(0.5 * aCurve.z + 0.8 * smoothstep(-0.8, 0.9, dz) - 0.05, 0.0, 1.0);
  gl_Position = projectionMatrix * mv;
}`;

const LINE_FRAG = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
in float vA;
in float vMix;
out vec4 outColor;
void main() {
  vec3 c = mix(uA * 0.5, uB, vMix * vMix);
  float a = clamp(vA, 0.0, 1.0);
  outColor = vec4(c * a, a);
}`;

// Thick hero fibres (real width, perspective-scaled, with focus blur).
const HERO_VERT = /* glsl */ `
${FATLINE_GLSL}
in vec3 aA;
in vec3 aB;
in vec4 aSeg;
in vec4 aCurve;
uniform vec3 uCentreView;
uniform float uDepthSpan;
uniform float uFocus;
uniform float uCoc;
uniform float uProjY;
uniform float uHero;
out float vA;
out float vMix;
void main() {
  vec4 va = modelViewMatrix * vec4(mix(aA, aB, position.x), 1.0);
  float z = max(-va.z, 0.02);
  float worldW = mix(0.0016, 0.0042, aCurve.y);
  float px = worldW * uProjY * 0.5 * uRes.y / z / uPx; // in 2160p px
  float coc = uCoc * abs(1.0 / z - 1.0 / uFocus) * 2160.0;
  float w = max(px, coc);
  float blur = px / max(w, 1e-4);
  float dz = (va.z - uCentreView.z) / uDepthSpan;
  float depthFade = mix(0.45, 1.0, smoothstep(-1.0, 0.6, dz));
  float ends = smoothstep(0.0, 0.06, aSeg.x) * smoothstep(1.0, 0.94, aSeg.y);
  vA = 0.85 * uHero * depthFade * ends * mix(0.3, 1.0, blur);
  vMix = aCurve.z;
  gl_Position = fatLine(aA, aB, min(w, 160.0), position.x, position.y);
}`;

const HERO_FRAG = /* glsl */ `
${FATLINE_FRAG_GLSL}
uniform vec3 uA;
uniform vec3 uB;
in float vA;
in float vMix;
out vec4 outColor;
void main() {
  float a = clamp(vA * lineCoverage() * (0.55 + 0.45 * lineProfile()), 0.0, 1.0);
  vec3 c = mix(uA, uB, vMix);
  outColor = vec4(c * a, a);
}`;

const BEAD_VERT = /* glsl */ `
${POINT_GLSL}
in vec4 aR;
uniform float uPhase;
uniform float uFocus;
uniform float uCoc;
out float vI;
out float vBokeh;
out float vYel;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vYel = step(aR.w, 0.3);
  float z = max(-mv.z, 0.02);
  float px = pointSize(mix(0.0012, 0.0026, aR.x), mv.z, 7.0);
  float coc = uCoc * abs(1.0 / z - 1.0 / uFocus) * uRes.y;
  float s = max(px, coc);
  vBokeh = smoothstep(1.0, 3.0, s / px);
  gl_PointSize = min(s, 200.0 * uPx + 4.0);
  float tw = 0.7 + 0.3 * sin(6.28318 * (uPhase * (1.0 + floor(aR.y * 3.0)) + aR.z));
  vI = tw * vPtAlpha * mix(1.0, 0.22, vBokeh);
  gl_Position = z > 0.03 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
}`;

const BEAD_FRAG = /* glsl */ `
uniform vec3 uBead;
uniform vec3 uBokeh;
uniform vec3 uSig;
in float vI;
in float vBokeh;
in float vYel;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float sharp = exp(-r2 * 3.0);
  float bokeh = smoothstep(1.0, 0.8, r2) * (0.7 + 0.3 * r2);
  float a = mix(sharp, bokeh, vBokeh);
  vec3 c = mix(mix(uBead, uSig * vec3(1.0, 0.9, 0.5), vYel), uBokeh, vBokeh);
  outColor = vec4(c * vI * a * 3.0, 0.0);
}`;

const SIG_VERT = /* glsl */ `
${FATLINE_GLSL}
in vec3 aA;
in vec3 aB;
in vec2 aS; // intensity, width
uniform float uWidthMul;
out float vI;
void main() {
  vI = aS.x;
  gl_Position = aS.x > 0.0 ? fatLine(aA, aB, aS.y * uWidthMul, position.x, position.y) : vec4(2.0, 2.0, 2.0, 1.0);
}`;

const SIG_FRAG = /* glsl */ `
${FATLINE_FRAG_GLSL}
uniform vec3 uSig;
uniform float uHalo;
in float vI;
out vec4 outColor;
void main() {
  float cov = lineCoverage();
  float core = lineProfile();
  if (uHalo > 0.5) {
    // wide soft additive glow under the trace
    float g = core * core * cov;
    outColor = vec4(uSig * g * min(vI, 1.5) * 0.2, 0.0);
    return;
  }
  float a = clamp(cov * smoothstep(0.0, 0.35, core) * min(vI * 1.3, 1.0), 0.0, 1.0);
  vec3 c = mix(uSig, vec3(1.0), smoothstep(0.75, 1.0, core) * 0.5);
  outColor = vec4(c * a, a);
}`;

// Beads: points sampled along surface fibres.
const beadGeometry = (a: BrainAssets) =>
  memo(a, "fibre-beads", () => {
    const rng = mulberry32(2202);
    const { count, per, position } = a.fibres;
    const pos = new Float32Array(N_BEADS * 3);
    const r = new Float32Array(N_BEADS * 4);
    for (let i = 0; i < N_BEADS; i++) {
      const f = Math.floor(rng() * count);
      const j = 2 + Math.floor(rng() * (per - 4));
      pos.set(position.subarray((f * per + j) * 3, (f * per + j) * 3 + 3), i * 3);
      r.set([rng(), rng(), rng(), rng()], i * 4);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("aR", new BufferAttribute(r, 4));
    return g;
  });

const heroIds = (a: BrainAssets) =>
  memo(a, "fibre-hero-ids", () => {
    const rng = mulberry32(2203);
    const s = new Set<number>();
    for (let i = 0; i < a.fibres.count; i++) if (a.fibres.kind[i] === 0 && rng() < 0.11) s.add(i);
    return s;
  });

// Jagged signal path along a fibre: upsampled fibre curve plus perpendicular
// crackle re-drawn every 2 frames (pure function of event + frame).
const sigTmp = { p: new Vector3(), q: new Vector3(), d: new Vector3(), n1: new Vector3(), n2: new Vector3() };
const writeSignal = (
  a: BrainAssets,
  ev: Ev,
  age: number,
  p: number,
  frame: number,
  big: boolean,
  A: Float32Array,
  B: Float32Array,
  Sx: Float32Array,
  slot: number,
) => {
  const { per, position } = a.fibres;
  const fib = ev.id;
  const crackle = Math.floor(frame / 2);
  const head = Math.min(1, (age + 1) / Math.max(2, ev.dur * 0.3));
  const tail = p < 0.7 ? 0 : (p - 0.7) / 0.3;
  const fade = p < 0.75 ? 1 : 1 - (p - 0.75) / 0.25;
  const flick = 0.75 + 0.25 * hash01(crackle, fib);
  const amp = (big ? 0.035 : 0.016) * (0.6 + 0.8 * ev.r);
  const pts: number[] = [];
  for (let k = 0; k < SIG_PTS; k++) {
    const u = k / (SIG_PTS - 1);
    const fu = u * (per - 1);
    const j = Math.min(per - 2, Math.floor(fu));
    const t = fu - j;
    const i0 = (fib * per + j) * 3;
    sigTmp.p.set(position[i0], position[i0 + 1], position[i0 + 2]);
    sigTmp.q.set(position[i0 + 3], position[i0 + 4], position[i0 + 5]);
    sigTmp.d.subVectors(sigTmp.q, sigTmp.p);
    sigTmp.p.lerp(sigTmp.q, t);
    sigTmp.d.normalize();
    sigTmp.n1.set(0.31, 0.95, 0.12).cross(sigTmp.d).normalize();
    sigTmp.n2.crossVectors(sigTmp.d, sigTmp.n1);
    const kk = k / 4;
    const k0 = Math.floor(kk);
    const kt = kk - k0;
    const sm = kt * kt * (3 - 2 * kt);
    const jit = (salt: number, q: number) => (hash01(crackle * 131 + q * 7 + salt, fib + salt) - 0.5) * 2;
    const j1 = jit(0, k0) + (jit(0, k0 + 1) - jit(0, k0)) * sm;
    const j2 = jit(9, k0) + (jit(9, k0 + 1) - jit(9, k0)) * sm;
    const env = k === 0 || k === SIG_PTS - 1 ? 0 : 1;
    sigTmp.p.addScaledVector(sigTmp.n1, j1 * amp * env).addScaledVector(sigTmp.n2, j2 * amp * env);
    pts.push(sigTmp.p.x, sigTmp.p.y, sigTmp.p.z);
  }
  const width = big ? 30 : 8;
  for (let k = 0; k < SIG_PTS - 1; k++) {
    const s = slot * (SIG_PTS - 1) + k;
    const u0 = k / (SIG_PTS - 1);
    const on = u0 >= tail && u0 <= head;
    for (let c = 0; c < 3; c++) {
      A[s * 3 + c] = pts[k * 3 + c];
      B[s * 3 + c] = pts[(k + 1) * 3 + c];
    }
    const headGlow = Math.exp(-Math.max(0, head - u0) * 6);
    const taper = Math.min(1, (head - u0) * 25 + 0.15, (u0 - tail) * 25 + 0.15);
    Sx[s * 2] = on ? taper * fade * flick * (0.55 + 0.9 * headGlow) * (big ? 1.4 : 1) : 0;
    Sx[s * 2 + 1] = width * (0.8 + 0.5 * headGlow);
  }
};

type Variant = "reveal" | "loop";

const scheduleFor = (a: BrainAssets, variant: Variant) =>
  memo(a, `fibre-signals-${variant}`, () => {
    const surf: number[] = [];
    for (let i = 0; i < a.fibres.count; i++) if (a.fibres.kind[i] === 0 && a.fibres.length[i] > 0.75) surf.push(i);
    return makeSchedule({
      seed: variant === "loop" ? 3303 : 2302,
      period: PERIOD,
      gap: [2, 14],
      dur: [8, 20],
      concurrent: 8,
      pick: (_s, rng) => surf[Math.floor(rng() * surf.length)],
    });
  });

export const makeFibreLook =
  (variant: Variant): LookFactory =>
  ({ gl, assets, width, height }) => {
    const post = new Post(
      gl,
      {
        msaa: 4,
        bloom: { strength: 0.22, threshold: 0.8, knee: 0.2, levels: 6, radius: 0.75 },
        background: BG,
        uniforms: {
          uCentre: { value: srgb(FIBRE_COLORS.bgCentre) },
          uCorner: { value: srgb(FIBRE_COLORS.bgCorner) },
          uHazeCol: { value: srgb(FIBRE_COLORS.haze) },
          uHaze: { value: 0 },
        },
        key: null,
        exposure: 1,
      },
      assets.blueNoise,
    );
    const scene = new Scene();
    const brain = new Group();
    scene.add(brain);
    const cam = new PerspectiveCamera(FOV, width / height, 0.01, 50);
    const projY = cam.projectionMatrix.elements[5];
    const viewH = 1.68;
    const farDist = viewH / 2 / Math.tan((FOV / 2) * (Math.PI / 180));
    const centreView = new Vector3();
    const colA = new Vector3(...lin(FIBRE_COLORS.fibreA));
    const colB = new Vector3(...lin(FIBRE_COLORS.fibreB));
    const common = {
      uRes: { value: post.size },
      uPx: { value: pxScale(post) },
      uNear: { value: 0.01 },
      uCap: { value: 1 },
      uProjY: { value: projY },
      uPhase: { value: 0 },
      uCentreView: { value: centreView },
      uDepthSpan: { value: 0.9 },
      uFocus: { value: farDist },
      uCoc: { value: 0 },
      uA: { value: colA },
      uB: { value: colB },
      uHero: { value: 1 },
    };
    const hero = heroIds(assets);
    const lineMat = new ShaderMaterial({
      glslVersion: "300 es" as never,
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      uniforms: common,
      ...PREMULT_OVER,
      depthTest: false,
    });
    const lines = new LineSegments(fibreLines(assets, "light", (i) => !hero.has(i)), lineMat);
    lines.frustumCulled = false;
    brain.add(lines);
    const heroMat = new ShaderMaterial({
      glslVersion: "300 es" as never,
      vertexShader: HERO_VERT,
      fragmentShader: HERO_FRAG,
      uniforms: { ...common, uCap: { value: 0 } },
      ...PREMULT_OVER,
      depthTest: false,
    });
    const heroMesh = new Mesh(fibreSegments(assets, "light-hero", (i) => hero.has(i)), heroMat);
    heroMesh.frustumCulled = false;
    brain.add(heroMesh);
    const beadMat = new ShaderMaterial({
      glslVersion: "300 es" as never,
      vertexShader: BEAD_VERT,
      fragmentShader: BEAD_FRAG,
      uniforms: { ...common, uBead: { value: new Vector3(...lin(FIBRE_COLORS.bead)) }, uBokeh: { value: new Vector3(...lin(FIBRE_COLORS.bokeh)) }, uSig: { value: new Vector3(...lin(FIBRE_COLORS.signal)) } },
      ...ADDITIVE,
      depthTest: false,
    });
    const beads = new Points(beadGeometry(assets), beadMat);
    beads.frustumCulled = false;
    brain.add(beads);

    // dynamic signal buffer
    const nSeg = MAX_SIG * (SIG_PTS - 1);
    const sA = new Float32Array(nSeg * 3);
    const sB = new Float32Array(nSeg * 3);
    const sS = new Float32Array(nSeg * 2);
    const sg = new InstancedBufferGeometry();
    sg.setAttribute("position", new BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 0, 1, 0, 1, 1, 0]), 3));
    sg.setIndex([0, 1, 2, 2, 1, 3]);
    const attA = new InstancedBufferAttribute(sA, 3).setUsage(DynamicDrawUsage);
    const attB = new InstancedBufferAttribute(sB, 3).setUsage(DynamicDrawUsage);
    const attS = new InstancedBufferAttribute(sS, 2).setUsage(DynamicDrawUsage);
    sg.setAttribute("aA", attA);
    sg.setAttribute("aB", attB);
    sg.setAttribute("aS", attS);
    sg.instanceCount = nSeg;
    const sigMat = new ShaderMaterial({
      glslVersion: "300 es" as never,
      vertexShader: SIG_VERT,
      fragmentShader: SIG_FRAG,
      uniforms: { ...common, uSig: { value: new Vector3(...lin(FIBRE_COLORS.signal)) }, uWidthMul: { value: 1 }, uHalo: { value: 0 } },
      ...PREMULT_OVER,
      depthTest: false,
    });
    const sig = new Mesh(sg, sigMat);
    sig.frustumCulled = false;
    sig.renderOrder = 6;
    const haloMat = new ShaderMaterial({
      glslVersion: "300 es" as never,
      vertexShader: SIG_VERT,
      fragmentShader: SIG_FRAG,
      uniforms: { ...sigMat.uniforms, uWidthMul: { value: 4.5 }, uHalo: { value: 1 } },
      ...ADDITIVE,
      depthTest: false,
    });
    const halo = new Mesh(sg, haloMat);
    halo.frustumCulled = false;
    halo.renderOrder = 5;
    brain.add(halo, sig);

    const events = scheduleFor(assets, variant);
    // Reveal: big signals on fibres close to the starting camera, 0-3 s.
    const camDir = new Vector3(Math.sin(0.75) * Math.cos(-0.08), Math.sin(-0.08), Math.cos(0.75) * Math.cos(-0.08)).normalize();
    const START_D = 0.98;
    const start = camDir.clone().multiplyScalar(START_D);
    const bigEvents: Ev[] = [];
    if (variant === "reveal") {
      const { count, per, position, kind } = assets.fibres;
      const near: { i: number; d: number }[] = [];
      const p = new Vector3();
      for (let i = 0; i < count; i++) {
        if (kind[i] !== 0) continue;
        p.fromArray(position, (i * per + (per >> 1)) * 3);
        const d = p.distanceTo(start);
        const ahead = p.clone().sub(start).dot(camDir) * -1;
        if (d < 0.5 && ahead > 0.1) near.push({ i, d });
      }
      near.sort((x, y) => x.d - y.d);
      const rng = mulberry32(2304);
      for (let k = 0; k < 9; k++) {
        const pick = near[Math.floor(rng() * Math.min(near.length, 60))];
        bigEvents.push({ start: 4 + k * 10 + Math.floor(rng() * 6), dur: Math.floor(14 + rng() * 8), id: pick.i, r: rng(), r2: rng() });
      }
    }

    const rot = new Matrix4();
    return {
      render(frame) {
        const f = variant === "loop" ? frame % PERIOD : frame;
        let yaw: number;
        if (variant === "loop") {
          yaw = -0.6 + (TAU * f) / PERIOD;
          const d = farDist;
          cam.position.set(0, Math.sin(ELEV) * d, Math.cos(ELEV) * d);
          cam.lookAt(0, 0, 0);
          common.uCoc.value = 0;
          common.uHero.value = 0.0;
          common.uFocus.value = d;
        } else {
          // 0-3 s inside the tangle, 3-7 s pull back through the surface, 7-10 s turn
          const pull = easeInOut(smoothstep(80, 215, f));
          const d = START_D + (farDist * 1.02 - START_D) * pull;
          const drift = (1 - pull) * 0.05 * Math.sin(f / 25);
          cam.position.copy(camDir).multiplyScalar(d);
          cam.position.y += drift;
          cam.lookAt(0, 0.2 * pull, 0);
          yaw = -0.25 * easeInOutSine(smoothstep(195, 300, f)) + 0.04 * (1 - pull) * Math.sin(f / 40);
          common.uFocus.value = 0.22 + (farDist - 0.22) * pull;
          common.uCoc.value = 0.009 * (1 - pull) + 0.0004;
          common.uHero.value = 1 - pull;
          post.composite.uniforms.uHaze.value = 0.85 * (1 - smoothstep(0.15, 0.75, pull));
        }
        brain.rotation.set(0, yaw, 0);
        cam.updateMatrixWorld();
        brain.updateMatrixWorld(true);
        rot.multiplyMatrices(cam.matrixWorldInverse, brain.matrixWorld);
        centreView.set(0, 0, 0).applyMatrix4(rot);
        common.uDepthSpan.value = 0.9;
        common.uPhase.value = (((f % PERIOD) + PERIOD) % PERIOD) / PERIOD;

        sS.fill(0);
        let slot = 0;
        if (variant === "reveal") {
          for (const { ev, age, p } of activeAt(bigEvents, f, 1e9)) {
            if (slot >= MAX_SIG) break;
            writeSignal(assets, ev, age, p, f, true, sA, sB, sS, slot++);
          }
        }
        const small = activeAt(events, f, PERIOD);
        for (const { ev, age, p } of small) {
          if (slot >= MAX_SIG) break;
          if (variant === "reveal" && f < 70) break; // the close-up keeps to the big ones
          writeSignal(assets, ev, age, p, f, false, sA, sB, sS, slot++);
        }
        attA.needsUpdate = true;
        attB.needsUpdate = true;
        attS.needsUpdate = true;

        post.begin();
        gl.render(scene, cam);
        post.end(f);
      },
      dispose() {
        post.dispose();
        [lineMat, heroMat, beadMat, sigMat, haloMat].forEach((m) => m.dispose());
        sg.dispose();
      },
    };
  };

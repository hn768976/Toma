import * as THREE from "three";
import { Bloom } from "../../gfx/bloom";
import { GLSL_FINISH } from "../../gfx/finish.glsl";
import { Pass, makeRT } from "../../gfx/pass";
import type { Rig, RigFactory } from "../../gfx/ThreeStage";
import { clamp, loopFrame, LOOP_FRAMES, TAU } from "../../lib/loop";
import { loopNoise, mulberry32 } from "../../lib/rand";
import type { StreaksPalette } from "./palettes";

// ---------------------------------------------------------------------------
// Look 2: Light Streaks. ~700 instanced screen-width ribbons, additive, with a
// travelling light pulse on each. Everything is a pure function of frame % 600.
// ---------------------------------------------------------------------------

const N_SEG = 96;
const PTS = N_SEG + 1;
const RIBBONS = 700;
const BUNDLES = 7;
const Z_NEAR = 1.6;
const Z_FAR = 1100;
const FOV = 58;
const CAM_H = 1.4;

const sOf = (t: number): number => Z_NEAR + (Z_FAR - Z_NEAR) * Math.pow(t, 3.4);

// ---- static tables, built once at module level from a seeded generator ----
const rng = mulberry32(0x57e4ca11);

interface Bundle {
  x0: number;
  lane: number; // lateral half-width of the bundle near the camera (m)
  th0: number; // heading at the camera (rad, + = to the right)
  thEnd: number; // heading far away (towards the flare side)
  len: number; // bend length (m)
  seed: number;
  weight: number;
}
const BUNDLE_LIST: Bundle[] = Array.from({ length: BUNDLES }, (_, b) => {
  const f = (b + 0.5) / BUNDLES; // 0 = left .. 1 = right
  return {
    x0: -5.5 + f * 11 + (rng() - 0.5) * 1.2,
    lane: 0.45 + rng() * 1.1,
    th0: 0.5 - f * 0.9 + (rng() - 0.5) * 0.24,
    thEnd: 0.0 + 0.58 * Math.pow(rng(), 1.7),
    len: 5 + rng() * 22,
    seed: 11 + b * 7,
    weight: 0.6 + rng(),
  };
});

interface Ribbon {
  bundle: number;
  u: number; // -1..1 position inside the bundle
  drift: number; // lateral drift that makes lines cross
  y0: number; // height at the camera end
  arch: number; // extra rise in the middle distance (m)
  widthPx: number; // at 4K
  intensity: number;
  k: number; // pulses per 600 frames (integer)
  phase: number; // 0..1
  tail: number;
  colour: number; // 0..1, mapped through the palette
  lw: number;
}

const RIBBON_LIST: Ribbon[] = (() => {
  const totalW = BUNDLE_LIST.reduce((a, b) => a + b.weight, 0);
  const out: Ribbon[] = [];
  for (let r = 0; r < RIBBONS; r++) {
    let pick = rng() * totalW;
    let bi = 0;
    for (; bi < BUNDLES - 1; bi++) {
      pick -= BUNDLE_LIST[bi].weight;
      if (pick <= 0) break;
    }
    const loose = rng() < 0.14;
    const thick = rng() < 0.12;
    out.push({
      bundle: bi,
      u: loose ? (rng() * 2 - 1) * 3.2 : (rng() + rng() - 1),
      drift: (rng() - 0.5) * (loose ? 16 : 7),
      y0: rng() * rng() * 0.38, // every ribbon starts below the bottom edge: no visible line ends
      arch: rng() < 0.5 ? rng() * 1.6 : 0,
      widthPx: thick ? 12 + rng() * 8 : 3 + Math.pow(rng(), 1.5) * 4,
      intensity: (thick ? 1.5 : 0.04) + Math.pow(rng(), 3.2) * (thick ? 0.9 : 3.0),
      k: 3 + Math.floor(rng() * 7),
      phase: rng(),
      tail: 0.05 + rng() * 0.12,
      colour: rng(),
      lw: 40 + rng() * 60,
    });
  }
  return out;
})();

const GLINTS = 30;
const GLINT_LIST = Array.from({ length: GLINTS }, () => ({
  x: -0.96 + rng() * 0.8,
  y: 0.22 + rng() * 0.7,
  size: 0.0035 + rng() * rng() * 0.01,
  inten: 0.25 + rng() * 0.6,
  k: 1 + Math.floor(rng() * 4),
  phase: rng(),
}));

// ---- shaders ---------------------------------------------------------------
const RIBBON_VERT = /* glsl */ `
attribute float aSeg;
attribute float aSide;
attribute float iRow;
attribute vec3 iColor;
attribute vec4 iP; // widthPx(4K), intensity, k, phase
attribute vec4 iQ; // tail, lane taper, -, -
uniform sampler2D tPos;
uniform vec2 uRes;
uniform float uScale;
varying float vT;
varying float vD;
varying float vSigma;
varying float vSigma2;
varying float vEnergy;
varying vec3 vColor;
varying vec4 vP;
varying float vTail;
varying float vDef;

vec3 P(float seg) { return texelFetch(tPos, ivec2(int(seg), int(iRow)), 0).xyz; }

void main() {
  float t = aSeg / ${N_SEG}.0;
  mat4 vp = projectionMatrix * viewMatrix;
  vec4 c  = vp * vec4(P(aSeg), 1.0);
  vec4 cp = vp * vec4(P(max(aSeg - 1.0, 0.0)), 1.0);
  vec4 cn = vp * vec4(P(min(aSeg + 1.0, ${N_SEG}.0)), 1.0);
  vec2 hres = 0.5 * uRes;
  vec2 sp = cp.xy / max(cp.w, 1e-3) * hres;
  vec2 sn = cn.xy / max(cn.w, 1e-3) * hres;
  vec2 dir = sn - sp;
  float len = length(dir);
  dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);

  // thinner with distance; only the farthest convergence gets a very soft defocus
  float def = 1.0 + 2.4 * smoothstep(0.8, 1.0, t);
  float wpx = iP.x * uScale * mix(1.0, 0.4, smoothstep(0.05, 0.8, t)) * def;
  float sigma = sqrt(pow(0.42 * wpx, 2.0) + 0.2);
  float sigma2 = 2.6 * sigma + 0.8; // soft neon halo around the core
  float ext = 3.0 * sigma2 + 1.0;

  vec4 pos = c;
  pos.xy += nrm * aSide * ext / hres * c.w;
  gl_Position = pos;
  vT = t;
  vD = aSide * ext;
  vSigma = sigma;
  vSigma2 = sigma2;
  vEnergy = 0.42 * wpx / sigma;
  vColor = iColor;
  vP = iP;
  vTail = iQ.x;
  vDef = def;
}`;

const RIBBON_FRAG = /* glsl */ `
uniform float uLoop; // 0..1 phase of the loop
varying float vT;
varying float vD;
varying float vSigma;
varying float vSigma2;
varying float vEnergy;
varying vec3 vColor;
varying vec4 vP;
varying float vTail;
varying float vDef;

float prof(float tt, float tail) {
  return tt < 0.0 ? exp(tt / 0.012) : exp(-tt / tail);
}

void main() {
  float across = (exp(-0.5 * vD * vD / (vSigma * vSigma)) + 0.14 * (vSigma / vSigma2) * exp(-0.5 * vD * vD / (vSigma2 * vSigma2))) * vEnergy;
  // the head travels from the horizon (t = 1) to the camera (t = 0), k whole laps per loop
  float head = 1.0 - fract(vP.w + vP.z * uLoop);
  float fadeHead = smoothstep(0.0, 0.2, head) * (1.0 - smoothstep(0.93, 1.0, head));
  float pulse = prof(vT - head, vTail) * fadeHead;
  float far = mix(1.0, 0.0, smoothstep(0.12, 0.7, vT));
  float inten = vP.y * far * (0.28 + 1.3 * pulse) / pow(vDef, 0.7);
  vec3 col = mix(vColor, vec3(1.0), clamp(pulse * 0.16, 0.0, 1.0)) * inten * across;
  gl_FragColor = vec4(col, 1.0);
}`;

const BACKDROP_FRAG = /* glsl */ `
uniform vec2 uRes;
uniform vec2 uFlare;
uniform vec2 uFlare0;
uniform vec2 uHzA;
uniform vec2 uHzB;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uHaze;
uniform vec3 uGlint;
uniform float uLoop;
uniform vec4 uGlintA[${GLINTS}]; // x, y, size, intensity
uniform vec2 uGlintB[${GLINTS}]; // k, phase
varying vec2 vUv;

void main() {
  vec2 ndc = vUv * 2.0 - 1.0;
  float aspect = uRes.x / uRes.y;
  float m = (uHzB.y - uHzA.y) / (uHzB.x - uHzA.x);
  float h = ndc.y - (uHzA.y + m * (ndc.x - uHzA.x)); // > 0 above the horizon
  float up = clamp(h / 1.05, 0.0, 1.0);
  float side = smoothstep(-1.2, 1.0, ndc.x);                    // the horizon glow lives on the flare side
  vec3 sky = mix(uSkyHorizon * mix(0.12, 0.55, side), uSkyTop, 1.0 - exp(-up * 4.2));
  vec2 d = vec2((ndc.x - uFlare.x) * aspect / 0.8, h / 0.34);
  sky += uHaze * (0.45 * exp(-dot(d, d) * 1.1));
  float below = clamp(-h, 0.0, 1.0);
  vec3 ground = mix(uSkyHorizon * 0.32, uSkyTop * 0.6, smoothstep(0.0, 0.7, below));
  float gx = (ndc.x - uFlare.x) * aspect / 1.5;
  ground += uHaze * 0.22 * exp(-gx * gx) * exp(-below * 4.0);
  vec3 col = mix(ground, sky, smoothstep(-0.012, 0.012, h));

  // distant glints, upper left, twinkling in whole cycles
  vec2 shift = (uFlare - uFlare0) * 0.85;
  if (ndc.x < 0.1 && ndc.y > 0.05) {
    for (int i = 0; i < ${GLINTS}; i++) {
      vec4 a = uGlintA[i];
      vec2 b = uGlintB[i];
      vec2 p = (ndc - (a.xy + shift)) * vec2(aspect, 1.0);
      float tw = 0.55 + 0.45 * sin(6.2831853 * (b.x * uLoop + b.y));
      col += uGlint * a.w * tw * exp(-dot(p, p) / (2.0 * a.z * a.z)) * 0.03;
    }
    // the one larger violet ghost, stretched horizontally
    vec2 g = (ndc - (vec2(-0.55, 0.64) + shift)) * vec2(aspect, 1.0);
    col += uGlint * 0.28 * exp(-(g.x * g.x) / (2.0 * 0.03 * 0.03) - (g.y * g.y) / (2.0 * 0.009 * 0.009));
    col += uGlint * 0.03 * exp(-(g.x * g.x) / (2.0 * 0.3 * 0.3) - (g.y * g.y) / (2.0 * 0.05 * 0.05));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const FLARE_FRAG = /* glsl */ `
uniform vec2 uRes;
uniform vec2 uFlare;
uniform vec3 uCore;
uniform vec3 uGlow;
uniform float uPulse;
varying vec2 vUv;
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 d = (vUv * 2.0 - 1.0 - uFlare) * vec2(aspect, 1.0); // 1 unit = half the frame height
  float r = length(d);
  float core = exp(-pow(r / 0.034, 2.0)) * 16.0;
  float hot = exp(-pow(r / 0.06, 2.0)) * 1.0;
  float glow = exp(-r / 0.1) * 1.0;
  float streak = exp(-abs(d.x) / 0.32) * exp(-pow(d.y / 0.013, 2.0)) * 4.5;
  float streak2 = exp(-abs(d.x) / 0.18) * exp(-pow(d.y / 0.04, 2.0)) * 0.5 + exp(-abs(d.x) / 0.3) * exp(-abs(d.y) / 0.07) * 0.5;
  vec3 col = uCore * (core + hot) + uGlow * (glow + streak2) + mix(uGlow, uCore, 0.55) * streak;
  gl_FragColor = vec4(col * uPulse, 1.0);
}`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uLoopFrame;
uniform float uBloom;
uniform float uChroma;
uniform float uVignette;
uniform float uGrain;
uniform float uGrainSize;
uniform float uExposure;
varying vec2 vUv;
${GLSL_FINISH}
void main() {
  vec2 c = vUv - 0.5;
  vec3 col;
  col.r = texture2D(tScene, vUv + c * uChroma).r;
  col.g = texture2D(tScene, vUv).g;
  col.b = texture2D(tScene, vUv - c * uChroma).b;
  col += texture2D(tBloom, vUv).rgb * uBloom;
  float mx = max(max(col.r, col.g), max(col.b, 1e-4)) * uExposure;
  col *= (1.0 - exp(-mx)) / mx * uExposure; // hue-preserving soft clip: colours stay saturated
  float vig = 1.0 - uVignette * smoothstep(0.3, 1.05, length(c * vec2(1.0, 0.85)) * 1.55);
  col *= vig;
  gl_FragColor = vec4(finish(col, gl_FragCoord.xy, uLoopFrame, uGrain, uGrainSize), 1.0);
}`;

// ---- rig ---------------------------------------------------------------------
const ADD: Partial<THREE.ShaderMaterialParameters> = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
};

export const createStreaksRig = (palette: StreaksPalette): RigFactory => (gl, w, h): Rig => {
  gl.autoClear = false;
  gl.toneMapping = THREE.NoToneMapping;
  const scale = w / 3840;

  // palette -> per-ribbon linear colours
  const totalWeight = palette.streaks.reduce((a, s) => a + s.weight, 0);
  const colours = palette.streaks.map((s) => new THREE.Color(s.hex));
  const pickColour = (u: number): THREE.Color => {
    let acc = u * totalWeight;
    for (let i = 0; i < colours.length; i++) {
      acc -= palette.streaks[i].weight;
      if (acc <= 0) return colours[i];
    }
    return colours[colours.length - 1];
  };

  // geometry
  const geo = new THREE.InstancedBufferGeometry();
  const nv = PTS * 2;
  const aSeg = new Float32Array(nv);
  const aSide = new Float32Array(nv);
  for (let i = 0; i < PTS; i++) {
    aSeg[2 * i] = aSeg[2 * i + 1] = i;
    aSide[2 * i] = -1;
    aSide[2 * i + 1] = 1;
  }
  const index: number[] = [];
  for (let i = 0; i < N_SEG; i++) index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
  geo.setIndex(index);
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nv * 3), 3));
  geo.setAttribute("aSeg", new THREE.BufferAttribute(aSeg, 1));
  geo.setAttribute("aSide", new THREE.BufferAttribute(aSide, 1));
  const iRow = new Float32Array(RIBBONS);
  const iColor = new Float32Array(RIBBONS * 3);
  const iP = new Float32Array(RIBBONS * 4);
  const iQ = new Float32Array(RIBBONS * 4);
  RIBBON_LIST.forEach((r, i) => {
    iRow[i] = i;
    const c = pickColour(r.colour);
    iColor.set([c.r, c.g, c.b], i * 3);
    iP.set([r.widthPx, r.intensity, r.k, r.phase], i * 4);
    iQ.set([r.tail, 0, 0, 0], i * 4);
  });
  geo.setAttribute("iRow", new THREE.InstancedBufferAttribute(iRow, 1));
  geo.setAttribute("iColor", new THREE.InstancedBufferAttribute(iColor, 3));
  geo.setAttribute("iP", new THREE.InstancedBufferAttribute(iP, 4));
  geo.setAttribute("iQ", new THREE.InstancedBufferAttribute(iQ, 4));
  geo.instanceCount = RIBBONS;

  const posData = new Float32Array(PTS * RIBBONS * 4);
  const posTex = new THREE.DataTexture(posData, PTS, RIBBONS, THREE.RGBAFormat, THREE.FloatType);
  posTex.minFilter = posTex.magFilter = THREE.NearestFilter;
  posTex.generateMipmaps = false;
  posTex.needsUpdate = true;

  const ribbonMat = new THREE.ShaderMaterial({
    vertexShader: RIBBON_VERT,
    fragmentShader: RIBBON_FRAG,
    uniforms: {
      tPos: { value: posTex },
      uRes: { value: new THREE.Vector2(w, h) },
      uScale: { value: scale },
      uLoop: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
    transparent: true,
    toneMapped: false,
    side: THREE.DoubleSide,
    ...ADD,
  });
  const ribbonMesh = new THREE.Mesh(geo, ribbonMat);
  ribbonMesh.frustumCulled = false;
  const ribbonScene = new THREE.Scene();
  ribbonScene.add(ribbonMesh);

  const camera = new THREE.PerspectiveCamera(FOV, w / h, 0.1, 6000);
  camera.rotation.order = "YXZ";

  const flare0 = new THREE.Vector2();
  const glintUniformA: THREE.Vector4[] = GLINT_LIST.map((g) => new THREE.Vector4(g.x, g.y, g.size, g.inten));
  const glintUniformB: THREE.Vector2[] = GLINT_LIST.map((g) => new THREE.Vector2(g.k, g.phase));

  const backdrop = new Pass(BACKDROP_FRAG, {
    uRes: { value: new THREE.Vector2(w, h) },
    uFlare: { value: new THREE.Vector2() },
    uFlare0: { value: flare0 },
    uHzA: { value: new THREE.Vector2() },
    uHzB: { value: new THREE.Vector2() },
    uSkyTop: { value: new THREE.Color(palette.skyTop) },
    uSkyHorizon: { value: new THREE.Color(palette.skyHorizon) },
    uHaze: { value: new THREE.Color(palette.haze) },
    uGlint: { value: new THREE.Color(palette.glint) },
    uLoop: { value: 0 },
    uGlintA: { value: glintUniformA },
    uGlintB: { value: glintUniformB },
  });
  const flare = new Pass(
    FLARE_FRAG,
    {
      uRes: { value: new THREE.Vector2(w, h) },
      uFlare: { value: new THREE.Vector2() },
      uCore: { value: new THREE.Color(palette.flareCore) },
      uGlow: { value: new THREE.Color(palette.flareGlow) },
      uPulse: { value: 1 },
    },
    ADD,
  );
  const sceneRT = makeRT(w, h);
  const bloom = new Bloom(w, h, 6);
  const composite = new Pass(COMPOSITE_FRAG, {
    tScene: { value: sceneRT.texture },
    tBloom: { value: null },
    uLoopFrame: { value: 0 },
    uBloom: { value: 0.22 },
    uChroma: { value: 0.0022 },
    uVignette: { value: 0.42 },
    uGrain: { value: 0.015 },
    uGrainSize: { value: Math.max(1, Math.round(scale * 1.5)) },
    uExposure: { value: 1.9 },
  });

  // ---- camera pose: yaw, pitch, roll and a little travel, all whole cycles ----
  const REST_YAW = THREE.MathUtils.degToRad(5.6);
  const REST_PITCH = THREE.MathUtils.degToRad(-1.9);
  const placeCamera = (phase: number): void => {
    const a = TAU * phase;
    const yaw = REST_YAW + THREE.MathUtils.degToRad(2.6) * Math.sin(a + 0.6) + THREE.MathUtils.degToRad(0.8) * Math.sin(2 * a + 2.0);
    const roll = THREE.MathUtils.degToRad(2.2) * Math.sin(2 * a + 1.1) + THREE.MathUtils.degToRad(0.7) * Math.sin(a + 4.0);
    const pitch = REST_PITCH + THREE.MathUtils.degToRad(0.6) * Math.sin(a + 3.0);
    camera.position.set(0.45 * Math.sin(a + 2.2), CAM_H + 0.12 * Math.sin(2 * a + 0.4), -0.9 * (0.5 - 0.5 * Math.cos(a)));
    camera.rotation.set(pitch, yaw, roll);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
  };

  const projectDir = (azimuth: number, out: THREE.Vector3): THREE.Vector3 =>
    out
      .set(camera.position.x + 20000 * Math.sin(azimuth), camera.position.y, camera.position.z - 20000 * Math.cos(azimuth))
      .project(camera);

  // flare azimuth chosen so the flare sits near the right edge at the rest pose
  const tmp = new THREE.Vector3();
  const FLARE_AZ = (() => {
    placeCamera(0);
    let lo = 0.1;
    let hi = 1.2;
    for (let i = 0; i < 40; i++) {
      const mid = 0.5 * (lo + hi);
      projectDir(mid, tmp);
      if (tmp.x < 0.978) lo = mid;
      else hi = mid;
    }
    return 0.5 * (lo + hi);
  })();
  placeCamera(0);
  projectDir(FLARE_AZ, tmp);
  flare0.set(tmp.x, tmp.y);

  // ---- per-frame curve generation (CPU) ----
  const sSamples = Float32Array.from({ length: PTS }, (_, k) => sOf(k / N_SEG));
  const cx = new Float32Array(BUNDLES * PTS);
  const cz = new Float32Array(BUNDLES * PTS);
  const cth = new Float32Array(BUNDLES * PTS);

  const buildCurves = (phase: number): void => {
    for (let b = 0; b < BUNDLES; b++) {
      const B = BUNDLE_LIST[b];
      const thEnd = B.thEnd + 0.07 * loopNoise(B.seed, phase) ;
      const th0 = B.th0 + 0.05 * loopNoise(B.seed + 3, phase);
      const len = B.len * (1 + 0.3 * loopNoise(B.seed + 5, phase));
      const x0 = B.x0 + 0.5 * loopNoise(B.seed + 9, phase);
      const heading = (s: number): number => thEnd + (th0 - thEnd) * Math.exp(-s / len);
      let x = x0;
      let z = -Z_NEAR;
      for (let k = 0; k < PTS; k++) {
        const idx = b * PTS + k;
        if (k > 0) {
          const s0 = sSamples[k - 1];
          const s1 = sSamples[k];
          const SUB = 3;
          for (let q = 0; q < SUB; q++) {
            const sa = s0 + ((s1 - s0) * q) / SUB;
            const sb = s0 + ((s1 - s0) * (q + 1)) / SUB;
            const th = heading(0.5 * (sa + sb));
            x += Math.sin(th) * (sb - sa);
            z -= Math.cos(th) * (sb - sa);
          }
        }
        cx[idx] = x;
        cz[idx] = z;
        cth[idx] = heading(sSamples[k]);
      }
    }
  };

  const writePositions = (): void => {
    for (let r = 0; r < RIBBONS; r++) {
      const R = RIBBON_LIST[r];
      const B = BUNDLE_LIST[R.bundle];
      for (let k = 0; k < PTS; k++) {
        const s = sSamples[k];
        const idx = R.bundle * PTS + k;
        const th = cth[idx];
        const off =
          R.u * B.lane * (0.16 + 0.84 * Math.exp(-s / R.lw)) + R.drift * Math.sin(Math.PI * clamp(s / 420, 0, 1)) * (0.25 + 0.75 * Math.exp(-s / 160));
        const y = R.y0 * Math.exp(-s / 12) + R.arch * Math.sin(Math.PI * clamp(s / 70, 0, 1)) + 0.03;
        const o = (r * PTS + k) * 4;
        posData[o] = cx[idx] + Math.cos(th) * off;
        posData[o + 1] = y;
        posData[o + 2] = cz[idx] + Math.sin(th) * off;
        posData[o + 3] = 1;
      }
    }
    posTex.needsUpdate = true;
  };

  const flareNdc = new THREE.Vector3();
  const hzA = new THREE.Vector3();
  const hzB = new THREE.Vector3();

  return {
    render(frame: number): void {
      const f = loopFrame(frame);
      const phase = f / LOOP_FRAMES;
      placeCamera(phase);
      buildCurves(phase);
      writePositions();

      projectDir(FLARE_AZ, flareNdc);
      projectDir(FLARE_AZ - 1.2, hzA);
      projectDir(FLARE_AZ + 0.0, hzB);
      if (Math.abs(hzB.x - hzA.x) < 1e-4) hzB.x += 1e-4;

      const bu = backdrop.material.uniforms;
      bu.uFlare.value.set(flareNdc.x, flareNdc.y);
      bu.uHzA.value.set(hzA.x, hzA.y);
      bu.uHzB.value.set(hzB.x, hzB.y);
      bu.uLoop.value = phase;
      ribbonMat.uniforms.uLoop.value = phase;
      const fu = flare.material.uniforms;
      fu.uFlare.value.set(flareNdc.x, flareNdc.y);
      fu.uPulse.value = 1 + 0.1 * Math.sin(TAU * 3 * phase) + 0.05 * Math.sin(TAU * 7 * phase + 1.3);

      backdrop.render(gl, sceneRT);
      gl.setRenderTarget(sceneRT);
      gl.render(ribbonScene, camera);
      flare.render(gl, sceneRT);

      const bloomTex = bloom.render(gl, sceneRT.texture, w, h, 1.5);
      composite.material.uniforms.tBloom.value = bloomTex;
      composite.material.uniforms.uLoopFrame.value = f;
      composite.render(gl, null);
    },
    dispose(): void {
      geo.dispose();
      ribbonMat.dispose();
      posTex.dispose();
      sceneRT.dispose();
      bloom.dispose();
      backdrop.dispose();
      flare.dispose();
      composite.dispose();
    },
  };
};

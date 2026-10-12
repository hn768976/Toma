import * as THREE from "three";
import { cosEase, DEG, TAU } from "../common/random";
import { LookFactory } from "../three/ThreeLook";
import { SegmentTorusRow } from "../versions";

// Look 3: a torus built from 64 soft "lens" segments (bulging in the middle,
// pinched where they meet), shaded with a two-colour gradient that travels one
// lap per loop, a fresnel rim and glowing seams. The camera moves through
// three beats (lit close / dim rims / wide) and returns to beat 1.

const MAJOR = 3;
export const TORUS_PARAMS = {
  // The reference shows ~40 fat, deeply pinched slices per ring; 64 thin ones
  // read as a ribbed hose next to it, so the count is a parameter.
  segments: 40,
  minor: 1.05, // tube radius (major radius is 3)
  pinch: 0.5, // how much the tube narrows at a seam
  zoom: 1, // scales every beat's camera offset from its target
  roll: -40, // camera roll, deg: the ring runs diagonally across the frame
  inner: 1, // how strongly the warm colour gathers on the hole-facing side
  shininess: 26,
  segLight: 2.5, // one-sided light across each slice: bright edge -> dark core
  segPow: 3,
  warm: 1.1, // overall reach of gradient B
  keyScale: 0.15,
  glow: 2.0, // inner-wall glow in colour B
  sharp: 0.8, // 0 = soft A-B blend, 1 = hard split (avoids a muddy mid-tone)
  rimScale: 0.2,
  exposure: 1.2,
};

// One segment around ring angle 0, spanning +/- half a pitch.
const buildSegment = (PINCH: number, MINOR: number, SEGMENTS: number) => {
  const U = 20;
  const V = 64;
  const half = Math.PI / SEGMENTS;
  // overlap neighbours by 0.4 % so no crack can open at a seam
  const span = half * 1.004;
  const pos: number[] = [];
  const nor: number[] = [];
  const seg: number[] = [];
  const idx: number[] = [];
  const P = (phi: number, th: number) => {
    const t = phi / half;
    const rho = MINOR * (1 - PINCH * t * t);
    const c = Math.cos(phi);
    const s = Math.sin(phi);
    const ct = Math.cos(th);
    return new THREE.Vector3((MAJOR + rho * ct) * c, rho * Math.sin(th), (MAJOR + rho * ct) * s);
  };
  const e = 1e-4;
  for (let i = 0; i <= U; i++) {
    const t = ((i / U) * 2 - 1) * (span / half);
    const phi = t * half;
    for (let j = 0; j <= V; j++) {
      const th = (j / V) * TAU;
      const p = P(phi, th);
      const dphi = P(phi + e, th).sub(P(phi - e, th));
      const dth = P(phi, th + e).sub(P(phi, th - e));
      const n = new THREE.Vector3().crossVectors(dth, dphi).normalize();
      // make it point away from the tube centre
      const cc = new THREE.Vector3(MAJOR * Math.cos(phi), 0, MAJOR * Math.sin(phi));
      if (n.dot(p.clone().sub(cc)) < 0) n.negate();
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
      seg.push(Math.min(1, Math.abs(t)) * Math.sign(t));
    }
  }
  for (let i = 0; i < U; i++) {
    for (let j = 0; j < V; j++) {
      const a = i * (V + 1) + j;
      const b = a + V + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("seg", new THREE.Float32BufferAttribute(seg, 1));
  g.setIndex(idx);
  // make sure the triangle winding faces outward
  const tmp = g.clone().toNonIndexed();
  const pa = tmp.getAttribute("position");
  const v0 = new THREE.Vector3().fromBufferAttribute(pa, 0);
  const v1 = new THREE.Vector3().fromBufferAttribute(pa, 1);
  const v2 = new THREE.Vector3().fromBufferAttribute(pa, 2);
  const fn = new THREE.Vector3().crossVectors(v1.clone().sub(v0), v2.clone().sub(v0));
  const n0 = new THREE.Vector3().fromBufferAttribute(g.getAttribute("normal") as THREE.BufferAttribute, idx[0]);
  if (fn.dot(n0) < 0) {
    for (let k = 0; k < idx.length; k += 3) {
      const t = idx[k + 1];
      idx[k + 1] = idx[k + 2];
      idx[k + 2] = t;
    }
    g.setIndex(idx);
  }
  tmp.dispose();
  return g;
};

const vertexShader = /* glsl */ `
attribute float seg;
varying vec3 vN;
varying vec3 vW;
varying vec3 vObj;
varying vec3 vObjN;
varying float vSeg;
void main() {
  vec4 op = instanceMatrix * vec4(position, 1.0);
  vObj = op.xyz;
  vObjN = normalize(mat3(instanceMatrix) * normal);
  vec4 wp = modelMatrix * op;
  vW = wp.xyz;
  vN = normalize(mat3(modelMatrix) * vObjN);
  vSeg = seg;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uRim;
uniform float uPhase;
uniform vec3 uKeyDir;
uniform float uKey;
uniform float uFill;
uniform float uRimAmt;
uniform float uSeamAmt;
uniform float uInner;
uniform float uShine;
uniform float uSegLight;
uniform float uSegPow;
uniform float uWarm;
uniform float uGlow;
uniform float uSharp;
uniform float uLit;
varying vec3 vN;
varying vec3 vW;
varying vec3 vObj;
varying vec3 vObjN;
varying float vSeg;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float ang = atan(vObj.z, vObj.x);
  float g = 0.5 - 0.5 * cos(ang - uPhase);
  g = smoothstep(0.0, 1.0, g);
  // warm colour gathers on the inner (hole-facing) side of the tube
  vec2 radial = normalize(vObj.xz);
  float inner = clamp(-dot(normalize(vObjN.xz + 1e-5), radial), 0.0, 1.0);
  g *= mix(1.0, 0.25 + 1.1 * inner, uInner) * uWarm;
  g = clamp(g, 0.0, 1.0);
  float gs = mix(g, smoothstep(0.3, 0.7, g), uSharp);
  vec3 base = mix(uA, uB, gs);
  // across the tube: lighter on top
  base *= 0.7 + 0.45 * (vObjN.y * 0.5 + 0.5);

  vec3 L = normalize(uKeyDir);
  float lam = max(dot(N, L), 0.0);
  lam = lam * lam * 1.3; // harder falloff: bright rim to dark core
  vec3 H = normalize(L + V + vec3(0.0, 1e-3, 0.0));
  float spec = pow(max(dot(N, H), 0.0), uShine) * 0.35;
  float fres = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 3.0);
  // clamp: MSAA evaluates at the pixel centre, which can extrapolate past +/-1
  float seam = pow(clamp(abs(vSeg), 0.0, 1.0), 9.0);

  // each slice is lit from one side, like overlapping coins
  float s01 = clamp(vSeg * 0.5 + 0.5, 0.0, 1.0);
  float slice = pow(s01, uSegPow) * (0.35 + 0.65 * max(dot(N, V), 0.0));
  vec3 col = base * (uKey * lam * 0.55 + uFill + uSegLight * uLit * slice)
           + uKey * spec * mix(vec3(1.0), base, 0.7);
  // hole-facing walls turned toward the camera glow in colour B
  col += uB * uGlow * uLit * gs * inner * inner * pow(max(dot(N, V), 0.0), 1.5) * (0.4 + 0.6 * slice);
  col += uRim * fres * uRimAmt;
  col += uRim * seam * uSeamAmt * (0.35 + 0.65 * fres);
  gl_FragColor = vec4(min(col, vec3(16.0)), 1.0);
}`;

type Beat = {
  cam: [number, number, number];
  target: [number, number, number];
  fov: number;
  key: [number, number, number];
  keyAmt: number;
  fill: number;
  rim: number;
  seam: number;
  focus: number;
  lit: number; // overall light on the surfaces (beat 2 drops to rims only)
};

// Three beats at frames 0, 200, 400; beat 1 again at 600.
export const TORUS_BEATS: Beat[] = [
  // 1: close, low, along the ring, fully lit
  { cam: [1.2, 2.0, 4.3], target: [-0.6, -0.3, -1.0], fov: 58, key: [0.25, 0.35, 1], keyAmt: 1.0, fill: 0.015, rim: 0.4, seam: 0.4, focus: 4.6, lit: 1 },
  // 2: key swings away; only rims and seams glow
  { cam: [-0.2, 1.8, 4.4], target: [0.2, -0.2, -1.4], fov: 56, key: [0.1, 0.25, -1], keyAmt: 0.3, fill: 0.0, rim: 4.0, seam: 4.0, focus: 4.6, lit: 0.12 },
  // 3: wider, the ring's curve against black (still overflowing the frame)
  { cam: [1.3, 3.0, 4.5], target: [-0.3, -0.4, -0.8], fov: 54, key: [0.45, 0.55, 0.8], keyAmt: 0.95, fill: 0.015, rim: 0.5, seam: 0.45, focus: 6.4, lit: 0.9 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerp3 = (a: number[], b: number[], t: number) => a.map((v, i) => lerp(v, b[i], t)) as [number, number, number];

type BeatTune = Record<string, number>;
const beatWith = (i: number, tune: BeatTune): Beat => {
  const b = TORUS_BEATS[i];
  const g = (k: string, v: number) => (tune[`b${i}${k}`] ?? v);
  return {
    ...b,
    cam: [g("cx", b.cam[0]), g("cy", b.cam[1]), g("cz", b.cam[2])],
    target: [g("tx", b.target[0]), g("ty", b.target[1]), g("tz", b.target[2])],
    fov: g("fov", b.fov),
  };
};

export const torusBeatAt = (frame: number, tune: BeatTune = {}): Beat => {
  const f = frame % 600;
  const k = Math.floor(f / 200);
  const t = cosEase((f - k * 200) / 200);
  const a = beatWith(k, tune);
  const b = beatWith((k + 1) % 3, tune);
  return {
    cam: lerp3(a.cam, b.cam, t),
    target: lerp3(a.target, b.target, t),
    fov: lerp(a.fov, b.fov, t),
    key: lerp3(a.key, b.key, t),
    keyAmt: lerp(a.keyAmt, b.keyAmt, t),
    fill: lerp(a.fill, b.fill, t),
    rim: lerp(a.rim, b.rim, t),
    seam: lerp(a.seam, b.seam, t),
    focus: lerp(a.focus, b.focus, t),
    lit: lerp(a.lit, b.lit, t),
  };
};

export const makeSegmentTorus =
  (row: SegmentTorusRow, tune: Partial<typeof TORUS_PARAMS> & Record<string, number> = {}): LookFactory =>
  (_gl, aspect) => {
    const P = { ...TORUS_PARAMS, ...tune };
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0, 0, 0);
    const SEGMENTS = P.segments;
    const geo = buildSegment(P.pinch, P.minor, SEGMENTS);
    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uA: { value: new THREE.Color(row.a) },
        uB: { value: new THREE.Color(row.b) },
        uRim: { value: new THREE.Color(row.rim) },
        uPhase: { value: 0 },
        uKeyDir: { value: new THREE.Vector3(0, 1, 0) },
        uKey: { value: 1 },
        uFill: { value: 0.05 },
        uRimAmt: { value: 0.5 },
        uSeamAmt: { value: 0.5 },
        uInner: { value: P.inner },
        uShine: { value: P.shininess },
        uSegLight: { value: P.segLight },
        uSegPow: { value: P.segPow },
        uWarm: { value: P.warm },
        uGlow: { value: P.glow },
        uSharp: { value: P.sharp },
        uLit: { value: 1 },
      },
    });
    const torus = new THREE.InstancedMesh(geo, mat, SEGMENTS);
    torus.frustumCulled = false;
    const m = new THREE.Matrix4();
    for (let i = 0; i < SEGMENTS; i++) {
      m.makeRotationY((-i * TAU) / SEGMENTS);
      torus.setMatrixAt(i, m);
    }
    torus.instanceMatrix.needsUpdate = true;
    torus.rotation.set(-6 * DEG, 0, -12 * DEG);
    scene.add(torus);

    const camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 60);

    return {
      scene,
      camera,
      update: (frame) => {
        const b = torusBeatAt(frame, tune);
        camera.position.set(
          b.target[0] + (b.cam[0] - b.target[0]) * P.zoom,
          b.target[1] + (b.cam[1] - b.target[1]) * P.zoom,
          b.target[2] + (b.cam[2] - b.target[2]) * P.zoom,
        );
        camera.fov = b.fov;
        camera.updateProjectionMatrix();
        camera.lookAt(...b.target);
        camera.rotateZ(P.roll * DEG);
        camera.updateMatrixWorld();
        const u = mat.uniforms;
        u.uPhase.value = (TAU * (frame % 600)) / 600;
        u.uKeyDir.value.set(...b.key).normalize();
        u.uKey.value = b.keyAmt * P.keyScale;
        u.uFill.value = b.fill;
        u.uRimAmt.value = b.rim * P.rimScale;
        u.uSeamAmt.value = b.seam * P.rimScale;
        u.uLit.value = b.lit;
        torus.updateMatrixWorld(true);
        return {
          focusDist: b.focus * P.zoom,
          focusDead: 0.8,
          focusRange: 4,
          maxBlur: 0.006,
          exposure: P.exposure,
          vignette: 0.2,
          grain: 0.015,
          blackCut: 0,
        };
      },
      dispose: () => {
        geo.dispose();
        mat.dispose();
      },
    };
  };

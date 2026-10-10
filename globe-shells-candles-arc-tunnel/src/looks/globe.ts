import * as THREE from "three";
import { z } from "zod";
import { LookFactory } from "../gl/GLStage";
import { pointsFrom, spriteMaterial } from "../gl/points";
import { hexToRgb, TAU } from "../lib/loop";
import { gauss, mulberry32 } from "../lib/random";
import { landMask, sampleLand } from "./landmask";

export const globeSchema = z.object({
  land: z.string(),
  ocean: z.string(),
  twinkle: z.string(),
  shell: z.string(),
  streak: z.string(),
  speckA: z.string(),
  speckB: z.string(),
  speckC: z.string(),
  glow: z.string(),
  background: z.string(),
});
export type GlobeProps = z.infer<typeof globeSchema>;

const FOV = 35;
const CAM_DIST = 3.7;
const GLOBE_N = 220000;
const SHELL_N = 40000;
const SHELL_R = [1.18, 1.42];
const SHELL_THICK = [0.012, 0.03];
const STREAKS = 350;
const SPECKS = 45000;
const AXIAL_TILT = (23.4 * Math.PI) / 180;
const BASE_LON = (-25 * Math.PI) / 180; // longitude facing the camera
const BASE_LAT = (12 * Math.PI) / 180;

type GlobeData = {
  globe: { pos: Float32Array; kind: Float32Array; tw: Float32Array };
  shells: { pos: Float32Array }[];
  streaks: { dir: Float32Array; par: Float32Array; corner: Float32Array; index: Uint32Array };
  specks: { pos: Float32Array; col: Float32Array; tw: Float32Array };
};

const randomOnSphere = (rng: () => number) => {
  const z = rng() * 2 - 1;
  const a = rng() * TAU;
  const r = Math.sqrt(1 - z * z);
  return [r * Math.cos(a), z, r * Math.sin(a)];
};

let cache: GlobeData | null = null;
const data = (): GlobeData => {
  if (cache) return cache;
  const mask = landMask();
  const rng = mulberry32(0x910be);

  // Globe: land 3x denser than ocean, radial jitter for a misty edge.
  const gp: number[] = [];
  const gk: number[] = [];
  const gt: number[] = [];
  while (gk.length < GLOBE_N) {
    const [x, y, z] = randomOnSphere(rng);
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lon = (Math.atan2(x, z) * 180) / Math.PI;
    const isLand = sampleLand(mask, lat, lon) > 0.5;
    if (!isLand && rng() > 1 / 3) continue;
    const jitter = 1 + Math.max(-1, Math.min(1, gauss(rng) * 0.45)) * 0.02;
    gp.push(x * jitter, y * jitter, z * jitter);
    const tw = rng() < 0.03;
    gk.push(tw ? 2 : isLand ? 1 : 0);
    gt.push(1 + Math.floor(rng() * 4), rng(), 0.7 + rng() * 0.6);
  }

  const shells = SHELL_R.map((r, si) => {
    const pos = new Float32Array(SHELL_N * 3);
    for (let i = 0; i < SHELL_N; i++) {
      const [x, y, z] = randomOnSphere(rng);
      const j = r * (1 + gauss(rng) * SHELL_THICK[si] * 0.5);
      pos.set([x * j, y * j, z * j], i * 3);
    }
    return { pos };
  });

  // Streaks: camera-facing quads, 4 vertices each, corner = (along, side).
  const dir = new Float32Array(STREAKS * 4 * 3);
  const par = new Float32Array(STREAKS * 4 * 4);
  const corner = new Float32Array(STREAKS * 4 * 2);
  const index = new Uint32Array(STREAKS * 6);
  for (let i = 0; i < STREAKS; i++) {
    const d = randomOnSphere(rng);
    const p = [1 + Math.floor(rng() * 3), rng(), 0.1 + rng() * 0.5, 0.6 + rng() * 0.9];
    const cs = [[0, -1], [0, 1], [1, -1], [1, 1]];
    for (let k = 0; k < 4; k++) {
      dir.set(d, (i * 4 + k) * 3);
      par.set(p, (i * 4 + k) * 4);
      corner.set(cs[k], (i * 4 + k) * 2);
    }
    index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
  }

  // Background specks in a shell 4..12 from the centre.
  const sp = new Float32Array(SPECKS * 3);
  const sc = new Float32Array(SPECKS);
  const st = new Float32Array(SPECKS * 3);
  for (let i = 0; i < SPECKS; i++) {
    const [x, y, z] = randomOnSphere(rng);
    const r = 4 + Math.pow(rng(), 0.7) * 8;
    sp.set([x * r, y * r, z * r], i * 3);
    sc[i] = Math.floor(rng() * 3);
    st.set([1 + Math.floor(rng() * 3), rng(), 0.35 + Math.pow(rng(), 3) * 1.6], i * 3);
  }

  cache = {
    globe: { pos: new Float32Array(gp), kind: new Float32Array(gk), tw: new Float32Array(gt) },
    shells,
    streaks: { dir, par, corner, index },
    specks: { pos: sp, col: sc, tw: st },
  };
  return cache;
};

const GLOBE_VERT = /* glsl */ `
attribute float aKind;
attribute vec3 aTw;
uniform vec3 uLand;
uniform vec3 uOcean;
uniform vec3 uTwk;
uniform float uGain;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 col = aKind > 1.5 ? uTwk * (0.4 + 2.2 * pow(0.5 + 0.5 * sin(TAU * (aTw.x * uTime + aTw.y)), 6.0))
           : (aKind > 0.5 ? uLand * 0.6 : uOcean * 0.45);
  // Hollow look: the face toward the camera is darker than the limb.
  vec3 wn = normalize(mat3(modelMatrix) * position);
  vec3 wp = (modelMatrix * vec4(position, 1.0)).xyz;
  float face = abs(dot(wn, normalize(cameraPosition - wp)));
  // Dim toward the limb so the projected pile-up of dots stays a soft edge.
  col *= mix(0.3, 0.62, smoothstep(0.0, 0.45, face));
  sprite(mv, 0.0105 * aTw.z * (aKind > 1.5 ? 1.5 : 1.0), col * uGain);
}
`;

const SHELL_VERT = /* glsl */ `
uniform vec3 uShell;
uniform float uGain;
uniform float uOuter;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vec3 n = normalize(world.xyz);
  vec3 v = normalize(cameraPosition - world.xyz);
  float rim = 1.0 - abs(dot(n, v));
  float k = 0.04 + 1.0 * pow(rim, 9.0);
  vec4 mv = viewMatrix * world;
  float outer = step(1.3, length(position));
  sprite(mv, 0.009 * (1.0 + outer), uShell * k * uGain * mix(1.0, uOuter, outer));
}
`;

const SPECK_VERT = /* glsl */ `
attribute float aCol;
attribute vec3 aTw;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uC;
uniform float uGain;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vec3 col = aCol < 0.5 ? uA : (aCol < 1.5 ? uB : uC);
  float tw = 0.6 + 0.8 * pow(0.5 + 0.5 * sin(TAU * (aTw.x * uTime + aTw.y)), 4.0);
  sprite(mv, 0.04 * aTw.z, col * tw * uGain);
}
`;

const STREAK_VERT = /* glsl */ `
attribute vec3 aDir;
attribute vec4 aPar;    // trips per loop, phase, length, brightness
attribute vec2 aCorner; // along (0 tail .. 1 head), side (-1..1)
uniform float uTime;
uniform vec2 uRes;
uniform float uPx;
uniform float uRmax;
varying vec2 vUv;
varying float vI;
void main() {
  float s = fract(aPar.y + aPar.x * uTime);
  float head = 0.05 + s * uRmax;
  float len = aPar.z;
  float tail = max(head - len, 0.0);
  vec3 pT = aDir * tail;
  vec3 pH = aDir * head;
  vec4 cT = projectionMatrix * modelViewMatrix * vec4(pT, 1.0);
  vec4 cH = projectionMatrix * modelViewMatrix * vec4(pH, 1.0);
  vec2 sT = cT.xy / cT.w * uRes * 0.5;
  vec2 sH = cH.xy / cH.w * uRes * 0.5;
  vec2 dir = sH - sT;
  float slen = length(dir);
  vec2 nrm = slen > 1e-4 ? vec2(-dir.y, dir.x) / slen : vec2(0.0, 1.0);
  float wTrue = 3.4 * uPx;
  float w = max(wTrue, 1.3);
  vec4 c = aCorner.x < 0.5 ? cT : cH;
  vec2 sc = (aCorner.x < 0.5 ? sT : sH) + nrm * aCorner.y * w;
  gl_Position = vec4(sc / (uRes * 0.5) * c.w, c.z, c.w);
  vUv = aCorner;
  float life = 0.8 * smoothstep(0.3, 0.8, head) * (1.0 - smoothstep(0.7, 1.0, s));
  vI = aPar.w * life * (wTrue / w) * step(0.0, cT.w) * step(0.0, cH.w);
}
`;

const STREAK_FRAG = /* glsl */ `
uniform vec3 uCol;
varying vec2 vUv;
varying float vI;
void main() {
  float along = pow(sin(3.14159265 * vUv.x), 1.5) * (0.35 + 0.65 * vUv.x);
  float across = 1.0 - smoothstep(0.0, 1.0, abs(vUv.y));
  gl_FragColor = vec4(uCol * vec3(0.75, 0.9, 1.0) * vI * along * across, 1.0);
}
`;

export const makeGlobe =
  (p: GlobeProps): LookFactory =>
  (ctx) => {
    const D = data();
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(FOV, ctx.width / ctx.height, 0.02, 100);
    const v3 = (h: string) => new THREE.Vector3(...hexToRgb(h));
    const base = { px: ctx.px, height: ctx.height, fovDeg: FOV };
    const focus = CAM_DIST - 1;

    const globeMat = spriteMaterial(
      GLOBE_VERT,
      { uLand: { value: v3(p.land) }, uOcean: { value: v3(p.ocean) }, uTwk: { value: v3(p.twinkle) }, uGain: { value: 0.32 } },
      { ...base, focus, aperture: 24, maxPx: 60 },
    );
    const globe = pointsFrom(
      { position: { array: D.globe.pos, size: 3 }, aKind: { array: D.globe.kind, size: 1 }, aTw: { array: D.globe.tw, size: 3 } },
      globeMat,
    );
    globe.matrixAutoUpdate = false;
    scene.add(globe);

    const shellMat = spriteMaterial(SHELL_VERT, { uShell: { value: v3(p.shell) }, uGain: { value: 0.75 }, uOuter: { value: 1.0 } }, { ...base, focus, aperture: 16, maxPx: 60 });
    D.shells.forEach((s) => scene.add(pointsFrom({ position: { array: s.pos, size: 3 } }, shellMat)));

    const speckMat = spriteMaterial(
      SPECK_VERT,
      { uA: { value: v3(p.speckA) }, uB: { value: v3(p.speckB) }, uC: { value: v3(p.speckC) }, uGain: { value: 0.8 } },
      { ...base, focus, aperture: 14, maxPx: 80 },
    );
    scene.add(pointsFrom({ position: { array: D.specks.pos, size: 3 }, aCol: { array: D.specks.col, size: 1 }, aTw: { array: D.specks.tw, size: 3 } }, speckMat));

    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(STREAKS * 4 * 3), 3));
    sg.setAttribute("aDir", new THREE.BufferAttribute(D.streaks.dir, 3));
    sg.setAttribute("aPar", new THREE.BufferAttribute(D.streaks.par, 4));
    sg.setAttribute("aCorner", new THREE.BufferAttribute(D.streaks.corner, 2));
    sg.setIndex(new THREE.BufferAttribute(D.streaks.index, 1));
    const streakMat = new THREE.ShaderMaterial({
      vertexShader: STREAK_VERT,
      fragmentShader: STREAK_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uRes: { value: new THREE.Vector2(ctx.width, ctx.height) },
        uPx: { value: ctx.px },
        uRmax: { value: 5.0 },
        uCol: { value: v3(p.streak) },
      },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const streaks = new THREE.Mesh(sg, streakMat);
    streaks.frustumCulled = false;
    scene.add(streaks);

    const post = {
      background: hexToRgb(p.background),
      glows: [
        { center: [0.5, 0.5] as [number, number], radius: [0.75, 0.75] as [number, number], color: hexToRgb(p.glow), strength: 0.8, falloff: 2 },
        { center: [0.5, 0.5] as [number, number], radius: [1.2, 0.9] as [number, number], color: hexToRgb(p.speckA), strength: 0.035, falloff: 2 },
      ],
      bloomStrength: 0.5,
      vignette: 0.45,
      vignetteColor: hexToRgb(p.background),
      grain: 0.015,
    };

    const tiltAxis = new THREE.Vector3(Math.sin(AXIAL_TILT), Math.cos(AXIAL_TILT), 0);
    const qTilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -AXIAL_TILT);
    const qFace = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(1, 0, 0), BASE_LAT)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -BASE_LON));
    const q = new THREE.Quaternion();
    const mats = [globeMat, shellMat, speckMat, streakMat];
    return {
      scene,
      camera,
      post,
      update: (f) => {
        const t = f / 600;
        const yaw = ((10 * Math.PI) / 180) * Math.sin(TAU * t);
        const pitch = ((5 * Math.PI) / 180) * Math.cos(TAU * t);
        camera.position.set(
          CAM_DIST * Math.sin(yaw) * Math.cos(pitch),
          CAM_DIST * Math.sin(pitch),
          CAM_DIST * Math.cos(yaw) * Math.cos(pitch),
        );
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        const sway = ((8 * Math.PI) / 180) * Math.sin(TAU * t);
        q.setFromAxisAngle(tiltAxis, sway).multiply(qTilt).multiply(qFace);
        globe.matrix.makeRotationFromQuaternion(q);
        mats.forEach((m) => (m.uniforms.uTime.value = t));
      },
      dispose: () => {
        mats.forEach((m) => m.dispose());
        sg.dispose();
      },
    };
  };

import { useCallback } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { makeStudioEnv } from "../android/head";
import { GLStage, SceneFactory } from "../lib/GLStage";
import { PostChain, PostOptions } from "../lib/post";
import { mulberry32, TAU } from "../lib/random";
import { Painter } from "./painter";
import { Led, PANEL_W, paintLff, paintSff, U, UNIT_TYPES, UnitType } from "./units";

// Look 3 — Server Rack close-ups. One periodic rack scene: a column of 18
// units (height H) repeated vertically, two racks side by side repeated
// horizontally (period W). Each version moves its camera by exactly one
// period in 600 frames, so frame 600 = frame 0.

export const RACK_LOOP = 600;
const M = 0.001; // panel units -> world
const RACK_PITCH = (PANEL_W + 2 * 46 + 30) * M; // one rack + posts + gap
const RACKS = 2;
const W = RACK_PITCH * RACKS;

// Column composition (same counts in every rack, so every column has the
// same height H): 1 switch, 2 storage, 1 PSU, 1 blank, 13 servers.
const makeColumn = (seed: number) => {
  const rnd = mulberry32(seed);
  const pool = [
    "w1", "s2", "s2", "p2", "b1",
    "s1", "s1", "s1", "s1", "s1", "s1", "s1", "s1",
    "s3", "s3", "s3", "s3", "s3",
  ];
  // Seeded shuffle, repeated until no two neighbours (including across
  // the column wrap) are the same type.
  for (let attempt = 0; attempt < 500; attempt++) {
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    if (pool.every((id, i) => id !== pool[(i + 1) % pool.length])) break;
  }
  let y = 0;
  return pool.map((id) => {
    const t = UNIT_TYPES[id];
    const u = { type: t, top: y };
    y += t.heightU * U;
    return u;
  });
};
const COLUMNS = [makeColumn(1183), makeColumn(4062)];
const H = COLUMNS[0].reduce((a, u) => a + u.type.heightU * U, 0) * M;

// Each column holds one switch. Rack 2's column is shifted down (a pure
// phase shift of the periodic column) so its switch sits exactly H/2 below
// rack 1's. The diagonal glide moves (W, H) per loop, i.e. one rack pitch
// per H/2, so it can cross both switches head-on.
const switchTop = (r: number) => COLUMNS[r].find((u) => u.type.ports.length)!.top * M;
const RACK_SHIFT = [0, (((switchTop(0) + H / 2 - switchTop(1)) % H) + H) % H];
// Centre of the cable mass above the switch of rack 0 (copy 0, 0).
const SWITCH0 = {
  x: (560 - PANEL_W / 2) * M,
  y: -switchTop(0) - 0.05 + 0.2,
};

export type RackVersion = "front" | "diagonal" | "low";

type CamCfg = {
  copiesX: [number, number];
  copiesY: [number, number];
  fov: number;
  pose: (t: number, cam: THREE.PerspectiveCamera) => void;
  focus: (cam: THREE.PerspectiveCamera) => number;
  post: Partial<PostOptions> & { dof: NonNullable<PostOptions["dof"]> };
  exposure?: number;
  ledGain?: number; // LED brightness and glow size multiplier
  bloom?: number;
  haze?: { color: THREE.ColorRepresentation; density: number };
};

// Distance along the view axis to the rack face (z = 0) through the
// frame point (sx, sy) in NDC.
const faceDistance = (cam: THREE.PerspectiveCamera, sx = 0, sy = 0) => {
  const o = cam.position;
  const d = new THREE.Vector3(sx, sy, 0.5).unproject(cam).sub(o).normalize();
  const t = -o.z / d.z;
  const fwd = new THREE.Vector3();
  cam.getWorldDirection(fwd);
  return t * d.dot(fwd);
};

const CAMS: Record<RackVersion, CamCfg> = {
  // 3A: square-on, close; straight down by exactly H.
  front: {
    copiesX: [-1, 1],
    copiesY: [-1, 2],
    fov: 38,
    pose: (t, cam) => {
      cam.position.set(-0.04, -0.3 - H * t, 0.68);
      cam.rotation.set(0, 0, 0);
    },
    focus: (cam) => faceDistance(cam),
    post: { dof: { aperture: 25, maxCoc: 18, nearScale: 1.0, edge: 8 }, ca: 0 },
    exposure: 1.2,
  },
  // 3B: about 35 deg oblique, looking slightly down; glides by (W, -H).
  diagonal: {
    copiesX: [-1, 2],
    copiesY: [-1, 3],
    fov: 36,
    pose: (t, cam) => {
      // High, looking steeply down onto the rack faces. The point the view
      // centre lands on travels (W, -H) per loop and passes over the cable
      // mass of rack 1's switch at t = 0.25 and rack 2's at t = 0.75.
      cam.rotation.set(THREE.MathUtils.degToRad(-52), THREE.MathUtils.degToRad(-30), THREE.MathUtils.degToRad(30), "YXZ");
      cam.updateMatrixWorld();
      const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
      const gx = SWITCH0.x + W * (t - 0.25);
      const gy = SWITCH0.y - H * (t - 0.25);
      const dist = 0.62;
      cam.position.set(gx - fwd.x * dist, gy - fwd.y * dist, 0.035 - fwd.z * dist);
    },
    focus: (cam) => faceDistance(cam, 0.0, 0.0) - 0.06,
    post: { dof: { aperture: 28, maxCoc: 22, nearScale: 0.7 }, ca: 0 },
    exposure: 1.9,
  },
  // 3C: low, looking up along the face at about 20 deg; rises by H.
  low: {
    copiesX: [-1, 1],
    copiesY: [-1, 6],
    fov: 40,
    pose: (t, cam) => {
      cam.position.set(0.1, -0.9 + H * t, 0.3);
      // About 20 deg between the view axis and the rack face.
      cam.rotation.set(THREE.MathUtils.degToRad(68), 0, THREE.MathUtils.degToRad(-4), "YXZ");
    },
    focus: (cam) => faceDistance(cam, 0, -0.1),
    post: { dof: { aperture: 26, maxCoc: 20, nearScale: 0.9 }, ca: 2 },
    exposure: 0.8,
    ledGain: 2.6,
    bloom: 0.6,
    // Cool blue distance haze: the far racks fade into blue-lit darkness.
    haze: { color: "#16305A", density: 0.42 },
  },
};

const LED_COLORS: Record<string, [number, number, number]> = {
  red: [1.0, 0.0232, 0.0103], // #FF2A1A linear
  orange: [1.0, 0.2541, 0.0103], // #FF8A1A
  green: [0.0423, 0.8714, 0.1441], // #3AF06A
};
const MODE_ID = { steady: 0, blink: 1, flicker: 2, blip: 3 };
// Holds that divide 600 frames.
const HOLDS = [10, 12, 15, 20, 24, 25, 30, 40, 50, 60, 75];
const FLICKER_HOLDS = [2, 3, 4, 5, 6];

// LED state is a pure function of (frame % 600, seed) with an exact
// integer hash, so it is identical in any render order.
const LED_GLSL = /* glsl */ `
uniform float uFrame;
uniform float ledGain;
float ledHash(float a, float b) {
  uint h = uint(a) * 747796405u + uint(b) * 2891336453u + 12345u;
  h ^= h >> 16; h *= 2246822519u; h ^= h >> 13; h *= 3266489917u; h ^= h >> 16;
  return float(h) / 4294967295.0;
}
float ledOn(vec4 d) {
  // d: x colour, y mode, z hold, w seed
  float f = mod(uFrame, 600.0);
  float slot = floor(f / d.z);
  float r = ledHash(d.w, slot);
  if (d.y < 0.5) return 1.0;
  if (d.y < 1.5) return step(0.45, r);
  if (d.y < 2.5) return step(0.4, r) * (0.7 + 0.3 * ledHash(d.w + 7.0, slot));
  return 1.0 - step(0.82, r);
}
vec3 ledColor(float k) {
  if (k < 0.5) return vec3(${LED_COLORS.red.join(", ")});
  if (k < 1.5) return vec3(${LED_COLORS.orange.join(", ")});
  return vec3(${LED_COLORS.green.join(", ")});
}
`;

const LED_VERT = /* glsl */ `
attribute vec4 aLed;
varying vec4 vLed;
varying vec3 vN;
void main() {
  vLed = aLed;
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;
const LED_FRAG = /* glsl */ `
${LED_GLSL}
varying vec4 vLed;
varying vec3 vN;
void main() {
  float on = ledOn(vLed);
  vec3 c = ledColor(vLed.x);
  // Off LEDs are a dim coloured lens; on ones are hot.
  vec3 col = c * (0.05 + on * 9.0 * ledGain) + vec3(0.02) * (1.0 - on);
  gl_FragColor = vec4(col, 1.0);
}
`;
const GLOW_VERT = /* glsl */ `
attribute vec4 aLed;
uniform float glowSize;
varying vec4 vLed;
varying vec2 vUv;
void main() {
  vLed = aLed;
  vUv = position.xy * 2.0;
  vec4 c = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  float s = length(instanceMatrix[0].xyz);
  c.xy += position.xy * glowSize * s;
  c.z += 0.004;
  gl_Position = projectionMatrix * c;
}
`;
const GLOW_FRAG = /* glsl */ `
${LED_GLSL}
varying vec4 vLed;
varying vec2 vUv;
void main() {
  float on = ledOn(vLed);
  float r = length(vUv);
  // Hot core, then a wide faint spill that tints the metal around it.
  float a = (exp(-r * r * 120.0) * 1.4 + exp(-r * r * 22.0) * 0.22 + exp(-r * r * 5.0) * 0.07) * (1.0 - smoothstep(0.85, 1.0, r));
  gl_FragColor = vec4(ledColor(vLed.x) * a * on * 0.6 * ledGain, 1.0);
}
`;

type Placement = { type: UnitType; x: number; y: number; rack: number; copy: number };

const buildCables = (t: UnitType, seed: number) => {
  // Patch cables in panel-local world units: x right from the panel's left
  // edge, y up (panel y down is negative), z out of the face. Each blue
  // cable is a loop between two ports of the same switch: out of one port,
  // up in an arc in front of the units above, and back down into another,
  // so the loops pile up above the switch like a tidy bundle.
  const rnd = mulberry32(seed);
  const blue: THREE.BufferGeometry[] = [];
  const red: THREE.BufferGeometry[] = [];
  const plugs: THREE.BufferGeometry[] = [];
  const bootsBlue: THREE.BufferGeometry[] = [];
  const bootsRed: THREE.BufferGeometry[] = [];
  const plugLen = 0.026;
  const plugAt = (x0: number, y0: number, boots: THREE.BufferGeometry[]) => {
    // The clear plug sits in the port opening; the boot behind it.
    const plug = new THREE.BoxGeometry(0.0135, 0.0112, plugLen);
    plug.translate(x0, y0, plugLen / 2 - 0.006);
    plugs.push(plug);
    // Latch clip on the top of the plug.
    const clip = new THREE.BoxGeometry(0.006, 0.0022, plugLen * 0.75);
    clip.rotateX(-0.12);
    clip.translate(x0, y0 + 0.0062, plugLen / 2 - 0.004);
    plugs.push(clip);
    const boot = new THREE.CylinderGeometry(0.0095, 0.0105, 0.026, 12);
    boot.rotateX(Math.PI / 2);
    boot.translate(x0, y0, plugLen - 0.006 + 0.01);
    boots.push(boot);
  };
  const z0 = plugLen + 0.012;
  const loops = 6 + Math.floor(rnd() * 2); // 6-7 loops = 12-14 plugged ports
  const top = t.ports.filter((p) => p.y < 50);
  const bottom = t.ports.filter((p) => p.y >= 50);
  const free = [...top, ...bottom];
  const take = (pool: { x: number; y: number }[]) => {
    const avail = pool.filter((p) => free.includes(p));
    const p = avail[Math.floor(rnd() * avail.length)];
    free.splice(free.indexOf(p), 1);
    return p;
  };
  // Neighbouring top-row ports are paired, so the loops stand tall and
  // nearly parallel, like a curtain over the switch.
  const order = [...top].sort((p, q) => p.x - q.x);
  const startAt = Math.floor(rnd() * Math.max(1, order.length - loops * 2 + 1));
  void take;
  for (let k = 0; k < loops; k++) {
    const a = order[startAt + k * 2];
    const b = order[startAt + k * 2 + 1];
    if (!a || !b) break;
    const ax = a.x * M, ay = -a.y * M, bx = b.x * M, by = -b.y * M;
    const mid = (ax + bx) / 2 + (rnd() - 0.5) * 0.012;
    const h = 0.26 + rnd() * 0.16; // tall: the tops run out of frame
    const out = 0.045 + rnd() * 0.03;
    const lean = (rnd() - 0.5) * 0.015;
    const pts = [
      new THREE.Vector3(ax, ay, z0),
      new THREE.Vector3(ax, ay + 0.012, z0 + 0.02),
      new THREE.Vector3(ax - 0.006 + lean * 0.3, ay + h * 0.45, z0 + out),
      // A round crown: three points around the top of the loop.
      new THREE.Vector3(ax + (mid - ax) * 0.08 + lean * 0.8, Math.max(ay, by) + h * 0.9, z0 + out * 0.88),
      new THREE.Vector3(mid + lean, Math.max(ay, by) + h, z0 + out * 0.8),
      new THREE.Vector3(bx + (mid - bx) * 0.08 + lean * 0.8, Math.max(ay, by) + h * 0.9, z0 + out * 0.88),
      new THREE.Vector3(bx + 0.006 + lean * 0.3, by + h * 0.45, z0 + out),
      new THREE.Vector3(bx, by + 0.012, z0 + 0.02),
      new THREE.Vector3(bx, by, z0),
    ];
    const curve = new THREE.CatmullRomCurve3(pts, false, "centripetal");
    blue.push(new THREE.TubeGeometry(curve, 128, 0.0085, 10, false));
    plugAt(ax, ay, bootsBlue);
    plugAt(bx, by, bootsBlue);
  }
  // One red cable from the uplink port, rising up the side and out of the
  // frame above (it is routed to the next rack).
  for (const sp of t.spare) {
    const x0 = sp.x * M, y0 = -sp.y * M;
    const pts = [
      new THREE.Vector3(x0, y0, z0),
      new THREE.Vector3(x0, y0, z0 + 0.03),
      new THREE.Vector3(x0 + 0.012, y0 + 0.045, z0 + 0.045),
      new THREE.Vector3(x0 + 0.045, y0 + 0.1, 0.045),
      new THREE.Vector3(x0 + 0.075, y0 + 0.13, 0.0),
      new THREE.Vector3(x0 + 0.085, y0 + 0.16, -0.06),
    ];
    red.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, "centripetal"), 72, 0.0068, 10, false));
    plugAt(x0, y0, bootsRed);
  }
  return {
    blue: mergeGeometries(blue),
    red: mergeGeometries(red),
    plugs: mergeGeometries(plugs),
    bootsBlue: mergeGeometries(bootsBlue),
    bootsRed: mergeGeometries(bootsRed),
  };
};

const handleGeometry = () => {
  const bar = new THREE.BoxGeometry(1, 1, 0.3);
  bar.translate(0, 0, 0.85);
  const a = new THREE.BoxGeometry(0.12, 1, 0.8);
  a.translate(-0.44, 0, 0.4);
  const b = new THREE.BoxGeometry(0.12, 1, 0.8);
  b.translate(0.44, 0, 0.4);
  return mergeGeometries([bar, a, b]);
};

const makeFactory =
  (version: RackVersion): SceneFactory<null> =>
  ({ renderer, width, height }) => {
    const cfg = CAMS[version];
    const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    const q = Math.min(1, Math.max(0.32, (height / 2160) * 1.15));
    const scene = new THREE.Scene();
    const env = makeStudioEnv(
      renderer,
      [
        { pos: [-3, 5, 4], size: [1.2, 7], color: 0xd8e4ff, intensity: 1.6 },
        { pos: [4, 2, 5], size: [0.8, 6], color: 0xffffff, intensity: 0.9 },
      ],
      0x020203,
    );
    scene.environment = env;

    // Faceplate textures, built once.
    const faceMats: Record<string, THREE.MeshStandardMaterial> = {};
    const s = Math.min(4096 / PANEL_W, 3.8 * q);
    for (const t of Object.values(UNIT_TYPES)) {
      const p = new Painter(PANEL_W, t.heightU * U, s);
      t.paint(p);
      const tex = p.textures(aniso, 3.0);
      faceMats[t.id] = new THREE.MeshStandardMaterial({
        ...tex,
        metalness: 0.35,
        roughness: 1,
        envMapIntensity: 0.8,
        normalScale: new THREE.Vector2(1, 1),
      });
    }
    const caddyMat = (paint: (p: Painter) => void, w: number, h: number) => {
      const p = new Painter(w, h, Math.min(8, 4.6 * q));
      paint(p);
      return new THREE.MeshStandardMaterial({ ...p.textures(aniso, 3.0), metalness: 0.6, roughness: 1, envMapIntensity: 1.0 });
    };
    const lffMat = caddyMat(paintLff, 80, 182);
    const sffMat = caddyMat(paintSff, 80, 84);

    const gunmetal = new THREE.MeshStandardMaterial({ color: "#2A2C30", metalness: 0.7, roughness: 0.42 });
    const silver = new THREE.MeshStandardMaterial({ color: "#8E929A", metalness: 1, roughness: 0.5, envMapIntensity: 0.55 });

    // Placements.
    const placements: Placement[] = [];
    for (let cx = cfg.copiesX[0]; cx <= cfg.copiesX[1]; cx++)
      for (let cy = cfg.copiesY[0] - 1; cy <= cfg.copiesY[1]; cy++)
        for (let r = 0; r < RACKS; r++)
          for (const u of COLUMNS[r]) {
            placements.push({
              type: u.type,
              x: cx * W + r * RACK_PITCH - (PANEL_W * M) / 2,
              y: -(cy * H) - u.top * M - RACK_SHIFT[r],
              rack: r,
              copy: cx * 31 + cy,
            });
          }

    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(-24));
    const rotZ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    const ident = new THREE.Quaternion();

    const instanced = (geo: THREE.BufferGeometry, mat: THREE.Material, mats: THREE.Matrix4[]) => {
      const m = new THREE.InstancedMesh(geo, mat, Math.max(1, mats.length));
      mats.forEach((x, i) => m.setMatrixAt(i, x));
      m.count = mats.length;
      m.frustumCulled = false;
      scene.add(m);
      return m;
    };
    const M4 = (x: number, y: number, z: number, sx: number, sy: number, sz: number, qq = ident) =>
      new THREE.Matrix4().compose(pos.set(x, y, z), qq, scl.set(sx, sy, sz));

    // Chassis (bevelled) and faceplates.
    const chassis1: THREE.Matrix4[] = [];
    const chassis2: THREE.Matrix4[] = [];
    const faces: Record<string, THREE.Matrix4[]> = {};
    const fins: THREE.Matrix4[] = [];
    const handles: THREE.Matrix4[] = [];
    const lff: THREE.Matrix4[] = [];
    const sff: THREE.Matrix4[] = [];
    const leds: { m: THREE.Matrix4; d: [number, number, number, number] }[] = [];
    const switches: { x: number; y: number; rack: number }[] = [];
    let ledSeed = 1;
    for (const pl of placements) {
      const t = pl.type;
      const hU = t.heightU * U * M;
      const cx = pl.x + (PANEL_W * M) / 2;
      const cy = pl.y - hU / 2;
      (t.heightU === 1 ? chassis1 : chassis2).push(M4(cx, cy, -0.2, 1, 1, 1));
      (faces[t.id] ??= []).push(M4(cx, cy, 0.0012, PANEL_W * M, hU - 0.0016, 1));
      const at = (x: number, y: number) => [pl.x + x * M, pl.y - y * M] as const;
      for (const f of t.fins) {
        const gap = f.h / f.n;
        for (let i = 0; i < f.n; i++) {
          const [x, y] = at(f.x + f.w / 2, f.y + gap * (i + 0.5));
          fins.push(M4(x, y, 0.011, f.w * M, gap * 0.42 * M, 0.026, tilt));
        }
      }
      for (const h of t.handles) {
        const [x, y] = at(h.x + h.w / 2, h.y + h.h / 2);
        if (h.vertical) handles.push(M4(x, y, 0.001, h.h * M, 0.007, 0.02, rotZ));
        else handles.push(M4(x, y + 0.012, 0.001, h.w * M, 0.0075, 0.022));
      }
      for (const c of t.caddies) {
        const [x, y] = at(c.x + c.w / 2, c.y + c.h / 2);
        (c.variant === "lff" ? lff : sff).push(M4(x, y, 0.003, c.w * M - 0.001, c.h * M - 0.001, 0.008));
      }
      const leds0: Led[] = t.leds;
      for (const l of leds0) {
        const [x, y] = at(l.x, l.y);
        const sz = (l.size ?? 1) * 0.0026;
        const hold =
          l.mode === "flicker"
            ? FLICKER_HOLDS[(ledSeed * 7) % FLICKER_HOLDS.length]
            : HOLDS[(ledSeed * 13) % HOLDS.length];
        leds.push({
          m: M4(x, y, 0.0035, sz, sz, 0.002),
          d: [l.kind === "red" ? 0 : l.kind === "orange" ? 1 : 2, MODE_ID[l.mode], hold, ledSeed * 101 + pl.copy],
        });
        ledSeed++;
      }
      if (t.ports.length) switches.push({ x: pl.x, y: pl.y, rack: pl.rack });
    }
    const box = new THREE.BoxGeometry(1, 1, 1);
    instanced(new RoundedBoxGeometry(PANEL_W * M, U * M - 0.0012, 0.4, 2, 0.004), gunmetal, chassis1);
    instanced(new RoundedBoxGeometry(PANEL_W * M, 2 * U * M - 0.0012, 0.4, 2, 0.004), gunmetal, chassis2);
    const plane = new THREE.PlaneGeometry(1, 1);
    for (const [id, mats] of Object.entries(faces)) instanced(plane, faceMats[id], mats);
    instanced(box, silver, fins);
    instanced(handleGeometry(), silver, handles);
    instanced(box, lffMat, lff);
    instanced(box, sffMat, sff);

    // Rack posts (rails with square holes) and the dark gap.
    const postPaint = new Painter(46, U, Math.min(8, 4 * q));
    postPaint.rect(0, 0, 46, U, { color: "#1E2024", rough: 0.45, height: 0.5 });
    for (const y of [16, 50, 84]) postPaint.rect(16, y - 5, 12, 10, { color: "#020203", rough: 0.9, height: 0.05 });
    const postTex = postPaint.textures(aniso, 2.5);
    const nCopiesY = cfg.copiesY[1] - cfg.copiesY[0] + 1;
    for (const k of Object.values(postTex)) {
      k.wrapS = k.wrapT = THREE.RepeatWrapping;
      k.repeat.set(1, (nCopiesY * H) / (U * M));
    }
    const postMat = new THREE.MeshStandardMaterial({ ...postTex, metalness: 0.6, roughness: 1 });
    const posts: THREE.Matrix4[] = [];
    const postH = nCopiesY * H;
    const postY = -(cfg.copiesY[0] * H + (cfg.copiesY[1] + 1) * H) / 2;
    for (let cx = cfg.copiesX[0]; cx <= cfg.copiesX[1] + 1; cx++)
      for (let r = 0; r < RACKS; r++) {
        const x0 = cx * W + r * RACK_PITCH;
        for (const side of [-1, 1]) posts.push(M4(x0 + side * ((PANEL_W / 2 + 23) * M), postY, -0.004, 0.046, postH, 0.01));
      }
    instanced(box, postMat, posts);
    // Back wall of the gaps: almost black.
    const back = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: "#050506", roughness: 0.9 }));
    back.position.z = -0.4;
    scene.add(back);

    // LEDs and their glows.
    const ledGeo = new THREE.CylinderGeometry(1, 1, 1, 16);
    ledGeo.rotateX(Math.PI / 2);
    const ledAttr = new Float32Array(leds.length * 4);
    leds.forEach((l, i) => ledAttr.set(l.d, i * 4));
    const ledUniforms = { uFrame: { value: 0 }, glowSize: { value: 16 * (cfg.ledGain ?? 1) }, ledGain: { value: cfg.ledGain ?? 1 } };
    const ledMesh = new THREE.InstancedMesh(
      ledGeo,
      new THREE.ShaderMaterial({ vertexShader: LED_VERT, fragmentShader: LED_FRAG, uniforms: ledUniforms }),
      leds.length,
    );
    leds.forEach((l, i) => ledMesh.setMatrixAt(i, l.m));
    ledMesh.geometry.setAttribute("aLed", new THREE.InstancedBufferAttribute(ledAttr, 4));
    ledMesh.frustumCulled = false;
    scene.add(ledMesh);
    const glowGeo = new THREE.PlaneGeometry(1, 1);
    glowGeo.setAttribute("aLed", new THREE.InstancedBufferAttribute(ledAttr, 4));
    const glowMesh = new THREE.InstancedMesh(
      glowGeo,
      new THREE.ShaderMaterial({
        vertexShader: GLOW_VERT,
        fragmentShader: GLOW_FRAG,
        uniforms: ledUniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      leds.length,
    );
    leds.forEach((l, i) => glowMesh.setMatrixAt(i, l.m));
    glowMesh.frustumCulled = false;
    scene.add(glowMesh);

    // Patch cables on the switches: two bundle variants (one per rack).
    const cableBlue = new THREE.MeshStandardMaterial({ color: "#2A4A9A", roughness: 0.7, metalness: 0.0, envMapIntensity: 0.4 });
    const cableRed = new THREE.MeshStandardMaterial({ color: "#B3201A", roughness: 0.42, metalness: 0.0, envMapIntensity: 1.2 });
    const plugMat = new THREE.MeshPhysicalMaterial({
      color: "#C8D4E0",
      roughness: 0.15,
      metalness: 0,
      transparent: true,
      opacity: 0.55,
      clearcoat: 1,
      depthWrite: false,
    });
    const variants = [buildCables(UNIT_TYPES.w1, 71), buildCables(UNIT_TYPES.w1, 93)];
    for (let r = 0; r < RACKS; r++) {
      const mats = switches.filter((sw) => sw.rack === r).map((sw) => M4(sw.x, sw.y, 0, 1, 1, 1));
      const v = variants[r];
      instanced(v.blue, cableBlue, mats);
      instanced(v.bootsBlue, cableBlue, mats);
      instanced(v.red, cableRed, mats);
      instanced(v.bootsRed, cableRed, mats);
      instanced(v.plugs, plugMat, mats).renderOrder = 2;
    }

    // Lights: dark room, soft cool key from the upper left, a narrow
    // highlight that slides along the rack, and a dim fill.
    const key = new THREE.DirectionalLight(0xe8ecf4, 1.6);
    key.position.set(-2, 3, 2.5);
    scene.add(key);
    const fill = new THREE.HemisphereLight(0x8090a8, 0x050506, 0.12);
    scene.add(fill);
    const slide = new THREE.SpotLight(0xffffff, 0.9, 0, THREE.MathUtils.degToRad(30), 1.0, 1.0);
    scene.add(slide);
    scene.add(slide.target);

    if (cfg.haze) scene.fog = new THREE.FogExp2(new THREE.Color(cfg.haze.color).getHex(), cfg.haze.density);
    const camera = new THREE.PerspectiveCamera(cfg.fov, width / height, 0.02, 40);
    const post = new PostChain(renderer, width, height, {
      dof: cfg.post.dof,
      bloom: { threshold: 1.2, knee: 0.6, intensity: cfg.bloom ?? 0.38 },
      grade: { exposure: cfg.exposure ?? 1.15, tint: [1.0, 1.0, 1.01], lift: [0.003, 0.003, 0.004], saturation: 0.95, contrast: 1.1 },
      vignette: { strength: 0.62, radius: 0.32, softness: 0.75 },
      ca: cfg.post.ca ?? 0,
      grain: 0.015,
      loop: RACK_LOOP,
      clearColor: 0x020203,
    });

    return {
      render(frame) {
        const t = (frame % RACK_LOOP) / RACK_LOOP;
        cfg.pose(t, camera);
        camera.updateMatrixWorld();
        camera.updateProjectionMatrix();
        // The highlight slides across in front of the camera's view, one
        // whole cycle per loop.
        const fwd = new THREE.Vector3();
        camera.getWorldDirection(fwd);
        const look = camera.position.clone().add(fwd.multiplyScalar(faceDistance(camera)));
        slide.position.set(look.x + 0.9 * Math.sin(TAU * t), look.y + 0.5, 0.9);
        slide.target.position.set(look.x + 0.45 * Math.sin(TAU * t + 0.6), look.y - 0.05, 0);
        slide.target.updateMatrixWorld();
        ledUniforms.uFrame.value = frame % RACK_LOOP;
        post.render(scene, camera, frame, cfg.focus(camera));
      },
      dispose() {
        post.dispose();
      },
    };
  };

const factories: Record<RackVersion, SceneFactory<null>> = {
  front: makeFactory("front"),
  diagonal: makeFactory("diagonal"),
  low: makeFactory("low"),
};

export const RackScene = ({ version }: { version: RackVersion }) => {
  const load = useCallback(async () => null, []);
  return <GLStage load={load} factory={factories[version]} />;
};


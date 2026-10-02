import * as THREE from "three";
import { makeBackdrop } from "../engine/backdrop";
import { makeLines, Seg } from "../engine/lines";
import { mulberry32, range } from "../engine/random";
import { LookFactory } from "../engine/Stage";
import { TunnelColors } from "../versions";

// Look 2 - Neon Grid Tunnel.
// A square tunnel whose walls, floor and ceiling are grids of glowing tile
// outlines (bars) with a seeded pattern of brightness and gaps, a dimmer
// outer shell, and faint blurred squares in the dark beyond the walls.
//
// Loop: the tunnel is built from a repeating segment of length L and the
// camera travels exactly N*L in 600 frames. Roll sway is a whole sine cycle.

export type TunnelParams = { colors: TunnelColors };

const LOOP = 600;
const HALF = 3; // half size of the square cross-section
const CELLS = 8; // tiles across each face
const CELL = (HALF * 2) / CELLS;
const CELL_Z = 1.0; // tile length along the tunnel
const ROWS = 16; // rows per repeating segment
const L = ROWS * CELL_Z; // segment length
const N = 3; // segments travelled per loop
const COPIES = 7; // segments drawn ahead of the camera

type Face = { origin: THREE.Vector3; u: THREE.Vector3; n: THREE.Vector3 };
// Each face: a point at the face's (-u) edge, u = across direction, n = outward normal.
const FACES: Face[] = [
  { origin: new THREE.Vector3(-HALF, -HALF, 0), u: new THREE.Vector3(1, 0, 0), n: new THREE.Vector3(0, -1, 0) }, // floor
  { origin: new THREE.Vector3(-HALF, HALF, 0), u: new THREE.Vector3(1, 0, 0), n: new THREE.Vector3(0, 1, 0) }, // ceiling
  { origin: new THREE.Vector3(-HALF, -HALF, 0), u: new THREE.Vector3(0, 1, 0), n: new THREE.Vector3(-1, 0, 0) }, // left
  { origin: new THREE.Vector3(HALF, -HALF, 0), u: new THREE.Vector3(0, 1, 0), n: new THREE.Vector3(1, 0, 0) }, // right
];

type Bar = { a: THREE.Vector3; b: THREE.Vector3; level: number; accent: boolean; width: number };

// One segment of tunnel, seeded at module level.
const buildSegment = () => {
  const rng = mulberry32(0x7e11);
  const bars: Bar[] = [];
  const level = () => {
    const r = rng();
    if (r < 0.14) return 0; // missing
    if (r < 0.62) return range(rng, 0.22, 0.45);
    if (r < 0.86) return range(rng, 0.55, 0.9);
    return range(rng, 1.2, 1.9); // bright
  };
  const gap = 0.05;
  FACES.forEach((f) => {
    // Per-cell outward offset: some tiles sit deeper, which breaks the wall
    // into an uneven, layered surface like the reference.
    const depth: number[][] = [];
    for (let i = 0; i < CELLS; i++) {
      depth.push([]);
      for (let k = 0; k < ROWS; k++) {
        const r = rng();
        depth[i].push(r < 0.84 ? 0 : r < 0.95 ? 0.4 : 0.8);
      }
    }
    const P = (i: number, k: number, d: number) =>
      f.origin
        .clone()
        .addScaledVector(f.u, i * CELL)
        .add(new THREE.Vector3(0, 0, -k * CELL_Z))
        .addScaledVector(f.n, d);
    for (let i = 0; i < CELLS; i++) {
      for (let k = 0; k < ROWS; k++) {
        const d = depth[i][k];
        // across bar at the cell's near edge
        const l1 = level();
        if (l1 > 0) {
          const a = P(i, k, d).addScaledVector(f.u, gap);
          const b = P(i + 1, k, d).addScaledVector(f.u, -gap);
          bars.push({ a, b, level: l1, accent: rng() < 0.5, width: l1 > 1.1 ? 0.07 : 0.05 });
        }
        // along bar at the cell's -u edge
        const l2 = level();
        if (l2 > 0) {
          const a = P(i, k, d).add(new THREE.Vector3(0, 0, -gap));
          const b = P(i, k + 1, d).add(new THREE.Vector3(0, 0, gap));
          bars.push({ a, b, level: l2, accent: rng() < 0.5, width: l2 > 1.1 ? 0.07 : 0.05 });
        }
        // short step bars where neighbouring tiles sit at different depths
        const kn = (k + 1) % ROWS;
        if (depth[i][kn] !== d && rng() < 0.3) {
          const a = P(i, k + 1, d).addScaledVector(f.u, CELL * 0.5);
          const b = P(i, k + 1, depth[i][kn]).addScaledVector(f.u, CELL * 0.5);
          bars.push({ a, b, level: range(rng, 0.25, 0.6), accent: false, width: 0.06 });
        }
      }
    }
  });
  // Dim outer shell seen through the gaps.
  FACES.forEach((f) => {
    for (let i = -1; i <= CELLS + 1; i++) {
      for (let k = 0; k < ROWS; k++) {
        if (rng() < 0.75) continue;
        const o = f.origin
          .clone()
          .addScaledVector(f.n, 2.2)
          .addScaledVector(f.u, i * CELL * 1.2 - 0.6)
          .add(new THREE.Vector3(0, 0, -k * CELL_Z));
        const horiz = rng() < 0.5;
        const a = o.clone();
        const b = horiz ? o.clone().addScaledVector(f.u, CELL * 1.1) : o.clone().add(new THREE.Vector3(0, 0, -CELL_Z * 0.9));
        bars.push({ a, b, level: range(rng, 0.15, 0.4), accent: false, width: 0.08 });
      }
    }
  });
  // Faint blurred squares in the dark space beyond the walls.
  const haze: { c: THREE.Vector3; size: number; level: number; dir: THREE.Vector3 }[] = [];
  for (let h = 0; h < 240; h++) {
    const f = FACES[Math.floor(rng() * 4)];
    const out = range(rng, 0.6, 5.5);
    const across = range(rng, -2, CELLS * CELL + 2);
    const c = f.origin
      .clone()
      .addScaledVector(f.n, out)
      .addScaledVector(f.u, across)
      .add(new THREE.Vector3(0, 0, -range(rng, 0, L)));
    haze.push({ c, size: range(rng, 0.5, 1.5), level: range(rng, 0.06, 0.2), dir: f.u.clone() });
  }
  return { bars, haze };
};
const SEGMENT = buildSegment();

const BAR_MOD = /* glsl */ `
float lineMod(float u, vec4 p) {
  // slightly brighter towards the middle of a bar, like a neon tube
  return 0.8 + 0.2 * sin(3.14159 * u);
}
`;

// Soft square: gaussian across (softness 1) and soft ends along.
const HAZE_MOD = /* glsl */ `
float lineMod(float u, vec4 p) {
  return smoothstep(0.0, 0.35, u) * smoothstep(1.0, 0.65, u);
}
`;

export const tunnelLook: LookFactory<TunnelParams> = ({ params }) => {
  const c = params.colors;
  const bar = new THREE.Color(c.bar);
  const accent = new THREE.Color(c.accent);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, 16 / 9, 0.1, 140);

  const bg = makeBackdrop(
    /* glsl */ `
    uniform vec3 uBg;
    uniform vec3 uHaze;
    vec3 backdrop(vec2 uv, vec2 p) {
      // slightly lifted centre where the tunnel recedes
      float r = length(p * vec2(0.8, 1.0));
      return uBg * (1.0 + 0.8 * exp(-r * r * 5.0)) + uHaze * 0.05 * exp(-r * r * 8.0);
    }
  `,
    { uBg: { value: new THREE.Color(c.background) }, uHaze: { value: new THREE.Color(c.haze) } },
  );
  scene.add(bg);

  const world = new THREE.Group();
  scene.add(world);

  const barSegs: Seg[] = [];
  const hazeSegs: Seg[] = [];
  const accentRng = mulberry32(0xacc);
  for (let copy = 0; copy < COPIES; copy++) {
    const dz = -copy * L;
    SEGMENT.bars.forEach((b) => {
      const useAccent = b.level > 1.5 && b.accent && accentRng() < c.accentShare * 2;
      barSegs.push({
        a: [b.a.x, b.a.y, b.a.z + dz],
        b: [b.b.x, b.b.y, b.b.z + dz],
        color: useAccent ? accent : bar,
        intensity: b.level,
        widthA: b.width,
      });
    });
    SEGMENT.haze.forEach((h) => {
      const half = h.dir.clone().multiplyScalar(h.size / 2);
      hazeSegs.push({
        a: [h.c.x - half.x, h.c.y - half.y, h.c.z + dz],
        b: [h.c.x + half.x, h.c.y + half.y, h.c.z + dz],
        color: new THREE.Color(c.haze),
        intensity: h.level,
        widthA: h.size,
      });
    });
  }
  const hazeMesh = makeLines(hazeSegs, { worldWidth: true, softness: 1, feather: 1.6, lineMod: HAZE_MOD, fog: 0.02 });
  hazeMesh.renderOrder = 1;
  world.add(hazeMesh);
  const bars = makeLines(barSegs, {
    worldWidth: true,
    softness: 0.15,
    lineMod: BAR_MOD,
    fog: 0.016,
    minHalfPx: 0.6,
    dof: { focus: 7, range: 5, maxBlur: 0.007, nearOnly: true },
  });
  bars.renderOrder = 2;
  world.add(bars);

  const update = (frame: number) => {
    const t = (frame % LOOP) / LOOP;
    // Travel N*L per loop; segments are identical, so wrap by L.
    const travel = t * N * L;
    world.position.z = travel % L;
    const s = Math.sin(t * Math.PI * 2);
    const s2 = Math.sin(t * Math.PI * 4 + 0.7);
    camera.position.set(0.25 * s2, 0.12 * s, 0);
    camera.rotation.set(0, 0, THREE.MathUtils.degToRad(3.0) * s);
  };

  return { scene, camera, update };
};

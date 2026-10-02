import * as THREE from "three";
import { makeBackdrop } from "../engine/backdrop";
import { makeLines, Seg } from "../engine/lines";
import { mulberry32, range } from "../engine/random";
import { LookFactory } from "../engine/Stage";
import { TunnelColors } from "../versions";

// Look 2 - Neon Grid Tunnel.
// A tunnel whose walls, floor and ceiling are flat modules of glowing tile
// outlines (bars) with a seeded pattern of brightness, depth steps and gaps,
// plus a soft reflection of the grid in the glossy floor.
// HALF_X / HALF_Y set the cross-section: equal values give a square tunnel;
// the default is wider than tall, which matches the reference clip.
//
// Loop: the tunnel is built from a repeating segment of length L and the
// camera travels exactly N*L in 600 frames. Roll sway is a whole sine cycle.

export type TunnelParams = { colors: TunnelColors };

const LOOP = 600;
const HALF_X = 4.6; // half width of the cross-section
const HALF_Y = 2.6; // half height (set equal to HALF_X for a square tunnel)
const CELL = 0.95; // tile size across a face
const CELL_Z = 0.7; // tile length along the tunnel
const ROWS = 24; // rows per repeating segment
const L = ROWS * CELL_Z; // segment length
const N = 2; // segments travelled per loop
const COPIES = 5; // segments drawn ahead of the camera

type Face = { origin: THREE.Vector3; u: THREE.Vector3; n: THREE.Vector3 };
// Each face: a point at the face's (-u) edge, u = across direction, n = outward normal.
type FaceDef = Face & { cells: number };
const CX = Math.round((HALF_X * 2) / CELL);
const CY = Math.round((HALF_Y * 2) / CELL);
const FACES: FaceDef[] = [
  { origin: new THREE.Vector3(-HALF_X, -HALF_Y, 0), u: new THREE.Vector3(1, 0, 0), n: new THREE.Vector3(0, -1, 0), cells: CX }, // floor
  { origin: new THREE.Vector3(-HALF_X, HALF_Y, 0), u: new THREE.Vector3(1, 0, 0), n: new THREE.Vector3(0, 1, 0), cells: CX }, // ceiling
  { origin: new THREE.Vector3(-HALF_X, -HALF_Y, 0), u: new THREE.Vector3(0, 1, 0), n: new THREE.Vector3(-1, 0, 0), cells: CY }, // left
  { origin: new THREE.Vector3(HALF_X, -HALF_Y, 0), u: new THREE.Vector3(0, 1, 0), n: new THREE.Vector3(1, 0, 0), cells: CY }, // right
];

type Bar = { a: THREE.Vector3; b: THREE.Vector3; level: number; accent: boolean; width: number };

// One segment of tunnel, seeded at module level. Each face is tiled with
// flat modules (3 cells across x 4 rows) of closed rectangular cells. A
// module has its own depth step, brightness and may be missing entirely,
// which gives the stepped, uneven panelling and the dark gaps.
const MOD_U = 3;
const MOD_K = 4;
const buildSegment = () => {
  const rng = mulberry32(0x7e11);
  const bars: Bar[] = [];
  const inset = 0.06;
  FACES.forEach((f, fi) => {
    const sideWall = fi >= 2;
    for (let mu = 0; mu < f.cells; mu += MOD_U) {
      for (let mk = 0; mk < ROWS; mk += MOD_K) {
        const r = rng();
        if (r < 0.26) continue; // missing module: dark gap
        const depth = r < 0.7 ? 0 : r < 0.88 ? 0.2 : 0.42;
        const modLevel = rng() < 0.25 ? range(rng, 1.0, 1.4) : range(rng, 0.35, 0.65);
        const accent = rng() < 0.5;
        const P = (u: number, k: number) =>
          f.origin
            .clone()
            .addScaledVector(f.u, u)
            .add(new THREE.Vector3(0, 0, -k))
            .addScaledVector(f.n, depth);
        const u0 = mu * CELL + inset;
        const u1 = Math.min(mu + MOD_U, f.cells) * CELL - inset;
        const k0 = mk * CELL_Z + inset;
        const k1 = (mk + MOD_K) * CELL_Z - inset;
        const bar = (a: THREE.Vector3, b: THREE.Vector3, emph: boolean) => {
          if (rng() < 0.18) return; // some missing bars
          const hot = rng() < 0.12;
          const level = modLevel * (hot ? 2.2 : range(rng, 0.7, 1.1)) * (emph ? 1.25 : 1);
          bars.push({ a, b, level, accent, width: hot || emph ? 0.075 : 0.05 });
        };
        // across bars (vertical on the side walls: emphasised)
        for (let k = 0; k <= MOD_K; k++) {
          const kz = Math.min(k1, Math.max(k0, mk * CELL_Z + k * CELL_Z));
          bar(P(u0, kz), P(u1, kz), sideWall);
        }
        // along bars
        for (let u = 0; u <= Math.min(MOD_U, f.cells - mu); u++) {
          const uu = Math.min(u1, Math.max(u0, (mu + u) * CELL));
          bar(P(uu, k0), P(uu, k1), false);
        }
      }
    }
  });
  return { bars };
};
const SEGMENT = buildSegment();

const BAR_MOD = /* glsl */ `
float lineMod(float u, vec4 p) {
  // slightly brighter towards the middle of a bar, like a neon tube
  return 0.8 + 0.2 * sin(3.14159 * u);
}
`;


export const tunnelLook: LookFactory<TunnelParams> = ({ params }) => {
  const c = params.colors;
  const bar = new THREE.Color(c.bar);
  const accent = new THREE.Color(c.accent);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 140);

  const bg = makeBackdrop(
    /* glsl */ `
    uniform vec3 uBg;
    uniform vec3 uHaze;
    vec3 backdrop(vec2 uv, vec2 p) {
      // slightly lifted centre where the tunnel recedes
      float r = length(p * vec2(0.8, 1.0));
      return uBg * (0.6 + 0.8 * exp(-r * r * 6.0)) + uHaze * 0.02 * exp(-r * r * 12.0);
    }
  `,
    { uBg: { value: new THREE.Color(c.background) }, uHaze: { value: new THREE.Color(c.haze) } },
  );
  scene.add(bg);

  const world = new THREE.Group();
  scene.add(world);

  const barSegs: Seg[] = [];
  const reflSegs: Seg[] = [];
  const accentRng = mulberry32(0xacc);
  // Mirror across the floor plane: a soft, dim reflection seen through the
  // gaps of the floor grid (reads as a glossy dark floor).
  const mirrorY = (y: number) => -2 * HALF_Y - y;
  for (let copy = 0; copy < COPIES; copy++) {
    const dz = -copy * L;
    SEGMENT.bars.forEach((b) => {
      const useAccent = b.level > 1.2 && b.accent && accentRng() < c.accentShare * 2;
      const seg: Seg = {
        a: [b.a.x, b.a.y, b.a.z + dz],
        b: [b.b.x, b.b.y, b.b.z + dz],
        color: useAccent ? accent : bar,
        intensity: b.level,
        widthA: b.width,
      };
      barSegs.push(seg);
      if (b.a.y > -HALF_Y + 0.01 || b.b.y > -HALF_Y + 0.01) {
        reflSegs.push({
          ...seg,
          a: [b.a.x, mirrorY(b.a.y), b.a.z + dz],
          b: [b.b.x, mirrorY(b.b.y), b.b.z + dz],
          intensity: b.level * 0.22,
          widthA: b.width * 2.5,
        });
      }
    });
  }
  const refl = makeLines(reflSegs, { worldWidth: true, softness: 1, feather: 1.8, lineMod: BAR_MOD, fog: 0.05 });
  refl.renderOrder = 1;
  world.add(refl);
  const bars = makeLines(barSegs, {
    worldWidth: true,
    softness: 0.15,
    lineMod: BAR_MOD,
    fog: 0.05,
    minHalfPx: 0.6,
    dof: { focus: 7, range: 5, maxBlur: 0.005, nearOnly: true },
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
    camera.position.set(0.2 * s2, 0.3 + 0.08 * s, 0);
    camera.rotation.set(0, 0, THREE.MathUtils.degToRad(3.0) * s);
  };

  return { scene, camera, update };
};

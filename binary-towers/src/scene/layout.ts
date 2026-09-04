import { CELL_WORLD_H, CELL_WORLD_W, HEAD_PERIODS } from "../constants";
import { mulberry32, pick, range } from "../lib/random";
import { distanceToPathXZ } from "./cameraPath";

export type PlaneSpec = {
  /** Stable id, also the texture seed. */
  id: number;
  towerId: number;
  x: number;
  z: number;
  yaw: number;
  cols: number;
  visibleRows: number;
  width: number;
  height: number;
  /** Whole texture cycles travelled over the 360-frame loop (integer). */
  fallCycles: number;
  /** Texture-space phase offset so towers do not fall in lockstep. */
  phase: number;
  /** Per-column head period + trail length, baked into the texture. */
  headPeriod: number;
  trail: number;
  /** 0..1 overall brightness of this plane. */
  gain: number;
  /** Fraction of cells left empty. */
  gaps: number;
};

export type TowerSpec = {
  id: number;
  x: number;
  z: number;
  height: number;
  /** Half-width of the widest plane, for the contact glow. */
  span: number;
};

export type Layout = {
  planes: PlaneSpec[];
  towers: TowerSpec[];
};

const GRID_MIN = -34;
const GRID_MAX = 34;
const GRID_STEP = 7.6;
const MIN_SEPARATION = 6.4;
const TOWER_COUNT = 16;
/** Spec budget: 12-20 vertical planes. 16 towers + 4 crossed second planes. */
const PLANE_BUDGET = 20;

export const buildLayout = (seed: number): Layout => {
  const rand = mulberry32(seed);

  // Jittered grid candidates across the whole space.
  const candidates: { x: number; z: number; k: number }[] = [];
  for (let gx = GRID_MIN; gx <= GRID_MAX; gx += GRID_STEP) {
    for (let gz = GRID_MIN; gz <= GRID_MAX; gz += GRID_STEP) {
      const x = gx + range(rand, -2.5, 2.5);
      const z = gz + range(rand, -2.5, 2.5);
      candidates.push({ x, z, k: rand() });
    }
  }
  // Seeded shuffle, then bias toward the middle of the space so the loop is
  // always flanked by towers rather than staring into empty distance.
  candidates.sort(
    (a, b) => a.k + Math.hypot(a.x, a.z) / 62 - (b.k + Math.hypot(b.x, b.z) / 62),
  );

  const towers: TowerSpec[] = [];
  const planes: PlaneSpec[] = [];
  const makeSecond: (() => PlaneSpec)[] = [];
  let planeId = 0;

  for (const c of candidates) {
    if (towers.length >= TOWER_COUNT) break;

    const cols = Math.round(range(rand, 6, 11));
    const width = cols * CELL_WORLD_W;
    const visibleRows = Math.round(range(rand, 26, 48));
    const height = visibleRows * CELL_WORLD_H;
    const half = width * 0.5;

    // Wide gaps: never sit on the camera path, never crowd a neighbour.
    if (distanceToPathXZ(c.x, c.z) < half + 3.2) continue;
    if (towers.some((t) => Math.hypot(t.x - c.x, t.z - c.z) < MIN_SEPARATION)) continue;

    const towerId = towers.length;
    const yaw = rand() * Math.PI;
    const fallCycles = pick(rand, [1, 1, 2, 2, 2, 3]);
    const gain = range(rand, 0.72, 1);

    const makePlane = (planeYaw: number, planeCols: number): PlaneSpec => ({
      id: planeId++,
      towerId,
      x: c.x,
      z: c.z,
      yaw: planeYaw,
      cols: planeCols,
      visibleRows,
      width: planeCols * CELL_WORLD_W,
      height,
      fallCycles,
      phase: rand(),
      headPeriod: pick(rand, HEAD_PERIODS),
      trail: range(rand, 3.2, 8),
      gain,
      gaps: range(rand, 0.02, 0.09),
    });

    planes.push(makePlane(yaw, cols));
    makeSecond.push(() =>
      makePlane(yaw + Math.PI / 2, Math.max(4, Math.round(cols * 0.72))),
    );

    towers.push({ id: towerId, x: c.x, z: c.z, height, span: half });
  }

  // Spend the rest of the plane budget on second, crossed planes. Two crossed
  // curtains read as a slab from any angle, which is what stops an edge-on
  // tower from vanishing entirely.
  const order = makeSecond.map((fn) => ({ fn, k: rand() }));
  order.sort((a, b) => a.k - b.k);
  for (const entry of order.slice(0, PLANE_BUDGET - planes.length)) {
    planes.push(entry.fn());
  }
  planes.sort((a, b) => a.id - b.id);

  return { planes, towers };
};

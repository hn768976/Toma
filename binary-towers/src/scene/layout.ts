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

const GRID_MIN = -20;
const GRID_MAX = 20;
const GRID_STEP = 5.0;
const MIN_SEPARATION = 5.0;
/**
 * Floor on how close any tower may sit to the camera path, independent of its
 * width. A tower's peak sweep across the frame is speed / distance, so this is
 * what actually caps it: 3.71 u/s at 6.2 units is ~34 deg/s, near the camera's
 * own 30 deg/s heading rate, so nothing whips past faster than the frame turns.
 */
const MIN_PATH_CLEARANCE = 6.2;
const TOWER_COUNT = 16;
/** Spec budget: 12-20 vertical planes. 16 towers + 4 crossed second planes. */
const PLANE_BUDGET = 20;

export const buildLayout = (seed: number): Layout => {
  const rand = mulberry32(seed);

  // Jittered grid candidates across the whole space.
  const candidates: { x: number; z: number; k: number }[] = [];
  for (let gx = GRID_MIN; gx <= GRID_MAX; gx += GRID_STEP) {
    for (let gz = GRID_MIN; gz <= GRID_MAX; gz += GRID_STEP) {
      // Jitter grows with distance from the middle. Near the origin it goes to
      // zero, which keeps the innermost tower inside the camera loop — without
      // it the camera orbits an empty clearing and the towers only ever pass on
      // one side.
      const jitter = Math.min(2.0, 0.11 * Math.hypot(gx, gz));
      const x = gx + range(rand, -jitter, jitter);
      const z = gz + range(rand, -jitter, jitter);
      candidates.push({ x, z, k: rand() });
    }
  }
  // Seeded shuffle, biased toward the middle of the space. The bias is strong
  // enough that the innermost candidates are claimed first, so the camera loop
  // is flanked by towers on both sides rather than staring into empty distance.
  candidates.sort(
    (a, b) => a.k + Math.hypot(a.x, a.z) / 22 - (b.k + Math.hypot(b.x, b.z) / 22),
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

    // Wide gaps: never sit on the camera path, never crowd a neighbour. The
    // path clearance also sets how fast a tower sweeps past — the peak angular
    // rate is speed / distance, so pulling towers closer would undo the slower
    // travel speed. At this clearance nothing sweeps faster than ~33 deg/s,
    // close to the camera's own 30 deg/s heading rate, so the whole frame moves
    // at one gentle pace.
    if (distanceToPathXZ(c.x, c.z) < Math.max(half + 2.2, MIN_PATH_CLEARANCE)) continue;
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

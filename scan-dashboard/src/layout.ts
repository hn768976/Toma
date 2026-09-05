import { PLANE_H, PLANE_W, SPHERE_CX, SPHERE_CY, SPHERE_R } from './constants';
import { between, intBetween, mulberry32, pick, type Rng } from './rand';

/**
 * The dashboard layout is drawn once, at module scope, from a fixed seed.
 * Nothing here depends on the frame; the components below read these records
 * and animate them with pure functions of `useCurrentFrame()`.
 */

export type ModuleKind = 'bars' | 'slider' | 'values' | 'cells' | 'ticks';

export type ReadoutModule = {
  kind: ModuleKind;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  /** Per-module seed so each one animates on its own phase. */
  seed: number;
  rows: number;
  cols: number;
  /** Integer cycle counts, so every readout is home again at frame 480. */
  cycles: number[];
  phases: number[];
  bases: number[];
  accent: boolean;
};

/** Deliberately meaningless tags — nothing here names a real system or unit. */
const TAGS = [
  'SYS', 'REF', 'CH', 'IDX', 'LVL', 'SEQ', 'BUS', 'ARR', 'MOD', 'TRK',
  'GN', 'PH', 'DLT', 'RNG', 'AUX', 'SRC', 'VEC', 'AMP', 'BND', 'QZ',
];

const label = (rng: Rng) => `${pick(rng, TAGS)}-${String(intBetween(rng, 2, 89)).padStart(2, '0')}`;

const makeModule = (rng: Rng, x: number, y: number, w: number): ReadoutModule => {
  const kind = pick<ModuleKind>(rng, [
    'bars', 'bars', 'values', 'values', 'slider', 'cells', 'ticks',
  ]);
  const rows =
    kind === 'bars' ? intBetween(rng, 3, 5)
      : kind === 'values' ? intBetween(rng, 3, 6)
        : kind === 'cells' ? intBetween(rng, 3, 4)
          : kind === 'slider' ? 1 : 1;
  const cols = kind === 'slider' ? intBetween(rng, 3, 5) : kind === 'cells' ? intBetween(rng, 7, 10) : 1;

  const h =
    kind === 'bars' ? 74 + rows * 46
      : kind === 'values' ? 74 + rows * 44
        : kind === 'cells' ? 74 + rows * 40
          : kind === 'slider' ? intBetween(rng, 300, 400)
            : intBetween(rng, 78, 116);

  const n = Math.max(rows, cols, 6);
  const cycles: number[] = [];
  const phases: number[] = [];
  const bases: number[] = [];
  for (let i = 0; i < n; i++) {
    cycles.push(intBetween(rng, 1, 4));
    phases.push(between(rng, 0, Math.PI * 2));
    bases.push(between(rng, 0.2, 0.8));
  }

  return {
    kind,
    x,
    y,
    w,
    h,
    label: label(rng),
    seed: Math.floor(rng() * 1e9),
    rows,
    cols,
    cycles,
    phases,
    bases,
    accent: rng() < 0.18,
  };
};

/** Four sub-columns: two down the left edge, two down the right. */
const COL_W = 600;
const COLUMNS = [
  { x: 250, w: COL_W },
  { x: 930, w: COL_W },
  { x: PLANE_W - 250 - COL_W * 2 - 80, w: COL_W },
  { x: PLANE_W - 250 - COL_W, w: COL_W },
];

const buildModules = (): ReadoutModule[] => {
  const rng = mulberry32(0x5ca7d0);
  const out: ReadoutModule[] = [];
  for (const col of COLUMNS) {
    // Start above the top edge and run past the bottom so the stacks crop.
    let y = -between(rng, 60, 220);
    while (y < PLANE_H + 60) {
      const m = makeModule(rng, col.x, y, col.w);
      out.push(m);
      y += m.h + between(rng, 34, 76);
    }
  }
  return out;
};

export const MODULES = buildModules();

/** Small panels along the lower edge of the plane. */
export type Panel = { x: number; y: number; w: number; h: number; label: string; lines: number[][] };

const buildPanels = (): Panel[] => {
  const rng = mulberry32(0x9110ea);
  const specs = [
    { x: PLANE_W / 2 - 800, y: 2400, w: 720, h: 300 },
    { x: PLANE_W / 2 + 80, y: 2400, w: 720, h: 300 },
  ];
  return specs.map((s) => {
    const lines: number[][] = [];
    for (let i = 0; i < 5; i++) {
      const marks: number[] = [];
      let cursor = 0;
      while (cursor < 1) {
        const wMark = between(rng, 0.06, 0.19);
        if (cursor + wMark > 1) break;
        marks.push(cursor, wMark);
        cursor += wMark + between(rng, 0.025, 0.06);
      }
      lines.push(marks);
    }
    return { ...s, label: label(rng), lines };
  });
};

export const PANELS = buildPanels();

/** Corner brackets and stray tick rows scattered into the gaps. */
export type Bracket = { x: number; y: number; s: number; rot: number };
export type TickRow = { x: number; y: number; w: number; n: number; vertical: boolean; phase: number };

const buildDecor = () => {
  const rng = mulberry32(0x1d3c77);
  const brackets: Bracket[] = [];
  const ticks: TickRow[] = [];
  const bands: Array<[number, number]> = [
    [80, PLANE_W - 80],
  ];
  for (let i = 0; i < 26; i++) {
    const [x0, x1] = bands[0];
    let x = between(rng, x0, x1);
    const y = between(rng, -40, PLANE_H + 40);
    // Keep decoration clear of the sphere's own patch of the plane.
    if (Math.abs(x - PLANE_W / 2) < 760 && Math.abs(y - 1380) < 700) {
      x = x < PLANE_W / 2 ? x - 900 : x + 900;
    }
    brackets.push({ x, y, s: between(rng, 34, 76), rot: intBetween(rng, 0, 3) * 90 });
  }
  for (let i = 0; i < 22; i++) {
    let x = between(rng, 120, PLANE_W - 320);
    const y = between(rng, -20, PLANE_H + 20);
    if (Math.abs(x - PLANE_W / 2) < 800 && Math.abs(y - 1380) < 720) {
      x = x < PLANE_W / 2 ? x - 940 : x + 940;
    }
    ticks.push({
      x,
      y,
      w: between(rng, 150, 330),
      n: intBetween(rng, 6, 14),
      vertical: rng() < 0.3,
      phase: between(rng, 0, Math.PI * 2),
    });
  }
  return { brackets, ticks };
};

export const DECOR = buildDecor();

/**
 * The fine vertical lines that fall through the sphere. Each has its own
 * integer cycle count, so the whole curtain is back where it started at 480.
 */
export type Streak = { x: number; len: number; cycles: number; phase: number; opacity: number };

const buildStreaks = (): Streak[] => {
  const rng = mulberry32(0x57ea45);
  const half = SPHERE_R * 1.04;
  const out: Streak[] = [];
  for (let x = SPHERE_CX - half; x <= SPHERE_CX + half; x += 21) {
    out.push({
      x: x + between(rng, -3, 3),
      len: between(rng, 180, 620),
      cycles: intBetween(rng, 1, 3),
      phase: rng(),
      opacity: between(rng, 0.24, 0.72),
    });
  }
  return out;
};

export const STREAKS = buildStreaks();
export const STREAK_TOP = -90;
export const STREAK_BOTTOM = SPHERE_CY + SPHERE_R * 0.94;

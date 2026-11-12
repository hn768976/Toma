import { clamp, createRandom, easeInOutCubic, easeInOutSine } from "../lib/random";
import type { TogglePalette } from "./palette";

/**
 * The world is a field of "toggle switch" pieces laid out on a 45° lattice in
 * three stacked paper layers – like the reference footage. All animation is
 * stored as timed events so any frame can be evaluated independently.
 */

export const TRACK_W = 1.0; // width of a switch track (world units)
export const KNOB_R = 0.49; // knob radius
export const ROW_SPACING = 1.02;
export const LAYER_H = 0.09; // knobs of a lower layer hide under the track above
export const TRACK_T = 0.07; // paper thickness
export const KNOB_T = 0.07;
const DIAG = Math.PI / 4;

type Flip = { start: number; dur: number };
type Turn = { start: number; dur: number; delta: number };

export type KnobDef = {
  color: string;
  startOn: boolean;
  flips: Flip[];
};

export type PieceDef = {
  id: number;
  x: number;
  y: number;
  z: number;
  length: number; // along local x
  width: number; // along local y
  radius: number;
  angle: number;
  color: string;
  knob: KnobDef | null;
  turns: Turn[];
  layer: number;
  row: number;
  /** extra starting rotation (pieces that begin on the opposite diagonal) */
  startAngle: number;
};

const makeFlips = (
  rand: ReturnType<typeof createRandom>,
  totalFrames: number,
  fps: number,
  activity: number,
): Flip[] => {
  const flips: Flip[] = [];
  let t = rand.range(-1.2, 1.6) * fps;
  while (t < totalFrames + fps) {
    const dur = rand.range(0.45, 0.8) * fps;
    if (rand.next() < activity) flips.push({ start: t, dur });
    t += dur + rand.range(0.9, 2.6) * fps;
  }
  return flips;
};

/**
 * Rotation rhythm measured from the reference (edge-orientation histogram per
 * frame): two interleaved groups of switches swing 90° clockwise around their
 * knob onto the opposite diagonal, hold, then swing another 90° back onto the
 * main diagonal. A transition happens every ~20 frames, alternating groups.
 * Centre frames of each group's swings:
 */
const GROUP_SWINGS: Record<"A" | "B", number[]> = {
  A: [30, 70, 108, 152, 190, 230, 268, 312],
  B: [50, 90, 130, 168, 210, 250, 288, 314],
};
const OPENING_SWING = 8; // pieces that start on the other diagonal return here
const SWING_DUR = 12;
const ROTOR_SHARE = 0.6;

const assignRotations = (pieces: PieceDef[], rand: ReturnType<typeof createRandom>) => {
  const rowCounter = new Map<number, number>();
  const ordered = [...pieces].sort((a, b) => a.row - b.row || a.x + a.y - (b.x + b.y));
  for (const p of ordered) {
    const isPill = p.width <= TRACK_W * 1.01 && p.length > TRACK_W * 1.5;
    if (!isPill || rand.next() > ROTOR_SHARE) {
      // static pieces form the bottom sheet
      p.layer = 0;
      p.z = rand.range(0, 0.012);
      continue;
    }
    const n = rowCounter.get(p.row) ?? 0;
    rowCounter.set(p.row, n + 1);
    const group = n % 2 === 0 ? "A" : "B";
    // each group owns three layers (by row) so swinging pieces pass over/under
    p.layer = (group === "A" ? 4 : 1) + (((p.row % 3) + 3) % 3);
    p.z = p.layer * LAYER_H + rand.range(0, 0.012);
    const wave = (p.x + p.y) * 0.25;
    if (rand.next() < 0.3) {
      p.startAngle = Math.PI / 2;
      p.turns.push({ start: OPENING_SWING - SWING_DUR / 2 + wave * 0.5 + rand.range(-1, 1), dur: SWING_DUR, delta: -Math.PI / 2 });
    }
    for (const c of GROUP_SWINGS[group]) {
      p.turns.push({ start: c - SWING_DUR / 2 + wave + rand.range(-1.5, 1.5), dur: SWING_DUR * rand.range(0.92, 1.08), delta: -Math.PI / 2 });
    }
    // knob flips never overlap a swing (the knob is the pivot)
    if (p.knob) {
      p.knob.flips = p.knob.flips.filter(
        (f) => !p.turns.some((t) => f.start < t.start + t.dur + 2 && f.start + f.dur > t.start - 2),
      );
    }
  }
};

export const buildWorld = (opts: {
  palette: TogglePalette;
  seed: number;
  halfX: number;
  halfY: number;
  totalFrames: number;
  fps: number;
}): PieceDef[] => {
  const { palette, seed, halfX, halfY, totalFrames, fps } = opts;
  const rand = createRandom(seed);
  const pieces: PieceDef[] = [];
  const ax = Math.cos(DIAG);
  const ay = Math.sin(DIAG);
  const nx = -ay;
  const ny = ax;
  const reach = Math.hypot(halfX, halfY) + 3;

  // One regular 45° lattice of rows (like the reference); every piece gets
  // one of four paper heights so neighbours overlap and cast shadows.
  const rows = Math.ceil(reach / ROW_SPACING);
  let id = 0;
  const accents: [number, number][] = [];
  for (let row = -rows; row <= rows; row++) {
    const n = row * ROW_SPACING;
    let s = -reach + rand.range(0, 2);
    while (s < reach) {
      const kind = rand.weighted([
        ["switch", 0.56],
        ["long", 0.1],
        ["plate", 0.08],
        ["tile", 0.2],
      ] as const);
      const isTile = kind === "tile";
      const width = isTile ? rand.range(1.5, 1.95) * TRACK_W : TRACK_W;
      const length = isTile
        ? width * rand.range(0.95, 1.12)
        : kind === "switch"
          ? 2 * TRACK_W
          : kind === "long"
            ? 2.5 * TRACK_W
            : TRACK_W;
      const radius = isTile ? width * rand.range(0.2, 0.3) : TRACK_W * 0.5;
      const cs = s + length / 2;
      const cx = ax * cs + nx * n;
      const cy = ay * cs + ny * n;
      s += length + rand.range(-0.3, 0.22);
      if (Math.abs(cx) > halfX + 2.5 || Math.abs(cy) > halfY + 2.5) continue;
      if (rand.next() > 0.93) continue;

      const layer = isTile
        ? rand.weighted([[0, 0.55], [1, 0.35], [2, 0.1]] as const)
        : rand.weighted([[0, 0.2], [1, 0.3], [2, 0.3], [3, 0.2]] as const);
      let accent = rand.next() < (isTile ? 0.04 : 0.075);
      if (accent && accents.some(([ax2, ay2]) => Math.hypot(ax2 - cx, ay2 - cy) < 2.8)) accent = false;
      if (accent) accents.push([cx, cy]);
      const color = accent ? palette.accentTrack : rand.weighted(palette.tracks);
      let knob: KnobDef | null = null;
      const knobChance = kind === "plate" ? 0 : isTile ? 0.35 : 0.88;
      if (rand.next() < knobChance) {
        let knobColor = accent
          ? rand.next() < 0.55
            ? palette.accentKnob
            : rand.weighted(palette.knobs)
          : rand.next() < 0.04
            ? palette.accentKnob
            : rand.weighted(palette.knobs);
        if (knobColor === color) knobColor = rand.weighted(palette.knobs);
        knob = {
          color: knobColor,
          startOn: rand.next() < 0.5,
          flips: makeFlips(rand, totalFrames, fps, isTile ? 0.4 : 0.72),
        };
      }
      const turns: Turn[] = [];
      pieces.push({
        id: id++,
        x: cx,
        y: cy,
        z: layer * LAYER_H + rand.range(0, 0.012),
        length,
        width,
        radius: Math.min(radius, width / 2, length / 2),
        angle: DIAG,
        color,
        knob,
        turns,
        layer,
        row,
        startAngle: 0,
      });
    }
  }
  assignRotations(pieces, rand);
  return pieces;
};

/** Knob position in [-1, 1] along the track at `frame`. */
export const knobPosition = (knob: KnobDef, frame: number) => {
  let state = knob.startOn ? 1 : 0;
  for (const f of knob.flips) {
    const p = easeInOutCubic(clamp((frame - f.start) / f.dur));
    if (p <= 0) break;
    state = state + (1 - 2 * state) * p;
    if (p < 1) break;
    state = Math.round(state);
  }
  return state * 2 - 1;
};

/** Travel of the knob from the track centre (world units). */
export const knobTravel = (piece: PieceDef) =>
  piece.width > TRACK_W * 1.2 ? piece.length / 2 - KNOB_R - 0.14 : piece.length / 2 - KNOB_R;

/**
 * Rotation, lift and planar offset of a piece at `frame`. Each swing pivots
 * around the knob position at the start of that swing, so offsets accumulate.
 */
export const pieceTurn = (piece: PieceDef, frame: number) => {
  let angle = piece.angle + piece.startAngle;
  let lift = 0;
  let ox = 0;
  let oy = 0;
  const travel = knobTravel(piece);
  for (const t of piece.turns) {
    const raw = clamp((frame - t.start) / t.dur);
    if (raw <= 0) break;
    const k = piece.knob ? knobPosition(piece.knob, t.start) * travel : 0;
    const next = angle + t.delta * easeInOutSine(raw);
    ox += k * (Math.cos(angle) - Math.cos(next));
    oy += k * (Math.sin(angle) - Math.sin(next));
    lift = Math.max(lift, Math.sin(Math.PI * raw) * 0.04);
    angle = next;
    if (raw < 1) break;
  }
  return { angle, lift, ox, oy };
};

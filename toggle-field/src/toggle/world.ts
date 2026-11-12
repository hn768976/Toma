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
type Turn = { start: number; dur: number; delta: number; pivot: boolean };

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
 * Rotation rhythm measured from the reference (per-frame edge-orientation
 * histogram + frame inspection):
 *  - every ~40 frames ALL switches swing 90° clockwise around their knob in
 *    sync, alternating main diagonal -> (horizontal) -> other diagonal ->
 *    (vertical) -> main diagonal;
 *  - ~20 frames after each global swing, patches of switches spin a half-turn
 *    in place, so something turns on every ~20-frame beat.
 */
const GLOBAL_SWINGS = [30, 70, 110, 150, 190, 230, 270, 312];
const PATCH_SPINS = [8, 50, 90, 130, 168, 210, 250, 290];
const SWING_DUR = 12;
const SPIN_DUR = 14;
const ROTOR_SHARE = 0.85;

const assignRotations = (pieces: PieceDef[], rand: ReturnType<typeof createRandom>) => {
  const patches = PATCH_SPINS.map(() => ({
    fx: rand.range(0.45, 0.8),
    fy: rand.range(0.45, 0.8),
    px: rand.range(0, Math.PI * 2),
    py: rand.range(0, Math.PI * 2),
  }));
  for (const p of pieces) {
    const isPill = p.width <= TRACK_W * 1.01 && p.length > TRACK_W * 1.5;
    if (!isPill || rand.next() > ROTOR_SHARE) {
      // static pieces sit just above the base sheet
      p.layer = 1;
      p.z = LAYER_H + rand.range(0, 0.012);
      continue;
    }
    // switches sit on random paper layers so knobs of neighbouring rows stay visible
    p.layer = 2 + rand.int(0, 2);
    p.z = p.layer * LAYER_H + rand.range(0, 0.012);
    const wave = -(p.x + p.y) * 0.18; // the swing ripples from top-right to bottom-left
    const events: Turn[] = [];
    for (const c of GLOBAL_SWINGS) {
      events.push({ start: c - SWING_DUR / 2 + wave + rand.range(-1.2, 1.2), dur: SWING_DUR * rand.range(0.92, 1.08), delta: -Math.PI / 2, pivot: true });
    }
    PATCH_SPINS.forEach((c, i) => {
      const q = patches[i];
      const field = Math.sin(p.x * q.fx + q.px) * Math.sin(p.y * q.fy + q.py);
      if (field > 0.15 && rand.next() < 0.85) {
        events.push({ start: c - SPIN_DUR / 2 + wave + rand.range(-1.5, 1.5), dur: SPIN_DUR * rand.range(0.92, 1.08), delta: -Math.PI, pivot: false });
      }
    });
    events.sort((a, b) => a.start - b.start);
    p.turns.push(...events);
    // knob flips never overlap a turn (the knob is the pivot)
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

  // Base sheet: a dense 45° grid of static rounded tiles under everything, so
  // the swinging switches always read against layered paper (as in the reference).
  const SHEET = 2.05;
  const span = Math.ceil(reach / SHEET);
  for (let i = -span; i <= span; i++) {
    for (let j = -span; j <= span; j++) {
      const cs = (i + (j % 2 === 0 ? 0 : 0.5)) * SHEET;
      const cn = j * SHEET * 0.5 * 1.02;
      const cx = ax * cs + nx * cn;
      const cy = ay * cs + ny * cn;
      if (Math.abs(cx) > halfX + 2.5 || Math.abs(cy) > halfY + 2.5) continue;
      if (rand.next() < 0.2) continue;
      const size = rand.range(1.55, 1.9) * TRACK_W;
      pieces.push({
        id: id++,
        x: cx + rand.range(-0.1, 0.1),
        y: cy + rand.range(-0.1, 0.1),
        z: rand.range(0, 0.006),
        length: size * rand.range(0.95, 1.1),
        width: size,
        radius: size * rand.range(0.2, 0.28),
        angle: DIAG,
        color: rand.next() < 0.06 ? palette.accentTrack : rand.weighted(palette.tracks),
        knob: null,
        turns: [],
        layer: 0,
        row: j,
        startAngle: 0,
      });
    }
  }
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
    const k = piece.knob && t.pivot ? knobPosition(piece.knob, t.start) * travel : 0;
    const next = angle + t.delta * easeInOutSine(raw);
    ox += k * (Math.cos(angle) - Math.cos(next));
    oy += k * (Math.sin(angle) - Math.sin(next));
    lift = Math.max(lift, Math.sin(Math.PI * raw) * 0.04);
    angle = next;
    if (raw < 1) break;
  }
  return { angle, lift, ox, oy };
};

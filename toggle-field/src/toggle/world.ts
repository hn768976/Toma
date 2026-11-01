import { clamp, createRandom, easeInOutCubic } from "../lib/random";
import type { TogglePalette } from "./palette";

/**
 * The world is a field of "toggle switch" pieces laid out on a 45° lattice in
 * three stacked paper layers – like the reference footage. All animation is
 * stored as timed events so any frame can be evaluated independently.
 */

export const TRACK_W = 1.0; // width of a switch track (world units)
export const KNOB_R = 0.49; // knob radius
export const ROW_SPACING = 1.02;
export const LAYER_H = 0.13;
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

const makeTurns = (
  rand: ReturnType<typeof createRandom>,
  totalFrames: number,
  fps: number,
): Turn[] => {
  const turns: Turn[] = [];
  let t = rand.range(-0.5, 2.5) * fps;
  let acc = 0;
  while (t < totalFrames + fps) {
    const dur = rand.range(0.6, 0.95) * fps;
    // swing away from the diagonal and back again, like the reference
    const delta = acc === 0 ? rand.pick([Math.PI / 4, -Math.PI / 4, Math.PI / 2]) : -acc;
    acc += delta;
    turns.push({ start: t, dur, delta });
    t += dur + rand.range(1.1, 2.8) * fps;
  }
  return turns;
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
  for (let row = -rows; row <= rows; row++) {
    const n = row * ROW_SPACING;
    let s = -reach + rand.range(0, 2);
    while (s < reach) {
      const kind = rand.weighted([
        ["switch", 0.56],
        ["long", 0.1],
        ["plate", 0.14],
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
      const accent = rand.next() < (isTile ? 0.04 : 0.075);
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
      const turns = layer >= 2 && rand.next() < 0.28 ? makeTurns(rand, totalFrames, fps) : [];
      pieces.push({
        id: id++,
        x: cx,
        y: cy,
        z: layer * LAYER_H + rand.range(0, 0.012) + (turns.length ? 0.06 : 0),
        length,
        width,
        radius: Math.min(radius, width / 2, length / 2),
        angle: DIAG,
        color,
        knob,
        turns,
        layer,
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

/** Extra rotation and lift of a piece at `frame`. */
export const pieceTurn = (piece: PieceDef, frame: number) => {
  let angle = 0;
  let lift = 0;
  for (const t of piece.turns) {
    const raw = clamp((frame - t.start) / t.dur);
    angle += t.delta * easeInOutCubic(raw);
    lift = Math.max(lift, Math.sin(Math.PI * raw) * 0.18);
  }
  return { angle, lift };
};

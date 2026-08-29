// The field itself: where every glyph is, how big, how bright, how blurred.
//
// Everything here is a pure function of (glyph index, frame). Nothing reads a
// clock, nothing keeps state between frames, and every quantity is periodic in
// 600 frames — so frame 0 and frame 600 are the same picture and the render is
// identical whichever order Remotion's workers happen to visit frames in.

import { random } from "remotion";
import type { Notation, Variant } from "./variant-types";

export const DURATION_IN_FRAMES = 600;
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

/** Every one of these divides 600, so every pulse closes the loop. */
const PULSE_PERIODS = [60, 75, 100, 120, 150, 200];
const PULSE_DEPTH = 0.08;
/** Frames a flare lasts. A glyph flares once per loop; ~3.5 flares a second. */
const FLARE_FRAMES = 5;

/** Blur applied to each depth buffer, in 4K pixels. */
export const BUFFER_BLUR = { far: 26, mid: 0, near: 17 };

const smooth01 = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

export type Instance = {
  key: string;
  /** Index into the variant's notation list. */
  notationIndex: number;
  kind: Notation["kind"];
  /** Centre, in 4K pixels. */
  x: number;
  y: number;
  /** Centre one frame earlier — the motion-blur vector. */
  px: number;
  py: number;
  /**
   * Depth/jitter component of the glyph's size. The sprite's own baseScale is
   * multiplied in at blit time — it is the one quantity here that needs the
   * typeface, and keeping it out means placement is correct on the very first
   * frame, before the webfont has resolved.
   */
  sizeScale: number;
  alpha: number;
  /** Continuous palette position: 0 dim, 1 mid, 2 bright. */
  tone: number;
  /** Partition of unity across the three depth buffers. */
  wFar: number;
  wMid: number;
  wNear: number;
  /** 0 normally, rising to 1 during a flare. */
  flare: number;
};

type Placed = { x: number; y: number; sizeScale: number; t: number; slot: number };

/**
 * Where glyph `i` is at time `f` (which may be fractional or negative — the
 * motion-blur pass asks for f − 1).
 */
const place = (
  variant: Variant,
  i: number,
  laps: number,
  z0: number,
  jitter: number,
  f: number,
  width: number,
  height: number,
): Placed => {
  const { motion, depth } = variant;
  const span = depth.max - depth.min;
  const zMid = (depth.min + depth.max) / 2;
  const fx = motion.focus[0] * width;
  const fy = motion.focus[1] * height;

  if (motion.mode === "lateral") {
    // Depth is frozen: it sets blur, alpha and speed, never scale or position.
    const t = z0;
    const travel = width + 2400;
    const dir = random(`dir-${variant.key}-${i}`) < (motion.leftwardShare ?? 0.72) ? -1 : 1;
    const x0 = random(`lx-${variant.key}-${i}`) * travel;
    const raw = x0 + dir * laps * travel * (f / DURATION_IN_FRAMES);
    const wrapped = ((raw % travel) + travel) % travel;
    const [sMin, sMax] = motion.sizeRange ?? [0.5, 1.4];
    const size = sMin + random(`sz-${variant.key}-${i}`) * (sMax - sMin);
    return {
      x: wrapped - (travel - width) / 2,
      y: (0.06 + random(`ly-${variant.key}-${i}`) * 0.88) * height,
      sizeScale: size * jitter,
      t,
      slot: 0,
    };
  }

  const u = z0 + motion.depthDir * laps * (f / DURATION_IN_FRAMES);
  const cycle = Math.floor(u);
  const t = u - cycle;
  const z = depth.min + t * span;

  // Recycling: a glyph that leaves one end of the range comes back at the
  // other with a fresh seeded position. Keying the seed on the cycle index
  // modulo `laps` is what makes frame 600 land back on frame 0's layout.
  const slot = ((cycle % laps) + laps) % laps;
  const seed = `pos-${variant.key}-${i}-${slot}`;
  const ang = random(`${seed}-a`) * Math.PI * 2;
  const r0 = 0.1 + random(`${seed}-r`) ** 0.55 * 1.3;
  const halfDiag = Math.hypot(width, height) / 2;

  const k = (z / depth.max) ** motion.spreadPow;
  const radius = r0 * halfDiag * k;

  return {
    x: fx + Math.cos(ang) * radius,
    y: fy + Math.sin(ang) * radius * 0.92,
    sizeScale: jitter * (z / zMid) ** 1.6,
    t,
    slot,
  };
};

export const evaluate = (
  variant: Variant,
  frame: number,
  width: number,
  height: number,
): Instance[] => {
  const out: Instance[] = [];
  const items = variant.notation;
  const lateral = variant.motion.mode === "lateral";

  // Which notation a glyph carries. Sampling this independently per glyph
  // clumps badly at 70 draws from 15 items — the same equation ends up on
  // screen five times while a structure never appears. A coprime stride
  // spreads the set evenly instead, and folding in the recycle slot means a
  // glyph comes back carrying different notation each time round.
  const rotation = Math.floor(random(`rot-${variant.key}`) * items.length);

  for (let i = 0; i < variant.count; i++) {
    const z0 = random(`z-${variant.key}-${i}`);
    const jitter = 0.78 + random(`j-${variant.key}-${i}`) * 0.46;
    // Lateral speed is proportional to depth; depth motion picks from the
    // variant's lap list. Both are whole numbers, so both close the loop.
    const laps = lateral
      ? 1 + Math.floor(z0 * 3.99)
      : variant.motion.laps[
          Math.floor(random(`lap-${variant.key}-${i}`) * variant.motion.laps.length) %
            variant.motion.laps.length
        ];

    const now = place(variant, i, laps, z0, jitter, frame, width, height);
    const before = place(variant, i, laps, z0, jitter, frame - 1, width, height);
    const t = now.t;
    const notationIndex = ((i + now.slot) * 7 + rotation) % items.length;

    // Depth-of-field: a narrow sharp band in the middle, blurred at both
    // extremes, cross-faded across the bucket boundaries so nothing snaps.
    const wFar = 1 - smooth01((t - 0.28) / 0.12);
    const wNear = smooth01((t - 0.62) / 0.12);
    const wMid = Math.max(0, 1 - wFar - wNear);

    let alpha = lateral
      // No edge fade in lateral mode: a glyph slides off frame rather than
      // dissolving. Depth sets its brightness once, and holds it.
      ? 0.42 + 0.58 * t
      : 0.95 * smooth01(t / 0.13) * (1 - smooth01((t - 0.88) / 0.12));

    const period = PULSE_PERIODS[Math.floor(random(`pp-${variant.key}-${i}`) * PULSE_PERIODS.length)];
    const phase = random(`ph-${variant.key}-${i}`);
    alpha *= 1 + PULSE_DEPTH * Math.sin(Math.PI * 2 * (frame / period + phase));

    const flareStart = Math.floor(random(`fl-${variant.key}-${i}`) * DURATION_IN_FRAMES);
    const since = ((frame - flareStart) % DURATION_IN_FRAMES + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
    const flare =
      since < FLARE_FRAMES ? Math.sin((Math.PI * (since + 0.5)) / FLARE_FRAMES) : 0;

    if (alpha <= 0.004 || now.sizeScale <= 0.002) continue;

    out.push({
      key: `${variant.key}-${i}`,
      notationIndex,
      kind: items[notationIndex].kind,
      x: now.x,
      y: now.y,
      px: before.x,
      py: before.y,
      sizeScale: now.sizeScale,
      alpha: Math.min(1, alpha),
      tone: Math.min(2, Math.max(0, t * 2)),
      wFar,
      wMid,
      wNear,
      flare,
    });
  }

  return out;
};

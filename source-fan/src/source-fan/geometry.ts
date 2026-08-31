import { random } from "remotion";
import { HEIGHT, WIDTH, type Flow } from "./layout";
import { cubicAt, lerp, loopSin, pick, smoothstep } from "./math";
import type { VariantConfig } from "./variants";

/** Sample count along each strand. More segments = smoother pulse gradient. */
export const STRAND_SEGMENTS = 22;

/** Every pulse period divides 600 so the travelling pulses close the loop. */
const PULSE_PERIODS = [60, 75, 100, 120, 150, 200] as const;
/** Undulation frequencies are whole cycles per loop, for the same reason. */
const UNDULATION_CYCLES = [1, 2, 3] as const;
const UNDULATION_AMPLITUDE = 20;

interface Wobble {
  readonly amp: number;
  readonly cycles: number;
  readonly phase: number;
}

interface ControlPoint {
  /** Position along the flow, 0 at the node. */
  readonly u: number;
  /** Offset from the node's y, in px. */
  readonly dy: number;
  readonly wobble: Wobble;
}

export interface Strand {
  readonly nodeIndex: number;
  readonly c1: ControlPoint;
  readonly c2: ControlPoint;
  readonly end: ControlPoint;
  readonly alpha: number;
  readonly width: number;
  readonly pulsePeriod: number;
  readonly pulsePhase: number;
  readonly pulseGain: number;
  /** t at which the fade toward zero opacity begins. */
  readonly fadeStart: number;
  /** t at which the glow pass stops, so glows do not end on one line. */
  readonly glowEnd: number;
  /** Which of the alpha buckets this strand belongs to. */
  readonly bucket: number;
}

export const GLOW_BUCKETS = 3;

const wobble = (seed: string): Wobble => ({
  amp: UNDULATION_AMPLITUDE * (0.55 + 0.85 * random(`${seed}-amp`)),
  cycles: pick(UNDULATION_CYCLES, random(`${seed}-cyc`)),
  phase: random(`${seed}-pha`),
});

const strandCache = new WeakMap<VariantConfig, Strand[]>();

/**
 * Built once per variant. Nothing here depends on the frame — the per-frame
 * work is only the undulation offset applied in `strandPoints`.
 */
export const buildStrands = (config: VariantConfig): Strand[] => {
  const cached = strandCache.get(config);
  if (cached) {
    return cached;
  }
  const strands: Strand[] = [];
  const { spread, flowStops } = config;
  const centreY = HEIGHT / 2;

  for (let n = 0; n < config.sources.length; n++) {
    const ny = HEIGHT * config.sources[n].yFraction;
    const gatherOffset = (centreY - ny) * config.gather;

    for (let i = 0; i < config.strandsPerNode; i++) {
      const seed = `strand-${n}-${i}`;
      const count = config.strandsPerNode;
      // Fan position, -1 (up) to +1 (down), jittered so the fan is not combed.
      const even = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
      const k = even + (random(`${seed}-k`) - 0.5) * (1.9 / count);

      const c1 = {
        u: flowStops.c1 * (0.7 + 0.6 * random(`${seed}-u1`)),
        dy: k * spread.c1 * HEIGHT + (random(`${seed}-j1`) - 0.5) * 6,
        wobble: wobble(`${seed}-w1`),
      };
      const c2 = {
        u: flowStops.c2 * (0.82 + 0.36 * random(`${seed}-u2`)),
        dy:
          k * spread.c2 * HEIGHT * (0.8 + 0.4 * random(`${seed}-s2`)) +
          gatherOffset * 0.45 +
          (random(`${seed}-j2`) - 0.5) * HEIGHT * 0.035,
        wobble: wobble(`${seed}-w2`),
      };
      const end = {
        u: flowStops.end * (0.9 + 0.16 * random(`${seed}-u3`)),
        dy:
          k * spread.end * HEIGHT * (0.85 + 0.3 * random(`${seed}-s3`)) +
          gatherOffset +
          (random(`${seed}-j3`) - 0.5) * HEIGHT * 0.04,
        wobble: wobble(`${seed}-w3`),
      };

      const alphaRoll = random(`${seed}-a`);
      const fadeStart = 0.34 + 0.24 * random(`${seed}-fs`);
      strands.push({
        nodeIndex: n,
        c1,
        c2,
        end,
        alpha: lerp(config.strandAlphaMin, config.strandAlphaMax, alphaRoll),
        width: lerp(
          config.strandWidthMin,
          config.strandWidthMax,
          random(`${seed}-w`) ** 1.7,
        ),
        pulsePeriod: pick(PULSE_PERIODS, random(`${seed}-pp`)),
        pulsePhase: random(`${seed}-ph`),
        pulseGain: 0.75 + 0.75 * random(`${seed}-pg`),
        fadeStart,
        glowEnd: fadeStart + 0.1 + 0.14 * random(`${seed}-ge`),
        bucket: Math.min(GLOW_BUCKETS - 1, Math.floor(alphaRoll * GLOW_BUCKETS)),
      });
    }
  }

  strandCache.set(config, strands);
  return strands;
};

/**
 * Screen-space samples for one strand at one frame. Only the control points
 * move; the geometry itself was generated once.
 */
export const strandPoints = (
  strand: Strand,
  nodeYPx: number,
  flow: Flow,
  frame: number,
  out: Float64Array,
): void => {
  const x0 = flow.x(0);
  const y0 = nodeYPx;
  const x1 = flow.x(strand.c1.u);
  const y1 =
    nodeYPx +
    strand.c1.dy +
    strand.c1.wobble.amp *
      0.35 *
      loopSin(frame, strand.c1.wobble.cycles, strand.c1.wobble.phase);
  const x2 = flow.x(strand.c2.u);
  const y2 =
    nodeYPx +
    strand.c2.dy +
    strand.c2.wobble.amp *
      loopSin(frame, strand.c2.wobble.cycles, strand.c2.wobble.phase);
  const x3 = flow.x(strand.end.u);
  const y3 =
    nodeYPx +
    strand.end.dy +
    strand.end.wobble.amp *
      loopSin(frame, strand.end.wobble.cycles, strand.end.wobble.phase);

  for (let s = 0; s <= STRAND_SEGMENTS; s++) {
    const t = s / STRAND_SEGMENTS;
    out[s * 2] = cubicAt(x0, x1, x2, x3, t);
    out[s * 2 + 1] = cubicAt(y0, y1, y2, y3, t);
  }
};

export interface Dot {
  readonly x: number;
  readonly y: number;
  readonly size: number;
  readonly hue: number;
  /** Baseline brightness, 0..1. Most dots are dim. */
  readonly base: number;
  readonly period: number;
  readonly phase: number;
  readonly flash: boolean;
}

/** Flicker periods, all divisors of 600. */
const FLICKER_PERIODS = [12, 15, 20, 24, 30, 40, 50, 60, 75, 100] as const;
const FLASH_PERIODS = [60, 75, 100, 120, 150] as const;

/**
 * Loose horizontal rows of squares with irregular spacing — never a grid.
 * Rows tilt with the strands (apart for a broadcasting fan, together for a
 * collecting one) and thin out toward the far edge.
 */
const dotCache = new WeakMap<VariantConfig, Dot[]>();

export const buildDots = (config: VariantConfig, flow: Flow): Dot[] => {
  const cached = dotCache.get(config);
  if (cached) {
    return cached;
  }
  const field = config.dotField;
  const dots: Dot[] = [];
  const span = field.uEnd - field.uStart;
  const centreY = HEIGHT / 2;

  for (let r = 0; r < field.rows; r++) {
    const seed = `dot-row-${r}`;
    const evenY = field.rows === 1 ? 0.5 : r / (field.rows - 1);
    const rowY =
      HEIGHT *
      (field.yTop +
        (field.yBottom - field.yTop) *
          (evenY + (random(`${seed}-y`) - 0.5) * (1.3 / field.rows)));
    const track = (rowY - centreY) * field.rowTrack;
    // Outer rows thin out so the field is a lens rather than a rectangle.
    const weight = Math.max(
      0.16,
      1 - field.rowFalloff * (Math.abs(evenY - 0.5) * 2) ** 1.6,
    );
    const scatter = 6 + 16 * random(`${seed}-sc`);

    let u = field.uStart + span * 0.1 * random(`${seed}-u0`);
    let i = 0;
    while (u < field.uEnd) {
      const dseed = `${seed}-${i}`;
      const progress = (u - field.uStart) / span;
      const y =
        rowY + track * progress + (random(`${dseed}-jy`) - 0.5) * scatter * 2;
      // Ramp the density in rather than starting the field on a hard line.
      const rampIn = random(`${dseed}-ramp`) < smoothstep(-0.03, 0.18, progress);
      if (rampIn && y > -20 && y < HEIGHT + 20) {
        const bright = random(`${dseed}-b`) < field.brightChance;
        const flash = random(`${dseed}-f`) < field.flashChance;
        dots.push({
          x: flow.x(u),
          y,
          size:
            field.sizeMin +
            (field.sizeMax - field.sizeMin) *
              (bright ? 0.55 + 0.45 * random(`${dseed}-s`) : random(`${dseed}-s`) ** 2),
          hue: Math.floor(random(`${dseed}-h`) * config.palette.dotHues.length),
          base: bright
            ? 0.7 + 0.3 * random(`${dseed}-br`)
            : 0.12 + 0.46 * random(`${dseed}-br`),
          period: flash
            ? pick(FLASH_PERIODS, random(`${dseed}-fp`))
            : pick(FLICKER_PERIODS, random(`${dseed}-p`)),
          phase: random(`${dseed}-ph`),
          flash,
        });
      }
      // Irregular spacing, opening out toward the far edge so the field is
      // densest where the strands fade and thins as it goes.
      const gap =
        field.baseGap *
        (0.25 + 1.9 * random(`${dseed}-g`) ** 2) *
        (1 + field.gapGrowth * progress * progress) /
        weight;
      u += Math.max(gap, field.baseGap * 0.15);
      i++;
      if (i > 4000) {
        break;
      }
    }
  }

  const visible = dots.filter((d) => d.x > -40 && d.x < WIDTH + 40);
  dotCache.set(config, visible);
  return visible;
};

import {
  ALPHA_FAR,
  ALPHA_NEAR,
  BASE_FALL_SPEED_PX,
  BLUR_FALLOFF,
  BLUR_MAX_PX,
  DOT_GAP_JITTER,
  DOT_MAX_SIZE_PX,
  DOT_MIN_SIZE_PX,
  DOT_SIZE_VARIANCE,
  DOT_SPACING_PX,
  DURATION_IN_FRAMES,
  EDGE_LEAN_BOOST_DEG,
  FLARES_PER_SECOND,
  FLARE_MAX_FRAMES,
  FLARE_MIN_FRAMES,
  FPS,
  HEIGHT,
  LEAN_ANGLE_DEG,
  MOTION_BLUR_Z,
  SHARP_Z,
  STREAM_CLUSTER_SPREAD,
  STREAM_COUNT,
  STREAM_DENSITY,
  STREAM_OVERSCAN,
  TWINKLE_PERIODS,
  WIDTH,
  WRAP_MARGIN_PX,
  Z_MAX,
  Z_MIN,
} from "./constants";
import { DOT_TONES } from "./themes";
import { rand, randInt, randPick, randRange, randSpan } from "./random";

export type Dot = {
  /** Position along the stream axis at frame 0, in [0, span). */
  s0: number;
  /** Diameter in px. */
  size: number;
  /** Index into DOT_TONES. */
  tone: number;
  /** Sideways offset off the stream axis, one entry per wrap cycle — a dot
   *  re-seeds its position within the stream each time it wraps. */
  lateral: number[];
  /** Radians per frame of the twinkle oscillation. */
  twinkleFreq: number;
  twinklePhase: number;
  /** Frame the dot flashes white on, or -1 for the vast majority of dots. */
  flareStart: number;
  flareFrames: number;
};

export type Stream = {
  /** x of the stream axis at the vertical centre of the frame. */
  xc: number;
  /** Horizontal shift per px of vertical travel — the lean. */
  tanLean: number;
  z: number;
  alpha: number;
  blurPx: number;
  /** px per frame along the stream axis, before FLOW_DIRECTION is applied. */
  speed: number;
  /** Length of the repeating dot pattern, >= frame height + wrap margins. */
  span: number;
  /** Whole number of times the pattern cycles in DURATION_IN_FRAMES. */
  cycles: number;
  motionBlur: boolean;
  dots: Dot[];
};

export type Field = {
  streams: Stream[];
  dotCount: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const BAND_WIDTH = WIDTH * (1 + 2 * STREAM_OVERSCAN);
const BAND_LEFT = -WIDTH * STREAM_OVERSCAN;
const SPAN_MIN = HEIGHT + 2 * WRAP_MARGIN_PX;
const BLUR_DENOMINATOR = Math.max(SHARP_Z - Z_MIN, Z_MAX - SHARP_Z);

const blurForDepth = (z: number) =>
  BLUR_MAX_PX * Math.pow(Math.abs(z - SHARP_Z) / BLUR_DENOMINATOR, BLUR_FALLOFF);

/**
 * Picks the wrap geometry for one stream.
 *
 * A stream loops seamlessly when its dot pattern travels a whole number of
 * pattern-lengths in DURATION_IN_FRAMES. Rather than quantise the *speed* to
 * hit that (which would flatten the parallax into a handful of discrete
 * bands), the pattern *length* absorbs the remainder: pick the largest whole
 * number of cycles that still leaves the pattern at least a frame-height
 * long, then stretch the pattern to fit. Speed stays exactly `z * base`.
 */
const wrapGeometry = (speed: number) => {
  const travelPerLoop = speed * DURATION_IN_FRAMES;
  if (travelPerLoop < SPAN_MIN) {
    // Only reachable if BASE_FALL_SPEED_PX is tuned below the floor
    // documented on it. Keep the loop seamless and give up exact speed.
    return { cycles: 1, span: SPAN_MIN, speed: SPAN_MIN / DURATION_IN_FRAMES };
  }
  const cycles = Math.floor(travelPerLoop / SPAN_MIN);
  return { cycles, span: travelPerLoop / cycles, speed };
};

const buildDots = (streamIndex: number, z: number, span: number): Dot[] => {
  const density = randSpan(`rain-density-${streamIndex}`, STREAM_DENSITY);
  // Near dots are bigger, so they need more room between them to keep the
  // apparent density of the field roughly even across depth.
  const spacing = DOT_SPACING_PX * (0.6 + 0.9 * z) * density;

  const dots: Dot[] = [];
  let s = randRange(`rain-phase-${streamIndex}`, 0, spacing);
  let index = 0;

  while (s < span) {
    const sizeVariance = randSpan(
      `rain-dot-size-${streamIndex}-${index}`,
      DOT_SIZE_VARIANCE,
    );
    const size = clamp(
      z * DOT_MAX_SIZE_PX * sizeVariance,
      DOT_MIN_SIZE_PX,
      DOT_MAX_SIZE_PX,
    );

    // Near streams skew brighter: the roll is compressed toward the bright
    // end of the tone list as z rises.
    const zNorm = (z - Z_MIN) / (Z_MAX - Z_MIN);
    const roll =
      rand(`rain-dot-tone-${streamIndex}-${index}`) * (1.3 - 0.55 * zNorm);
    const tone = roll < 0.05 ? 3 : roll < 0.35 ? 2 : roll < 0.7 ? 1 : 0;

    const period = randPick(
      `rain-twinkle-period-${streamIndex}-${index}`,
      TWINKLE_PERIODS,
    );

    dots.push({
      s0: s,
      size,
      tone,
      lateral: [],
      twinkleFreq: (Math.PI * 2) / period,
      twinklePhase: randRange(
        `rain-twinkle-phase-${streamIndex}-${index}`,
        0,
        Math.PI * 2,
      ),
      flareStart: -1,
      flareFrames: 0,
    });

    s += spacing * randSpan(`rain-gap-${streamIndex}-${index}`, DOT_GAP_JITTER);
    index += 1;
  }

  // The pattern wraps, so the gap between the last dot and the first dot's
  // next copy is whatever is left of the span. If that ran short the two
  // would sit on top of each other at the seam — drop the last dot.
  const last = dots[dots.length - 1];
  if (dots.length > 1 && span - last.s0 < spacing * DOT_GAP_JITTER.min) {
    dots.pop();
  }

  return dots;
};

export const buildField = (): Field => {
  const streams: Stream[] = [];
  let dotCount = 0;

  for (let i = 0; i < STREAM_COUNT; i++) {
    // Evenly-spaced slot plus a wide jitter: streams bunch into clusters and
    // leave gaps, but never leave a whole region of the frame empty.
    const slot = (i + 0.5) / STREAM_COUNT;
    const jitter =
      ((rand(`rain-stream-x-${i}`) - 0.5) * 2 * STREAM_CLUSTER_SPREAD) /
      STREAM_COUNT;
    const xc = BAND_LEFT + (slot + jitter) * BAND_WIDTH;

    // Shared lean for every stream, amplified toward the frame edges so the
    // outer columns splay and the field reads as perspective.
    const edge = clamp(Math.abs(xc - WIDTH / 2) / (WIDTH / 2), 0, 1.3);
    const leanDeg = LEAN_ANGLE_DEG + EDGE_LEAN_BOOST_DEG * edge;

    const z = randRange(`rain-stream-z-${i}`, Z_MIN, Z_MAX);
    const zNorm = (z - Z_MIN) / (Z_MAX - Z_MIN);
    const geometry = wrapGeometry(z * BASE_FALL_SPEED_PX);
    const dots = buildDots(i, z, geometry.span);

    for (let d = 0; d < dots.length; d++) {
      const lateral: number[] = [];
      for (let c = 0; c < geometry.cycles; c++) {
        lateral.push(randRange(`rain-lateral-${i}-${d}-${c}`, -1, 1));
      }
      dots[d].lateral = lateral;
    }

    dotCount += dots.length;

    streams.push({
      xc,
      tanLean: Math.tan((leanDeg * Math.PI) / 180),
      z,
      alpha: ALPHA_FAR + (ALPHA_NEAR - ALPHA_FAR) * zNorm,
      blurPx: blurForDepth(z),
      speed: geometry.speed,
      span: geometry.span,
      cycles: geometry.cycles,
      motionBlur: z > MOTION_BLUR_Z,
      dots,
    });
  }

  assignFlares(streams);

  return { streams, dotCount };
};

/**
 * Flares are baked onto the dots themselves so the draw loop costs nothing
 * to look them up. Start frames live in [0, DURATION_IN_FRAMES) and the
 * active test wraps modulo the loop, so a flare straddling the seam plays
 * across it unbroken.
 */
const assignFlares = (streams: Stream[]) => {
  const count = Math.round((FLARES_PER_SECOND * DURATION_IN_FRAMES) / FPS);
  for (let f = 0; f < count; f++) {
    const stream = streams[randInt(`rain-flare-stream-${f}`, 0, streams.length - 1)];
    if (stream.dots.length === 0) continue;
    const dot = stream.dots[randInt(`rain-flare-dot-${f}`, 0, stream.dots.length - 1)];
    dot.flareStart = randInt(`rain-flare-start-${f}`, 0, DURATION_IN_FRAMES - 1);
    dot.flareFrames = randInt(
      `rain-flare-length-${f}`,
      FLARE_MIN_FRAMES,
      FLARE_MAX_FRAMES,
    );
  }
};

/** Exported for the draw loop; kept here so the tone list and the field stay
 *  in one place. */
export const TONE_COUNT = DOT_TONES.length;

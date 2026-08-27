import {useCurrentFrame} from 'remotion';
import {smoothstep} from './space';

export const LOOP = 480;
export const FPS = 30;

/** Frames 0-30 are background only. */
export const EMPTY_UNTIL = 30;
/** The figure has fully settled by here. */
export const ASSEMBLE_UNTIL = 120;
/**
 * The figure drifts back out to the scatter it came from over the last two
 * seconds. A loop whose first frame is "empty background only" can only be
 * seamless if the final frame is empty too, so the idle runs 120-420 and the
 * dissolve mirrors the assembly.
 */
export const DISSOLVE_FROM = 420;

const ASSEMBLE_SPAN = 45;
const ASSEMBLE_STAGGER = ASSEMBLE_UNTIL - EMPTY_UNTIL - ASSEMBLE_SPAN; // 45
const DISSOLVE_SPAN = 30;
const DISSOLVE_STAGGER = LOOP - DISSOLVE_FROM - DISSOLVE_SPAN; // 30

/** Divides 360 and 480: the breath is in phase at both ends of the loop. */
export const BREATH_PERIOD = 120;
export const BREATH_AMPLITUDE = 0.008;

/** Every twinkle period divides 480. */
export const TWINKLE_PERIODS = [80, 96, 120, 160, 240] as const;

/** 480 / 160 = 3 respawn slots per loop. */
export const RESPAWN_PERIOD = 160;
export const RESPAWN_SLOTS = LOOP / RESPAWN_PERIOD;
export const RESPAWN_FRACTION = 0.03;

/**
 * Presence of one particle, 0 at frame 0 and 0 again at frame 480.
 * `delay` in [0,1) staggers it.
 */
export const presence = (frame: number, delay: number): number => {
  const aStart = EMPTY_UNTIL + delay * ASSEMBLE_STAGGER;
  const dStart = DISSOLVE_FROM + delay * DISSOLVE_STAGGER;
  const rise = smoothstep(aStart, aStart + ASSEMBLE_SPAN, frame);
  const fall = 1 - smoothstep(dStart, dStart + DISSOLVE_SPAN, frame);
  return Math.min(rise, fall);
};

/** ±0.8% scale oscillation; period 120 divides both 360 and 480. */
export const breathScale = (frame: number): number =>
  1 + BREATH_AMPLITUDE * Math.sin((2 * Math.PI * frame) / BREATH_PERIOD);

/**
 * Frame number wrapped into [0, LOOP). Every layer uses this instead of
 * useCurrentFrame() so that frame 480 evaluates bit-for-bit identically to
 * frame 0 — sin(8*PI) is not exactly sin(0) in floating point, and that alone
 * is enough to break a pixel-exact loop.
 */
export const useLoopFrame = (): number => {
  const frame = useCurrentFrame();
  return ((frame % LOOP) + LOOP) % LOOP;
};

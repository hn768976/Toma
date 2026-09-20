import {
  clamp,
  easeInOutCubic,
  easeOutCubic,
  easeOutQuint,
  flash as flashCurve,
  lerp,
  noise1,
  remap,
  smootherstep,
  smoothstep,
  springSettle,
} from './engine/easing';
import type { Theme } from './themes';

/** Y of the chip group once it is seated in the socket. */
export const SEAT_Y = 0.46;

/**
 * Everything the scene needs to know about a given instant, derived purely
 * from `seconds`. No state carries between frames, which is what makes the
 * render safe to distribute across browser tabs.
 */
export interface FrameState {
  seconds: number;
  progress: number;

  /** World-space Y of the chip group. */
  chipY: number;
  /** Radians of residual tilt as the chip aligns to the socket. */
  chipTiltX: number;
  chipTiltZ: number;
  chipSpin: number;
  /** 0 while airborne, 1 once fully seated. */
  seated: number;

  /** Die emissive ramp, 0 -> 1. */
  ignite: number;
  /** Sustained board energy after the wave has passed. */
  energy: number;

  /** Wavefront radius in routing-plane UV units (0 = socket, ~0.72 = corner). */
  waveRadius: number;
  /** Emissive multiplier at the wavefront, decays into the sustain level. */
  waveGlow: number;

  /** Seating impact flash, 0 -> 1 -> 0. */
  flash: number;
  /** Expanding shockwave ring. */
  ringScale: number;
  ringAlpha: number;
  /** Second, slower ring for a layered pulse. */
  ring2Scale: number;
  ring2Alpha: number;

  /** Light shafts beneath the descending chip. */
  beam: number;
  /** Radial streams racing outward along the routing. */
  streamEnergy: number;

  exposure: number;
  /** Deterministic handheld offset applied to the camera. */
  drift: [number, number, number];
}

export const computeFrameState = (theme: Theme, seconds: number): FrameState => {
  const { startY, descendStart, seat, waveEnd, settle } = theme.beats;
  const duration = theme.durationInSeconds;
  const t = seconds;

  // --- chip approach ----------------------------------------------------
  const approachRaw = remap(t, descendStart, seat, 0, 1);
  // Slow start, quick middle, cushioned landing.
  const approach = easeInOutCubic(approachRaw);
  const hover = t < seat ? Math.sin(t * 2.1) * 0.06 * (1 - approach) : 0;

  // After touchdown the package settles with a tiny damped bounce.
  const settleT = remap(t, seat, seat + 0.5, 0, 1);
  const bounce = t >= seat ? (1 - springSettle(settleT, 26, 11)) * 0.16 : 0;

  const chipY = lerp(startY, SEAT_Y, approach) + hover + bounce;

  const tiltFade = 1 - easeOutCubic(remap(t, descendStart, seat - 0.12, 0, 1));
  const chipTiltX = 0.085 * tiltFade;
  const chipTiltZ = -0.055 * tiltFade;
  // A slow quarter-turn alignment while airborne.
  const chipSpin = lerp(0.14, 0, easeInOutCubic(approachRaw));

  const seated = smoothstep(seat - 0.05, seat + 0.05, t);

  // --- ignition ---------------------------------------------------------
  const ignite =
    theme.chip.preGlow * smoothstep(descendStart, descendStart + 0.6, t) +
    (1 - theme.chip.preGlow) * smootherstep(seat - 0.02, seat + 0.42, t);

  const energy = smootherstep(seat, seat + 0.55, t);

  // --- energy wave ------------------------------------------------------
  // Fast expansion that decelerates, like a pressure front losing speed.
  const waveT = remap(t, seat, waveEnd, 0, 1);
  const waveRadius = easeOutQuint(waveT) * 0.78;
  const waveGlow = lerp(theme.board.waveGlow, 1, smootherstep(seat, settle, t));

  // --- impact -----------------------------------------------------------
  const flash = flashCurve(t, seat, 0.055, 0.2) * theme.energy.flashStrength;

  const ringT = remap(t, seat, seat + 1.5, 0, 1);
  const ringScale = 1 + easeOutQuint(ringT) * 22;
  const ringAlpha = (1 - smootherstep(0, 1, ringT)) * (t >= seat ? 1 : 0);

  const ring2T = remap(t, seat + 0.22, seat + 2.3, 0, 1);
  const ring2Scale = 1 + easeOutQuint(ring2T) * 34;
  const ring2Alpha = (1 - smootherstep(0, 1, ring2T)) * 0.6 * (t >= seat + 0.22 ? 1 : 0);

  // --- beams under the descending package -------------------------------
  const beam =
    theme.chip.beamStrength *
    smoothstep(descendStart, descendStart + 0.45, t) *
    (1 - smoothstep(seat - 0.3, seat + 0.02, t));

  const streamEnergy = smootherstep(seat - 0.02, seat + 0.3, t);

  const exposure = theme.post.exposure * (1 + flash * 0.14);

  // --- camera drift -----------------------------------------------------
  const a = theme.cameraDrift;
  const drift: [number, number, number] = [
    noise1(t * 0.45, 11) * a,
    noise1(t * 0.38, 27) * a * 0.7,
    noise1(t * 0.41, 53) * a,
  ];

  return {
    seconds: t,
    progress: clamp(t / duration),
    chipY,
    chipTiltX,
    chipTiltZ,
    chipSpin,
    seated,
    ignite: clamp(ignite),
    energy,
    waveRadius,
    waveGlow,
    flash,
    ringScale,
    ringAlpha,
    ring2Scale,
    ring2Alpha,
    beam,
    streamEnergy,
    exposure,
    drift,
  };
};

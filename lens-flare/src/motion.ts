/**
 * Every number the shader needs for a given frame. Pure -- no state, no
 * Math.random, no dependence on render order.
 */
export type FlareState = {
  t: number;
  src: [number, number];
  env: number;
  gate: number;
  roll: number;
  ringAmt: number;
};

const smoothstep = (a: number, b: number, x: number) => {
  const u = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return u * u * (3 - 2 * u);
};

const mix = (a: number, b: number, x: number) => a + (b - a) * x;

/** Peak of the swell, as a fraction of the clip. Frame 180 of 450. */
const PEAK = 0.4;

export const flareState = (
  frame: number,
  durationInFrames: number,
  aspect: number,
): FlareState => {
  const t = Math.min(1, Math.max(0, frame / (durationInFrames - 1)));

  // The source crosses the top of frame once, from beyond the upper-left
  // corner toward the upper right. Mostly linear with a light ease at both
  // ends -- a pure smoothstep drifts into "animated" territory, and this is
  // meant to read as a slow, steady pass.
  // Weighted toward the back half of the clip, so the flare is still firmly in
  // the upper left through the peak and only drifts right as it subsides.
  const travel = 0.75 * Math.pow(t, 1.45) + 0.25 * t;
  const sx = mix(-0.34, aspect * 0.6, travel);

  // The source also swings very slightly closer to the frame around the peak,
  // which is the same event as the swell rather than a second one.
  const sy = mix(-0.135, -0.072, Math.sin(Math.PI * Math.pow(t, 0.85)));

  // One swell: up to full at the peak, then a longer subside. Both halves are
  // smoothsteps so the derivative is zero at the top and there is no corner.
  const env =
    t < PEAK
      ? mix(0.3, 1.0, smoothstep(0, 1, t / PEAK))
      : mix(1.0, 0.24, smoothstep(0, 1, (t - PEAK) / (1 - PEAK)));

  // A single very slow undulation on top, ~1 cycle over the clip, so the swell
  // is not a bare bell curve. Far too slow to read as flicker.
  const breathe = 1 + 0.055 * Math.sin(t * Math.PI * 2 - 1.1);

  // Clip-edge fade. The plate has to start and end at true black so it can be
  // cut against anything.
  const gate = smoothstep(0, 0.055, t) * smoothstep(1, 0.9, t);

  // Lens roll. Rotates the anamorphic streak and the ray fan together, coupled
  // to the source's travel -- the streaks are part of the same optic, not a
  // separate moving layer.
  const roll = mix(-0.038, 0.028, travel);

  // The iris ring only appears in the brighter half.
  const ringAmt = smoothstep(0.56, 0.86, env * breathe);

  return { t, src: [sx, sy], env: env * breathe, gate, roll, ringAmt };
};

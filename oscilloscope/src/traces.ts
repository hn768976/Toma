import {
  AM_CYCLES_PER_LOOP,
  AM_DEPTH,
  BANDS,
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  DURATION_IN_FRAMES,
  SAMPLE_STEP_NOISE,
  SAMPLE_STEP_SMOOTH,
  SCROLL_PER_FRAME,
  SINE_MAIN_WAVELENGTH,
  SINE_SECOND_WAVELENGTH,
  SQUARE_WAVELENGTH,
} from "./constants";
import { noiseBottom, noiseTop, sineFuzz, squarePath, wavePath } from "./signal";
import type { TraceKey } from "./theme";

const TAU = Math.PI * 2;
const y = (fraction: number) => fraction * DESIGN_HEIGHT;

export type Trace = { key: TraceKey; d: string };

/**
 * Regenerates every trace for a single frame. All five are pure functions of
 * `frame` alone, which is what lets Remotion render frames out of order across
 * threads and still get an identical result -- and what lets
 * `scripts/verify-loop.mjs` prove the loop is seamless without rendering a
 * single pixel.
 */
export const buildTraces = (frame: number): Trace[] => {
  const scroll = frame * SCROLL_PER_FRAME;
  const width = DESIGN_WIDTH;
  const loopPhase = frame / DURATION_IN_FRAMES;

  // Breathes twice per loop, so it returns to its starting amplitude exactly
  // at the loop point.
  const am =
    1 + AM_DEPTH * Math.sin(TAU * AM_CYCLES_PER_LOOP * loopPhase);

  const topCenter = y(BANDS.noiseTop.center);
  const topAmp = y(BANDS.noiseTop.amplitude);
  const sineCenter = y(BANDS.sine.center);
  const sineAmp = y(BANDS.sine.amplitude);
  const secondAmp = y(BANDS.sineSecondary.amplitude);
  const bottomCenter = y(BANDS.noiseBottom.center);
  const bottomAmp = y(BANDS.noiseBottom.amplitude);

  return [
    {
      key: "noiseTop",
      d: wavePath({
        scroll,
        width,
        step: SAMPLE_STEP_NOISE,
        valueAt: (wx) => topCenter + noiseTop(wx) * topAmp,
      }),
    },
    {
      key: "sineSecondary",
      d: wavePath({
        scroll,
        width,
        step: SAMPLE_STEP_SMOOTH,
        // A different wavelength and a quarter-cycle phase offset, so the two
        // sines beat against each other exactly once per loop.
        valueAt: (wx) =>
          sineCenter +
          (Math.sin((wx / SINE_SECOND_WAVELENGTH) * TAU + Math.PI / 2) +
            sineFuzz(wx) * 0.14) *
            secondAmp,
      }),
    },
    {
      key: "sineMain",
      d: wavePath({
        scroll,
        width,
        step: SAMPLE_STEP_SMOOTH,
        valueAt: (wx) =>
          sineCenter +
          Math.sin((wx / SINE_MAIN_WAVELENGTH) * TAU) * sineAmp * am,
      }),
    },
    {
      key: "square",
      d: squarePath({
        scroll,
        width,
        wavelength: SQUARE_WAVELENGTH,
        center: y(BANDS.square.center),
        amplitude: y(BANDS.square.amplitude),
      }),
    },
    {
      key: "noiseBottom",
      d: wavePath({
        scroll,
        width,
        step: SAMPLE_STEP_NOISE,
        valueAt: (wx) => bottomCenter + noiseBottom(wx) * bottomAmp,
      }),
    },
  ];
};

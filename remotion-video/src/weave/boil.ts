import { DURATION_IN_FRAMES } from "./constants";
import type { WeaveVariant } from "./presets";

/**
 * The "boil": the references are not continuous motion but a short cycle of
 * macro stills hard-cut on a fixed hold. Everything the shader sees for a
 * given frame is a pure function of the state index, and the state index cycles
 * within the clip length -- which is exactly why the result loops seamlessly.
 */
export type BoilState = {
  stateIndex: number;
  jitter: [number, number];
  seed: number;
  stateExposure: number;
};

/** Deterministic scalar in [0, 1) from an integer state and a channel. */
const stateRandom = (stateIndex: number, channel: number): number => {
  let h = Math.imul(stateIndex + 1, 0x27d4eb2d) ^ Math.imul(channel + 1, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x2545f491);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
};

export const getBoilState = (frame: number, variant: WeaveVariant): BoilState => {
  const { holdInFrames, states, jitterAmount, exposureWobble } = variant;

  // Guard the loop invariant: the clip must contain a whole number of cycles,
  // otherwise frame 300 would not cut back to frame 0 cleanly.
  const steps = DURATION_IN_FRAMES / holdInFrames;
  if (!Number.isInteger(steps) || steps % states !== 0) {
    throw new Error(
      `Boil cadence does not loop: ${DURATION_IN_FRAMES} frames / ${holdInFrames}-frame hold = ` +
        `${steps} steps, which is not a whole multiple of ${states} states. ` +
        `Pick a hold and state count where (${DURATION_IN_FRAMES} / hold) % states === 0.`,
    );
  }

  // Wrap the frame first so the state is identical at frame 0 and frame 300.
  const wrapped = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
  const stateIndex = Math.floor(wrapped / holdInFrames) % states;

  // Each state is a different piece of the same cloth: shift into it far enough
  // that a new set of threads is under every pixel, with a fractional part so
  // the sub-thread phase changes too rather than the pattern merely sliding.
  const angle = stateRandom(stateIndex, 0) * Math.PI * 2;
  const radius = (0.35 + 0.65 * stateRandom(stateIndex, 1)) * jitterAmount;

  return {
    stateIndex,
    jitter: [
      Math.cos(angle) * radius + stateRandom(stateIndex, 4) * 0.5,
      Math.sin(angle) * radius + stateRandom(stateIndex, 5) * 0.5,
    ],
    // Large, well-separated seeds so no two states share a noise field.
    seed: stateRandom(stateIndex, 2) * 512 + stateIndex * 17.317,
    stateExposure: 1 + (stateRandom(stateIndex, 3) - 0.5) * 2 * exposureWobble,
  };
};

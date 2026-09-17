import type { SegmentBatch } from "./lines";
import {
  RETICLE_BLINK_HOLD,
  RETICLE_BLINK_OFF,
  RETICLE_BLINK_ON,
  RETICLE_BLINK_PERIOD_SEC,
  RETICLE_BLINK_TAIL,
  RETICLE_BRACKET,
} from "./constants";

// The red target-lock bracket that sits around each aircraft.
//
// It is a square in the aircraft's own horizontal plane, not a screen-space
// box: in the references the bracket rotates with each jet's heading and is
// foreshortened by the camera's downward angle, which only happens if it
// lies flat in the world alongside the aircraft.
//
// Built once as a unit square centred on the origin in XZ, then carried to
// each aircraft by that aircraft's own transform.
const CORNERS: [number, number][] = [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5],
];

export const buildReticle = (): SegmentBatch => {
  const starts: number[] = [];
  const ends: number[] = [];

  // Two segments per side, one running in from each corner, leaving the
  // middle of every edge open — the classic corner-bracket target box.
  for (let i = 0; i < CORNERS.length; i++) {
    const [px, pz] = CORNERS[i];
    const [qx, qz] = CORNERS[(i + 1) % CORNERS.length];
    const dx = qx - px;
    const dz = qz - pz;

    starts.push(px, 0, pz);
    ends.push(px + dx * RETICLE_BRACKET, 0, pz + dz * RETICLE_BRACKET);

    starts.push(qx, 0, qz);
    ends.push(qx - dx * RETICLE_BRACKET, 0, qz - dz * RETICLE_BRACKET);
  }

  return {
    starts: new Float32Array(starts),
    ends: new Float32Array(ends),
    count: starts.length / 3,
  };
};

// Blink envelope, as a multiplier on the reticle's opacity.
//
// Sampled off reference A: the bracket appears at full brightness on a
// 1.000s cycle, holds briefly, fades roughly linearly to about a third of
// peak, then cuts out for the rest of the second. It is a hard cut, not a
// fade to zero — the measured peak red channel goes 93 -> 36 -> 0 in two
// frames at 60fps.
export const reticleBlink = (timeSec: number): number => {
  const phase = (timeSec % RETICLE_BLINK_PERIOD_SEC) / RETICLE_BLINK_PERIOD_SEC;
  if (phase < RETICLE_BLINK_ON || phase >= RETICLE_BLINK_OFF) return 0;

  const u = (phase - RETICLE_BLINK_ON) / (RETICLE_BLINK_OFF - RETICLE_BLINK_ON);
  if (u < RETICLE_BLINK_HOLD) return 1;

  const decay = (u - RETICLE_BLINK_HOLD) / (1 - RETICLE_BLINK_HOLD);
  return 1 + (RETICLE_BLINK_TAIL - 1) * decay;
};

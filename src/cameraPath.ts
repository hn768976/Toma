import {CONFIG} from './config';

const DEG = Math.PI / 180;

export type CameraPose = {
  position: [number, number, number];
  /** World-space point the camera looks at. */
  target: [number, number, number];
};

/**
 * The whole camera move as a pure function of normalized time t = frame / duration.
 *
 *   x: ±driftAmpX on a slow sine (handheld lateral drift)
 *   y: baseY + rise·t (slow climb, horizon drops)
 *   z: startZ + travel·t (constant forward dolly)
 *   yaw: sub-degree sine matched to the drift
 *   pitch: constant pitchDownDeg — horizon sits in the upper third
 *
 * No easing, no cuts: constant, unhurried.
 */
export const cameraPose = (t: number): CameraPose => {
  const c = CONFIG.camera;
  const phase = t * c.driftCycles * Math.PI * 2;

  const x = c.driftAmpX * Math.sin(phase);
  const y = c.baseY + c.rise * t;
  const z = c.startZ + c.travel * t;

  const yaw = c.yawDeg * DEG * Math.sin(phase + Math.PI / 3);
  const pitch = c.pitchDownDeg * DEG;

  const ahead = 60;
  return {
    position: [x, y, z],
    target: [
      x + ahead * Math.sin(yaw),
      y - ahead * Math.tan(pitch),
      z + ahead * Math.cos(yaw),
    ],
  };
};

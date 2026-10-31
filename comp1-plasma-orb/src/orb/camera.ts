import { Easing, interpolate } from "remotion";

export type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
  roll: number;
  fov: number;
};

/** Version 1: locked-off frontal shot, matching the reference. */
export const staticCamera = (): CameraPose => ({
  position: [0, 0, 4.45],
  target: [0, 0, 0],
  roll: 0,
  fov: 50,
});

/**
 * Version 2: slow orbit + push-in. The camera swings ~115 degrees around the
 * orb while rising, and dollies from a wide shot into a close-up, so the dust
 * field parallaxes past the lens and the orb's 3D structure is revealed.
 */
export const orbitCamera = (frame: number, durationInFrames: number): CameraPose => {
  const p = frame / (durationInFrames - 1);
  const ease = Easing.inOut(Easing.sin);
  const az = interpolate(p, [0, 1], [-1.15, 0.85], { easing: ease });
  const el = interpolate(p, [0, 1], [-0.22, 0.34], { easing: ease });
  const dist = interpolate(p, [0, 1], [6.6, 2.6], { easing: ease });
  const x = dist * Math.cos(el) * Math.sin(az);
  const y = dist * Math.sin(el);
  const z = dist * Math.cos(el) * Math.cos(az);
  return {
    position: [x, y, z],
    target: [0.0, 0.0, 0.0],
    roll: interpolate(p, [0, 1], [0.05, -0.06], { easing: ease }),
    fov: 50,
  };
};

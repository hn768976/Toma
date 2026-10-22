import { CameraPose, FinDomeProps, REFERENCE_CAMERA, finDomeDefaults } from "./FinDome";

// Rotate a point around a vertical axis through `pivot`.
const orbit = (
  [x, y, z]: [number, number, number],
  pivot: [number, number, number],
  angle: number,
): [number, number, number] => {
  const dx = x - pivot[0];
  const dz = z - pivot[2];
  return [
    pivot[0] + dx * Math.cos(angle) + dz * Math.sin(angle),
    y,
    pivot[2] - dx * Math.sin(angle) + dz * Math.cos(angle),
  ];
};

// The fan's hub, on its spin axis.
const HUB: [number, number, number] = [0, 0, 0];
const ORBIT_ANGLE = (-45 * Math.PI) / 180;

// Version B: same fan, palette and timing, but the camera cranes up and
// orbits 45 degrees around the hub (with the blades' drift, so the fan
// appears to wheel past faster), levelling its roll and pulling focus as
// it goes. It starts on the reference framing and ends looking down
// into the fan from above the rim.
const ORBIT_END: CameraPose = {
  position: orbit([-2.5, 4.5, 7.5], HUB, ORBIT_ANGLE),
  target: orbit([-1.2, -0.6, 0], HUB, ORBIT_ANGLE),
  fov: 48,
  roll: 0,
  focus: 5,
};

export const orbitVariantProps: FinDomeProps = {
  ...finDomeDefaults,
  cameraStart: REFERENCE_CAMERA,
  cameraEnd: ORBIT_END,
  // Shallower defocus than A, so the fan stays readable from higher up.
  focusScale: 7,
};

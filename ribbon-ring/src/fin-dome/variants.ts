import { CameraPose, FinDomeProps, REFERENCE_CAMERA, finDomeDefaults } from "./FinDome";

// Rotate a point around the dome's vertical axis.
const orbit = ([x, y, z]: [number, number, number], angle: number): [number, number, number] => [
  x * Math.cos(angle) + z * Math.sin(angle),
  y,
  -x * Math.sin(angle) + z * Math.cos(angle),
];

const ORBIT_ANGLE = (-48 * Math.PI) / 180;

// Version B: same dome, palette and timing, but the camera cranes up and
// orbits ~48 degrees around the hub (against the blades' spin, so the
// motion reads clearly), drifting from the reference's low grazing angle
// to a higher view looking down into the fan of blades, with a slight
// roll and a focus pull that tracks the change in distance.
const ORBIT_END: CameraPose = {
  position: orbit([1.2, 3.6, 5.2], ORBIT_ANGLE),
  target: orbit([-1.2, 1.4, 0], ORBIT_ANGLE),
  fov: 44,
  roll: -0.12,
  focus: 3.3,
};

export const orbitVariantProps: FinDomeProps = {
  ...finDomeDefaults,
  cameraStart: REFERENCE_CAMERA,
  cameraEnd: ORBIT_END,
};

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

// The point the reference camera looks at, on the near stretch of ring.
const PIVOT = REFERENCE_CAMERA.target;
const ORBIT_ANGLE = (-40 * Math.PI) / 180;

// Version B: same ring, palette and timing, but the camera cranes up and
// orbits 40 degrees around the near stretch of fins, levelling its roll
// and pulling focus as it goes. It starts on the reference framing and
// ends looking down along the ring as it curves away.
const ORBIT_END: CameraPose = {
  position: orbit([-2, 8.5, 42], PIVOT, ORBIT_ANGLE),
  target: [PIVOT[0], PIVOT[1] - 0.5, PIVOT[2]],
  fov: 40,
  roll: 0,
  focus: 7,
};

export const orbitVariantProps: FinDomeProps = {
  ...finDomeDefaults,
  cameraStart: REFERENCE_CAMERA,
  cameraEnd: ORBIT_END,
};

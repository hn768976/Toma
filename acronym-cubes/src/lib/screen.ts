// Mapping between frame fractions (0..1 across, 0..1 down) and points on the
// paper (world x, z at y = 0), through the camera. Lets the chart and the
// light pattern be laid out in frame terms, like the reference.

import { Plane, Raycaster, Vector2, Vector3 } from "three";
import { cameraForFrame } from "./stills";

const MID_FRAME = 150; // the camera pushes in 2.5%; lay things out mid-clip
const plane = new Plane(new Vector3(0, 1, 0), 0);

export const screenToPaper = (fx: number, fy: number, frame = MID_FRAME): [number, number] => {
  const cam = cameraForFrame(frame);
  const rc = new Raycaster();
  rc.setFromCamera(new Vector2(fx * 2 - 1, 1 - fy * 2), cam);
  const p = new Vector3();
  rc.ray.intersectPlane(plane, p);
  return [p.x, p.z];
};

export const paperToScreen = (x: number, z: number, frame = MID_FRAME): [number, number] => {
  const v = new Vector3(x, 0, z).project(cameraForFrame(frame));
  return [(v.x + 1) / 2, (1 - v.y) / 2];
};

// One reusable camera for bulk projection (light-pattern generation).
export const makePaperToScreen = (frame = MID_FRAME) => {
  const cam = cameraForFrame(frame);
  const v = new Vector3();
  return (x: number, z: number): [number, number] => {
    v.set(x, 0, z).project(cam);
    return [(v.x + 1) / 2, (1 - v.y) / 2];
  };
};

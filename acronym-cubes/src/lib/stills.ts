// Which frames make the stills: frame 200 (at rest) and a mid-tumble frame
// where at least one cube is clearly in the air and fully inside the frame.

import { PerspectiveCamera, Vector3 } from "three";
import type { AcronymRow } from "../data/acronyms";
import { planCubes, poseAt, type CubePose } from "./motion";
import { CUBE, DURATION_IN_FRAMES, REST_STILL_FRAME, cameraAt } from "./world";

export const cubeCorners = (pose: CubePose) => {
  const out: Vector3[] = [];
  for (const x of [-0.5, 0.5])
    for (const y of [-0.5, 0.5])
      for (const z of [-0.5, 0.5])
        out.push(
          new Vector3(x, y, z)
            .multiplyScalar(CUBE)
            .applyQuaternion(pose.quaternion)
            .add(pose.position),
        );
  return out;
};

export const cameraForFrame = (frame: number, aspect = 16 / 9) => {
  const c = cameraAt(frame);
  const cam = new PerspectiveCamera(c.fov, aspect, 0.1, 100);
  cam.position.set(...c.position);
  cam.lookAt(...c.lookAt);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
};

export const inFrame = (p: Vector3, cam: PerspectiveCamera, margin = 0) => {
  const v = p.clone().project(cam);
  return Math.abs(v.x) < 1 - margin && Math.abs(v.y) < 1 - margin && v.z < 1;
};

export const midTumbleFrame = (row: AcronymRow): number => {
  const plans = planCubes(row);
  let best = -1;
  let bestScore = -Infinity;
  for (let f = 0; f < DURATION_IN_FRAMES; f++) {
    const poses = plans.map((p) => poseAt(p, f));
    const cam = cameraForFrame(f);
    const air = poses.filter(
      (p) =>
        p.phase === "air" &&
        p.lift > 0.5 &&
        cubeCorners(p).every((c) => inFrame(c, cam, 0.06)),
    );
    if (air.length === 0) continue;
    const onScreen = poses.filter((p) => p.visible && inFrame(p.position, cam)).length;
    const score = onScreen * 10 + Math.min(air[0].lift, 1.5);
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
  }
  return best;
};

export const stillFrames = (row: AcronymRow) => ({
  rest: REST_STILL_FRAME,
  tumble: midTumbleFrame(row),
});

// Camera path over the wall, and the plane-to-screen projection.
//
// The wall is a flat plane of LEDs at z = 0 in world space; the camera
// orbits it. Perspective is genuine rather than a CSS skew, because the
// dots have to shrink and crowd together as the panel recedes — that
// falloff is most of what sells the shot.

import { hash01 } from "../lib/random";
import { BASE_WIDTH, DURATION_IN_FRAMES, FOCAL } from "./constants";
import type { Glitch } from "./glitch";
import type { Layout } from "./layout";

export type Camera = {
  yaw: number;
  pitch: number;
  roll: number;
  dist: number;
  panU: number;
  panV: number;
};

const TAU = Math.PI * 2;

export const cameraAt = (
  frame: number,
  glitch: Glitch,
  layout: Layout,
): Camera => {
  const t = frame / DURATION_IN_FRAMES;

  // Slow continuous drift. The periods are deliberately unrelated so the
  // move never visibly repeats inside 7 seconds.
  const camera: Camera = {
    yaw: -0.2 + 0.105 * Math.sin(TAU * t + 0.55),
    pitch: 0.055 * Math.sin(TAU * t * 1.2 + 1.9),
    roll: -0.085 + 0.055 * Math.sin(TAU * t * 1.35 + 0.2),
    dist: layout.dist * (1 + 0.085 * Math.sin(TAU * t - 0.4)),
    panU: layout.centerU + 3.5 * Math.sin(TAU * t * 0.8 + 2.1),
    panV: layout.centerV + 2.2 * Math.sin(TAU * t * 1.1 + 0.9),
  };

  if (!glitch.active) return camera;

  // A corruption burst throws the camera as well as the image: the
  // whole rig snaps to a new attitude and holds there for the step.
  const k = glitch.intensity;
  const s = glitch.step;
  camera.yaw += (hash01(s, 1, 7) - 0.5) * 0.42 * k;
  camera.pitch += (hash01(s, 2, 7) - 0.5) * 0.2 * k;
  camera.roll += (hash01(s, 3, 7) - 0.5) * 0.55 * k;
  camera.dist *= 1 - 0.22 * k * hash01(s, 4, 7);
  camera.panU += (hash01(s, 5, 7) - 0.5) * 14 * k;
  camera.panV += (hash01(s, 6, 7) - 0.5) * 9 * k;
  return camera;
};

// Projects wall dots to screen pixels.
//
// This runs tens of thousands of times per frame, so it writes its result
// into fields on the projector instead of returning a fresh object —
// allocating here would dominate the render.
export type Projector = {
  x: number;
  y: number;
  scale: number; // pixels per dot unit at this depth
  visible: boolean;
  project: (u: number, v: number) => void;
};

export const makeProjector = (
  camera: Camera,
  width: number,
  height: number,
): Projector => {
  const cr = Math.cos(camera.roll);
  const sr = Math.sin(camera.roll);
  const cp = Math.cos(camera.pitch);
  const sp = Math.sin(camera.pitch);
  const cy = Math.cos(camera.yaw);
  const sy = Math.sin(camera.yaw);
  const originX = width / 2;
  const originY = height / 2;
  const focal = FOCAL * (width / BASE_WIDTH);
  const { panU, panV, dist } = camera;

  const projector: Projector = {
    x: 0,
    y: 0,
    scale: 0,
    visible: false,
    project(u: number, v: number) {
      const px = u - panU;
      const py = v - panV;

      const rx = px * cr - py * sr;
      const ry = px * sr + py * cr;

      // Pitch about X. The point starts on the plane (z = 0), so the
      // pitched z depends only on ry.
      const y2 = ry * cp;
      const z2 = ry * sp;

      // Yaw about Y.
      const x3 = rx * cy + z2 * sy;
      const z3 = -rx * sy + z2 * cy;

      const z = z3 + dist;
      if (z < 20) {
        projector.visible = false;
        return;
      }
      const s = focal / z;
      projector.x = originX + x3 * s;
      projector.y = originY + y2 * s;
      projector.scale = s;
      projector.visible = true;
    },
  };
  return projector;
};

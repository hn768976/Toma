import * as THREE from "three";
import type { ColonWorld } from "../three/ColonWorld";
import { DEFAULT_POST, FrameState, Shot, shotToView, Story } from "./common";

// Debug composition for the model checks (not a deliverable): one preset view
// per frame. Frames 0-11 show the cutaway; 12-23 repeat them with the
// centreline drawn through the model.
const VIEWS: Shot[] = [
  { target: [0, 0, 0], dist: 27, yaw: 0, pitch: 0, fov: 30, aperture: 0, maxCoc: 0 },
  { target: [0, 0, 0], dist: 27, yaw: 25, pitch: -20, fov: 30, aperture: 0, maxCoc: 0 },
  { target: [0, 0, 0], dist: 27, yaw: -30, pitch: 25, fov: 30, aperture: 0, maxCoc: 0 },
  { target: [0, 0, 0], dist: 27, yaw: 55, pitch: 10, fov: 30, aperture: 0, maxCoc: 0 },
  { target: [0.8, -1.8, -0.7], dist: 9, yaw: 10, pitch: -25, fov: 30, aperture: 0, maxCoc: 0 }, // sigmoid
  { target: [-0.6, -3.9, -0.7], dist: 6, yaw: -25, pitch: 30, fov: 30, aperture: 0, maxCoc: 0 }, // rectal end
  { target: [-2.4, 3.3, 0], dist: 7, yaw: -20, pitch: 20, fov: 30, aperture: 0, maxCoc: 0 }, // hepatic flexure
  { target: [2.6, 3.3, 0], dist: 7, yaw: 25, pitch: 25, fov: 30, aperture: 0, maxCoc: 0 }, // splenic flexure
  { target: [-3.0, 0.0, -0.5], dist: 7, yaw: -30, pitch: -15, fov: 30, aperture: 0, maxCoc: 0 }, // caecum
  { target: [3.4, 0.5, -0.7], dist: 7, yaw: 40, pitch: 0, fov: 30, aperture: 0, maxCoc: 0 }, // descending, side
  { target: [0.0, 3.2, 1.2], dist: 6, yaw: 0, pitch: 50, fov: 30, aperture: 0, maxCoc: 0 }, // transverse from above
  { target: [0, 0, 0], dist: 27, yaw: 0, pitch: -40, fov: 30, aperture: 0, maxCoc: 0 },
];

export const modelCheckStory: Story = {
  id: "Colon-ModelCheck",
  durationInFrames: 24,
  update(world: ColonWorld, f: number): FrameState {
    world.setPatches([]);
    world.setDebugLine(f >= 12);
    for (const g of [...world.molecules, ...world.cool, world.rods, world.cocci, world.spikes, world.clumps])
      for (let i = 0; i < g.count; i++) g.hide(i);
    if (f >= 12) {
      // centreline drawn as a chain of glowing beads through the model
      const q = new THREE.Quaternion();
      const blue = new THREE.Color(0.15, 0.35, 1.0);
      for (let i = 0; i < world.cocci.count; i++) {
        world.cocci.set(i, world.cl.point(i / (world.cocci.count - 1)), q, 0.045, blue, 1, 2.5, 0);
      }
    }
    return { view: shotToView(VIEWS[f % 12], f, 0, f), post: { ...DEFAULT_POST, grain: 0 } };
  },
};

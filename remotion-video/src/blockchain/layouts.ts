// Camera rigs. Both versions share every scene element and only differ
// in where the chain runs and how the camera moves along it.
//
// Version A ("diagonal") reproduces the reference: the chain recedes
// toward the upper right with the nearest cube large in the lower
// left, and the camera dollies forward down the chain.
//
// Version B ("hero") runs the chain left-to-right across the middle of
// frame with one hero cube foreground-left, and the camera trucks
// sideways rather than pushing in. The lower third is deliberately
// kept clear of cubes so titles can sit there later.

import * as THREE from "three/webgpu";
import type { Layout } from "./constants";

export type CameraState = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
};

export type LayoutConfig = {
  // Unit vector the chain runs along, pointing away from the camera.
  direction: THREE.Vector3;
  origin: THREE.Vector3;
  // Yaw applied to every cube, so we always see two faces.
  cubeYaw: number;
  // Chain arc-length window that is populated with cubes. Values are
  // multiples of the world unit, measured from `origin` along
  // `direction`.
  sMin: number;
  // Where the background dot-map plane sits and how big it is.
  mapCenter: THREE.Vector3;
  mapSize: [number, number];
  mapYaw: number;
  // Floor of glowing data marks.
  floorY: number;
  // Depth of field, in world units along the camera's look direction.
  // focusDistance is the sharp plane; focalLength is how far past it
  // something has to be before it is fully defocused.
  focusDistance: number;
  focalLength: number;
  // Bokeh radius in pixels at 1080p; scaled by resolution at use.
  bokeh: number;
  camera: (progress: number) => CameraState;
};

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

// Smooth, non-looping ease used for the slow camera drift. Cheap
// substitute for a hand-animated curve: constant velocity in the
// middle, gentle ease at both ends so the clip can be cut anywhere.
const easeDrift = (t: number) => t * t * (3 - 2 * t);

const DIAGONAL: LayoutConfig = {
  // Two things have to hold at once, and they pull against each other.
  // The chain must stay close to flat across frame (in the reference
  // the near cube and the far end are within a few per cent of the
  // same height), which wants a level camera -- tilting down drives
  // the chain's vanishing point up the frame and makes it climb. But
  // the camera also has to sit above the cube tops, or the cubes are
  // seen edge-on and the run merges into one continuous ribbon
  // instead of reading as separate blocks.
  //
  // So: an almost level camera (about 1.5 degrees down) placed a
  // little above the top face, and a chain axis held around 45 deg
  // off the view direction -- shallower than that and consecutive
  // cubes overlap each other rather than stepping apart.
  direction: v(0.66, 0.02, -0.75).normalize(),
  origin: v(0, 0, 0),
  cubeYaw: THREE.MathUtils.degToRad(-34),
  // Cubes leave the run well outside the left edge, so the fade-out
  // never happens on screen.
  sMin: -6.5,
  mapCenter: v(4.5, 0.3, -26),
  mapSize: [31, 15.5],
  mapYaw: THREE.MathUtils.degToRad(-26),
  floorY: -1.55,
  // Sharp on the second and third cube of the run, with the near cube
  // and the far end falling off -- the reference's long-lens look.
  focusDistance: 9.5,
  focalLength: 9,
  bokeh: 9,
  camera: (progress) => {
    // Gentle forward dolly along the chain axis. The conveyor already
    // streams cubes toward the lens, so the camera only needs to add
    // parallax -- pushing harder would make the framing drift over the
    // 20s rather than hold like the reference.
    const push = easeDrift(progress) * 1.3;
    const sway = Math.sin(progress * Math.PI * 2) * 0.14;
    return {
      position: v(1.05 + push * 0.66 + sway, 0.64 + push * 0.02, 9.01 - push * 0.75),
      target: v(0.52 + push * 0.66, -0.05 + push * 0.02, -0.4 - push * 0.75),
      fov: 36,
    };
  },
};

const HERO: LayoutConfig = {
  // Runs across the frame rather than away from the lens, but with
  // enough depth that cubes still fall off in size -- a purely lateral
  // axis reads as a flat filmstrip, not a chain in space.
  direction: v(0.88, 0.02, -0.47).normalize(),
  origin: v(0, 0.35, 0),
  cubeYaw: THREE.MathUtils.degToRad(-27),
  // Reaches further back toward the camera than the diagonal layout,
  // which is what gives the left-hand hero cube its size.
  sMin: -5,
  mapCenter: v(3, 2.2, -30),
  mapSize: [34, 17],
  mapYaw: THREE.MathUtils.degToRad(-6),
  floorY: -3.2,
  // Shallower than the diagonal layout: the hero cube is the subject,
  // so the run softens off behind it.
  focusDistance: 7.8,
  focalLength: 7,
  bokeh: 7,
  camera: (progress) => {
    // Lateral truck: the camera slides along the chain rather than
    // pushing into it, so the hero cube holds its size.
    const truck = easeDrift(progress) * 3.1;
    const rise = Math.sin(progress * Math.PI) * 0.16;
    return {
      position: v(-2.4 + truck, 1.0 + rise, 7.6),
      // Aiming *below* the chain is what lifts it onto the upper-third
      // line -- the subject moves opposite to where the lens points --
      // leaving the lower third clear for titles.
      target: v(0.2 + truck, -0.45 + rise * 0.5, -1.6),
      fov: 32,
    };
  },
};

export const layoutConfig = (layout: Layout): LayoutConfig =>
  layout === "hero" ? HERO : DIAGONAL;

import { interpolate } from "remotion";
import { BASE_HEIGHT, BASE_WIDTH } from "./constants";

/**
 * The whole graphic lives on one flat plane that the camera flies along.
 * Rather than projecting by hand we hand the plane to the compositor as a
 * CSS 3D transform: the browser then gives us the converging grid lines
 * and the falloff in size towards the far end of the timeline for free.
 */
export type Camera = {
  /** Plane-space x currently sitting on the screen anchor point. */
  readonly scroll: number;
  readonly scale: number;
  readonly rotateX: number;
  readonly rotateY: number;
  readonly rotateZ: number;
  /** Screen y of the plane origin (the axis line). */
  readonly anchorY: number;
  readonly perspective: number;
};

/** Screen x the plane origin is pinned to. */
export const ANCHOR_X = BASE_WIDTH * 0.5;

/** Plane px per quarter. */
export const QUARTER_PX = 205;

export const planeTransform = (cam: Camera): string =>
  `rotateZ(${cam.rotateZ}deg) rotateY(${cam.rotateY}deg) rotateX(${cam.rotateX}deg) scale(${cam.scale}) translateX(${-cam.scroll}px)`;

/**
 * Where the axis line crosses the horizontal centre of frame, in screen px.
 * Used to keep the depth-of-field band pinned to the line as the camera
 * tilts and drifts.
 */
export const focusScreenY = (cam: Camera): number => cam.anchorY;

/**
 * Ease that starts and ends calm but never fully stops: the reference
 * shots keep a constant crawl, with the acceleration hidden at the head
 * and tail.
 */
export const glide = (frame: number, duration: number): number =>
  interpolate(frame, [0, duration], [0, 1], {
    easing: (t) => t + 0.14 * Math.sin(Math.PI * t) * (1 - t),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

export const BASE_CENTER_Y = BASE_HEIGHT * 0.5;

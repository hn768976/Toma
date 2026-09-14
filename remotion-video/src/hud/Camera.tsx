import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { noise1d } from "./rng";

/** Design space. Every layout is authored at 1920x1080 and scaled to the
 * composition's real size, so 4K and 1080p are the same picture. */
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

/** The instrument layouts are authored in this box. */
export const LAYOUT_WIDTH = 3000;
export const LAYOUT_HEIGHT = 1900;

/**
 * The console surface runs well past the layout on every side. The overhang is
 * plain surface, grid and gear texture; its job is to keep the plane's edges
 * outside the frame at every point of the camera move.
 */
export const PLANE_MARGIN_X = 1150;
export const PLANE_MARGIN_Y = 1260;
export const PLANE_WIDTH = LAYOUT_WIDTH + PLANE_MARGIN_X * 2;
export const PLANE_HEIGHT = LAYOUT_HEIGHT + PLANE_MARGIN_Y * 2;

export type CameraMove = {
  /** Tilt of the console away from the lens, in degrees. */
  tiltFrom: number;
  tiltTo: number;
  /** Roll, in degrees. */
  rollFrom: number;
  rollTo: number;
  /** Dolly, as a scale factor. */
  zoomFrom: number;
  zoomTo: number;
  /** Lateral and longitudinal drift in design units. */
  panXFrom: number;
  panXTo: number;
  panYFrom: number;
  panYTo: number;
};

export const REFERENCE_MOVE: CameraMove = {
  tiltFrom: 46,
  tiltTo: 36,
  rollFrom: 7.5,
  rollTo: 3.2,
  zoomFrom: 0.84,
  zoomTo: 0.66,
  panXFrom: -60,
  panXTo: 40,
  panYFrom: 30,
  panYTo: -20,
};

export const ALT_MOVE: CameraMove = {
  tiltFrom: 33,
  tiltTo: 44,
  rollFrom: -6,
  rollTo: -1.8,
  zoomFrom: 0.66,
  zoomTo: 0.78,
  panXFrom: 70,
  panXTo: -50,
  panYFrom: -24,
  panYTo: 26,
};

/**
 * Places the console on a tilted plane and flies the lens across it.
 *
 * The move is a single eased sweep over the whole take - no cuts - with a
 * small noise wobble layered on so it reads as a camera rather than a tween.
 */
export const Camera: React.FC<{
  move: CameraMove;
  children: React.ReactNode;
}> = ({ move, children }) => {
  const frame = useCurrentFrame();
  const { width, durationInFrames } = useVideoConfig();
  const scale = width / DESIGN_WIDTH;

  const progress = interpolate(frame, [0, durationInFrames - 1], [0, 1], {
    // Ease in and out so the move settles instead of stopping dead.
    easing: (t) => t * t * (3 - 2 * t),
  });
  const at = (from: number, to: number) => from + (to - from) * progress;

  const wobbleX = (noise1d("cam-x", frame / 70) - 0.5) * 22;
  const wobbleY = (noise1d("cam-y", frame / 84) - 0.5) * 16;
  const wobbleRoll = (noise1d("cam-r", frame / 96) - 0.5) * 1.1;

  const transform = [
    `translateX(${at(move.panXFrom, move.panXTo) + wobbleX}px)`,
    `translateY(${at(move.panYFrom, move.panYTo) + wobbleY}px)`,
    `scale(${at(move.zoomFrom, move.zoomTo)})`,
    `rotateX(${at(move.tiltFrom, move.tiltTo)}deg)`,
    `rotateZ(${at(move.rollFrom, move.rollTo) + wobbleRoll}deg)`,
  ].join(" ");

  return (
    <div
      style={{
        position: "absolute",
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        perspective: 1500,
        perspectiveOrigin: "50% 46%",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: (DESIGN_WIDTH - PLANE_WIDTH) / 2,
          top: (DESIGN_HEIGHT - PLANE_HEIGHT) / 2,
          width: PLANE_WIDTH,
          height: PLANE_HEIGHT,
          transformStyle: "preserve-3d",
          transform,
        }}
      >
        {children}
      </div>
    </div>
  );
};

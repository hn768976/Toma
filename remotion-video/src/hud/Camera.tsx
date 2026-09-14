import React from "react";
import { useVideoConfig } from "remotion";

/** Design space. Every layout is authored at 1920x1080 and scaled to the
 * composition's real size, so 4K and 1080p are the same picture. */
export const DESIGN_WIDTH = 1920;
export const DESIGN_HEIGHT = 1080;

/** The instrument layout is authored in this box. */
export const LAYOUT_WIDTH = 3000;
export const LAYOUT_HEIGHT = 1900;

/**
 * The console surface runs well past the layout on every side. The overhang is
 * plain surface, grid and gear texture; its job is to keep the plane's edges
 * outside the frame.
 */
export const PLANE_MARGIN_X = 1150;
export const PLANE_MARGIN_Y = 1260;
export const PLANE_WIDTH = LAYOUT_WIDTH + PLANE_MARGIN_X * 2;
export const PLANE_HEIGHT = LAYOUT_HEIGHT + PLANE_MARGIN_Y * 2;

export type CameraSetup = {
  /** Tilt of the console away from the lens, in degrees. */
  tilt: number;
  /** Roll, in degrees. Negative mirrors the shot. */
  roll: number;
  /** Dolly, as a scale factor on the plane. */
  zoom: number;
  /** Framing offset in design units. */
  panX: number;
  panY: number;
  /** CSS perspective distance; smaller means a wider, more divergent lens. */
  perspective: number;
};

/**
 * The reference clip's camera, measured off the source rather than eyeballed.
 *
 * Phase correlation between frames two seconds and eighteen seconds in returns
 * a shift of (0, 0) and a scale of 1.0000: the shot is locked. Its dominant
 * edge orientations hold at 14.5 degrees and 117.5 degrees for the whole take,
 * so the tilt and roll never change either - every bit of motion in the clip
 * comes from the instruments themselves.
 *
 * Tilt, roll and perspective were then solved against rendered stills using the
 * same edge-orientation measurement: this setup renders at 15.5 and 117.5
 * degrees, which is one of the source's own measured frames (its spread across
 * the take is 15.5-17.5 and 116.5-117.5).
 */
export const REFERENCE_CAMERA: CameraSetup = {
  tilt: 40.5,
  roll: 15.5,
  zoom: 0.72,
  panX: 0,
  panY: 0,
  // Near-orthographic. The source's console edges barely converge, and a
  // shorter perspective distance piles extra foreshortening on top of the
  // tilt - at 2600 the same angles needed a tilt of 26 to match.
  perspective: 8000,
};

/** Places the console on a tilted plane and holds the lens still on it. */
export const Camera: React.FC<{
  camera: CameraSetup;
  children: React.ReactNode;
}> = ({ camera, children }) => {
  const { width } = useVideoConfig();
  const scale = width / DESIGN_WIDTH;

  const transform = [
    `translateX(${camera.panX}px)`,
    `translateY(${camera.panY}px)`,
    `scale(${camera.zoom})`,
    `rotateX(${camera.tilt}deg)`,
    `rotateZ(${camera.roll}deg)`,
  ].join(" ");

  return (
    <div
      style={{
        position: "absolute",
        width: DESIGN_WIDTH,
        height: DESIGN_HEIGHT,
        transform: `scale(${scale})`,
        transformOrigin: "top left",
        perspective: camera.perspective,
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

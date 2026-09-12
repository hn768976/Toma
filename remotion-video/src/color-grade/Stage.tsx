import React from "react";
import { AbsoluteFill } from "remotion";
import { BASE_HEIGHT, BASE_WIDTH, PLANE_HEIGHT, PLANE_WIDTH } from "./constants";
import { blurAt, planeTransform, type Camera } from "./optics";

// The 3D rig.
//
// <Stage> holds three nested jobs, kept separate on purpose:
//   1. resolution — the whole tree is authored at 1920x1080 and scaled up
//      for 4K, so one set of numbers drives both deliverables;
//   2. projection — a CSS `perspective` context plus the tilted plane;
//   3. defocus — <DepthLayer> looks up each panel's blur from its own
//      position on that plane (see optics.ts), so the DOF gradient is a
//      consequence of the camera rather than a per-panel guess.

export const Stage: React.FC<{
  camera: Camera;
  resolutionScale: number;
  /** Rendered behind the UI plane, at its own depth. */
  backdrop?: React.ReactNode;
  children: React.ReactNode;
}> = ({ camera, resolutionScale, backdrop, children }) => (
  <AbsoluteFill style={{ background: "#03050a", overflow: "hidden" }}>
    <div
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
        transform: `scale(${resolutionScale})`,
        transformOrigin: "top left",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          perspective: camera.perspective,
          perspectiveOrigin: "50% 46%",
          transformStyle: "preserve-3d",
          overflow: "hidden",
        }}
      >
        {backdrop}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: PLANE_WIDTH,
            height: PLANE_HEIGHT,
            marginLeft: -PLANE_WIDTH / 2,
            marginTop: -PLANE_HEIGHT / 2,
            transform: planeTransform(camera),
            transformStyle: "preserve-3d",
            background: "#0a1119",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  </AbsoluteFill>
);

/**
 * A panel positioned on the screen plane, blurred by its own depth.
 *
 * `bands` matters more than it looks. At this camera angle a full-width
 * panel can span 500px of depth end to end, so giving it one blur value
 * makes it read as a flat sticker lying on top of the shot. With bands,
 * the panel is drawn several times at different blur radii and
 * cross-faded with overlapping soft masks, which composites into a blur
 * that ramps continuously across the panel — the same way a real lens
 * defocuses a receding surface. Each band costs a re-render of the
 * subtree, so use them on wide panels and leave small ones at 1.
 */
export const DepthLayer: React.FC<{
  camera: Camera;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Number of depth slices across the panel's width. */
  bands?: number;
  /** Nudge the computed blur, for panels that need a little help. */
  blurBias?: number;
  opacity?: number;
  zIndex?: number;
  children: React.ReactNode;
}> = ({
  camera,
  x,
  y,
  width,
  height,
  bands = 1,
  blurBias = 0,
  opacity,
  zIndex,
  children,
}) => {
  const blurOf = (cx: number) =>
    Math.max(0, blurAt(camera, x + cx, y + height / 2) + blurBias);

  if (bands <= 1) {
    const blur = blurOf(width / 2);
    return (
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          width,
          height,
          opacity,
          zIndex,
          filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
        }}
      >
        {children}
      </div>
    );
  }

  const bw = width / bands;
  return (
    <div
      style={{ position: "absolute", left: x, top: y, width, height, opacity, zIndex }}
    >
      {Array.from({ length: bands }, (_, i) => {
        const blur = blurOf((i + 0.5) * bw);
        // Each band is a full copy of the panel, faded in over its own
        // slice and out across its neighbours. The ramps overlap by a
        // full band width, so no seam is ever visible.
        const start = ((i - 1) / bands) * 100;
        const mid = ((i + 0.5) / bands) * 100;
        const end = ((i + 2) / bands) * 100;
        const mask =
          i === 0
            ? `linear-gradient(90deg, #000 ${mid}%, transparent ${end}%)`
            : i === bands - 1
              ? `linear-gradient(90deg, transparent ${start}%, #000 ${mid}%)`
              : `linear-gradient(90deg, transparent ${start}%, #000 ${mid}%, transparent ${end}%)`;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              inset: 0,
              filter: blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : undefined,
              WebkitMaskImage: mask,
              maskImage: mask,
            }}
          >
            {children}
          </div>
        );
      })}
    </div>
  );
};

import React from "react";
import { interpolate } from "remotion";
import { WIDTH, HEIGHT } from "../constants";

type Keyframe = { frame: number; scale?: number; x?: number; y?: number };

type CameraMoveProps = {
  frame: number; // local frame within the scene
  keyframes: Keyframe[];
  children: React.ReactNode;
};

// Simulates a smooth camera pan/zoom by scaling & translating its children
// around the canvas center, driven by simple {frame, scale, x, y} keyframes.
export const CameraMove: React.FC<CameraMoveProps> = ({
  frame,
  keyframes,
  children,
}) => {
  const frames = keyframes.map((k) => k.frame);
  const scales = keyframes.map((k) => k.scale ?? 1);
  const xs = keyframes.map((k) => k.x ?? 0);
  const ys = keyframes.map((k) => k.y ?? 0);

  const scale = interpolate(frame, frames, scales, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = interpolate(frame, frames, xs, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const y = interpolate(frame, frames, ys, {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: WIDTH,
        height: HEIGHT,
        transform: `scale(${scale}) translate(${x}px, ${y}px)`,
        transformOrigin: "center center",
      }}
    >
      {children}
    </div>
  );
};

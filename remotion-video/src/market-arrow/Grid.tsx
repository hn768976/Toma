import React from "react";
import { AbsoluteFill } from "remotion";

export type GridProps = {
  /** Spacing of the fine grid, in stage px, before any 3D foreshortening. */
  cell: number;
  /** Every Nth line is drawn with the bolder colour. */
  boldEvery: number;
  fineColor: string;
  boldColor: string;
  lineWidth: number;
  /** Texture offset — animate to scroll the grid under the camera. */
  offsetX: number;
  offsetY: number;
  /** 3D plane attitude. perspective 0 keeps the grid flat/screen-aligned. */
  perspective?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  scale?: number;
  opacity?: number;
};

// A tiled grid painted with repeating gradients, optionally laid back in
// 3D. Two stacked layers (fine + bold) rather than one, so the bold
// lines sit exactly on every Nth fine line at any cell size.
export const Grid: React.FC<GridProps> = ({
  cell,
  boldEvery,
  fineColor,
  boldColor,
  lineWidth,
  offsetX,
  offsetY,
  perspective = 0,
  rotateX = 0,
  rotateY = 0,
  rotateZ = 0,
  scale = 1,
  opacity = 1,
}) => {
  const bold = cell * boldEvery;
  const boldWidth = lineWidth * 1.5;

  const layer = (
    size: number,
    color: string,
    width: number,
  ): React.CSSProperties => ({
    position: "absolute",
    // Oversized so the plane still covers the frame once it is rotated.
    left: "-90%",
    top: "-90%",
    width: "280%",
    height: "280%",
    backgroundImage: `repeating-linear-gradient(to right, ${color} 0 ${width}px, transparent ${width}px ${size}px), repeating-linear-gradient(to bottom, ${color} 0 ${width}px, transparent ${width}px ${size}px)`,
    backgroundPosition: `${offsetX}px ${offsetY}px`,
  });

  return (
    <AbsoluteFill
      style={{
        perspective: perspective > 0 ? perspective : undefined,
        perspectiveOrigin: "50% 42%",
        opacity,
      }}
    >
      <AbsoluteFill
        style={{
          transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg) rotateZ(${rotateZ}deg) scale(${scale})`,
          transformStyle: perspective > 0 ? "preserve-3d" : undefined,
        }}
      >
        <div style={layer(cell, fineColor, lineWidth)} />
        <div style={layer(bold, boldColor, boldWidth)} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

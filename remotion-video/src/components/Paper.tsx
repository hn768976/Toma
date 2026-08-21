import React from "react";
import { AbsoluteFill } from "remotion";
import { PALETTE } from "../constants";

// The whiteboard/paper backdrop used behind every scene.
export const Paper: React.FC<{ color?: string; dotColor?: string }> = ({
  color = PALETTE.paper,
  dotColor = PALETTE.paperDot,
}) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: color,
        backgroundImage: `radial-gradient(${dotColor} 2px, transparent 2px)`,
        backgroundSize: "44px 44px",
      }}
    />
  );
};

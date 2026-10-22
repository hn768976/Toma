import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./constants";

/**
 * Lays children out in a 1920x1080 coordinate space and scales them to the
 * composition size. Text and SVG stay vector-sharp at 4K.
 */
export const DesignSpace: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => {
  const { width } = useVideoConfig();
  const s = width / DESIGN_WIDTH;
  return (
    <AbsoluteFill style={{ overflow: "hidden", ...style }}>
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `scale(${s})`,
          transformOrigin: "0 0",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

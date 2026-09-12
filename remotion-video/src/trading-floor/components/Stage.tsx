import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "../constants";

// Renders the 1920x1080 design space at whatever the composition
// resolution is. Because this is a CSS transform rather than an image
// upscale, the 4K composition re-rasterises every glyph and vector at
// full density — it is genuinely 4K, not an upscaled 1080p frame.
export const Stage: React.FC<{
  background: string;
  children: React.ReactNode;
}> = ({ background, children }) => {
  const { width } = useVideoConfig();
  const scale = width / DESIGN_WIDTH;

  return (
    <AbsoluteFill style={{ background, overflow: "hidden" }}>
      <div
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "relative",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

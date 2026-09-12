import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { DESIGN_HEIGHT, DESIGN_WIDTH } from "./theme";

/**
 * Renders children into the fixed 1920x1080 design space and scales that space
 * up to whatever the composition's real size is. The browser rasterises text,
 * borders and SVG at the transformed resolution, so the 4K compositions are
 * genuinely sharp rather than an upscale of the 1080p frame.
 */
export const Scaled: React.FC<{
  children: React.ReactNode;
  background?: string;
}> = ({ children, background }) => {
  const { width, height } = useVideoConfig();
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);

  return (
    <AbsoluteFill style={{ background, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: (width - DESIGN_WIDTH * scale) / 2,
          top: (height - DESIGN_HEIGHT * scale) / 2,
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

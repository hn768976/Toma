import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { cameraAt, cameraTransform, type CameraKeyframe } from "../camera";
import { STAGE_HEIGHT, STAGE_WIDTH } from "../constants";

export type DashboardStageProps = {
  // 1 = 1080p, 2 = 4K. Only ever scales *pixel* sizes, never geometry:
  // the SVG viewBox stays in stage units, so both compositions render
  // from identical component trees and stay pixel-for-pixel in sync.
  resolutionScale: number;
  // CSS perspective distance, in stage units. Smaller = wider lens.
  perspective: number;
  camera: CameraKeyframe[];
  backgroundColor: string;
  // Painted behind the dashboard plane, in screen space (defocused
  // room glow, bokeh) - deliberately outside the 3D transform.
  backdrop?: React.ReactNode;
  // Painted over everything in screen space (vignette, grade, grain).
  overlay?: React.ReactNode;
  defs?: React.ReactNode;
  children: React.ReactNode;
};

export const DashboardStage: React.FC<DashboardStageProps> = ({
  resolutionScale,
  perspective,
  camera,
  backgroundColor,
  backdrop,
  overlay,
  defs,
  children,
}) => {
  const frame = useCurrentFrame();
  const transform = cameraTransform(cameraAt(camera, frame), resolutionScale);

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: "hidden" }}>
      {backdrop}
      <AbsoluteFill
        style={{
          perspective: perspective * resolutionScale,
          perspectiveOrigin: "50% 50%",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: STAGE_WIDTH * resolutionScale,
            height: STAGE_HEIGHT * resolutionScale,
            transformStyle: "preserve-3d",
            transform,
          }}
        >
          <svg
            width={STAGE_WIDTH * resolutionScale}
            height={STAGE_HEIGHT * resolutionScale}
            viewBox={`0 0 ${STAGE_WIDTH} ${STAGE_HEIGHT}`}
            shapeRendering="geometricPrecision"
            // Bleed: the board extends past the viewBox so a tilted or
            // pulled-back camera never exposes the edge of the screen.
            style={{ overflow: "visible" }}
          >
            <defs>{defs}</defs>
            {children}
          </svg>
        </div>
      </AbsoluteFill>
      {overlay}
    </AbsoluteFill>
  );
};

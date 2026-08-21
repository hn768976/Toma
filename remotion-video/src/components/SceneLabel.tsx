import React from "react";
import { interpolate, spring, useVideoConfig } from "remotion";
import { HAND_DRAWN_FILTER_ID } from "./HandDrawnFilter";
import { FONT_FAMILY, PALETTE } from "../constants";

type SceneLabelProps = {
  text: string;
  frame: number; // local frame, relative to when this scene mounted
  appearFrame?: number; // frame (local) at which the label starts animating in
  x: number;
  y: number;
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
  underline?: boolean;
  underlineColor?: string;
  maxWidth?: number;
};

// A handwriting-styled text label that pops in with a little spring and
// can be underlined with a sketchy stroke. Positioned by its anchor point
// (x, y) using `align` for horizontal alignment.
export const SceneLabel: React.FC<SceneLabelProps> = ({
  text,
  frame,
  appearFrame = 0,
  x,
  y,
  fontSize = 44,
  color = PALETTE.ink,
  align = "center",
  underline = false,
  underlineColor,
  maxWidth = 700,
}) => {
  const { fps } = useVideoConfig();
  const localFrame = frame - appearFrame;

  const entrance = spring({
    frame: localFrame,
    fps,
    config: { damping: 14, mass: 0.6 },
  });

  const opacity = interpolate(localFrame, [0, 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const translateY = interpolate(entrance, [0, 1], [16, 0]);

  const transformOrigin =
    align === "left" ? "left center" : align === "right" ? "right center" : "center";

  if (localFrame < 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        transform: `translate(${align === "left" ? "0%" : align === "right" ? "-100%" : "-50%"}, -50%) translateY(${translateY}px)`,
        opacity,
        textAlign: align,
        maxWidth,
        transformOrigin,
      }}
    >
      <div
        style={{
          fontFamily: FONT_FAMILY,
          fontSize,
          color,
          lineHeight: 1.2,
          whiteSpace: "pre-line",
        }}
      >
        {text}
      </div>
      {underline && (
        <svg
          width={maxWidth}
          height={20}
          style={{
            filter: `url(#${HAND_DRAWN_FILTER_ID})`,
            overflow: "visible",
            marginTop: 2,
          }}
        >
          <path
            d={`M 4 8 Q ${maxWidth / 2} 16 ${maxWidth - 4} 6`}
            fill="none"
            stroke={underlineColor ?? color}
            strokeWidth={5}
            strokeLinecap="round"
            opacity={interpolate(entrance, [0, 1], [0, 1])}
          />
        </svg>
      )}
    </div>
  );
};

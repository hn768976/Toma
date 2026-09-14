import React from "react";
import { AbsoluteFill } from "remotion";
import { STAGE_HEIGHT, STAGE_WIDTH } from "./constants";

// Maps the fixed 1920x1080 authoring space onto whatever the
// composition's real resolution is. The 4K composition passes scale=2,
// the 1080p delivery composition passes scale=1 — same frame, same
// framing, twice the pixels.
export const Stage: React.FC<{
  scale: number;
  background: string;
  children: React.ReactNode;
}> = ({ scale, background, children }) => {
  return (
    <AbsoluteFill style={{ background, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </AbsoluteFill>
  );
};

// Fakes a shallow depth of field: the scene is painted once blurred and
// once sharp, with the sharp copy masked down to the in-focus band.
// `focusMask` is any CSS mask-image gradient (white = sharp).
//
// Children are rendered twice, which is safe here because every
// market-arrow component is a pure function of (frame, props).
export const DepthOfField: React.FC<{
  blurPx: number;
  focusMask: string;
  children: React.ReactNode;
}> = ({ blurPx, focusMask, children }) => {
  return (
    <AbsoluteFill>
      <AbsoluteFill
        style={{
          filter: `blur(${blurPx}px)`,
          // Slight overscan so the blur doesn't feather in the frame edges.
          transform: "scale(1.04)",
        }}
      >
        {children}
      </AbsoluteFill>
      <AbsoluteFill
        style={{
          maskImage: focusMask,
          WebkitMaskImage: focusMask,
        }}
      >
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// Soft darkening at the frame edges. Sits above everything.
export const Vignette: React.FC<{ color: string; strength: number }> = ({
  color,
  strength,
}) => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(ellipse 78% 70% at 50% 48%, transparent 40%, ${color} 100%)`,
      opacity: strength,
      pointerEvents: "none",
    }}
  />
);

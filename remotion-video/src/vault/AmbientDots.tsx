// 36 tiny cream dots drifting across the whole scene container at 15-25%
// opacity. They are present in every single frame — they never fade, never
// pause, and they sell the style more than any other single element.

import React, { useMemo } from "react";
import { random, useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTE, SCENE_HEIGHT, SCENE_WIDTH } from "./constants";

const DOT_COUNT = 36;

type Dot = {
  x: number;
  y: number;
  r: number;
  opacity: number;
  driftX: number;
  driftY: number;
  period: number;
  phase: number;
};

const buildDots = (): Dot[] =>
  new Array(DOT_COUNT).fill(0).map((_, i) => ({
    x: random(`dot-x-${i}`) * SCENE_WIDTH,
    y: random(`dot-y-${i}`) * SCENE_HEIGHT,
    r: 3 + random(`dot-r-${i}`) * 5,
    opacity: 0.15 + random(`dot-o-${i}`) * 0.1,
    driftX: (random(`dot-dx-${i}`) - 0.5) * 90,
    driftY: (random(`dot-dy-${i}`) - 0.5) * 70,
    period: 7 + random(`dot-p-${i}`) * 9,
    phase: random(`dot-ph-${i}`),
  }));

export const AmbientDots: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dots = useMemo(buildDots, []);
  const seconds = frame / fps;

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {dots.map((dot, i) => {
        const t = ((seconds / dot.period) + dot.phase) * Math.PI * 2;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: dot.x + Math.sin(t) * dot.driftX,
              top: dot.y + Math.cos(t * 0.7) * dot.driftY,
              width: dot.r * 2,
              height: dot.r * 2,
              marginLeft: -dot.r,
              marginTop: -dot.r,
              borderRadius: "50%",
              background: PALETTE.cream,
              opacity: dot.opacity,
            }}
          />
        );
      })}
    </div>
  );
};

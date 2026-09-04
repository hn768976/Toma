import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { AxisLabels } from "./components/AxisLabels";
import { Grid } from "./components/Grid";
import { Overlays } from "./components/Overlays";
import { Sweep } from "./components/Sweep";
import { Traces } from "./components/Traces";
import { DESIGN_WIDTH, SCROLL_PER_FRAME } from "./constants";
import "./load-fonts";
import type { Theme } from "./theme";
import { useTraces } from "./useTraces";

/**
 * One measurement display. Everything is authored against a 3840x2160 design
 * space and multiplied by `scale`, so the same component renders identically at
 * 1080p (`--scale=0.5`) and 4K; nothing here is a hard-coded pixel size.
 */
export const Oscilloscope: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const scale = width / DESIGN_WIDTH;

  const scroll = frame * SCROLL_PER_FRAME;
  const traces = useTraces(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 62% 58% at 50% 44%, ${theme.centerGlow} 0%, ${theme.background} 100%)`,
        }}
      />
      <Grid theme={theme} scroll={scroll} scale={scale} />
      <AxisLabels theme={theme} scroll={scroll} scale={scale} width={width} />
      <Traces
        traces={traces}
        theme={theme}
        scale={scale}
        width={width}
        height={height}
      />
      <Sweep
        traces={traces}
        theme={theme}
        frame={frame}
        scale={scale}
        width={width}
        height={height}
      />
      <Overlays theme={theme} frame={frame} scale={scale} />
    </AbsoluteFill>
  );
};

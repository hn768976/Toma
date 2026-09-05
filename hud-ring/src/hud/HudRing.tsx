import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { buildLayout } from "./layout";
import { PALETTES, type PaletteName } from "./palette";
import { DashedCircle, SegmentRing, BlockRing } from "./layers/Rings";
import { Arcs, TickRing, DataBlocks } from "./layers/Details";
import { OuterFrame, CornerMarks } from "./layers/OuterFrame";
import { Grain, Vignette } from "./layers/Overlays";

export type HudRingProps = {
  palette: PaletteName;
  /** Changing the seed reshuffles the scattered blocks and corner marks. */
  seed: number;
  grain: number;
};

export const hudRingDefaults: HudRingProps = {
  palette: "cyan",
  seed: 20240917,
  grain: 0.02,
};

export const HudRing: React.FC<HudRingProps> = ({ palette: paletteName, seed, grain }) => {
  const { width, height } = useVideoConfig();
  const palette = PALETTES[paletteName];
  const layout = buildLayout(seed, width / height);
  const layerProps = { layout, palette, h: height };

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bg }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          {/* Moderate bloom — applied to the white block ring only. */}
          <filter
            id="hud-bloom"
            x="-25%"
            y="-25%"
            width="150%"
            height="150%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur in="SourceGraphic" stdDeviation={height * 0.0045} result="tight" />
            <feGaussianBlur in="SourceGraphic" stdDeviation={height * 0.017} result="wide" />
            <feComponentTransfer in="wide" result="wideDim">
              <feFuncA type="linear" slope="0.5" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="wideDim" />
              <feMergeNode in="tight" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={`translate(${width / 2} ${height / 2})`}>
          <CornerMarks {...layerProps} />
          <DashedCircle {...layerProps} />
          <SegmentRing {...layerProps} />
          <Arcs {...layerProps} />
          <TickRing {...layerProps} />
          <DataBlocks {...layerProps} />
          <OuterFrame {...layerProps} />
          <g filter="url(#hud-bloom)">
            <BlockRing {...layerProps} />
          </g>
        </g>
      </svg>
      <Vignette />
      <Grain opacity={grain} />
    </AbsoluteFill>
  );
};

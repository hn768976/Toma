import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { FRAME_HEIGHT, FRAME_WIDTH, PLACED_ELEMENTS } from "./layout";
import { driftAt } from "./motion";
import { glowGradientId } from "./ElementCell";
import { TableGrid } from "./TableGrid";
import { HighlightPass } from "./HighlightPass";
import { VARIANTS, type VariantId } from "./variants";

const BLOOM_DEVIATION = 11;
const VIGNETTE_STRENGTH = 0.2;
const GRAIN_ALPHA = 0.03;

export type PeriodicTableProps = {
  variant: VariantId;
};

export const PeriodicTable: React.FC<PeriodicTableProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const config = VARIANTS[variant];

  const glowColors = useMemo(() => {
    const seen: string[] = [];
    PLACED_ELEMENTS.forEach((element) => {
      const { glow } = config.paintFor(element);
      if (seen.indexOf(glow) === -1) {
        seen.push(glow);
      }
    });
    return seen;
  }, [config]);

  const drift = driftAt(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: config.background }}>
      <svg
        viewBox={`0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`}
        width="100%"
        height="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {glowColors.map((color) => (
            <radialGradient key={color} id={glowGradientId(color)}>
              <stop offset="0%" stopColor={color} stopOpacity={0.55} />
              <stop offset="45%" stopColor={color} stopOpacity={0.18} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </radialGradient>
          ))}

          {/* Generous bloom - applied to the borders and symbols only. */}
          <filter
            id="cell-bloom"
            x="-5%"
            y="-5%"
            width="110%"
            height="110%"
            colorInterpolationFilters="sRGB"
          >
            <feGaussianBlur stdDeviation={BLOOM_DEVIATION} result="blurred" />
            <feComponentTransfer in="blurred" result="bloomed">
              <feFuncA type="linear" slope={1.35} />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode in="bloomed" />
              <feMergeNode in="SourceGraphic" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <radialGradient id="vignette">
            <stop offset="55%" stopColor={config.vignetteColor} stopOpacity={0} />
            <stop
              offset="100%"
              stopColor={config.vignetteColor}
              stopOpacity={VIGNETTE_STRENGTH}
            />
          </radialGradient>

          {/* Fine grain; the seed is the frame, so it stays deterministic. */}
          <filter
            id="grain"
            x="0%"
            y="0%"
            width="100%"
            height="100%"
            colorInterpolationFilters="sRGB"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves={1}
              seed={frame}
              stitchTiles="stitch"
            />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0"
              result="grainMask"
            />
            <feComposite in="SourceGraphic" in2="grainMask" operator="in" />
          </filter>
        </defs>

        <rect
          x={0}
          y={0}
          width={FRAME_WIDTH}
          height={FRAME_HEIGHT}
          fill={config.background}
        />

        <g transform={`translate(${drift.x} ${drift.y})`}>
          <TableGrid variant={config} frame={frame} fps={fps} layer="body" />
          <HighlightPass variant={config} frame={frame} />
          <g filter="url(#cell-bloom)">
            <TableGrid variant={config} frame={frame} fps={fps} layer="ink" />
          </g>
        </g>

        <rect
          x={0}
          y={0}
          width={FRAME_WIDTH}
          height={FRAME_HEIGHT}
          fill="url(#vignette)"
        />
        <rect
          x={0}
          y={0}
          width={FRAME_WIDTH}
          height={FRAME_HEIGHT}
          fill={config.grainColor}
          filter="url(#grain)"
          opacity={GRAIN_ALPHA}
        />
      </svg>
    </AbsoluteFill>
  );
};

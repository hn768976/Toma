import React from "react";
import { z } from "zod";
import { AbsoluteFill } from "remotion";
import { GlowSpot, Grade, Vignette } from "../components/Atmosphere";
import { ArcRail } from "../components/ArcRail";
import { AxisTicks } from "../components/AxisTicks";
import { DashboardStage } from "../components/DashboardStage";
import { LabelChip } from "../components/LabelChip";
import { LineSeries } from "../components/LineSeries";
import { MarkerStack } from "../components/Markers";
import { ScreenGrid } from "../components/ScreenGrid";
import { ScreenTexture } from "../components/ScreenTexture";
import type { CameraKeyframe } from "../camera";
import { BLEED_RECT, FONT_MONO, SERIES_COLORS } from "../constants";
import { addTremble, buildSeries, type PlotBand } from "../series";

export const dashboardV3Schema = z.object({
  resolutionScale: z.number().min(1).max(4),
});

export const dashboardV3Defaults: z.infer<typeof dashboardV3Schema> = {
  resolutionScale: 1,
};

// Version 3 - "Asset Classes, curved terminal". The 14-second cut, and
// the only one whose surface is bent: the histogram wraps around a huge
// radius so the board reads as a curved LED wall. The camera crosses the
// wall left to right while easing in, and the content builds the whole
// way through rather than settling early.
const CAMERA: CameraKeyframe[] = [
  {
    frame: 0,
    x: -190,
    y: -60,
    z: -140,
    rotateX: 4.5,
    rotateY: 10,
    rotateZ: 1.4,
    scale: 0.66,
  },
  {
    frame: 220,
    x: -30,
    y: 0,
    z: 10,
    rotateX: 3,
    rotateY: 3.5,
    rotateZ: 0.5,
    scale: 0.7,
  },
  {
    frame: 420,
    x: 150,
    y: 70,
    z: 150,
    rotateX: 1.2,
    rotateY: -6,
    rotateZ: -0.9,
    scale: 0.76,
  },
];

const TRACES: { color: string; seed: number; offset: number; trend: number }[] =
  [
    { color: SERIES_COLORS.mint, seed: 201, offset: 0, trend: 0.4 },
    { color: SERIES_COLORS.white, seed: 211, offset: 110, trend: 0.55 },
    { color: SERIES_COLORS.cyan, seed: 223, offset: 210, trend: 0.28 },
    { color: SERIES_COLORS.amber, seed: 233, offset: 320, trend: 0.48 },
    { color: SERIES_COLORS.lilac, seed: 241, offset: 430, trend: 0.18 },
  ];

export const DashboardV3: React.FC<z.infer<typeof dashboardV3Schema>> = ({
  resolutionScale,
}) => {
  const band = (offset: number): PlotBand => ({
    x: 260,
    y: 420 + offset,
    width: 2300,
    height: 260,
  });

  return (
    <DashboardStage
      resolutionScale={resolutionScale}
      perspective={2100}
      camera={CAMERA}
      backgroundColor="#040a1a"
      backdrop={
        <>
          <GlowSpot
            x="74%"
            y="44%"
            size="78%"
            color="rgba(28, 104, 186, 0.95)"
          />
          <GlowSpot x="20%" y="72%" size="60%" color="rgba(16, 54, 116, 0.8)" />
        </>
      }
      overlay={
        <AbsoluteFill>
          <Vignette strength={0.6} color="rgba(1, 6, 18, 0.94)" />
          <Grade color="rgba(46, 140, 220, 0.32)" opacity={0.32} />
        </AbsoluteFill>
      }
    >
      <rect {...BLEED_RECT} fill="#061026" />
      <ScreenGrid
        x={BLEED_RECT.x}
        y={BLEED_RECT.y}
        width={BLEED_RECT.width}
        height={BLEED_RECT.height}
        cell={60}
        majorEvery={5}
        color="rgba(80, 140, 215, 0.11)"
        majorColor="rgba(110, 175, 245, 0.2)"
      />

      {/* Repeating value column down the left edge. */}
      <AxisTicks
        x={440}
        y={330}
        step={72}
        count={17}
        from={64000}
        increment={-3400}
        fontSize={24}
      />

      {TRACES.map((trace, i) => (
        <LineSeries
          key={trace.seed}
          series={addTremble(
            buildSeries(trace.seed, {
              count: 240,
              volatility: 0.11,
              trend: trace.trend,
              smoothing: 5,
            }),
            trace.seed,
            0.055,
          )}
          band={band(trace.offset)}
          color={trace.color}
          strokeWidth={4.5}
          drawStart={-95 + i * 24}
          drawDuration={300}
          head
        />
      ))}

      <MarkerStack
        x={900}
        y={620}
        count={3}
        color={SERIES_COLORS.mint}
        size={26}
        spacing={44}
        seed={61}
        startAt={80}
      />
      <MarkerStack
        x={1640}
        y={560}
        count={3}
        color={SERIES_COLORS.yellow}
        size={26}
        spacing={44}
        seed={67}
        startAt={150}
      />
      <MarkerStack
        x={430}
        y={760}
        count={3}
        direction="down"
        color={SERIES_COLORS.salmon}
        size={26}
        spacing={44}
        seed={71}
        startAt={60}
      />

      <LabelChip
        x={640}
        y={700}
        label="Stocks"
        value="-21,059.29"
        appearAt={96}
        fontSize={52}
        valueColor="#ece55e"
      />
      <LabelChip
        x={1340}
        y={760}
        label="Bonds"
        value="-21,850.80"
        appearAt={186}
        fontSize={52}
        valueColor="#ff7f6b"
      />
      <LabelChip
        x={2020}
        y={520}
        label="Real estate"
        value="-43,173.95"
        appearAt={288}
        fontSize={52}
      />

      <g fontFamily={FONT_MONO} fontSize={34} fill="rgba(190, 225, 255, 0.72)">
        <text x={620} y={1000}>
          1.6957
        </text>
        <text x={1560} y={1090}>
          4.4213
        </text>
        <text x={2260} y={940}>
          -40,349.57
        </text>
      </g>

      {/* The curved terminal rail. Its circle centre sits far below the
          board, so the bars stand off a shallow crest and the whole strip
          appears to wrap away from the camera at both ends. */}
      <ArcRail
        cx={1500}
        cy={4700}
        radius={3200}
        startAngle={242}
        endAngle={298}
        count={120}
        seed={79}
        barColor="#2f9fe0"
        maxBarHeight={320}
        railColors={["#f07a3c", "#dfeaf7"]}
        labels={[
          "2026",
          "Q2",
          "Q3",
          "Q4",
          "2027",
          "Q2",
          "Q3",
          "Q4",
          "2028",
          "Q2",
        ]}
        appearAt={-250}
        drawDuration={430}
      />

      <ScreenTexture {...BLEED_RECT} pitch={7} opacity={0.11} />
    </DashboardStage>
  );
};

import React from "react";
import { z } from "zod";
import { AbsoluteFill } from "remotion";
import { GlowSpot, Grade, Vignette } from "../components/Atmosphere";
import { AxisLines } from "../components/AxisLines";
import { AxisTicks } from "../components/AxisTicks";
import { DashboardStage } from "../components/DashboardStage";
import { DonutChart } from "../components/DonutChart";
import { Histogram } from "../components/Histogram";
import { LabelChip } from "../components/LabelChip";
import { LineSeries } from "../components/LineSeries";
import { MarkerStack } from "../components/Markers";
import { ScreenGrid } from "../components/ScreenGrid";
import { ScreenTexture } from "../components/ScreenTexture";
import { CandleWidget } from "../components/Widgets";
import type { CameraKeyframe } from "../camera";
import { BLEED_RECT, FONT_LABEL, SERIES_COLORS } from "../constants";
import { addTremble, buildSeries, type PlotBand } from "../series";

export const dashboardV1Schema = z.object({
  resolutionScale: z.number().min(1).max(4),
});

export const dashboardV1Defaults: z.infer<typeof dashboardV1Schema> = {
  resolutionScale: 1,
};

// Version 1 - "Energy Markets". The widest, most legible of the four:
// a near-frontal board, a slow pull-back, and a full legend. This is the
// version that reads at a glance; the others trade legibility for depth.
const CAMERA: CameraKeyframe[] = [
  {
    frame: 0,
    x: 150,
    y: 70,
    z: 180,
    rotateX: 6.5,
    rotateY: -13,
    rotateZ: -1.6,
    scale: 0.8,
  },
  {
    frame: 300,
    x: -40,
    y: -20,
    z: -70,
    rotateX: 1.8,
    rotateY: -3,
    rotateZ: -0.4,
    scale: 0.63,
  },
];

const LEGEND: { label: string; color: string }[][] = [
  [
    { label: "Electricity", color: SERIES_COLORS.amber },
    { label: "Gasoline", color: SERIES_COLORS.mint },
    { label: "Natural gas", color: SERIES_COLORS.cyan },
  ],
  [
    { label: "Crude Oil", color: SERIES_COLORS.salmon },
    { label: "Heating Oil", color: SERIES_COLORS.yellow },
    { label: "Ethanol", color: SERIES_COLORS.sky },
  ],
];

const TRACES: { color: string; seed: number; offset: number; trend: number }[] =
  [
    { color: SERIES_COLORS.amber, seed: 11, offset: 0, trend: 0.5 },
    { color: SERIES_COLORS.yellow, seed: 23, offset: 70, trend: 0.32 },
    { color: SERIES_COLORS.mint, seed: 37, offset: 140, trend: 0.62 },
    { color: SERIES_COLORS.cyan, seed: 51, offset: 210, trend: 0.2 },
    { color: SERIES_COLORS.sky, seed: 67, offset: 280, trend: 0.46 },
    { color: SERIES_COLORS.salmon, seed: 83, offset: 350, trend: 0.12 },
  ];

const Legend: React.FC = () => (
  <g fontFamily={FONT_LABEL} fontSize={46} fontWeight={700} fill="#ffffff">
    {LEGEND.map((column, ci) =>
      column.map((entry, ri) => {
        const x = 1240 + ci * 560;
        const y = 470 + ri * 72;
        return (
          <g key={entry.label}>
            <circle
              cx={x}
              cy={y - 14}
              r={11}
              fill="none"
              stroke={entry.color}
              strokeWidth={6}
            />
            <text x={x + 34} y={y}>
              {entry.label}
            </text>
          </g>
        );
      }),
    )}
  </g>
);

export const DashboardV1: React.FC<z.infer<typeof dashboardV1Schema>> = ({
  resolutionScale,
}) => {
  const plotBand = (offset: number): PlotBand => ({
    x: 225,
    y: 720 + offset,
    width: 2535,
    height: 300,
  });

  return (
    <DashboardStage
      resolutionScale={resolutionScale}
      perspective={2300}
      camera={CAMERA}
      backgroundColor="#060c1c"
      backdrop={
        <>
          <GlowSpot
            x="42%"
            y="46%"
            size="86%"
            color="rgba(32, 76, 148, 0.85)"
          />
          <GlowSpot
            x="80%"
            y="24%"
            size="52%"
            color="rgba(24, 106, 172, 0.6)"
          />
        </>
      }
      overlay={
        <AbsoluteFill>
          <Vignette strength={0.6} />
          <Grade opacity={0.22} />
        </AbsoluteFill>
      }
    >
      <rect {...BLEED_RECT} fill="#0a1430" />
      <ScreenGrid
        x={BLEED_RECT.x}
        y={BLEED_RECT.y}
        width={BLEED_RECT.width}
        height={BLEED_RECT.height}
        cell={52}
        majorEvery={5}
        color="rgba(105, 160, 230, 0.12)"
        majorColor="rgba(125, 180, 245, 0.26)"
      />

      {/* The X and Y rules the plot is read against, then the value
          and time labels that sit outside them. */}
      <AxisLines
        x={225}
        y={660}
        width={2535}
        height={960}
        yTickOffset={120}
        yTickStep={78}
        yTickCount={9}
        xTickOffset={75}
        xTickStep={300}
        xTickCount={9}
      />
      <AxisTicks
        x={205}
        y={780}
        step={78}
        count={9}
        from={18000}
        increment={-1800}
        fontSize={26}
      />
      <AxisTicks
        x={300}
        y={1660}
        step={300}
        count={9}
        from={0}
        increment={0}
        orientation="horizontal"
        anchor="middle"
        fontSize={28}
        color="rgba(240, 170, 90, 0.8)"
        labels={["2026", "Q2", "Q3", "Q4", "2027", "Q2", "Q3", "Q4", "2028"]}
      />

      <DonutChart
        cx={700}
        cy={500}
        radius={182}
        seed={7}
        segments={8}
        color="#6fc0f2"
        accentColor="#ff6f5e"
        years={["2024", "2025", "2026", "2027", "2028", "2029"]}
        appearAt={-26}
      />
      <Legend />
      <CandleWidget
        x={2360}
        y={330}
        width={420}
        height={280}
        seed={19}
        appearAt={-20}
      />

      {TRACES.map((trace, i) => (
        <LineSeries
          key={trace.seed}
          series={addTremble(
            buildSeries(trace.seed, {
              count: 210,
              volatility: 0.1,
              trend: trace.trend,
              smoothing: 5,
            }),
            trace.seed,
            0.05,
          )}
          band={plotBand(trace.offset)}
          color={trace.color}
          strokeWidth={5}
          drawStart={-70 + i * 9}
          drawDuration={250}
          head
        />
      ))}

      <MarkerStack
        x={1180}
        y={980}
        count={3}
        color={SERIES_COLORS.yellow}
        size={30}
        spacing={52}
        seed={3}
        startAt={70}
      />
      <MarkerStack
        x={1900}
        y={880}
        count={3}
        color={SERIES_COLORS.yellow}
        size={30}
        spacing={52}
        seed={9}
        startAt={110}
      />
      <MarkerStack
        x={2420}
        y={1080}
        count={3}
        direction="down"
        color={SERIES_COLORS.salmon}
        size={30}
        spacing={52}
        seed={14}
        startAt={140}
      />

      <LabelChip
        x={640}
        y={1180}
        label="Crude Oil"
        value="72,418.90"
        percent="+3.14%"
        appearAt={96}
        fontSize={42}
      />
      <LabelChip
        x={1560}
        y={1120}
        label="Electricity"
        value="19,240.55"
        percent="+6.30%"
        appearAt={126}
        fontSize={42}
        valueColor="#ffd27a"
      />
      <LabelChip
        x={2180}
        y={1260}
        label="Ethanol"
        value="8,706.21"
        percent="-1.08%"
        appearAt={156}
        fontSize={42}
      />

      <Histogram
        x={225}
        baseline={1620}
        width={2535}
        maxHeight={250}
        count={86}
        seed={29}
        colors={["#2f7fd0", "#3fa0e0", "#f2a33c", "#ece55e"]}
        drawStart={56}
        drawDuration={210}
      />

      <ScreenTexture {...BLEED_RECT} pitch={6} opacity={0.1} />
    </DashboardStage>
  );
};

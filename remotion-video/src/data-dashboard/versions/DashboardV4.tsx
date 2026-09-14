import React from "react";
import { z } from "zod";
import { AbsoluteFill } from "remotion";
import { GlowSpot, Grade, Vignette } from "../components/Atmosphere";
import { AxisTicks } from "../components/AxisTicks";
import { DashboardStage } from "../components/DashboardStage";
import { DonutChart } from "../components/DonutChart";
import { Histogram } from "../components/Histogram";
import { LabelChip } from "../components/LabelChip";
import { LineSeries } from "../components/LineSeries";
import { MarkerStack } from "../components/Markers";
import { ScreenGrid } from "../components/ScreenGrid";
import { ScreenTexture } from "../components/ScreenTexture";
import { RadarDial, SpectrumWidget } from "../components/Widgets";
import type { CameraKeyframe } from "../camera";
import { SERIES_COLORS } from "../constants";
import { addTremble, buildSeries, type PlotBand } from "../series";

export const dashboardV4Schema = z.object({
  resolutionScale: z.number().min(1).max(4),
});

export const dashboardV4Defaults: z.infer<typeof dashboardV4Schema> = {
  resolutionScale: 1,
};

// Version 4 - "Macro Panel". The busiest layout and the only one where
// the board is a finite object: the panel has edges, and the defocused
// room behind it is visible past them at the start of the move. The
// camera tracks laterally across the panel, swinging from a raking
// three-quarter view to nearly square on.
const PANEL = { x: 60, y: 200, width: 2880, height: 1390 };

const CAMERA: CameraKeyframe[] = [
  {
    frame: 0,
    x: 300,
    y: 20,
    z: 150,
    rotateX: 5.5,
    rotateY: -18,
    rotateZ: -1.8,
    scale: 0.74,
  },
  {
    frame: 300,
    x: -300,
    y: -10,
    z: 0,
    rotateX: 2.4,
    rotateY: 6,
    rotateZ: 1.2,
    scale: 0.72,
  },
];

const TRACES: { color: string; seed: number; offset: number; trend: number }[] =
  [
    { color: SERIES_COLORS.white, seed: 301, offset: 0, trend: 0.62 },
    { color: SERIES_COLORS.cyan, seed: 311, offset: 90, trend: 0.36 },
    { color: SERIES_COLORS.amber, seed: 317, offset: 180, trend: 0.5 },
    { color: SERIES_COLORS.salmon, seed: 331, offset: 270, trend: 0.2 },
    { color: SERIES_COLORS.sky, seed: 347, offset: 360, trend: 0.44 },
  ];

export const DashboardV4: React.FC<z.infer<typeof dashboardV4Schema>> = ({
  resolutionScale,
}) => {
  const band = (offset: number): PlotBand => ({
    x: 180,
    y: 600 + offset,
    width: 2640,
    height: 250,
  });

  return (
    <DashboardStage
      resolutionScale={resolutionScale}
      perspective={1900}
      camera={CAMERA}
      backgroundColor="#080f1e"
      backdrop={
        <>
          {/* Defocused room behind the panel, visible past its edges. */}
          <GlowSpot
            x="6%"
            y="22%"
            size="52%"
            color="rgba(138, 162, 104, 0.85)"
          />
          <GlowSpot x="4%" y="72%" size="44%" color="rgba(44, 108, 156, 0.8)" />
          <GlowSpot
            x="96%"
            y="64%"
            size="58%"
            color="rgba(34, 104, 180, 0.85)"
          />
          <GlowSpot x="50%" y="50%" size="96%" color="rgba(18, 56, 112, 0.9)" />
        </>
      }
      overlay={
        <AbsoluteFill>
          <Vignette strength={0.44} />
          <Grade color="rgba(56, 130, 210, 0.3)" opacity={0.28} />
        </AbsoluteFill>
      }
    >
      {/* The panel itself - a finite screen, not an infinite board. */}
      <rect {...PANEL} fill="#081228" />
      <rect
        {...PANEL}
        fill="none"
        stroke="rgba(150, 205, 255, 0.4)"
        strokeWidth={5}
      />
      <rect
        x={PANEL.x}
        y={PANEL.y + PANEL.height}
        width={PANEL.width}
        height={26}
        fill="rgba(120, 175, 235, 0.22)"
      />
      <ScreenGrid
        x={PANEL.x}
        y={PANEL.y}
        width={PANEL.width}
        height={PANEL.height}
        cell={48}
        majorEvery={5}
        color="rgba(95, 150, 220, 0.12)"
        majorColor="rgba(120, 180, 245, 0.22)"
      />

      <AxisTicks
        x={330}
        y={450}
        step={56}
        count={17}
        from={1000000}
        increment={-58000}
        fontSize={20}
      />
      <AxisTicks
        x={2800}
        y={450}
        step={56}
        count={17}
        from={9000}
        increment={-520}
        fontSize={20}
        decimals={0}
      />

      <DonutChart
        cx={720}
        cy={420}
        radius={150}
        seed={401}
        segments={7}
        color="#4fa8e8"
        accentColor="#7fc4f0"
        years={["2024", "2025", "2026", "2027", "2028", "2029"]}
        appearAt={-24}
      />
      <SpectrumWidget
        x={1240}
        y={300}
        width={520}
        height={230}
        seed={409}
        colors={["#f08bb0", "#5fb5ee"]}
        appearAt={-16}
      />
      <RadarDial cx={2280} cy={410} radius={120} seed={419} appearAt={-8} />

      {TRACES.map((trace, i) => (
        <LineSeries
          key={trace.seed}
          series={addTremble(
            buildSeries(trace.seed, {
              count: 250,
              volatility: 0.1,
              trend: trace.trend,
              smoothing: 5,
            }),
            trace.seed,
            0.05,
          )}
          band={band(trace.offset)}
          color={trace.color}
          strokeWidth={4}
          drawStart={-60 + i * 12}
          drawDuration={260}
          head
        />
      ))}

      <MarkerStack
        x={1450}
        y={760}
        count={3}
        color={SERIES_COLORS.salmon}
        size={24}
        spacing={42}
        seed={83}
        startAt={60}
      />
      <MarkerStack
        x={2180}
        y={880}
        count={3}
        direction="down"
        color={SERIES_COLORS.amber}
        size={24}
        spacing={42}
        seed={89}
        startAt={110}
      />
      <MarkerStack
        x={620}
        y={840}
        count={3}
        color={SERIES_COLORS.yellow}
        size={24}
        spacing={42}
        seed={97}
        startAt={30}
      />

      <LabelChip
        x={480}
        y={740}
        label="Expenses"
        value="19,605.40"
        appearAt={18}
        fontSize={44}
        chip={false}
        color="#cfe6ff"
      />
      <LabelChip
        x={380}
        y={900}
        label="Fees"
        value="18,701.76"
        appearAt={46}
        fontSize={44}
        chip={false}
        color="#cfe6ff"
      />
      <LabelChip
        x={1180}
        y={660}
        label="Insurance"
        value="304,283.51"
        appearAt={82}
        fontSize={44}
        chip={false}
        color="#ffffff"
      />
      <LabelChip
        x={980}
        y={940}
        label="Prices"
        value="19,112.63"
        percent="6.15%"
        appearAt={118}
        fontSize={44}
        chip={false}
        color="#ffffff"
      />
      <LabelChip
        x={1880}
        y={700}
        label="Tariffs"
        value="570,222.61"
        appearAt={158}
        fontSize={44}
        chip={false}
        color="#ffffff"
      />
      <LabelChip
        x={2400}
        y={980}
        label="Debt"
        value="889,815.74"
        appearAt={196}
        fontSize={44}
        chip={false}
        color="#ffd27a"
      />
      <LabelChip
        x={2020}
        y={1120}
        label="Inflation"
        value="868,894.34"
        appearAt={234}
        fontSize={44}
        chip={false}
        color="#ffd27a"
      />

      <Histogram
        x={180}
        baseline={1470}
        width={2640}
        maxHeight={330}
        count={132}
        seed={431}
        colors={["#2f7fd0", "#43a7e4", "#f2a33c", "#ece55e", "#ff7f6b"]}
        drawStart={-130}
        drawDuration={330}
      />
      <line
        x1={180}
        y1={1470}
        x2={2820}
        y2={1470}
        stroke="rgba(150, 200, 250, 0.4)"
        strokeWidth={3}
      />
      <AxisTicks
        x={260}
        y={1535}
        step={216}
        count={13}
        from={0}
        increment={0}
        orientation="horizontal"
        anchor="middle"
        fontSize={24}
        color="rgba(180, 215, 250, 0.75)"
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
          "Q3",
          "Q4",
          "2029",
        ]}
      />

      <ScreenTexture
        x={PANEL.x}
        y={PANEL.y}
        width={PANEL.width}
        height={PANEL.height}
        pitch={6}
        opacity={0.1}
      />
    </DashboardStage>
  );
};

import React from "react";
import { z } from "zod";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { GlowSpot, Grade, Vignette } from "../components/Atmosphere";
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

export const dashboardV2Schema = z.object({
  resolutionScale: z.number().min(1).max(4),
});

export const dashboardV2Defaults: z.infer<typeof dashboardV2Schema> = {
  resolutionScale: 1,
};

// Version 2 - "Household Costs". Opens as a long lens pressed against
// the board - heavy perspective, a diagonal drift across the surface, a
// rack focus that keeps one depth sharp at a time - then pulls all the
// way back so the film lands wide on the finished graph. Where version 1
// is about reading the board, this one is about arriving at it.
const CAMERA: CameraKeyframe[] = [
  {
    frame: 0,
    x: -430,
    y: 210,
    z: 150,
    rotateX: 9.5,
    rotateY: -26,
    rotateZ: -2.6,
    scale: 1.5,
  },
  {
    frame: 170,
    x: 250,
    y: -140,
    z: 70,
    rotateX: 6,
    rotateY: -16,
    rotateZ: 1.2,
    scale: 1.18,
  },
  {
    frame: 300,
    x: 0,
    y: 0,
    z: -60,
    rotateX: 2,
    rotateY: -4,
    rotateZ: 0.3,
    scale: 0.64,
  },
];

const TRACES: {
  color: string;
  seed: number;
  offset: number;
  trend: number;
  width: number;
  // Which focus plane the trace belongs to; drives the rack focus.
  depth: "far" | "mid" | "near";
}[] = [
  {
    color: SERIES_COLORS.cyan,
    seed: 191,
    offset: -300,
    trend: 0.36,
    width: 4,
    depth: "far",
  },
  {
    color: SERIES_COLORS.cyan,
    seed: 101,
    offset: -160,
    trend: 0.55,
    width: 4,
    depth: "far",
  },
  {
    color: SERIES_COLORS.sky,
    seed: 113,
    offset: -40,
    trend: 0.3,
    width: 5,
    depth: "far",
  },
  {
    color: SERIES_COLORS.white,
    seed: 127,
    offset: 90,
    trend: 0.66,
    width: 5,
    depth: "mid",
  },
  {
    color: SERIES_COLORS.cyan,
    seed: 139,
    offset: 240,
    trend: 0.42,
    width: 6,
    depth: "mid",
  },
  {
    color: SERIES_COLORS.amber,
    seed: 151,
    offset: 400,
    trend: 0.24,
    width: 5,
    depth: "near",
  },
  {
    color: SERIES_COLORS.white,
    seed: 163,
    offset: 540,
    trend: 0.7,
    width: 6,
    depth: "near",
  },
  {
    color: SERIES_COLORS.sky,
    seed: 179,
    offset: 700,
    trend: 0.5,
    width: 5,
    depth: "near",
  },
];

// Loose readouts scattered over the surface. For most of the shot the
// camera only sees a fraction of the board, so the plate has to be
// populated everywhere rather than composed for one framing.
const LOOSE_VALUES: { x: number; y: number; text: string; color: string }[] = [
  { x: 220, y: 560, text: "2,417.08", color: "rgba(150, 205, 255, 0.6)" },
  { x: 900, y: 500, text: "1,982.44", color: "rgba(150, 205, 255, 0.55)" },
  { x: 1640, y: 1240, text: "4.18%", color: "rgba(240, 170, 90, 0.75)" },
  { x: 2180, y: 560, text: "27,904.11", color: "rgba(150, 205, 255, 0.6)" },
  { x: 2560, y: 470, text: "1,285.40", color: "rgba(150, 205, 255, 0.55)" },
  { x: 2600, y: 860, text: "7.85%", color: "rgba(240, 170, 90, 0.7)" },
  { x: 420, y: 1220, text: "9,640.27", color: "rgba(150, 205, 255, 0.55)" },
  { x: 2540, y: 1470, text: "3.02%", color: "rgba(240, 170, 90, 0.7)" },
];

export const DashboardV2: React.FC<z.infer<typeof dashboardV2Schema>> = ({
  resolutionScale,
}) => {
  const frame = useCurrentFrame();

  // Rack focus: the sharp plane travels from the back of the board to
  // the front while the camera is close, then the whole thing resolves
  // to deep focus as it pulls back - the last frames have to read as a
  // complete, sharp graph, not a defocused texture.
  const focus = interpolate(frame, [0, 190, 300], [0, 1, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const spread = interpolate(frame, [0, 190, 300], [13, 13, 0.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const blurFor = (depth: number) => Math.abs(depth - focus) * spread + 0.3;

  const band = (offset: number): PlotBand => ({
    x: 120,
    y: 540 + offset,
    width: 2760,
    height: 300,
  });

  return (
    <DashboardStage
      resolutionScale={resolutionScale}
      perspective={1500}
      camera={CAMERA}
      backgroundColor="#03060e"
      backdrop={
        <>
          <GlowSpot
            x="48%"
            y="50%"
            size="82%"
            color="rgba(20, 60, 122, 0.75)"
          />
          <GlowSpot x="82%" y="28%" size="48%" color="rgba(18, 84, 142, 0.5)" />
        </>
      }
      overlay={
        <AbsoluteFill>
          <Vignette strength={0.72} color="rgba(0, 1, 6, 0.96)" />
          <Grade color="rgba(40, 110, 200, 0.28)" opacity={0.3} />
        </AbsoluteFill>
      }
      defs={
        <>
          <filter id="dof-far" x="-6%" y="-6%" width="112%" height="112%">
            <feGaussianBlur stdDeviation={blurFor(0)} />
          </filter>
          <filter id="dof-mid" x="-6%" y="-6%" width="112%" height="112%">
            <feGaussianBlur stdDeviation={blurFor(0.5)} />
          </filter>
          <filter id="dof-near" x="-6%" y="-6%" width="112%" height="112%">
            <feGaussianBlur stdDeviation={blurFor(1)} />
          </filter>
        </>
      }
    >
      <rect {...BLEED_RECT} fill="#060a14" />
      <ScreenGrid
        x={BLEED_RECT.x}
        y={BLEED_RECT.y}
        width={BLEED_RECT.width}
        height={BLEED_RECT.height}
        cell={86}
        majorEvery={4}
        color="rgba(90, 140, 210, 0.1)"
        majorColor="rgba(110, 170, 240, 0.2)"
        strokeWidth={2}
      />

      {/* Far plane: axis scaffolding and the quietest traces. */}
      <g filter="url(#dof-far)">
        <AxisTicks
          x={300}
          y={480}
          step={112}
          count={10}
          from={3000}
          increment={-280}
          fontSize={38}
        />
        <line
          x1={330}
          y1={350}
          x2={330}
          y2={1480}
          stroke="rgba(120, 180, 245, 0.35)"
          strokeWidth={3}
        />
        {TRACES.filter((t) => t.depth === "far").map((trace, i) => (
          <LineSeries
            key={trace.seed}
            series={addTremble(
              buildSeries(trace.seed, {
                count: 230,
                volatility: 0.12,
                trend: trace.trend,
                smoothing: 4,
              }),
              trace.seed,
              0.06,
            )}
            band={band(trace.offset)}
            color={trace.color}
            strokeWidth={trace.width}
            drawStart={-120 + i * 14}
            drawDuration={290}
            glow={0.8}
          />
        ))}
        <LabelChip
          x={1180}
          y={400}
          label="Heating"
          value="6.50%"
          appearAt={0}
          fontSize={60}
          valuePlacement="right"
        />
        <LabelChip
          x={2220}
          y={330}
          label="Food"
          value="1,285.40"
          appearAt={0}
          fontSize={56}
          valuePlacement="right"
        />
      </g>

      {/* Mid plane: the traces the shot opens on. */}
      <g filter="url(#dof-mid)">
        {TRACES.filter((t) => t.depth === "mid").map((trace, i) => (
          <LineSeries
            key={trace.seed}
            series={addTremble(
              buildSeries(trace.seed, {
                count: 230,
                volatility: 0.13,
                trend: trace.trend,
                smoothing: 4,
              }),
              trace.seed,
              0.07,
            )}
            band={band(trace.offset)}
            color={trace.color}
            strokeWidth={trace.width}
            drawStart={-100 + i * 16}
            drawDuration={290}
            glow={0.9}
          />
        ))}
        <LabelChip
          x={760}
          y={980}
          label="Electricity"
          value="1,716.63"
          percent="6.30%"
          appearAt={10}
          fontSize={62}
        />
        <LabelChip
          x={1960}
          y={1100}
          label="Rent"
          value="11,727.52"
          appearAt={72}
          fontSize={62}
          valuePlacement="right"
        />
        <MarkerStack
          x={1520}
          y={840}
          count={3}
          color={SERIES_COLORS.yellow}
          size={34}
          spacing={58}
          seed={41}
          startAt={0}
        />
        <MarkerStack
          x={2540}
          y={700}
          count={3}
          color={SERIES_COLORS.yellow}
          size={34}
          spacing={58}
          seed={47}
          startAt={40}
        />
      </g>

      {/* Near plane: the biggest type, sharp by the end of the move. */}
      <g filter="url(#dof-near)">
        {TRACES.filter((t) => t.depth === "near").map((trace, i) => (
          <LineSeries
            key={trace.seed}
            series={addTremble(
              buildSeries(trace.seed, {
                count: 230,
                volatility: 0.14,
                trend: trace.trend,
                smoothing: 4,
              }),
              trace.seed,
              0.08,
            )}
            band={band(trace.offset)}
            color={trace.color}
            strokeWidth={trace.width}
            drawStart={-80 + i * 18}
            drawDuration={290}
            glow={1}
          />
        ))}
        <LabelChip
          x={520}
          y={1330}
          label="Taxes"
          value="11,377.49"
          appearAt={120}
          fontSize={62}
        />
        <LabelChip
          x={1700}
          y={1420}
          label="Mortgage"
          value="453,285.18"
          percent="5.90%"
          appearAt={168}
          fontSize={62}
        />
        <LabelChip
          x={2380}
          y={1250}
          label="Gasoline"
          value="368,830.65"
          appearAt={206}
          fontSize={62}
        />
        <LabelChip
          x={2380}
          y={930}
          label="Transport"
          value="10,964.49"
          appearAt={244}
          fontSize={60}
        />
        <MarkerStack
          x={2200}
          y={1190}
          count={3}
          direction="down"
          color={SERIES_COLORS.amber}
          size={38}
          spacing={64}
          seed={53}
          startAt={150}
        />
      </g>

      {/* Bottom quarter rail, in the reference's orange. */}
      <g filter="url(#dof-near)">
        <line
          x1={120}
          y1={1600}
          x2={2880}
          y2={1600}
          stroke="#f07a3c"
          strokeWidth={5}
          opacity={0.85}
        />
        <AxisTicks
          x={280}
          y={1668}
          step={340}
          count={8}
          from={0}
          increment={0}
          orientation="horizontal"
          anchor="middle"
          fontSize={38}
          color="rgba(240, 150, 80, 0.9)"
          labels={["2026", "Q2", "Q3", "Q4", "2027", "Q2", "Q3", "Q4"]}
        />
      </g>

      <g fontFamily={FONT_MONO} fontSize={44} fontWeight={400}>
        {LOOSE_VALUES.map((v) => (
          <text key={`${v.x}-${v.y}`} x={v.x} y={v.y} fill={v.color}>
            {v.text}
          </text>
        ))}
      </g>

      <ScreenTexture {...BLEED_RECT} pitch={10} opacity={0.14} />
    </DashboardStage>
  );
};

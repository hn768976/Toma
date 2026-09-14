import React from "react";
import { useTheme } from "./context";
import {
  LAYOUT_HEIGHT,
  LAYOUT_WIDTH,
  PLANE_HEIGHT,
  PLANE_MARGIN_X,
  PLANE_MARGIN_Y,
  PLANE_WIDTH,
} from "./Camera";
import {
  AreaChart,
  BarChart,
  BarRows,
  DualTrace,
  Gauge,
  HeatGrid,
  RingGauge,
  ScatterPlot,
  StatBlock,
  StepTrace,
} from "./charts";
import { Callout, Globe, OrbitRing } from "./Globe";
import { Battery, Gear, SolarArray, SweepDisc, Turbine } from "./icons";
import { Grid, Label, MONO, Panel, TextRows, TickStrip, Ticker, type Box } from "./primitives";

const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
const pad = (b: Box, top = 26, side = 12, bottom = 12): Box => ({
  x: b.x + side,
  y: b.y + top,
  w: b.w - side * 2,
  h: b.h - top - bottom,
});

/**
 * Layout B - the same instrument kit, re-composed.
 *
 * Where the reference stacks columns around a centred globe, this version is
 * banded: a full-width header rail, an asymmetric body with the globe pushed
 * right and the generation cluster on the left, and a wide footer of scopes.
 * Paired with the blue palette it reads as a different console entirely.
 */
export const LayoutAlternate: React.FC = () => {
  const theme = useTheme();

  const globeCx = 2110;
  const globeCy = 940;
  const globeR = 300;

  const headerRail = box(70, 70, 2860, 170);
  const solarPanel = box(70, 300, 700, 520);
  const scanPanel = box(70, 850, 700, 480);
  const midPanels = [
    box(810, 300, 540, 250),
    box(810, 580, 540, 250),
    box(810, 860, 540, 230),
    box(810, 1120, 540, 210),
  ];
  const footerPanels = Array.from({ length: 5 }, (_, i) =>
    box(70 + i * 585, 1400, 545, 320),
  );

  return (
    <svg
      width={PLANE_WIDTH}
      height={PLANE_HEIGHT}
      viewBox={`0 0 ${PLANE_WIDTH} ${PLANE_HEIGHT}`}
      style={{ display: "block" }}
    >
      <defs>
        <radialGradient id="globe-halo">
          <stop offset="0%" stopColor={theme.glow} stopOpacity={0.4} />
          <stop offset="55%" stopColor={theme.glow} stopOpacity={0.14} />
          <stop offset="100%" stopColor={theme.glow} stopOpacity={0} />
        </radialGradient>
      </defs>
      <rect width={PLANE_WIDTH} height={PLANE_HEIGHT} fill={theme.surface} />
      <Grid
        box={box(0, 0, PLANE_WIDTH, PLANE_HEIGHT)}
        cols={Math.round(PLANE_WIDTH / 108)}
        rows={Math.round(PLANE_HEIGHT / 108)}
        opacity={0.3}
      />
      {/* Overhang texture: faint hardware that runs off the frame edges so the
          console never looks like a floating card. */}
      <g opacity={0.5}>
        <Gear cx={PLANE_MARGIN_X * 0.35} cy={PLANE_HEIGHT * 0.3} r={230} teeth={19} rpm={1.8} opacity={0.16} />
        <Gear cx={PLANE_WIDTH - PLANE_MARGIN_X * 0.3} cy={PLANE_HEIGHT * 0.74} r={280} teeth={22} rpm={-1.4} opacity={0.14} />
        <TickStrip box={box(PLANE_MARGIN_X, PLANE_MARGIN_Y * 0.45, LAYOUT_WIDTH, 44)} count={96} seed="edge-top" />
        <TickStrip
          box={box(PLANE_MARGIN_X, PLANE_HEIGHT - PLANE_MARGIN_Y * 0.55, LAYOUT_WIDTH, 44)}
          count={96}
          seed="edge-bottom"
        />
        <TickStrip
          box={box(PLANE_MARGIN_X * 0.4, PLANE_MARGIN_Y, 40, LAYOUT_HEIGHT)}
          count={60}
          orientation="vertical"
          seed="edge-left"
        />
        <TickStrip
          box={box(PLANE_WIDTH - PLANE_MARGIN_X * 0.55, PLANE_MARGIN_Y, 40, LAYOUT_HEIGHT)}
          count={60}
          orientation="vertical"
          seed="edge-right"
        />
      </g>
      <g transform={`translate(${PLANE_MARGIN_X} ${PLANE_MARGIN_Y})`}>

      {/* --- header rail: title, live strip, headline numbers ------------- */}
      <Panel box={headerRail} label="" corners={false}>
        <text
          x={headerRail.x + 26}
          y={headerRail.y + 78}
          fill={theme.hot}
          fontSize={54}
          fontFamily={MONO}
          letterSpacing={12}
        >
          Clean Energy
        </text>
        <Label
          x={headerRail.x + 30}
          y={headerRail.y + 122}
          size={13}
          tracking={6}
          opacity={0.65}
          color={theme.mid}
        >
          DISTRIBUTED GENERATION CONTROL / SECTOR 07
        </Label>
        <TickStrip box={box(headerRail.x + 900, headerRail.y + 40, 900, 44)} count={60} seed="hdr" />
        <StepTrace box={box(headerRail.x + 900, headerRail.y + 96, 900, 54)} seed="hdr-step" />
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <Label
              x={headerRail.x + 1900 + i * 320}
              y={headerRail.y + 50}
              size={11}
              tracking={3}
              opacity={0.7}
            >
              {["CAPACITY", "OUTPUT", "STORED"][i]}
            </Label>
            <Ticker
              x={headerRail.x + 1900 + i * 320}
              y={headerRail.y + 110}
              seed={`hdr-n${i}`}
              digits={3}
              decimals={1}
              size={40}
              period={20}
            />
          </g>
        ))}
      </Panel>

      {/* --- left: generation cluster ------------------------------------ */}
      <Panel box={solarPanel} label="SOLAR ARRAY 12">
        <SolarArray box={box(solarPanel.x + 70, solarPanel.y + 70, 420, 330)} />
        <Turbine cx={solarPanel.x + 590} baseY={solarPanel.y + 440} height={330} rpm={13} />
        <BarRows box={box(solarPanel.x + 24, solarPanel.y + 450, 650, 56)} seed="solar-rows" rows={2} />
      </Panel>

      <Panel box={scanPanel} label="GRID COVERAGE">
        <SweepDisc cx={scanPanel.x + 200} cy={scanPanel.y + 220} r={155} />
        <StatBlock
          box={box(scanPanel.x + 420, scanPanel.y + 70, 250, 220)}
          seed="scan-stats"
          entries={["NODES", "LINKS", "LOSS", "PHASE", "DRIFT"]}
        />
        <TextRows box={box(scanPanel.x + 420, scanPanel.y + 320, 250, 120)} seed="scan-rows" rows={6} churn={36} />
      </Panel>

      {/* --- middle instrument stack ------------------------------------- */}
      <Panel box={midPanels[0]} label="THROUGHPUT">
        <AreaChart box={pad(midPanels[0])} seed="alt-through" speed={1.3} />
      </Panel>
      <Panel box={midPanels[1]} label="RESERVE">
        <BarChart box={pad(midPanels[1])} seed="alt-reserve" bars={16} accentEvery={4} />
      </Panel>
      <Panel box={midPanels[2]} label="HARMONICS">
        <DualTrace box={pad(midPanels[2])} seed="alt-harm" speed={1.8} />
      </Panel>
      <Panel box={midPanels[3]} label="CELLS">
        <HeatGrid box={pad(midPanels[3])} seed="alt-cells" cols={14} rows={4} />
      </Panel>

      {/* --- right: the globe, pushed off-centre -------------------------- */}
      <g>
        <circle cx={globeCx} cy={globeCy} r={globeR * 1.8} fill={`url(#globe-halo)`} />
        <OrbitRing cx={globeCx} cy={globeCy} r={globeR * 1.34} nodes={13} speed={7} />
        <Globe cx={globeCx} cy={globeCy} r={globeR} spin={-6} density={3000} />
        <Callout
          x={globeCx - globeR * 0.74}
          y={globeCy - globeR * 0.5}
          dx={-300}
          dy={-210}
          lines={["INTERTIE 09", "TRANSFER 1.42 GW"]}
        />
        <Callout
          x={globeCx + globeR * 0.5}
          y={globeCy + globeR * 0.72}
          dx={260}
          dy={200}
          lines={["STORAGE RING STABLE"]}
        />
      </g>

      {/* Vertical charge column on the right edge. */}
      <Panel box={box(2680, 300, 260, 520)} label="STORE">
        <g transform={`rotate(-90 2810 560)`}>
          <Battery box={box(2810 - 200, 560 - 44, 400, 88)} segments={10} seed="alt-battery" />
        </g>
        <Ticker
          x={2810}
          y={790}
          seed="alt-store-n"
          digits={3}
          size={34}
          anchor="middle"
          period={26}
        />
      </Panel>

      <Panel box={box(2680, 850, 260, 480)} label="YIELD">
        <RingGauge cx={2810} cy={1000} r={90} seed="alt-ring" />
        <Gauge cx={2810} cy={1250} r={90} seed="alt-gauge" label="Hz" />
      </Panel>

      {/* --- footer rail -------------------------------------------------- */}
      {footerPanels.map((b, i) => (
        <Panel key={`f${i}`} box={b} label={["INFLOW", "DEMAND", "MARKET", "WEATHER", "ALERTS"][i]}>
          {i === 0 ? (
            <AreaChart box={pad(b)} seed="foot-0" speed={0.8} />
          ) : i === 1 ? (
            <BarChart box={pad(b)} seed="foot-1" bars={18} />
          ) : i === 2 ? (
            <ScatterPlot box={pad(b)} seed="foot-2" count={34} />
          ) : i === 3 ? (
            <BarRows box={pad(b)} seed="foot-3" rows={5} speed={0.9} />
          ) : (
            <TextRows box={pad(b)} seed="foot-4" rows={10} churn={30} />
          )}
          <Ticker
            x={b.x + b.w - 14}
            y={b.y + 16}
            seed={`foot-n${i}`}
            digits={4}
            anchor="end"
            size={11}
          />
        </Panel>
      ))}

      <Gear cx={130} cy={1780} r={190} teeth={17} rpm={2.8} opacity={0.26} />
      <Gear cx={2880} cy={1640} r={150} teeth={14} rpm={-3.2} opacity={0.24} />

      <Label x={70} y={1790} size={12} tracking={4} opacity={0.6}>
        LINK STABLE / TELEMETRY 30 FPS
      </Label>
      <Label x={2930} y={1860} size={12} tracking={4} opacity={0.6} anchor="end">
        REV 02 / BLUE CONSOLE
      </Label>
      </g>
    </svg>
  );
};

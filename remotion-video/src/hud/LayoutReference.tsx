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
import { Battery, Gear, PlugMark, Turbine } from "./icons";
import { Grid, Label, MONO, Panel, TextRows, TickStrip, Ticker, type Box } from "./primitives";

const box = (x: number, y: number, w: number, h: number): Box => ({ x, y, w, h });
/** Inset a panel to get its plot area. */
const pad = (b: Box, top = 26, side = 12, bottom = 12): Box => ({
  x: b.x + side,
  y: b.y + top,
  w: b.w - side * 2,
  h: b.h - top - bottom,
});

/**
 * Layout A - the reference console.
 *
 * A dense instrument wall: readout columns down both sides, a strip of small
 * scopes along the top, the dotted globe holding the centre, the clean-energy
 * block on the right and a power bar across the bottom.
 */
export const LayoutReference: React.FC = () => {
  const theme = useTheme();

  const globeCx = 1290;
  const globeCy = 880;
  const globeR = 250;

  // Top strip: eight narrow scopes.
  const topPanels = Array.from({ length: 8 }, (_, i) =>
    box(70 + i * 360, 70, 320, 150),
  );

  // Left column: stacked instrument blocks.
  const leftPanels = [
    box(70, 260, 480, 210),
    box(70, 490, 480, 170),
    box(70, 680, 230, 250),
    box(320, 680, 230, 250),
    box(70, 950, 480, 200),
    box(70, 1170, 480, 230),
  ];

  // Right column: the clean-energy block plus its supporting readouts.
  const energyPanel = box(2040, 260, 620, 900);
  const rightPanels = [
    box(2700, 260, 240, 290),
    box(2700, 570, 240, 290),
    box(2700, 880, 240, 280),
  ];

  return (
    <svg
      width={PLANE_WIDTH}
      height={PLANE_HEIGHT}
      viewBox={`0 0 ${PLANE_WIDTH} ${PLANE_HEIGHT}`}
      style={{ display: "block" }}
    >
      {/* Console surface and its underlying graph paper. */}
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
        opacity={0.28}
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

      {/* --- top strip --------------------------------------------------- */}
      {topPanels.map((b, i) => (
        <Panel key={`t${i}`} box={b} label={`CH ${String(i + 1).padStart(2, "0")}`}>
          {i % 3 === 0 ? (
            <AreaChart box={pad(b)} seed={`top-a${i}`} speed={1.1 + i * 0.1} />
          ) : i % 3 === 1 ? (
            <BarChart box={pad(b)} seed={`top-b${i}`} bars={12} />
          ) : (
            <StepTrace box={pad(b)} seed={`top-c${i}`} />
          )}
          <Ticker
            x={b.x + b.w - 12}
            y={b.y + 16}
            seed={`top-n${i}`}
            digits={3}
            decimals={1}
            anchor="end"
            size={11}
          />
        </Panel>
      ))}

      {/* --- left column ------------------------------------------------- */}
      <Panel box={leftPanels[0]} label="OUTPUT / MW">
        <AreaChart box={pad(leftPanels[0])} seed="left-out" speed={0.9} />
        <Ticker
          x={leftPanels[0].x + leftPanels[0].w - 12}
          y={leftPanels[0].y + 16}
          seed="left-out-n"
          digits={4}
          decimals={2}
          anchor="end"
        />
      </Panel>

      <Panel box={leftPanels[1]} label="LOAD BALANCE">
        <BarRows box={pad(leftPanels[1])} seed="left-load" rows={4} />
      </Panel>

      <Panel box={leftPanels[2]} label="FLUX">
        <Gauge
          cx={leftPanels[2].x + leftPanels[2].w / 2}
          cy={leftPanels[2].y + 165}
          r={78}
          seed="left-gauge"
          label="kV"
        />
      </Panel>

      <Panel box={leftPanels[3]} label="PHASE">
        <ScatterPlot box={pad(leftPanels[3])} seed="left-scatter" />
      </Panel>

      <Panel box={leftPanels[4]} label="SPECTRUM">
        <DualTrace box={pad(leftPanels[4])} seed="left-dual" />
      </Panel>

      <Panel box={leftPanels[5]} label="NODE REGISTRY">
        <TextRows box={pad(leftPanels[5])} seed="left-rows" rows={9} churn={40} />
      </Panel>

      {/* --- inner columns flanking the globe ----------------------------- */}
      <Panel box={box(600, 260, 300, 400)} label="INTERTIE">
        <BarChart box={pad(box(600, 260, 300, 400))} seed="inner-a" bars={10} />
      </Panel>
      <Panel box={box(600, 690, 300, 330)} label="CARBON">
        <RingGauge cx={750} cy={860} r={92} seed="inner-ring" />
      </Panel>
      <Panel box={box(600, 1050, 300, 350)} label="LOG">
        <TextRows box={pad(box(600, 1050, 300, 350))} seed="inner-log" rows={12} churn={26} />
      </Panel>
      <Panel box={box(1700, 260, 300, 400)} label="FORECAST">
        <AreaChart box={pad(box(1700, 260, 300, 400))} seed="inner-fc" speed={0.7} />
      </Panel>
      <Panel box={box(1700, 690, 300, 330)} label="STORAGE">
        <BarRows box={pad(box(1700, 690, 300, 330))} seed="inner-store" rows={6} />
      </Panel>
      <Panel box={box(1700, 1050, 300, 350)} label="EMISSION">
        <ScatterPlot box={pad(box(1700, 1050, 300, 350))} seed="inner-emit" count={40} />
      </Panel>

      {/* --- centre: the globe ------------------------------------------- */}
      <g>
        <circle
          cx={globeCx}
          cy={globeCy}
          r={globeR * 1.85}
          fill={`url(#globe-halo)`}
        />
        <OrbitRing cx={globeCx} cy={globeCy} r={globeR * 1.42} nodes={11} />
        <Globe cx={globeCx} cy={globeCy} r={globeR} spin={8} />
        <Callout
          x={globeCx + globeR * 0.62}
          y={globeCy - globeR * 0.66}
          dx={155}
          dy={-315}
          lines={["ARRAY 04 / ONLINE", "CAPACITY 92.4%"]}
        />
        <Callout
          x={globeCx - globeR * 0.7}
          y={globeCy + globeR * 0.6}
          dx={-120}
          dy={230}
          lines={["GRID SYNC LOCKED"]}
        />
        <Label x={globeCx} y={globeCy + globeR * 1.85} anchor="middle" size={16} tracking={7}>
          GLOBAL ENERGY NETWORK
        </Label>
        <Label
          x={globeCx}
          y={globeCy + globeR * 1.85 + 26}
          anchor="middle"
          size={11}
          tracking={3}
          opacity={0.6}
          color={theme.mid}
        >
          REALTIME TELEMETRY / 30 FPS
        </Label>
      </g>

      {/* --- right: clean energy block ----------------------------------- */}
      <Panel box={energyPanel} label="RENEWABLE SOURCE">
        <Grid box={pad(energyPanel)} cols={9} rows={11} opacity={0.3} />
        <Turbine
          cx={energyPanel.x + energyPanel.w * 0.46}
          baseY={energyPanel.y + 660}
          height={520}
          rpm={10}
        />
        <PlugMark
          cx={energyPanel.x + energyPanel.w * 0.46}
          cy={energyPanel.y + 730}
          size={110}
        />
        <text
          x={energyPanel.x + energyPanel.w / 2}
          y={energyPanel.y + 840}
          fill={theme.hot}
          fontSize={40}
          fontFamily={MONO}
          textAnchor="middle"
          letterSpacing={5}
        >
          Clean Energy
        </text>
        <Ticker
          x={energyPanel.x + 20}
          y={energyPanel.y + 880}
          seed="energy-a"
          digits={5}
          decimals={2}
          size={14}
        />
        <Ticker
          x={energyPanel.x + energyPanel.w - 20}
          y={energyPanel.y + 880}
          seed="energy-b"
          digits={4}
          decimals={1}
          anchor="end"
          size={14}
        />
      </Panel>

      <Panel box={rightPanels[0]} label="ENERGY">
        <text
          x={rightPanels[0].x + rightPanels[0].w / 2}
          y={rightPanels[0].y + 130}
          fill={theme.hot}
          fontSize={62}
          fontFamily={MONO}
          textAnchor="middle"
        >
          ⚡
        </text>
        <Ticker
          x={rightPanels[0].x + rightPanels[0].w / 2}
          y={rightPanels[0].y + 220}
          seed="right-energy"
          digits={1}
          decimals={1}
          size={40}
          anchor="middle"
          period={24}
        />
      </Panel>

      <Panel box={rightPanels[1]} label="YIELD">
        <RingGauge
          cx={rightPanels[1].x + rightPanels[1].w / 2}
          cy={rightPanels[1].y + 160}
          r={78}
          seed="right-ring"
        />
      </Panel>

      <Panel box={rightPanels[2]} label="STATUS">
        <StatBlock
          box={pad(rightPanels[2])}
          seed="right-stats"
          entries={["WIND", "SOLAR", "HYDRO", "STORE"]}
        />
      </Panel>

      {/* --- bottom band -------------------------------------------------- */}
      <Panel box={box(70, 1440, 480, 180)} label="ENERGY" corners={false}>
        <BarRows box={pad(box(70, 1440, 480, 180))} seed="bottom-left" rows={4} speed={1.3} />
      </Panel>

      <Panel box={box(620, 1440, 1340, 300)} label="DISTRIBUTION">
        <HeatGrid box={pad(box(620, 1440, 1340, 170), 30, 18)} seed="dist" cols={26} rows={3} />
        <Battery box={box(700, 1620, 900, 90)} segments={9} />
        <Ticker
          x={1720}
          y={1690}
          seed="battery-n"
          digits={3}
          size={52}
          period={30}
        />
        <Label x={1880} y={1690} size={13} tracking={2} color={theme.mid}>
          MW/h
        </Label>
      </Panel>

      <Panel box={box(2040, 1230, 900, 200)} label="TRANSMISSION" corners={false}>
        <TickStrip box={box(2060, 1270, 860, 40)} count={48} seed="trans-ticks" />
        <DualTrace box={pad(box(2040, 1290, 900, 140))} seed="trans-trace" />
      </Panel>

      {/* Gears in the lower-right corner, mostly cropped by the vignette. */}
      <Gear cx={2760} cy={1690} r={210} teeth={18} rpm={2.4} opacity={0.35} />
      <Gear cx={2450} cy={1830} r={130} teeth={13} rpm={-3.6} opacity={0.28} />

      {/* Corner slates. */}
      <Label x={70} y={1700} size={12} tracking={4} opacity={0.65}>
        SECTOR 07 / RENEWABLE GRID
      </Label>
      <Ticker x={70} y={1730} seed="corner-a" digits={8} size={12} period={6} color={theme.mid} />
      <Label x={2940} y={1860} size={12} tracking={4} opacity={0.6} anchor="end">
        SYS NOMINAL
      </Label>
      </g>
    </svg>
  );
};

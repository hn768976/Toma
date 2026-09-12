import React from "react";
import { HudStage } from "./HudStage";
import { GridLayer } from "./layers/GridLayer";
import { HudFrame } from "./layers/HudFrame";
import { Reticle, VIOLET_RINGS } from "./layers/Reticle";
import { VIOLET_THEME } from "./theme";
import type { HudProps } from "./HudBlue";
import { BarChart, BarRows, LineMonitor } from "./widgets/Charts";
import { CodeBlock } from "./widgets/Code";
import { DonutReadout, LevelGauges, MiniDials, RingGaugeGrid } from "./widgets/Gauges";
import { ChannelHarness, Readouts } from "./widgets/Lists";
import {
  AccentArc,
  BarcodeStrip,
  Caption,
  DotMatrixBlock,
  NodeGraph,
  Panel,
  RuleBars,
  ScrambleDigits,
  TickerValue,
} from "./widgets/Texture";

// Layout B -- same design language, rebalanced composition. The reticle
// drops out of centre into the left third, the right two-fifths become a
// boxed vertical stack of modules, the square lattice is replaced by a
// hex one, and every chart is regrouped into a single band along the
// bottom rather than scattered around the edges.
export const HudViolet: React.FC<HudProps> = ({ resolutionScale }) => {
  const theme = VIOLET_THEME;

  return (
    <HudStage
      theme={theme}
      scale={resolutionScale}
      glowX={34}
      glowY={46}
      parallax={24}
      seed="violet"
      mapWindow={{ x: 400, y: 178, width: 1360, height: 620, pitch: 12 }}
    >
      <GridLayer theme={theme} variant="hex" cell={58} />
      <HudFrame theme={theme} outer={30} inner={74} shoulder={420} step={52} />

      {/* Off-centre reticle, larger than the blue cut to carry the
          left-weighted composition. */}
      <Reticle
        theme={theme}
        cx={690}
        cy={540}
        size={290}
        rings={VIOLET_RINGS}
        id="violet-ret"
      />

      {/* ---- top band ---- */}
      <Caption theme={theme} x={70} y={110} text="SECTOR SCAN" dim />
      <ScrambleDigits theme={theme} x={70} y={152} groups={[3, 2, 2]} fontSize={29} rows={1} seed="vdg" />
      <DotMatrixBlock theme={theme} x={486} y={104} cols={38} rows={3} cell={6} gap={4} seed="vt1" />
      <BarRows theme={theme} x={930} y={104} width={196} rows={4} seed="vt2" />
      <RingGaugeGrid theme={theme} x={1232} y={132} cols={4} rows={1} radius={20} gap={54} seed="vt3" />
      <DotMatrixBlock theme={theme} x={1560} y={104} cols={28} rows={3} cell={6} gap={4} seed="vt4" />

      {/* ---- left rail, beside the reticle ---- */}
      <Caption theme={theme} x={70} y={244} text="CHANNEL BUS" dim />
      <ChannelHarness theme={theme} x={70} y={272} rows={15} rowHeight={17} labelWidth={84} seed="vlh" />
      <LevelGauges theme={theme} x={94} y={572} count={3} radius={24} spacing={66} seed="vlg" />

      {/* ---- right stack: three boxed modules ---- */}
      <Panel theme={theme} x={1206} y={208} width={652} height={172} title="TRACE MONITOR" />
      <LineMonitor theme={theme} x={1232} y={252} width={600} height={112} series={3} seed="vlm" />

      <Panel theme={theme} x={1206} y={400} width={652} height={252} title="SOURCE STREAM" />
      <CodeBlock theme={theme} x={1230} y={448} lines={13} lineHeight={14} fontSize={10} width={332} seed="vcb" />
      <ChannelHarness theme={theme} x={1600} y={452} rows={12} rowHeight={15} labelWidth={80} seed="vrh" />

      <Panel theme={theme} x={1206} y={672} width={652} height={158} title="REGISTERS" />
      <Readouts theme={theme} x={1230} y={718} rows={5} width={278} rowHeight={20} seed="vro" />
      <MiniDials theme={theme} x={1648} y={752} count={2} radius={22} gap={58} seed="vmd" />
      <AccentArc theme={theme} x={1800} y={752} radius={32} turns={1} />

      {/* ---- bottom band: every chart grouped on one line ---- */}
      <MiniDials theme={theme} x={92} y={890} count={2} radius={20} gap={52} seed="vbd" />
      <NodeGraph theme={theme} x={70} y={936} width={168} height={58} nodes={8} seed="vng" />
      <DonutReadout theme={theme} x={342} y={922} radius={42} thickness={14} target={100} secondary={92} seed="vdn" />
      <BarcodeStrip theme={theme} x={508} y={940} width={286} height={20} seed="vb1" />
      <RuleBars theme={theme} x={508} y={972} width={286} rows={2} rowHeight={9} seed="vr1" />
      <BarChart theme={theme} x={854} y={876} width={292} height={98} bars={12} seed="vbc1" />
      <BarcodeStrip theme={theme} x={1214} y={940} width={286} height={20} seed="vb2" />
      <RuleBars theme={theme} x={1214} y={972} width={286} rows={2} rowHeight={9} seed="vr2" />
      <BarChart theme={theme} x={1566} y={876} width={250} height={98} bars={10} seed="vbc2" />

      {/* ---- corner readouts ---- */}
      <TickerValue theme={theme} x={478} y={64} label="SEQ" digits={6} cycles={3} />
      <TickerValue theme={theme} x={1852} y={64} label="REF" digits={5} cycles={2} anchor="end" />
      <Caption theme={theme} x={690} y={870} text="LATTICE / VIOLET BAND" size={12} anchor="middle" dim />
    </HudStage>
  );
};

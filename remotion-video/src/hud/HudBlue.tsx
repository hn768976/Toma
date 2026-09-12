import React from "react";
import { z } from "zod";
import { HudStage } from "./HudStage";
import { GridLayer } from "./layers/GridLayer";
import { HudFrame } from "./layers/HudFrame";
import { REFERENCE_RINGS, Reticle } from "./layers/Reticle";
import { BLUE_THEME } from "./theme";
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
  RuleBars,
  ScrambleDigits,
  TickerValue,
} from "./widgets/Texture";

export const hudSchema = z.object({
  // 1 = 1080p, 2 = 4K. Must match the width/height the Composition is
  // registered with in Root.tsx -- see HudStage for why this is a number
  // rather than a CSS transform.
  resolutionScale: z.number().positive(),
});

export type HudProps = z.infer<typeof hudSchema>;

export const hudDefaults: HudProps = { resolutionScale: 1 };

// Layout A -- follows the reference framing: a centred reticle over a
// dot-matrix world map, telemetry rails down both edges, chart cluster
// along the bottom, counters and matrix blocks across the top.
export const HudBlue: React.FC<HudProps> = ({ resolutionScale }) => {
  const theme = BLUE_THEME;

  return (
    <HudStage
      theme={theme}
      scale={resolutionScale}
      glowX={46}
      glowY={38}
      seed="blue"
      mapWindow={{ x: 300, y: 205, width: 1360, height: 640, pitch: 11 }}
    >
      <GridLayer theme={theme} variant="square" cell={120} majorEvery={4} />
      <HudFrame theme={theme} />

      {/* Centre reticle over the map */}
      <Reticle theme={theme} cx={960} cy={520} size={250} rings={REFERENCE_RINGS} id="blue-ret" />

      {/* ---- top band ---- */}
      <LineMonitor theme={theme} x={56} y={92} width={214} height={74} series={3} seed="tl" />
      <DotMatrixBlock theme={theme} x={300} y={92} cols={30} rows={3} cell={6} gap={4} seed="tm1" />
      <BarRows theme={theme} x={632} y={92} width={196} rows={4} seed="tr1" />
      <DotMatrixBlock theme={theme} x={880} y={92} cols={36} rows={3} cell={6} gap={4} seed="tm2" />
      <RingGaugeGrid theme={theme} x={1616} y={116} cols={3} rows={2} radius={21} gap={56} seed="tg" />
      <ScrambleDigits theme={theme} x={256} y={212} groups={[3, 2, 1]} fontSize={26} rows={2} seed="dg" />

      {/* ---- left rail ---- */}
      <ChannelHarness theme={theme} x={56} y={286} rows={16} rowHeight={16} labelWidth={96} seed="lh" />
      <Caption theme={theme} x={56} y={264} text="CHANNEL BUS" dim />
      <LevelGauges theme={theme} x={84} y={604} count={3} radius={22} spacing={62} seed="lg" />
      <CodeBlock theme={theme} x={296} y={584} lines={18} lineHeight={13} fontSize={10} width={360} seed="lc" />

      {/* ---- right rail ---- */}
      <CodeBlock theme={theme} x={1430} y={244} lines={20} lineHeight={13} fontSize={10} width={400} scrollCycles={2} seed="rc" />
      <AccentArc theme={theme} x={1392} y={588} radius={40} turns={-1} />
      <ChannelHarness theme={theme} x={1556} y={556} rows={12} rowHeight={15} labelWidth={90} seed="rh" />
      <Readouts theme={theme} x={1430} y={772} rows={4} width={178} rowHeight={19} seed="rr" />
      <BarChart theme={theme} x={1556} y={846} width={286} height={104} bars={12} seed="bc" />

      {/* ---- bottom band ---- */}
      <MiniDials theme={theme} x={88} y={876} count={2} radius={20} gap={52} seed="md" />
      <NodeGraph theme={theme} x={56} y={922} width={152} height={72} nodes={8} seed="ng" />
      <DonutReadout theme={theme} x={412} y={902} radius={44} thickness={15} target={100} secondary={87} seed="dn" />
      <BarcodeStrip theme={theme} x={528} y={934} width={296} height={20} seed="b1" />
      <RuleBars theme={theme} x={528} y={966} width={296} rows={3} rowHeight={10} seed="r1" />
      <BarcodeStrip theme={theme} x={888} y={934} width={256} height={20} seed="b2" />
      <RuleBars theme={theme} x={888} y={966} width={256} rows={3} rowHeight={10} seed="r2" />
      <RuleBars theme={theme} x={1188} y={958} width={228} rows={3} rowHeight={10} seed="r3" />

      {/* ---- corner readouts ---- */}
      <TickerValue theme={theme} x={300} y={56} label="SEQ" digits={6} cycles={3} />
      <TickerValue theme={theme} x={1620} y={56} label="REF" digits={5} cycles={2} anchor="start" />
      <Caption theme={theme} x={960} y={1044} text="GLOBAL DATA UPLINK / STANDBY" size={12} anchor="middle" dim />
    </HudStage>
  );
};

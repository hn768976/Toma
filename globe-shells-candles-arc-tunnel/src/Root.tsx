import React, { useMemo } from "react";
import { Composition } from "remotion";
import { z } from "zod";
import { GLStage, LookFactory } from "./gl/GLStage";
import { FPS, HEIGHT, LOOP, WIDTH } from "./lib/loop";
import { makeTunnel, tunnelSchema } from "./looks/tunnel";
import { arcSchema, makeArc } from "./looks/arc";
import { makeShells, shellsSchema } from "./looks/shells";
import { CandleChart, candleSchema } from "./looks/CandleChart";
import { globeSchema, makeGlobe } from "./looks/globe";

// ---------------------------------------------------------------------------
// One data row per version. To add a colourway, copy a row, give it a new id
// and change the colours; nothing else needs to change.
// ---------------------------------------------------------------------------
const TUNNEL_VERSIONS = [
  { id: "DotTunnel-Blue", props: { dotFar: "#3AA8FF", dotNear: "#8AD8FF", glow: "#5AB8FF", glowCore: "#DFF2FF", corners: "#020A2A", background: "#021650" } },
  { id: "DotTunnel-Violet", props: { dotFar: "#9A5AFF", dotNear: "#D0A8FF", glow: "#B07AFF", glowCore: "#F0E4FF", corners: "#0A0428", background: "#1A0850" } },
];
const GLOBE_VERSIONS = [
  { id: "ParticleGlobe-Blue", props: { land: "#7AC8F0", ocean: "#1A4A78", twinkle: "#5AF0D0", shell: "#8AD0FF", streak: "#C8ECFF", speckA: "#5AE8E8", speckB: "#E8F4FF", speckC: "#A8F0C8", glow: "#0A2A50", background: "#02060C" } },
];
const SHELLS_VERSIONS = [
  { id: "DotShells-BlueCoral", props: { base: "#2A5A9A", rim: "#8ACAFF", accentA: "#FF8A7A", accentB: "#FF6AA8", accentC: "#5AE8FF", background: "#03050C" } },
  { id: "DotShells-VioletGold", props: { base: "#4A3A9A", rim: "#B89AFF", accentA: "#FFC85A", accentB: "#FF9A3A", accentC: "#D8B8FF", background: "#05030E" } },
];
const CANDLE_VERSIONS = [
  { id: "CandleChart-Blue", props: { bgTop: "#030A1E", bgBottom: "#0A3A8A", candle: "#7AB8FF", candleHi: "#B8DCFF", band: "#2A6ADA", glint: "#C8E8FF" } },
  { id: "CandleChart-Emerald", props: { bgTop: "#021410", bgBottom: "#0A5A3E", candle: "#5AE8A8", candleHi: "#B8FFD8", band: "#1A9A6A", glint: "#D8FFE8" } },
];
const ARC_VERSIONS = [
  { id: "LightArc-Gold", props: { core: "#FFE8B0", line: "#D8A84A", edge: "#8A5A1A", warm: "#3A2008", background: "#000000" } },
];

// `loopCheck: true` extends a composition to 601 frames so frame 600 can be
// rendered and compared with frame 0.
const withLoop = <T extends z.ZodTypeAny>(schema: T) =>
  z.object({ look: schema, loopCheck: z.boolean().optional() });


const glComp = <P,>(make: (p: P) => LookFactory) => {
  const C: React.FC<{ look: P; loopCheck?: boolean }> = ({ look }) => {
    const key = JSON.stringify(look);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const factory = useMemo(() => make(look), [key]);
    return <GLStage factory={factory} />;
  };
  return C;
};

const TunnelComp = glComp(makeTunnel);
const ArcComp = glComp(makeArc);
const ShellsComp = glComp(makeShells);
const GlobeComp = glComp(makeGlobe);

const common = { fps: FPS, width: WIDTH, height: HEIGHT, durationInFrames: LOOP };
const meta = { calculateMetadata: ({ props }: { props: { loopCheck?: boolean } }) => ({ durationInFrames: props.loopCheck ? LOOP + 1 : LOOP }) };

export const RemotionRoot: React.FC = () => (
  <>
    {GLOBE_VERSIONS.map((v) => (
      <Composition key={v.id} id={v.id} component={GlobeComp} schema={withLoop(globeSchema)} defaultProps={{ look: v.props }} {...common} {...meta} />
    ))}
    {SHELLS_VERSIONS.map((v) => (
      <Composition key={v.id} id={v.id} component={ShellsComp} schema={withLoop(shellsSchema)} defaultProps={{ look: v.props }} {...common} {...meta} />
    ))}
    {CANDLE_VERSIONS.map((v) => (
      <Composition key={v.id} id={v.id} component={CandleChart} schema={withLoop(candleSchema)} defaultProps={{ look: v.props }} {...common} {...meta} />
    ))}
    {ARC_VERSIONS.map((v) => (
      <Composition key={v.id} id={v.id} component={ArcComp} schema={withLoop(arcSchema)} defaultProps={{ look: v.props }} {...common} {...meta} />
    ))}
    {TUNNEL_VERSIONS.map((v) => (
      <Composition key={v.id} id={v.id} component={TunnelComp} schema={withLoop(tunnelSchema)} defaultProps={{ look: v.props }} {...common} {...meta} />
    ))}
  </>
);

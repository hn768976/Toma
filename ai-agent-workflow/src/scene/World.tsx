import { useThree } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import React, { useLayoutEffect, useMemo } from "react";
import { CanvasTexture, Color, Fog, SRGBColorSpace } from "three";
import {
  COUNTERS,
  INPUT,
  INPUT_ICONS,
  NEXT_INPUT,
  OUTPUT,
  T,
  WORKFLOW,
} from "../layout";
import type { Palette } from "../theme";
import { CameraRig } from "./CameraRig";
import { FlowLines } from "./FlowLines";
import { AgentCard, Counter, FloorLabel, IconTile, OutputCard } from "./Nodes";
import { Specks } from "./Specks";

/** Screen-space gradient backdrop + distance fog in the backdrop colour. */
const Atmosphere: React.FC<{ pal: Palette }> = ({ pal }) => {
  const scene = useThree((s) => s.scene);
  const texture = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 960;
    c.height = 540;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(400, 230, 0, 400, 230, 640);
    g.addColorStop(0, pal.bgCenter);
    g.addColorStop(0.5, pal.bgMid);
    g.addColorStop(1, pal.bgEdge);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 960, 540);
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    return t;
  }, [pal]);
  useLayoutEffect(() => {
    scene.background = texture;
    scene.fog = new Fog(new Color(pal.bgMid), 38, 90);
  }, [scene, texture, pal]);
  return null;
};

export const World: React.FC<{ pal: Palette }> = ({ pal }) => {
  const accent = (a: "primary" | "secondary") => (a === "primary" ? pal.primary : pal.secondary);
  return (
    <>
      <Atmosphere pal={pal} />
      <CameraRig />
      <FlowLines pal={pal} />
      <Specks pal={pal} />

      {/* Input column */}
      <FloorLabel pal={pal} u={INPUT.label[0]} v={INPUT.label[1]} text="INPUT DATA" caption="SOURCES · STREAMS · FILES" start={T.inputsIn} />
      {INPUT.vs.map((v, i) => (
        <IconTile
          key={i}
          pal={pal}
          u={INPUT.u - INPUT.size / 2}
          v={v}
          w={INPUT.size}
          h={INPUT.size}
          icon={INPUT_ICONS[i]}
          accent={pal.primary}
          appear={T.inputsIn + i * 2}
        />
      ))}

      {/* AI agent */}
      <FloorLabel pal={pal} u={-4.6} v={-7.4} text="AI AGENT" caption="REASONING · PLANNING · MEMORY" start={T.agentLabel} />
      <AgentCard pal={pal} />

      {/* Workflow */}
      <FloorLabel pal={pal} u={WORKFLOW.label[0]} v={WORKFLOW.label[1]} text="WORKFLOW" caption="ORCHESTRATE · VERIFY · AUTOMATE" start={T.workflowLabel} />
      {WORKFLOW.tiles.map((tile, i) => (
        <IconTile
          key={tile.icon}
          pal={pal}
          u={tile.u}
          v={tile.v}
          w={tile.w}
          h={tile.h}
          icon={tile.icon}
          accent={accent(tile.accent)}
          appear={T.workflowTiles[i]}
          z={0.6}
          lines={tile.icon === "shield"}
        />
      ))}

      {/* Output */}
      <FloorLabel pal={pal} u={OUTPUT.label[0]} v={OUTPUT.label[1]} text="OUTPUT" caption="INSIGHTS · ACTIONS · ALERTS" start={T.outputLabel} />
      {OUTPUT.rows.map((r, i) => (
        <OutputCard
          key={i}
          pal={pal}
          u={OUTPUT.u}
          v={r.v}
          w={OUTPUT.w}
          h={OUTPUT.h}
          icon={r.icon}
          kind={r.kind}
          appear={T.outputCards + i * 14}
        />
      ))}

      {/* Next stage begins */}
      <FloorLabel pal={pal} u={NEXT_INPUT.label[0]} v={NEXT_INPUT.label[1]} text="INPUT DATA" caption="NEXT AGENT" start={T.nextLabel} />
      {NEXT_INPUT.vs.map((v, i) => (
        <IconTile
          key={i}
          pal={pal}
          u={NEXT_INPUT.u - NEXT_INPUT.size / 2}
          v={v}
          w={NEXT_INPUT.size}
          h={NEXT_INPUT.size}
          icon={NEXT_INPUT.icons[i]}
          accent={pal.primary}
          appear={T.nextIcons + i * 8}
        />
      ))}

      {COUNTERS.map((c, i) => (
        <Counter
          key={c.seed}
          pal={pal}
          u={c.u}
          v={c.v}
          seed={c.seed}
          dot={c.dot ? accent(c.dot) : undefined}
          start={8 + i * 30}
        />
      ))}

      <EffectComposer multisampling={0}>
        <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.36} luminanceSmoothing={0.35} radius={0.72} />
      </EffectComposer>
    </>
  );
};

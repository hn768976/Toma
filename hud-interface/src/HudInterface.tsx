import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Center } from "./hud/Center";
import { SidePanels } from "./hud/SidePanels";
import { TopBar } from "./hud/TopBar";
import { loadHudFont } from "./lib/font";
import { paletteFor, Variant } from "./palette";
import { SmokeLayer } from "./smoke/SmokeLayer";

loadHudFont();

export type HudInterfaceProps = { variant: Variant };

// All HUD vector art is authored in a 1920x1080 design space and scaled by the
// SVG viewBox, so it stays razor sharp at the 3840x2160 composition size.
export const HudInterface: React.FC<HudInterfaceProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const p = paletteFor(variant);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <SmokeLayer palette={p} />
      <svg
        viewBox="0 0 1920 1080"
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0 }}
      >
        <defs>
          <pattern id="dots" width={18} height={18} patternUnits="userSpaceOnUse">
            <rect x={8.5} y={8.5} width={1.1} height={1.1} fill={p.grid} />
          </pattern>
        </defs>
        <rect width={1920} height={1080} fill="url(#dots)" opacity={0.22} />
        <SidePanels frame={frame} p={p} />
        <TopBar frame={frame} p={p} />
        <Center frame={frame} p={p} />
      </svg>
    </AbsoluteFill>
  );
};

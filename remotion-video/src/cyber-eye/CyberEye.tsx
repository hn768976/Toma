import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { PALETTES, PALETTE_IDS } from "./palettes";
import { EyeCanvas } from "./EyeCanvas";
import { HudOverlay } from "./HudOverlay";

export const cyberEyeSchema = z.object({
  palette: z.enum(PALETTE_IDS as [string, ...string[]]),
  particleCount: z.number().int().min(10000).max(400000),
  wireframe: z.boolean(),
  antialias: z.boolean(),
  hudOverlay: z.boolean(),
});

export type CyberEyeProps = z.infer<typeof cyberEyeSchema>;

export const cyberEyeDefaults: CyberEyeProps = {
  palette: "navy",
  particleCount: 130000,
  wireframe: true,
  antialias: true,
  hudOverlay: true,
};

export const CyberEye: React.FC<CyberEyeProps> = ({
  palette: paletteId,
  particleCount,
  wireframe,
  antialias,
  hudOverlay,
}) => {
  const palette = PALETTES[paletteId as keyof typeof PALETTES];
  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <EyeCanvas
        key={`${palette.id}-${particleCount}-${wireframe}-${antialias}`}
        palette={palette}
        particleCount={particleCount}
        wireframe={wireframe}
        antialias={antialias}
      />
      {/* vignette / atmosphere: darkens the edges on dark palettes, hazes them on the light one */}
      <AbsoluteFill
        style={{
          pointerEvents: "none",
          background: `radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) ${palette.light ? 30 : 42}%, ${palette.vignette} 100%)`,
        }}
      />
      {palette.light ? (
        <AbsoluteFill
          style={{
            pointerEvents: "none",
            background:
              "linear-gradient(115deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 60%, rgba(255,255,255,0.14) 100%)",
          }}
        />
      ) : null}
      {hudOverlay ? <HudOverlay palette={palette} /> : null}
    </AbsoluteFill>
  );
};

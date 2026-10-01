import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { PALETTES } from "./constants";
import { DataSphere } from "./DataSphere";
import { Hud } from "./Hud";

export const dataSphereHudSchema = z.object({
  palette: z.enum(["mono", "ember"]),
});

export type DataSphereHudProps = z.infer<typeof dataSphereHudSchema>;

// Futuristic HUD: a rotating wireframe "data sphere" that unravels into a
// tangle of strands and settles back, framed by rulers, crosses, a live
// bar chart and scrolling readouts. Resolution-independent: register it
// at 1920x1080 or 3840x2160 and the frame is identical, just sharper.
export const DataSphereHud: React.FC<DataSphereHudProps> = ({ palette: paletteName }) => {
  const palette = PALETTES[paletteName];
  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <Hud palette={palette} />
      <DataSphere palette={palette} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at 45% 50%, transparent 55%, ${palette.vignette} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

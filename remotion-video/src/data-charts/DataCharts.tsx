import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { z } from "zod";
import { BASE_HEIGHT, BASE_WIDTH } from "./constants";
import { THEMES } from "./themes";
import { Board } from "./Board";
import { Atmosphere } from "./Atmosphere";

export const dataChartsSchema = z.object({
  // "dark" matches the reference footage; "light" is the airy colorway.
  theme: z.enum(["dark", "light"]),
});

export type DataChartsProps = z.infer<typeof dataChartsSchema>;

export const dataChartsDefaults: DataChartsProps = { theme: "dark" };

// "Digital data charts and graphs over a blue grid": a tilted dashboard
// of glass tiles with live charts, slow camera drift, depth of field and
// atmosphere. The scene is authored at 1920x1080 and scaled to whatever
// size the Composition is registered with (2x for the 4K variants), so
// every vector stays crisp at any output resolution.
export const DataCharts: React.FC<DataChartsProps> = ({ theme: themeName }) => {
  const { width } = useVideoConfig();
  const theme = THEMES[themeName];
  const scale = width / BASE_WIDTH;

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${theme.backgroundTop} 0%, ${theme.backgroundBottom} 100%)`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: BASE_WIDTH,
          height: BASE_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <Board theme={theme} />
        <Atmosphere theme={theme} />
      </div>
    </AbsoluteFill>
  );
};

import { AbsoluteFill } from "remotion";
import { Background } from "./components/Background";
import { ChartLayer } from "./components/ChartLayer";
import { FloatingBars } from "./components/FloatingBars";
import { Grain } from "./components/Grain";
import { Vignette } from "./components/Vignette";
import { WorldMap } from "./components/WorldMap";
import type { Palette } from "./palettes";

/**
 * Back to front: background, map, charts, bokeh bars, vignette, grain.
 * Flat 2D throughout — there is no camera, and the frame never moves.
 */
export const MarketField: React.FC<{ palette: Palette }> = ({ palette }) => (
  <AbsoluteFill style={{ backgroundColor: "#050208" }}>
    <Background />
    <WorldMap />
    <ChartLayer palette={palette} />
    <FloatingBars palette={palette} />
    <Vignette />
    <Grain />
  </AbsoluteFill>
);

import React from "react";
import { Composition } from "remotion";
import { Stage } from "./engine/Stage";
import { pipesFactory, PipeVersion } from "./looks/pipes";
import { glyphFactory, GlyphVersion } from "./looks/glyphs";
import { getAtlas, loadFont } from "./engine/atlas";
import {
  BINARY_CUBES, BUNDLE_COPPER, BUNDLE_STEEL, FLOOR_GREEN_TEAL, FLOOR_MAGENTA_BLUE,
  GLYPH_WAVE_BLUE, STACKED_STEEL,
} from "./versions";
import { FPS, LOOP_FRAMES } from "./engine/rng";

// REMOTION_LOOP_CHECK=1 makes every composition 601 frames (loop check: frame 600 == frame 0).
const DURATION = process.env.REMOTION_LOOP_CHECK === "1" ? LOOP_FRAMES + 1 : LOOP_FRAMES;

const glyphReady = () => loadFont().then(() => getAtlas());

const Pipes: React.FC<{ v: PipeVersion }> = ({ v }) => <Stage factory={pipesFactory} props={v} />;
const Glyphs: React.FC<{ v: GlyphVersion }> = ({ v }) => <Stage factory={glyphFactory} props={v} ready={glyphReady} />;

const common = { fps: FPS, durationInFrames: DURATION, width: 3840, height: 2160 } as const;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="SteelPipes-Stacked" component={Pipes} defaultProps={{ v: STACKED_STEEL }} {...common} />
    <Composition id="SteelPipes-Bundle" component={Pipes} defaultProps={{ v: BUNDLE_STEEL }} {...common} />
    <Composition id="CopperPipes-Bundle" component={Pipes} defaultProps={{ v: BUNDLE_COPPER }} {...common} />
    <Composition id="DataTileFloor-GreenTeal" component={Glyphs} defaultProps={{ v: FLOOR_GREEN_TEAL }} {...common} />
    <Composition id="DataTileFloor-MagentaBlue" component={Glyphs} defaultProps={{ v: FLOOR_MAGENTA_BLUE }} {...common} />
    <Composition id="GlyphWave-Blue" component={Glyphs} defaultProps={{ v: GLYPH_WAVE_BLUE }} {...common} />
    <Composition id="BinaryCubes-CyanViolet" component={Glyphs} defaultProps={{ v: BINARY_CUBES }} {...common} />
  </>
);

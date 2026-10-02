import "./lib/fonts";
import "./lib/preload-images";
import React from "react";
import { Composition, getInputProps } from "remotion";
import { FPS, LOOP } from "./lib/loop";
import { ChipAlert } from "./looks/ChipAlert";
import { BreachHUD } from "./looks/BreachHUD";
import { MapTexture } from "./looks/MapTexture";
import { MAP_H, MAP_W } from "./looks/hud-parts";
import { GlitchWord } from "./looks/GlitchWord";
import { CHIP_AMBER, CHIP_RED, GLITCH_RED, HUD_BLUE, HUD_GREEN } from "./looks/palettes";

// Pass --props='{"loopCheck":true}' to make every composition 601 frames long,
// so frame 600 can be rendered and compared with frame 0.
const { loopCheck } = getInputProps() as { loopCheck?: boolean };
const DURATION = loopCheck ? LOOP + 1 : LOOP;

const common = { durationInFrames: DURATION, fps: FPS, width: 3840, height: 2160 } as const;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="ChipAlert-Red" component={ChipAlert} {...common} defaultProps={{ palette: CHIP_RED }} />
    <Composition id="ChipAlert-Amber" component={ChipAlert} {...common} defaultProps={{ palette: CHIP_AMBER }} />
    <Composition id="GlitchWord-Warning" component={GlitchWord} {...common} defaultProps={{ text: "WARNING", palette: GLITCH_RED }} />
    <Composition id="GlitchWord-AccessDenied" component={GlitchWord} {...common} defaultProps={{ text: "ACCESS DENIED", palette: GLITCH_RED }} />
    <Composition id="BreachHUD-Blue" component={BreachHUD} {...common} defaultProps={{ palette: HUD_BLUE }} />
    <Composition id="BreachHUD-Green" component={BreachHUD} {...common} defaultProps={{ palette: HUD_GREEN }} />
    {/* Build-time asset for the HUD maps (scripts/build-map-texture.sh), not a deliverable */}
    <Composition id="Asset-WorldMap" component={MapTexture} durationInFrames={1} fps={FPS} width={3000} height={Math.round((3000 * MAP_H) / MAP_W)} />
  </>
);

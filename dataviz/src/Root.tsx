import React from "react";
import { Composition } from "remotion";
import "./lib/fonts";
import { GrowthLineNavy } from "./looks/GrowthLineNavy";
import { GrowthLineBlack } from "./looks/GrowthLineBlack";
import { BarChart, CYAN_THEME, AMBER_THEME } from "./looks/BarChart";
import { DarkDashboard, TEAL_THEME, BLUE_THEME } from "./looks/DarkDashboard";
import { LightDashboard, WARM_THEME, SLATE_THEME } from "./looks/LightDashboard";
import { FinancialMontage } from "./looks/FinancialMontage";

import { LOOP_FRAMES, ONESHOT_FRAMES } from "./lib/loop";

export const FPS = 30;
export const W = 3840;
export const H = 2160;
/** Looks 2-5 loop over 20s. */
export const LOOP = LOOP_FRAMES;
/** Look 1 draws and holds. It is NOT a loop. */
export const ONESHOT = ONESHOT_FRAMES;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="GrowthLine-Navy" component={GrowthLineNavy} durationInFrames={ONESHOT} fps={FPS} width={W} height={H} />
    <Composition id="GrowthLine-Black" component={GrowthLineBlack} durationInFrames={ONESHOT} fps={FPS} width={W} height={H} />
    <Composition id="BarChart-Cyan" component={BarChart} durationInFrames={LOOP} fps={FPS} width={W} height={H} defaultProps={{ theme: CYAN_THEME }} />
    <Composition id="BarChart-Amber" component={BarChart} durationInFrames={LOOP} fps={FPS} width={W} height={H} defaultProps={{ theme: AMBER_THEME }} />
    <Composition id="DarkDashboard-Teal" component={DarkDashboard} durationInFrames={LOOP} fps={FPS} width={W} height={H} defaultProps={{ theme: TEAL_THEME }} />
    <Composition id="DarkDashboard-Blue" component={DarkDashboard} durationInFrames={LOOP} fps={FPS} width={W} height={H} defaultProps={{ theme: BLUE_THEME }} />
    <Composition id="LightDashboard-Warm" component={LightDashboard} durationInFrames={LOOP} fps={FPS} width={W} height={H} defaultProps={{ theme: WARM_THEME }} />
    <Composition id="LightDashboard-Slate" component={LightDashboard} durationInFrames={LOOP} fps={FPS} width={W} height={H} defaultProps={{ theme: SLATE_THEME }} />
    <Composition id="FinancialMontage-Blue" component={FinancialMontage} durationInFrames={LOOP} fps={FPS} width={W} height={H} />
  </>
);

import { Composition } from "remotion";
import { AndroidTrader } from "./android/AndroidTrader";
import { HeadCheck } from "./android/HeadCheck";
import { CHART_FRAMES, GrowthChart } from "./chart/GrowthChart";
import { RackScene } from "./racks/RackScene";

// REMOTION_LOOP_CHECK=1 makes the loops 601 frames long so frame 600 can
// be rendered and compared with frame 0.
const LOOP = process.env.REMOTION_LOOP_CHECK === "1" ? 601 : 600;
const W = 3840;
const H = 2160;

export const RemotionRoot = () => (
  <>
    <Composition id="AndroidTraderHUD-Left" component={AndroidTrader} defaultProps={{ side: "left" as const }} durationInFrames={LOOP} fps={30} width={W} height={H} />
    <Composition id="AndroidTraderHUD-Right" component={AndroidTrader} defaultProps={{ side: "right" as const }} durationInFrames={LOOP} fps={30} width={W} height={H} />
    <Composition id="GrowthChartHUD-Story" component={GrowthChart} durationInFrames={CHART_FRAMES} fps={30} width={W} height={H} />
    <Composition id="ServerRack-FrontScroll" component={RackScene} defaultProps={{ version: "front" as const }} durationInFrames={LOOP} fps={30} width={W} height={H} />
    <Composition id="ServerRack-DiagonalGlide" component={RackScene} defaultProps={{ version: "diagonal" as const }} durationInFrames={LOOP} fps={30} width={W} height={H} />
    <Composition id="ServerRack-LowAngle" component={RackScene} defaultProps={{ version: "low" as const }} durationInFrames={LOOP} fps={30} width={W} height={H} />
    <Composition id="HeadCheck" component={HeadCheck} durationInFrames={1} fps={30} width={W} height={H} />
  </>
);

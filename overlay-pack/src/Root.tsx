import { Composition } from "remotion";
import { BLACK, FPS, GREEN, HEIGHT, WIDTH } from "./config";
import { FloatingHearts } from "./hearts/FloatingHearts";
import { SpinnerSegments } from "./spinner/SpinnerSegments";
import { SpinnerDots } from "./spinner/SpinnerDots";
import { WaveformBars } from "./waveform/WaveformBars";
import { WaveformLine } from "./waveform/WaveformLine";
import { IdeaBulb } from "./bulb/IdeaBulb";
import { FallingDaisies } from "./daisies/FallingDaisies";

const base = { fps: FPS, width: WIDTH, height: HEIGHT };

// `extraFrames` (default 0) lengthens a composition, used to check that frame
// N renders identically to frame 0 (seamless loop).
type LoopProps = { extraFrames?: number };
const withExtra =
  (frames: number) =>
  ({ props }: { props: LoopProps }) => ({
    durationInFrames: frames + (props.extraFrames ?? 0),
  });
const s20 = 20 * FPS;
const s10 = 10 * FPS;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="FloatingHearts-Black" component={FloatingHearts} durationInFrames={s20} calculateMetadata={withExtra(s20)} defaultProps={{ background: BLACK, extraFrames: 0 }} {...base} />
    <Composition id="FloatingHearts-Green" component={FloatingHearts} durationInFrames={s20} calculateMetadata={withExtra(s20)} defaultProps={{ background: GREEN, extraFrames: 0 }} {...base} />
    <Composition id="Spinner-Segments" component={SpinnerSegments} durationInFrames={s10} calculateMetadata={withExtra(s10)} defaultProps={{ extraFrames: 0 }} {...base} />
    <Composition id="Spinner-Dots" component={SpinnerDots} durationInFrames={s10} calculateMetadata={withExtra(s10)} defaultProps={{ extraFrames: 0 }} {...base} />
    <Composition id="Waveform-Bars" component={WaveformBars} durationInFrames={s20} calculateMetadata={withExtra(s20)} defaultProps={{ extraFrames: 0 }} {...base} />
    <Composition id="Waveform-Line" component={WaveformLine} durationInFrames={s20} calculateMetadata={withExtra(s20)} defaultProps={{ extraFrames: 0 }} {...base} />
    <Composition id="IdeaBulb-Chalk" component={IdeaBulb} durationInFrames={s10} calculateMetadata={withExtra(s10)} defaultProps={{ extraFrames: 0 }} {...base} />
    <Composition id="FallingDaisies" component={FallingDaisies} durationInFrames={s20} calculateMetadata={withExtra(s20)} defaultProps={{ extraFrames: 0 }} {...base} />
  </>
);

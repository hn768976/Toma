import "./index.css";
import { Composition } from "remotion";
import { SilkFlow, silkFlowSchema, SilkFlowProps } from "./SilkFlow";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

// Version 1 — matches the reference: cobalt / cyan silk with white bloom
// and pastel-prismatic fringes.
const v1Props: SilkFlowProps = {
  deep: [0.02, 0.13, 0.42],
  mid: [0.2, 0.5, 0.82],
  light: [0.56, 0.83, 0.99],
  highlight: [1.0, 1.0, 1.0],
  rim: [1.0, 0.78, 0.8],
  fringe: 1.0,
  spectrumShift: 0,
  renderScale: 1,
};

// Version 2 — alternative colour palette: "Sunset Silk" (plum / magenta /
// coral with a warm-gold bloom). Same motion and structure as V1.
const v2Props: SilkFlowProps = {
  deep: [0.42, 0.08, 0.28],
  mid: [0.82, 0.18, 0.42],
  light: [1.0, 0.6, 0.4],
  highlight: [1.0, 0.95, 0.84],
  rim: [1.0, 0.82, 0.4],
  fringe: 1.3,
  spectrumShift: 0.35,
  renderScale: 1,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SilkFlow-V1-Reference"
        component={SilkFlow}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={silkFlowSchema}
        defaultProps={v1Props}
      />
      <Composition
        id="SilkFlow-V2-Sunset"
        component={SilkFlow}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={silkFlowSchema}
        defaultProps={v2Props}
      />
    </>
  );
};

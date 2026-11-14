import { useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { ShaderCanvas } from "./gl/ShaderCanvas";
import { Keys, sampleKeys } from "./keyframes";
import { silkFragmentShader } from "./silkShader";

// Bloom envelope and path, keyed to the reference's measured per-quadrant
// brightness: a modest highlight upper-right that drifts down the right
// side, swells into a blown-out white wash at ~12–14 s, rises to the upper
// left and recedes back to its starting state at 20 s (seamless loop).
const BLOOM: Keys = [
  [0, 0.52], [2.5, 0.12], [4.5, 0.04], [6.5, 0.16], [8, 0.42], [10, 0.86],
  [12.5, 1.1], [14, 1.1], [16, 0.98], [18, 0.72], [20, 0.52],
];
const BLOOM_X: Keys = [
  [0, 0.62], [4, 0.7], [7, 0.68], [9, 0.58], [11, 0.45], [13, 0.4],
  [15, 0.32], [17, 0.42], [20, 0.62],
];
const BLOOM_Y: Keys = [
  [0, 0.25], [4, 0.1], [7, 0.0], [9, -0.15], [11, -0.22], [13, 0.0],
  [15, 0.25], [17, 0.35], [20, 0.25],
];

const rgb = z.tuple([z.number(), z.number(), z.number()]);

export const silkFlowSchema = z.object({
  deep: rgb,
  mid: rgb,
  light: rgb,
  highlight: rgb,
  rim: rgb,
  fringe: z.number().min(0).max(2),
  spectrumShift: z.number(),
  renderScale: z.number().min(0.1).max(2),
});

export type SilkFlowProps = z.infer<typeof silkFlowSchema>;

export const SilkFlow: React.FC<SilkFlowProps> = ({
  deep,
  mid,
  light,
  highlight,
  rim,
  fringe,
  spectrumShift,
  renderScale,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();
  const duration = durationInFrames / fps;
  const t = frame / fps;
  return (
    <ShaderCanvas
      fragmentShader={silkFragmentShader}
      renderScale={renderScale}
      uniforms={{
        uDuration: duration,
        uDeep: deep,
        uMid: mid,
        uLight: light,
        uHighlight: highlight,
        uRim: rim,
        uFringe: fringe,
        uSpectrumShift: spectrumShift,
        uBloom: sampleKeys(BLOOM, t),
        uBloomPos: [sampleKeys(BLOOM_X, t), sampleKeys(BLOOM_Y, t)],
      }}
    />
  );
};

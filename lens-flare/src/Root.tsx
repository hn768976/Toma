import React from "react";
import { AbsoluteFill, Composition } from "remotion";
import { LensFlare, type LensFlareProps } from "./LensFlare";
import { COOL, WARM } from "./palettes";

const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION = 450; // 15s

const Flare: React.FC<LensFlareProps> = (props) => (
  // Pure black ground. No vignette anywhere in this piece -- a vignette in an
  // overlay darkens the edges of the shot it is laid over.
  <AbsoluteFill style={{ backgroundColor: "#000000" }}>
    <LensFlare {...props} />
  </AbsoluteFill>
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="V1-LensFlareWarm"
        component={Flare}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          palette: WARM,
          grain: 0.01,
          // ~2.5px at 3840x2160. Expressed as a fraction of frame height so it
          // scales with the render rather than shifting between preview and 4K.
          chroma: 2.5 / 2160,
        }}
      />
      <Composition
        id="V2-LensFlareCool"
        component={Flare}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{
          palette: COOL,
          grain: 0.01,
          chroma: 2.5 / 2160,
        }}
      />
    </>
  );
};

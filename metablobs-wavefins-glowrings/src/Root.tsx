import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { FPS, HEIGHT, LOOP_FRAMES, WIDTH } from "./common/constants";
import { GlowRings } from "./glowrings/GlowRings";
import { MetaBlobs } from "./metablobs/MetaBlobs";
import { WaveFins } from "./wavefins/WaveFins";
import { GLOW_RINGS, META_BLOBS, WAVE_FINS } from "./versions";

// `loopCheck: true` (passed with --props) makes a composition 601 frames long so
// frame 600 can be rendered and compared against frame 0.
type LoopCheck = { loopCheck?: boolean };
const loopMetadata = <T extends LoopCheck>(): CalculateMetadataFunction<T> => ({ props }) => ({
  durationInFrames: props.loopCheck ? LOOP_FRAMES + 1 : LOOP_FRAMES,
});

const common = {
  fps: FPS,
  width: WIDTH,
  height: HEIGHT,
  durationInFrames: LOOP_FRAMES,
} as const;

export const RemotionRoot: React.FC = () => (
  <>
    {META_BLOBS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={MetaBlobs as React.FC<typeof v.props & LoopCheck>}
        defaultProps={{ ...v.props, loopCheck: false }}
        calculateMetadata={loopMetadata<typeof v.props & LoopCheck>()}
        {...common}
      />
    ))}
    {WAVE_FINS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={WaveFins as React.FC<typeof v.props & LoopCheck>}
        defaultProps={{ ...v.props, loopCheck: false }}
        calculateMetadata={loopMetadata<typeof v.props & LoopCheck>()}
        {...common}
      />
    ))}
    {GLOW_RINGS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={GlowRings as React.FC<typeof v.props & LoopCheck>}
        defaultProps={{ ...v.props, loopCheck: false }}
        calculateMetadata={loopMetadata<typeof v.props & LoopCheck>()}
        {...common}
      />
    ))}
  </>
);

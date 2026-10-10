import React from "react";
import { Composition } from "remotion";
import { CODE_VERSIONS, CURTAIN_VERSIONS, GLOW_VERSIONS } from "./colourways";
import { FPS, HEIGHT, LOOP, WIDTH } from "./constants";
import { GlitchCode } from "./GlitchCode";
import { GlowGradient } from "./GlowGradient";
import { LightCurtain } from "./LightCurtain";

// `frames` exists only so the loop check can render frame 600 (601 frames)
// without editing code: --props='{"frames":601}'. Visuals never read it.
type Props = { frames?: number };
const meta = ({ props }: { props: Props }) => ({
  durationInFrames: props.frames ?? LOOP,
});

export const RemotionRoot: React.FC = () => (
  <>
    {GLOW_VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={`GlowGradient-${v.id}`}
        component={() => <GlowGradient version={v} />}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{} as Props}
        calculateMetadata={meta}
      />
    ))}
    {CODE_VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={`GlitchCode-${v.id}`}
        component={() => <GlitchCode version={v} />}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{} as Props}
        calculateMetadata={meta}
      />
    ))}
    {CURTAIN_VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={`LightCurtain-${v.id}`}
        component={() => <LightCurtain version={v} />}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{} as Props}
        calculateMetadata={meta}
      />
    ))}
  </>
);

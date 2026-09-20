import React from "react";
import "./index.css";
import "./load-fonts";
import { Composition } from "remotion";
import {
  BluetoothExplainer,
  bluetoothExplainerSchema,
  bluetoothExplainerDefaultProps,
} from "./BluetoothExplainer";
import { DURATION_IN_FRAMES, FPS, WIDTH, HEIGHT } from "./constants";
import {
  ParticleRingHalo,
  particleRingHaloSchema,
  particleRingHaloDefaults,
} from "./particle-ring/ParticleRingHalo";
import {
  BASE_WIDTH,
  BASE_HEIGHT,
  DURATION_IN_FRAMES as RING_DURATION_IN_FRAMES,
  FPS as RING_FPS,
} from "./particle-ring/constants";
import {
  StudioPodium,
  studioPodiumSchema,
  VARIANTS,
  FPS as STUDIO_FPS,
} from "./studio";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="BluetoothExplainer"
        component={BluetoothExplainer}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={bluetoothExplainerSchema}
        defaultProps={bluetoothExplainerDefaultProps}
      />
      <Composition
        id="ParticleRingHalo"
        component={ParticleRingHalo}
        durationInFrames={RING_DURATION_IN_FRAMES}
        fps={RING_FPS}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        schema={particleRingHaloSchema}
        defaultProps={particleRingHaloDefaults}
      />
      <Composition
        id="ParticleRingHalo4K"
        component={ParticleRingHalo}
        durationInFrames={RING_DURATION_IN_FRAMES}
        fps={RING_FPS}
        width={BASE_WIDTH * 2}
        height={BASE_HEIGHT * 2}
        schema={particleRingHaloSchema}
        defaultProps={{ ...particleRingHaloDefaults, resolutionScale: 2 }}
      />
      {/*
        White-studio podium backplates, one per reference clip. Each variant is
        registered twice: a 4K composition (the master, shipped in the project)
        and a 1080p composition (the delivered render). Same component, same
        seed, same scene - only the raster size differs, so the 1080p render is
        a true downscale of the 4K master's framing rather than a re-layout.
      */}
      {VARIANTS.map((spec) => (
        <React.Fragment key={spec.id}>
          <Composition
            id={`${spec.id}4K`}
            component={StudioPodium}
            durationInFrames={spec.durationInFrames}
            fps={STUDIO_FPS}
            width={3840}
            height={2160}
            schema={studioPodiumSchema}
            defaultProps={{ variant: spec.id, forceWebGL: false }}
          />
          <Composition
            id={`${spec.id}1080`}
            component={StudioPodium}
            durationInFrames={spec.durationInFrames}
            fps={STUDIO_FPS}
            width={1920}
            height={1080}
            schema={studioPodiumSchema}
            defaultProps={{ variant: spec.id, forceWebGL: false }}
          />
        </React.Fragment>
      ))}
    </>
  );
};

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
import { NeonLayers } from "./neon-layers/NeonLayers";
import {
  DURATION_IN_FRAMES as NEON_DURATION_IN_FRAMES,
  FPS as NEON_FPS,
  HD_WIDTH,
  HD_HEIGHT,
  UHD_WIDTH,
  UHD_HEIGHT,
} from "./neon-layers/constants";
import {
  BASE_WIDTH,
  BASE_HEIGHT,
  DURATION_IN_FRAMES as RING_DURATION_IN_FRAMES,
  FPS as RING_FPS,
} from "./particle-ring/constants";

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
        Two looks, two resolutions. The 1080p pair is what gets delivered as
        MP4; the 4K pair is the same scene at delivery resolution and is what
        the project is set up to master from. Nothing but width/height and the
        theme differs between them, so the pair stays in sync by construction.
      */}
      <Composition
        id="NeonLayersViolet1080p"
        component={NeonLayers}
        durationInFrames={NEON_DURATION_IN_FRAMES}
        fps={NEON_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        defaultProps={{
          width: HD_WIDTH,
          height: HD_HEIGHT,
          theme: "violet" as const,
        }}
      />
      <Composition
        id="NeonLayersCyan1080p"
        component={NeonLayers}
        durationInFrames={NEON_DURATION_IN_FRAMES}
        fps={NEON_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        defaultProps={{
          width: HD_WIDTH,
          height: HD_HEIGHT,
          theme: "cyan" as const,
        }}
      />
      <Composition
        id="NeonLayersViolet4K"
        component={NeonLayers}
        durationInFrames={NEON_DURATION_IN_FRAMES}
        fps={NEON_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        defaultProps={{
          width: UHD_WIDTH,
          height: UHD_HEIGHT,
          theme: "violet" as const,
        }}
      />
      <Composition
        id="NeonLayersCyan4K"
        component={NeonLayers}
        durationInFrames={NEON_DURATION_IN_FRAMES}
        fps={NEON_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        defaultProps={{
          width: UHD_WIDTH,
          height: UHD_HEIGHT,
          theme: "cyan" as const,
        }}
      />
      {/* Reference-sized and cheap to render, for dialling the look in. */}
      <Composition
        id="NeonLayersLookDev"
        component={NeonLayers}
        durationInFrames={NEON_DURATION_IN_FRAMES}
        fps={NEON_FPS}
        width={768}
        height={432}
        defaultProps={{
          width: 768,
          height: 432,
          theme: "violet" as const,
        }}
      />
    </>
  );
};

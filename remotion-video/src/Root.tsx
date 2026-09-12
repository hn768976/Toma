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
  GlobeScene,
  globeSceneSchema,
  globeSceneDefaults,
} from "./globe/GlobeScene";
import {
  DURATION_IN_FRAMES as GLOBE_DURATION_IN_FRAMES,
  FPS as GLOBE_FPS,
} from "./globe/constants";

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
        Global Financial Data — 25s / 30fps seamless loop.
        The 4K compositions are the masters; the 1080p ones render the exact
        same scene (the whole thing is authored in 3840x2160 master units and
        scaled by width), so they are frame-identical apart from resolution.
      */}
      <Composition
        id="FinanceGlobe4K"
        component={GlobeScene}
        durationInFrames={GLOBE_DURATION_IN_FRAMES}
        fps={GLOBE_FPS}
        width={3840}
        height={2160}
        schema={globeSceneSchema}
        defaultProps={globeSceneDefaults}
      />
      <Composition
        id="FinanceGlobe1080"
        component={GlobeScene}
        durationInFrames={GLOBE_DURATION_IN_FRAMES}
        fps={GLOBE_FPS}
        width={1920}
        height={1080}
        schema={globeSceneSchema}
        defaultProps={globeSceneDefaults}
      />
      <Composition
        id="FinanceGlobeCyan4K"
        component={GlobeScene}
        durationInFrames={GLOBE_DURATION_IN_FRAMES}
        fps={GLOBE_FPS}
        width={3840}
        height={2160}
        schema={globeSceneSchema}
        defaultProps={{ ...globeSceneDefaults, theme: "cyan-mirror" as const }}
      />
      <Composition
        id="FinanceGlobeCyan1080"
        component={GlobeScene}
        durationInFrames={GLOBE_DURATION_IN_FRAMES}
        fps={GLOBE_FPS}
        width={1920}
        height={1080}
        schema={globeSceneSchema}
        defaultProps={{ ...globeSceneDefaults, theme: "cyan-mirror" as const }}
      />
    </>
  );
};

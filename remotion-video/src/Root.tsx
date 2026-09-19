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
import { VERSIONS } from "./micro/registry";
import {
  FPS as MICRO_FPS,
  MASTER_WIDTH,
  MASTER_HEIGHT,
  PREVIEW_WIDTH,
  PREVIEW_HEIGHT,
} from "./micro/constants";

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
        The microbiology set. Each version is registered twice: the 4K master
        that ships in the project, and a native 1080p composition for fast
        iteration. The delivered MP4s come from the 4K masters via --scale 0.5.
      */}
      {VERSIONS.map((version) => (
        <Composition
          key={version.name}
          id={`${version.name}-4K`}
          component={version.component}
          durationInFrames={version.durationInFrames}
          fps={MICRO_FPS}
          width={MASTER_WIDTH}
          height={MASTER_HEIGHT}
        />
      ))}
      {VERSIONS.map((version) => (
        <Composition
          key={`${version.name}-1080`}
          id={`${version.name}-1080p`}
          component={version.component}
          durationInFrames={version.durationInFrames}
          fps={MICRO_FPS}
          width={PREVIEW_WIDTH}
          height={PREVIEW_HEIGHT}
        />
      ))}
    </>
  );
};

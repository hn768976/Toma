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
  BASE_WIDTH as RING_BASE_WIDTH,
  BASE_HEIGHT as RING_BASE_HEIGHT,
  DURATION_IN_FRAMES as RING_DURATION_IN_FRAMES,
  FPS as RING_FPS,
} from "./particle-ring/constants";
import {
  MolecularVersion,
  molecularVersionSchema,
} from "./molecular/MolecularVersion";
import { PRESETS } from "./molecular/presets";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  FPS as MOL_FPS,
  UHD_HEIGHT,
  UHD_WIDTH,
  secondsToFrames,
} from "./molecular/constants";

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
        width={RING_BASE_WIDTH}
        height={RING_BASE_HEIGHT}
        schema={particleRingHaloSchema}
        defaultProps={particleRingHaloDefaults}
      />
      <Composition
        id="ParticleRingHalo4K"
        component={ParticleRingHalo}
        durationInFrames={RING_DURATION_IN_FRAMES}
        fps={RING_FPS}
        width={RING_BASE_WIDTH * 2}
        height={RING_BASE_HEIGHT * 2}
        schema={particleRingHaloSchema}
        defaultProps={{ ...particleRingHaloDefaults, resolutionScale: 2 }}
      />

      {/*
        Molecular Dreams — nine versions, each modelled on one supplied
        reference. Every version is registered twice from the same component:
        once at 1920x1080 (the delivered MP4s) and once at 3840x2160. The 4K
        entries are what the project zip is for; nothing about the scene is
        authored in pixels, so they are the same shot at twice the resolution.
      */}
      {PRESETS.map((preset) => {
        const durationInFrames = secondsToFrames(preset.durationSeconds);
        return (
          <Composition
            key={preset.id}
            id={preset.id}
            component={MolecularVersion}
            durationInFrames={durationInFrames}
            fps={MOL_FPS}
            width={BASE_WIDTH}
            height={BASE_HEIGHT}
            schema={molecularVersionSchema}
            defaultProps={{ versionId: preset.id }}
          />
        );
      })}

      {PRESETS.map((preset) => {
        const durationInFrames = secondsToFrames(preset.durationSeconds);
        return (
          <Composition
            key={`${preset.id}-4K`}
            id={`${preset.id}-4K`}
            component={MolecularVersion}
            durationInFrames={durationInFrames}
            fps={MOL_FPS}
            width={UHD_WIDTH}
            height={UHD_HEIGHT}
            schema={molecularVersionSchema}
            defaultProps={{ versionId: preset.id }}
          />
        );
      })}
    </>
  );
};

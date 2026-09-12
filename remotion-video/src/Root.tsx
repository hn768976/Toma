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
  SatinWaves,
  satinWavesSchema,
  satinWavesDefaults,
} from "./satin-waves/SatinWaves";
import {
  DURATION_IN_FRAMES as SATIN_DURATION_IN_FRAMES,
  FPS as SATIN_FPS,
  HD_WIDTH,
  HD_HEIGHT,
  UHD_WIDTH,
  UHD_HEIGHT,
} from "./satin-waves/constants";

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
        Satin waves — a seamless 10.000 s / 300-frame loop at 30 fps, matching
        the reference clip's length and frame rate. The shader works in units
        of frame height, so the 4K compositions frame the identical image as
        the 1080p ones rather than a cropped or rescaled version of it.
      */}
      <Composition
        id="SatinWavesLight"
        component={SatinWaves}
        durationInFrames={SATIN_DURATION_IN_FRAMES}
        fps={SATIN_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={satinWavesSchema}
        defaultProps={{ ...satinWavesDefaults, theme: "light" }}
      />
      <Composition
        id="SatinWavesDark"
        component={SatinWaves}
        durationInFrames={SATIN_DURATION_IN_FRAMES}
        fps={SATIN_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={satinWavesSchema}
        defaultProps={{ ...satinWavesDefaults, theme: "dark" }}
      />
      <Composition
        id="SatinWavesLight4K"
        component={SatinWaves}
        durationInFrames={SATIN_DURATION_IN_FRAMES}
        fps={SATIN_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={satinWavesSchema}
        defaultProps={{ ...satinWavesDefaults, theme: "light" }}
      />
      <Composition
        id="SatinWavesDark4K"
        component={SatinWaves}
        durationInFrames={SATIN_DURATION_IN_FRAMES}
        fps={SATIN_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={satinWavesSchema}
        defaultProps={{ ...satinWavesDefaults, theme: "dark" }}
      />
    </>
  );
};

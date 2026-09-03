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
import { LoadingBar } from "./loading-bar/LoadingBar";
import {
  DURATION_IN_FRAMES as LOADING_DURATION_IN_FRAMES,
  FPS as LOADING_FPS,
  WIDTH as LOADING_WIDTH,
  HEIGHT as LOADING_HEIGHT,
} from "./loading-bar/constants";
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
      <Composition
        id="LoadingUpload"
        component={LoadingBar}
        durationInFrames={LOADING_DURATION_IN_FRAMES}
        fps={LOADING_FPS}
        width={LOADING_WIDTH}
        height={LOADING_HEIGHT}
        defaultProps={{ variant: "upload" as const }}
      />
      <Composition
        id="LoadingDownload"
        component={LoadingBar}
        durationInFrames={LOADING_DURATION_IN_FRAMES}
        fps={LOADING_FPS}
        width={LOADING_WIDTH}
        height={LOADING_HEIGHT}
        defaultProps={{ variant: "download" as const }}
      />
      <Composition
        id="LoadingProcess"
        component={LoadingBar}
        durationInFrames={LOADING_DURATION_IN_FRAMES}
        fps={LOADING_FPS}
        width={LOADING_WIDTH}
        height={LOADING_HEIGHT}
        defaultProps={{ variant: "process" as const }}
      />
    </>
  );
};

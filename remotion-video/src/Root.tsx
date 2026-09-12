import "./index.css";
import "./load-fonts";
import "./data-network/preload";
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
  DataNetworkBoard,
  dataNetworkSchema,
  dataNetworkDefaults,
} from "./data-network/DataNetworkBoard";
import {
  BASE_WIDTH as NET_WIDTH,
  BASE_HEIGHT as NET_HEIGHT,
  UHD_WIDTH as NET_UHD_WIDTH,
  UHD_HEIGHT as NET_UHD_HEIGHT,
  DURATION_IN_FRAMES as NET_DURATION_IN_FRAMES,
  FPS as NET_FPS,
} from "./data-network/constants";

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
        Global Data Network. The 4K entries are the masters; the 1080p entries
        are the same design space at half the pixels, for delivery.
      */}
      <Composition
        id="DataNetwork4KBlue"
        component={DataNetworkBoard}
        durationInFrames={NET_DURATION_IN_FRAMES}
        fps={NET_FPS}
        width={NET_UHD_WIDTH}
        height={NET_UHD_HEIGHT}
        schema={dataNetworkSchema}
        defaultProps={{ ...dataNetworkDefaults, theme: "blue" as const }}
      />
      <Composition
        id="DataNetwork4KGreen"
        component={DataNetworkBoard}
        durationInFrames={NET_DURATION_IN_FRAMES}
        fps={NET_FPS}
        width={NET_UHD_WIDTH}
        height={NET_UHD_HEIGHT}
        schema={dataNetworkSchema}
        defaultProps={{ ...dataNetworkDefaults, theme: "green" as const }}
      />
      <Composition
        id="DataNetwork1080Blue"
        component={DataNetworkBoard}
        durationInFrames={NET_DURATION_IN_FRAMES}
        fps={NET_FPS}
        width={NET_WIDTH}
        height={NET_HEIGHT}
        schema={dataNetworkSchema}
        defaultProps={{ ...dataNetworkDefaults, theme: "blue" as const }}
      />
      <Composition
        id="DataNetwork1080Green"
        component={DataNetworkBoard}
        durationInFrames={NET_DURATION_IN_FRAMES}
        fps={NET_FPS}
        width={NET_WIDTH}
        height={NET_HEIGHT}
        schema={dataNetworkSchema}
        defaultProps={{ ...dataNetworkDefaults, theme: "green" as const }}
      />
      <Composition
        id="DataNetwork4KCyan"
        component={DataNetworkBoard}
        durationInFrames={NET_DURATION_IN_FRAMES}
        fps={NET_FPS}
        width={NET_UHD_WIDTH}
        height={NET_UHD_HEIGHT}
        schema={dataNetworkSchema}
        defaultProps={{ ...dataNetworkDefaults, theme: "cyan" as const }}
      />
      <Composition
        id="DataNetwork1080Cyan"
        component={DataNetworkBoard}
        durationInFrames={NET_DURATION_IN_FRAMES}
        fps={NET_FPS}
        width={NET_WIDTH}
        height={NET_HEIGHT}
        schema={dataNetworkSchema}
        defaultProps={{ ...dataNetworkDefaults, theme: "cyan" as const }}
      />
    </>
  );
};

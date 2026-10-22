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

import { CodeGrid, codeGridSchema } from "./code-grid/CodeGrid";
import {
  DURATION_IN_FRAMES as GRID_DURATION_IN_FRAMES,
  FPS as GRID_FPS,
  WIDTH as GRID_WIDTH,
  HEIGHT as GRID_HEIGHT,
} from "./code-grid/constants";

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
      {/* 4K compositions; render with --scale=0.5 for 1080p delivery. */}
      <Composition
        id="CodeGrid4K"
        component={CodeGrid}
        durationInFrames={GRID_DURATION_IN_FRAMES}
        fps={GRID_FPS}
        width={GRID_WIDTH}
        height={GRID_HEIGHT}
        schema={codeGridSchema}
        defaultProps={{ palette: "cyberBlue" as const }}
      />
      <Composition
        id="CodeGridEmber4K"
        component={CodeGrid}
        durationInFrames={GRID_DURATION_IN_FRAMES}
        fps={GRID_FPS}
        width={GRID_WIDTH}
        height={GRID_HEIGHT}
        schema={codeGridSchema}
        defaultProps={{ palette: "emberGold" as const }}
      />
    </>
  );
};

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
  GridPlane,
  gridPlaneDefaults,
  gridPlaneSchema,
} from "./grid-plane/GridPlane";
import {
  BASE_WIDTH as GRID_BASE_WIDTH,
  BASE_HEIGHT as GRID_BASE_HEIGHT,
  DURATION_IN_FRAMES as GRID_DURATION_IN_FRAMES,
  FPS as GRID_FPS,
} from "./grid-plane/constants";

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
      {/* Warped grid plane. The 4K compositions are the deliverables; the
          1080p ones are the same image at a quarter of the pixels, for
          fast previewing. */}
      <Composition
        id="GridPlaneBlue"
        component={GridPlane}
        durationInFrames={GRID_DURATION_IN_FRAMES}
        fps={GRID_FPS}
        width={GRID_BASE_WIDTH}
        height={GRID_BASE_HEIGHT}
        schema={gridPlaneSchema}
        defaultProps={gridPlaneDefaults}
      />
      <Composition
        id="GridPlaneBlue4K"
        component={GridPlane}
        durationInFrames={GRID_DURATION_IN_FRAMES}
        fps={GRID_FPS}
        width={GRID_BASE_WIDTH * 2}
        height={GRID_BASE_HEIGHT * 2}
        schema={gridPlaneSchema}
        defaultProps={gridPlaneDefaults}
      />
      <Composition
        id="GridPlaneSynthwave"
        component={GridPlane}
        durationInFrames={GRID_DURATION_IN_FRAMES}
        fps={GRID_FPS}
        width={GRID_BASE_WIDTH}
        height={GRID_BASE_HEIGHT}
        schema={gridPlaneSchema}
        defaultProps={{ ...gridPlaneDefaults, variant: "synthwave" as const }}
      />
      <Composition
        id="GridPlaneSynthwave4K"
        component={GridPlane}
        durationInFrames={GRID_DURATION_IN_FRAMES}
        fps={GRID_FPS}
        width={GRID_BASE_WIDTH * 2}
        height={GRID_BASE_HEIGHT * 2}
        schema={gridPlaneSchema}
        defaultProps={{ ...gridPlaneDefaults, variant: "synthwave" as const }}
      />
    </>
  );
};

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
  DataGridField,
  dataGridSchema,
  dataGridBlueDefaults,
  dataGridGreenDefaults,
} from "./data-grid/DataGridField";
import {
  BASE_WIDTH as GRID_WIDTH,
  BASE_HEIGHT as GRID_HEIGHT,
  DURATION_IN_FRAMES as GRID_DURATION_IN_FRAMES,
  FPS as GRID_FPS,
} from "./data-grid/constants";

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
        Big-data grid field. Four compositions, one component: the 4K
        pair is a true 2x render (sizes scale off the composition width),
        and the 1080p pair is what gets delivered as MP4.
      */}
      <Composition
        id="DataGridBlue4K"
        component={DataGridField}
        durationInFrames={GRID_DURATION_IN_FRAMES}
        fps={GRID_FPS}
        width={GRID_WIDTH * 2}
        height={GRID_HEIGHT * 2}
        schema={dataGridSchema}
        defaultProps={dataGridBlueDefaults}
      />
      <Composition
        id="DataGridBlue1080"
        component={DataGridField}
        durationInFrames={GRID_DURATION_IN_FRAMES}
        fps={GRID_FPS}
        width={GRID_WIDTH}
        height={GRID_HEIGHT}
        schema={dataGridSchema}
        defaultProps={dataGridBlueDefaults}
      />
      <Composition
        id="DataGridGreen4K"
        component={DataGridField}
        durationInFrames={GRID_DURATION_IN_FRAMES}
        fps={GRID_FPS}
        width={GRID_WIDTH * 2}
        height={GRID_HEIGHT * 2}
        schema={dataGridSchema}
        defaultProps={dataGridGreenDefaults}
      />
      <Composition
        id="DataGridGreen1080"
        component={DataGridField}
        durationInFrames={GRID_DURATION_IN_FRAMES}
        fps={GRID_FPS}
        width={GRID_WIDTH}
        height={GRID_HEIGHT}
        schema={dataGridSchema}
        defaultProps={dataGridGreenDefaults}
      />
    </>
  );
};

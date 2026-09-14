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
  SolarPanelArray,
  solarArraySchema,
  solarArrayDefaults,
} from "./grid-plane/SolarPanelArray";
import {
  NeonGridPlane,
  neonGridSchema,
  neonGridDefaults,
} from "./grid-plane/NeonGridPlane";
import {
  BASE_WIDTH as GRID_W,
  BASE_HEIGHT as GRID_H,
  FPS as GRID_FPS,
  NEON_DURATION_IN_FRAMES,
  SOLAR_DURATION_IN_FRAMES,
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
      <Composition
        id="SolarPanelArray1080"
        component={SolarPanelArray}
        durationInFrames={SOLAR_DURATION_IN_FRAMES}
        fps={GRID_FPS}
        width={GRID_W}
        height={GRID_H}
        schema={solarArraySchema}
        defaultProps={solarArrayDefaults}
      />
      <Composition
        id="SolarPanelArray4K"
        component={SolarPanelArray}
        durationInFrames={SOLAR_DURATION_IN_FRAMES}
        fps={GRID_FPS}
        width={GRID_W * 2}
        height={GRID_H * 2}
        schema={solarArraySchema}
        defaultProps={solarArrayDefaults}
      />
      <Composition
        id="NeonGridPlane1080"
        component={NeonGridPlane}
        durationInFrames={NEON_DURATION_IN_FRAMES}
        fps={GRID_FPS}
        width={GRID_W}
        height={GRID_H}
        schema={neonGridSchema}
        defaultProps={neonGridDefaults}
      />
      <Composition
        id="NeonGridPlane4K"
        component={NeonGridPlane}
        durationInFrames={NEON_DURATION_IN_FRAMES}
        fps={GRID_FPS}
        width={GRID_W * 2}
        height={GRID_H * 2}
        schema={neonGridSchema}
        defaultProps={neonGridDefaults}
      />
    </>
  );
};

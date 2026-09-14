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
import { CodeWall, codeWallSchema, codeWallDefaults } from "./code-wall/CodeWall";
import {
  BASE_WIDTH as WALL_WIDTH,
  BASE_HEIGHT as WALL_HEIGHT,
  DURATION_IN_FRAMES as WALL_DURATION_IN_FRAMES,
  FPS as WALL_FPS,
} from "./code-wall/constants";

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
        Code wall: 20s @ 30fps, two colourways, each mastered at 4K with a
        matching 1080p composition. resolutionScale must always equal
        width / 1920, or the canvas and the output size drift apart.
      */}
      <Composition
        id="CodeWallBlue4K"
        component={CodeWall}
        durationInFrames={WALL_DURATION_IN_FRAMES}
        fps={WALL_FPS}
        width={WALL_WIDTH * 2}
        height={WALL_HEIGHT * 2}
        schema={codeWallSchema}
        defaultProps={{ ...codeWallDefaults, theme: "blue", resolutionScale: 2 }}
      />
      <Composition
        id="CodeWallBlue1080"
        component={CodeWall}
        durationInFrames={WALL_DURATION_IN_FRAMES}
        fps={WALL_FPS}
        width={WALL_WIDTH}
        height={WALL_HEIGHT}
        schema={codeWallSchema}
        defaultProps={{ ...codeWallDefaults, theme: "blue", resolutionScale: 1 }}
      />
      <Composition
        id="CodeWallGreen4K"
        component={CodeWall}
        durationInFrames={WALL_DURATION_IN_FRAMES}
        fps={WALL_FPS}
        width={WALL_WIDTH * 2}
        height={WALL_HEIGHT * 2}
        schema={codeWallSchema}
        defaultProps={{ ...codeWallDefaults, theme: "green", resolutionScale: 2 }}
      />
      <Composition
        id="CodeWallGreen1080"
        component={CodeWall}
        durationInFrames={WALL_DURATION_IN_FRAMES}
        fps={WALL_FPS}
        width={WALL_WIDTH}
        height={WALL_HEIGHT}
        schema={codeWallSchema}
        defaultProps={{ ...codeWallDefaults, theme: "green", resolutionScale: 1 }}
      />
    </>
  );
};

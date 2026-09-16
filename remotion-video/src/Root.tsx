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
import { HexWall, hexWallSchema } from "./hex-wall/HexWall";
import {
  DURATION_IN_FRAMES as HEX_DURATION_IN_FRAMES,
  FPS as HEX_FPS,
  HD_HEIGHT,
  HD_WIDTH,
  UHD_HEIGHT,
  UHD_WIDTH,
} from "./hex-wall/constants";

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
        id="HexWallMono"
        component={HexWall}
        durationInFrames={HEX_DURATION_IN_FRAMES}
        fps={HEX_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={hexWallSchema}
        defaultProps={{ theme: "mono" as const, quality: 1 }}
      />
      <Composition
        id="HexWallBlue"
        component={HexWall}
        durationInFrames={HEX_DURATION_IN_FRAMES}
        fps={HEX_FPS}
        width={HD_WIDTH}
        height={HD_HEIGHT}
        schema={hexWallSchema}
        defaultProps={{ theme: "blue" as const, quality: 1 }}
      />
      <Composition
        id="HexWallMono4K"
        component={HexWall}
        durationInFrames={HEX_DURATION_IN_FRAMES}
        fps={HEX_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={hexWallSchema}
        defaultProps={{ theme: "mono" as const, quality: 2 }}
      />
      <Composition
        id="HexWallBlue4K"
        component={HexWall}
        durationInFrames={HEX_DURATION_IN_FRAMES}
        fps={HEX_FPS}
        width={UHD_WIDTH}
        height={UHD_HEIGHT}
        schema={hexWallSchema}
        defaultProps={{ theme: "blue" as const, quality: 2 }}
      />
    </>
  );
};

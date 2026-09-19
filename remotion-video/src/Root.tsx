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
  GenerateButtonScene,
  generateButtonSchema,
  generateButtonDefaults,
} from "./generate-button/GenerateButtonScene";
import {
  BASE_WIDTH as GB_WIDTH,
  BASE_HEIGHT as GB_HEIGHT,
  DURATION_IN_FRAMES as GB_DURATION,
  FPS as GB_FPS,
} from "./generate-button/constants";

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
      {/* "Generate" button / circuit burst. 1080p and 4K render from the
          same 1920x1080 design space, so the two masters are identical
          apart from resolution. */}
      {(
        [
          ["Dark", "dark"],
          ["Light", "light"],
        ] as const
      ).map(([suffix, themeName]) =>
        (
          [
            ["1080p", 1],
            ["4K", 2],
          ] as const
        ).map(([sizeName, mult]) => (
          <Composition
            key={`${suffix}${sizeName}`}
            id={`GenerateButton${suffix}${sizeName}`}
            component={GenerateButtonScene}
            durationInFrames={GB_DURATION}
            fps={GB_FPS}
            width={GB_WIDTH * mult}
            height={GB_HEIGHT * mult}
            schema={generateButtonSchema}
            defaultProps={{ ...generateButtonDefaults, theme: themeName }}
          />
        )),
      )}
    </>
  );
};

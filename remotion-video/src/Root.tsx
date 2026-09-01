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
import { EncryptScreen } from "./encrypt/EncryptScreen";
import {
  DURATION_IN_FRAMES as ENCRYPT_DURATION_IN_FRAMES,
  FPS as ENCRYPT_FPS,
  WIDTH as ENCRYPT_WIDTH,
  HEIGHT as ENCRYPT_HEIGHT,
} from "./encrypt/timeline";

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
        id="EncryptSuccess"
        component={EncryptScreen}
        durationInFrames={ENCRYPT_DURATION_IN_FRAMES}
        fps={ENCRYPT_FPS}
        width={ENCRYPT_WIDTH}
        height={ENCRYPT_HEIGHT}
        defaultProps={{ variant: "success" as const }}
      />
      <Composition
        id="EncryptFailure"
        component={EncryptScreen}
        durationInFrames={ENCRYPT_DURATION_IN_FRAMES}
        fps={ENCRYPT_FPS}
        width={ENCRYPT_WIDTH}
        height={ENCRYPT_HEIGHT}
        defaultProps={{ variant: "failure" as const }}
      />
    </>
  );
};

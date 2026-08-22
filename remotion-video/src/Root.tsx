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
  DURATION_IN_FRAMES as RING_DURATION_IN_FRAMES,
  FPS as RING_FPS,
  WIDTH as RING_WIDTH,
  HEIGHT as RING_HEIGHT,
} from "./particle-ring/constants";
import { KurzgesagtVault } from "./vault/KurzgesagtVault";
import { MinutePhysicsExplainer } from "./pen/MinutePhysicsExplainer";
import {
  DURATION_IN_FRAMES as PEN_DURATION_IN_FRAMES,
  FPS as PEN_FPS,
  WIDTH as PEN_WIDTH,
  HEIGHT as PEN_HEIGHT,
} from "./pen/constants";
import {
  DURATION_IN_FRAMES as VAULT_DURATION_IN_FRAMES,
  FPS as VAULT_FPS,
  WIDTH as VAULT_WIDTH,
  HEIGHT as VAULT_HEIGHT,
} from "./vault/constants";

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
        id="KurzgesagtVault"
        component={KurzgesagtVault}
        durationInFrames={VAULT_DURATION_IN_FRAMES}
        fps={VAULT_FPS}
        width={VAULT_WIDTH}
        height={VAULT_HEIGHT}
      />
      <Composition
        id="MinutePhysicsExplainer"
        component={MinutePhysicsExplainer}
        durationInFrames={PEN_DURATION_IN_FRAMES}
        fps={PEN_FPS}
        width={PEN_WIDTH}
        height={PEN_HEIGHT}
      />
      <Composition
        id="ParticleRingHalo"
        component={ParticleRingHalo}
        durationInFrames={RING_DURATION_IN_FRAMES}
        fps={RING_FPS}
        width={RING_WIDTH}
        height={RING_HEIGHT}
        schema={particleRingHaloSchema}
        defaultProps={particleRingHaloDefaults}
      />
    </>
  );
};

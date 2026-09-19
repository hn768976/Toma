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
  CyberAttack,
  cyberAttackSchema,
  cyberAttackDefaults,
  cyberAttackV2Props,
} from "./cyber-attack/CyberAttack";
import {
  BASE_WIDTH as CYBER_WIDTH,
  BASE_HEIGHT as CYBER_HEIGHT,
  DURATION_IN_FRAMES as CYBER_DURATION,
  FPS as CYBER_FPS,
} from "./cyber-attack/constants";

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
        id="CyberAttack"
        component={CyberAttack}
        durationInFrames={CYBER_DURATION}
        fps={CYBER_FPS}
        width={CYBER_WIDTH}
        height={CYBER_HEIGHT}
        schema={cyberAttackSchema}
        defaultProps={cyberAttackDefaults}
      />
      <Composition
        id="CyberAttack4K"
        component={CyberAttack}
        durationInFrames={CYBER_DURATION}
        fps={CYBER_FPS}
        width={CYBER_WIDTH * 2}
        height={CYBER_HEIGHT * 2}
        schema={cyberAttackSchema}
        defaultProps={cyberAttackDefaults}
      />
      <Composition
        id="CyberAttackV2"
        component={CyberAttack}
        durationInFrames={CYBER_DURATION}
        fps={CYBER_FPS}
        width={CYBER_WIDTH}
        height={CYBER_HEIGHT}
        schema={cyberAttackSchema}
        defaultProps={cyberAttackV2Props}
      />
      <Composition
        id="CyberAttackV2-4K"
        component={CyberAttack}
        durationInFrames={CYBER_DURATION}
        fps={CYBER_FPS}
        width={CYBER_WIDTH * 2}
        height={CYBER_HEIGHT * 2}
        schema={cyberAttackSchema}
        defaultProps={cyberAttackV2Props}
      />
    </>
  );
};

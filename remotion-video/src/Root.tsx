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
import { JetHud } from "./jet-hud/JetHud";
import { JetSpriteQA } from "./jet-hud/JetSpriteQA";
import {
  DURATION_IN_FRAMES as JET_DURATION,
  FPS as JET_FPS,
  WIDTH as JET_WIDTH,
  HEIGHT as JET_HEIGHT,
} from "./jet-hud/constants";
import {
  BASE_WIDTH,
  BASE_HEIGHT,
  DURATION_IN_FRAMES as RING_DURATION_IN_FRAMES,
  FPS as RING_FPS,
} from "./particle-ring/constants";

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
        id="JetHudBlue"
        component={JetHud}
        durationInFrames={JET_DURATION}
        fps={JET_FPS}
        width={JET_WIDTH}
        height={JET_HEIGHT}
        defaultProps={{ variant: "blue" as const }}
      />
      <Composition
        id="JetHudAmber"
        component={JetHud}
        durationInFrames={JET_DURATION}
        fps={JET_FPS}
        width={JET_WIDTH}
        height={JET_HEIGHT}
        defaultProps={{ variant: "amber" as const }}
      />
      <Composition
        id="JetHudLoopCheck"
        component={JetHud}
        durationInFrames={JET_DURATION + 1}
        fps={JET_FPS}
        width={JET_WIDTH}
        height={JET_HEIGHT}
        defaultProps={{ variant: "blue" as const }}
      />
      <Composition
        id="JetSpriteQA"
        component={JetSpriteQA}
        durationInFrames={1}
        fps={30}
        width={1600}
        height={1600}
        defaultProps={{ variant: "blue" as const }}
      />
    </>
  );
};

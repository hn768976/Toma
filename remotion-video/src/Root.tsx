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
import { FormulaField } from "./formula-field/FormulaField";
import { NotationSheet } from "./formula-field/NotationSheet";
import {
  DURATION_IN_FRAMES as FIELD_DURATION,
  FPS as FIELD_FPS,
  HEIGHT as FIELD_HEIGHT,
  WIDTH as FIELD_WIDTH,
} from "./formula-field/field";
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
        id="FormulaFieldBlue"
        component={FormulaField}
        durationInFrames={FIELD_DURATION}
        fps={FIELD_FPS}
        width={FIELD_WIDTH}
        height={FIELD_HEIGHT}
        defaultProps={{ variant: "chem" as const }}
      />
      <Composition
        id="LoopCheck"
        component={FormulaField}
        durationInFrames={FIELD_DURATION + 1}
        fps={FIELD_FPS}
        width={FIELD_WIDTH}
        height={FIELD_HEIGHT}
        defaultProps={{ variant: "chem" as const }}
      />
      <Composition
        id="NotationSheet"
        component={NotationSheet}
        durationInFrames={1}
        fps={FIELD_FPS}
        width={FIELD_WIDTH}
        height={FIELD_HEIGHT}
        defaultProps={{ variant: "chem" as const }}
      />
    </>
  );
};

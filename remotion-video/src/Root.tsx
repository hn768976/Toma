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
  CircuitHologram,
  circuitHologramSchema,
  circuitHologramDefaults,
} from "./circuit-hologram/CircuitHologram";
import {
  BASE_WIDTH as HOLO_BASE_WIDTH,
  BASE_HEIGHT as HOLO_BASE_HEIGHT,
  DURATION_IN_FRAMES as HOLO_DURATION_IN_FRAMES,
  FPS as HOLO_FPS,
} from "./circuit-hologram/constants";

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

      {/* Circuit-board hologram: cloud (reference recreation) and AI chip,
          each at 1080p and 4K. The 4K ones are the same picture scaled 2x. */}
      <Composition
        id="CloudCircuit"
        component={CircuitHologram}
        durationInFrames={HOLO_DURATION_IN_FRAMES}
        fps={HOLO_FPS}
        width={HOLO_BASE_WIDTH}
        height={HOLO_BASE_HEIGHT}
        schema={circuitHologramSchema}
        defaultProps={{ ...circuitHologramDefaults, variant: "cloud" }}
      />
      <Composition
        id="CloudCircuit4K"
        component={CircuitHologram}
        durationInFrames={HOLO_DURATION_IN_FRAMES}
        fps={HOLO_FPS}
        width={HOLO_BASE_WIDTH * 2}
        height={HOLO_BASE_HEIGHT * 2}
        schema={circuitHologramSchema}
        defaultProps={{ ...circuitHologramDefaults, variant: "cloud", resolutionScale: 2 }}
      />
      <Composition
        id="AiChipCircuit"
        component={CircuitHologram}
        durationInFrames={HOLO_DURATION_IN_FRAMES}
        fps={HOLO_FPS}
        width={HOLO_BASE_WIDTH}
        height={HOLO_BASE_HEIGHT}
        schema={circuitHologramSchema}
        defaultProps={{ ...circuitHologramDefaults, variant: "ai-chip" }}
      />
      <Composition
        id="AiChipCircuit4K"
        component={CircuitHologram}
        durationInFrames={HOLO_DURATION_IN_FRAMES}
        fps={HOLO_FPS}
        width={HOLO_BASE_WIDTH * 2}
        height={HOLO_BASE_HEIGHT * 2}
        schema={circuitHologramSchema}
        defaultProps={{ ...circuitHologramDefaults, variant: "ai-chip", resolutionScale: 2 }}
      />
    </>
  );
};

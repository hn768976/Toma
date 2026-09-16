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
import { CodeGrid, codeGridSchema, codeGridDefaults } from "./code-grid/CodeGrid";
import {
  BASE_WIDTH as GRID_WIDTH,
  BASE_HEIGHT as GRID_HEIGHT,
  DURATION_IN_FRAMES as GRID_DURATION_IN_FRAMES,
  FPS as GRID_FPS,
} from "./code-grid/constants";

// The four CodeGrid compositions are the same scene at two grades and two
// output sizes. resolutionScale must track the composition dimensions:
// it scales the code texture, the text size on each block and the
// depth-of-field blur radii, so that 4K is the same picture with more
// pixels rather than a differently-proportioned one.
const codeGridVariants = [
  { id: "CodeGridBlue", colorway: "blue", scale: 1 },
  { id: "CodeGridTeal", colorway: "teal", scale: 1 },
  { id: "CodeGridBlue4K", colorway: "blue", scale: 2 },
  { id: "CodeGridTeal4K", colorway: "teal", scale: 2 },
] as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {codeGridVariants.map(({ id, colorway, scale }) => (
        <Composition
          key={id}
          id={id}
          component={CodeGrid}
          durationInFrames={GRID_DURATION_IN_FRAMES}
          fps={GRID_FPS}
          width={GRID_WIDTH * scale}
          height={GRID_HEIGHT * scale}
          schema={codeGridSchema}
          defaultProps={{
            ...codeGridDefaults,
            colorway,
            resolutionScale: scale,
          }}
        />
      ))}
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
    </>
  );
};

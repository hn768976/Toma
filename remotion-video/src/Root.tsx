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
import { DotMatrixWall, dotMatrixWallSchema } from "./dot-matrix/DotMatrixWall";
import {
  DURATION_IN_FRAMES as DOT_DURATION_IN_FRAMES,
  FPS as DOT_FPS,
  HEIGHT as DOT_HEIGHT,
  WIDTH as DOT_WIDTH,
} from "./dot-matrix/constants";
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
      {/* LED dot matrix wall. Defined at 4K; the 1080p deliverables are the
          same composition rendered with --scale=0.5. */}
      {(
        [
          ["V1-DotMatrixBlue", "blue"],
          ["V2-DotMatrixAmber", "amber"],
          ["V3-DotMatrixMono", "mono"],
        ] as const
      ).map(([id, variant]) => (
        <Composition
          key={id}
          id={id}
          component={DotMatrixWall}
          durationInFrames={DOT_DURATION_IN_FRAMES}
          fps={DOT_FPS}
          width={DOT_WIDTH}
          height={DOT_HEIGHT}
          schema={dotMatrixWallSchema}
          defaultProps={{ variant }}
        />
      ))}
    </>
  );
};

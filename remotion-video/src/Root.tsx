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
  CellDivision,
  cellDivisionSchema,
  cellDivisionDefaults,
} from "./cell-division/CellDivision";
import {
  BASE_WIDTH as CELL_WIDTH,
  BASE_HEIGHT as CELL_HEIGHT,
  DURATION_IN_FRAMES as CELL_DURATION_IN_FRAMES,
  FPS as CELL_FPS,
} from "./cell-division/constants";
import type { ThemeId } from "./cell-division/themes";

// One composition per grade per resolution. 1080p is the delivery master
// and 4K is the same scene at 2x -- the scene is described in world units
// and shaded analytically, so nothing is baked to a pixel size and the two
// are frame-for-frame identical apart from resolution.
const CELL_VARIANTS: { id: ThemeId; suffix: string }[] = [
  { id: "mono", suffix: "Mono" },
  { id: "blue", suffix: "Blue" },
  { id: "violet", suffix: "Violet" },
];

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
      {CELL_VARIANTS.flatMap(({ id, suffix }) =>
        [
          { label: "1080p", scale: 1 },
          { label: "4K", scale: 2 },
        ].map(({ label, scale }) => (
          <Composition
            key={`${id}-${label}`}
            id={`CellDivision-${suffix}-${label}`}
            component={CellDivision}
            durationInFrames={CELL_DURATION_IN_FRAMES}
            fps={CELL_FPS}
            width={CELL_WIDTH * scale}
            height={CELL_HEIGHT * scale}
            schema={cellDivisionSchema}
            defaultProps={{ ...cellDivisionDefaults, theme: id }}
          />
        )),
      )}
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

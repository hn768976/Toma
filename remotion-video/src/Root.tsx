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
import { GlassBlob, glassBlobSchema, glassBlobDefaults } from "./glass-blob/GlassBlob";
import {
  BASE_WIDTH as BLOB_WIDTH,
  BASE_HEIGHT as BLOB_HEIGHT,
  DURATION_IN_FRAMES as BLOB_DURATION_IN_FRAMES,
  FPS as BLOB_FPS,
} from "./glass-blob/constants";

const GLASS_BLOB_VARIANTS = [
  { id: "GlassBlob", palette: "reference" },
  { id: "GlassBlobIridescent", palette: "iridescent" },
] as const;

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
      {GLASS_BLOB_VARIANTS.flatMap(({ id, palette }) =>
        [1, 2].map((scale) => (
          <Composition
            key={`${id}-${scale}`}
            id={scale === 1 ? id : `${id}4K`}
            component={GlassBlob}
            durationInFrames={BLOB_DURATION_IN_FRAMES}
            fps={BLOB_FPS}
            width={BLOB_WIDTH * scale}
            height={BLOB_HEIGHT * scale}
            schema={glassBlobSchema}
            defaultProps={{ ...glassBlobDefaults, palette, resolutionScale: scale }}
          />
        )),
      )}
    </>
  );
};

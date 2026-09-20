import "./index.css";
import "./load-fonts";
import { Composition, Folder } from "remotion";
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
  LiquidBlobs,
  liquidBlobsSchema,
  liquidBlobsDefaults,
} from "./liquid-blobs/LiquidBlobs";
import {
  DURATION_IN_FRAMES as BLOB_DURATION_IN_FRAMES,
  FPS as BLOB_FPS,
  HD_HEIGHT,
  HD_WIDTH,
  UHD_HEIGHT,
  UHD_WIDTH,
} from "./liquid-blobs/constants";
import { variantList } from "./liquid-blobs/variants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="LiquidBlobs">
        {variantList.map((variant) => {
          // Suffix drops the "vN-" prefix: "v1-blue" reads as "LiquidBlobs-V1-Blue".
          const [index, name] = variant.id.split("-");
          const label = `${index.toUpperCase()}-${name[0].toUpperCase()}${name.slice(1)}`;
          return [
            {
              suffix: "1080p",
              width: HD_WIDTH,
              height: HD_HEIGHT,
              superSample: 2 as const,
            },
            {
              suffix: "4K",
              width: UHD_WIDTH,
              height: UHD_HEIGHT,
              superSample: 2 as const,
            },
          ].map((size) => (
            <Composition
              key={`${variant.id}-${size.suffix}`}
              id={`LiquidBlobs-${label}-${size.suffix}`}
              component={LiquidBlobs}
              durationInFrames={BLOB_DURATION_IN_FRAMES}
              fps={BLOB_FPS}
              width={size.width}
              height={size.height}
              schema={liquidBlobsSchema}
              defaultProps={{
                ...liquidBlobsDefaults,
                variant: variant.id,
                superSample: size.superSample,
              }}
            />
          ));
        })}
      </Folder>
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

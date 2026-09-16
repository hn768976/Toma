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
import { GpuProbe } from "./gpu-probe/GpuProbe";
import { OrbitalEarth, orbitalEarthSchema } from "./earth/OrbitalEarth";
import {
  FPS as EARTH_FPS,
  HD,
  SHOT_IDS,
  SHOTS,
  UHD,
  type ShotId,
} from "./earth/config";

/** `orbitDrift` becomes `EarthOrbitDrift-1080p`. */
const compositionId = (shot: ShotId, suffix: string) =>
  `Earth${shot[0].toUpperCase()}${shot.slice(1)}-${suffix}`;

const EARTH_SIZES = [
  { suffix: "1080p", ...HD },
  { suffix: "4K", ...UHD },
] as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/*
        Seven orbital Earth shots, each registered at delivery resolution and
        at 4K. Same component and same scene code throughout — everything that
        differs between them is data in earth/config.ts.
      */}
      {SHOT_IDS.flatMap((shot) =>
        EARTH_SIZES.map((size) => (
          <Composition
            key={compositionId(shot, size.suffix)}
            id={compositionId(shot, size.suffix)}
            component={OrbitalEarth}
            durationInFrames={SHOTS[shot].durationInFrames}
            fps={EARTH_FPS}
            width={size.width}
            height={size.height}
            schema={orbitalEarthSchema}
            defaultProps={{ shot: shot as string, superSample: 1, samples: 4 }}
          />
        )),
      )}
      <Composition
        id="GpuProbe"
        component={GpuProbe}
        durationInFrames={1}
        fps={30}
        width={1200}
        height={400}
      />
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

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
import { GpuProbe } from "./gpu-probe/GpuProbe";
import { OrbitalEarth, orbitalEarthSchema } from "./earth/OrbitalEarth";
import {
  DURATION_IN_FRAMES as EARTH_DURATION,
  FPS as EARTH_FPS,
  HD,
  UHD,
} from "./earth/config";
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
      {/* Version A — the reference layout: high-oblique limb across the frame. */}
      <Composition
        id="EarthOrbitDrift-1080p"
        component={OrbitalEarth}
        durationInFrames={EARTH_DURATION}
        fps={EARTH_FPS}
        width={HD.width}
        height={HD.height}
        schema={orbitalEarthSchema}
        defaultProps={{ shot: "orbitDrift" as const, superSample: 1, samples: 4 }}
      />
      <Composition
        id="EarthOrbitDrift-4K"
        component={OrbitalEarth}
        durationInFrames={EARTH_DURATION}
        fps={EARTH_FPS}
        width={UHD.width}
        height={UHD.height}
        schema={orbitalEarthSchema}
        defaultProps={{ shot: "orbitDrift" as const, superSample: 1, samples: 4 }}
      />
      {/* Version B — low ISS-cupola horizon with a sunrise over the limb. */}
      <Composition
        id="EarthLowHorizon-1080p"
        component={OrbitalEarth}
        durationInFrames={EARTH_DURATION}
        fps={EARTH_FPS}
        width={HD.width}
        height={HD.height}
        schema={orbitalEarthSchema}
        defaultProps={{ shot: "lowHorizon" as const, superSample: 1, samples: 4 }}
      />
      <Composition
        id="EarthLowHorizon-4K"
        component={OrbitalEarth}
        durationInFrames={EARTH_DURATION}
        fps={EARTH_FPS}
        width={UHD.width}
        height={UHD.height}
        schema={orbitalEarthSchema}
        defaultProps={{ shot: "lowHorizon" as const, superSample: 1, samples: 4 }}
      />
      <Composition
        id="GpuProbe"
        component={GpuProbe}
        durationInFrames={1}
        fps={30}
        width={1200}
        height={400}
      />
    </>
  );
};

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
  CosmicFlight,
  cosmicFlightSchema,
  cosmicFlightDefaults,
} from "./cosmos/CosmicFlight";
import {
  BASE_WIDTH as COSMOS_WIDTH,
  BASE_HEIGHT as COSMOS_HEIGHT,
  DURATION_IN_FRAMES as COSMOS_DURATION,
  FPS as COSMOS_FPS,
} from "./cosmos/constants";

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
      {/*
        Celestial flythrough. Each look ships as a matched 1080p / 4K
        pair: identical timing, seed and layout, so the 4K comp is a true
        higher-resolution render of the delivered 1080p file rather than
        a different shot. Everything in the scene is authored in
        resolution-independent units, and the nebula textures are baked
        larger at 4K, so the pair stays in sync automatically.
      */}
      <Composition
        id="CosmicFlight-Celestial-1080p"
        component={CosmicFlight}
        durationInFrames={COSMOS_DURATION}
        fps={COSMOS_FPS}
        width={COSMOS_WIDTH}
        height={COSMOS_HEIGHT}
        schema={cosmicFlightSchema}
        defaultProps={{ ...cosmicFlightDefaults, variant: "celestial" as const }}
      />
      <Composition
        id="CosmicFlight-Celestial-4K"
        component={CosmicFlight}
        durationInFrames={COSMOS_DURATION}
        fps={COSMOS_FPS}
        width={COSMOS_WIDTH * 2}
        height={COSMOS_HEIGHT * 2}
        schema={cosmicFlightSchema}
        defaultProps={{ ...cosmicFlightDefaults, variant: "celestial" as const }}
      />
      <Composition
        id="CosmicFlight-Violet-1080p"
        component={CosmicFlight}
        durationInFrames={COSMOS_DURATION}
        fps={COSMOS_FPS}
        width={COSMOS_WIDTH}
        height={COSMOS_HEIGHT}
        schema={cosmicFlightSchema}
        defaultProps={{ ...cosmicFlightDefaults, variant: "violet" as const }}
      />
      <Composition
        id="CosmicFlight-Violet-4K"
        component={CosmicFlight}
        durationInFrames={COSMOS_DURATION}
        fps={COSMOS_FPS}
        width={COSMOS_WIDTH * 2}
        height={COSMOS_HEIGHT * 2}
        schema={cosmicFlightSchema}
        defaultProps={{ ...cosmicFlightDefaults, variant: "violet" as const }}
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

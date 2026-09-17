import "./index.css";
import "./load-fonts";
import React from "react";
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
import { FlightGrid, flightGridSchema } from "./flight-grid/FlightGrid";
import {
  BASE_WIDTH as FLIGHT_WIDTH,
  BASE_HEIGHT as FLIGHT_HEIGHT,
  DURATION_IN_FRAMES as FLIGHT_DURATION,
  FPS as FLIGHT_FPS,
} from "./flight-grid/constants";

// The two airliner-over-a-wireframe-globe pieces. Each ships as a 4K
// master (the composition the project is authored at) plus a 1080p
// composition that renders the identical shot for delivery.
const FLIGHT_GRID_VERSIONS = [
  { id: "FlightGridV1", version: "one" as const },
  { id: "FlightGridV2", version: "two" as const },
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
      {FLIGHT_GRID_VERSIONS.map(({ id, version }) => (
        <React.Fragment key={id}>
          <Composition
            id={`${id}-4K`}
            component={FlightGrid}
            durationInFrames={FLIGHT_DURATION}
            fps={FLIGHT_FPS}
            width={FLIGHT_WIDTH * 2}
            height={FLIGHT_HEIGHT * 2}
            schema={flightGridSchema}
            defaultProps={{ version, resolutionScale: 2 }}
          />
          <Composition
            id={`${id}-1080p`}
            component={FlightGrid}
            durationInFrames={FLIGHT_DURATION}
            fps={FLIGHT_FPS}
            width={FLIGHT_WIDTH}
            height={FLIGHT_HEIGHT}
            schema={flightGridSchema}
            defaultProps={{ version, resolutionScale: 1 }}
          />
        </React.Fragment>
      ))}
    </>
  );
};

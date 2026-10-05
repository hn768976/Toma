import React from "react";
import { Composition } from "remotion";
import { NeonRibbons, RIBBONS_LOOP } from "./looks/ribbons/NeonRibbons";
import { HoloCity, HOLO_LOOP } from "./looks/holocity/HoloCity";
import { CircuitChip, CIRCUIT_FRAMES } from "./looks/circuit/CircuitChip";
import { CIRCUIT_VERSIONS, HOLO_VERSIONS, RIBBONS_VERSIONS } from "./versions";

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const RemotionRoot: React.FC = () => (
  <>
    {CIRCUIT_VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={CircuitChip}
        durationInFrames={CIRCUIT_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ version: v }}
      />
    ))}
    {HOLO_VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={HoloCity}
        durationInFrames={HOLO_LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ version: v }}
      />
    ))}
    {RIBBONS_VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={NeonRibbons}
        durationInFrames={RIBBONS_LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ version: v }}
      />
    ))}
  </>
);

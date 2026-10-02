import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { NEURAL_VERSIONS } from "./looks/neural/versions";
import { NeuralLayers } from "./looks/neural/NeuralLayers";
import { NIGHTSKY_VERSIONS } from "./looks/nightsky/versions";
import { NightSkyMeteor } from "./looks/nightsky/NightSkyMeteor";
import { ICON_VERSIONS } from "./looks/icons/versions";
import { IconNetwork, ICON_FRAMES } from "./looks/icons/IconNetwork";
import { DUST_VERSIONS } from "./looks/dust/versions";
import { DustSmoke } from "./looks/dust/DustSmoke";
import { DATA_VERSIONS } from "./looks/data/versions";
import { DataPanels } from "./looks/data/DataPanels";

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

// durationOverride lets the loop check render 601 frames (frame 600 must equal frame 0).
type Props<V> = { version: V; durationOverride?: number };
const withDuration =
  <V,>(frames: number): CalculateMetadataFunction<Props<V>> =>
  ({ props }) => ({ durationInFrames: props.durationOverride ?? frames });

function register<V extends { id: string }>(
  versions: V[],
  component: React.FC<Props<V>>,
  frames: number,
) {
  return versions.map((v) => (
    <Composition
      key={v.id}
      id={v.id}
      component={component}
      defaultProps={{ version: v }}
      calculateMetadata={withDuration<V>(frames)}
      durationInFrames={frames}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  ));
}

export const RemotionRoot: React.FC = () => (
  <>
    {register(NEURAL_VERSIONS, NeuralLayers, 600)}
    {register(DUST_VERSIONS, DustSmoke, 600)}
    {register(DATA_VERSIONS, DataPanels, 600)}
    {register(NIGHTSKY_VERSIONS, NightSkyMeteor, 600)}
    {register(ICON_VERSIONS, IconNetwork, ICON_FRAMES)}
  </>
);

import React from "react";
import { Composition } from "remotion";
import { Stage } from "./lib/Stage";
import { LOOP } from "./lib/rng";
import { VERSIONS, type VersionRow } from "./versions";
import { buildSummit } from "./looks/summit";
import { buildSilk } from "./looks/silk";
import { buildTunnel } from "./looks/tunnel";
import { buildEarth } from "./looks/earth";
import { buildBrain } from "./looks/brain";

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

type Props = { row: VersionRow; durationOverride?: number };

const Look: React.FC<Props> = ({ row }) => {
  switch (row.look) {
    case "summit":
      return <Stage factory={buildSummit} params={row.params} />;
    case "silk":
      return <Stage factory={buildSilk} params={row.params} />;
    case "tunnel":
      return <Stage factory={buildTunnel} params={row.params} />;
    case "earth":
      return <Stage factory={buildEarth} params={row.params} />;
    case "brain":
      return <Stage factory={buildBrain} params={row.params} />;
  }
};

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((row) => (
      <Composition
        key={row.id}
        id={row.id}
        component={Look}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        durationInFrames={LOOP}
        defaultProps={{ row } as Props}
        // `--props='{"durationOverride":601}'` for the loop check (frame 600 vs 0)
        calculateMetadata={({ props }) => ({ durationInFrames: props.durationOverride ?? LOOP })}
      />
    ))}
  </>
);

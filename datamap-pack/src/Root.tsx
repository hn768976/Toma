import React from "react";
import { Composition } from "remotion";
import { VERSIONS, VersionRow } from "./versions";
import { SoftGradient } from "./looks/SoftGradient";
import { WirePeaks } from "./looks/WirePeaks";
import { PlexusGlobe } from "./looks/PlexusGlobe";
import { CircuitWarp } from "./looks/CircuitWarp";
import { DataMap } from "./looks/DataMap";

export const WIDTH = 3840;
export const HEIGHT = 2160;
export const FPS = 30;
export const FRAMES = 600;

type Props = { loopCheck: boolean };

const Look: React.FC<{ row: VersionRow }> = ({ row }) => {
  switch (row.look) {
    case "softgradient":
      return <SoftGradient row={row} />;
    case "datamap":
      return <DataMap row={row} />;
    case "circuitwarp":
      return <CircuitWarp row={row} />;
    case "plexus":
      return <PlexusGlobe row={row} />;
    case "wirepeaks":
      return <WirePeaks row={row} />;
  }
};

// One stable component per row (created once, not on every render).
const COMPONENTS: Record<string, React.FC<Props>> = Object.fromEntries(
  VERSIONS.map((row) => [row.id, () => <Look row={row} />]),
);

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((row) => (
      <Composition
        key={row.id}
        id={row.id}
        component={COMPONENTS[row.id]}
        width={WIDTH}
        height={HEIGHT}
        fps={FPS}
        durationInFrames={FRAMES}
        defaultProps={{ loopCheck: false } as Props}
        // `--props='{"loopCheck":true}'` adds frame 600 for the loop check
        // (frame 600 must equal frame 0 pixel for pixel).
        calculateMetadata={({ props }) => ({
          durationInFrames: props.loopCheck ? FRAMES + 1 : FRAMES,
        })}
      />
    ))}
  </>
);

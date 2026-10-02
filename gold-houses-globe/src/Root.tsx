import React from "react";
import { Composition } from "remotion";
import { Stage } from "./lib/Stage";
import type { Look } from "./lib/look";
import { LowPolyLuxe } from "./looks/LowPolyLuxe";
import { CloudUpload } from "./looks/CloudUpload";
import { PriceHouses } from "./looks/PriceHouses";
import { NetworkGrowth } from "./looks/NetworkGrowth";
import { ConnectedGlobe } from "./looks/ConnectedGlobe";
import { CLOUD, GLOBE, HOUSES, LOW_POLY, NETWORK, type Version } from "./versions";

const FPS = 30;
const W = 3840;
const H = 2160;
const LOOP = 600;

// `--props='{"loopCheck":true}'` renders a looping composition one frame
// longer (601) so frame 600 can be compared with frame 0.
type Props = { loopCheck?: boolean };

function comps<P>(look: Look<P>, rows: Version<P>[], frames: number, loops: boolean) {
  return rows.map((row) => {
    const C: React.FC<Props> = () => <Stage look={look} params={row.params} period={LOOP} />;
    return (
      <Composition
        key={row.id}
        id={row.id}
        component={C}
        fps={FPS}
        width={W}
        height={H}
        durationInFrames={frames}
        defaultProps={{ loopCheck: false } as Props}
        calculateMetadata={({ props }) => ({ durationInFrames: loops && props.loopCheck ? frames + 1 : frames })}
      />
    );
  });
}

export const RemotionRoot: React.FC = () => (
  <>
    {comps(LowPolyLuxe, LOW_POLY, LOOP, true)}
    {comps(CloudUpload, CLOUD, LOOP, true)}
    {comps(PriceHouses, HOUSES, LOOP, true)}
    {comps(NetworkGrowth, NETWORK, 450, false)}
    {comps(ConnectedGlobe, GLOBE, LOOP, true)}
  </>
);

import React from "react";
import { Composition } from "remotion";
import { loadFonts } from "./lib/fonts";
import { LOOP, FPS } from "./lib/loop";
import { CityHUD } from "./looks/CityHUD";
import { CityTracker } from "./looks/CityTracker";
import { CityFlyover } from "./looks/CityFlyover";
import { WorldConnections } from "./looks/WorldConnections";
import { HUDGlobe } from "./looks/HUDGlobe";
import { TopoContours } from "./looks/TopoContours";
import { VERSIONS } from "./versions";

loadFonts();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const LOOKS: Record<string, React.FC<any>> = {
  CityHUD,
  CityTracker,
  CityFlyover,
  WorldConnections,
  HUDGlobe,
  TopoContours,
};

// `loopCheck: true` makes a composition 601 frames long so frame 600 can be
// rendered and compared with frame 0.
export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.filter((v) => LOOKS[v.look]).map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={LOOKS[v.look]}
        durationInFrames={LOOP}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ ...v.props, loopCheck: false }}
        calculateMetadata={({ props }) => ({ durationInFrames: props.loopCheck ? LOOP + 1 : LOOP })}
      />
    ))}
  </>
);

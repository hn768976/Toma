import React from "react";
import { GalaxyColours } from "../colourways";
import { Stage } from "../lib/Stage";
import { useLookFactory } from "../lib/useLookFactory";
import { GALAXY_LOOP, GALAXY_POST, GalaxyLook } from "../looks/galaxy";

export const GALAXY_FRAMES = GALAXY_LOOP;

export const GalaxySpiral: React.FC<{ colours: GalaxyColours; loopCheck?: boolean; noWrap?: boolean }> = ({ colours, noWrap }) => {
  const create = useLookFactory(colours, (c) => new GalaxyLook(c));
  return <Stage create={create} post={GALAXY_POST} loopFrames={GALAXY_LOOP} noWrap={noWrap} />;
};

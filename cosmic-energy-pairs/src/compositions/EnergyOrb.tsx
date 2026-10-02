import React from "react";
import { OrbColours } from "../colourways";
import { Stage } from "../lib/Stage";
import { useLookFactory } from "../lib/useLookFactory";
import { ORB_LOOP, ORB_POST, OrbLook } from "../looks/orb";

export const ORB_FRAMES = ORB_LOOP;

export const EnergyOrb: React.FC<{ colours: OrbColours; loopCheck?: boolean; noWrap?: boolean }> = ({ colours, noWrap }) => {
  const create = useLookFactory(colours, (c) => new OrbLook(c));
  return <Stage create={create} post={ORB_POST} loopFrames={ORB_LOOP} noWrap={noWrap} />;
};

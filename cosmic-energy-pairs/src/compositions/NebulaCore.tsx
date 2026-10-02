import React from "react";
import { NebulaColours } from "../colourways";
import { Stage } from "../lib/Stage";
import { useLookFactory } from "../lib/useLookFactory";
import { NEBULA_LOOP, NEBULA_POST, NebulaLook } from "../looks/nebula";

export const NEBULA_FRAMES = NEBULA_LOOP;

export const NebulaCore: React.FC<{ colours: NebulaColours; loopCheck?: boolean; noWrap?: boolean }> = ({ colours, noWrap }) => {
  const create = useLookFactory(colours, (c) => new NebulaLook(c));
  return <Stage create={create} post={NEBULA_POST} loopFrames={NEBULA_LOOP} noWrap={noWrap} />;
};

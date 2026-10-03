import React from "react";
import { AbsoluteFill } from "remotion";
import { Stage } from "../shared/stage";
import { Labels } from "./Labels";
import { SpaceScene } from "./SpaceScene";

export type SpaceProps = {
  /** 2B: star names, leader lines and the distance counter. */
  labels: boolean;
};

export const SunToAlphaCentauri: React.FC<SpaceProps> = ({ labels }) => (
  <AbsoluteFill style={{ backgroundColor: "black" }}>
    <Stage>
      <SpaceScene />
    </Stage>
    {labels ? <Labels /> : null}
  </AbsoluteFill>
);

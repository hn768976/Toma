import React from "react";
import { AbsoluteFill } from "remotion";
import { GLStage } from "../gl/GLStage";
import { useInterReady } from "../lib/fonts";
import { conveyorFactory } from "./stage";

const make = (key: string) => {
  const factory = conveyorFactory(key);
  const C: React.FC = () => {
    const ready = useInterReady(); // label text is drawn with Inter
    return <AbsoluteFill style={{ backgroundColor: "#000" }}>{ready ? <GLStage factory={factory} /> : null}</AbsoluteFill>;
  };
  return C;
};

export const ParcelConveyorSideView = make("side");

import React from "react";
import { AbsoluteFill } from "remotion";
import { GLStage } from "../gl/GLStage";
import { useInterReady } from "../lib/fonts";
import { aiFactory } from "./stage";

const storyFactory = aiFactory("story");
const loopFactory = aiFactory("loop");

export const AIQueryStory: React.FC = () => {
  const ready = useInterReady(); // "Ask Me Anything" is drawn with Inter
  return <AbsoluteFill style={{ backgroundColor: "#020818" }}>{ready ? <GLStage factory={storyFactory} /> : null}</AbsoluteFill>;
};
export const AIQueryFibreLoop: React.FC = () => {
  const ready = useInterReady();
  return <AbsoluteFill style={{ backgroundColor: "#020818" }}>{ready ? <GLStage factory={loopFactory} /> : null}</AbsoluteFill>;
};

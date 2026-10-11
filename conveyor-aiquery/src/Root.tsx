import React from "react";
import { Composition } from "remotion";
import { AIQueryFibreLoop, AIQueryStory } from "./aiquery/compositions";

const W = 3840, H = 2160, FPS = 30;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="AIQuery-Story" component={AIQueryStory} durationInFrames={450} fps={FPS} width={W} height={H} />
    <Composition id="AIQuery-FibreLoop" component={AIQueryFibreLoop} durationInFrames={600} fps={FPS} width={W} height={H} />
  </>
);

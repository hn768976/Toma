import React from "react";
import "./load-fonts";
import { Composition } from "remotion";
import { ElementCard } from "./ElementCard";
import { ALL_COMPOSITIONS } from "./compositions";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

export const RemotionRoot: React.FC = () => (
  <>
    {ALL_COMPOSITIONS.map(({ id, element, style }) => (
      <Composition
        key={id}
        id={id}
        component={ElementCard}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ element, style }}
      />
    ))}
  </>
);

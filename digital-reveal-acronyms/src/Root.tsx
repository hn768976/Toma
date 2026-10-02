import React from "react";
import { Composition } from "remotion";
import { ACRONYMS } from "./acronyms";
import { DURATION, FPS, HEIGHT, WIDTH } from "./config";
import { Reveal } from "./Reveal";

export const RemotionRoot: React.FC = () => (
  <>
    {ACRONYMS.map((word) => (
      <Composition
        key={word}
        id={`Reveal-${word}`}
        component={Reveal}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ word }}
      />
    ))}
  </>
);

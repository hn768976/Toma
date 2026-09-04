import React from "react";
import { Composition } from "remotion";
import "./load-fonts";
import { DeparturesLCD } from "./DeparturesLCD";
import { DeparturesSplitFlap } from "./DeparturesSplitFlap";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./board/constants";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="DeparturesLCD"
      component={DeparturesLCD}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    <Composition
      id="DeparturesSplitFlap"
      component={DeparturesSplitFlap}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </>
);

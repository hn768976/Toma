import React from "react";
import { Composition } from "remotion";
import { LIB_DEMO_DURATION, LibDemo, PANELS, PANEL_DURATION } from "./LibDemo";

const WIDTH = 1920;
const HEIGHT = 1080;
const FPS = 30;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="LibDemo"
      component={LibDemo}
      durationInFrames={LIB_DEMO_DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
    {PANELS.map(({ id, component }) => (
      <Composition
        key={id}
        id={id}
        component={component}
        durationInFrames={PANEL_DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
  </>
);

import React from "react";
import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";
import { WashiMotif, washiMotifDefaultProps } from "./WashiMotif";
import { ContactSheet, contactSheetSize } from "./ContactSheet";

const sheet = contactSheetSize();

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/*
        A STILL. durationInFrames is 1: there is no animation, no loop and no
        timing anywhere in this project.
      */}
      <Composition
        id="WashiMotif"
        component={WashiMotif}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={washiMotifDefaultProps}
      />
      <Composition
        id="ContactSheet"
        component={ContactSheet}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={sheet.width}
        height={sheet.height}
      />
    </>
  );
};

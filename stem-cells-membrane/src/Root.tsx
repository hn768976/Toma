import React from "react";
import { Composition } from "remotion";
import { ThreeStage } from "./engine/ThreeStage";
import { AZURE, ORCHID } from "./scene/palettes";
import { stemCellsFactory, StemParams } from "./scene/stemCells";

// Reference clip: 9.96 s. At 30 fps that is 298.8 frames, so the nearest
// whole frame count is used: 299 frames = 9.967 s.
const FPS = 30;
const DURATION = 299;
const WIDTH = 3840;
const HEIGHT = 2160;

const V1: StemParams = { palette: AZURE };
const V2: StemParams = { palette: ORCHID };

const Version1: React.FC = () => (
  <ThreeStage factory={stemCellsFactory} params={V1} />
);
const Version2: React.FC = () => (
  <ThreeStage factory={stemCellsFactory} params={V2} />
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="StemCells-V1-ReferenceMatch"
        component={Version1}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="StemCells-V2-OrchidPalette"
        component={Version2}
        durationInFrames={DURATION}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};

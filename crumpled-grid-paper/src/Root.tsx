import React from "react";
import { Composition } from "remotion";
import {
  CrumpledGridPaper,
  crumpledGridPaperSchema,
  type CrumpledGridPaperProps,
} from "./paper/CrumpledGridPaper";

// 4K UHD master compositions, 30 fps, 9.6 s (= reference length).
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION_IN_FRAMES = 288;

// Version 1: charcoal graph paper with light-grey ink, as in the reference.
const v1Props: CrumpledGridPaperProps = {
  paperColor: [0.108, 0.108, 0.108],
  lineColor: [0.37, 0.37, 0.37],
  shadowTint: [1, 1, 1],
  gridColumns: 38,
};

// Version 2: alternative palette - architectural blueprint (deep cyanotype
// blue sheet with pale cyan ink). Same sheet, folds and stop-motion timing.
const v2Props: CrumpledGridPaperProps = {
  paperColor: [0.055, 0.19, 0.42],
  lineColor: [0.56, 0.8, 0.93],
  shadowTint: [0.72, 0.8, 1.0],
  gridColumns: 38,
};

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="CrumpledGridPaper-V1"
        component={CrumpledGridPaper}
        schema={crumpledGridPaperSchema}
        defaultProps={v1Props}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="CrumpledGridPaper-V2"
        component={CrumpledGridPaper}
        schema={crumpledGridPaperSchema}
        defaultProps={v2Props}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    </>
  );
};

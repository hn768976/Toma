import "./styles.css";
import React from "react";
import { Composition } from "remotion";
import { OperationsMatrix } from "./matrix/OperationsMatrix";
import { ProcessingPipeline } from "./pipeline/ProcessingPipeline";
import { FPS } from "./shared/theme";

/** 20.0s and 15.0s at 30fps — the runtimes of the two reference clips. */
const MATRIX_FRAMES = 600;
const PIPELINE_FRAMES = 450;

const HD = { width: 1920, height: 1080 };
const UHD = { width: 3840, height: 2160 };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="OperationsMatrix4K"
      component={OperationsMatrix}
      durationInFrames={MATRIX_FRAMES}
      fps={FPS}
      {...UHD}
    />
    <Composition
      id="OperationsMatrix1080"
      component={OperationsMatrix}
      durationInFrames={MATRIX_FRAMES}
      fps={FPS}
      {...HD}
    />
    <Composition
      id="ProcessingPipeline4K"
      component={ProcessingPipeline}
      durationInFrames={PIPELINE_FRAMES}
      fps={FPS}
      {...UHD}
    />
    <Composition
      id="ProcessingPipeline1080"
      component={ProcessingPipeline}
      durationInFrames={PIPELINE_FRAMES}
      fps={FPS}
      {...HD}
    />
  </>
);

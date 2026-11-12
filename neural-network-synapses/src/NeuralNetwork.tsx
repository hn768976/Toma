import React from "react";
import { ThreeStage } from "./engine/ThreeStage";
import { neuralScene, NeuralProps } from "./neural/scene";
import { EMBER_PALETTE, REFERENCE_PALETTE } from "./neural/palettes";

const V1: NeuralProps = { palette: REFERENCE_PALETTE };
const V2: NeuralProps = { palette: EMBER_PALETTE };

/** Version 1 – silver glass neurons with cyan impulses (reference match). */
export const NeuralNetworkV1: React.FC = () => (
  <ThreeStage factory={neuralScene} sceneProps={V1} background={V1.palette.css} />
);

/** Version 2 – same shot, alternative rose-gold / amber colour palette. */
export const NeuralNetworkV2: React.FC = () => (
  <ThreeStage factory={neuralScene} sceneProps={V2} background={V2.palette.css} />
);

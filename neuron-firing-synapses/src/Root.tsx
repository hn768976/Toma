import React from "react";
import { Composition } from "remotion";
import { NeuronCanvas } from "./engine/NeuronCanvas";
import { firingV1, firingV2 } from "./scenes/firing";

// 4K UHD master compositions, 30 fps, 300 frames = exactly 10.000 s (same as the reference clip).
const WIDTH = 3840;
const HEIGHT = 2160;
const FPS = 30;
const DURATION_IN_FRAMES = 300;

const V1: React.FC = () => <NeuronCanvas scene={firingV1} />;
const V2: React.FC = () => <NeuronCanvas scene={firingV2} />;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="FiringNeuron-V1" component={V1} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={DURATION_IN_FRAMES} />
      <Composition id="FiringNeuron-V2" component={V2} width={WIDTH} height={HEIGHT} fps={FPS} durationInFrames={DURATION_IN_FRAMES} />
    </>
  );
};

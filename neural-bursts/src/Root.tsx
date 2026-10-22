import React from "react";
import { Composition, Folder } from "remotion";
import { NeuralBurst, neuralBurstSchema } from "./burst/NeuralBurst";
import { NeuronFiring, neuronFiringSchema } from "./neuron/NeuronFiring";

// All masters are authored at 3840x2160 (UHD 4K), 30 fps.
// Durations match the reference clips:
//  * Composition 1 reference: 14.04 s -> 421 frames @ 30 fps (14.033 s; 30 fps
//    cannot hit 14.04 s exactly, 421 is the nearest whole frame).
//  * Composition 2 reference: 20.00 s -> 600 frames @ 30 fps.
export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;
export const BURST_FRAMES = 421;
export const NEURON_FRAMES = 600;

const MASTERS = [
  {
    id: "NeuralBurst-V1",
    component: NeuralBurst,
    frames: BURST_FRAMES,
    schema: neuralBurstSchema,
    props: { variant: "v1-reference" as const },
  },
  {
    id: "NeuralBurst-V2",
    component: NeuralBurst,
    frames: BURST_FRAMES,
    schema: neuralBurstSchema,
    props: { variant: "v2-solar" as const },
  },
  {
    id: "NeuronFiring-V1",
    component: NeuronFiring,
    frames: NEURON_FRAMES,
    schema: neuronFiringSchema,
    props: { variant: "v1-reference" as const },
  },
  {
    id: "NeuronFiring-V2",
    component: NeuronFiring,
    frames: NEURON_FRAMES,
    schema: neuronFiringSchema,
    props: { variant: "v2-orbit" as const },
  },
];

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Masters-4K">
        {MASTERS.map((m) => (
          <Composition
            key={m.id}
            id={m.id}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            component={m.component as React.FC<any>}
            durationInFrames={m.frames}
            fps={FPS}
            width={WIDTH}
            height={HEIGHT}
            schema={m.schema}
            defaultProps={m.props}
          />
        ))}
      </Folder>
      {/* Quarter-resolution previews of the same scenes (every size in the
          scenes is resolution independent) for fast iteration in the Studio. */}
      <Folder name="Previews-540p">
        {MASTERS.map((m) => (
          <Composition
            key={m.id}
            id={`${m.id}-Preview`}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            component={m.component as React.FC<any>}
            durationInFrames={m.frames}
            fps={FPS}
            width={WIDTH / 4}
            height={HEIGHT / 4}
            schema={m.schema}
            defaultProps={m.props}
          />
        ))}
      </Folder>
    </>
  );
};

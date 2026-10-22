import React from "react";
import { Composition, Folder } from "remotion";
import { z } from "zod";
import { BrainStage, type LookFactory } from "./engine/Stage";
import { modelCheckLook, type ModelView } from "./looks/modelCheck";
import { makeFibreLook } from "./looks/fibreLight";
import { glassLook } from "./looks/glass";
import { membraneLook } from "./looks/membrane";
import { orbitLook } from "./looks/orbit";
import { makeSolidLook } from "./looks/solid";

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

// One row per composition. Remotion ids cannot contain "_", so ids use "-";
// the rendered files use the delivery names with "_" (see scripts/render-previews.sh).
// One row per composition. `loop: true` compositions are exact 600-frame
// loops; their `extraFrame` prop renders frame 600 too (601 frames) so the
// seam can be checked (frame 600 must equal frame 0).
type Row = { id: string; look: LookFactory; seconds: number; loop: boolean };

export const LOOKS: Row[] = [
  { id: "BrainMembrane-Violet", look: membraneLook, seconds: 20, loop: true },
  { id: "BrainFibre-LightReveal", look: makeFibreLook("reveal"), seconds: 10, loop: false },
  { id: "BrainFibre-LightLoop", look: makeFibreLook("loop"), seconds: 20, loop: true },
  { id: "BrainSolid-Black", look: makeSolidLook("black"), seconds: 20, loop: true },
  { id: "BrainSolid-Green", look: makeSolidLook("green"), seconds: 20, loop: true },
  { id: "BrainGlass-Thoughts", look: glassLook, seconds: 24, loop: false },
  { id: "BrainOrbit-DeepBlue", look: orbitLook, seconds: 20, loop: true },
];

const lookSchema = z.object({ extraFrame: z.boolean() });

const makeComponent = (look: LookFactory) => {
  const C: React.FC<z.infer<typeof lookSchema>> = () => <BrainStage look={look} />;
  return C;
};
const COMPONENTS = Object.fromEntries(LOOKS.map((r) => [r.id, makeComponent(r.look)]));

const modelChecks: Record<ModelView, LookFactory> = {
  side: modelCheckLook("side"),
  top: modelCheckLook("top"),
  threeQuarter: modelCheckLook("threeQuarter"),
};
const modelCheckSchema = z.object({ view: z.enum(["side", "top", "threeQuarter"]) });
const ModelCheck: React.FC<z.infer<typeof modelCheckSchema>> = ({ view }) => <BrainStage look={modelChecks[view]} />;

export const BrainPackCompositions: React.FC = () => (
  <Folder name="BrainPack">
    {LOOKS.map((r) => (
      <Composition
        key={r.id}
        id={r.id}
        component={COMPONENTS[r.id]}
        schema={lookSchema}
        defaultProps={{ extraFrame: false }}
        calculateMetadata={({ props }) => ({
          durationInFrames: r.seconds * FPS + (r.loop && props.extraFrame ? 1 : 0),
        })}
        durationInFrames={r.seconds * FPS}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
    ))}
    <Composition
      id="BrainModelCheck"
      component={ModelCheck}
      schema={modelCheckSchema}
      defaultProps={{ view: "side" as const }}
      durationInFrames={1}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  </Folder>
);

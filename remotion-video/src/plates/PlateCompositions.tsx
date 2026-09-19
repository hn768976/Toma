import React from "react";
import { Composition, Folder } from "remotion";
import type { z } from "zod";
import {
  PLATE_FPS,
  HD_WIDTH,
  HD_HEIGHT,
  UHD_WIDTH,
  UHD_HEIGHT,
  PLATE_SPECS,
  type PlateId,
} from "./shared/constants";
import { GoldenRays, goldenRaysSchema, goldenRaysDefaults } from "./golden-rays/GoldenRays";
import { SilverBokeh, silverBokehSchema, silverBokehDefaults } from "./silver-bokeh/SilverBokeh";
import { DeepBlueDust, deepBlueDustSchema, deepBlueDustDefaults } from "./deep-blue-dust/DeepBlueDust";
import { BokehCurtain, bokehCurtainSchema, bokehCurtainDefaults } from "./bokeh-curtain/BokehCurtain";

/**
 * Registers each plate twice: once at 1080p and once at 4K.
 *
 * The two share a component, a schema and a props object - the only
 * difference is the frame size. The shaders measure every length in
 * 1080p-referred pixels and multiply by `uScale` (derived from the
 * output width), so the 4K composition is the same image at twice the
 * sample rate rather than a differently-composed one. That is what lets
 * the 1080p deliverable stand in for a 4K master rendered later.
 */
function PlatePair<S extends z.ZodObject<z.ZodRawShape>>({
  id,
  component,
  schema,
  defaultProps,
}: {
  id: PlateId;
  component: React.FC<z.infer<S>>;
  schema: S;
  defaultProps: z.infer<S>;
}) {
  const spec = PLATE_SPECS[id];
  const shared = {
    component,
    durationInFrames: spec.durationInFrames,
    fps: PLATE_FPS,
    schema,
    defaultProps,
  } as const;

  return (
    <Folder name={id}>
      <Composition id={id} {...shared} width={HD_WIDTH} height={HD_HEIGHT} />
      <Composition id={`${id}4K`} {...shared} width={UHD_WIDTH} height={UHD_HEIGHT} />
    </Folder>
  );
}

export const PlateCompositions: React.FC = () => (
  <>
    <PlatePair
      id="GoldenRays"
      component={GoldenRays}
      schema={goldenRaysSchema}
      defaultProps={goldenRaysDefaults}
    />
    <PlatePair
      id="SilverBokeh"
      component={SilverBokeh}
      schema={silverBokehSchema}
      defaultProps={silverBokehDefaults}
    />
    <PlatePair
      id="DeepBlueDust"
      component={DeepBlueDust}
      schema={deepBlueDustSchema}
      defaultProps={deepBlueDustDefaults}
    />
    <PlatePair
      id="BokehCurtain"
      component={BokehCurtain}
      schema={bokehCurtainSchema}
      defaultProps={bokehCurtainDefaults}
    />
  </>
);

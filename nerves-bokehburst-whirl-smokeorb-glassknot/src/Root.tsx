import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { LOOP_FRAMES, FPS } from "./lib/loop";
import { CosmicWhirl, WhirlVariant } from "./looks/whirl/CosmicWhirl";
import { BOKEH_VARIANTS, GLASSKNOT_VARIANTS, NERVE_VARIANTS, SMOKEORB_VARIANTS, WHIRL_VARIANTS } from "./variants";
import { SmokeOrb, SmokeOrbVariant } from "./looks/smokeorb/SmokeOrb";
import { BokehBurst, BokehVariant } from "./looks/bokeh/BokehBurst";
import { NerveFibres, NerveVariant } from "./looks/nerve/NerveFibres";
import { GlassKnot, GlassKnotVariant } from "./looks/glassknot/GlassKnot";

/**
 * Every composition is a 600-frame loop at 3840x2160. Pass
 * --props='{"loopCheck":true}' to get 601 frames (frame 600 must equal frame 0).
 *
 * Remotion composition ids may not contain "_", so a row named
 * "CosmicWhirl_Blue" is registered as "CosmicWhirl-Blue" (output files keep the underscore).
 */
export const compId = (name: string) => name.replace(/_/g, "-");

type LoopProps = { loopCheck?: boolean };
function calc<T extends LoopProps>(): CalculateMetadataFunction<T> {
  return ({ props }) => ({
    durationInFrames: props.loopCheck ? LOOP_FRAMES + 1 : LOOP_FRAMES,
  });
}

const common = {
  width: 3840,
  height: 2160,
  fps: FPS,
  durationInFrames: LOOP_FRAMES,
} as const;

export const RemotionRoot: React.FC = () => (
  <>
    {NERVE_VARIANTS.map((v) => (
      <Composition
        key={v.id}
        id={compId(v.id)}
        component={NerveFibres}
        defaultProps={{ variant: v, loopCheck: false }}
        calculateMetadata={calc<{ variant: NerveVariant; loopCheck?: boolean }>()}
        {...common}
      />
    ))}
    {BOKEH_VARIANTS.map((v) => (
      <Composition
        key={v.id}
        id={compId(v.id)}
        component={BokehBurst}
        defaultProps={{ variant: v, loopCheck: false }}
        calculateMetadata={calc<{ variant: BokehVariant; loopCheck?: boolean }>()}
        {...common}
      />
    ))}
    {WHIRL_VARIANTS.map((v) => (
      <Composition
        key={v.id}
        id={compId(v.id)}
        component={CosmicWhirl}
        defaultProps={{ variant: v, loopCheck: false }}
        calculateMetadata={calc<{ variant: WhirlVariant; loopCheck?: boolean }>()}
        {...common}
      />
    ))}
    {SMOKEORB_VARIANTS.map((v) => (
      <Composition
        key={v.id}
        id={compId(v.id)}
        component={SmokeOrb}
        defaultProps={{ variant: v, loopCheck: false }}
        calculateMetadata={calc<{ variant: SmokeOrbVariant; loopCheck?: boolean }>()}
        {...common}
      />
    ))}
    {GLASSKNOT_VARIANTS.map((v) => (
      <Composition
        key={v.id}
        id={compId(v.id)}
        component={GlassKnot}
        defaultProps={{ variant: v, loopCheck: false }}
        calculateMetadata={calc<{ variant: GlassKnotVariant; loopCheck?: boolean }>()}
        {...common}
      />
    ))}
  </>
);

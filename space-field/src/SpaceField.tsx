import React from "react";
import { AbsoluteFill } from "remotion";
import { BackgroundWash } from "./components/BackgroundWash";
import { CoreFlare } from "./components/CoreFlare";
import { DustClouds } from "./components/DustClouds";
import { FilmFinish } from "./components/FilmFinish";
import { ParticleLayer } from "./components/ParticleLayer";
import { VARIANTS, type VariantId } from "./variants";

export type SpaceFieldProps = {
  readonly variant: VariantId;
};

/**
 * All six versions render through this one component. The variant id selects a
 * configuration from VARIANTS; nothing else about the tree changes.
 *
 * Stacking order, bottom to top: background wash, dust, particles, core, and
 * the vignette/grain finish. The three light-emitting layers are composited
 * with `screen` so they add over what is underneath instead of occluding it.
 */
export const SpaceField: React.FC<SpaceFieldProps> = ({ variant }) => {
  const config = VARIANTS[variant];

  return (
    <AbsoluteFill style={{ backgroundColor: config.backgroundDeep, isolation: "isolate" }}>
      <BackgroundWash variant={config} />
      <DustClouds variant={config} />
      <ParticleLayer variant={config} />
      <CoreFlare variant={config} />
      <FilmFinish variant={config} />
    </AbsoluteFill>
  );
};

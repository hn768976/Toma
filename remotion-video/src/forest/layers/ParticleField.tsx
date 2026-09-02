import React from "react";
import { useVideoConfig } from "remotion";
import { ParticleDriftField } from "../../lib/ParticleDriftField";
import { DURATION_IN_FRAMES } from "../constants";
import { DRIFT } from "../drift";
import type { Palette, ParticleSettings } from "../variants";

/**
 * The airborne particles — rising flickering embers or falling drifting snow,
 * which are the same library field with an opposite `direction` and a
 * different behaviour profile. Nothing here tests the variant name.
 *
 * This layer and the ground glow are the only two that bloom; trees and fog
 * never do.
 */
export const ParticleField: React.FC<{
  settings: ParticleSettings;
  palette: Palette;
  seedPrefix: string;
}> = ({ settings, palette, seedPrefix }) => {
  const { height } = useVideoConfig();
  return (
    <ParticleDriftField
      behaviour={settings}
      tones={[palette.particleHot, palette.particleMid, palette.particleCool]}
      seed={`${seedPrefix}-air`}
      // Overshoot the frame at both ends so particles are fully faded by the
      // time they reach the visible edge.
      spanTop={-height * 0.14}
      spanHeight={height * 1.28}
      driftAmount={DRIFT.particles}
      loopFrames={DURATION_IN_FRAMES}
    />
  );
};

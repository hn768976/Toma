import React from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { CoreGlow } from "./CoreGlow";
import { GradientBackground } from "./GradientBackground";
import { ParticleSwarm } from "./ParticleSwarm";
import { THEMES } from "./theme";

export const particleFieldSchema = z.object({
  variant: z.enum(["burst", "implosion"]),
});

export type ParticleFieldProps = z.infer<typeof particleFieldSchema>;

export const particleBurstDefaults: ParticleFieldProps = { variant: "burst" };
export const particleImplosionDefaults: ParticleFieldProps = {
  variant: "implosion",
};

/**
 * Both versions of the piece. `variant` selects a timeline out of VARIANTS —
 * including its radialDirection, the one signed value that decides whether
 * this is a burst or an implosion.
 *
 * Three stacked canvases: the static gradient field, the swarm (drawn
 * additively into a transparent layer and composited normally), and the
 * central glow (composited with plus-lighter so a flash genuinely blows out).
 */
export const ParticleField: React.FC<ParticleFieldProps> = ({ variant }) => {
  const theme = THEMES[variant];
  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.backgroundDeep,
        isolation: "isolate",
      }}
    >
      <GradientBackground variant={variant} />
      <ParticleSwarm variant={variant} />
      <CoreGlow variant={variant} />
    </AbsoluteFill>
  );
};

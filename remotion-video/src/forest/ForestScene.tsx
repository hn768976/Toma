import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { z } from "zod";
import { VARIANTS } from "./variants";
import type { VariantName } from "./variants";
import { useTreeSprites } from "./useTreeSprites";
import { SkyWash } from "./layers/SkyWash";
import { TreeField } from "./layers/TreeField";
import { FogLayer } from "./layers/FogLayer";
import { GroundGlow } from "./layers/GroundGlow";
import { ParticleField } from "./layers/ParticleField";
import { FinishPass } from "./layers/FinishPass";

export const forestSceneSchema = z.object({
  variant: z.enum(["ember", "frost"]),
});

export const forestSceneDefaults: z.infer<typeof forestSceneSchema> = {
  variant: "ember",
};

const VIGNETTE_STRENGTH = 0.26;
const GRAIN_ALPHA = 0.05;

/**
 * Both compositions render this one component; `variant` selects a row of the
 * VARIANTS table and nothing else differs.
 *
 * The layer order below is the whole composition. Note where the two fog
 * layers sit: one behind the mid trees, one in front of them and behind the
 * near ones, and none in front of the near band. Interleaving the haze
 * between the depth bands is what produces the sense of depth — far more than
 * the per-band blur does.
 *
 * The ground glow sits in front of the near band — the embers are lying ON
 * the ground, so they light the near trunk bases — but it is confined tightly
 * to the bottom ~15% of the frame. Let it reach any higher and the additive
 * red washes the near trunks to a flat grey and the silhouette collapses.
 */
export const ForestScene: React.FC<z.infer<typeof forestSceneSchema>> = ({
  variant,
}) => {
  const { width, height } = useVideoConfig();
  const config = VARIANTS[variant as VariantName];
  const { palette, fog, particles, ground } = config;

  // Placement is seeded per variant name, so ember and frost are the same
  // forest photographed in two different seasons rather than two forests.
  const seedPrefix = "forest";
  const sprites = useTreeSprites(palette);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.skyDeep }}>
      <SkyWash palette={palette} />

      {sprites ? (
        <>
          <TreeField
            band="far"
            sprites={sprites}
            palette={palette}
            seedPrefix={seedPrefix}
            width={width}
            height={height}
          />
          <FogLayer
            depth="back"
            fog={fog}
            palette={palette}
            seedPrefix={seedPrefix}
            share={0.6}
            shaft
          />
          <TreeField
            band="mid"
            sprites={sprites}
            palette={palette}
            seedPrefix={seedPrefix}
            width={width}
            height={height}
          />
          <FogLayer
            depth="front"
            fog={fog}
            palette={palette}
            seedPrefix={seedPrefix}
            share={0.4}
          />
          <TreeField
            band="near"
            sprites={sprites}
            palette={palette}
            seedPrefix={seedPrefix}
            width={width}
            height={height}
          />
          <GroundGlow
            ground={ground}
            particleSettings={particles}
            palette={palette}
            seedPrefix={seedPrefix}
            width={width}
            height={height}
          />
          <TreeField
            band="foreground"
            sprites={sprites}
            palette={palette}
            seedPrefix={seedPrefix}
            width={width}
            height={height}
          />
        </>
      ) : null}

      <ParticleField
        settings={particles}
        palette={palette}
        seedPrefix={seedPrefix}
        width={width}
        height={height}
      />

      <FinishPass
        width={width}
        height={height}
        vignetteStrength={VIGNETTE_STRENGTH}
        grainAlpha={GRAIN_ALPHA}
      />
    </AbsoluteFill>
  );
};

import React from "react";
import { AbsoluteFill, staticFile } from "remotion";
import { z } from "zod";
import { SPRITE_HEIGHT, TINT_STEPS } from "./constants";
import { treeTintAt, VARIANTS } from "./variants";
import type { Palette, VariantName } from "./variants";
import { useSvgSprites } from "../lib/useSvgSprites";
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

// The forest layout is seeded per-project rather than per-variant, so ember
// and frost are the same forest photographed in two seasons, not two forests.
const SEED = "forest";

/**
 * Both compositions render this one component; `variant` selects a row of the
 * VARIANTS table and nothing else differs.
 *
 * The layer order below is the whole composition. Note where the two fog
 * layers sit: one behind the mid trees, one in front of them and behind the
 * near ones, and none in front of the near band. Interleaving the haze between
 * the depth bands is what produces the sense of depth — far more than the
 * per-band blur does.
 *
 * The ground glow sits in front of the near band, because the embers (or the
 * snow) lie ON the ground and so light the near trunk bases — but it is
 * confined tightly to the bottom ~15% of the frame. Let it reach any higher
 * and it washes the near trunks to a flat grey and the silhouette collapses.
 */
export const ForestScene: React.FC<z.infer<typeof forestSceneSchema>> = ({
  variant,
}) => {
  const { palette, sky, fog, particles, ground } = VARIANTS[variant as VariantName];

  const sprites = useSvgSprites({
    src: staticFile("tree.svg"),
    spriteHeight: SPRITE_HEIGHT,
    steps: TINT_STEPS,
    tintAt: React.useCallback(
      (t: number) => treeTintAt(palette as Palette, t),
      [palette],
    ),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: palette.skyDeep }}>
      <SkyWash palette={palette} sky={sky} />

      {sprites ? (
        <>
          <TreeField band="far" sprites={sprites} palette={palette} seedPrefix={SEED} />
          <FogLayer
            depth="back"
            fog={fog}
            palette={palette}
            seedPrefix={SEED}
            share={0.6}
            shaft
          />
          <TreeField band="mid" sprites={sprites} palette={palette} seedPrefix={SEED} />
          <FogLayer
            depth="front"
            fog={fog}
            palette={palette}
            seedPrefix={SEED}
            share={0.4}
          />
          <TreeField band="near" sprites={sprites} palette={palette} seedPrefix={SEED} />
          <GroundGlow
            ground={ground}
            particleSettings={particles}
            palette={palette}
            seedPrefix={SEED}
          />
          <TreeField
            band="foreground"
            sprites={sprites}
            palette={palette}
            seedPrefix={SEED}
          />
        </>
      ) : null}

      <ParticleField settings={particles} palette={palette} seedPrefix={SEED} />

      <FinishPass
        vignetteStrength={VIGNETTE_STRENGTH}
        grainAlpha={GRAIN_ALPHA}
      />
    </AbsoluteFill>
  );
};

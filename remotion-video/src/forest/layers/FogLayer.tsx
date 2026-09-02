import React from "react";
import { FogLayer as LibFogLayer } from "../../lib/FogLayer";
import { DURATION_IN_FRAMES } from "../constants";
import { DRIFT } from "../drift";
import type { FogSettings, Palette } from "../variants";

/**
 * Haze at one depth. Two of these are stacked — one behind the mid trees, one
 * in front of them and behind the near ones — and that interleaving is what
 * produces the sense of depth.
 *
 * Strata sit on the tree line rather than up in the sky; putting them higher
 * washes the whole upper third and flattens the scene.
 */
const STRATA = [0.44, 0.58, 0.72];

export const FogLayer: React.FC<{
  depth: "back" | "front";
  fog: FogSettings;
  palette: Palette;
  seedPrefix: string;
  /** Fraction of the total blob budget this layer carries. */
  share: number;
  shaft?: boolean;
}> = ({ depth, fog, palette, seedPrefix, share, shaft = false }) => (
  <LibFogLayer
    seed={`${seedPrefix}-fog-${depth}`}
    blobCount={Math.round(fog.blobCount * share)}
    strata={STRATA}
    color={palette.fogPale}
    tintColor={palette.groundGlow}
    tintAmount={fog.warmCast}
    opacity={fog.opacity}
    blur={fog.blur}
    driftAmount={depth === "back" ? DRIFT.fogBack : DRIFT.fogFront}
    loopFrames={DURATION_IN_FRAMES}
    shaft={
      shaft
        ? {
            color: palette.fogBright,
            opacity: fog.shaftOpacity,
            topLeft: 0.4,
            topRight: 0.62,
            bottomLeft: 0.66,
            bottomRight: 1.02,
            gradientTop: 0.52,
            gradientBottom: 0.86,
          }
        : null
    }
  />
);

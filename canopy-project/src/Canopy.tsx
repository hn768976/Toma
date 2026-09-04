import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Fog } from "./Fog";
import { Grain } from "./Grain";
import { useTreeMasks } from "./masks";
import { TREE_INSTANCES, VANISHING_POINT } from "./layout";
import { Bloom, Vignette } from "./Overlays";
import type { Palette } from "./palette";
import { loopBump, loopWave } from "./random";
import { Sky } from "./Sky";
import { Stars } from "./Stars";
import { Tree } from "./Tree";

/**
 * Total sweep of the whole arrangement, in degrees, out and back across the
 * loop. The reference barely moves; keeping this small is what makes the shot
 * read as a locked camera pointed upward rather than a graphic turntable.
 */
const ROTATION_DEGREES = 3.5;
/** Barely perceptible push toward the vanishing point, and back. */
const PUSH = 0.008;

const NEAR_TIERS = [0, 1];
const FAR_TIERS = [2, 3];

export const Canopy: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const masks = useTreeMasks();

  // Loop position. Dividing by the duration (not duration - 1) means frame 600
  // would land exactly back on frame 0, so the cut is seamless.
  const t = frame / durationInFrames;

  const rotation = ROTATION_DEGREES * loopWave(t, 1, 0);
  const scale = 1 + PUSH * loopBump(t, 1, 0);

  const arrangement: React.CSSProperties = {
    transformOrigin: `${VANISHING_POINT.x * width}px ${VANISHING_POINT.y * height}px`,
    transform: `rotate(${rotation}deg) scale(${scale})`,
  };

  const layer = (tiers: number[]) =>
    masks === null ? null : (
      <AbsoluteFill style={arrangement}>
        {TREE_INSTANCES.map((instance, i) =>
          tiers.includes(instance.tier) ? (
            <Tree
              key={i}
              instance={instance}
              mask={masks[instance.asset]}
              palette={palette}
              t={t}
              width={width}
              height={height}
            />
          ) : null,
        )}
      </AbsoluteFill>
    );

  return (
    <AbsoluteFill style={{ backgroundColor: palette.skyEdge, overflow: "hidden" }}>
      <Sky palette={palette} />
      {palette.stars ? <Stars t={t} /> : null}

      {/* Fog sits between the depth tiers, not on top of them. */}
      {layer(FAR_TIERS)}
      <Fog palette={palette} t={t} />
      {layer(NEAR_TIERS)}

      <Bloom palette={palette} />
      <Vignette palette={palette} />
      <Grain frame={frame} />
    </AbsoluteFill>
  );
};

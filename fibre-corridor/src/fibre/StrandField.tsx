import React, { useLayoutEffect, useMemo } from "react";
import {
  clearDepthBuffers,
  compositeDepthBuffers,
  createDepthBuffers,
  type DepthBuffers,
} from "../lib";
import { BLUR_FAR, BLUR_MID, BLUR_NEAR, HEIGHT, WIDTH } from "./constants";
import { computePositions } from "./geometry";
import { BendingStrand, type Buffers } from "./BendingStrand";
import { TravellingPacket } from "./TravellingPacket";
import type { Scene } from "./scene";

/**
 * Depth buckets, near to far. The near bucket is blurred so heavily that half
 * resolution is invisible, and blurring a 1920x1080 surface instead of a
 * 3840x2160 one is four times cheaper. Its gain is held back too: defocused
 * foreground light is spread thin, not concentrated.
 */
const BUCKETS = [
  { scale: 0.5, blur: BLUR_NEAR, gain: 0.45, halo: 18 },
  { scale: 1, blur: BLUR_MID, gain: 1, halo: 16 },
  { scale: 0.5, blur: BLUR_FAR, gain: 0.9, halo: 10 },
];

/** Clears the depth buffers and sets each one's device scale. Runs first. */
const BufferClear: React.FC<{ dof: DepthBuffers }> = ({ dof }) => {
  useLayoutEffect(() => {
    clearDepthBuffers(dof);
  });
  return null;
};

/**
 * Blurs each depth buffer exactly once and composites the three onto the
 * frame. This is where the depth of field lives: the focal band sits in the
 * mid distance, the nearest strands blur heavily and the horizon softens.
 */
const StrandComposite: React.FC<{ scene: Scene; dof: DepthBuffers }> = ({
  scene,
  dof,
}) => {
  useLayoutEffect(() => {
    compositeDepthBuffers(scene.main, dof);
  });
  return null;
};

/** The strand field: every strand and every packet, bucketed by depth. */
export const StrandField: React.FC<{ scene: Scene }> = ({ scene }) => {
  const dof = useMemo(() => createDepthBuffers(WIDTH, HEIGHT, BUCKETS), []);
  const buffers: Buffers = useMemo(() => ({ ctxs: dof.ctxs }), [dof]);

  // Pure per-frame geometry: the memoised base curves plus undulation and
  // camera drift. Nothing is regenerated.
  const positions = scene.strands.map((s) =>
    computePositions(s, scene.p, scene.camX, scene.camY),
  );

  return (
    <>
      <BufferClear dof={dof} />
      {scene.strands.map((strand, i) => (
        <BendingStrand
          key={strand.key}
          scene={scene}
          strand={strand}
          pos={positions[i]}
          buffers={buffers}
        />
      ))}
      {scene.strands.map((strand, i) =>
        strand.packets.map((packet, j) => (
          <TravellingPacket
            key={`${strand.key}-p${j}`}
            scene={scene}
            strand={strand}
            pos={positions[i]}
            packet={packet}
            buffers={buffers}
          />
        )),
      )}
      <StrandComposite scene={scene} dof={dof} />
    </>
  );
};

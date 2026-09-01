import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BackgroundWash } from "./BackgroundWash";
import { CellLayer } from "./CellLayer";
import { GrainPass } from "./GrainPass";
import { VignettePass } from "./VignettePass";
import { buildCells } from "./geometry";
import { LOOP_FRAMES, VARIANTS, type VariantName } from "./variants";

export type CellFieldProps = {
  variant: VariantName;
};

/**
 * Defocused cells. One component, two versions, driven entirely by VARIANTS.
 *
 * Every layer is a pure function of the current frame — no state, no
 * requestAnimationFrame, no Date.now — so any frame can be rendered in
 * isolation and `npx remotion render` is deterministic.
 */
export const CellField: React.FC<CellFieldProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const v = VARIANTS[variant];

  // Wrapping the frame here is what closes the loop: frame 450 produces
  // t = 0 exactly, so it is bit-for-bit the same input as frame 0.
  const loopFrame = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
  const t = loopFrame / LOOP_FRAMES;

  // The cell set is generated once and reused; per frame we only evaluate
  // drift, morph and rotation on top of it.
  const cells = useMemo(
    () => buildCells(v, variant, width, height),
    [v, variant, width, height],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: v.palette.background }}>
      <BackgroundWash variant={v} width={width} height={height} />
      <CellLayer
        variant={v}
        cells={cells}
        t={t}
        width={width}
        height={height}
      />
      {v.vignette > 0 ? (
        <VignettePass variant={v} width={width} height={height} />
      ) : null}
      <GrainPass
        variant={v}
        loopFrame={loopFrame}
        width={width}
        height={height}
      />
    </AbsoluteFill>
  );
};

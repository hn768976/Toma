import React, { useMemo } from "react";
import { clearance, openCentreRect, resolveMotifs } from "../render/motif";
import type { CompositionSpec } from "../types";
import type { Palette } from "../palettes";
import { MotifShape } from "./MotifShape";

/**
 * Walks the composition table and places every motif.
 *
 * The layout rule is not negotiable: motifs cluster on the frame's edges and
 * corners, many of them cropped by the frame, overlapping each other freely,
 * and none of them entering the open centre. The clearance is measured here
 * and reported, so a bad entry in the table shows up in the render log rather
 * than in the finished image.
 */
export const MotifLayout: React.FC<{
  width: number;
  height: number;
  composition: CompositionSpec;
  palette: Palette;
  /** Stage order of the first motif; motifs stack in table order above it. */
  baseOrder?: number;
  idPrefix?: string;
}> = ({ width, height, composition, palette, baseOrder = 10, idPrefix }) => {
  const instances = useMemo(
    () => resolveMotifs(composition, width, height),
    [composition, width, height],
  );

  const env = useMemo(
    () => ({ width, height, palette, composition }),
    [width, height, palette, composition],
  );

  useMemo(() => {
    const rect = openCentreRect(composition, width, height);
    let worst = Number.POSITIVE_INFINITY;
    for (const instance of instances) {
      const gap = clearance(instance, rect);
      if (gap < worst) worst = gap;
      if (gap < 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[washi] ${composition.id}: motif #${instance.index} (${instance.spec.motif})` +
            ` intrudes ${Math.abs(gap).toFixed(0)}px into the open centre`,
        );
      }
    }
    // eslint-disable-next-line no-console
    console.log(
      `[washi] ${composition.id} "${composition.label}": ${instances.length} motifs,` +
        ` open centre clear by ${worst.toFixed(0)}px`,
    );
  }, [instances, composition, width, height]);

  return (
    <>
      {instances.map((instance) => (
        <MotifShape
          key={instance.index}
          idPrefix={idPrefix}
          order={baseOrder + instance.index}
          instance={instance}
          env={env}
        />
      ))}
    </>
  );
};

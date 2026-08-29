import React, { useMemo } from "react";
import { PLACED_ELEMENTS } from "./layout";
import { ElementCell, type CellLayer } from "./ElementCell";
import { buildTimings, highlightIntensity, sparkAmounts } from "./motion";
import type { Variant } from "./variants";

export const TableGrid: React.FC<{
  variant: Variant;
  frame: number;
  fps: number;
  layer: CellLayer;
}> = ({ variant, frame, fps, layer }) => {
  const timings = useMemo(() => buildTimings(variant), [variant]);
  const paints = useMemo(
    () => PLACED_ELEMENTS.map((element) => variant.paintFor(element)),
    [variant],
  );
  const sparks = sparkAmounts(frame, PLACED_ELEMENTS.length);

  return (
    <g>
      {PLACED_ELEMENTS.map((element, index) => (
        <ElementCell
          key={element.atomicNumber}
          element={element}
          paint={paints[index]}
          variant={variant}
          timing={timings[index]}
          frame={frame}
          fps={fps}
          layer={layer}
          spark={sparks[index]}
          intensity={highlightIntensity(variant, frame, element.category)}
        />
      ))}
    </g>
  );
};

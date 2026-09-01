import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { VARIANTS } from "./variants";
import type { VariantName } from "./variants";
import { HEIGHT, WIDTH, buildPlane } from "./plane";
import { WorldBackdrop } from "./components/WorldBackdrop";
import { NumberGrid } from "./components/NumberGrid";
import { ChartLayer } from "./components/ChartLayer";
import { Finish } from "./components/Finish";

export type DataWallProps = { variant: VariantName };

/**
 * Both boards are this one component. Everything that differs between them —
 * palette, tilt, chart mix, grid density and, above all, which of the two mid
 * layers sits on top — is read from VARIANTS.
 */
export const DataWall: React.FC<DataWallProps> = ({ variant }) => {
  const config = VARIANTS[variant];
  const plane = useMemo(() => buildPlane(config), [config]);

  const numbers = (
    <NumberGrid key="numbers" plane={plane} config={config} variantKey={variant} />
  );
  const charts = (
    <ChartLayer key="charts" plane={plane} config={config} variantKey={variant} />
  );

  // The genuine draw-order branch. In "chartsFront" the grid is a backdrop and
  // the chart covers it opaquely; in "numbersFront" the chart runs behind and
  // the grid is laid over it, so the candles bleed through the gaps.
  const middle =
    config.layerOrder === "chartsFront" ? [numbers, charts] : [charts, numbers];

  return (
    <AbsoluteFill
      style={{
        width: WIDTH,
        height: HEIGHT,
        backgroundColor: config.palette.bgDeep,
        overflow: "hidden",
      }}
    >
      <WorldBackdrop plane={plane} config={config} variantKey={variant} />
      {middle}
      <Finish config={config} variantKey={variant} />
    </AbsoluteFill>
  );
};

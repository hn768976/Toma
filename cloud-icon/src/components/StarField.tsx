import React from "react";
import { interpolate } from "remotion";
import { StarField as LibStarField } from "../lib/StarField";
import { HEIGHT, STARS, WIDTH } from "../config";
import { layerStyle } from "../lib/canvas";
import type { Theme } from "../theme";

/** Binds the shared <StarField> to this project's palette and config. */
export const StarField: React.FC<{ frame: number; theme: Theme }> = ({ frame, theme }) => {
  const opacity = interpolate(frame, [6, 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <LibStarField
      frame={frame}
      width={WIDTH}
      height={HEIGHT}
      color={theme.starPale}
      seed="cloud-icon/stars"
      count={STARS.count}
      minRadius={STARS.minRadius}
      maxRadius={STARS.maxRadius}
      brightnessBias={2.4}
      twinklePeriodMin={STARS.twinklePeriodMin}
      twinklePeriodMax={STARS.twinklePeriodMax}
      style={layerStyle(3, opacity)}
    />
  );
};

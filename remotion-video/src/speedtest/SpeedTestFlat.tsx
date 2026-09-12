import React from "react";
import { AbsoluteFill } from "remotion";
import { PALETTE } from "./constants";
import { Dashboard } from "./Dashboard";
import { FLAT_THEME, MATTE_THEME, ThemeContext } from "./theme";

export type SpeedTestFlatProps = {
  /** Render the luma matte (white board on black) instead of the colour pass. */
  matte?: boolean;
};

/**
 * Version A - flat. Straight-on camera, solid fills, no glow: the board reads
 * as a clean UI illustration.
 */
export const SpeedTestFlat: React.FC<SpeedTestFlatProps> = ({
  matte = false,
}) => (
  <AbsoluteFill style={{ backgroundColor: matte ? "#000000" : PALETTE.bg }}>
    <ThemeContext.Provider value={matte ? MATTE_THEME : FLAT_THEME}>
      <Dashboard />
    </ThemeContext.Provider>
  </AbsoluteFill>
);

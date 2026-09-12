import { createContext, useContext } from "react";
import { PALETTE } from "./constants";

export type Theme = {
  /** Lit colour: arcs, needles, knob, big captions. */
  accent: string;
  /** Unlit dot / inactive element. */
  dim: string;
  /** Scale ticks and the hub ring. */
  tick: string;
  /** Min / Max / Mbps / PING micro-captions. */
  micro: string;
  pillTrack: string;
  pillTextOff: string;
};

export const FLAT_THEME: Theme = {
  accent: PALETTE.flat,
  dim: PALETTE.dim,
  tick: PALETTE.tick,
  micro: PALETTE.red,
  pillTrack: PALETTE.pillTrack,
  pillTextOff: PALETTE.pillTextOff,
};

export const NEON_THEME: Theme = {
  ...FLAT_THEME,
  accent: PALETTE.neon,
};

/**
 * Luma-matte theme: the same board drawn in greys on black, so the clip can be
 * keyed straight into an edit. Brightness matches each element's visual weight
 * in the colour pass.
 */
export const MATTE_THEME: Theme = {
  accent: "#FFFFFF",
  dim: "#3A3A3A",
  tick: "#6E6E6E",
  micro: "#C9C9C9",
  pillTrack: "#4A4A4A",
  pillTextOff: "#8A8A8A",
};

export const ThemeContext = createContext<Theme>(FLAT_THEME);

export const useTheme = () => useContext(ThemeContext);

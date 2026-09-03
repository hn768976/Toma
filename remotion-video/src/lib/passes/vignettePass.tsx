/**
 * <VignettePass> — corner darkening.
 *
 * Tinted with a supplied colour rather than black. On a strongly hued
 * background a black vignette greys the corners; the scene's own deep tone
 * darkens them without desaturating.
 */

import React from "react";
import { hexToRgba } from "../sprite";

export const VignettePass: React.FC<{
  /** `#RRGGBB`. Usually the darkest tone already in the frame. */
  color: string;
  /** Alpha at the corners. ~0.2 is a normal amount. */
  strength: number;
  /** Where the darkening starts, as a fraction of the radius. */
  innerStop?: number;
}> = ({ color, strength, innerStop = 0.4 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      pointerEvents: "none",
      background: `radial-gradient(ellipse 72% 72% at 50% 50%, ${hexToRgba(
        color,
        0,
      )} ${innerStop * 100}%, ${hexToRgba(color, strength)} 100%)`,
    }}
  />
);

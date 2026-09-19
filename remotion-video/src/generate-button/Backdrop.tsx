import React from "react";
import { BASE_HEIGHT, BASE_WIDTH } from "./constants";
import type { Theme } from "./theme";

/**
 * A 3x3 turbulence tile, inlined as a data URI. Browsers rasterise a
 * background-image once and reuse it, so this costs nothing per frame —
 * unlike an SVG filter, which would be re-evaluated over the full 4K canvas.
 */
const GRAIN = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)'/%3E%3C/svg%3E")`;

export const Backdrop: React.FC<{ theme: Theme; ambient: number }> = ({
  theme,
  ambient,
}) => (
  <>
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse ${BASE_WIDTH * 0.62}px ${
          BASE_HEIGHT * 0.78
        }px at 50% 50%, ${theme.bgInner} 0%, ${theme.bgOuter} 100%)`,
      }}
    />
    {/* The pool of light the button sits in. */}
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: BASE_WIDTH * 0.78,
        height: BASE_HEIGHT * 0.62,
        transform: "translate(-50%, -50%)",
        background: `radial-gradient(ellipse at 50% 50%, ${theme.ambient} 0%, transparent 68%)`,
        opacity: theme.ambientOpacity * ambient,
        mixBlendMode: theme.glowBlend,
      }}
    />
    {/* Vignette: pulls the corners down so the eye stays on the button. */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(ellipse ${BASE_WIDTH * 0.58}px ${
          BASE_HEIGHT * 0.72
        }px at 50% 50%, transparent 0%, ${theme.bgOuter} 100%)`,
        opacity: 0.25,
      }}
    />
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundImage: GRAIN,
        backgroundRepeat: "repeat",
        opacity: theme.grainOpacity,
        mixBlendMode: theme.glowBlend === "screen" ? "overlay" : "multiply",
      }}
    />
  </>
);

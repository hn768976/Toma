import React from "react";
import type { GradeSpec } from "./presets";

/** A small tiling turbulence patch, rasterised once and repeated. */
const grainTile = (opacity: number) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="140" height="140" filter="url(#n)" opacity="${opacity}"/></svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
};

type Props = {
  grade: GradeSpec;
  scale: number;
  seconds: number;
};

/**
 * Vignette and sensor grain, laid over the composited swarm. The grain
 * is a repeating tile nudged frame to frame rather than a live
 * turbulence pass, which keeps it free at 4K.
 */
export const Grade: React.FC<Props> = ({ grade, scale, seconds }) => {
  const jitter = Math.floor(seconds * 24);
  return (
    <>
      {grade.vignette > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `radial-gradient(72% 82% at 50% 48%, rgba(0,0,0,0) 38%, ${grade.vignetteColor} 100%)`,
            opacity: grade.vignette,
            pointerEvents: "none",
          }}
        />
      ) : null}
      {grade.grain > 0 ? (
        <div
          style={{
            position: "absolute",
            inset: `${-40 * scale}px`,
            backgroundImage: grainTile(1),
            backgroundRepeat: "repeat",
            backgroundSize: `${140 * scale}px ${140 * scale}px`,
            backgroundPosition: `${(jitter % 7) * 11 * scale}px ${
              (jitter % 5) * 13 * scale
            }px`,
            opacity: grade.grain,
            mixBlendMode: "overlay",
            pointerEvents: "none",
          }}
        />
      ) : null}
    </>
  );
};

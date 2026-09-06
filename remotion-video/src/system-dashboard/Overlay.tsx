import React, { useId } from "react";
import { useCurrentFrame } from "remotion";
import { rand } from "./random";

/**
 * Post overlays. All of them live inside the scaled design space so the
 * 1080p preview and the 4K render carry the same scanline pitch and grain
 * size rather than the same number of output pixels.
 *
 * The grain is an inline SVG pattern rather than a background image: it is
 * rasterised synchronously with the rest of the DOM, so no frame can be
 * captured before it is ready. Only a 320x320 tile is ever evaluated.
 */
export const Overlay: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const frame = useCurrentFrame();
  const uid = useId().replace(/:/g, "");
  const gx = Math.floor(rand(frame * 3 + 1) * 320);
  const gy = Math.floor(rand(frame * 3 + 2) * 320);
  return (
    <>
      {/* Scanlines, ~4%. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "repeating-linear-gradient(to bottom, rgba(255,255,255,0.04) 0px, rgba(255,255,255,0.04) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 6px)",
        }}
      />
      {/* Grain, ~2%. */}
      <svg
        width={w}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        style={{ position: "absolute", left: 0, top: 0, opacity: 0.02, mixBlendMode: "overlay" }}
      >
        <defs>
          <filter id={`gn-${uid}`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch" />
          </filter>
          <pattern
            id={`gt-${uid}`}
            width="320"
            height="320"
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${gx} ${gy})`}
          >
            <rect width="320" height="320" filter={`url(#gn-${uid})`} />
          </pattern>
        </defs>
        <rect width={w} height={h} fill={`url(#gt-${uid})`} />
      </svg>
      {/* Vignette. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(ellipse ${w * 0.72}px ${h * 0.78}px at 50% 50%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.42) 85%, rgba(0,0,0,0.66) 100%)`,
        }}
      />
    </>
  );
};

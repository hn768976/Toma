import React from "react";
import { AbsoluteFill } from "remotion";
import { DESIGN_WIDTH } from "../constants";
import type { Theme } from "../theme";

/** Tileable monochrome noise, as a data URI so nothing is fetched at render time. */
const GRAIN_TILE = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>` +
    `<filter id='g'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/>` +
    `<feColorMatrix type='saturate' values='0'/>` +
    `</filter>` +
    `<rect width='100%' height='100%' filter='url(#g)'/>` +
    `</svg>`,
)}")`;

const hash01 = (n: number) => {
  let x = Math.imul(n ^ 0x1b873593, 0x85ebca6b);
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
};

/**
 * Scanlines, grain and vignette. The grain is not decoration: a 14s hold on a
 * near-black gradient bands badly once it has been through H.264, and a couple
 * of percent of moving noise dithers those steps away. Judge it on the encoded
 * file, not in the studio preview.
 */
export const Overlays: React.FC<{ theme: Theme; frame: number; scale: number }> = ({
  frame,
  scale,
}) => {
  // Scanline pitch: 4 whole output pixels at 1080p, 8 at 4K.
  const scanPitch = Math.max(2, Math.round(8 * scale));
  const scanLine = scanPitch / 2;

  // The grain tile is re-seated every frame from a pure hash of the frame
  // number, so the noise crawls (and loops with the frame counter) without any
  // render-time randomness.
  const tile = Math.round(240 * scale);
  const gx = Math.floor(hash01(frame * 2 + 1) * tile);
  const gy = Math.floor(hash01(frame * 2 + 2) * tile);

  return (
    <>
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(0deg, rgba(0,0,0,0.9) 0 ${scanLine}px, rgba(0,0,0,0) ${scanLine}px ${scanPitch}px)`,
          opacity: 0.05,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: GRAIN_TILE,
          backgroundSize: `${tile}px ${tile}px`,
          backgroundPosition: `${gx}px ${gy}px`,
          backgroundRepeat: "repeat",
          mixBlendMode: "screen",
          opacity: 0.035,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${DESIGN_WIDTH * 0.62 * scale}px ${
            DESIGN_WIDTH * 0.5 * scale
          }px at 50% 48%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.42) 78%, rgba(0,0,0,0.72) 100%)`,
        }}
      />
    </>
  );
};

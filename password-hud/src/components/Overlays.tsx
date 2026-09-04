import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { rgba } from "../lib/color";
import { COLORS } from "../lib/design";
import { GRAIN_TILE_SIZE, grainTile } from "../lib/noise";
import { mulberry32 } from "../lib/random";
import { useScale } from "../lib/useScale";

/** Per-frame grain offsets, precomputed from a fixed seed. */
const GRAIN_OFFSETS: [number, number][] = (() => {
  const rng = mulberry32(0x9a17c3);
  return Array.from({ length: 400 }, () => [rng(), rng()] as [number, number]);
})();

/**
 * Screen-space finish: vignette, scanlines and grain. These sit outside the
 * perspective container so they stay square to the frame.
 */
export const Overlays: React.FC = () => {
  const frame = useCurrentFrame();
  const px = useScale();
  const tile = px(GRAIN_TILE_SIZE);
  const [ox, oy] = GRAIN_OFFSETS[frame % GRAIN_OFFSETS.length];

  return (
    <>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 74% 68% at 50% 48%, ${rgba(
            COLORS.bgDeep,
            0,
          )} 46%, rgba(2, 5, 10, 0.34) 84%, rgba(1, 3, 7, 0.68) 100%)`,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, rgba(0,0,0,0.42) 0px, rgba(0,0,0,0.42) ${px(
            2,
          )}px, rgba(255,255,255,0) ${px(2)}px, rgba(255,255,255,0) ${px(5)}px)`,
          opacity: 0.04,
          pointerEvents: "none",
        }}
      />
      {/* Dither. `overlay` grain has almost no amplitude near black, so a
          second pass blends normally: it randomises the last code value or two
          and breaks the contour rings the radial gradients would otherwise
          quantise to. The ground gradient is darkened by the same few levels
          this lifts, so the black point is unchanged. */}
      <AbsoluteFill
        style={{
          backgroundImage: `url(${grainTile})`,
          backgroundSize: `${tile}px ${tile}px`,
          backgroundPosition: `${oy * tile}px ${ox * tile}px`,
          opacity: 0.028,
          pointerEvents: "none",
        }}
      />
      {/* Grain proper, for the midtones. */}
      <AbsoluteFill
        style={{
          backgroundImage: `url(${grainTile})`,
          backgroundSize: `${tile}px ${tile}px`,
          backgroundPosition: `${ox * tile}px ${oy * tile}px`,
          opacity: 0.02,
          mixBlendMode: "overlay",
          pointerEvents: "none",
        }}
      />
    </>
  );
};

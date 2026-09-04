import React from "react";
import { DURATION_IN_FRAMES } from "./constants";

/** Contrast applied around the noise midpoint. Raises the dither amplitude
 *  without moving its mean, so it does not lift the black floor further. */
const CONTRAST = 1.8;

/**
 * Animated fine grain.
 *
 * This plate is very dark and very smooth, which is exactly the condition
 * H.264 bands in. The grain is doing double duty: it is a look, and it is the
 * dither that keeps the background gradient from ringing. If you see rings in
 * an encode, raise `opacity` here (or the bitrate) rather than brightening the
 * background.
 *
 * The noise has a mean of 0.5, so compositing it over the background lifts the
 * black floor by `opacity / 2`. `HUDPlane` pre-darkens the background gradient
 * by exactly that much, which is why the corners still land on the specified
 * near-black once the grain is on top.
 *
 * `seed` is driven by frame % durationInFrames, so the grain animates and still
 * repeats exactly at the loop point.
 */
export const Grain: React.FC<{ frame: number; opacity: number }> = ({
  frame,
  opacity,
}) => {
  const seed =
    ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
  const id = `grain-${seed}`;
  const intercept = 0.5 - 0.5 * CONTRAST;
  return (
    <svg
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        opacity,
      }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <filter id={id} x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.45"
            numOctaves={2}
            seed={seed}
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncR type="linear" slope={CONTRAST} intercept={intercept} />
            <feFuncG type="linear" slope={CONTRAST} intercept={intercept} />
            <feFuncB type="linear" slope={CONTRAST} intercept={intercept} />
            <feFuncA type="linear" slope={0} intercept={1} />
          </feComponentTransfer>
        </filter>
      </defs>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
};

import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { mulberry32 } from "./random";

const TILE = 180;

// Grain calibration. These three were measured, not guessed: each was
// set by differencing a render against an otherwise identical one with
// the grain switched off, so the numbers describe the grain alone and
// not the halftone dots sharing the same patch of frame.
//
// SLOPE/INTERCEPT recentre the noise (see the feComponentTransfer
// below); GRAIN_OPACITY then sets amplitude, and lands the grain at
// ~2% standard deviation over the navy field with the black point left
// where it was.
const NOISE_SLOPE = 1;
const NOISE_INTERCEPT = -0.2657;
const GRAIN_OPACITY = 0.46;

/**
 * ~2% film grain, measured on the encoded file rather than the preview.
 * Without it the wide navy gradient behind the hub posterises into
 * visible bands as soon as H.264 gets hold of it.
 *
 * The noise is generated into a single small pattern tile rather than
 * across the whole frame: the renderer rasterises the tile once and
 * repeats it, which keeps a per-frame `feTurbulence` affordable at 4K.
 * Per frame only the tile offset moves, so the grain crawls instead of
 * sitting frozen on top of the picture.
 */
export const Grain: React.FC<{ opacity?: number }> = ({
  opacity = GRAIN_OPACITY,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Frame-indexed rather than stateful: Remotion renders frames out of
  // order across workers, so the offset has to be reproducible.
  const rand = mulberry32(frame * 6151 + 17);
  const ox = Math.floor(rand() * TILE);
  const oy = Math.floor(rand() * TILE);
  const scale = height / 1080;

  return (
    <AbsoluteFill
      style={{ mixBlendMode: "overlay", opacity, pointerEvents: "none" }}
    >
      <svg width={width} height={height} style={{ display: "block" }}>
        <defs>
          <filter
            id="grainNoise"
            x="0"
            y="0"
            width="100%"
            height="100%"
            filterUnits="objectBoundingBox"
          >
            <feTurbulence
              type="fractalNoise"
              baseFrequency={0.8 / scale}
              numOctaves={3}
              stitchTiles="stitch"
              seed={7}
            />
            <feColorMatrix type="saturate" values="0" />
            {/* An overlay blend keys off 0.5, and this turbulence sits
                well above mid-grey, so left alone it lifts the black
                point instead of just dithering it. Recentre first. The
                alpha channel is forced opaque for the same reason: the
                raw noise is transparent in patches, which would make
                the grain blend unevenly. */}
            <feComponentTransfer>
              <feFuncR
                type="linear"
                slope={NOISE_SLOPE}
                intercept={NOISE_INTERCEPT}
              />
              <feFuncG
                type="linear"
                slope={NOISE_SLOPE}
                intercept={NOISE_INTERCEPT}
              />
              <feFuncB
                type="linear"
                slope={NOISE_SLOPE}
                intercept={NOISE_INTERCEPT}
              />
              <feFuncA type="linear" slope="0" intercept="1" />
            </feComponentTransfer>
          </filter>
          <pattern
            id="grainTile"
            width={TILE * scale}
            height={TILE * scale}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${ox * scale} ${oy * scale})`}
          >
            <rect
              width={TILE * scale}
              height={TILE * scale}
              filter="url(#grainNoise)"
            />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#grainTile)" />
      </svg>
    </AbsoluteFill>
  );
};

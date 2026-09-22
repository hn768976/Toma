import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { phase } from "./loop";

// ---------------------------------------------------------------------------
// Grain and dither.
//
// Dark navy with a bright glow laid over it is the worst case for 8-bit
// H.264: the smooth ramp out of the core's halo is exactly where banding
// shows up. Two noise layers break the ramp into dither.
//
// Both are APPLIED AFTER the glow — they are the last thing in the DOM —
// because the glow is what creates the smoothest gradients in the image, so
// dithering before it would just get blurred away.
//
// The noise is a deterministic function of (pixel, frame): a single
// feTurbulence tile with a fixed seed, scrolled by an offset that completes
// an INTEGER number of tile widths over the loop. Never Math.random(), which
// would differ between Remotion's render threads, and never a CSS animation,
// which is driven by wall-clock time.
//
// This also means the expensive turbulence is evaluated once per tile and
// then cheaply repeated, rather than over the whole 4K frame every frame.
// ---------------------------------------------------------------------------

const NoiseLayer: React.FC<{
  id: string;
  tile: number;
  frequency: number;
  seed: number;
  cyclesX: number;
  cyclesY: number;
  opacity: number;
  frame: number;
}> = ({ id, tile, frequency, seed, cyclesX, cyclesY, opacity, frame }) => {
  // Scrolled by an integer number of tile widths over the loop, then reduced
  // modulo one tile — the tiling makes that a no-op visually, and it keeps
  // the offset small enough that frame 600 lands on frame 0 exactly.
  const dx = tile * phase(frame, cyclesX);
  const dy = tile * phase(frame, cyclesY);

  return (
    <>
      <defs>
        <filter
          id={`${id}-f`}
          x="0"
          y="0"
          width={tile}
          height={tile}
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            type="fractalNoise"
            baseFrequency={frequency}
            numOctaves={2}
            seed={seed}
            stitchTiles="stitch"
            result="n"
          />
          {/* Desaturate to grey and force alpha to 1 so it dithers evenly. */}
          <feColorMatrix
            in="n"
            type="matrix"
            values="0.34 0.34 0.34 0 0  0.34 0.34 0.34 0 0  0.34 0.34 0.34 0 0  0 0 0 0 1"
          />
        </filter>
        <pattern
          id={id}
          width={tile}
          height={tile}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${dx.toFixed(4)} ${dy.toFixed(4)})`}
        >
          <rect width={tile} height={tile} filter={`url(#${id}-f)`} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} opacity={opacity} />
    </>
  );
};

export const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Deliberately NOT in the 3840-unit authoring space: grain is a
  // pixel-level phenomenon and should stay roughly one output pixel across at
  // any render resolution.
  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
    >
      {/* Coarser grain — the visible texture, ~2% strength. */}
      <NoiseLayer
        id="hudGrainA"
        tile={256}
        frequency={0.62}
        seed={17}
        cyclesX={97}
        cyclesY={61}
        opacity={0.021}
        frame={frame}
      />
      {/* Near-pixel dither, enough to move the darkest ramps by +/- 1/255. */}
      <NoiseLayer
        id="hudGrainB"
        tile={181}
        frequency={1.15}
        seed={53}
        cyclesX={43}
        cyclesY={113}
        opacity={0.014}
        frame={frame}
      />
    </svg>
  );
};

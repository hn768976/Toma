import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { useTheme } from "./context";
import { makeRandom } from "./rng";

/**
 * Film grain as a tiled SVG pattern.
 *
 * Two alternatives were worse: a full-frame feTurbulence recomputes noise over
 * every pixel each frame (eight million of them at 4K), and a background-image
 * data URI is not guaranteed to have decoded when Remotion captures the frame.
 * A pattern of seeded squares is deterministic, loads nothing, and rasterises
 * once per tile.
 */
const GRAIN_TILE = 120;
const GRAIN_CELL = 3;

const useGrainPaths = (): string[] =>
  useMemo(() => {
    const cells = GRAIN_TILE / GRAIN_CELL;
    const random = makeRandom("film-grain");
    const buckets = ["", "", ""];
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const v = random();
        if (v < 0.55) continue; // most of the tile stays empty
        const bucket = v < 0.78 ? 0 : v < 0.93 ? 1 : 2;
        buckets[bucket] +=
          `M${x * GRAIN_CELL} ${y * GRAIN_CELL}h${GRAIN_CELL}v${GRAIN_CELL}h-${GRAIN_CELL}z`;
      }
    }
    return buckets;
  }, []);

const Grain: React.FC<{ width: number; height: number; opacity: number }> = ({
  width,
  height,
  opacity,
}) => {
  const frame = useCurrentFrame();
  const paths = useGrainPaths();
  // Step on twos: a fresh grain field every frame reads as fizz, not film.
  const step = Math.floor(frame / 2);
  const offsetX = (step * 37) % GRAIN_TILE;
  const offsetY = (step * 73) % GRAIN_TILE;

  return (
    <svg
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, mixBlendMode: "overlay", opacity }}
    >
      <defs>
        <pattern
          id="film-grain"
          width={GRAIN_TILE}
          height={GRAIN_TILE}
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          <path d={paths[0]} fill="#808080" />
          <path d={paths[1]} fill="#ffffff" opacity={0.6} />
          <path d={paths[2]} fill="#000000" opacity={0.7} />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="url(#film-grain)" />
    </svg>
  );
};

/**
 * Everything that sits between the console and the lens: bloom, scanlines,
 * grain and vignette. Kept as one layer so both layouts get an identical
 * finish.
 */
export const Atmosphere: React.FC<{
  /** Design-space width/height the layers are sized against. */
  width: number;
  height: number;
  scanlineOpacity?: number;
  grainOpacity?: number;
}> = ({ width, height, scanlineOpacity = 0.22, grainOpacity = 0.1 }) => {
  const theme = useTheme();

  return (
    <AbsoluteFill style={{ width, height, pointerEvents: "none" }}>
      {/* Bloom rising off the console surface. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(60% 55% at 50% 52%, ${theme.glow}3d 0%, ${theme.glow}14 45%, transparent 76%)`,
          mixBlendMode: "screen",
        }}
      />
      {/* CRT scanlines, locked to the frame rather than the plane. */}
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, rgba(0,0,0,${scanlineOpacity}) 0px, rgba(0,0,0,${scanlineOpacity}) 1px, transparent 1px, transparent 3px)`,
          opacity: 0.8,
        }}
      />
      <Grain width={width} height={height} opacity={grainOpacity} />
      {/* Vignette - pulls the eye to the globe and hides the plane's edges. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(74% 70% at 50% 50%, transparent 46%, ${theme.void}99 80%, ${theme.void}e6 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

/**
 * A soft band of light that crosses the console once every few seconds, like a
 * refresh sweeping the surface. It is the only element that moves with the
 * frame rather than the plane, which is what sells it as a reflection.
 */
export const Sweep: React.FC<{ width: number; height: number; periodInFrames?: number }> = ({
  width,
  height,
  periodInFrames = 220,
}) => {
  const theme = useTheme();
  const frame = useCurrentFrame();
  const t = (frame % periodInFrames) / periodInFrames;
  const x = -40 + t * 180;

  return (
    <AbsoluteFill style={{ width, height, pointerEvents: "none", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(100deg, transparent ${x - 18}%, ${theme.bright}14 ${x}%, transparent ${x + 18}%)`,
          mixBlendMode: "screen",
        }}
      />
    </AbsoluteFill>
  );
};

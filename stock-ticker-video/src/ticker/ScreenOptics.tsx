import React from "react";
import type { Layout } from "./geometry";
import type { Palette } from "./themes";

/**
 * Depth of field, faked with stacked copies rather than one gradient blur:
 * the blurriest copy sits underneath at full coverage, and progressively
 * sharper copies are masked back in toward the upper-left. Radii are in
 * composition pixels scaled by `unit`, so a --scale=0.5 preview and a full
 * 4K render resolve to the same optical blur.
 */
const SLICES: { blur: number; maskEnd: number; maskFade: number }[] = [
  { blur: 15, maskEnd: 1, maskFade: 1 },
  { blur: 7, maskEnd: 0.66, maskFade: 0.87 },
  { blur: 2.8, maskEnd: 0.4, maskFade: 0.64 },
  { blur: 0, maskEnd: 0.16, maskFade: 0.42 },
];

const diagonalMask = (end: number, fade: number): string | undefined =>
  end >= 1
    ? undefined
    : `linear-gradient(135deg, #000 0%, #000 ${(end * 100).toFixed(1)}%, transparent ${(
        fade * 100
      ).toFixed(1)}%)`;

export const ScreenOptics: React.FC<{
  layout: Layout;
  palette: Palette;
  children: React.ReactNode;
}> = ({ layout, palette, children }) => {
  const { unit, width, height } = layout;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: palette.background,
        // A photographed monitor, not a designed perspective shot: the screen
        // is oversized so the rotation never exposes an edge.
        perspective: 5200 * unit,
        perspectiveOrigin: "26% 45%",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          transformStyle: "preserve-3d",
          transform: "rotateY(8deg) rotateX(2deg) scale(1.1)",
        }}
      >
        {SLICES.map((slice) => {
          const mask = diagonalMask(slice.maskEnd, slice.maskFade);
          return (
            <div
              key={slice.blur}
              style={{
                position: "absolute",
                inset: 0,
                width,
                height,
                filter: slice.blur ? `blur(${slice.blur * unit}px)` : undefined,
                WebkitMaskImage: mask,
                maskImage: mask,
              }}
            >
              {children}
            </div>
          );
        })}
      </div>

      {palette.glow ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: `radial-gradient(62% 52% at 38% 62%, ${palette.accent}18 0%, transparent 62%)`,
            mixBlendMode: "screen",
          }}
        />
      ) : null}

      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(120% 112% at 34% 40%, transparent 46%, rgba(0, 0, 0, ${palette.vignette}) 100%)`,
        }}
      />
    </div>
  );
};

import React, { useMemo } from "react";
import { BASE_HEIGHT, BASE_WIDTH } from "../constants";
import type { HudTheme } from "../theme";

// Background lattice. The blue layout uses the reference's plain square
// grid; the violet layout swaps in a hexagonal one, which is the single
// biggest cue that it is a different design rather than a recolour.
export const GridLayer: React.FC<{
  theme: HudTheme;
  variant: "square" | "hex";
  /** square: cell size. hex: circumradius. Design units. */
  cell?: number;
  /** every Nth square line is drawn at the stronger colour */
  majorEvery?: number;
}> = ({ theme, variant, cell = 120, majorEvery = 4 }) => {
  const squarePaths = useMemo(() => {
    if (variant !== "square") return null;
    const minor: string[] = [];
    const major: string[] = [];
    for (let x = 0, i = 0; x <= BASE_WIDTH; x += cell, i++) {
      (i % majorEvery === 0 ? major : minor).push(`M${x} 0V${BASE_HEIGHT}`);
    }
    for (let y = 0, i = 0; y <= BASE_HEIGHT; y += cell, i++) {
      (i % majorEvery === 0 ? major : minor).push(`M0 ${y}H${BASE_WIDTH}`);
    }
    return { minor: minor.join(""), major: major.join("") };
  }, [variant, cell, majorEvery]);

  const hexPath = useMemo(() => {
    if (variant !== "hex") return null;
    // Pointy-top hexagons on a staggered row lattice.
    const r = cell;
    const w = Math.sqrt(3) * r;
    const h = 1.5 * r;
    const parts: string[] = [];
    for (let row = -1; row * h <= BASE_HEIGHT + r; row++) {
      const cy = row * h;
      const xOffset = row % 2 === 0 ? 0 : w / 2;
      for (let col = -1; col * w + xOffset <= BASE_WIDTH + w; col++) {
        const cx = col * w + xOffset;
        const pts: string[] = [];
        for (let k = 0; k < 6; k++) {
          const a = (Math.PI / 180) * (60 * k - 90);
          pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
        }
        parts.push(`M${pts.join("L")}Z`);
      }
    }
    return parts.join("");
  }, [variant, cell]);

  if (variant === "square" && squarePaths) {
    return (
      <g>
        <path d={squarePaths.minor} stroke={theme.grid} strokeWidth={1.4} fill="none" />
        <path d={squarePaths.major} stroke={theme.gridMajor} strokeWidth={1.4} fill="none" />
      </g>
    );
  }

  return <path d={hexPath ?? ""} stroke={theme.grid} strokeWidth={1.4} fill="none" />;
};

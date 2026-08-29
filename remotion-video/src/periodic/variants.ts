// @variant-only:categories start
import type { ElementCategory } from "./elements";
// @variant-only:categories end
import type { PeriodicElement } from "./elements";

/**
 * The single source of truth for everything that differs between the two
 * versions: palette, cell colour rule, arrival mode and highlight behaviour.
 * No colour literal lives outside this file.
 */

export type VariantId = "assemble" | "categories";

export type CellPaint = {
  /** Semi-transparent fill. */
  fill: string;
  /** Thin, bright border - always brighter than the fill. */
  border: string;
  /** Soft halo colour. */
  glow: string;
};

export type Variant = {
  id: VariantId;
  background: string;
  symbolColor: string;
  numberColor: string;
  flashColor: string;
  vignetteColor: string;
  grainColor: string;
  /** "uniform" ignores chemistry; "byCategory" colours each cell by category. */
  colorRule: "uniform" | "byCategory";
  paintFor: (element: PeriodicElement) => CellPaint;
  arrival:
    | {
        mode: "scatter";
        /** Frames a single cell spends travelling. */
        travelFrames: number;
        /** The last cell has settled by this frame. */
        lastLandingFrame: number;
        /** Peak start rotation, degrees. */
        maxRotationDeg: number;
      }
    | {
        mode: "sequential";
        travelFrames: number;
        lastLandingFrame: number;
        maxRotationDeg: 0;
      };
  highlight:
    | { mode: "none" }
    | {
        mode: "categoryCycle";
        /** Frames each category is held for. */
        segmentFrames: number;
        /** Cross-fade length between two categories. */
        crossfadeFrames: number;
        /** Intensity the non-active categories fall to. */
        dimTo: number;
      };
};

const withAlpha = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/* ------------------------------------------------------------------ v1 --- */

// @variant-only:assemble start
const ASSEMBLE_PALETTE = {
  background: "#0A0A0C",
  cellFill: "#0F2A5C",
  cellFillAlpha: 0.55,
  cellBorder: "#3F8FE8",
  cellGlow: "#2E6FD4",
  symbol: "#E8F2FF",
  number: "#7FA8D4",
  flash: "#FFFFFF",
  vignette: "#000000",
  grain: "#FFFFFF",
};

const UNIFORM_PAINT: CellPaint = {
  fill: withAlpha(ASSEMBLE_PALETTE.cellFill, ASSEMBLE_PALETTE.cellFillAlpha),
  border: ASSEMBLE_PALETTE.cellBorder,
  glow: ASSEMBLE_PALETTE.cellGlow,
};
// @variant-only:assemble end

/* ------------------------------------------------------------------ v2 --- */

// @variant-only:categories start
const CATEGORIES_PALETTE = {
  background: "#06090A",
  symbol: "#F0FFFA",
  number: "#A8D4C4",
  flash: "#FFFFFF",
  vignette: "#000000",
  grain: "#FFFFFF",
  /** Fills are the same hue at half alpha; glows match the border hue. */
  fillAlpha: 0.5,
};

const CATEGORY_HUES: Record<ElementCategory, string> = {
  "alkali metal": "#FF6B4A",
  "alkaline earth": "#FFA83F",
  "transition metal": "#3FC4E8",
  "post-transition metal": "#5F8FE8",
  metalloid: "#9B7FE8",
  nonmetal: "#3FE87A",
  halogen: "#E8D93F",
  "noble gas": "#E85FC4",
  lanthanide: "#4FD4C4",
  actinide: "#E8874F",
};

const CATEGORY_PAINT: Record<ElementCategory, CellPaint> = (() => {
  const out = {} as Record<ElementCategory, CellPaint>;
  (Object.keys(CATEGORY_HUES) as ElementCategory[]).forEach((category) => {
    const hue = CATEGORY_HUES[category];
    out[category] = {
      fill: withAlpha(hue, CATEGORIES_PALETTE.fillAlpha),
      border: hue,
      glow: hue,
    };
  });
  return out;
})();
// @variant-only:categories end

/* --------------------------------------------------------------------- */

export const VARIANTS: Record<VariantId, Variant> = {
  // @variant-only:assemble start
  assemble: {
    id: "assemble",
    background: ASSEMBLE_PALETTE.background,
    symbolColor: ASSEMBLE_PALETTE.symbol,
    numberColor: ASSEMBLE_PALETTE.number,
    flashColor: ASSEMBLE_PALETTE.flash,
    vignetteColor: ASSEMBLE_PALETTE.vignette,
    grainColor: ASSEMBLE_PALETTE.grain,
    colorRule: "uniform",
    paintFor: () => UNIFORM_PAINT,
    arrival: {
      mode: "scatter",
      travelFrames: 26,
      lastLandingFrame: 150,
      maxRotationDeg: 25,
    },
    highlight: { mode: "none" },
  },
  // @variant-only:assemble end
  // @variant-only:categories start
  categories: {
    id: "categories",
    background: CATEGORIES_PALETTE.background,
    symbolColor: CATEGORIES_PALETTE.symbol,
    numberColor: CATEGORIES_PALETTE.number,
    flashColor: CATEGORIES_PALETTE.flash,
    vignetteColor: CATEGORIES_PALETTE.vignette,
    grainColor: CATEGORIES_PALETTE.grain,
    colorRule: "byCategory",
    paintFor: (element) => CATEGORY_PAINT[element.category],
    arrival: {
      mode: "sequential",
      travelFrames: 22,
      lastLandingFrame: 145,
      maxRotationDeg: 0,
    },
    highlight: {
      mode: "categoryCycle",
      segmentFrames: 15,
      crossfadeFrames: 5,
      dimTo: 0.3,
    },
  },
  // @variant-only:categories end
};

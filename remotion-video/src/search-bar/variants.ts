/**
 * The single source of truth for every version of the search bar.
 *
 * RULE: no colour literal and no search string appears anywhere else in the
 * project. Adding a fourth version means adding a key here — nothing else.
 */

export type VariantName = "cyan" | "green" | "light";

/** How the pill itself is drawn. */
export type BarStyle = "glow" | "terminal" | "clean";

/** How the background field of squares is distributed. */
export type FieldMode = "columns" | "scatter" | "sparse";

export type FontRole = "sans" | "mono";

export type Palette = {
  bgDeep: string;
  bgWash: string;
  fieldSquare: string;
  fieldBright: string;
  barFill: string;
  barBorder: string;
  /** Used for the border glow (dark variants) or the drop shadow (light). */
  barGlow: string;
  label: string;
  divider: string;
  text: string;
  cursor: string;
  /** Result count — v2 only. */
  accent: string | null;
  /** Autocomplete — v3 only. */
  suggestText: string | null;
  suggestHover: string | null;
};

export type Timing = {
  /** First character appears here. */
  typeStart: number;
  /** Last character appears here — typing is complete. */
  typeEnd: number;
  /** Deletion starts here. */
  holdEnd: number;
  /** Bar is empty again here. */
  deleteEnd: number;
};

export type ResultCountConfig = {
  /** Order of magnitude the re-rolls stay inside. */
  baseCount: number;
  baseSeconds: number;
  /** Copy, kept here with the rest of the strings. */
  label: string;
  unit: string;
  /** Frames between re-rolls is picked in this range, per re-roll. */
  rerollMin: number;
  rerollMax: number;
  fadeFrames: number;
};

export type AutocompleteConfig = {
  suggestions: string[];
  /** Frames the panel takes to grow to full height. */
  openFrames: number;
  /** Frames the panel takes to collapse once deletion starts. */
  closeFrames: number;
  /** Stagger between consecutive rows fading in. */
  rowStagger: number;
  /** Frames each row stays highlighted before the highlight steps down. */
  highlightFrames: number;
};

export type VariantConfig = {
  palette: Palette;
  /** The term that gets typed. */
  term: string;
  barStyle: BarStyle;
  fieldMode: FieldMode;
  timing: Timing;
  /** Font used for the typed term (the label is always the UI sans). */
  termFont: FontRole;
  /** Multiplier on the data field's opacity — it must stay subordinate. */
  fieldOpacity: number;
  /** Light mode: squares go darker than the ground instead of lighter. */
  fieldDarker: boolean;
  /** Rough number of squares in the field. */
  fieldCount: number;
  /** Faint horizontal scanlines over the field (v2). */
  scanlines: boolean;
  /** Additive bloom on border, cursor and typed text. Off in light mode. */
  bloom: boolean;
  /** Vignette strength; when `vignetteLighten` is set the corners lift. */
  vignette: number;
  vignetteLighten: boolean;
  /** Gentle highlight lift that replaces bloom in light mode. */
  overexpose: number;
  grain: number;
  resultCount: ResultCountConfig | null;
  autocomplete: AutocompleteConfig | null;
};

export const VARIANTS: Record<VariantName, VariantConfig> = {
  /* ── v1 ─ deep navy, prominent cyan glow, dense square columns ────────── */
  cyan: {
    palette: {
      bgDeep: "#060E24",
      bgWash: "#0F2450",
      fieldSquare: "#2E5C9F",
      fieldBright: "#6FA8E8",
      barFill: "#0A1A3A",
      barBorder: "#3FC4F5",
      barGlow: "#2E9FD4",
      label: "#4FD4F5",
      divider: "#2A5C8A",
      text: "#F0F8FF",
      cursor: "#7FE8FF",
      accent: null,
      suggestText: null,
      suggestHover: null,
    },
    term: "AI AGENTS",
    barStyle: "glow",
    fieldMode: "columns",
    timing: { typeStart: 30, typeEnd: 170, holdEnd: 290, deleteEnd: 330 },
    termFont: "sans",
    fieldOpacity: 0.9,
    fieldDarker: false,
    fieldCount: 1500,
    scanlines: false,
    bloom: true,
    vignette: 0.22,
    vignetteLighten: false,
    overexpose: 0,
    grain: 0.04,
    resultCount: null,
    autocomplete: null,
  },

  /* ── v2 ─ terminal: square corners, mono type, a live result count ─────── */
  green: {
    palette: {
      bgDeep: "#010C06",
      bgWash: "#06301A",
      fieldSquare: "#14663A",
      fieldBright: "#4FE87A",
      barFill: "#03150A",
      barBorder: "#3FE87A",
      barGlow: "#2EB85F",
      label: "#7FFFA8",
      divider: "#1A6B3A",
      text: "#E8FFEE",
      cursor: "#A8FFC4",
      accent: "#F5C43F",
      suggestText: null,
      suggestHover: null,
    },
    term: "MACHINE LEARNING",
    barStyle: "terminal",
    fieldMode: "scatter",
    timing: { typeStart: 30, typeEnd: 230, holdEnd: 290, deleteEnd: 330 },
    termFont: "mono",
    fieldOpacity: 0.85,
    fieldDarker: false,
    fieldCount: 780,
    scanlines: true,
    bloom: true,
    vignette: 0.22,
    vignetteLighten: false,
    overexpose: 0,
    grain: 0.04,
    resultCount: {
      baseCount: 4829110,
      baseSeconds: 0.31,
      label: "results",
      unit: "s",
      rerollMin: 20,
      rerollMax: 30,
      fadeFrames: 8,
    },
    autocomplete: null,
  },

  /* ── v3 ─ light mode: shadow instead of glow, autocomplete dropdown ────── */
  light: {
    palette: {
      bgDeep: "#EEF1F5",
      bgWash: "#E2E8F0",
      fieldSquare: "#C8D2DE",
      fieldBright: "#A8B8CA",
      barFill: "#FFFFFF",
      barBorder: "#C4CFDC",
      barGlow: "#8A97A8",
      label: "#6A7787",
      divider: "#D4DCE4",
      text: "#1E2A38",
      cursor: "#2E7FD4",
      accent: null,
      suggestText: "#3A4756",
      suggestHover: "#E8EEF5",
    },
    term: "HOW DOES AI",
    barStyle: "clean",
    fieldMode: "sparse",
    timing: { typeStart: 30, typeEnd: 180, holdEnd: 290, deleteEnd: 330 },
    termFont: "sans",
    fieldOpacity: 0.4,
    fieldDarker: true,
    fieldCount: 420,
    scanlines: false,
    bloom: false,
    vignette: 0.1,
    vignetteLighten: true,
    overexpose: 0.07,
    grain: 0.04,
    resultCount: null,
    autocomplete: {
      suggestions: ["how does ai work", "how does ai learn", "how does ai think"],
      openFrames: 16,
      closeFrames: 12,
      rowStagger: 5,
      highlightFrames: 40,
    },
  },
};

/** Opacity of the pill's fill, per bar style. */
export const BAR_FILL_ALPHA: Record<BarStyle, number> = {
  glow: 0.55,
  terminal: 0.65,
  clean: 1,
};

/** Opacity of the light-mode drop shadow. */
export const BAR_SHADOW_ALPHA = 0.2;

/** Chrome text — the same in every version. */
export const SEARCH_LABEL = "SEARCH";

/** The terminal version swaps the magnifier for a prompt chevron. */
export const PROMPT_CHEVRON = ">";

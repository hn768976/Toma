/**
 * The single source of truth for every version of the search bar.
 *
 * RULE: no colour literal and no search string appears anywhere else in the
 * project. Adding a fourth version means adding a key here — nothing else.
 */

export type VariantName =
  | "cyan"
  | "green"
  | "light"
  | "aiOverview"
  | "cleanLight"
  | "cleanLightAlt";

/** How the pill itself is drawn. */
export type BarStyle = "glow" | "terminal" | "clean" | "minimal" | "input";

/** How the background field of squares is distributed. */
export type FieldMode = "columns" | "scatter" | "sparse" | "none";

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
  /** Present on the variants that show a mouse pointer and a placeholder. */
  ui: UiPalette | null;
  /** Present on the variant whose bar ends in a filled search button. */
  button: ButtonPalette | null;
  /** Present on the variant that opens a results panel. */
  panel: PanelPalette | null;
  /** The circle wipe's colour, on the variants that end with one. */
  wipe: string | null;
};

export type UiPalette = {
  /** The greyed placeholder shown before the field is focused. */
  placeholder: string;
  /**
   * The magnifier, which on these variants is not the label's colour: white
   * inside the filled button, or a saturated blue inline.
   */
  icon: string;
  pointerFill: string;
  pointerOutline: string;
};

export type ButtonPalette = {
  fill: string;
  hover: string;
};

export type PanelPalette = {
  heading: string;
  body: string;
  sparkle: string;
};

export type Timing = {
  /** First character appears here. */
  typeStart: number;
  /** Last character appears here — typing is complete. */
  typeEnd: number;
  /**
   * When the term is deleted again, or null when it never is: the interactive
   * variants close on a transition rather than rewinding the field.
   */
  deletion: { start: number; end: number } | null;
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

/** Where the chrome sits inside the pill. */
export type ChromeConfig = {
  /** The letterspaced "SEARCH" label followed by a divider. */
  label: boolean;
  /** Greyed placeholder shown until the field is focused, if any. */
  placeholder: string | null;
  /**
   * "left" and "chevron" put the mark in front of the label; "right" puts an
   * inline magnifier at the far end; "button" replaces it with a filled
   * search button.
   */
  icon: "left" | "right" | "button" | "chevron";
};

/**
 * A point the pointer travels to, expressed against the bar so it survives any
 * change of resolution: x is a fraction of the bar's width from its left edge,
 * y an offset from its vertical centre measured in bar heights.
 */
export type PointerAnchor = { x: number; y: number };

export type PointerScript = {
  /** Where the pointer waits before its first move — off frame. */
  from: PointerAnchor;
  moves: { start: number; end: number; to: PointerAnchor }[];
  /** Frames at which the pointer clicks wherever it stands. */
  clicks: number[];
};

export type ResultsPanelConfig = {
  /** The sparkle lands before the panel opens, and pulses once as it does. */
  sparkleFrame: number;
  start: number;
  openFrames: number;
  lineStagger: number;
  heading: string;
  /** Invented filler — it is there to read as texture, not to be read. */
  lines: string[];
};

/** The staged, interactive timeline the later variants run on. */
export type StageConfig = {
  barEntrance: { kind: "draw" | "scale"; start: number; end: number } | null;
  /** Placeholder fade-in window. */
  placeholderIn: { start: number; end: number } | null;
  /** The field is clicked here: the placeholder clears and the caret appears. */
  focusFrame: number | null;
  /** The search button flashes to its hover colour from this frame. */
  buttonFlash: { frame: number; frames: number } | null;
  pointer: PointerScript | null;
  panel: ResultsPanelConfig | null;
  wipe: { start: number; end: number } | null;
  /** Everything settles back to the ground colour so the loop closes. */
  fadeOut: { start: number; end: number } | null;
};

export type VariantConfig = {
  palette: Palette;
  /** The term that gets typed. */
  term: string;
  barStyle: BarStyle;
  chrome: ChromeConfig;
  fieldMode: FieldMode;
  timing: Timing;
  /** Weight of the typed term. */
  termWeight: number;
  /** Font used for the typed term (the label is always the UI sans). */
  termFont: FontRole;
  /** Multiplier on the data field's opacity — it must stay subordinate. */
  fieldOpacity: number;
  /** How far the radial wash behind the bar lifts the ground. */
  washStrength: number;
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
  /** null for the variants that simply loop type-hold-delete. */
  stages: StageConfig | null;
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
      ui: null,
      button: null,
      panel: null,
      wipe: null,
    },
    term: "AI AGENTS",
    barStyle: "glow",
    chrome: { label: true, placeholder: null, icon: "left" },
    fieldMode: "columns",
    timing: { typeStart: 30, typeEnd: 170, deletion: { start: 290, end: 330 } },
    termFont: "sans",
    termWeight: 700,
    fieldOpacity: 0.9,
    washStrength: 1,
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
    stages: null,
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
      ui: null,
      button: null,
      panel: null,
      wipe: null,
    },
    term: "MACHINE LEARNING",
    barStyle: "terminal",
    chrome: { label: true, placeholder: null, icon: "chevron" },
    fieldMode: "scatter",
    timing: { typeStart: 30, typeEnd: 230, deletion: { start: 290, end: 330 } },
    termFont: "mono",
    termWeight: 700,
    fieldOpacity: 0.85,
    washStrength: 0.6,
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
    stages: null,
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
      ui: null,
      button: null,
      panel: null,
      wipe: null,
    },
    term: "HOW DOES AI",
    barStyle: "clean",
    chrome: { label: true, placeholder: null, icon: "left" },
    fieldMode: "sparse",
    timing: { typeStart: 30, typeEnd: 180, deletion: { start: 290, end: 330 } },
    termFont: "sans",
    termWeight: 700,
    fieldOpacity: 0.4,
    washStrength: 1,
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
    stages: null,
  },
  /* ── v4 ─ pure black, a pointer drives the search, a results panel opens ─ */
  aiOverview: {
    palette: {
      bgDeep: "#000000",
      bgWash: "#000000",
      // The field is off in this variant; these are never sampled.
      fieldSquare: "#000000",
      fieldBright: "#000000",
      barFill: "#000000",
      barBorder: "#4A4A4A",
      barGlow: "#4A4A4A",
      label: "#8A8A8A",
      divider: "#4A4A4A",
      text: "#FFFFFF",
      cursor: "#FFFFFF",
      accent: null,
      suggestText: null,
      suggestHover: null,
      ui: {
        placeholder: "#8A8A8A",
        icon: "#FFFFFF",
        pointerFill: "#FFFFFF",
        pointerOutline: "#000000",
      },
      button: { fill: "#2E5CD4", hover: "#3F72E8" },
      panel: { heading: "#E8E8E8", body: "#9A9A9A", sparkle: "#FFFFFF" },
      wipe: null,
    },
    term: "AI OVERVIEW",
    barStyle: "minimal",
    chrome: { label: false, placeholder: "Search", icon: "button" },
    fieldMode: "none",
    timing: { typeStart: 125, typeEnd: 260, deletion: null },
    termFont: "sans",
    termWeight: 700,
    fieldOpacity: 0,
    washStrength: 0,
    fieldDarker: false,
    fieldCount: 0,
    scanlines: false,
    bloom: false,
    vignette: 0,
    vignetteLighten: false,
    overexpose: 0,
    grain: 0,
    resultCount: null,
    autocomplete: null,
    stages: {
      barEntrance: { kind: "draw", start: 20, end: 45 },
      placeholderIn: { start: 45, end: 70 },
      focusFrame: 110,
      buttonFlash: { frame: 260, frames: 4 },
      pointer: {
        from: { x: 2.2, y: 9 },
        moves: [
          { start: 70, end: 110, to: { x: 0.3, y: 0 } },
          { start: 115, end: 125, to: { x: 0.9, y: 0 } },
        ],
        clicks: [110, 260],
      },
      panel: {
        sparkleFrame: 270,
        start: 290,
        openFrames: 14,
        lineStagger: 4,
        heading: "Generated summary",
        // Invented filler. It is set small enough to read as texture, and is
        // deliberately not a quotation of anything.
        lines: [
          "A short answer is assembled from the sources that match the query most closely.",
          "Each line is drawn from a different part of the result set and ranked before it is shown.",
          "Related topics are grouped together so the shape of the answer is visible at a glance.",
          "Longer passages are shortened to the sentence that addresses the question directly.",
          "Every source stays listed underneath, so any line can be traced back to where it came from.",
        ],
      },
      wipe: null,
      fadeOut: { start: 440, end: 480 },
    },
  },

  /* ── v5 ─ pure white, a pointer, and a blue circle wipe to close ───────── */
  cleanLight: {
    palette: {
      bgDeep: "#FFFFFF",
      bgWash: "#FFFFFF",
      // The field is off in this variant; these are never sampled.
      fieldSquare: "#FFFFFF",
      fieldBright: "#FFFFFF",
      barFill: "#FFFFFF",
      barBorder: "#C8C8C8",
      barGlow: "#C8C8C8",
      label: "#A0A0A0",
      divider: "#C8C8C8",
      text: "#111111",
      cursor: "#111111",
      accent: null,
      suggestText: null,
      suggestHover: null,
      ui: {
        placeholder: "#A0A0A0",
        icon: "#1A5CFF",
        pointerFill: "#FFFFFF",
        pointerOutline: "#333333",
      },
      button: null,
      panel: null,
      wipe: "#1A5CFF",
    },
    term: "NEURAL NETWORK",
    barStyle: "input",
    chrome: { label: false, placeholder: "Search", icon: "right" },
    fieldMode: "none",
    timing: { typeStart: 100, typeEnd: 290, deletion: null },
    termFont: "sans",
    termWeight: 500,
    fieldOpacity: 0,
    washStrength: 0,
    fieldDarker: true,
    fieldCount: 0,
    scanlines: false,
    bloom: false,
    vignette: 0,
    vignetteLighten: false,
    overexpose: 0,
    grain: 0,
    resultCount: null,
    autocomplete: null,
    stages: {
      barEntrance: { kind: "scale", start: 25, end: 55 },
      placeholderIn: { start: 25, end: 55 },
      focusFrame: 95,
      buttonFlash: null,
      pointer: {
        from: { x: -1.2, y: 9 },
        moves: [
          { start: 55, end: 95, to: { x: 0.3, y: 0 } },
          { start: 100, end: 125, to: { x: 0.28, y: 2.6 } },
        ],
        clicks: [95],
      },
      panel: null,
      wipe: { start: 380, end: 405 },
      fadeOut: { start: 450, end: 480 },
    },
  },

  /* ── v6 ─ v5 with a different term; the pair targets two search listings ─ */
  cleanLightAlt: {
    palette: {
      bgDeep: "#FFFFFF",
      bgWash: "#FFFFFF",
      // The field is off in this variant; these are never sampled.
      fieldSquare: "#FFFFFF",
      fieldBright: "#FFFFFF",
      barFill: "#FFFFFF",
      barBorder: "#C8C8C8",
      barGlow: "#C8C8C8",
      label: "#A0A0A0",
      divider: "#C8C8C8",
      text: "#111111",
      cursor: "#111111",
      accent: null,
      suggestText: null,
      suggestHover: null,
      ui: {
        placeholder: "#A0A0A0",
        icon: "#1A5CFF",
        pointerFill: "#FFFFFF",
        pointerOutline: "#333333",
      },
      button: null,
      panel: null,
      wipe: "#1A5CFF",
    },
    term: "DEEP LEARNING",
    barStyle: "input",
    chrome: { label: false, placeholder: "Search", icon: "right" },
    fieldMode: "none",
    timing: { typeStart: 100, typeEnd: 290, deletion: null },
    termFont: "sans",
    termWeight: 500,
    fieldOpacity: 0,
    washStrength: 0,
    fieldDarker: true,
    fieldCount: 0,
    scanlines: false,
    bloom: false,
    vignette: 0,
    vignetteLighten: false,
    overexpose: 0,
    grain: 0,
    resultCount: null,
    autocomplete: null,
    stages: {
      barEntrance: { kind: "scale", start: 25, end: 55 },
      placeholderIn: { start: 25, end: 55 },
      focusFrame: 95,
      buttonFlash: null,
      pointer: {
        from: { x: 2.2, y: 9 },
        moves: [
          { start: 55, end: 95, to: { x: 0.7, y: 0 } },
          { start: 100, end: 125, to: { x: 0.72, y: 2.6 } },
        ],
        clicks: [95],
      },
      panel: null,
      wipe: { start: 380, end: 405 },
      fadeOut: { start: 450, end: 480 },
    },
  },
};

/** Opacity of the pill's fill, per bar style. */
export const BAR_FILL_ALPHA: Record<BarStyle, number> = {
  glow: 0.55,
  terminal: 0.65,
  clean: 1,
  minimal: 1,
  input: 1,
};

/** Opacity of the light-mode drop shadow. */
export const BAR_SHADOW_ALPHA = 0.2;

/** Chrome text — the same in every version. */
export const SEARCH_LABEL = "SEARCH";

/** The terminal version swaps the magnifier for a prompt chevron. */
export const PROMPT_CHEVRON = ">";

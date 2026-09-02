// The one palette. Every colour in the frame comes from here; nothing else
// hardcodes a hex. Shared verbatim by all three versions — the centre
// element's accent (see variants.ts) is the only value that differs, and it
// is a single string.
export const PALETTE = {
  bgDeep: "#050D14", // near-black teal, the frame ground
  bgWash: "#0A1E2E", // slightly lifted wash behind the panel grid
  panelFill: "#071620", // panel interior, laid down at PANEL_FILL_ALPHA
  panelBorder: "#1E5C70",
  gridLine: "#0F3040",
  elementCyan: "#3FD4E8", // the dominant chart and text colour
  elementPale: "#A8E8F5",
  elementDim: "#2E6B7A",
  textPale: "#7FC4D4",
  textBright: "#E8FAFF",
  accentAmber: "#F5A03F", // deliberately rationed: 2-3 small elements only
  accentBlue: "#4F8FE8", // the bar charts
} as const;

export const PANEL_FILL_ALPHA = 0.8;

/**
 * `#RRGGBB` -> `rgba(r, g, b, a)`. Canvas has no colour-mixing of its own, so
 * every translucent use of a palette entry goes through this rather than
 * through a second hardcoded hex.
 */
export const withAlpha = (hex: string, alpha: number): string => {
  const h = hex.replace("#", "");
  const n = parseInt(
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h,
    16,
  );
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/** `#RRGGBB` -> `[r, g, b]`, 0-255. Used by the chromatic-fringe split. */
export const toRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

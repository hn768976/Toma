export type BarColors = {
  bar: string;
  /** Applied to the single `highlightIndex` bar. */
  highlight?: string;
  /** Bright tip drawn at the leading end of each bar. */
  cap?: string;
  /** Unfilled remainder, horizontal orientation only. A function receives the
   *  bar's index and resolved colour, so the track can be tinted from the bar
   *  it belongs to rather than being one flat colour for the whole series. */
  track?: string | ((index: number, barColor: string) => string);
};

export type BarGeometry = { index: number; x: number; y: number; w: number; h: number };

/**
 * A row or column of bars from normalised 0..1 values.
 *
 * Returns each bar's geometry so the caller can hang labels, values or
 * annotations off it without recomputing the layout.
 */
export const drawBarSeries = (
  ctx: CanvasRenderingContext2D,
  o: {
    x: number;
    y: number;
    w: number;
    h: number;
    values: number[];
    orientation: "horizontal" | "vertical";
    colors: BarColors;
    highlightIndex?: number;
    /** Bar thickness as a fraction of its slot. */
    thicknessFraction?: number;
    /** Horizontal only: px reserved at the right for value labels. */
    gutter?: number;
    capPx?: number;
  },
): BarGeometry[] => {
  const {
    x,
    y,
    w,
    h,
    values,
    orientation,
    colors,
    highlightIndex = -1,
    thicknessFraction = orientation === "vertical" ? 0.62 : 0.5,
    gutter = 0,
    capPx = 4,
  } = o;
  const n = values.length;
  const out: BarGeometry[] = [];

  if (orientation === "vertical") {
    const slot = w / n;
    const barW = slot * thicknessFraction;
    for (let i = 0; i < n; i++) {
      const bh = h * values[i];
      const bx = x + slot * i + (slot - barW) / 2;
      const by = y + h - bh;
      ctx.fillStyle = i === highlightIndex && colors.highlight ? colors.highlight : colors.bar;
      ctx.fillRect(bx, by, barW, bh);
      if (colors.cap) {
        ctx.fillStyle = colors.cap;
        ctx.fillRect(bx, by, barW, Math.min(capPx, bh));
      }
      out.push({ index: i, x: bx, y: by, w: barW, h: bh });
    }
  } else {
    const slot = h / n;
    const barH = slot * thicknessFraction;
    const track = w - gutter;
    for (let i = 0; i < n; i++) {
      const bw = track * values[i];
      const by = y + slot * i + (slot - barH) / 2;
      const color = i === highlightIndex && colors.highlight ? colors.highlight : colors.bar;
      if (colors.track) {
        ctx.fillStyle =
          typeof colors.track === "function" ? colors.track(i, color) : colors.track;
        ctx.fillRect(x, by, track, barH);
      }
      ctx.fillStyle = color;
      ctx.fillRect(x, by, bw, barH);
      if (colors.cap) {
        ctx.fillStyle = colors.cap;
        ctx.fillRect(x + bw - Math.min(capPx, bw), by, Math.min(capPx, bw), barH);
      }
      out.push({ index: i, x, y: by, w: bw, h: barH });
    }
  }
  return out;
};

/**
 * A bar level that shifts on two staggered sine cycles.
 *
 * Both periods must divide the composition's loop length; the two together are
 * what stop a row of bars pulsing in visible unison.
 */
export const staggeredBarLevel = (o: {
  frame: number;
  slowPeriod: number;
  fastPeriod: number;
  slowPhase: number;
  fastPhase: number;
  bias?: number;
  slowAmp?: number;
  fastAmp?: number;
  min?: number;
  max?: number;
}): number => {
  const {
    frame,
    slowPeriod,
    fastPeriod,
    slowPhase,
    fastPhase,
    bias = 0,
    slowAmp = 0.3,
    fastAmp = 0.17,
    min = 0.06,
    max = 1,
  } = o;
  const v =
    0.5 +
    bias +
    slowAmp * Math.sin(Math.PI * 2 * (frame / slowPeriod + slowPhase)) +
    fastAmp * Math.sin(Math.PI * 2 * (frame / fastPeriod + fastPhase));
  return Math.max(min, Math.min(max, v));
};

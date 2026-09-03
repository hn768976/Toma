import {COLORS, FONT_FAMILY, PAGE} from "./theme";
import {
  MONTH_NAMES,
  monthMatrix,
  sundayColumn,
  weekdayHeader,
  type WeekStart,
} from "./calendar";

/**
 * A month rendered once, at full output resolution, into an offscreen canvas.
 *
 * `data` is the same pixels as a flat RGBA array: the curl warp samples it
 * per-pixel, so text is resampled from a 4K raster rather than magnified from
 * a preview-sized one.
 */
export type PageBitmap = {
  canvas: HTMLCanvasElement;
  data: Uint8ClampedArray;
  width: number;
  height: number;
};

export type PageSpec = {
  year: number;
  month: number;
  weekStart: WeekStart;
  width: number;
  height: number;
};

const cache = new Map<string, PageBitmap>();

const keyOf = (s: PageSpec) =>
  `${s.year}-${s.month}-${s.weekStart}-${s.width}x${s.height}`;

/** Draws text letter by letter so we can apply tracking on a canvas. */
const trackedText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: "left" | "right" | "center",
) => {
  const chars = [...text];
  const widths = chars.map((c) => ctx.measureText(c).width);
  const total =
    widths.reduce((a, b) => a + b, 0) + tracking * Math.max(0, chars.length - 1);

  let cursor = x;
  if (align === "right") {
    cursor = x - total;
  } else if (align === "center") {
    cursor = x - total / 2;
  }

  const previousAlign = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((c, i) => {
    ctx.fillText(c, cursor, y);
    cursor += widths[i] + tracking;
  });
  ctx.textAlign = previousAlign;
  return total;
};

const paint = (ctx: CanvasRenderingContext2D, spec: PageSpec) => {
  const {width: w, height: h, year, month, weekStart} = spec;

  ctx.fillStyle = COLORS.card;
  ctx.fillRect(0, 0, w, h);

  const padX = PAGE.padX * w;
  const contentWidth = w - padX * 2;

  // --- Month name and year, sharing a baseline ---------------------------
  const titleSize = PAGE.titleSize * w;
  ctx.font = `800 ${titleSize}px ${FONT_FAMILY}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = COLORS.ink;
  const titleY = PAGE.titleBaselineY * h;
  const tracking = PAGE.titleTracking * titleSize;
  trackedText(ctx, MONTH_NAMES[month], padX, titleY, tracking, "left");
  trackedText(ctx, String(year), w - padX, titleY, tracking, "right");

  // --- Weekday header, on a barely-there band ----------------------------
  const bandTop = PAGE.bandTopY * h;
  const bandHeight = PAGE.bandHeightY * h;
  ctx.fillStyle = COLORS.weekdayBand;
  ctx.fillRect(padX, bandTop, contentWidth, bandHeight);

  const colWidth = contentWidth / 7;
  const columnCentre = (col: number) => padX + colWidth * (col + 0.5);
  const sunday = sundayColumn(weekStart);

  const weekdaySize = PAGE.weekdaySize * w;
  ctx.font = `700 ${weekdaySize}px ${FONT_FAMILY}`;
  weekdayHeader(weekStart).forEach((label, col) => {
    ctx.fillStyle = col === sunday ? COLORS.sunday : COLORS.weekday;
    trackedText(
      ctx,
      label,
      columnCentre(col),
      PAGE.weekdayBaselineY * h,
      PAGE.weekdayTracking * weekdaySize,
      "center",
    );
  });

  // --- Date grid: numbers only, blanks stay blank ------------------------
  const dateSize = PAGE.dateSize * w;
  ctx.font = `500 ${dateSize}px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const gridTop = PAGE.gridTopY * h;
  // A fixed row pitch keeps the rhythm identical from month to month; the
  // weeks a month actually uses are centred in that space, so a short
  // February sits balanced instead of leaving a void under the last row.
  const rowHeight = (PAGE.gridBottomY * h - gridTop) / 6;
  const weeks = monthMatrix(year, month, weekStart).filter((week) =>
    week.some((day) => day !== null),
  );
  const blockTop = gridTop + ((6 - weeks.length) * rowHeight) / 2;

  weeks.forEach((week, row) => {
    week.forEach((day, col) => {
      if (day === null) {
        return;
      }
      ctx.fillStyle = col === sunday ? COLORS.sunday : COLORS.ink;
      // Optical centring: digits sit slightly high on the "middle" baseline.
      ctx.fillText(
        String(day),
        columnCentre(col),
        blockTop + rowHeight * (row + 0.5) + dateSize * 0.03,
      );
    });
  });

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
};

/** Rasterises a month page, memoised on its full spec. */
export const getPageBitmap = (spec: PageSpec): PageBitmap => {
  const key = keyOf(spec);
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(spec.width);
  canvas.height = Math.round(spec.height);
  const ctx = canvas.getContext("2d", {willReadFrequently: true});
  if (!ctx) {
    throw new Error("Could not acquire a 2D context for the month page");
  }

  paint(ctx, {...spec, width: canvas.width, height: canvas.height});

  const bitmap: PageBitmap = {
    canvas,
    data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
    width: canvas.width,
    height: canvas.height,
  };
  cache.set(key, bitmap);
  return bitmap;
};

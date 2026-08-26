/**
 * Canvas has no font-feature-settings, so tabular figures are done by hand:
 * every glyph is drawn into a fixed-width cell the size of the widest digit.
 * Counters reroll every frame and must not jitter.
 */
export const measureDigitCell = (ctx: CanvasRenderingContext2D) => {
  let w = 0;
  for (let d = 0; d <= 9; d++) w = Math.max(w, ctx.measureText(String(d)).width);
  return w;
};

export type TabularAlign = 'left' | 'right';

export const drawTabular = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  align: TabularAlign = 'left'
) => {
  const cell = measureDigitCell(ctx);
  const widths = [...text].map((ch) => (ch >= '0' && ch <= '9' ? cell : ctx.measureText(ch).width));
  const total = widths.reduce((a, b) => a + b, 0);
  let cx = align === 'right' ? x - total : x;
  const prev = ctx.textAlign;
  ctx.textAlign = 'left';
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch >= '0' && ch <= '9') {
      // Centre the glyph in its cell so 1s sit where 8s sit.
      ctx.fillText(ch, cx + (cell - ctx.measureText(ch).width) / 2, y);
    } else {
      ctx.fillText(ch, cx, y);
    }
    cx += widths[i];
  }
  ctx.textAlign = prev;
  return total;
};

export const groupDigits = (n: number) =>
  Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

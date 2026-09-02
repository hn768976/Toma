/**
 * The rule-work of a tabular panel: a header underline, row separators and
 * column dividers. Static — rasterise once.
 */
export const panelGrid = (
  ctx: CanvasRenderingContext2D,
  o: {
    x: number;
    y: number;
    w: number;
    h: number;
    columns: number;
    rows: number;
    headerHeight?: number;
    colors: { headerRule: string; line: string };
    headerRuleWidth?: number;
    lineWidth?: number;
    /** Column dividers are nudged this far left of the column boundary. */
    dividerInset?: number;
  },
) => {
  const {
    x,
    y,
    w,
    h,
    columns,
    rows,
    headerHeight = 0,
    colors,
    headerRuleWidth = 2,
    lineWidth = 1,
    dividerInset = 10,
  } = o;
  const colW = w / columns;
  const rowH = (h - headerHeight) / rows;

  if (headerHeight > 0) {
    ctx.strokeStyle = colors.headerRule;
    ctx.lineWidth = headerRuleWidth;
    ctx.beginPath();
    ctx.moveTo(x, y + headerHeight - 6);
    ctx.lineTo(x + w, y + headerHeight - 6);
    ctx.stroke();
  }

  ctx.strokeStyle = colors.line;
  ctx.lineWidth = lineWidth;
  for (let r = 1; r < rows; r++) {
    const ry = y + headerHeight + rowH * r;
    ctx.beginPath();
    ctx.moveTo(x, ry);
    ctx.lineTo(x + w, ry);
    ctx.stroke();
  }
  for (let c = 1; c < columns; c++) {
    const cx = x + colW * c - dividerInset;
    ctx.beginPath();
    ctx.moveTo(cx, y + headerHeight - 6);
    ctx.lineTo(cx, y + h);
    ctx.stroke();
  }
};

/** Axis-style guide lines across a panel, evenly spaced. */
export const guideLines = (
  ctx: CanvasRenderingContext2D,
  o: {
    x: number;
    y: number;
    w: number;
    h: number;
    color: string;
    lineWidth?: number;
    vertical?: number;
    horizontal?: number;
  },
) => {
  const { x, y, w, h, color, lineWidth = 1, vertical = 0, horizontal = 0 } = o;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  for (let i = 0; i <= vertical; i++) {
    const gx = x + (w * i) / vertical;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }
  for (let i = 0; i <= horizontal; i++) {
    const gy = y + (h * i) / horizontal;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }
};

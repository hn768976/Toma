import { rgba } from "../lib/colorUtils";
import { rndRange } from "../lib/seededRandom";
import { random } from "remotion";

/**
 * A small printed line chart: a descending trace on a faint grid.
 *
 * It is printed in the same ink as the text — no accent hue, no colour — so it
 * reads as part of the page rather than as a graphic pasted on top. The trace
 * falls overall but is jagged, with a couple of failed rallies on the way
 * down.
 */
export const drawChart = (
  ctx: CanvasRenderingContext2D,
  opts: {
    seed: string;
    x: number;
    y: number;
    w: number;
    h: number;
    inkHex: string;
    softInkHex: string;
  },
): void => {
  const { seed, x, y, w, h, inkHex, softInkHex } = opts;
  if (w < 40 || h < 30) return;

  const strokeW = Math.max(1, w * 0.004);

  ctx.save();

  // Faint grid.
  ctx.strokeStyle = rgba(softInkHex, 0.22);
  ctx.lineWidth = Math.max(0.75, strokeW * 0.5);
  const rows = 4;
  const cols = 5;
  for (let r = 0; r <= rows; r++) {
    const gy = Math.round(y + (h * r) / rows) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, gy);
    ctx.lineTo(x + w, gy);
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c++) {
    const gx = Math.round(x + (w * c) / cols) + 0.5;
    ctx.beginPath();
    ctx.moveTo(gx, y);
    ctx.lineTo(gx, y + h);
    ctx.stroke();
  }

  // Axes, slightly heavier.
  ctx.strokeStyle = rgba(inkHex, 0.55);
  ctx.lineWidth = strokeW;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();

  // The descending trace.
  const points = 26;
  const inset = h * 0.08;
  ctx.strokeStyle = rgba(inkHex, 0.9);
  ctx.lineWidth = strokeW * 2.1;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  let prevY = y + inset;
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    // Overall fall, eased so it accelerates, plus seeded jitter and two
    // shallow recoveries.
    const fall = Math.pow(t, 1.35);
    const rally = Math.sin(t * Math.PI * 3.1) * 0.06 * (1 - t);
    const jitter = (random(`${seed}:pt:${i}`) - 0.5) * 0.09;
    const norm = Math.max(0, Math.min(1, fall - rally + jitter));
    const px = x + t * w;
    const py = y + inset + norm * (h - inset * 2);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
    prevY = py;
  }
  ctx.stroke();

  // A single tick label rule under the last point, suggesting an annotation.
  ctx.strokeStyle = rgba(softInkHex, 0.5);
  ctx.lineWidth = strokeW;
  ctx.beginPath();
  ctx.moveTo(x + w * rndRange(`${seed}:tick`, 0.55, 0.8), prevY);
  ctx.lineTo(x + w, prevY);
  ctx.stroke();

  ctx.restore();
};

// Flags drawn in code from their official construction sheets.
// Each returns a canvas at the flag's official aspect ratio.
import { makeCanvas } from "../../lib/assets";

export type FlagId = "USA" | "China" | "Japan" | "Germany" | "France" | "Italy";

/** Regular 5-point star, one point at angle `rot` (radians, 0 = up). */
function star(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, rot = 0) {
  const inner = r * 0.381966; // golden-ratio star
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : inner;
    ctx.lineTo(cx + Math.sin(a) * rr, cy - Math.cos(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/** US flag, Executive Order 10834: 13 stripes, 50 stars in 9 rows of 6/5. */
function usa(h: number): HTMLCanvasElement {
  const A = h; // hoist
  const B = 1.9 * A; // fly
  const [c, ctx] = makeCanvas(Math.round(B), Math.round(A));
  const L = A / 13;
  for (let i = 0; i < 13; i++) {
    ctx.fillStyle = i % 2 === 0 ? "#B22234" : "#FFFFFF";
    ctx.fillRect(0, Math.round(i * L), c.width, Math.round((i + 1) * L) - Math.round(i * L));
  }
  const C = (7 / 13) * A; // canton height
  const D = 0.76 * A; // canton width
  ctx.fillStyle = "#3C3B6E";
  ctx.fillRect(0, 0, D, C);
  const E = 0.054 * A, F = 0.054 * A, G = 0.063 * A, H = 0.063 * A, K = 0.0616 * A;
  ctx.fillStyle = "#FFFFFF";
  for (let row = 0; row < 9; row++) {
    const y = E + row * F;
    const six = row % 2 === 0;
    for (let k = 0; k < (six ? 6 : 5); k++) {
      const x = six ? G + k * 2 * H : G + H + k * 2 * H;
      star(ctx, x, y, K / 2);
    }
  }
  return c;
}

/** PRC flag, 1949 construction: 30x20 grid, small stars point at the big star. */
function china(h: number): HTMLCanvasElement {
  const u = h / 20;
  const [c, ctx] = makeCanvas(Math.round(30 * u), Math.round(20 * u));
  ctx.fillStyle = "#EE1C25";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#FFFF00";
  star(ctx, 5 * u, 5 * u, 3 * u, 0);
  for (const [x, y] of [[10, 2], [12, 4], [12, 7], [10, 9]]) {
    const rot = Math.atan2(5 - x, -(5 - y)); // point towards (5,5)
    star(ctx, x * u, y * u, 1 * u, rot);
  }
  return c;
}

function japan(h: number) {
  const [c, ctx] = makeCanvas(Math.round(1.5 * h), Math.round(h));
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#BC002D";
  ctx.beginPath();
  ctx.arc(c.width / 2, c.height / 2, (3 / 5) * h * 0.5, 0, Math.PI * 2);
  ctx.fill();
  return c;
}

function bands(h: number, ratio: number, cols: string[], vertical: boolean) {
  const [c, ctx] = makeCanvas(Math.round(ratio * h), Math.round(h));
  cols.forEach((col, i) => {
    ctx.fillStyle = col;
    if (vertical) ctx.fillRect((i * c.width) / cols.length, 0, c.width / cols.length + 1, c.height);
    else ctx.fillRect(0, (i * c.height) / cols.length, c.width, c.height / cols.length + 1);
  });
  return c;
}

export function drawFlag(id: FlagId, height = 1100): HTMLCanvasElement {
  switch (id) {
    case "USA":
      return usa(height);
    case "China":
      return china(height);
    case "Japan":
      return japan(height);
    case "Germany":
      return bands(height, 5 / 3, ["#000000", "#DD0000", "#FFCE00"], false);
    case "France":
      return bands(height, 1.5, ["#002654", "#FFFFFF", "#CE1126"], true);
    case "Italy":
      return bands(height, 1.5, ["#009246", "#FFFFFF", "#CE2B37"], true);
  }
}

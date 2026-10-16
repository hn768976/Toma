import { MONO, SANS } from "../lib/fonts";
import { mulberry32, range, type Rng } from "../lib/random";

/**
 * Canvas-2D dashboard widgets. Every draw is a pure function of
 * (widget seed, tick index), so a widget's pixels depend only on the frame.
 */
export type WidgetKind = "bars" | "blocks" | "line" | "bell" | "gauges" | "table" | "box" | "wave" | "columns";
export const KINDS: WidgetKind[] = ["bars", "blocks", "line", "bell", "gauges", "table", "box", "wave", "columns", "columns", "table", "gauges"];

export type HudColors = { ink: string; accent: string };

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const tickRng = (seed: number, tick: number) => mulberry32((seed * 7919 + tick * 104729) >>> 0);

const label = (rng: Rng) => {
  const A = ["SYS", "NODE", "FLOW", "LINK", "CORE", "UNIT", "GRID", "BUS"];
  return `${A[Math.floor(rng() * A.length)]}-${String(Math.floor(rng() * 90) + 10)}`;
};

export const drawWidget = (
  ctx: CanvasRenderingContext2D,
  kind: WidgetKind,
  w: number,
  h: number,
  seed: number,
  tick: number,
  col: HudColors,
) => {
  const s = mulberry32(seed); // static structure
  const t = tickRng(seed, tick); // ticking values
  const ink = (a: number) => rgba(col.ink, a);
  const acc = (a: number) => rgba(col.accent, a);
  const m = Math.round(w * 0.06);
  ctx.lineWidth = 2;
  ctx.textBaseline = "middle";
  switch (kind) {
    case "bars": {
      const n = 6 + Math.floor(s() * 7);
      const bw = (w - 2 * m) / n;
      ctx.strokeStyle = ink(0.35);
      ctx.beginPath();
      ctx.moveTo(m, h - m);
      ctx.lineTo(w - m, h - m);
      ctx.stroke();
      for (let i = 0; i < n; i++) {
        const v = 0.25 + 0.7 * t();
        ctx.fillStyle = ink(0.7 + 0.3 * s());
        ctx.fillRect(m + i * bw + bw * 0.18, h - m - v * (h - 2.6 * m), bw * 0.64, v * (h - 2.6 * m));
      }
      ctx.font = `600 ${Math.round(h * 0.09)}px "${SANS}"`;
      ctx.fillStyle = ink(0.8);
      ctx.fillText(label(s), m, m * 0.9);
      break;
    }
    case "blocks": {
      // big white blocks in a row, like the reference's bright bar blocks
      const n = 3 + Math.floor(s() * 3);
      const bw = (w - 2 * m) / n;
      for (let i = 0; i < n; i++) {
        const v = 0.45 + 0.5 * t();
        ctx.fillStyle = ink(0.92);
        ctx.fillRect(m + i * bw + 4, h * 0.55 - v * h * 0.35, bw - 8, v * h * 0.35);
        ctx.fillStyle = ink(0.3);
        for (let k = 0; k < 4; k++) ctx.fillRect(m + i * bw + 6, h * 0.62 + k * h * 0.06, (bw - 12) * (0.3 + 0.7 * t()), h * 0.025);
      }
      break;
    }
    case "line": {
      ctx.strokeStyle = ink(0.18);
      ctx.lineWidth = 1.5;
      for (let i = 0; i <= 4; i++) {
        const y = m + (i * (h - 2 * m)) / 4;
        ctx.beginPath();
        ctx.moveTo(m, y);
        ctx.lineTo(w - m, y);
        ctx.stroke();
      }
      const n = 10 + Math.floor(s() * 8);
      const pts: [number, number][] = [];
      let v = 0.5;
      for (let i = 0; i < n; i++) {
        v = Math.min(0.95, Math.max(0.05, v + (t() - 0.5) * 0.45));
        pts.push([m + (i * (w - 2 * m)) / (n - 1), h - m - v * (h - 2 * m)]);
      }
      ctx.strokeStyle = s() < 0.5 ? acc(0.9) : ink(0.9);
      ctx.lineWidth = 3;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
      ctx.fillStyle = ink(0.95);
      for (const [x, y] of pts) {
        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case "bell": {
      const peaks = 1 + Math.floor(s() * 2);
      ctx.strokeStyle = ink(0.4);
      ctx.beginPath();
      ctx.moveTo(m, h - m);
      ctx.lineTo(w - m, h - m);
      ctx.stroke();
      for (let pk = 0; pk < peaks; pk++) {
        const mu = range(s, 0.3, 0.7);
        const sig = range(s, 0.08, 0.16);
        const amp = 0.5 + 0.4 * t();
        ctx.beginPath();
        for (let i = 0; i <= 80; i++) {
          const x = i / 80;
          const y = amp * Math.exp(-((x - mu) ** 2) / (2 * sig * sig));
          const px = m + x * (w - 2 * m);
          const py = h - m - y * (h - 2 * m);
          if (i) ctx.lineTo(px, py);
          else ctx.moveTo(px, py);
        }
        ctx.lineTo(w - m, h - m);
        ctx.lineTo(m, h - m);
        ctx.closePath();
        ctx.fillStyle = ink(0.28);
        ctx.fill();
        ctx.strokeStyle = ink(0.85);
        ctx.lineWidth = 2.5;
        ctx.stroke();
      }
      break;
    }
    case "gauges": {
      const n = 2 + Math.floor(s() * 2);
      const r = Math.min(w / (n * 2.6), h * 0.26);
      for (let i = 0; i < n; i++) {
        const cx = (w / n) * (i + 0.5);
        const cy = h * 0.45;
        const v = 0.15 + 0.8 * t();
        ctx.lineWidth = r * 0.28;
        ctx.strokeStyle = acc(0.35);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = acc(0.95);
        ctx.beginPath();
        ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + v * Math.PI * 2);
        ctx.stroke();
        ctx.font = `400 ${Math.round(r * 0.55)}px "${MONO}"`;
        ctx.fillStyle = ink(0.9);
        ctx.textAlign = "center";
        ctx.fillText(`${Math.round(v * 100)}`, cx, cy);
        ctx.font = `600 ${Math.round(r * 0.42)}px "${SANS}"`;
        ctx.fillText(label(s), cx, cy + r * 1.75);
        ctx.textAlign = "left";
      }
      break;
    }
    case "table": {
      const rows = 6 + Math.floor(s() * 4);
      const rh = (h - 2 * m) / rows;
      ctx.font = `400 ${Math.round(rh * 0.55)}px "${MONO}"`;
      for (let i = 0; i < rows; i++) {
        const y = m + (i + 0.5) * rh;
        ctx.fillStyle = ink(0.75);
        ctx.fillText(label(s), m, y);
        ctx.fillStyle = i % 3 === 0 ? acc(0.9) : ink(0.9);
        ctx.fillText((t() * 999).toFixed(1).padStart(6, " "), w * 0.42, y);
        ctx.fillStyle = ink(0.45);
        ctx.fillRect(w * 0.72, y - rh * 0.18, (w * 0.22) * (0.15 + 0.85 * t()), rh * 0.36);
      }
      break;
    }
    case "box": {
      ctx.strokeStyle = acc(0.9);
      ctx.lineWidth = 3;
      const bx = m;
      const by = h * 0.25;
      const bw = w - 2 * m;
      const bh = h * 0.42;
      const c = bh * 0.25;
      // bracket corners
      ctx.beginPath();
      ctx.moveTo(bx + c, by); ctx.lineTo(bx, by); ctx.lineTo(bx, by + bh); ctx.lineTo(bx + c, by + bh);
      ctx.moveTo(bx + bw - c, by); ctx.lineTo(bx + bw, by); ctx.lineTo(bx + bw, by + bh); ctx.lineTo(bx + bw - c, by + bh);
      ctx.stroke();
      ctx.font = `400 ${Math.round(bh * 0.42)}px "${MONO}"`;
      ctx.fillStyle = ink(0.95);
      ctx.fillText(`${label(s)}  ${(t() * 99).toFixed(2)}`, bx + c * 0.6, by + bh / 2);
      ctx.fillStyle = acc(0.85);
      for (let k = 0; k < 5; k++) ctx.fillRect(bx + k * (bw / 5) + 4, by + bh + h * 0.08, (bw / 5 - 8) * (0.3 + 0.7 * t()), h * 0.05);
      break;
    }
    case "columns": {
      // tall translucent columns with a brighter lower fill (the big bar chart)
      const n = 7 + Math.floor(s() * 5);
      const bw = (w - 2 * m) / n;
      for (let i = 0; i < n; i++) {
        const x = m + i * bw + bw * 0.1;
        ctx.fillStyle = ink(0.4);
        ctx.fillRect(x, m, bw * 0.8, h - 2 * m);
        const v = 0.2 + 0.25 * t();
        ctx.fillStyle = ink(0.8);
        ctx.fillRect(x, h - m - v * (h - 2 * m), bw * 0.8, v * (h - 2 * m));
      }
      ctx.fillStyle = ink(0.85);
      ctx.fillRect(m, m - 14, w * 0.25, 8);
      break;
    }
    case "wave": {
      const n = 40 + Math.floor(s() * 30);
      const bw = (w - 2 * m) / n;
      for (let i = 0; i < n; i++) {
        const v = 0.1 + 0.85 * Math.abs(Math.sin(i * 0.37 + s() * 6)) * (0.4 + 0.6 * t());
        ctx.fillStyle = ink(0.9);
        ctx.fillRect(m + i * bw, h / 2 - (v * (h - 2 * m)) / 2, Math.max(1.5, bw * 0.45), v * (h - 2 * m));
      }
      break;
    }
  }
};

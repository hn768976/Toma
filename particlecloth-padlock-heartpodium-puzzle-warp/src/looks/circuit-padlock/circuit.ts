import { mulberry32 } from "../../lib/random";

// Seeded circuit layout on a wrapping grid. Generated once at module level.
export interface Trace {
  pts: [number, number][]; // cell coords (unwrapped, may run past the edge)
  id: number; // 0..1, drives the trace's pulse
  viaStart: boolean;
  viaEnd: boolean;
}
export interface PadRow {
  x: number;
  y: number;
  n: number;
  dir: [number, number];
}

const DIRS: [number, number][] = [
  [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1],
];

export const makeCircuit = (seed: number, N: number, attempts: number) => {
  const rnd = mulberry32(seed);
  const occ = new Uint8Array(N * N);
  const idx = (x: number, y: number) => (((y % N) + N) % N) * N + (((x % N) + N) % N);
  const traces: Trace[] = [];
  for (let a = 0; a < attempts; a++) {
    let x = Math.floor(rnd() * N);
    let y = Math.floor(rnd() * N);
    if (occ[idx(x, y)]) continue;
    let d = rnd() < 0.75 ? Math.floor(rnd() * 4) * 2 : Math.floor(rnd() * 4) * 2 + 1;
    const target = 4 + Math.floor(Math.pow(rnd(), 1.5) * 26);
    const pts: [number, number][] = [[x, y]];
    const cells = [idx(x, y)];
    let sinceTurn = 0;
    for (let s = 0; s < target; s++) {
      if (sinceTurn > 2 && rnd() < 0.2) {
        d = (d + (rnd() < 0.5 ? 1 : 7)) % 8;
        sinceTurn = 0;
      }
      const nx = x + DIRS[d][0];
      const ny = y + DIRS[d][1];
      // keep a one-cell gap to other traces (side neighbours)
      const px = -DIRS[d][1], py = DIRS[d][0];
      if (occ[idx(nx, ny)] || occ[idx(nx + px, ny + py)] || occ[idx(nx - px, ny - py)]) break;
      x = nx;
      y = ny;
      pts.push([x, y]);
      cells.push(idx(x, y));
      sinceTurn++;
    }
    if (pts.length < 4) continue;
    cells.forEach((c) => (occ[c] = 1));
    traces.push({ pts, id: rnd(), viaStart: rnd() < 0.55, viaEnd: rnd() < 0.85 });
  }
  const pads: PadRow[] = [];
  for (let a = 0; a < 4000; a++) {
    const x = Math.floor(rnd() * N);
    const y = Math.floor(rnd() * N);
    const n = 2 + Math.floor(rnd() * 5);
    const dir: [number, number] = rnd() < 0.5 ? [1, 0] : [0, 1];
    let free = true;
    for (let k = -1; k <= n && free; k++) {
      if (occ[idx(x + dir[0] * k, y + dir[1] * k)]) free = false;
    }
    if (!free) continue;
    for (let k = 0; k < n; k++) occ[idx(x + dir[0] * k, y + dir[1] * k)] = 1;
    pads.push({ x, y, n, dir });
  }
  return { traces, pads };
};

/** simplify straight runs to corner points */
export const corners = (pts: [number, number][]) => {
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    if (b[0] - a[0] !== c[0] - b[0] || b[1] - a[1] !== c[1] - b[1]) out.push(b);
  }
  out.push(pts[pts.length - 1]);
  return out;
};

/**
 * Draws the circuit into an RGBA canvas:
 *   R = trace / pad mask, G = trace id (for the pulse), B = soft under-glow
 * Everything is drawn at 9 wrapped offsets so the texture tiles seamlessly.
 */
export const drawCircuit = (
  size: number,
  N: number,
  circuit: ReturnType<typeof makeCircuit>,
  opts: { line: number; ring: number; ringLine: number; glow: number },
) => {
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.fillRect(0, 0, size, size);
  const cell = size / N;
  const P = (p: [number, number]) => [(p[0] + 0.5) * cell, (p[1] + 0.5) * cell] as const;
  const offsets: [number, number][] = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) offsets.push([i * size, j * size]);

  const pass = (glow: boolean) => {
    for (const [ox, oy] of offsets) {
      ctx.save();
      ctx.translate(ox, oy);
      for (const t of circuit.traces) {
        const g = Math.round(40 + t.id * 215);
        const col = glow ? `rgb(0,0,255)` : `rgb(255,${g},0)`;
        ctx.strokeStyle = col;
        ctx.lineWidth = glow ? opts.line * 5 : opts.line;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        const cs = corners(t.pts);
        ctx.beginPath();
        cs.forEach((p, i) => {
          const [x, y] = P(p);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.stroke();
        const ends: [number, number][] = [];
        if (t.viaStart) ends.push(t.pts[0]);
        if (t.viaEnd) ends.push(t.pts[t.pts.length - 1]);
        for (const e of ends) {
          const [x, y] = P(e);
          ctx.beginPath();
          ctx.arc(x, y, opts.ring, 0, Math.PI * 2);
          ctx.fillStyle = "rgb(0,0,0)";
          if (!glow) ctx.fill();
          ctx.lineWidth = glow ? opts.ringLine * 4 : opts.ringLine;
          ctx.stroke();
        }
      }
      for (const p of circuit.pads) {
        for (let k = 0; k < p.n; k++) {
          const [x, y] = P([p.x + p.dir[0] * k, p.y + p.dir[1] * k]);
          ctx.beginPath();
          ctx.arc(x, y, opts.ring * 0.85, 0, Math.PI * 2);
          ctx.strokeStyle = glow ? "rgb(0,0,255)" : "rgb(255,128,0)";
          ctx.lineWidth = glow ? opts.ringLine * 4 : opts.ringLine;
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  };
  // glow layer first (blue channel only): draw thick lines, blur once
  pass(true);
  const sharpGlow = document.createElement("canvas");
  sharpGlow.width = size;
  sharpGlow.height = size;
  sharpGlow.getContext("2d")!.drawImage(cv, 0, 0);
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.fillRect(0, 0, size, size);
  ctx.save();
  ctx.filter = `blur(${opts.glow}px)`;
  ctx.drawImage(sharpGlow, 0, 0);
  ctx.restore();
  const glowData = ctx.getImageData(0, 0, size, size);
  ctx.fillStyle = "rgb(0,0,0)";
  ctx.fillRect(0, 0, size, size);
  pass(false);
  const lineData = ctx.getImageData(0, 0, size, size);
  const d = lineData.data;
  const gd = glowData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i + 2] = gd[i + 2];
    d[i + 3] = 255;
  }
  ctx.putImageData(lineData, 0, 0);
  return cv;
};

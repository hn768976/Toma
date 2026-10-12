import { DrawFn } from "../lib/CanvasLook";
import { HUD, MONO, SANS } from "../lib/fonts";
import { cyc, digits, hash3, hashF, holdBucket, loopFrame, mulberry32, TAU } from "../lib/random";

export type RadialHudProps = {
  greys: [string, string, string, string]; // ring segments, dark → light
  text: string; // bright text and lines
  dim: string; // secondary text / thin lines
  faint: string; // tertiary lines
  counter: string; // big counters
  bar: string; // data bars
  accent: string; // gauge / small accent colour
  accentDark: string; // dark accent blocks on the inner band
};

const rnd = mulberry32(0x1065680);

// Ring segment patterns (fractions of the repeat angle): [start, length, grey index, striped]
type Seg = { s: number; l: number; g: number; striped: boolean; k: number; ph: number };
const mkSegs = (n: number, gap: number): Seg[] => {
  const segs: Seg[] = [];
  let s = 0;
  const lens = Array.from({ length: n }, () => 0.5 + rnd());
  const tot = lens.reduce((a, b) => a + b, 0);
  for (let i = 0; i < n; i++) {
    const l = (lens[i] / tot) * (1 - gap * n);
    segs.push({ s, l, g: Math.floor(rnd() * 4), striped: rnd() < 0.45, k: 1 + Math.floor(rnd() * 3), ph: rnd() });
    s += l + gap;
  }
  return segs;
};
const SEG_OUTER = mkSegs(7, 0.025); // repeats twice (180°)
const SEG_INNER = mkSegs(5, 0.03); // repeats three times (120°)

// Labels on the text ring: angle (deg, 0 = right, clockwise), length, kind
const LABELS: { a: number; n: number; yellow: boolean; hold: number }[] = [
  { a: 128, n: 4, yellow: false, hold: 0 },
  { a: 140, n: 3, yellow: true, hold: 12 },
  { a: 152, n: 2, yellow: false, hold: 0 },
  { a: 163, n: 5, yellow: false, hold: 30 },
  { a: 177, n: 4, yellow: false, hold: 0 },
  { a: 192, n: 2, yellow: false, hold: 0 },
  { a: 204, n: 4, yellow: false, hold: 20 },
  { a: 218, n: 3, yellow: false, hold: 0 },
  { a: 230, n: 4, yellow: false, hold: 0 },
  { a: 246, n: 3, yellow: true, hold: 15 },
  { a: 262, n: 5, yellow: false, hold: 24 },
  { a: 280, n: 2, yellow: false, hold: 0 },
  { a: 295, n: 4, yellow: false, hold: 40 },
];
const BOTTOM_NUMS = [4, 5, 2, 7, 3, 3];

export const drawRadialHud: DrawFn<RadialHudProps> = (ctx, w, h, frame, c) => {
  const f = loopFrame(frame);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  const H = (v: number) => v * h;
  const R = (v: number) => Math.round(v);
  const lw = (v: number) => Math.max(1, v * h);
  const cx = 0.285 * w;
  const cy = 0.47 * h;

  // ---------------------------------------------------- background marks --
  // tiny grid crosses (no full grid: the black between marks stays 0,0,0)
  ctx.fillStyle = c.faint;
  const gs = H(0.0555);
  const cs = Math.max(1, R(H(0.003)));
  for (let gy = gs; gy < h; gy += gs)
    for (let gx = gs * 0.5; gx < w; gx += gs) {
      ctx.fillRect(R(gx), R(gy), 1, 1);
      if (((gx / gs) | 0) % 4 === 0 && ((gy / gs) | 0) % 3 === 0) {
        ctx.fillRect(R(gx) - cs, R(gy), cs * 2 + 1, 1);
        ctx.fillRect(R(gx), R(gy) - cs, 1, cs * 2 + 1);
      }
    }

  const arc = (r: number, a0: number, a1: number, width: number, color: string) => {
    ctx.beginPath();
    ctx.arc(cx, cy, r, a0, a1);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
  };
  const ticks = (n: number, r0: number, r1: number, rot: number, color: string, width: number, every = 0, rLong = r1) => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU;
      const re = every && i % every === 0 ? rLong : r1;
      ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
      ctx.lineTo(cx + Math.cos(a) * re, cy + Math.sin(a) * re);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  };
  const segRing = (segs: Seg[], rep: number, rot: number, r0: number, r1: number) => {
    const span = TAU / rep;
    for (let k = 0; k < rep; k++)
      for (const s of segs) {
        // lengths breathe in whole cycles per loop
        const grow = 0.78 + 0.22 * Math.sin(TAU * cyc(f, s.k, s.ph));
        const a0 = rot + k * span + s.s * span;
        const a1 = a0 + s.l * span * grow;
        // smoky translucent panel: dark inside, brighter towards the outer edge,
        // with segments stepping in and out
        const step = (s.g - 1.5) * (r1 - r0) * 0.12;
        const ro = r1 + step;
        const ri = r0 + (s.striped ? (r1 - r0) * 0.25 : 0);
        const grad = ctx.createRadialGradient(cx, cy, ri, cx, cy, ro);
        grad.addColorStop(0, c.greys[0]);
        grad.addColorStop(1, c.greys[Math.min(3, s.g + 1)]);
        ctx.beginPath();
        ctx.arc(cx, cy, ro, a0, a1);
        ctx.arc(cx, cy, ri, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.globalAlpha = 0.18 + 0.07 * s.g;
        ctx.fill();
        // thin bright outer lip
        ctx.beginPath();
        ctx.arc(cx, cy, ro, a0, a1);
        ctx.strokeStyle = c.greys[3];
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = lw(0.0022);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
  };

  const D = (v: number) => v * h * 0.96; // dial scale
  // ---------------------------------------------------------------- dial --
  // A: outer thin arc that sweeps out into lines (as in the reference)
  const rA = D(0.452);
  ctx.lineWidth = lw(0.0012);
  ctx.strokeStyle = c.dim;
  ctx.beginPath();
  ctx.arc(cx, cy, rA, Math.PI * 1.12, Math.PI * 1.5);
  ctx.lineTo(0.5 * w, cy - rA);
  ctx.lineTo(0.5 * w, cy - rA + D(0.012));
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, rA, Math.PI * 0.5, Math.PI * 0.9);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx, cy + rA);
  ctx.lineTo(0.43 * w, cy + rA);
  ctx.quadraticCurveTo(0.45 * w, cy + rA, 0.455 * w, cy + rA - D(0.03));
  ctx.lineTo(0.47 * w, cy + D(0.26));
  ctx.lineTo(0.56 * w, cy + D(0.26));
  ctx.stroke();
  // sweeps from the left frame edge into the arc
  const ax0 = cx + Math.cos(Math.PI * 1.12) * rA, ay0 = cy + Math.sin(Math.PI * 1.12) * rA;
  ctx.beginPath();
  ctx.moveTo(ax0, ay0);
  ctx.bezierCurveTo(ax0 - D(0.04), ay0 - D(0.08), 0.06 * w, cy - D(0.16), 0, cy - D(0.165));
  ctx.stroke();
  const ax1 = cx + Math.cos(Math.PI * 0.9) * rA, ay1 = cy + Math.sin(Math.PI * 0.9) * rA;
  ctx.beginPath();
  ctx.moveTo(ax1, ay1);
  ctx.bezierCurveTo(ax1 - D(0.03), ay1 - D(0.12), 0.05 * w, cy + D(0.05), 0, cy + D(0.05));
  ctx.stroke();

  // B: text ring (labels + yellow rim counters), one turn per loop
  const rotText = -TAU * cyc(f, 1);
  const rB = D(0.375);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  LABELS.forEach((L, i) => {
    const a = (L.a * Math.PI) / 180 + rotText;
    const val = L.hold ? digits(L.n, 900 + i, 0, holdBucket(f, L.hold, i % L.hold)) : digits(L.n, 900 + i);
    ctx.save();
    ctx.translate(cx + Math.cos(a) * (L.yellow ? rB + D(0.008) : rB), cy + Math.sin(a) * (L.yellow ? rB + D(0.008) : rB));
    ctx.rotate(a + Math.PI / 2);
    if (L.yellow) {
      ctx.font = `600 ${R(D(0.046))}px ${HUD}`;
      ctx.fillStyle = c.counter;
    } else {
      ctx.font = `600 ${R(D(0.025))}px ${HUD}`;
      ctx.fillStyle = i % 3 === 1 ? c.dim : c.text;
    }
    ctx.fillText(val, 0, 0);
    ctx.restore();
  });

  // C: broad translucent grey segments, pattern repeats twice → half a turn per loop
  segRing(SEG_OUTER, 2, TAU * 0.5 * cyc(f, 1), D(0.3), D(0.367));
  // radial blade sector inside the upper-left of the ring (one turn per loop)
  {
    const a0 = Math.PI * 1.08 + TAU * cyc(f, 1);
    for (let k = 0; k < 26; k++) {
      const a = a0 + k * 0.026;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * D(0.2), cy + Math.sin(a) * D(0.2));
      ctx.lineTo(cx + Math.cos(a) * D(0.262), cy + Math.sin(a) * D(0.262));
      ctx.strokeStyle = c.greys[2];
      ctx.globalAlpha = 0.12 + 0.18 * ((k * 7) % 5) / 4;
      ctx.lineWidth = lw(0.0035);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  // D: 180-tick ring, 12 ticks per loop
  ticks(180, D(0.284), D(0.29), (TAU / 180) * 12 * cyc(f, 1), c.dim, lw(0.0011), 5, D(0.295));

  // E: dark band with accent blocks, pattern repeats three times → a third of a turn back
  arc(D(0.271), 0, TAU, D(0.018), "#141414");
  const rotE = -(TAU / 3) * cyc(f, 1);
  for (let k = 0; k < 3; k++)
    for (const [a0, l] of [[0.1, 0.22], [0.62, 0.12], [1.05, 0.3], [1.6, 0.08]]) {
      const a = rotE + (k * TAU) / 3 + a0;
      arc(D(0.271), a, a + l * (0.8 + 0.2 * Math.sin(TAU * cyc(f, k + 1, a0))), D(0.014), c.accentDark);
    }
  segRing(SEG_INNER, 3, rotE, D(0.258), D(0.262));

  // F: 72-tick ring, six ticks back per loop
  ticks(72, D(0.243), D(0.25), -(TAU / 72) * 6 * cyc(f, 1), c.text, lw(0.0012));

  // G: dashed ring, 48 dashes, eight dashes per loop
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((TAU / 48) * 8 * cyc(f, 1));
  ctx.beginPath();
  ctx.arc(0, 0, D(0.234), 0, TAU);
  const circ = TAU * D(0.234);
  ctx.setLineDash([(circ / 48) * 0.5, (circ / 48) * 0.5]);
  ctx.lineWidth = lw(0.0024);
  ctx.strokeStyle = c.greys[1];
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();

  // tiny text ring
  ctx.font = `400 ${R(D(0.0105))}px ${MONO}`;
  ctx.fillStyle = c.dim;
  for (let k = 0; k < 10; k++) {
    const a = ((k + 0.3) * TAU) / 10 + TAU * cyc(f, -1);
    ctx.save();
    ctx.translate(cx + Math.cos(a) * D(0.221), cy + Math.sin(a) * D(0.221));
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(`${digits(4, 40 + k)} ${digits(3, 50 + k, 0, holdBucket(f, 20, k))}`, 0, 0);
    ctx.restore();
  }

  // H: inner track, data trace with accent dots, crosshair marks
  arc(D(0.205), 0, TAU, lw(0.0011), c.dim);
  arc(D(0.16), 0, TAU, lw(0.0008), c.faint);
  const sweep = TAU * cyc(f, 2);
  arc(D(0.212), sweep, sweep + 0.7, lw(0.003), c.greys[2]);
  ctx.beginPath();
  for (let k = 0; k <= 120; k++) {
    const a = (k / 120) * TAU;
    const rr = D(0.18) + D(0.018) * Math.sin(a * 5 + TAU * cyc(f, 1)) * Math.sin(a * 2 - TAU * cyc(f, 2));
    const X = cx + Math.cos(a) * rr, Y = cy + Math.sin(a) * rr;
    if (k) ctx.lineTo(X, Y);
    else ctx.moveTo(X, Y);
  }
  ctx.setLineDash([D(0.004), D(0.004)]);
  ctx.strokeStyle = c.faint;
  ctx.lineWidth = lw(0.001);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = c.accent;
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * TAU + TAU * cyc(f, 1) * (k % 2 ? 1 : -1);
    const rr = D(0.18) + D(0.018) * Math.sin(a * 5 + TAU * cyc(f, 1)) * Math.sin(a * 2 - TAU * cyc(f, 2));
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, D(0.0028), 0, TAU);
    ctx.fill();
  }
  // extra rings of tiny text and point lights (inside the dial)
  ctx.font = `600 ${R(D(0.0115))}px ${HUD}`;
  [0.19, 0.255, 0.3].forEach((rr, ri) => {
    const n = [14, 18, 22][ri];
    for (let k = 0; k < n; k++) {
      if (hash3(k, ri, 3) % 3 === 0) continue;
      const a = (k / n) * TAU + TAU * cyc(f, ri === 1 ? 1 : -1) / [2, 3, 2][ri];
      ctx.save();
      ctx.translate(cx + Math.cos(a) * D(rr), cy + Math.sin(a) * D(rr));
      ctx.rotate(a + Math.PI / 2);
      ctx.fillStyle = k % 4 === 0 ? c.text : c.dim;
      ctx.fillText(digits(2 + (hash3(k, ri) % 4), 600 + ri * 40 + k, 0, holdBucket(f, [20, 30, 24][ri], k % 20)), 0, 0);
      ctx.restore();
    }
  });
  for (let k = 0; k < 46; k++) {
    const rr = D(0.17 + 0.17 * hashF(k, 1));
    const a = TAU * hashF(k, 2) + TAU * cyc(f, k % 3 === 0 ? 1 : -1) / 2;
    const tw = 0.5 + 0.5 * Math.sin(TAU * cyc(f, 1 + (k % 4), hashF(k, 3)));
    ctx.globalAlpha = 0.4 + 0.6 * tw;
    ctx.fillStyle = k % 9 === 0 ? "#E8803A" : k % 2 ? c.accent : c.text;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.max(0.8, D(0.0022)), 0, TAU);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#E85A2A";
  ctx.beginPath();
  ctx.arc(cx - D(0.235), cy, D(0.004), 0, TAU);
  ctx.fill();

  // -------------------------------------------------------- readout line --
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  const ly = R(cy) + 0.5;
  ctx.strokeStyle = c.dim;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(R(cx + H(0.29)), ly);
  ctx.lineTo(R(0.455 * w), ly);
  ctx.moveTo(R(0.6 * w), ly + R(H(0.03)));
  ctx.lineTo(R(0.985 * w), ly + R(H(0.03)));
  ctx.stroke();
  // short vertical marks along it
  ctx.fillStyle = c.text;
  [0.865, 0.874].forEach((x) => ctx.fillRect(R(x * w), R(cy - H(0.018)), Math.max(1, R(H(0.0015))), R(H(0.036))));
  ctx.fillStyle = "#E85A2A";
  ctx.beginPath();
  ctx.arc(R(0.452 * w), R(cy), H(0.0045), 0, TAU);
  ctx.fill();
  const bigFont = R(H(0.044));
  ctx.font = `600 ${bigFont}px ${HUD}`;
  ctx.fillStyle = c.counter;
  const big = digits(3, 7001, 0, holdBucket(f, 15));
  ctx.fillText(big, R(0.466 * w), R(cy + bigFont * 0.36));
  let x = 0.466 * w + ctx.measureText(big).width + H(0.035);
  const mid = R(H(0.026));
  [5, 5, 2, 7, 3].forEach((n, i) => {
    ctx.font = `600 ${mid}px ${HUD}`;
    const s = digits(n, 7100 + i, 0, holdBucket(f, [10, 20, 30, 12, 24][i], i));
    ctx.fillStyle = i === 3 ? c.text : c.text;
    ctx.fillText(s, R(x), R(cy + mid * 0.36));
    x += ctx.measureText(s).width + H(0.026);
  });

  // ---------------------------------------------------- right data block --
  const small = R(H(0.0125));
  const tiny = R(H(0.0102));
  const label = (s: string, X: number, Y: number, color = c.text, font = SANS, size = small, weight = 500) => {
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.fillStyle = color;
    ctx.fillText(s, R(X * w), R(Y * h));
  };
  const hline = (x0: number, x1: number, y: number, color = c.dim) => {
    ctx.fillStyle = color;
    ctx.fillRect(R(x0 * w), R(y * h), R((x1 - x0) * w), 1);
  };
  const vline = (x: number, y0: number, y1: number, color = c.dim) => {
    ctx.fillStyle = color;
    ctx.fillRect(R(x * w), R(y0 * h), 1, R((y1 - y0) * h));
  };

  // sector header row
  vline(0.585, 0.045, 0.3);
  hline(0.585, 0.69, 0.045);
  label("ANALYSIS PROCESSING MODE", 0.6, 0.07, c.dim, MONO, tiny, 400);
  for (let i = 0; i < 4; i++) {
    const X = 0.74 + i * 0.058;
    label(`SECTOR ${String(i + 1).padStart(2, "0")}`, X, 0.05, c.dim, MONO, tiny, 400);
    vline(X - 0.004, 0.035, 0.095, c.faint);
    label(digits(2, 300 + i, 0, holdBucket(f, [20, 24, 30, 40][i], i * 3)), X, 0.095, c.accent, HUD, R(H(0.03)), 600);
  }
  // three column blocks with bars
  const cols = [0.6, 0.745, 0.885];
  const titles = ["DATA POINT", "ACCESS POINT", "ACCESS POINT"];
  cols.forEach((X, ci) => {
    label(titles[ci], X, 0.145, c.text, SANS, small, 600);
    label(`${digits(2, 400 + ci)} ${digits(2, 410 + ci, 0, holdBucket(f, 30, ci * 5))}`, X + 0.065, 0.145, c.dim, MONO, small, 400);
    hline(X, X + 0.1, 0.155, c.faint);
    for (let r = 0; r < 4; r++) {
      const Y = 0.175 + r * 0.022;
      label(`${digits(3, 500 + ci * 10 + r)}  ${digits(4, 520 + ci * 10 + r, 0, holdBucket(f, 24, r * 4))}`, X, Y, c.dim, MONO, tiny, 400);
      const bw = 0.012 + 0.03 * ((hash3(ci, r, holdBucket(f, 20, (ci * 7 + r * 3) % 20)) % 1000) / 1000);
      ctx.fillStyle = r % 2 ? c.bar : c.dim;
      ctx.fillRect(R((X + 0.052) * w), R((Y - 0.008) * h), R(bw * w), Math.max(1, R(H(0.004))));
    }
  });
  // left mini labels with bars
  ["AAH", "ADS", "DTS"].forEach((s, i) => {
    const Y = 0.17 + i * 0.03;
    label(s, 0.55, Y, c.text, SANS, tiny, 600);
    hline(0.565, 0.585, Y - 0.004, c.dim);
  });
  // small gauge row (top)
  for (let i = 0; i < 4; i++) {
    const gx = (0.605 + i * 0.022) * w;
    const gy = 0.33 * h;
    ctx.beginPath();
    ctx.arc(gx, gy, H(0.008), 0, TAU);
    ctx.strokeStyle = c.faint;
    ctx.lineWidth = lw(0.0015);
    ctx.stroke();
    const fill = 0.5 + 0.45 * Math.sin(TAU * cyc(f, i + 1, i * 0.21));
    ctx.beginPath();
    ctx.arc(gx, gy, H(0.008), -Math.PI / 2, -Math.PI / 2 + fill * TAU);
    ctx.strokeStyle = c.accent;
    ctx.stroke();
  }
  hline(0.7, 0.98, 0.33, c.faint);

  // system analysis block under the readout
  label("SYSTEM ANALYSIS", 0.585, 0.545, c.accent, SANS, tiny, 600);
  for (let r = 0; r < 3; r++)
    label(`${digits(5, 600 + r, 0, holdBucket(f, 30, r * 7))}  ${digits(2, 610 + r)}  ${digits(3, 620 + r, 0, holdBucket(f, 20, r))}  ${digits(4, 630 + r)}`, 0.585, 0.57 + r * 0.02, c.dim, MONO, tiny, 400);
  ctx.strokeStyle = c.dim;
  ctx.lineWidth = 1;
  ctx.strokeRect(R(0.58 * w) + 0.5, R(0.625 * h) + 0.5, R(0.06 * w), R(0.03 * h));
  label(`PTA  ${digits(2, 700)} ${digits(2, 701, 0, holdBucket(f, 25))}`, 0.586, 0.646, c.text, MONO, small, 500);
  label("MODE: TRACKING   SIGNAL: STABLE", 0.586, 0.68, c.dim, MONO, tiny, 400);
  vline(0.575, 0.62, 0.78, c.faint);
  hline(0.575, 0.6, 0.78, c.faint);

  ctx.strokeRect(R(0.855 * w) + 0.5, R(0.655 * h) + 0.5, R(0.065 * w), R(0.03 * h));
  label(`STA  ${digits(2, 710)} ${digits(2, 711, 0, holdBucket(f, 30, 9))}`, 0.861, 0.676, c.text, MONO, small, 500);
  for (let r = 0; r < 3; r++) label(digits(8, 720 + r, 0, holdBucket(f, 40, r * 11)), 0.861, 0.71 + r * 0.02, c.dim, MONO, tiny, 400);

  // green data bars block
  for (let r = 0; r < 4; r++) {
    const Y = 0.75 + r * 0.016;
    const bw = 0.02 + 0.06 * ((hash3(77, r, holdBucket(f, 12, r * 3)) % 1000) / 1000);
    ctx.fillStyle = r === 1 ? c.bar : c.dim;
    ctx.fillRect(R(0.86 * w), R(Y * h), R(bw * w), Math.max(1, R(H(0.005))));
    ctx.fillStyle = c.faint;
    ctx.fillRect(R((0.86 + bw + 0.004) * w), R(Y * h), R((0.08 - bw) * w), 1);
  }
  vline(0.855, 0.74, 0.82, c.faint);

  // four ring gauges (bottom right)
  label("DATA ANALYSIS", 0.62, 0.855, c.dim, MONO, tiny, 400);
  for (let i = 0; i < 4; i++) {
    const gx = (0.72 + i * 0.038) * w;
    const gy = 0.85 * h;
    const r = H(0.016);
    ctx.beginPath();
    ctx.arc(gx, gy, r, 0, TAU);
    ctx.strokeStyle = c.faint;
    ctx.lineWidth = lw(0.0018);
    ctx.stroke();
    const fill = 0.5 + 0.45 * Math.sin(TAU * cyc(f, [1, 2, 1, 3][i], i * 0.27));
    ctx.beginPath();
    ctx.arc(gx, gy, r, -Math.PI / 2, -Math.PI / 2 + fill * TAU);
    ctx.strokeStyle = c.accent;
    ctx.stroke();
  }
  hline(0.86, 0.98, 0.885, c.faint);
  label(`${digits(4, 800)} . ${digits(3, 801, 0, holdBucket(f, 20))}`, 0.88, 0.875, c.dim, MONO, tiny, 400);

  // ---------------------------------------------------- bottom baseline --
  const by = 0.955;
  hline(0.01, 0.985, by, c.faint);
  let bx = 0.015;
  BOTTOM_NUMS.forEach((n, i) => {
    const s = digits(n, 850 + i, 0, holdBucket(f, [20, 30, 15, 40, 24, 12][i], i * 2));
    label(s, bx, by - 0.008, c.dim, HUD, R(H(0.015)), 600);
    bx += 0.01 + n * 0.0047;
  });
  for (let i = 0; i < 40; i++) {
    const X = 0.32 + i * 0.016;
    vline(X, by - (i % 5 === 0 ? 0.012 : 0.006), by, c.dim);
  }
  ctx.beginPath();
  ctx.arc(R(0.255 * w), R(by * h), H(0.017), 0, TAU);
  ctx.strokeStyle = c.dim;
  ctx.lineWidth = 1;
  ctx.stroke();
  // moving marker along the baseline (one pass per loop, wraps off-screen)
  const mx = 0.32 + 0.64 * cyc(f, 1);
  ctx.fillStyle = c.text;
  ctx.fillRect(R(mx * w), R((by - 0.016) * h), Math.max(1, R(H(0.002))), R(H(0.016)));
};

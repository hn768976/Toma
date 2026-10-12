import { clamp, DEG, smoothstep, TAU } from "../common/random";
import { ChargeGaugeRow } from "../versions";

// Look 5 artwork, drawn flat on a 2400 x 1600 design plane. Everything is a
// function of the frame number.

export const PW = 2400;
export const PH = 1600;
export const FONT = "Exo2Gauge";

const DIAL_C = { x: 1130, y: 830 };
const DIAL_R = 640;
const ARC_START = 145 * DEG; // canvas angles, clockwise from +x
const ARC_SWEEP = 250 * DEG;
const TICKS = 120;

// timeline (frames at 30 fps)
const DRAW_ON = 18;
const FILL_START = 18;
const FILL_END = 270;

export const levelAt = (f: number) => {
  if (f < FILL_START) return 5;
  // gentle ease-in-out
  const t = clamp((f - FILL_START) / (FILL_END - FILL_START));
  const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  return 5 + 95 * (0.15 * t + 0.85 * e);
};
// whole numbers; monotonic because levelAt is monotonic
export const percentAt = (f: number) => Math.min(100, Math.floor(levelAt(f) + 1e-9));

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const bolt = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number) => {
  ctx.beginPath();
  ctx.moveTo(x + 0.25 * s, y - 0.5 * s);
  ctx.lineTo(x - 0.28 * s, y + 0.08 * s);
  ctx.lineTo(x + 0.02 * s, y + 0.08 * s);
  ctx.lineTo(x - 0.2 * s, y + 0.55 * s);
  ctx.lineTo(x + 0.3 * s, y - 0.05 * s);
  ctx.lineTo(x + 0.0 * s, y - 0.05 * s);
  ctx.closePath();
};

const chevron = (ctx: CanvasRenderingContext2D, x: number, y: number, s: number, dir: 1 | -1) => {
  ctx.beginPath();
  ctx.moveTo(x - 0.25 * s * dir, y - 0.4 * s);
  ctx.lineTo(x + 0.2 * s * dir, y);
  ctx.lineTo(x - 0.25 * s * dir, y + 0.4 * s);
  ctx.lineWidth = 0.16 * s;
  ctx.lineJoin = "miter";
  ctx.stroke();
};

export const drawGauge = (ctx: CanvasRenderingContext2D, row: ChargeGaugeRow, f: number) => {
  ctx.clearRect(0, 0, PW, PH);
  const appear = smoothstep(0, DRAW_ON, f);
  const sweep = smoothstep(0, DRAW_ON, f);
  const level = levelAt(f);
  const pct = percentAt(f);
  const flash = f >= FILL_END ? Math.exp(-(f - FILL_END) / 4) : 0;
  const full = smoothstep(FILL_END - 6, FILL_END, f);
  const dialCol = row.dial;

  ctx.save();
  ctx.globalAlpha = appear;
  ctx.lineCap = "butt";

  // ---- outer thin ring (partial, like the reference)
  ctx.shadowColor = rgba(dialCol, 0.8);
  ctx.shadowBlur = 26;
  ctx.strokeStyle = rgba(dialCol, 0.55);
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(DIAL_C.x, DIAL_C.y, DIAL_R + 120, ARC_START - 8 * DEG, ARC_START - 8 * DEG + ARC_SWEEP * 0.62 * sweep);
  ctx.stroke();

  // ---- main ring line and soft glow band
  ctx.strokeStyle = rgba(dialCol, 0.7);
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(DIAL_C.x, DIAL_C.y, DIAL_R + 26, ARC_START, ARC_START + ARC_SWEEP * sweep);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(dialCol, 0.08);
  ctx.lineWidth = 70;
  ctx.beginPath();
  ctx.arc(DIAL_C.x, DIAL_C.y, DIAL_R - 10, ARC_START, ARC_START + ARC_SWEEP * sweep);
  ctx.stroke();

  // ---- ticks (120, every 10th long) sweeping round in 18 frames
  const shown = Math.floor(TICKS * sweep + 1e-9);
  ctx.shadowColor = rgba(dialCol, 0.9);
  ctx.shadowBlur = 10;
  for (let i = 0; i <= Math.min(TICKS, shown); i++) {
    const a = ARC_START + (ARC_SWEEP * i) / TICKS;
    const long = i % 10 === 0;
    const r0 = DIAL_R - (long ? 62 : 32);
    const r1 = DIAL_R;
    ctx.strokeStyle = rgba(dialCol, long ? 0.85 : 0.7);
    ctx.lineWidth = long ? 7 : 5;
    ctx.beginPath();
    ctx.moveTo(DIAL_C.x + r0 * Math.cos(a), DIAL_C.y + r0 * Math.sin(a));
    ctx.lineTo(DIAL_C.x + r1 * Math.cos(a), DIAL_C.y + r1 * Math.sin(a));
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = appear;

  // ---- top: bolt with chevrons pulsing inward
  const by = 440;
  const bx = DIAL_C.x + 20;
  ctx.shadowColor = rgba("#3AA0FF", 1);
  ctx.shadowBlur = 30 + 50 * full + 60 * flash;
  ctx.fillStyle = full > 0 ? `rgba(${Math.round(42 + 140 * full)},${Math.round(150 + 80 * full)},255,1)` : "#2A96FF";
  bolt(ctx, bx, by, 110);
  ctx.fill();
  const charging = f >= FILL_START && f < FILL_END;
  for (let i = 0; i < 3; i++) {
    // i = 0 is the outermost chevron; the bright pulse moves inward
    const ph = (f / 24 - i / 3) % 1;
    const pulse = charging ? 0.25 + 0.75 * Math.pow(0.5 + 0.5 * Math.cos(TAU * ph), 3) : full * 0.35;
    ctx.strokeStyle = rgba("#3A8CFF", pulse);
    ctx.shadowBlur = 16;
    chevron(ctx, bx - 200 + i * 48, by + 10, 60, 1);
    chevron(ctx, bx + 200 - i * 48, by + 10, 60, -1);
  }

  // ---- car-battery pictogram (box + two terminal stubs)
  ctx.shadowColor = "rgba(255,255,255,0.6)";
  ctx.shadowBlur = 14;
  ctx.fillStyle = "#F4F8FF";
  const px = 640;
  const py = 760;
  ctx.fillRect(px, py, 150, 92);
  ctx.fillRect(px + 18, py - 20, 30, 20);
  ctx.fillRect(px + 102, py - 20, 30, 20);
  ctx.fillStyle = "#0A1420";
  ctx.shadowBlur = 0;
  ctx.fillRect(px + 22, py + 30, 26, 7); // minus
  ctx.fillRect(px + 102, py + 30, 26, 7); // plus
  ctx.fillRect(px + 111, py + 21, 8, 25);

  // ---- bar
  const bx0 = 860;
  const by0 = 760;
  const bw = 700;
  const bh = 96;
  ctx.shadowColor = rgba(dialCol, 0.9);
  ctx.shadowBlur = 16;
  ctx.strokeStyle = rgba("#7FD0FF", 0.85);
  ctx.lineWidth = 5;
  ctx.strokeRect(bx0, by0, bw, bh);
  const inset = 12;
  const fw = (bw - inset * 2) * (level / 100);
  if (fw > 0.5) {
    const fx = bx0 + inset;
    const fy = by0 + inset;
    const fh = bh - inset * 2;
    const g = ctx.createLinearGradient(fx, 0, fx + bw, 0);
    g.addColorStop(0, "#3E8EE8");
    g.addColorStop(1, "#9FE0FF");
    ctx.shadowBlur = 22;
    ctx.fillStyle = g;
    ctx.fillRect(fx, fy, fw, fh);
    ctx.shadowBlur = 0;
    // fine vertical stripes
    ctx.fillStyle = "rgba(10,40,80,0.35)";
    for (let x = fx + 6; x < fx + fw - 4; x += 14) ctx.fillRect(x, fy, 4, fh);
    // top sheen
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    ctx.fillRect(fx, fy, fw, fh * 0.3);
    // bright leading edge
    ctx.shadowColor = "rgba(200,240,255,1)";
    ctx.shadowBlur = 24;
    ctx.fillStyle = "rgba(235,250,255,0.95)";
    ctx.fillRect(fx + fw - 7, fy - 4, 7, fh + 8);
    // flash at 100 %
    if (flash > 0.001) {
      ctx.shadowBlur = 40;
      ctx.fillStyle = `rgba(230,248,255,${0.75 * flash})`;
      ctx.fillRect(fx, fy, fw, fh);
    }
  }

  // ---- percentage ("40 %")
  ctx.shadowColor = rgba(row.percent, 0.7);
  ctx.shadowBlur = 12;
  ctx.fillStyle = row.percent;
  ctx.font = `600 78px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${pct} %`, bx0 + bw / 2, by0 + bh + 100);

  // ---- leaf + "ECO Mode"
  const lx = 760;
  const ly = 1090;
  ctx.shadowColor = rgba(row.eco, 0.6);
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#24A84C";
  ctx.beginPath();
  ctx.moveTo(lx - 95, ly + 48);
  ctx.bezierCurveTo(lx - 110, ly - 40, lx - 10, ly - 70, lx + 105, ly - 58);
  ctx.bezierCurveTo(lx + 95, ly + 20, lx + 10, ly + 75, lx - 95, ly + 48);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#0E3A1C";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(lx - 80, ly + 40);
  ctx.quadraticCurveTo(lx + 10, ly - 5, lx + 90, ly - 50);
  ctx.stroke();
  ctx.shadowColor = rgba(row.eco, 0.6);
  ctx.shadowBlur = 10;
  ctx.fillStyle = row.eco;
  ctx.font = `600 92px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("ECO Mode", lx + 150, ly + 34);

  // ---- "Power" + 12 short bars lit in step with the charge
  const pwx = 1800;
  const pwy = 1000;
  ctx.fillStyle = rgba(dialCol, 0.8);
  ctx.shadowColor = rgba(dialCol, 0.6);
  ctx.font = `600 70px ${FONT}`;
  ctx.textAlign = "left";
  ctx.fillText("Power", pwx, pwy);
  const lit = Math.round((12 * level) / 100);
  for (let i = 0; i < 12; i++) {
    // bottom bar first
    const y = pwy + 50 + (11 - i) * 30;
    const on = i < lit;
    ctx.shadowBlur = on ? 14 : 0;
    ctx.fillStyle = on ? rgba("#7FCFFF", 0.95) : rgba(dialCol, 0.13);
    ctx.fillRect(pwx + 10 - i * 3, y, 120, 18);
  }
  ctx.restore();
};

// HUD for the flyover looks: fine square grid, locator ring, left data blocks,
// right lists / toggles / 4 round gauges, glitchy top and bottom strips.
import { hash01 } from '../lib/rng';
import { type Ctx, type Theme, text, line, rect, dataRows, tick, pad, wave, rgba, heading, cGauge, TAU, segBar } from './kit';

export interface FlyTheme extends Theme { grid: string; ring: string }
type FS = (f: number) => { glitch: number; mix: number };

function strip(ctx: Ctx, y: number, f: number, th: FlyTheme, id: number, glitch: number) {
  let x = 0;
  let k = 0;
  while (x < 3840) {
    const w = 30 + Math.floor(hash01(id, k) * 260);
    const on = hash01(id, k, Math.floor(f / 10)) > 0.5;
    const a = 0.18 + 0.5 * hash01(id, k, 3);
    rect(ctx, x + glitch * (hash01(id, k, f) - 0.5) * 200, y, w, 10 + Math.floor(hash01(id, k, 4) * 14), rgba(on ? th.accent2 : th.dim, a));
    x += w + 10 + Math.floor(hash01(id, k, 5) * 60);
    k++;
  }
}

export const drawFlyoverHud = (th: FlyTheme, fsOf: FS) => (ctx: Ctx, frame: number) => {
  const f = frame;
  const fs = fsOf(frame);
  const gl = fs.glitch;
  // fine square grid over the whole frame
  ctx.strokeStyle = rgba(th.grid, 0.13);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= 3840; x += 160) { ctx.moveTo(x, 0); ctx.lineTo(x, 2160); }
  for (let y = 40; y <= 2160; y += 160) { ctx.moveTo(0, y); ctx.lineTo(3840, y); }
  ctx.stroke();
  ctx.strokeStyle = rgba(th.grid, 0.22);
  ctx.beginPath();
  for (let x = 0; x <= 3840; x += 160) for (let y = 40; y <= 2160; y += 160) { ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y); ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8); }
  ctx.stroke();
  // centre lines + locator ring
  line(ctx, 1920, 0, 1920, 2160, rgba(th.grid, 0.3), 2);
  line(ctx, 0, 1080, 3840, 1080, rgba(th.grid, 0.2), 2);
  const pr = (f % 45) / 45;
  ctx.strokeStyle = rgba(th.ring, 0.95); ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(1920, 1080, 46, 0, TAU); ctx.stroke();
  ctx.strokeStyle = rgba(th.ring, 0.7 * (1 - pr)); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(1920, 1080, 46 + 90 * pr, 0, TAU); ctx.stroke();
  ctx.fillStyle = th.ring; ctx.beginPath(); ctx.arc(1920, 1080, 12, 0, TAU); ctx.fill();
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.785; line(ctx, 1920 + Math.cos(a) * 64, 1080 + Math.sin(a) * 64, 1920 + Math.cos(a) * 96, 1080 + Math.sin(a) * 96, th.ring, 3); }

  // top strips (glitchy bars)
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) text(ctx, `${pad(Math.floor(hash01(800, r, c) * 9999), 4)} ${pad(tick(801 + r * 6 + c, f, 15, 3), 3)}`, 40 + c * 300 + (c > 2 ? 1500 : 0), 40 + r * 28, 18, rgba(th.text, 0.7));
  strip(ctx, 150, f, th, 810, gl);
  strip(ctx, 188, f + 7, th, 811, gl);

  // left blocks
  ['EMC', 'ATC', 'GTA'].forEach((l, i) => {
    text(ctx, l, 40, 400 + i * 66, 30, th.text, { font: 'label' });
    text(ctx, `${pad(tick(820 + i, f, 20, 3), 3)}.${pad(tick(823 + i, f, 6, 1), 1)}  ${pad(Math.floor(hash01(826, i) * 9999), 4)}`, 140, 400 + i * 66, 22, th.dim);
  });
  ['SECTOR-31', 'SECTOR-57', 'SECTOR-12'].forEach((l, i) => {
    text(ctx, l, 680 + i * 190, 410, 20, th.dim, { font: 'label' });
    text(ctx, pad(tick(830 + i, f, 40, 2), 2), 680 + i * 190, 480, 56, th.accent);
  });
  for (let i = 0; i < 6; i++) {
    const cx = 80 + i * 120;
    ctx.strokeStyle = th.accent; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cx, 650, 24, -1.2, -1.2 + TAU * wave(840 + i, f, 0.55, 0.95)); ctx.stroke();
    line(ctx, cx + 34, 650, cx + 90, 650, rgba(th.text, 0.4), 2);
  }
  heading(ctx, 'DCS - 062', 40, 800, th, 40);
  for (let r = 0; r < 4; r++) text(ctx, `${pad(Math.floor(hash01(850, r) * 99), 2)}  ${pad(tick(851 + r, f, 20, 4), 4)}  ${pad(Math.floor(hash01(855, r) * 999999), 6)}`, 50, 850 + r * 30, 20, th.dim);
  for (let r = 0; r < 2; r++) segBar(ctx, 50, 1000 + r * 30, 360, 10, 24, wave(860 + r, f, 0.3, 0.95), th, th.text);
  [0, 1, 2].forEach((i) => {
    rect(ctx, 50 + i * 200, 1110, 170, 34, i === 0 ? rgba(th.accent, 0.85) : undefined, th.accent, 2);
    text(ctx, `${['GRD', 'SEQ', 'NAV'][i]}-${pad(tick(865 + i, f, 60, 3), 3)}`, 135 + i * 200, 1136, 22, i === 0 ? '#06121A' : th.text, { align: 'center' });
  });
  for (let r = 0; r < 4; r++) {
    ctx.fillStyle = '#F0A030'; ctx.beginPath(); ctx.moveTo(52, 1210 + r * 40); ctx.lineTo(66, 1196 + r * 40); ctx.lineTo(66, 1210 + r * 40); ctx.fill();
    line(ctx, 80, 1205 + r * 40, 80 + 330 * wave(870 + r, f, 0.4, 1), 1205 + r * 40, rgba(th.text, 0.6), 2);
    text(ctx, pad(tick(874 + r, f, 15, 4), 4), 440, 1212 + r * 40, 20, th.dim);
  }
  heading(ctx, 'DATA ANALYSIS', 40, 1420, th, 36);
  dataRows(ctx, 50, 1468, 3, [4, 2, 5, 4], 880, f, th, 20, 30);
  heading(ctx, 'CORE DATA - 04', 40, 1630, th, 36);
  for (let i = 0; i < 70; i++) { const h = 20 + Math.floor(hash01(890, i, Math.floor(f / 6)) * 40); line(ctx, 50 + i * 8, 1720 - h, 50 + i * 8, 1720, rgba(th.text, 0.7), 3); }
  dataRows(ctx, 50, 1780, 4, [4, 2, 3, 4, 3], 891, f, th, 20, 30);

  // right column
  const labels = ['Input Mode GRID', 'Field Index A', 'Scan Mode', 'Field Index B', 'Wave Signal', 'Field Index C', 'Radiation Level'];
  labels.forEach((l, i) => {
    const y = 330 + i * 145;
    text(ctx, l, 3290, y, 26, th.text, { font: 'label' });
    for (let r = 0; r < 2; r++) text(ctx, `${pad(Math.floor(hash01(900, i, r) * 9999), 4)}  ${pad(tick(901 + i * 2 + r, f, 20, 3), 3)}  ${pad(Math.floor(hash01(902, i, r) * 99), 2)}`, 3300, y + 36 + r * 28, 18, th.dim);
    if (i === 4) text(ctx, `${pad(tick(915, f, 5, 6), 6)}.${pad(tick(916, f, 3, 3), 3)}`, 3300, y + 100, 26, th.accent);
  });
  ['A1', 'A2', 'A3', 'A4', 'A5'].forEach((l, i) => {
    const y = 1440 + i * 70;
    rect(ctx, 3060, y, 80, 46, rgba(th.accent, i === (Math.floor(f / 60) % 5) ? 0.5 : 0.15), th.accent, 2);
    text(ctx, l, 3100, y + 33, 26, th.text, { align: 'center' });
    text(ctx, `${['GRID', 'SCAN', 'NODE', 'LINK', 'TRACE'][i]} ${pad(Math.floor(hash01(920, i) * 999), 3)} ACTIVE`, 3170, y + 22, 18, th.dim);
    line(ctx, 3170, y + 34, 3170 + 400 * wave(921 + i, f, 0.3, 1), y + 34, rgba(th.text, 0.5), 2);
  });
  for (let i = 0; i < 4; i++) {
    cGauge(ctx, 3280 + i * 140, 1930, 40, wave(930 + i, f, 0.3, 1, 2), th, th.accent, 8);
    line(ctx, 3280 + i * 140, 1880, 3280 + i * 140, 1920, rgba(th.text, 0.6), 2);
  }
  // bottom strip
  strip(ctx, 2050, f + 3, th, 940, gl);
  line(ctx, 2600, 2100, 3800, 2100, rgba(th.accent, 0.8), 4);
  line(ctx, 2900, 2120, 3600, 2120, rgba(th.accent, 0.5), 3);
  text(ctx, `REF ${pad(tick(950, f, 30, 6), 6)}   LAYER 04   ${pad(tick(951, f, 10, 4), 4)}`, 40, 2120, 20, rgba(th.text, 0.7));
};

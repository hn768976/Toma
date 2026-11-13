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
  ctx.strokeStyle = rgba(th.grid, 0.2);
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let x = 0; x <= 3840; x += 120) { ctx.moveTo(x, 0); ctx.lineTo(x, 2160); }
  for (let y = 0; y <= 2160; y += 120) { ctx.moveTo(0, y); ctx.lineTo(3840, y); }
  ctx.stroke();
  ctx.fillStyle = rgba(th.grid, 0.55);
  for (let x = 0; x <= 3840; x += 120) for (let y = 0; y <= 2160; y += 120) ctx.fillRect(x - 3, y - 3, 6, 6);
  // glints: a few bright specks that blink (periodic)
  for (let i = 0; i < 40; i++) {
    if (((f + i * 17) % 50) > 30) continue;
    ctx.fillStyle = rgba('#FFFFFF', 0.7);
    ctx.fillRect(Math.floor(hash01(970, i) * 3840), Math.floor(hash01(971, i) * 2160), 4, 4);
  }
  // centre lines + locator ring
  line(ctx, 1920, 0, 1920, 2160, rgba(th.grid, 0.5), 3);
  line(ctx, 0, 1080, 3840, 1080, rgba(th.grid, 0.35), 2);
  const pr = (f % 45) / 45;
  ctx.strokeStyle = rgba(th.ring, 0.95); ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(1920, 1080, 30, 0, TAU); ctx.stroke();
  ctx.strokeStyle = rgba(th.ring, 0.7 * (1 - pr)); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(1920, 1080, 30 + 60 * pr, 0, TAU); ctx.stroke();
  ctx.fillStyle = th.ring; ctx.beginPath(); ctx.arc(1920, 1080, 9, 0, TAU); ctx.fill();
  for (let i = 0; i < 4; i++) { const a = (i / 4) * TAU + 0.785; line(ctx, 1920 + Math.cos(a) * 42, 1080 + Math.sin(a) * 42, 1920 + Math.cos(a) * 62, 1080 + Math.sin(a) * 62, th.ring, 3); }

  // orange callouts around the centre (dots on leader lines with tiny labels)
  [[-210, -300], [160, -110], [-160, 80], [120, 330]].forEach(([dx, dy], i) => {
    const on = ((f + i * 23) % 90) < 70;
    if (!on) return;
    const x = 1920 + dx, y = 1080 + dy;
    ctx.fillStyle = '#F0A030'; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = rgba('#F0A030', 0.25); ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
    line(ctx, x + 12, y, x + 200, y, rgba(th.text, 0.7), 2);
    text(ctx, `${pad(Math.floor(hash01(960, i) * 9999), 4)} ${pad(tick(961 + i, f, 15, 3), 3)} ${['NODE', 'GRID', 'LINK', 'SCAN'][i]}`, x + 20, y - 10, 18, th.text);
  });
  // top-centre bracket widget
  ctx.strokeStyle = rgba(th.text, 0.6); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(2400, 120); ctx.lineTo(2400, 70); ctx.lineTo(2560, 70); ctx.moveTo(3260, 120); ctx.lineTo(3260, 70); ctx.lineTo(3100, 70); ctx.stroke();
  ctx.fillStyle = '#FFD040'; ctx.beginPath(); ctx.arc(2480 + 700 * ((f % 120) / 120), 70, 6, 0, TAU); ctx.fill();
  // top strips (glitchy bars)
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) text(ctx, `${pad(Math.floor(hash01(800, r, c) * 9999), 4)} ${pad(tick(801 + r * 6 + c, f, 15, 3), 3)}`, 40 + c * 300 + (c > 2 ? 1500 : 0), 40 + r * 28, 18, rgba(th.text, 0.7));
  strip(ctx, 150, f, th, 810, gl);
  strip(ctx, 188, f + 7, th, 811, gl);

  // left blocks
  ['CH-A', 'CH-B', 'CH-C'].forEach((l, i) => {
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
  heading(ctx, 'DAT - 062', 40, 800, th, 40);
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
    ctx.fillStyle = rgba(th.accent, i === (Math.floor(f / 60) % 5) ? 0.7 : 0.42);
    ctx.beginPath(); ctx.moveTo(3072, y); ctx.lineTo(3128, y); ctx.lineTo(3142, y + 23); ctx.lineTo(3128, y + 46); ctx.lineTo(3072, y + 46); ctx.lineTo(3058, y + 23); ctx.closePath(); ctx.fill();
    text(ctx, l, 3100, y + 33, 26, '#06121A', { align: 'center' });
    text(ctx, `${['GRID', 'SCAN', 'NODE', 'LINK', 'TRACE'][i]} ${pad(Math.floor(hash01(920, i) * 999), 3)} ACTIVE`, 3170, y + 22, 18, th.dim);
    line(ctx, 3170, y + 34, 3170 + 400 * wave(921 + i, f, 0.3, 1), y + 34, rgba(th.text, 0.5), 2);
  });
  for (let i = 0; i < 4; i++) {
    cGauge(ctx, 3280 + i * 140, 1930, 40, wave(930 + i, f, 0.3, 1, 2), th, th.accent, 8);
    line(ctx, 3280 + i * 140, 1880, 3280 + i * 140, 1920, rgba(th.text, 0.6), 2);
  }
  // bottom strip
  strip(ctx, 2050, f + 3, th, 940, gl);
  for (const [yy, w, a] of [[2062, 7, 1], [2090, 6, 0.85], [2116, 5, 0.7]] as const) {
    line(ctx, 2850, yy, 3790, yy, rgba('#60F0A8', a * 0.25), w + 12);
    line(ctx, 2850, yy, 3790, yy, rgba('#70F8B8', a), w);
  }
  text(ctx, `REF ${pad(tick(950, f, 30, 6), 6)}   LAYER 04   ${pad(tick(951, f, 10, 4), 4)}`, 40, 2120, 20, rgba(th.text, 0.7));
};

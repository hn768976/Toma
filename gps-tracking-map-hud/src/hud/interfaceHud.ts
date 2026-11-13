// Look 2: GPS Track inside an interface (charcoal panels, grey/white text).
import { hash01 } from '../lib/rng';
import {
  type Ctx, type Theme, text, line, rect, dataRows, barMeter, segBar, waveform, numBox, heading, tick, pad, wave, rgba, lf, brackets,
} from './kit';
import { LOOP } from '../city';

export const IFACE_MAP = { x: 790, y: 212, w: 3010, h: 1620 };

const TH: Theme = {
  text: '#E6E9EC', dim: '#8C9399', faint: '#5A6066', accent: '#F2F4F5', accent2: '#B9C0C6', panel: '#141618', panelEdge: '#2A2E32',
};

function sliders(ctx: Ctx, x: number, y: number, n: number, f: number, id: number) {
  for (let i = 0; i < n; i++) {
    const yy = y + i * 40;
    const v = wave(id + i, f, 0.15, 0.95, 1 + (i % 2));
    line(ctx, x, yy, x + 330, yy, rgba(TH.faint, 0.9), 2);
    ctx.fillStyle = TH.text;
    ctx.beginPath(); ctx.arc(x + 330 * v, yy, 7, 0, Math.PI * 2); ctx.fill();
    text(ctx, pad(tick(id * 9 + i, f, 30, 5), 5), x + 380, yy + 8, 24, TH.dim);
    text(ctx, pad(tick(id * 9 + i + 50, f, 60, 5), 5), x + 500, yy + 8, 24, TH.text);
  }
}

function fileIcon(ctx: Ctx, x: number, y: number, label: string) {
  ctx.strokeStyle = TH.text;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + 50, y); ctx.lineTo(x + 66, y + 16); ctx.lineTo(x + 66, y + 84); ctx.lineTo(x, y + 84); ctx.closePath();
  ctx.stroke();
  text(ctx, label, x + 33, y + 66, 32, TH.text, { align: 'center' });
}

export const drawInterfaceHud = (ctx: Ctx, frame: number) => {
  const f = lf(frame);
  // panels (charcoal) around the map
  ctx.fillStyle = '#0D0E10';
  ctx.fillRect(0, 0, 3840, 2160);
  ctx.clearRect(IFACE_MAP.x, IFACE_MAP.y, IFACE_MAP.w, IFACE_MAP.h);
  rect(ctx, 0, 0, 3840, 150, TH.panel);
  rect(ctx, 0, 150, 750, 2010, TH.panel);
  rect(ctx, 750, 1880, 3090, 280, TH.panel);
  // map frame
  rect(ctx, IFACE_MAP.x - 4, IFACE_MAP.y - 4, IFACE_MAP.w + 8, IFACE_MAP.h + 8, undefined, rgba(TH.dim, 0.8), 3);
  brackets(ctx, IFACE_MAP.x - 18, IFACE_MAP.y - 18, IFACE_MAP.w + 36, IFACE_MAP.h + 36, 44, TH.text, 3);

  // ---- top signal strip
  waveform(ctx, 40, 38, 1180, 74, f, 3, rgba(TH.text, 0.75));
  waveform(ctx, 1680, 38, 1200, 74, f + 137, 7, rgba(TH.text, 0.55));
  ctx.strokeStyle = TH.text; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(1450, 75, 48, 0, Math.PI * 2); ctx.stroke();
  const sweep = (f / LOOP) * Math.PI * 2 * 4;
  line(ctx, 1450, 75, 1450 + Math.cos(sweep) * 44, 75 + Math.sin(sweep) * 44, TH.text, 3);
  for (let i = 0; i < 4; i++) {
    text(ctx, `SIG-${pad(i + 1, 2)}  ${pad(tick(400 + i, f, 15, 3), 3)}.${pad(tick(410 + i, f, 6, 1), 1)}`, 2980 + (i % 2) * 420, 62 + Math.floor(i / 2) * 44, 26, i % 2 ? TH.dim : TH.text);
  }
  line(ctx, 0, 150, 3840, 150, rgba(TH.faint, 0.8), 2);
  text(ctx, 'SIGNAL', 40, 30, 22, TH.dim, { font: 'label' });

  // ---- left panel
  dataRows(ctx, 60, 215, 5, [4, 2, 3, 4], 11, f, TH, 24, 34);
  segBar(ctx, 470, 200, 220, 14, 12, wave(5, f, 0.3, 0.9), TH);
  segBar(ctx, 470, 240, 220, 14, 12, wave(6, f, 0.2, 0.8), TH);
  ['VX-207', 'NODE-31', 'VOX-467'].forEach((s, i) => {
    rect(ctx, 50 + i * 230, 395, 205, 46, rgba(TH.text, i === 1 ? 0.14 : 0), rgba(TH.dim, 0.9), 2);
    text(ctx, s, 152 + i * 230, 428, 26, TH.text, { align: 'center' });
  });
  sliders(ctx, 60, 500, 5, f, 20);
  heading(ctx, 'DATA ANALYSIS', 50, 760, TH, 42);
  line(ctx, 50, 778, 700, 778, rgba(TH.faint, 0.9), 2);
  dataRows(ctx, 60, 820, 4, [5, 2, 4, 3, 4], 12, f, TH, 23, 34);
  for (let i = 0; i < 12; i++) rect(ctx, 60 + i * 52, 960, 34, 10, i < 4 + (tick(77, f, 30, 1) % 8) ? TH.text : rgba(TH.faint, 0.5));
  heading(ctx, 'CORE DATA - 04', 50, 1030, TH, 42);
  line(ctx, 50, 1048, 700, 1048, rgba(TH.faint, 0.9), 2);
  dataRows(ctx, 60, 1090, 3, [4, 3, 4, 2], 13, f, TH, 23, 34);
  fileIcon(ctx, 60, 1230, pad(20 + (tick(88, f, 60, 1) % 9), 2));
  fileIcon(ctx, 160, 1230, String(100));
  text(ctx, 'GPS PROCESS 1', 270, 1262, 26, TH.text, { font: 'label' });
  text(ctx, `${pad(tick(90, f, 10, 4), 4)} ${pad(tick(91, f, 20, 3), 3)} ${pad(tick(92, f, 30, 4), 4)}`, 270, 1300, 24, TH.dim);
  barMeter(ctx, 270, 1320, 400, 8, wave(93, f, 0.2, 0.95, 2), TH);
  for (let r = 0; r < 6; r++) {
    text(ctx, `${pad(Math.floor(hash01(94, r) * 9999), 4)}  ${'■'.repeat(1 + (r % 3))}`, 60, 1420 + r * 40, 22, TH.dim);
    segBar(ctx, 300, 1404 + r * 40, 260, 14, 16, wave(95 + r, f, 0.1, 0.95, 1 + (r % 3)), TH, r % 2 ? TH.dim : TH.text);
    text(ctx, pad(tick(100 + r, f, 12, 3), 3), 590, 1420 + r * 40, 22, TH.text);
  }
  heading(ctx, 'ENCODING DATA FEED', 50, 1720, TH, 36);
  line(ctx, 50, 1736, 700, 1736, rgba(TH.faint, 0.9), 2);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 9; c++) {
    const on = hash01(120, r, c, Math.floor(f / 15)) > 0.45;
    rect(ctx, 60 + c * 72, 1770 + r * 82, 56, 26, on ? rgba(TH.text, 0.85) : undefined, rgba(TH.dim, 0.8), 2);
    text(ctx, pad(Math.floor(hash01(121, r, c) * 99), 2), 88 + c * 72, 1826 + r * 82, 20, TH.dim, { align: 'center' });
  }

  // ---- bottom strip
  const bx = 800;
  [['99', 'SEC'], ['10', 'NOD'], ['70', 'LNK'], ['42', 'CH']].forEach(([v, c], i) => {
    const val = i === 0 ? v : pad((Number(v) + tick(130 + i, f, 30, 1)) % 100, 2);
    numBox(ctx, bx + (i % 2) * 150, 1900 + Math.floor(i / 2) * 125, 135, 112, val, c, TH);
  });
  for (let col = 0; col < 3; col++) {
    const x0 = 1150 + col * 560;
    text(ctx, `SYS - ${pad(col * 3 + 1, 3)} - SECTOR ${pad(Math.floor(hash01(140, col) * 99999), 5)}`, x0, 1925, 24, TH.text);
    for (let r = 0; r < 5; r++) {
      text(ctx, `${pad(Math.floor(hash01(141, col, r) * 9999), 4)} ${pad(tick(142 + col * 10 + r, f, 20, 2), 2)}`, x0, 1972 + r * 36, 22, TH.dim);
      barMeter(ctx, x0 + 150, 1962 + r * 36, 330, 6, wave(150 + col * 10 + r, f, 0.1, 0.95, 1 + (r % 2)), TH, r === 2 ? TH.text : TH.dim);
    }
  }
  const vals = ['05', '70', '77', '91', '91', '17'];
  vals.forEach((v, i) => {
    const val = pad((Number(v) + tick(170 + i, f, 20 + i * 10, 1)) % 100, 2);
    numBox(ctx, 2860 + i * 160, 1900, 140, 118, val, `CH-${i + 1}`, TH);
    segBar(ctx, 2860 + i * 160, 2040, 140, 10, 6, wave(180 + i, f, 0.2, 1, 2), TH);
    text(ctx, pad(tick(190 + i, f, 12, 3), 3), 2930 + i * 160, 2100, 24, TH.dim, { align: 'center' });
  });
  // small coordinate readout over the map
  text(ctx, `TRACK ${pad(tick(200, f, 6, 6), 6)}  E ${pad(482000 + Math.floor(wave(201, f, 3000, 9000)), 6)}  N ${pad(739000 - Math.floor(wave(202, f, 2000, 5000)), 6)}`, IFACE_MAP.x + 30, IFACE_MAP.y + IFACE_MAP.h - 30, 26, rgba(TH.text, 0.85));
};

// Look 5: night map HUD. 600-frame loop: fade up from black, drift + zoom,
// partial fade out and back, then down to black again at the loop point.
import { AbsoluteFill } from 'remotion';
import { MapCanvas } from '../render/MapCanvas';
import type { PixiMap } from '../render/pixiMap';
import { NIGHT } from '../looks/styles';
import { CITY, LOOP, MAP_W, MAP_H } from '../city';
import { HudCanvas } from '../hud/HudCanvas';
import { type Ctx, type Theme, text, line, rect, tick, pad, wave, rgba, cross, lf, TAU } from '../hud/kit';
import { hash01 } from '../lib/rng';

const TH: Theme = { text: '#A9BACB', dim: '#6F8498', faint: '#4E6276', accent: '#FFFFFF', accent2: '#C8D6E2', panel: '#0A121A', panelEdge: '#3A4A5A' };
const sm = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// brightness envelope (periodic, 0 at the loop point)
export const nightBright = (frame: number) => {
  const f = lf(frame);
  const up = sm(0, 80, f);
  const dip = 1 - 0.58 * sm(250, 320, f) * (1 - sm(360, 440, f));
  const down = 1 - sm(530, 600, f);
  return up * dip * down;
};

const view = (frame: number) => {
  const f = lf(frame);
  const a = (f / LOOP) * TAU;
  return {
    cx: MAP_W * 0.52 + 400 * Math.cos(a),
    cy: MAP_H * 0.48 + 250 * Math.sin(a),
    zoom: 0.25 * (1 + 0.14 * (0.5 - 0.5 * Math.cos(a))),
    rot: 0.06 * Math.sin(a),
  };
};

function smallBlock(ctx: Ctx, x: number, y: number, id: number, f: number, rows = 3) {
  for (let r = 0; r < rows; r++) {
    const w = 120 + Math.floor(hash01(id, r) * 140);
    text(ctx, `${['INPUT', 'GRID', 'NODE', 'LINK'][(id + r) % 4]} ${pad(Math.floor(hash01(id, r, 1) * 999), 3)}`, x, y + r * 30, 20, TH.dim);
    line(ctx, x + 150, y + r * 30 - 6, x + 150 + w * wave(id + r, f, 0.4, 1), y + r * 30 - 6, rgba(TH.text, 0.7), 3);
    text(ctx, pad(tick(id * 3 + r, f, 20, 4), 4), x + 420, y + r * 30, 20, TH.text);
  }
}

function valueBoxes(ctx: Ctx, x: number, y: number, n: number, id: number, f: number) {
  for (let i = 0; i < n; i++) {
    rect(ctx, x + i * 155, y, 130, 30, rgba('#FFFFFF', 0.88));
    text(ctx, `${pad(tick(id + i, f, 30, 3), 3)}.${pad(tick(id + i + 50, f, 10, 2), 2)}`, x + i * 155 + 65, y + 23, 20, '#08101A', { align: 'center' });
    text(ctx, `REF ${pad(Math.floor(hash01(id, i) * 99), 2)}`, x + i * 155, y + 58, 18, TH.dim);
  }
}

const drawHud = (ctx: Ctx, frame: number) => {
  const f = lf(frame);
  const b = nightBright(frame);
  // HUD flickers on as the map brightens, holds, and fades with it
  const flick = b > 0.55 ? 1 : b > 0.3 ? (hash01(77, Math.floor(f / 2)) > 0.45 ? 0.85 : 0.15) : b * 0.6;
  ctx.globalAlpha = Math.min(1, flick * (0.35 + 0.65 * b));
  // sparse pinpoints + small annotation clusters anchored to the map
  const v = view(frame);
  CITY.pois.slice(0, 40).filter((_, i) => i % 3 === 0).forEach((p, i) => {
    const x = 1920 + (p.x - v.cx) * v.zoom, y = 1080 + (p.y - v.cy) * v.zoom;
    if (x < 60 || x > 3780 || y < 60 || y > 2100) return;
    ctx.fillStyle = rgba('#FFFFFF', 0.85);
    ctx.beginPath(); ctx.arc(x, y, 2.5, 0, TAU); ctx.fill();
    if (i % 4 === 0) {
      line(ctx, x, y, x + 50, y - 50, rgba(TH.text, 0.5), 1.5);
      line(ctx, x + 50, y - 50, x + 210, y - 50, rgba(TH.text, 0.5), 1.5);
      text(ctx, `${p.code}  ${pad(Math.floor(hash01(590, i) * 999), 3)}`, x + 56, y - 60, 16, TH.text);
      text(ctx, `${pad(p.e, 6)} ${pad(p.n, 6)}`, x + 56, y - 30, 14, TH.dim);
    }
  });
  // corner crosses + top ticks
  for (const [x, y] of [[1300, 640], [2580, 1500]]) cross(ctx, x, y, 12, rgba(TH.text, 0.45), 2);
  for (let i = 0; i < 28; i++) line(ctx, 420 + i * 60, 110, 420 + i * 60, i % 5 === 0 ? 132 : 122, rgba(TH.text, 0.35), 2);
  rect(ctx, 940, 110, 18, 18, undefined, rgba(TH.text, 0.7), 2);
  // scale bar across the middle with ticks
  const sy = 1080;
  line(ctx, 500, sy, 3330, sy, rgba(TH.text, 0.5), 2);
  for (let i = 0; i <= 40; i++) line(ctx, 500 + i * 70.75, sy, 500 + i * 70.75, sy + (i % 10 === 0 ? 16 : i % 5 === 0 ? 10 : 6), rgba(TH.text, 0.45), 2);
  text(ctx, '0', 500, sy + 56, 20, TH.dim);
  text(ctx, '2.5 KM', 3330, sy + 56, 20, TH.dim, { align: 'right' });
  text(ctx, 'ACTIVE SEARCH', 3360, 630, 24, TH.text, { font: 'label' });
  text(ctx, `${pad(tick(500, f, 30, 4), 4)} UNIT`, 3360, 664, 20, TH.dim);
  // value boxes + small text left
  valueBoxes(ctx, 500, 1110, 3, 510, f);
  smallBlock(ctx, 500, 1220, 520, f, 3);
  smallBlock(ctx, 630, 630, 530, f, 2);
  // vertical indicator on the left
  const vx = 330;
  line(ctx, vx, 420, vx, 1500, rgba(TH.text, 0.4), 2);
  for (let i = 0; i <= 24; i++) line(ctx, vx, 420 + i * 45, vx + (i % 4 === 0 ? 16 : 8), 420 + i * 45, rgba(TH.text, 0.35), 2);
  const vy = 420 + 1080 * wave(540, f, 0.15, 0.85);
  ctx.fillStyle = TH.text;
  ctx.beginPath(); ctx.moveTo(vx - 6, vy); ctx.lineTo(vx - 26, vy - 12); ctx.lineTo(vx - 26, vy + 12); ctx.closePath(); ctx.fill();
  text(ctx, pad(Math.floor((1 - (vy - 420) / 1080) * 999), 3), vx - 34, vy + 7, 15, TH.dim, { align: 'right' });
  // top-right text blocks with bars
  for (let c = 0; c < 3; c++) {
    const x0 = 2500 + c * 380;
    text(ctx, `● ${['DATA', 'SCAN', 'GRID'][c]} ${pad(Math.floor(hash01(550, c) * 99), 2)} - SECTOR ${pad(Math.floor(hash01(551, c) * 9999), 4)}`, x0, 110, 18, TH.dim);
    for (let r = 0; r < 3; r++) {
      rect(ctx, x0, 128 + r * 26, 90, 16, rgba(TH.text, r === 0 ? 0.8 : 0.35));
      text(ctx, `${pad(tick(552 + c * 3 + r, f, 15, 5), 5)}`, x0 + 110, 142 + r * 26, 18, TH.dim);
    }
  }
  // right column
  for (let r = 0; r < 6; r++) {
    const y0 = 1220 + r * 150;
    text(ctx, `SECONDARY GRID ZONE ${pad(Math.floor(hash01(560, r) * 999), 3)}`, 3380, y0, 18, TH.text);
    text(ctx, `${pad(Math.floor(hash01(561, r) * 9999), 4)} ${pad(tick(562 + r, f, 20, 3), 3)} ${pad(Math.floor(hash01(563, r) * 99), 2)}`, 3380, y0 + 30, 16, TH.dim);
    rect(ctx, 3380, y0 + 44, 60, 12, rgba(TH.text, 0.7));
    rect(ctx, 3450, y0 + 44, 30 + 60 * wave(564 + r, f, 0, 1), 12, rgba(TH.text, 0.3));
  }
  // bottom row: sector blocks + value boxes
  for (let i = 0; i < 6; i++) {
    const x0 = 60 + i * 230;
    text(ctx, `SECTOR - ${pad(Math.floor(hash01(570, i) * 99), 2)}`, x0, 1840, 18, TH.dim);
    text(ctx, pad(tick(571 + i, f, 40, 2), 2), x0, 1880, 28, TH.text);
    for (let r = 0; r < 2; r++) text(ctx, `${pad(Math.floor(hash01(575, i, r) * 9999), 4)} ${pad(tick(576 + i * 2 + r, f, 20, 3), 3)}`, x0, 1916 + r * 24, 16, TH.dim);
  }
  for (let i = 0; i < 3; i++) {
    const x0 = 1500 + i * 270;
    text(ctx, `SECTOR - ${pad(Math.floor(hash01(580, i) * 99), 2)}`, x0, 1840, 18, TH.dim);
    text(ctx, pad(tick(581 + i, f, 40, 2), 2), x0, 1880, 28, TH.text);
  }
  valueBoxes(ctx, 1500, 1950, 3, 590, f);
  valueBoxes(ctx, 2350, 1950, 3, 600, f);
  valueBoxes(ctx, 2900, 1950, 3, 610, f);
  for (let r = 0; r < 4; r++) text(ctx, `${pad(Math.floor(hash01(620, r) * 999999), 6)}  ${pad(tick(621 + r, f, 25, 3), 3)}  NODE ${pad(Math.floor(hash01(622, r) * 99), 2)}`, 2480, 1760 + r * 28, 18, TH.dim);
  ctx.globalAlpha = 1;
};

export const NightMap: React.FC = () => {
  const draw = (m: PixiMap, frame: number) => {
    const v = view(frame);
    m.render(v, { fade: nightBright(frame), vigShape: [0.04, 0.02, 0.88] });
  };
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <MapCanvas style={NIGHT} w={3840} h={2160} draw={draw} />
      <HudCanvas draw={drawHud} />
    </AbsoluteFill>
  );
};

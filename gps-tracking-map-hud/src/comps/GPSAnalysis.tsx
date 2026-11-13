// Looks 3-4: "GPS navigation analysis" dashboard. 8 shots of 75 frames; in each
// the map slides slightly and the crosshair locks onto a named point.
import { AbsoluteFill } from 'remotion';
import { MapCanvas } from '../render/MapCanvas';
import { hex, type PixiMap } from '../render/pixiMap';
import { ANALYSIS_BLUE, ANALYSIS_AMBER } from '../looks/styles';
import { CITY, MAP_W, MAP_H } from '../city';
import { HudCanvas } from '../hud/HudCanvas';
import { Globe } from '../render/Globe';
import {
  type Ctx, type Theme, text, line, rect, roundRect, dataRows, barMeter, segBar, gauge, numBox, heading, tick, pad, wave, rgba, worldMap, odometer, cross, TAU,
} from '../hud/kit';
import { hash01 } from '../lib/rng';

export const SHOT = 75;
const MAP = { x: 0, y: 236, w: 3000, h: 1676 };
const SHOTS = [
  { poi: 3, zoom: 0.26, dx: -0.06, dy: 0.04 },
  { poi: 11, zoom: 0.42, dx: 0.05, dy: -0.03 },
  { poi: 7, zoom: 0.62, dx: -0.04, dy: -0.04 },
  { poi: 19, zoom: 0.3, dx: 0.06, dy: 0.02 },
  { poi: 25, zoom: 0.85, dx: 0.03, dy: 0.05 },
  { poi: 14, zoom: 0.48, dx: -0.05, dy: 0.03 },
  { poi: 30, zoom: 0.28, dx: 0.04, dy: -0.05 },
  { poi: 5, zoom: 0.7, dx: -0.03, dy: -0.02 },
];
// first POI (from index i) whose framing stays inside the generated city
const fitCache = new Map<string, number>();
export function fitPoi(i: number, zoom: number, w: number, h: number, margin = 1900) {
  const key = `${i}|${zoom}|${w}|${h}`;
  if (fitCache.has(key)) return CITY.pois[fitCache.get(key)!];
  for (let k = 0; k < CITY.pois.length; k++) {
    const j = (i + k) % CITY.pois.length;
    const p = CITY.pois[j];
    const hw = (w / zoom) * 0.62, hh = (h / zoom) * 0.62;
    if (p.x - hw > -margin && p.x + hw < MAP_W + margin && p.y - hh > -margin && p.y + hh < MAP_H + margin) {
      fitCache.set(key, j);
      return p;
    }
  }
  return CITY.pois[i % CITY.pois.length];
}
const poiOf = (s: number) => fitPoi(SHOTS[s].poi, SHOTS[s].zoom, MAP.w, MAP.h);
const counterOf = (s: number) => {
  const p = poiOf(s);
  return `${pad(Math.floor(hash01(s, 1) * 999), 3)}-${pad(p.e % 10000, 4)}-${Math.floor(hash01(s, 2) * 9)}-${pad(p.n % 1000, 3)}`;
};

export interface AnalysisTheme { th: Theme; accent: string; mapEdge: string; globeLand: string; globeSea: string; globeLine: string; lock: string }
const BLUE: AnalysisTheme = {
  th: { text: '#EAF6FF', dim: '#7FA6C0', faint: '#3E5C70', accent: '#4AB8F0', accent2: '#F0A030', panel: '#0C141A', panelEdge: '#2A4558' },
  accent: '#F0A030', mapEdge: '#9FD4F5', globeLand: '#CFEFFF', globeSea: '#0E2A3C', globeLine: '#7FC8F0', lock: '#FFD27A',
};
const AMBER: AnalysisTheme = {
  th: { text: '#FFF1DC', dim: '#C09A6A', faint: '#6A4A28', accent: '#F0A03A', accent2: '#3AD8F0', panel: '#150D07', panelEdge: '#5A3A1C' },
  accent: '#3AD8F0', mapEdge: '#F5C890', globeLand: '#FFE2B8', globeSea: '#3A2410', globeLine: '#F0B060', lock: '#7AF0FF',
};

function shotView(s: number, t: number) {
  const sh = SHOTS[s];
  const p = poiOf(s);
  // target sits slightly left of panel centre; the map slides a little through the shot
  const ease = t * t * (3 - 2 * t);
  const viewW = MAP.w / sh.zoom, viewH = MAP.h / sh.zoom;
  const cx = p.x + viewW * (0.08 + sh.dx * (ease - 0.5));
  const cy = p.y + viewH * (0.02 + sh.dy * (ease - 0.5));
  return { cx, cy, zoom: sh.zoom, rot: 0, p };
}

const drawHud = (at: AnalysisTheme) => (ctx: Ctx, frame: number) => {
  const { th } = at;
  const s = Math.min(SHOTS.length - 1, Math.floor(frame / SHOT));
  const lf = frame - s * SHOT;
  const t = lf / SHOT;
  const v = shotView(s, t);
  // target screen position inside the map panel
  const tx = MAP.x + MAP.w / 2 + (v.p.x - v.cx) * v.zoom, ty = MAP.y + MAP.h / 2 + (v.p.y - v.cy) * v.zoom;

  // background panels
  ctx.fillStyle = '#05080B';
  if (at === AMBER) ctx.fillStyle = '#080503';
  ctx.fillRect(0, 0, 3840, 2160);
  ctx.save();
  roundRect(ctx, MAP.x - 40, MAP.y, MAP.w + 40, MAP.h, 64);
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = rgba(at.mapEdge, 0.85);
  ctx.lineWidth = 4;
  roundRect(ctx, MAP.x - 40, MAP.y, MAP.w + 40, MAP.h, 64);
  ctx.stroke();

  // ---- header
  heading(ctx, 'GPS NAVIGATION ANALYSIS', 60, 92, th, 54);
  dataRows(ctx, 64, 140, 3, [4, 2, 5, 3], 300 + s, frame, th, 22, 30, 1);
  ['SECTOR-04', 'SECTOR-11', 'SECTOR-16', 'SECTOR-19'].forEach((l, i) => {
    text(ctx, l, 800 + i * 175, 80, 24, th.dim, { font: 'label' });
    text(ctx, pad(tick(310 + i, frame, 25, 2), 2), 800 + i * 175, 140, 52, th.text);
  });
  // rolling coordinate counter
  const from = s === 0 ? '000-0000-0-000' : counterOf(s - 1);
  odometer(ctx, 1560, 150, from, counterOf(s), Math.min(1, lf / 28), 92, th, at.mapEdge, at.accent);
  // top-right tiny lists
  for (let c = 0; c < 3; c++) {
    text(ctx, `● ${['SYS', 'GEO', 'NAV'][c]} - ${pad(Math.floor(hash01(320, c) * 999), 3)} - SECTOR`, 2860 + c * 330, 70, 20, th.dim);
    for (let r = 0; r < 3; r++) text(ctx, `${pad(Math.floor(hash01(321, c, r) * 9999), 4)}  ${pad(tick(322 + c * 5 + r, frame, 15, 3), 3)}  ${pad(Math.floor(hash01(323, c, r) * 99), 2)}`, 2860 + c * 330, 108 + r * 32, 20, r === 1 ? th.text : th.dim);
  }

  // ---- crosshair + lock
  const lockT = Math.min(1, lf / 22);
  const e = 1 - Math.pow(1 - lockT, 3);
  const startX = MAP.x + MAP.w * (0.25 + 0.5 * hash01(s, 9));
  const chx = startX + (tx - startX) * e;
  line(ctx, chx, MAP.y + 6, chx, MAP.y + MAP.h - 6, rgba('#FFFFFF', 0.85), 3);
  const locked = lf >= 22;
  if (locked) {
    const k = lf - 22;
    const flash = Math.max(0, 1 - k / 8);
    if (flash > 0) {
      ctx.fillStyle = rgba(at.lock, 0.55 * flash);
      ctx.beginPath(); ctx.arc(tx, ty, 40 + 60 * (1 - flash), 0, TAU); ctx.fill();
    }
    const pulse = (k % 25) / 25;
    ctx.strokeStyle = rgba(at.lock, 0.9 * (1 - pulse));
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(tx, ty, 26 + 70 * pulse, 0, TAU); ctx.stroke();
    // labels on leader lines (left and right)
    const p = v.p;
    const lw = Math.min(1, k / 10);
    line(ctx, tx + 30, ty - 30, tx + 30 + 140 * lw, ty - 30, rgba('#FFFFFF', 0.9), 2);
    rect(ctx, tx + 40, ty - 76, 330 * lw, 38, rgba('#FFFFFF', 0.92));
    if (lw >= 1) text(ctx, `${p.code}  ${pad(p.e % 100000, 5)}`, tx + 52, ty - 47, 26, '#05080B');
    rect(ctx, tx - 40 - 260 * lw, ty + 34, 260 * lw, 30, rgba('#FFFFFF', 0.85));
    if (lw >= 1) text(ctx, `N ${pad(p.n, 6)}`, tx - 290, ty + 58, 22, '#05080B');
    rect(ctx, chx - 120, MAP.y + MAP.h - 260, 240 * lw, 26, rgba('#FFFFFF', 0.8));
  }
  rect(ctx, tx - 13, ty - 13, 26, 26, at.lock);
  rect(ctx, tx - 22, ty - 22, 44, 44, undefined, rgba(at.lock, 0.9), 3);
  cross(ctx, chx, MAP.y + 70, 14, rgba('#FFFFFF', 0.8), 2);

  // ---- right column
  const R = 3060;
  // ring HUD around the globe
  ctx.strokeStyle = rgba(th.text, 0.5); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(3420, 590, 330, 0, TAU); ctx.stroke();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU + (frame / 600) * TAU * 0.25;
    const l = i % 6 === 0 ? 18 : 8;
    line(ctx, 3420 + Math.cos(a) * 345, 590 + Math.sin(a) * 345, 3420 + Math.cos(a) * (345 + l), 590 + Math.sin(a) * (345 + l), rgba(th.text, 0.6), 2);
  }
  ctx.strokeStyle = rgba(at.accent, 0.9); ctx.lineWidth = 5;
  const ga = (frame / 600) * TAU;
  ctx.beginPath(); ctx.arc(3420, 590, 375, ga, ga + 0.7); ctx.stroke();
  // flat world map
  rect(ctx, R, 960, 740, 300, rgba(th.panel, 0.9), rgba(th.faint, 0.8), 2);
  worldMap(ctx, R + 14, 972, 712, 276, rgba(th.dim, 0.75), 10, 3);
  const arcP = (u: number) => ({ x: R + 120 + 500 * u, y: 1110 - 90 * Math.sin(Math.PI * u) });
  ctx.strokeStyle = rgba(at.accent, 0.9); ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]);
  ctx.beginPath(); for (let i = 0; i <= 40; i++) { const q = arcP(i / 40); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); } ctx.stroke();
  ctx.setLineDash([]);
  const ap = arcP(((frame % 150) / 150));
  ctx.fillStyle = at.accent; ctx.beginPath(); ctx.arc(ap.x, ap.y, 7, 0, TAU); ctx.fill();
  // data blocks
  for (let r = 0; r < 3; r++) {
    line(ctx, R, 1320 + r * 26, R + 380, 1320 + r * 26, rgba(th.faint, 0.9), 2);
    text(ctx, pad(tick(330 + r, frame, 30, 5), 5), R + 560, 1328 + r * 26, 20, th.dim);
  }
  text(ctx, `ACS - ${pad(tick(340, frame, 75, 3), 3)}`, R, 1440, 30, th.text);
  rect(ctx, R + 200, 1412, 150, 36, rgba(th.accent, 0.85)); text(ctx, `OCS-${pad(tick(341, frame, 75, 3), 3)}`, R + 275, 1440, 22, '#05080B', { align: 'center' });
  rect(ctx, R + 400, 1412, 150, 36, undefined, th.accent, 2); text(ctx, `VCH-${pad(tick(342, frame, 75, 3), 3)}`, R + 475, 1440, 22, th.text, { align: 'center' });
  for (let r = 0; r < 5; r++) {
    text(ctx, `${pad(Math.floor(hash01(343, r) * 99999), 5)} ${pad(Math.floor(hash01(344, r) * 9999), 4)}`, R, 1510 + r * 40, 22, th.dim);
    const vv = wave(345 + r, frame, 0.3, 0.98, 1 + (r % 2));
    for (let k = 0; k < 18; k++) rect(ctx, R + 280 + k * 22, 1500 + r * 40, 14, 4, k / 18 < vv ? rgba(th.text, 0.8) : rgba(th.faint, 0.6));
    ctx.fillStyle = at.accent; ctx.beginPath(); ctx.arc(R + 280 + 18 * 22 * vv, 1502 + r * 40, 7, 0, TAU); ctx.fill();
  }
  heading(ctx, 'DATA ANALYSIS', R, 1745, th, 36); ctx.fillStyle = at.accent; ctx.beginPath(); ctx.arc(R + 290, 1733, 6, 0, TAU); ctx.fill();
  dataRows(ctx, R, 1790, 3, [4, 2, 5, 4, 3], 350, frame, th, 20, 30);
  heading(ctx, 'GPS DATA - 024', R, 1935, th, 36); ctx.fillStyle = at.accent; ctx.beginPath(); ctx.arc(R + 265, 1923, 6, 0, TAU); ctx.fill();
  dataRows(ctx, R, 1980, 2, [4, 2, 5, 4, 3], 351, frame, th, 20, 30);
  for (let k = 0; k < 26; k++) rect(ctx, R + k * 28, 2060, 18, 30, hash01(352, k, Math.floor(frame / 10)) > 0.4 ? rgba(th.text, 0.75) : rgba(th.faint, 0.6));

  // ---- bottom row
  for (let r = 0; r < 3; r++) {
    line(ctx, 60, 1985 + r * 40, 420, 1985 + r * 40, rgba(th.dim, 0.8), 3);
    line(ctx, 460, 1985 + r * 40, 1060, 1985 + r * 40, rgba(th.faint, 0.8), 3);
    barMeter(ctx, 460, 1982 + r * 40, 600, 6, wave(360 + r, frame, 0.2, 0.9), th, rgba(th.text, 0.6));
  }
  [0, 1, 2].forEach((i) => {
    const v2 = wave(370 + i, frame, 0.2, 0.95, 2);
    gauge(ctx, 1240 + i * 200, 2040, 62, v2, th, i === 1 ? at.accent : th.text, undefined, 6);
    text(ctx, `${pad(Math.floor(v2 * 99), 2)}.${pad(tick(375 + i, frame, 5, 1), 1)}`, 1240 + i * 200, 2052, 30, th.text, { align: 'center' });
  });
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) rect(ctx, 1900 + c * 24, 1990 + r * 24, 12, 12, hash01(380, r, c, Math.floor(frame / 15)) > 0.5 ? rgba(th.text, 0.7) : rgba(th.faint, 0.6));
  for (let i = 0; i < 6; i++) numBox(ctx, 2140 + i * 140, 1975, 124, 130, pad(tick(390 + i, frame, 25, 2), 2), `${pad(Math.floor(hash01(391, i) * 99), 2)}.${pad(Math.floor(hash01(392, i) * 999), 3)}`, th);
  segBar(ctx, 60, 2110, 1000, 10, 40, wave(399, frame, 0.3, 0.9), th, rgba(th.text, 0.6));
};

export const GPSAnalysis: React.FC<{ variant: 'blue' | 'amber' }> = ({ variant }) => {
  const at = variant === 'blue' ? BLUE : AMBER;
  const style = variant === 'blue' ? ANALYSIS_BLUE : ANALYSIS_AMBER;
  const lockCol = hex(at.lock);
  const draw = (m: PixiMap, frame: number) => {
    const s = Math.min(SHOTS.length - 1, Math.floor(frame / SHOT));
    const t = (frame - s * SHOT) / SHOT;
    const v = shotView(s, t);
    m.render({ cx: v.cx, cy: v.cy, zoom: v.zoom, rot: 0 }, {
      fx: [{ kind: 'glow', x: v.p.x, y: v.p.y, r: 60, color: lockCol, alpha: 0.5, world: true }],
      vigShape: [-0.05, 0, 1.1],
    });
  };
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <MapCanvas style={style} x={MAP.x} y={MAP.y} w={MAP.w} h={MAP.h} draw={draw} />
      <HudCanvas draw={drawHud(at)} />
      <div style={{ position: 'absolute', zIndex: 3, left: 0, top: 0 }}>
        <Globe x={3420 - 290} y={590 - 290} d={580} landColor={at.globeLand} seaColor={at.globeSea} lineColor={at.globeLine} spin={0.75} dotSize={5.5} />
      </div>
    </AbsoluteFill>
  );
};

// Looks 8-9: target locator. A dim city drifts; every 60 frames a target
// bracket pops up on a named point with a label on a leader line. 600-frame loop.
import { AbsoluteFill } from 'remotion';
import { MapCanvas } from '../render/MapCanvas';
import type { PixiMap } from '../render/pixiMap';
import { GREY } from '../looks/styles';
import { CITY, LOOP, MAP_W, MAP_H, type POI } from '../city';
import { HudCanvas } from '../hud/HudCanvas';
import { Globe } from '../render/Globe';
import {
  type Ctx, type Theme, text, line, rect, roundRect, dataRows, tick, pad, wave, rgba, worldMap, cGauge, toggle, lf, TAU, heading, brackets,
} from '../hud/kit';
import { hash01 } from '../lib/rng';

const TH: Theme = { text: '#E8EAEC', dim: '#8E949A', faint: '#4A5056', accent: '#4FD8D0', accent2: '#F0A030', panel: '#1B1D20', panelEdge: '#34383C' };
const PERIOD = 60; // a new target every 2 s -> 10 per loop
const N_T = LOOP / PERIOD;

const view = (frame: number) => {
  const a = (lf(frame) / LOOP) * TAU;
  return { cx: MAP_W * 0.52 + 420 * Math.cos(a), cy: MAP_H * 0.5 + 260 * Math.sin(a), zoom: 0.34, rot: 0 };
};
const toScreen = (v: ReturnType<typeof view>, x: number, y: number) => ({ x: 1920 + (x - v.cx) * v.zoom, y: 1080 + (y - v.cy) * v.zoom });

// schedule: target i appears at frame i*PERIOD, at a POI that is in the open part of the frame
const SCHEDULE: POI[] = (() => {
  const out: POI[] = [];
  const used = new Set<number>();
  for (let i = 0; i < N_T; i++) {
    const v = view(i * PERIOD + 30);
    const prev = out[i - 1];
    let best = -1, bestScore = -Infinity;
    CITY.pois.forEach((p, j) => {
      if (used.has(j)) return;
      const s = toScreen(v, p.x, p.y);
      if (s.x < 1000 || s.x > 2650 || s.y < 300 || s.y > 1780) return;
      const ps = prev ? toScreen(v, prev.x, prev.y) : { x: 1900, y: 1000 };
      const d = Math.hypot(s.x - ps.x, s.y - ps.y);
      const score = Math.min(d, 900) + hash01(i, j) * 300;
      if (score > bestScore) { bestScore = score; best = j; }
    });
    if (best < 0) best = i;
    used.add(best);
    out.push(CITY.pois[best]);
  }
  return out;
})();

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));

const drawHud = (red: boolean) => (ctx: Ctx, frame: number) => {
  const f = lf(frame);
  const v = view(frame);
  const tc = red ? '#FF3A3A' : '#FFD03A';
  // ---- left panel
  ctx.fillStyle = rgba('#0E0F10', 0.94);
  roundRect(ctx, -20, 114, 836, 1690, 18); ctx.fill();
  ctx.strokeStyle = rgba(TH.text, 0.45); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(414, 495, 330, 0, TAU); ctx.stroke();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU - (f / LOOP) * TAU;
    line(ctx, 414 + Math.cos(a) * 340, 495 + Math.sin(a) * 340, 414 + Math.cos(a) * (i % 5 ? 350 : 366), 495 + Math.sin(a) * (i % 5 ? 350 : 366), rgba(TH.text, 0.55), 2);
  }
  ctx.strokeStyle = rgba(TH.text, 0.8); ctx.lineWidth = 4;
  const ga = (f / LOOP) * TAU * 2;
  ctx.beginPath(); ctx.arc(414, 495, 385, ga, ga + 0.9); ctx.stroke();
  line(ctx, 50, 1005, 520, 1005, rgba(TH.dim, 0.8), 3);
  line(ctx, 50, 1050, 500, 1050, rgba(TH.text, 0.7), 4);
  for (let r = 0; r < 3; r++) text(ctx, `${pad(tick(700 + r, f, 30, 5), 5)}  ${pad(Math.floor(hash01(701, r) * 9999), 4)}`, 640, 975 + r * 36, 20, TH.dim);
  text(ctx, `ACS - ${pad(tick(705, f, 60, 3), 3)}`, 50, 1118, 28, TH.text);
  rect(ctx, 270, 1090, 140, 34, rgba('#5AA0E0', 0.8)); text(ctx, `OCS-${pad(tick(706, f, 60, 3), 3)}`, 340, 1116, 22, '#0A0B0C', { align: 'center' });
  rect(ctx, 480, 1090, 140, 34, undefined, '#5AA0E0', 2); text(ctx, `V-CH-${pad(tick(707, f, 60, 3), 3)}`, 550, 1116, 22, '#9CCBF0', { align: 'center' });
  for (let r = 0; r < 5; r++) {
    text(ctx, `${pad(Math.floor(hash01(710, r) * 99999), 5)} ${pad(Math.floor(hash01(711, r) * 99999), 5)}`, 50, 1220 + r * 40, 20, TH.dim);
    const vv = wave(712 + r, f, 0.5, 1, 1 + (r % 2));
    for (let k = 0; k < 26; k++) if (k / 26 < vv) rect(ctx, 380 + k * 14, 1212 + r * 40, 7, 3, rgba(TH.text, 0.7));
    ctx.fillStyle = '#F0A030'; ctx.beginPath(); ctx.arc(380 + 26 * 14 * vv + 8, 1213 + r * 40, 7, 0, TAU); ctx.fill();
  }
  heading(ctx, 'DATA ANALYSIS', 50, 1428, TH, 34);
  line(ctx, 330, 1418, 520, 1418, rgba('#F0A030', 0.9), 2);
  dataRows(ctx, 50, 1480, 3, [5, 2, 2, 5, 5, 3], 720, f, TH, 19, 30);
  heading(ctx, 'GPS DATA - 024', 50, 1660, TH, 34);
  line(ctx, 330, 1650, 520, 1650, rgba('#F0A030', 0.9), 2);
  dataRows(ctx, 50, 1712, 2, [5, 4, 2, 5, 5, 3], 721, f, TH, 19, 30);

  // ---- right-top text blocks
  line(ctx, 2255, 110, 2255, 450, rgba(TH.text, 0.5), 2);
  line(ctx, 2255, 110, 2700, 110, rgba(TH.text, 0.5), 2);
  text(ctx, '■ Satellite Positioning', 2280, 150, 24, TH.text, { font: 'label' });
  for (let r = 0; r < 4; r++) text(ctx, `${'Signal grid reference block'.slice(0, 18 + r * 3)} ${pad(Math.floor(hash01(730, r) * 999), 3)}`, 2300, 186 + r * 24, 16, TH.dim);
  for (let r = 0; r < 3; r++) text(ctx, `● DATA NODE ${r + 1}   ${pad(tick(731 + r, f, 20, 3), 3)}   ${pad(tick(734 + r, f, 30, 4), 4)}   ${pad(Math.floor(hash01(737, r) * 9999), 4)}`, 2300, 330 + r * 30, 18, r === 1 ? TH.text : TH.dim);
  ['SECTOR-11', 'SECTOR-30', 'SECTOR-04', 'SECTOR-13'].forEach((l, i) => {
    text(ctx, l, 2860 + i * 180, 108, 20, TH.dim, { font: 'label' });
    text(ctx, pad(tick(740 + i, f, 60, 2), 2), 2860 + i * 180, 172, 50, TH.text);
  });
  for (let c = 0; c < 3; c++) {
    const x0 = 2850 + c * 320;
    text(ctx, `● SYS - ${pad(Math.floor(hash01(745, c) * 999), 3)} - SECTOR`, x0, 540, 17, TH.accent);
    for (let r = 0; r < 2; r++) text(ctx, `${pad(Math.floor(hash01(746, c, r) * 999999), 6)}  ${pad(tick(747 + c * 2 + r, f, 15, 3), 3)}`, x0 + 20, 572 + r * 26, 17, TH.dim);
  }
  for (let r = 0; r < 3; r++) { line(ctx, 2330, 540 + r * 34, 2740, 540 + r * 34, rgba(TH.text, r === 1 ? 0.7 : 0.35), r === 1 ? 6 : 3); }
  for (let i = 0; i < 4; i++) cGauge(ctx, 2360 + i * 120, 735, 26, wave(750 + i, f, 0.3, 1), TH, rgba(TH.text, 0.85), 5);
  // world map panel
  rect(ctx, 2805, 786, 980, 460, rgba('#1E2124', 0.85));
  worldMap(ctx, 2830, 805, 930, 420, rgba('#5A6068', 0.75), 9, 3.2);
  const arcP = (u: number) => ({ x: 2930 + 720 * u, y: 1160 - 230 * Math.sin(Math.PI * u) + 60 * u });
  ctx.strokeStyle = rgba(TH.text, 0.7); ctx.lineWidth = 2; ctx.setLineDash([9, 7]);
  ctx.beginPath(); for (let i = 0; i <= 50; i++) { const q = arcP(i / 50); if (i) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); } ctx.stroke();
  ctx.setLineDash([]);
  const sp = arcP(0.42);
  ctx.strokeStyle = '#F06AA8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(sp.x, sp.y, 12 + 6 * Math.sin((f / 30) * TAU), 0, TAU); ctx.stroke();
  ctx.fillStyle = '#F06AA8'; ctx.beginPath(); ctx.arc(sp.x, sp.y, 5, 0, TAU); ctx.fill();
  text(ctx, `GPS ${pad(tick(760, f, 60, 4), 4)} ${pad(tick(761, f, 60, 3), 3)}`, sp.x + 24, sp.y - 16, 18, TH.text);
  // ETA box + toggles + teal bars + gauges
  rect(ctx, 3300, 1410, 230, 40, undefined, rgba(TH.text, 0.7), 2);
  text(ctx, `ETA  ${pad(tick(762, f, 30, 3), 3)}:${pad(tick(763, f, 6, 2), 2)}`, 3315, 1440, 26, TH.text);
  for (let r = 0; r < 3; r++) { toggle(ctx, 3560, 1470 + r * 40, hash01(764, r, Math.floor(f / 120)) > 0.4, TH, 46, 20); text(ctx, `MULTI-CORE ${pad(Math.floor(hash01(765, r) * 99), 2)}`, 3300, 1488 + r * 40, 18, TH.dim); }
  for (let r = 0; r < 2; r++) {
    line(ctx, 2805, 1635 + r * 30, 3270, 1635 + r * 30, rgba(TH.accent, 0.8), 5);
    line(ctx, 3320, 1635 + r * 30, 3780, 1635 + r * 30, rgba(TH.accent, 0.5), 5);
    rect(ctx, 2805 + 420 * wave(766 + r, f, 0.2, 1), 1628 + r * 30, 30, 14, TH.accent);
  }
  line(ctx, 3300, 1600, 3300, 1880, rgba(TH.accent, 0.6), 2);
  for (let i = 0; i < 4; i++) cGauge(ctx, 2885 + i * 120, 1800, 36, wave(770 + i, f, 0.3, 1, 2), TH, TH.accent, 8);

  // static amber callouts at the panel edge (as in the reference)
  [[890, 1095, 900], [800, 1995, 901]].forEach(([x, y, id]) => {
    ctx.fillStyle = rgba('#F0A030', 0.3); ctx.beginPath(); ctx.arc(x, y, 18, 0, TAU); ctx.fill();
    ctx.fillStyle = '#F5B040'; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.fill();
    text(ctx, `${pad(tick(id, f, 30, 6), 6)}  ${pad(tick(id + 1, f, 60, 5), 5)}  ${pad(tick(id + 2, f, 15, 6), 6)}`, x + 40, y + 9, 26, TH.text);
  });
  line(ctx, 795, 1800, 795, 2030, rgba(TH.text, 0.45), 2);
  // ---- bottom ruler (scrolling ticks, periodic)
  const ry = 2040;
  line(ctx, 120, ry, 3720, ry, rgba(TH.text, 0.4), 2);
  const off = (f / LOOP) * 400;
  for (let i = 0; i < 90; i++) {
    const x = 120 + ((i * 40 - off) % 3600 + 3600) % 3600;
    line(ctx, x, ry - (i % 10 === 0 ? 26 : 10), x, ry + (i % 10 === 0 ? 10 : 0), rgba(TH.text, 0.6), 2);
  }
  text(ctx, `002  ${pad(tick(780, f, 10, 10), 10)}  ${pad(tick(781, f, 15, 6), 6)}  00`, 120, 2010, 22, TH.dim);
  for (let i = 0; i < 6; i++) {
    const x = 120 + ((i * 600 + 300 - off * 1.5) % 3600 + 3600) % 3600;
    ctx.fillStyle = i % 2 ? '#F06AA8' : rgba('#F0A030', 0.9); ctx.beginPath(); ctx.arc(x, ry, 6, 0, TAU); ctx.fill();
    text(ctx, pad(Math.floor(hash01(782, i) * 99999), 5), x + 12, ry - 14, 16, TH.dim);
  }
  ctx.strokeStyle = rgba(TH.text, 0.35); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(2750, 2030, 80, 0, TAU); ctx.stroke();

  // ---- targets
  const cur = Math.floor(f / PERIOD);
  for (let back = 0; back < 2; back++) {
    const i = (cur - back + N_T) % N_T;
    const age = f - i * PERIOD + (back && cur - back < 0 ? LOOP : 0) + (i > cur ? -LOOP : 0) + (i > cur ? LOOP : 0);
    const a = ((f - i * PERIOD) % LOOP + LOOP) % LOOP; // frames since this target appeared
    void age;
    if (a > PERIOD + 24) continue;
    const p = SCHEDULE[i];
    const s = toScreen(v, p.x, p.y);
    const fadeOut = a > PERIOD ? 1 - (a - PERIOD) / 24 : 1;
    const sc = ease(a / 8);
    const pop = a < 8 ? 1.6 - 0.6 * sc : 1;
    const pulse = a >= 10 && a < 26 ? (a - 10) / 16 : -1;
    ctx.globalAlpha = Math.max(0, fadeOut);
    const half = 34 * pop;
    brackets(ctx, s.x - half, s.y - half, half * 2, half * 2, 16 * pop, tc, 4);
    rect(ctx, s.x - 9, s.y - 9, 18, 18, tc);
    if (pulse >= 0) { ctx.strokeStyle = rgba(tc, 1 - pulse); ctx.lineWidth = 3; ctx.strokeRect(s.x - half - 40 * pulse, s.y - half - 40 * pulse, (half + 40 * pulse) * 2, (half + 40 * pulse) * 2); }
    // leader line + label
    const L = ease((a - 6) / 14);
    if (L > 0) {
      const lx = s.x + 60, ly = s.y - 110;
      line(ctx, s.x + half, s.y - half, s.x + half + (lx - s.x - half) * L, s.y - half + (ly - s.y + half) * L, rgba(TH.text, 0.85), 2);
      if (L >= 1) {
        line(ctx, lx, ly, lx + 330, ly, rgba(TH.text, 0.6), 2);
        ctx.fillStyle = rgba(tc, 0.25); ctx.beginPath(); ctx.arc(lx, ly, 20, 0, TAU); ctx.fill();
        ctx.fillStyle = tc; ctx.beginPath(); ctx.arc(lx, ly, 8, 0, TAU); ctx.fill();
        text(ctx, p.code, lx + 22, ly - 14, 30, tc);
        text(ctx, `${pad(p.e, 6)}  ${pad(p.n, 6)}`, lx + 22, ly + 34, 24, TH.text);
      }
    }
    // crosshair lines slide from the previous target on every other target
    if (i % 2 === 0 && a < PERIOD) {
      const prev = SCHEDULE[(i - 1 + N_T) % N_T];
      const ps = toScreen(v, prev.x, prev.y);
      const k = ease(a / 16);
      const cx = ps.x + (s.x - ps.x) * k, cy = ps.y + (s.y - ps.y) * k;
      const al = a < 40 ? 0.55 : 0.55 * (1 - (a - 40) / 20);
      line(ctx, cx, 0, cx, 2160, rgba(TH.text, al * 0.6), 1.5);
      line(ctx, 816, cy, 3840, cy, rgba(TH.text, al * 0.35), 1.5);
    }
    ctx.globalAlpha = 1;
    if (red && a < 6) {
      ctx.fillStyle = rgba('#FF2020', 0.16 * (1 - a / 6));
      ctx.fillRect(0, 0, 3840, 2160);
    }
  }
};

export const TargetLocator: React.FC<{ variant: 'grey' | 'red' }> = ({ variant }) => {
  const draw = (m: PixiMap, frame: number) => m.render(view(frame), { vigShape: [0, 0, 1.05] });
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <MapCanvas style={GREY} w={3840} h={2160} draw={draw} />
      <HudCanvas draw={drawHud(variant === 'red')} />
      <div style={{ position: 'absolute', zIndex: 3, left: 0, top: 0 }}>
        <Globe x={414 - 300} y={495 - 300} d={600} landColor="#E8FCFF" seaColor="#14262E" lineColor="#E0ECF2" spin={1} dotSize={6} seaDot="#9AD8EA" seaA={0.7} arcColor="#FFFFFF" nArcs={16} />
      </div>
    </AbsoluteFill>
  );
};

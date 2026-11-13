// The one city every look uses. Generated once at module load from CITY_SEED.
import { generateCity, MAP_W, MAP_H, type CityRaw } from './generate';
import { buildGraph, routeBetween, statesToPolyline, nearestNode, type Graph } from './graph';
import { mulberry32 } from '../lib/rng';

// Change this to get a different invented city (see README).
export const CITY_SEED = 20261113;

export const LOOP = 600; // frames in every loop

export interface Route { pts: number[]; junctions: number[]; length: number; center: { x: number; y: number } }
export interface POI { x: number; y: number; code: string; e: number; n: number; deg: number }

function buildRoute(raw: CityRaw, g: Graph, cx: number, cy: number, R: number, seed: number): Route | null {
  const r = mulberry32(seed);
  for (let attempt = 0; attempt < 60; attempt++) {
    const n = 4;
    const a0 = r() * Math.PI * 2;
    const wps: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2 + (r() - 0.5) * 0.5;
      const rr = R * (0.8 + r() * 0.4);
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr * 0.8;
      if (!raw.landAt(x, y)) break;
      wps.push(nearestNode(g, x, y));
    }
    if (wps.length < n || new Set(wps).size < n) continue;
    const banned = new Set<number>();
    const states: number[] = [];
    let ok = true;
    for (let i = 0; i < n; i++) {
      const leg = routeBetween(g, wps[i], wps[(i + 1) % n], states.length ? states[states.length - 1] : -1, banned);
      if (!leg) { ok = false; break; }
      for (const s of leg) { states.push(s); banned.add(s >> 1); }
    }
    if (!ok) continue;
    // closing turn at wp0 must not be a U-turn or a sharp kink
    const { pts, nodes } = statesToPolyline(g, states);
    const m = pts.length;
    const inx = pts[m - 2] - pts[m - 4], iny = pts[m - 1] - pts[m - 3];
    const ox = pts[2] - pts[0], oy = pts[3] - pts[1];
    const dot = (inx * ox + iny * oy) / (Math.hypot(inx, iny) * Math.hypot(ox, oy));
    if (dot < 0.0) continue;
    let length = 0;
    for (let i = 2; i < pts.length; i += 2) length += Math.hypot(pts[i] - pts[i - 2], pts[i + 1] - pts[i - 1]);
    if (length < R * 3.5) continue;
    return { pts, junctions: nodes, length, center: { x: cx, y: cy } };
  }
  return null;
}

function buildPOIs(g: Graph, seed: number): POI[] {
  const r = mulberry32(seed);
  const cand = g.nodes
    .map((nd, i) => ({ i, nd }))
    .filter(({ nd }) => nd.edges.length >= 3 && nd.edges.some((e) => g.edges[e].cls === 'avenue'))
    .filter(({ nd }) => nd.x > 400 && nd.x < MAP_W - 400 && nd.y > 400 && nd.y < MAP_H - 400);
  for (let i = cand.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [cand[i], cand[j]] = [cand[j], cand[i]]; }
  const out: POI[] = [];
  for (const c of cand) {
    if (out.length >= 64) break;
    if (out.some((p) => Math.hypot(p.x - c.nd.x, p.y - c.nd.y) < 650)) continue;
    out.push({
      x: c.nd.x, y: c.nd.y, deg: c.nd.edges.length,
      code: `TRK-${String(100 + Math.floor(r() * 9800)).padStart(4, '0')}`,
      // invented local grid coordinates (not lat/long of any real place)
      e: 482000 + Math.round(c.nd.x), n: 739000 - Math.round(c.nd.y),
    });
  }
  return out;
}

function build() {
  const raw = generateCity(CITY_SEED);
  const graph = buildGraph(raw.roads);
  // tracking loop centred on the middle of the map so wide frames stay inside the generated area
  const cx = MAP_W * 0.55, cy = MAP_H * 0.5;
  const routes: Route[] = [];
  const specs = [
    { x: cx, y: cy, R: 1050 },
    { x: cx + 1800, y: cy + 300, R: 900 },
    { x: cx - 600, y: cy - 1300, R: 900 },
  ];
  specs.forEach((s, i) => {
    const rt = buildRoute(raw, graph, s.x, s.y, s.R, CITY_SEED + 101 * (i + 1));
    if (rt) routes.push(rt);
  });
  const pois = buildPOIs(graph, CITY_SEED + 7);
  return { raw, graph, routes, pois };
}

export const CITY = build();
export { MAP_W, MAP_H };

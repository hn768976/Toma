import { geoEquirectangular, geoGraticule } from "d3-geo";
import type { FeatureCollection, Geometry } from "geojson";
import { loadJson } from "./Stage";
import { hashString, mulberry32 } from "./random";

type P = [number, number];

// Map space (3840-basis comp px). Latitudes 85N..75S, equirectangular,
// 1.3x the frame width so it can drift sideways and back.
export const MAP_W = 4992;
const LAT_TOP = 85;
const LAT_BOTTOM = -75;
export const MAP_H = (MAP_W * (LAT_TOP - LAT_BOTTOM)) / 360;

export const projection = geoEquirectangular()
  .scale(MAP_W / (2 * Math.PI))
  .translate([MAP_W / 2, (MAP_W / (2 * Math.PI)) * ((LAT_TOP * Math.PI) / 180)]);

const project = (pts: number[][]): P[] => pts.map((p) => projection(p as [number, number]) as P);

// Douglas-Peucker
const simplify = (pts: P[], tol: number): P[] => {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = pts[a];
    const [bx, by] = pts[b];
    const dx = bx - ax;
    const dy = by - ay;
    const L = Math.hypot(dx, dy);
    let best = -1;
    let bd = tol;
    for (let i = a + 1; i < b; i++) {
      // closed rings start and end on the same point: fall back to point distance
      const d = L < 1e-9 ? Math.hypot(pts[i][0] - ax, pts[i][1] - ay) : Math.abs((pts[i][0] - ax) * dy - (pts[i][1] - ay) * dx) / L;
      if (d > bd) (bd = d), (best = i);
    }
    if (best > 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  return pts.filter((_, i) => keep[i]);
};

export type World = {
  rings: P[][];
  graticule: P[][];
  hatch: [number, number, number, number][];
  landMask: HTMLCanvasElement;
};

let worldPromise: Promise<World> | null = null;

export const loadWorld = () => {
  if (!worldPromise) worldPromise = loadJson<FeatureCollection<Geometry>>("data/ne_50m_land.geojson").then(buildWorld);
  return worldPromise;
};

const buildWorld = (fc: FeatureCollection<Geometry>): World => {
  const rings: P[][] = [];
  for (const f of fc.features) {
    const g = f.geometry;
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    for (const poly of polys)
      for (const ring of poly) {
        // a looser trace than the data: hand-copied maps drop the finest wiggles
        const pr = simplify(project(ring), 2.6);
        let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
        for (const [x, y] of pr) (minx = Math.min(minx, x)), (maxx = Math.max(maxx, x)), (miny = Math.min(miny, y)), (maxy = Math.max(maxy, y));
        if (maxx - minx < 12 && maxy - miny < 12) continue;
        rings.push(pr);
      }
  }
  const graticule = geoGraticule()
    .step([30, 30])
    .extent([
      [-180, LAT_BOTTOM - 1],
      [180.01, LAT_TOP + 1],
    ])
    .lines()
    .map((l) => project(l.coordinates));

  // land mask at half map resolution (used for the sea cut-out and hatching)
  const MS = 0.5;
  const landMask = document.createElement("canvas");
  landMask.width = Math.round(MAP_W * MS);
  landMask.height = Math.round(MAP_H * MS);
  const lc = landMask.getContext("2d", { willReadFrequently: true })!;
  lc.fillStyle = "#000";
  lc.fillRect(0, 0, landMask.width, landMask.height);
  lc.fillStyle = "#fff";
  lc.beginPath();
  for (const r of rings) {
    r.forEach(([x, y], i) => (i ? lc.lineTo(x * MS, y * MS) : lc.moveTo(x * MS, y * MS)));
    lc.closePath();
  }
  lc.fill("evenodd");

  // distance to the coast (land side) on a quarter-res grid, chamfer 3-4
  const DS = 0.25;
  const gw = Math.round(MAP_W * DS);
  const gh = Math.round(MAP_H * DS);
  const small = document.createElement("canvas");
  small.width = gw;
  small.height = gh;
  const sc = small.getContext("2d", { willReadFrequently: true })!;
  sc.drawImage(landMask, 0, 0, gw, gh);
  const px = sc.getImageData(0, 0, gw, gh).data;
  const dist = new Float32Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) dist[i] = px[i * 4] > 127 ? 1e9 : 0;
  const relax = (i: number, j: number, c: number) => {
    if (dist[j] + c < dist[i]) dist[i] = dist[j] + c;
  };
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      if (x > 0) relax(i, i - 1, 3);
      if (y > 0) {
        relax(i, i - gw, 3);
        if (x > 0) relax(i, i - gw - 1, 4);
        if (x < gw - 1) relax(i, i - gw + 1, 4);
      }
    }
  for (let y = gh - 1; y >= 0; y--)
    for (let x = gw - 1; x >= 0; x--) {
      const i = y * gw + x;
      if (x < gw - 1) relax(i, i + 1, 3);
      if (y < gh - 1) {
        relax(i, i + gw, 3);
        if (x < gw - 1) relax(i, i + gw + 1, 4);
        if (x > 0) relax(i, i + gw - 1, 4);
      }
    }
  const distAt = (x: number, y: number) => {
    const gx = Math.min(gw - 1, Math.max(0, Math.floor(x * DS)));
    const gy = Math.min(gh - 1, Math.max(0, Math.floor(y * DS)));
    return (dist[gy * gw + gx] / 3) / DS; // map units
  };

  // hatching: diagonal strokes on land, only within a ragged band of the coast
  const rng = mulberry32(hashString("HatchedMap-hatch"));
  const hatch: [number, number, number, number][] = [];
  let setIndex = 0;
  const addSet = (angle: number, spacing: number, bandBase: number) => {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const nx = -dy;
    const ny = dx;
    const span = MAP_W + MAP_H;
    for (let o = -span; o < span; o += spacing * (0.75 + 0.5 * rng())) {
      const band = bandBase * (0.75 + 0.5 * rng());
      let start: P | null = null;
      let last: P | null = null;
      const step = 5;
      for (let t = -span; t < span; t += step) {
        const x = MAP_W / 2 + nx * o + dx * t;
        const y = MAP_H / 2 + ny * o + dy * t;
        const inside = x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
        const d = inside ? distAt(x, y) : 0;
        // hatch direction changes from region to region, as a hand would turn the page
        const region = Math.sin(x * 0.0013 + 1.7) * Math.sin(y * 0.0021 + 0.4) + Math.sin(x * 0.0007 - y * 0.0009) * 0.6;
        const ok = inside && d > 3 && d < band && (setIndex === 1 || (region > 0) === (angle < 0));
        if (ok && !start) start = [x, y];
        if (ok) last = [x, y];
        const len = start && last ? Math.hypot(last[0] - start[0], last[1] - start[1]) : 0;
        if (start && last && (!ok || len > 70)) {
          // a hand hatches unevenly: skip some strokes, wobble the ends
          if (len > 6 && rng() > 0.12) hatch.push([start[0] + (rng() - 0.5) * 8, start[1] + (rng() - 0.5) * 8, last[0] + (rng() - 0.5) * 10, last[1] + (rng() - 0.5) * 10]);
          start = ok ? [x, y] : null;
          last = ok ? last : null;
        }
      }
    }
  };
  addSet(-Math.PI / 4, 15, 66);
  addSet(Math.PI / 3.2, 15, 66);
  setIndex = 1;
  addSet(Math.PI / 5, 17, 26);
  return { rings, graticule, hatch, landMask };
};

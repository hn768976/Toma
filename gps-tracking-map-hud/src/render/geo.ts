// Land mask from Natural Earth 1:110m land (public domain, via world-atlas).
import { feature } from 'topojson-client';
import land110 from 'world-atlas/land-110m.json';
import { pointInPoly } from '../city/geom';

export const RES = 2; // raster cells per degree
let mask: Uint8Array | null = null;

export function landMask(): Uint8Array {
  if (mask) return mask;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const topo = land110 as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fc = feature(topo, topo.objects.land) as any;
  const rings: { pts: number[]; bb: number[] }[] = [];
  for (const ft of fc.features) {
    const g = ft.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    for (const poly of polys) {
      const outer = poly[0] as number[][];
      const pts = outer.flat();
      let x0 = 999, y0 = 999, x1 = -999, y1 = -999;
      for (const [x, y] of outer) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      rings.push({ pts, bb: [x0, y0, x1, y1] });
    }
  }
  const W = 360 * RES, H = 180 * RES;
  mask = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) {
    const lat = 90 - (j + 0.5) / RES;
    for (let i = 0; i < W; i++) {
      const lon = -180 + (i + 0.5) / RES;
      for (const r of rings) {
        if (lon < r.bb[0] || lon > r.bb[2] || lat < r.bb[1] || lat > r.bb[3]) continue;
        if (pointInPoly(lon, lat, r.pts)) { mask[j * W + i] = 1; break; }
      }
    }
  }
  return mask;
}

export function isLand(lon: number, lat: number): boolean {
  const m = landMask();
  const W = 360 * RES, H = 180 * RES;
  const i = Math.min(W - 1, Math.max(0, Math.floor((lon + 180) * RES)));
  const j = Math.min(H - 1, Math.max(0, Math.floor((90 - lat) * RES)));
  return m[j * W + i] === 1;
}

// Fibonacci-sphere sample points: [x,y,z,land(0/1)] ...
let sphere: Float32Array | null = null;
export function globePoints(n = 26000): Float32Array {
  if (sphere) return sphere;
  const out: number[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = ga * i;
    const x = Math.cos(th) * r, z = Math.sin(th) * r;
    const lat = (Math.asin(y) * 180) / Math.PI;
    const lon = (Math.atan2(x, z) * 180) / Math.PI;
    const l = isLand(lon, lat) ? 1 : 0;
    if (l || i % 5 === 0) out.push(x, y, z, l);
  }
  sphere = new Float32Array(out);
  return sphere;
}

import { geoPath, type GeoProjection, type GeoPermissibleObjects } from "d3-geo";

// Records what d3-geo draws as plain rings/polylines (texture pixels), so the
// same projected geometry feeds Canvas drawing and point-in-polygon tests.
export type Ring = { pts: Float64Array; minX: number; minY: number; maxX: number; maxY: number };

class Recorder {
  rings: Ring[] = [];
  private cur: number[] = [];
  private flush() {
    if (this.cur.length >= 4) {
      const pts = Float64Array.from(this.cur);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let i = 0; i < pts.length; i += 2) {
        if (pts[i] < minX) minX = pts[i];
        if (pts[i] > maxX) maxX = pts[i];
        if (pts[i + 1] < minY) minY = pts[i + 1];
        if (pts[i + 1] > maxY) maxY = pts[i + 1];
      }
      this.rings.push({ pts, minX, minY, maxX, maxY });
    }
    this.cur = [];
  }
  beginPath() {}
  moveTo(x: number, y: number) {
    this.flush();
    this.cur.push(x, y);
  }
  lineTo(x: number, y: number) {
    this.cur.push(x, y);
  }
  closePath() {
    if (this.cur.length >= 2) this.cur.push(this.cur[0], this.cur[1]);
    this.flush();
  }
  arc() {}
  done() {
    this.flush();
    return this.rings;
  }
}

export const projectRings = (proj: GeoProjection, obj: GeoPermissibleObjects): Ring[] => {
  const rec = new Recorder();
  geoPath(proj, rec as unknown as CanvasRenderingContext2D)(obj);
  return rec.done();
};

export const ringsToPath = (rings: Ring[], closed: boolean, into = new Path2D()) => {
  for (const r of rings) {
    const p = r.pts;
    into.moveTo(p[0], p[1]);
    for (let i = 2; i < p.length; i += 2) into.lineTo(p[i], p[i + 1]);
    if (closed) into.closePath();
  }
  return into;
};

// Even-odd point-in-polygon over all rings of a feature.
export const insideRings = (rings: Ring[], x: number, y: number) => {
  let inside = false;
  for (const r of rings) {
    if (x < r.minX || x > r.maxX || y < r.minY || y > r.maxY) continue;
    const p = r.pts;
    for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
      const yi = p[i + 1], yj = p[j + 1];
      if (yi > y !== yj > y) {
        const xi = p[i], xj = p[j];
        if (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
      }
    }
  }
  return inside;
};

export const ringArea = (r: Ring) => {
  const p = r.pts;
  let a = 0;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) a += p[j] * p[i + 1] - p[i] * p[j + 1];
  return a / 2;
};

export const ringsBBox = (rings: Ring[]) => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rings) {
    minX = Math.min(minX, r.minX);
    minY = Math.min(minY, r.minY);
    maxX = Math.max(maxX, r.maxX);
    maxY = Math.max(maxY, r.maxY);
  }
  return { minX, minY, maxX, maxY };
};

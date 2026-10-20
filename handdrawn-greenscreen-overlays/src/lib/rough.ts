// Rough.js shapes -> pen strokes. Rough.js makes the sketchy outline / hatch
// geometry (seeded); @remotion/paths measures each sub-path so it can be
// re-sampled into points for the perfect-freehand pen to draw on.
import { getLength, getPointAtLength, getSubpaths } from '@remotion/paths';
import rough from 'roughjs';
import type { Drawable, Options } from 'roughjs/bin/core';
import { Pt } from './geom';
import { hashKeys } from './random';

const gen = rough.generator();

/** d-string -> points sampled every `step` px along its length. */
export const samplePath = (d: string, step = 6): Pt[] => {
  const L = getLength(d);
  const n = Math.max(2, Math.ceil(L / step) + 1);
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const p = getPointAtLength(d, (L * i) / (n - 1));
    if (p) out.push([p.x, p.y]);
  }
  return out;
};

export interface RoughStrokes {
  outline: Pt[][];
  fill: Pt[][];
}

/** Split a Rough.js drawable into pen strokes (outline passes, sketch fill passes). */
export const roughToStrokes = (d: Drawable, minLen = 20): RoughStrokes => {
  const outline: Pt[][] = [];
  const fill: Pt[][] = [];
  for (const set of d.sets) {
    if (set.type === 'fillPath') continue; // solid fills are drawn separately, never as strokes
    const path = gen.opsToPath(set, 2);
    for (const sub of getSubpaths(path)) {
      if (getLength(sub) < minLen) continue;
      (set.type === 'fillSketch' ? fill : outline).push(samplePath(sub));
    }
  }
  return { outline, fill };
};

/** Join sub-paths whose ends meet into continuous pen strokes. */
export const chain = (paths: Pt[][], maxGap = 12): Pt[][] => {
  const out: Pt[][] = [];
  for (const p of paths) {
    const cur = out[out.length - 1];
    if (cur) {
      const e = cur[cur.length - 1];
      if (Math.hypot(p[0][0] - e[0], p[0][1] - e[1]) < maxGap) {
        cur.push(...p.slice(1));
        continue;
      }
    }
    out.push([...p]);
  }
  return out;
};

/** Rough.js seed for an element: from the composition id and the element key. */
export const roughSeed = (compId: string, key: string) => (hashKeys(compId, key) % 2147483646) + 1;

export const roughPolygon = (pts: Pt[], compId: string, key: string, o: Options = {}) =>
  roughToStrokes(gen.polygon(pts, { roughness: 1.1, bowing: 1.2, seed: roughSeed(compId, key), ...o }));

export const roughEllipse = (c: Pt, w: number, h: number, compId: string, key: string, o: Options = {}) =>
  roughToStrokes(gen.ellipse(c[0], c[1], w, h, { roughness: 1.2, curveStepCount: 14, seed: roughSeed(compId, key), ...o }));

export const roughRect = (x: number, y: number, w: number, h: number, compId: string, key: string, o: Options = {}) =>
  roughToStrokes(gen.rectangle(x, y, w, h, { roughness: 1.3, bowing: 1.5, seed: roughSeed(compId, key), ...o }));

export const roughCurve = (pts: Pt[], compId: string, key: string, o: Options = {}) =>
  roughToStrokes(gen.curve(pts, { roughness: 1, seed: roughSeed(compId, key), ...o }));

export const roughLinear = (pts: Pt[], compId: string, key: string, o: Options = {}) =>
  roughToStrokes(gen.linearPath(pts, { roughness: 1, seed: roughSeed(compId, key), ...o }));

export const roughPath = (d: string, compId: string, key: string, o: Options = {}) =>
  roughToStrokes(gen.path(d, { roughness: 1, seed: roughSeed(compId, key), ...o }));

import { BufferAttribute, BufferGeometry } from "three";
import type { BrainAssets } from "./assets";
import { buildSegments } from "./primitives";
import { mulberry32 } from "./random";

// Three.js geometries built from the baked arrays, cached per asset object so
// every look in a tab shares one upload-ready copy.

const cache = new WeakMap<BrainAssets, Map<string, unknown>>();
export const memo = <T>(assets: BrainAssets, key: string, make: () => T): T => {
  let m = cache.get(assets);
  if (!m) {
    m = new Map();
    cache.set(assets, m);
  }
  if (!m.has(key)) m.set(key, make());
  return m.get(key) as T;
};

/** Full-detail cortex mesh with curvature / AO / sulcal depth / part label. */
export const cortexGeometry = (a: BrainAssets) =>
  memo(a, "cortex", () => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(a.mesh.position, 3));
    g.setAttribute("normal", new BufferAttribute(a.mesh.normal, 3));
    g.setAttribute("curv", new BufferAttribute(a.mesh.curv, 1));
    g.setAttribute("ao", new BufferAttribute(a.mesh.ao, 1));
    g.setAttribute("depth", new BufferAttribute(a.mesh.depth, 1));
    g.setAttribute("label", new BufferAttribute(Float32Array.from(a.mesh.label), 1));
    g.setIndex(new BufferAttribute(a.mesh.index, 1));
    g.computeBoundingSphere();
    return g;
  });

/** Inner structures mesh (label 3..6). */
export const innerGeometry = (a: BrainAssets) =>
  memo(a, "inner", () => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(a.inner.position, 3));
    g.setAttribute("normal", new BufferAttribute(a.inner.normal, 3));
    g.setAttribute("label", new BufferAttribute(Float32Array.from(a.inner.label), 1));
    g.setIndex(new BufferAttribute(a.inner.index, 1));
    g.computeBoundingSphere();
    return g;
  });

/**
 * Fibre curves as instanced fat segments. aCurve = (kind, r1, r2, fibreIndex);
 * aSeg = (t0, t1, ordinal, segment). `keep` filters fibres (default: all).
 */
export const fibreSegments = (a: BrainAssets, key: string, keep?: (i: number) => boolean) =>
  memo(a, `fibres-${key}`, () => {
    const { count, per, position, kind } = a.fibres;
    const ids: number[] = [];
    for (let i = 0; i < count; i++) if (!keep || keep(i)) ids.push(i);
    const rng = mulberry32(9100 + key.length * 31);
    return buildSegments(position, per, ids, (c) => [kind[c], rng(), rng(), c]);
  });

/** A prefix of the baked point samples as a Points geometry (cortex and/or inner). */
export const pointCloud = (a: BrainAssets, key: string, cortex: number, inner: number) =>
  memo(a, `points-${key}`, () => {
    const P = a.points;
    const n = Math.min(cortex, P.cortex) + Math.min(inner, P.inner);
    const pos = new Float32Array(n * 3);
    const nor = new Float32Array(n * 3);
    const attr = new Float32Array(n * 4); // curv, ao, label, rand
    const rng = mulberry32(7200 + key.length * 17);
    let k = 0;
    const take = (start: number, m: number) => {
      for (let i = start; i < start + m; i++, k++) {
        pos.set(P.position.subarray(i * 3, i * 3 + 3), k * 3);
        nor.set(P.normal.subarray(i * 3, i * 3 + 3), k * 3);
        attr[k * 4] = P.curv[i];
        attr[k * 4 + 1] = P.ao[i];
        attr[k * 4 + 2] = P.label[i];
        attr[k * 4 + 3] = rng();
      }
    };
    take(0, Math.min(cortex, P.cortex));
    take(P.cortex, Math.min(inner, P.inner));
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("normal", new BufferAttribute(nor, 3));
    g.setAttribute("aAttr", new BufferAttribute(attr, 4));
    return g;
  });

/**
 * Fibre curves as native line segments (GL_LINES): one primitive per segment,
 * ~17x cheaper than fat quads in SwiftShader. Per vertex: aT (0..1 along the
 * fibre) and aCurve = (kind, r1, r2, fibreIndex).
 */
export const fibreLines = (a: BrainAssets, key: string, keep?: (i: number) => boolean) =>
  memo(a, `fibre-lines-${key}`, () => {
    const { count, per, position, kind } = a.fibres;
    const ids: number[] = [];
    for (let i = 0; i < count; i++) if (!keep || keep(i)) ids.push(i);
    const nv = ids.length * (per - 1) * 2;
    const pos = new Float32Array(nv * 3);
    const t = new Float32Array(nv);
    const cur = new Float32Array(nv * 4);
    const rng = mulberry32(9100 + key.length * 31);
    let v = 0;
    for (const c of ids) {
      const r1 = rng();
      const r2 = rng();
      for (let j = 0; j < per - 1; j++) {
        for (let e = 0; e < 2; e++) {
          const src = (c * per + j + e) * 3;
          pos[v * 3] = position[src];
          pos[v * 3 + 1] = position[src + 1];
          pos[v * 3 + 2] = position[src + 2];
          t[v] = (j + e) / (per - 1);
          cur[v * 4] = kind[c];
          cur[v * 4 + 1] = r1;
          cur[v * 4 + 2] = r2;
          cur[v * 4 + 3] = c;
          v++;
        }
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("aT", new BufferAttribute(t, 1));
    g.setAttribute("aCurve", new BufferAttribute(cur, 4));
    return g;
  });

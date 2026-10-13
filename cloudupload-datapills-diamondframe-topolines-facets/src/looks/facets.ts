import * as THREE from "three";
import { LOOP, TAU } from "../common/constants";
import { makeStripEnv } from "../common/env";
import { mulberry32 } from "../common/random";
import type { World } from "../common/world";

/**
 * Look 5 - Faceted Relief. A tileable wall of star-faceted pyramids:
 * jittered seeds on a torus -> Voronoi cells -> each cell fanned into flat
 * triangles from its raised apex to its (subdivided) boundary. Ridges and
 * valleys get a thin chamfer highlight in the shader (normal of the
 * neighbouring facet averaged in within a fixed world width).
 */
export type FacetsParams = {
  metal: string;
  strip: string;
  key: string;
  background: string;
};

const T = 11.5; // tile period (world units)
const GRID = 4; // seeds per tile side -> 16 stars per tile

type V2 = [number, number];

const rng = mulberry32(0x5eed_f5);
const seeds: { p: V2; h: number }[] = [];
for (let j = 0; j < GRID; j++) {
  for (let i = 0; i < GRID; i++) {
    const c = T / GRID;
    seeds.push({
      p: [(i + 0.5 + (j % 2) * 0.5 + (rng() - 0.5) * 0.3) * c, (j + 0.5 + (rng() - 0.5) * 0.3) * c],
      h: c * (0.24 + 0.1 * rng()),
    });
  }
}

const clip = (poly: V2[], m: V2, n: V2): V2[] => {
  // keep points with (x - m) . n <= 0
  const out: V2[] = [];
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k];
    const b = poly[(k + 1) % poly.length];
    const da = (a[0] - m[0]) * n[0] + (a[1] - m[1]) * n[1];
    const db = (b[0] - m[0]) * n[0] + (b[1] - m[1]) * n[1];
    if (da <= 0) out.push(a);
    if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
      const f = da / (da - db);
      out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    }
  }
  return out;
};

type Tri = { p: THREE.Vector3[]; k: string[] };

/** Distance from p along unit dir u to the boundary of convex polygon poly. */
const rayToPoly = (p: V2, u: V2, poly: V2[]) => {
  let best = Infinity;
  for (let e = 0; e < poly.length; e++) {
    const a = poly[e];
    const b = poly[(e + 1) % poly.length];
    const ex = b[0] - a[0];
    const ey = b[1] - a[1];
    const den = u[0] * ey - u[1] * ex;
    if (Math.abs(den) < 1e-12) continue;
    const t = ((a[0] - p[0]) * ey - (a[1] - p[1]) * ex) / den;
    const s2 = ((a[0] - p[0]) * u[1] - (a[1] - p[1]) * u[0]) / den;
    if (t > 1e-9 && s2 >= -1e-9 && s2 <= 1 + 1e-9) best = Math.min(best, t);
  }
  return best;
};

/**
 * Each Voronoi cell becomes a star: 2N rays at even angles from the apex.
 * Even rays are ridges running down to the cell boundary (z = 0); odd rays
 * end at a notch point part-way out, low down. The notch is fanned out to
 * the boundary (including the cell corners), so every facet is a flat
 * triangle and the whole cell boundary lies on z = 0, where it meets the
 * neighbouring cell exactly.
 */
const buildTile = (): Tri[] => {
  const tris: Tri[] = [];
  const c = T / GRID;
  seeds.forEach((s, si) => {
    let poly: V2[] = [
      [s.p[0] - 3 * c, s.p[1] - 3 * c],
      [s.p[0] + 3 * c, s.p[1] - 3 * c],
      [s.p[0] + 3 * c, s.p[1] + 3 * c],
      [s.p[0] - 3 * c, s.p[1] + 3 * c],
    ];
    seeds.forEach((q, qi) => {
      for (let oy = -1; oy <= 1; oy++) {
        for (let ox = -1; ox <= 1; ox++) {
          if (qi === si && ox === 0 && oy === 0) continue;
          const qp: V2 = [q.p[0] + ox * T, q.p[1] + oy * T];
          const n: V2 = [qp[0] - s.p[0], qp[1] - s.p[1]];
          if (Math.hypot(n[0], n[1]) > 4 * c) continue;
          poly = clip(poly, [(s.p[0] + qp[0]) / 2, (s.p[1] + qp[1]) / 2], n);
        }
      }
    });
    const r = mulberry32(0xfa0 + si * 7919);
    const N = 16 + Math.floor(r() * 5); // ridges per star
    const th0 = r() * TAU;
    const H = s.h;
    const apex = new THREE.Vector3(s.p[0], s.p[1], H);
    const K = (i: number) => `c${si}:${i}`;
    const ang = (q: V2) => {
      let a = Math.atan2(q[1] - s.p[1], q[0] - s.p[0]) - th0;
      a = ((a % TAU) + TAU) % TAU;
      return a;
    };
    const corners = poly.map((q) => ({ q, a: ang(q) })).sort((x, y) => x.a - y.a);
    const rayPt = (k: number): V2 => {
      const a = th0 + (k * Math.PI) / N;
      const u: V2 = [Math.cos(a), Math.sin(a)];
      const d = rayToPoly(s.p, u, poly);
      return [s.p[0] + u[0] * d, s.p[1] + u[1] * d];
    };
    for (let k = 0; k < 2 * N; k += 2) {
      const P0 = rayPt(k);
      const P2 = rayPt((k + 2) % (2 * N));
      const aV = th0 + ((k + 1) * Math.PI) / N + (r() - 0.5) * 0.25;
      const uV: V2 = [Math.cos(aV), Math.sin(aV)];
      const dV = rayToPoly(s.p, uV, poly);
      const fv = 0.8 + 0.15 * r();
      const V = new THREE.Vector3(s.p[0] + uV[0] * dV * fv, s.p[1] + uV[1] * dV * fv, H * (1 - fv) * (0.45 + 0.3 * r()));
      const p0 = new THREE.Vector3(P0[0], P0[1], 0);
      const p2 = new THREE.Vector3(P2[0], P2[1], 0);
      tris.push({ p: [apex, p0, V], k: ["apex" + si, K(k), K(1000 + k)] });
      tris.push({ p: [apex, V, p2], k: ["apex" + si, K(1000 + k), K((k + 2) % (2 * N))] });
      // notch fan: V -> boundary path from P0 to P2 (with corners between)
      const a0 = (k * Math.PI) / N;
      const a2 = ((k + 2) * Math.PI) / N;
      const path: THREE.Vector3[] = [p0];
      const keys: string[] = [K(k)];
      corners.forEach((cn, ci) => {
        if (cn.a > a0 + 1e-9 && cn.a < a2 - 1e-9) {
          path.push(new THREE.Vector3(cn.q[0], cn.q[1], 0));
          keys.push(K(2000 + ci));
        }
      });
      path.push(p2);
      keys.push(K((k + 2) % (2 * N)));
      for (let j = 0; j + 1 < path.length; j++) {
        tris.push({ p: [V, path[j], path[j + 1]], k: [K(1000 + k), keys[j], keys[j + 1]] });
      }
    }
  });
  return tris;
};

const buildGeometry = () => {
  const tris = buildTile();
  // face normals
  const normals = tris.map((t) => {
    const e1 = t.p[1].clone().sub(t.p[0]);
    const e2 = t.p[2].clone().sub(t.p[0]);
    return e1.cross(e2).normalize();
  });
  tris.forEach((t, i) => {
    if (normals[i].z < 0) {
      t.p = [t.p[0], t.p[2], t.p[1]];
      t.k = [t.k[0], t.k[2], t.k[1]];
      normals[i].negate();
    }
  });
  // edge -> triangles (keys are tile-periodic, so wrap-around edges match)
  const edgeMap = new Map<string, number[]>();
  const ek = (a: string, b: string) => (a < b ? `${a}#${b}` : `${b}#${a}`);
  tris.forEach((t, i) => {
    for (let e = 0; e < 3; e++) {
      const key = ek(t.k[(e + 1) % 3], t.k[(e + 2) % 3]);
      if (!edgeMap.has(key)) edgeMap.set(key, []);
      edgeMap.get(key)!.push(i);
    }
  });
  const pos: number[] = [];
  const nor: number[] = [];
  const bary: number[] = [];
  const alt: number[] = [];
  const nb0: number[] = [];
  const nb1: number[] = [];
  const nb2: number[] = [];
  tris.forEach((t, i) => {
    const n = normals[i];
    const nbs = [0, 1, 2].map((e) => {
      const list = edgeMap.get(ek(t.k[(e + 1) % 3], t.k[(e + 2) % 3]))!;
      const other = list.find((j) => j !== i);
      return other === undefined ? n : normals[other];
    });
    // altitude from vertex e to the opposite edge
    const alts = [0, 1, 2].map((e) => {
      const a = t.p[(e + 1) % 3];
      const b = t.p[(e + 2) % 3];
      const ab = b.clone().sub(a);
      const ap = t.p[e].clone().sub(a);
      return ap.clone().cross(ab).length() / ab.length();
    });
    for (let v = 0; v < 3; v++) {
      pos.push(t.p[v].x, t.p[v].y, t.p[v].z);
      nor.push(n.x, n.y, n.z);
      bary.push(v === 0 ? 1 : 0, v === 1 ? 1 : 0, v === 2 ? 1 : 0);
      alt.push(alts[0], alts[1], alts[2]);
      nb0.push(nbs[0].x, nbs[0].y, nbs[0].z);
      nb1.push(nbs[1].x, nbs[1].y, nbs[1].z);
      nb2.push(nbs[2].x, nbs[2].y, nbs[2].z);
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute("bary", new THREE.Float32BufferAttribute(bary, 3));
  g.setAttribute("alt", new THREE.Float32BufferAttribute(alt, 3));
  g.setAttribute("nb0", new THREE.Float32BufferAttribute(nb0, 3));
  g.setAttribute("nb1", new THREE.Float32BufferAttribute(nb1, 3));
  g.setAttribute("nb2", new THREE.Float32BufferAttribute(nb2, 3));
  g.computeBoundingSphere();
  return g;
};

const CHAMFER = 0.03; // world-space chamfer width on every ridge/valley

const chamferMaterial = (params: FacetsParams) => {
  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(params.metal),
    metalness: 0.8,
    roughness: 0.25,
  });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.chamfer = { value: CHAMFER };
    sh.vertexShader = sh.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
attribute vec3 bary; attribute vec3 alt; attribute vec3 nb0; attribute vec3 nb1; attribute vec3 nb2;
varying vec3 vBary; varying vec3 vAlt; varying vec3 vNb0; varying vec3 vNb1; varying vec3 vNb2;`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
vBary = bary; vAlt = alt;
vNb0 = normalize(normalMatrix * nb0); vNb1 = normalize(normalMatrix * nb1); vNb2 = normalize(normalMatrix * nb2);`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float chamfer;
varying vec3 vBary; varying vec3 vAlt; varying vec3 vNb0; varying vec3 vNb1; varying vec3 vNb2;`,
      )
      .replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
{
  vec3 d = vBary * vAlt;           // world distance to each edge
  vec3 fw = fwidth(d) + 1e-6;
  // pick nearest edge
  float dm = d.x; vec3 nb = vNb0;
  if (d.y < dm) { dm = d.y; nb = vNb1; }
  if (d.z < dm) { dm = d.z; nb = vNb2; }
  float fwm = dm == d.x ? fw.x : (dm == d.y ? fw.y : fw.z);
  float w = 1.0 - smoothstep(chamfer - fwm, chamfer + fwm, dm);
  vec3 cn = normalize(normal + nb);
  normal = normalize(mix(normal, cn, w));
}`,
      );
  };
  return m;
};

export const makeFacets =
  (params: FacetsParams) =>
  (gl: THREE.WebGLRenderer): World => {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(params.background);
    scene.environment = makeStripEnv(
      gl,
      [
        // strips spread all around the view axis -> stars lit evenly
        { dir: [0.2, 0.9, 0.7], roll: 0.3, length: 70, width: 9, color: params.strip, intensity: 70 },
        { dir: [-0.85, -0.3, 0.7], roll: 1.2, length: 70, width: 7, color: params.strip, intensity: 50 },
        { dir: [0.75, -0.55, 0.7], roll: -0.6, length: 60, width: 10, color: params.strip, intensity: 22 },
        { dir: [-0.4, 0.5, 0.9], roll: 2.0, length: 50, width: 6, color: params.strip, intensity: 12 },
      ],
      { top: "#383c48", bottom: "#141620", intensity: 3.2 },
      0.02,
    );
    scene.environmentIntensity = 1.0;

    const geo = buildGeometry();
    const mat = chamferMaterial(params);
    const R = 3; // copies each side
    const count = (2 * R + 1) ** 2;
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    const m4 = new THREE.Matrix4();
    let n = 0;
    for (let j = -R; j <= R; j++) {
      for (let i = -R; i <= R; i++) {
        mesh.setMatrixAt(n++, m4.makeTranslation(i * T, j * T, 0));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    // 7x7 tile copies cover the view for the whole drift; a dark backing
    // plane hides any sub-pixel seam between copies
    const group = new THREE.Group();
    group.add(mesh);
    const backing = new THREE.Mesh(
      new THREE.PlaneGeometry(T * (2 * R + 1), T * (2 * R + 1)),
      new THREE.MeshBasicMaterial({ color: params.background }),
    );
    backing.position.z = -0.01;
    group.add(backing);
    scene.add(group);

    const key = new THREE.DirectionalLight(params.key, 1.2);
    key.position.set(-4, 6, 8);
    scene.add(key);
    scene.add(key.target);

    const camera = new THREE.PerspectiveCamera(28, 16 / 9, 0.5, 200);

    return {
      scene,
      overlay: null,
      camera,
      post: {
        dof: { focus: 10.5, farBlur: 1.6, nearBlur: 2.0, maxBlur: 4 },
        bloom: { strength: 0.18, threshold: 0.7, knee: 0.4, weights: [1, 0.8, 0.6, 0.4, 0.2, 0.1] },
        exposure: 1.0,
        aces: true,
        grain: 0.015,
        grainLumaFade: 0,
        msaa: 4,
      },
      update(t) {
        const f = t / LOOP;
        // light strips turn exactly 360 deg per loop
        scene.environmentRotation.set(0.25, -0.2, TAU * f, "ZXY");
        // drift exactly one tile period diagonally per loop
        const cx = 1.3 + T * f;
        const cy = 0.7 + T * f;
        const tilt = (15 * Math.PI) / 180;
        const dist = 10.5;
        const wob = 0.15 * Math.sin(TAU * f);
        camera.position.set(cx + dist * Math.sin(tilt) * 0.35 + wob, cy - dist * Math.sin(tilt), dist * Math.cos(tilt));
        camera.up.set(0, 1, 0);
        camera.lookAt(cx, cy, 0.4);
        camera.updateMatrixWorld();
        key.target.position.set(cx, cy, 0);
        key.position.set(cx - 4, cy + 6, 8);
      },
    };
  };

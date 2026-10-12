import React, { useMemo } from "react";
import * as THREE from "three";
import { ConvexGeometry } from "three/examples/jsm/geometries/ConvexGeometry.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32 } from "../lib/random";

// ---------- seeded 3D value noise ----------
function makeNoise(seed: number) {
  const rnd = mulberry32(seed);
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256).map(() => rnd() * 2 - 1);
  const f = (t: number) => t * t * (3 - 2 * t);
  const at = (x: number, y: number, z: number) => val[perm[perm[perm[x & 255] + (y & 255)] + (z & 255)]];
  const n3 = (x: number, y: number, z: number) => {
    const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    const xf = f(x - xi), yf = f(y - yi), zf = f(z - zi);
    const l = (a: number, b: number, t: number) => a + (b - a) * t;
    return l(
      l(l(at(xi, yi, zi), at(xi + 1, yi, zi), xf), l(at(xi, yi + 1, zi), at(xi + 1, yi + 1, zi), xf), yf),
      l(l(at(xi, yi, zi + 1), at(xi + 1, yi, zi + 1), xf), l(at(xi, yi + 1, zi + 1), at(xi + 1, yi + 1, zi + 1), xf), yf),
      zf,
    );
  };
  return (x: number, y: number, z: number, oct = 4) => {
    let s = 0, a = 0.5, fr = 1;
    for (let i = 0; i < oct; i++) {
      s += n3(x * fr, y * fr, z * fr) * a;
      a *= 0.5;
      fr *= 2.03;
    }
    return s;
  };
}

export type NuggetShape = {
  seed: number;
  detail: number; // three.js icosphere detail (subdivisions per edge - 1)
  cells: number; // Voronoi facet cells
  lumpiness: number;
  flatten: number; // 0..1 how hard each cell is pressed to a plane
  squash: [number, number, number];
  parts?: number; // sub-rocks in the cluster (default 5); more = pebble cluster
};

const geoCache = new Map<string, THREE.BufferGeometry>();

/**
 * Faceted ore lump. An icosphere is shrink-wrapped onto the intersection of
 * seeded half-spaces (big faces + smaller corner cuts), so every Voronoi-like
 * cell is a truly flat facet with straight edges. Low-frequency fractal noise
 * then dents the result so it reads as a lump, not a gem. Flat normals.
 */
export function nuggetGeometry(s: NuggetShape): THREE.BufferGeometry {
  const key = JSON.stringify(s);
  const hit = geoCache.get(key);
  if (hit) return hit;
  const rnd = mulberry32(s.seed * 7919 + 13);
  const noise = makeNoise(s.seed * 31 + 7);
  const randDir = () => {
    const u = rnd() * 2 - 1;
    const t = rnd() * Math.PI * 2;
    const q = Math.sqrt(1 - u * u);
    return new THREE.Vector3(q * Math.cos(t), u, q * Math.sin(t));
  };

  // A nugget is a cluster of overlapping convex rocks, each the hull of a
  // sphere shrink-wrapped onto seeded half-spaces. Facets are exactly flat
  // with straight creases; the overlaps give concave junctions like real ore.
  const planes: { n: THREE.Vector3; h: number }[] = [];
  const sq = new THREE.Vector3(...s.squash);
  const sphere = new THREE.IcosahedronGeometry(1, s.detail);
  const sp = sphere.getAttribute("position") as THREE.BufferAttribute;
  const dirs: THREE.Vector3[] = [];
  const seen = new Set<string>();
  const d = new THREE.Vector3();
  for (let i = 0; i < sp.count; i++) {
    d.fromBufferAttribute(sp, i).normalize();
    const k = `${d.x.toFixed(4)},${d.y.toFixed(4)},${d.z.toFixed(4)}`;
    if (!seen.has(k)) { seen.add(k); dirs.push(d.clone()); }
  }
  sphere.dispose();

  const parts: THREE.BufferGeometry[] = [];
  const partPlaneStart: number[] = [];
  const nParts = s.parts ?? (s.cells > 40 ? 5 : 1);
  const many = nParts > 6;
  for (let pi = 0; pi < nParts; pi++) {
    const off =
      pi === 0
        ? new THREE.Vector3()
        : randDir().multiply(many ? new THREE.Vector3(0.62, 0.22, 0.5) : new THREE.Vector3(0.38, 0.1, 0.3));
    const sc = pi === 0 ? (many ? 0.82 : 1) : many ? 0.34 + rnd() * 0.24 : 0.6 + rnd() * 0.25;
    const cells = pi === 0 ? s.cells : Math.round(s.cells * (many ? 0.35 : 0.6));
    const start = planes.length;
    partPlaneStart.push(start);
    for (let k = 0; k < cells; k++) {
      const n = randDir();
      const lump = s.lumpiness * noise(n.x * 1.7 + 5 + pi * 3, n.y * 1.7, n.z * 1.7, 3) * 2.6;
      const u = rnd();
      // a quarter are big faces, the rest small chamfers and corner cuts
      const h = (u < 0.15 ? 0.82 + rnd() * 0.08 : 0.9 + rnd() * 0.07) + lump;
      planes.push({ n, h });
    }
    planes.push({ n: new THREE.Vector3(0, -1, 0), h: (0.42 + off.y) / sc });
    const pts: THREE.Vector3[] = [];
    for (const dd of dirs) {
      let r = 1.3;
      for (let k = start; k < planes.length; k++) {
        const c = dd.dot(planes[k].n);
        if (c > 1e-3) r = Math.min(r, planes[k].h / c);
      }
      pts.push(dd.clone().multiplyScalar(r * sc).add(off).multiply(sq));
    }
    const hull = new ConvexGeometry(pts);
    hull.deleteAttribute("uv");
    hull.userData.planeRange = [start, planes.length];
    parts.push(hull);
  }

  // per-facet tone (some oxidised) and per-facet UV driving iridescence thickness
  const tone: THREE.Color[] = [];
  const cellU: number[] = [];
  for (let k = 0; k < planes.length; k++) {
    const ox = rnd() < 0.06;
    const b = ox ? 0.62 + rnd() * 0.1 : 0.93 + rnd() * 0.07;
    tone.push(ox ? new THREE.Color(b, b * 0.8, b * 0.68) : new THREE.Color(b, b, b));
    cellU.push(rnd());
  }
  const coloured = parts.map((part) => {
    const [p0, p1] = part.userData.planeRange as [number, number];
    const fp = part.getAttribute("position") as THREE.BufferAttribute;
    const colors = new Float32Array(fp.count * 3);
    const uvs = new Float32Array(fp.count * 2);
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c3 = new THREE.Vector3();
    const nrm = new THREE.Vector3();
    for (let t = 0; t < fp.count; t += 3) {
      a.fromBufferAttribute(fp, t);
      b.fromBufferAttribute(fp, t + 1);
      c3.fromBufferAttribute(fp, t + 2);
      nrm.crossVectors(b.sub(a), c3.sub(a)).multiply(sq).normalize();
      let best = p0, bd = -2;
      for (let k = p0; k < p1; k++) {
        const dd = nrm.dot(planes[k].n);
        if (dd > bd) { bd = dd; best = k; }
      }
      const c = tone[best];
      for (let j = 0; j < 3; j++) {
        colors.set([c.r, c.g, c.b], (t + j) * 3);
        uvs.set([cellU[best], 0.5], (t + j) * 2);
      }
    }
    part.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    part.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    return part;
  });
  const flat = mergeGeometries(coloured, false)!;
  flat.computeVertexNormals();
  flat.computeBoundingSphere();
  geoCache.set(key, flat);
  return flat;
}

// Thickness ramp sampled by the per-facet UV (G channel = thickness).
let rampTex: THREE.DataTexture | null = null;
function thicknessRamp() {
  if (rampTex) return rampTex;
  const w = 256;
  const d = new Uint8Array(w * 4);
  for (let i = 0; i < w; i++) {
    const t = i / (w - 1);
    d.set([255, Math.round(t * 255), Math.round((0.75 + 0.25 * Math.sin(t * 40)) * 255), 255], i * 4);
  }
  rampTex = new THREE.DataTexture(d, w, 1);
  rampTex.magFilter = THREE.NearestFilter;
  rampTex.minFilter = THREE.NearestFilter;
  rampTex.needsUpdate = true;
  return rampTex;
}

export type OreMaterialKind = "iridescent" | "silver";

const matCache = new Map<string, THREE.MeshPhysicalMaterial>();
export function oreMaterial(kind: OreMaterialKind, envIntensity = 1): THREE.MeshPhysicalMaterial {
  const key = `${kind}:${envIntensity}`;
  const hit = matCache.get(key);
  if (hit) return hit;
  const ramp = thicknessRamp();
  const m =
    kind === "iridescent"
      ? new THREE.MeshPhysicalMaterial({
          color: new THREE.Color("#f2e6ee"),
          metalness: 1,
          roughness: 0.26,
          roughnessMap: ramp, // G channel: per-facet roughness 0.2..0.35 (via scale below)
          iridescence: 0.8,
          iridescenceIOR: 1.3,
          iridescenceThicknessRange: [250, 600],
          iridescenceThicknessMap: ramp,
          vertexColors: true,
          envMapIntensity: envIntensity,
          flatShading: false,
        })
      : new THREE.MeshPhysicalMaterial({
          color: new THREE.Color("#e9ecf0"),
          metalness: 1,
          roughness: 0.3,
          iridescence: 0,
          // a little contrast in the silver: some facets slightly darker
          vertexColors: true,
          envMapIntensity: envIntensity,
        });
  // Procedural micro-crumple: a bump from 3D value noise of the object-space
  // position (fixed formula, so it is stable frame to frame), giving pitting
  // and grain inside each flat facet.
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vObjPos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjPos = transformed;");
    sh.fragmentShader = sh.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
varying vec3 vObjPos;
float h31(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vn(vec3 p){ vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z); }
vec3 crumple(vec3 surf_pos, vec3 surf_norm, float h, float faceDir){
  vec3 vSigmaX = normalize(dFdx(surf_pos)); vec3 vSigmaY = normalize(dFdy(surf_pos));
  vec3 vN = surf_norm; vec3 R1 = cross(vSigmaY, vN); vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec2 dH = vec2(dFdx(h), dFdy(h));
  vec3 vGrad = sign(fDet) * (dH.x * R1 + dH.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}`,
      )
      .replace(
        "#include <normal_fragment_maps>",
        `#include <normal_fragment_maps>
{
  vec3 q = vObjPos * ${kind === "iridescent" ? "9.0" : "14.0"};
  float hb = vn(q) * 0.55 + vn(q * 2.7 + 3.1) * 0.3 + vn(q * 6.1 + 7.7) * 0.15;
  normal = crumple(-vViewPosition, normal, hb * ${kind === "iridescent" ? "0.9" : "0.8"}, faceDirection);
}`,
      );
    if (kind === "iridescent") {
      // Thin-film thickness follows a smooth tarnish field across the whole
      // lump (as on real bismuth/ore), not a random value per facet, so the
      // colours flow over facet edges and flash with the viewing angle.
      const lpf = THREE.ShaderChunk.lights_physical_fragment.replace(
        "texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g",
        "clamp(vn(vObjPos * 2.6 + 11.0) * 0.8 + vn(vObjPos * 6.0 + 3.0) * 0.4 - 0.1, 0.0, 1.0)",
      );
      sh.fragmentShader = sh.fragmentShader.replace("#include <lights_physical_fragment>", lpf);
      sh.fragmentShader = sh.fragmentShader.replace(
        "#include <roughnessmap_fragment>",
        `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
  roughnessFactor = 0.2 + 0.15 * fract(texelRoughness.g * 7.13);
#endif`,
      );
    }
  };
  matCache.set(key, m);
  return m;
}

export type NuggetSpec = {
  seed: number;
  position: [number, number, number];
  scale: number;
  rotY: number;
  squash?: [number, number, number];
  parts?: number;
};

export const BIG_SHAPE = { detail: 40, cells: 320, lumpiness: 0.13, flatten: 1 };
export const CHIP_SHAPE = { detail: 12, cells: 26, lumpiness: 0.1, flatten: 1 };

export const Nugget: React.FC<{ spec: NuggetSpec; kind: OreMaterialKind; envIntensity?: number }> = ({
  spec,
  kind,
  envIntensity = 1,
}) => {
  const geo = useMemo(
    () => nuggetGeometry({ seed: spec.seed, ...BIG_SHAPE, squash: spec.squash ?? [1.15, 0.72, 1], parts: spec.parts }),
    [spec.seed, spec.squash, spec.parts],
  );
  const material = oreMaterial(kind, envIntensity);
  return (
    <mesh
      geometry={geo}
      material={material}
      position={spec.position}
      rotation={[0, spec.rotY, 0]}
      scale={spec.scale}
      castShadow
      receiveShadow
    />
  );
};

export type ChipScatter = {
  seed: number;
  count: number;
  center: [number, number];
  rMin: number;
  rMax: number;
  sizeMin: number; // world size (radius) range
  sizeMax: number;
  avoid: { x: number; z: number; r: number }[];
};

/** Small ore chips: 4 shape variants, instanced, seeded scatter. */
export const OreChips: React.FC<{ scatter: ChipScatter; kind: OreMaterialKind; envIntensity?: number }> = ({
  scatter,
  kind,
  envIntensity = 1,
}) => {
  const variants = useMemo(
    () =>
      [0, 1, 2, 3].map((i) =>
        nuggetGeometry({ seed: 900 + i * 17, ...CHIP_SHAPE, squash: [1.1, 0.7 + i * 0.06, 0.95] }),
      ),
    [],
  );
  const groups = useMemo(() => {
    const rnd = mulberry32(scatter.seed);
    const out: THREE.Matrix4[][] = [[], [], [], []];
    let tries = 0;
    let placed = 0;
    while (placed < scatter.count && tries < scatter.count * 50) {
      tries++;
      const a = rnd() * Math.PI * 2;
      const r = scatter.rMin + (scatter.rMax - scatter.rMin) * Math.sqrt(rnd());
      const x = scatter.center[0] + Math.cos(a) * r;
      const z = scatter.center[1] + Math.sin(a) * r;
      const size = scatter.sizeMin + (scatter.sizeMax - scatter.sizeMin) * Math.pow(rnd(), 1.6);
      const rot = rnd() * Math.PI * 2;
      const tilt = (rnd() - 0.5) * 0.4;
      const v = Math.floor(rnd() * 4);
      if (scatter.avoid.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + size)) continue;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(x, size * 0.3, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(tilt, rot, tilt * 0.5)),
        new THREE.Vector3(size, size, size),
      );
      out[v].push(m);
      placed++;
    }
    return out;
  }, [scatter]);
  const material = oreMaterial(kind, envIntensity);
  return (
    <>
      {groups.map((ms, i) => (
        <instancedMesh
          key={i}
          args={[variants[i], material, Math.max(1, ms.length)]}
          count={ms.length}
          castShadow
          receiveShadow
          ref={(im: THREE.InstancedMesh | null) => {
            if (!im) return;
            ms.forEach((m, j) => im.setMatrixAt(j, m));
            im.instanceMatrix.needsUpdate = true;
            im.computeBoundingSphere();
          }}
        />
      ))}
    </>
  );
};

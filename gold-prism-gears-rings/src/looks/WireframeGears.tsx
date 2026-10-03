import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { LookCanvas } from "../lib/LookCanvas";
import { ASPECT, TAU, loopPhase } from "../lib/constants";
import { PostConfig } from "../lib/post";
import { mulberry32, range } from "../lib/random";
import { GearsRow } from "../versions";

/**
 * Look 3 — Wireframe Gears.
 *
 * A tree of 14 spur gears with one common module, so neighbours mesh. Tooth
 * counts are 12 and 18; the driver's teeth advance P = 36 tooth pitches per
 * loop, so a gear with T teeth turns exactly P/T = 3 or 2 whole turns in 600
 * frames (correct ratios, opposite directions for neighbours).
 */

const MODULE = 0.15;
const PITCHES_PER_LOOP = 36; // every tooth count divides this
const TEETH_CHOICES = [12, 18, 12, 12, 18, 12];

type Gear = {
  teeth: number;
  R: number; // pitch radius
  Ra: number; // tip radius
  x: number;
  y: number;
  z: number;
  parent: number;
  /** rotation = dir * turns * τ * t + phase0 */
  dir: 1 | -1;
  phase0: number;
};

const rngLayout = mulberry32(0x9ea7);

const buildChain = (): Gear[] => {
  const mk = (teeth: number) => ({ teeth, R: (MODULE * teeth) / 2, Ra: (MODULE * teeth) / 2 + MODULE });
  const gears: Gear[] = [];
  const g0 = mk(18);
  gears.push({ ...g0, x: -12.2, y: -0.2, z: 0, parent: -1, dir: 1, phase0: 0.3 });
  let ti = 0;
  while (gears.length < 14) {
    const t = TEETH_CHOICES[ti++ % TEETH_CHOICES.length];
    const g = mk(t);
    let placed = false;
    // try to grow from the right-most gears, preferring a wavy band
    const parents = gears
      .map((_, i) => i)
      .sort((a, b) => gears[b].x - gears[a].x)
      .slice(0, 3);
    const wantY = 1.2 * Math.sin(gears.length * 1.9) + range(rngLayout, -0.4, 0.4);
    for (const pi of parents) {
      const p = gears[pi];
      const cands: number[] = [];
      for (let a = -75; a <= 75; a += 7.5) cands.push((a * Math.PI) / 180);
      const d = p.R + g.R;
      cands.sort((a, b) => {
        const ya = p.y + d * Math.sin(a);
        const yb = p.y + d * Math.sin(b);
        return Math.abs(ya - wantY) - 0.4 * Math.cos(a) - (Math.abs(yb - wantY) - 0.4 * Math.cos(b));
      });
      for (const a of cands) {
        const x = p.x + d * Math.cos(a);
        const y = p.y + d * Math.sin(a);
        if (Math.abs(y) > 2.0) continue;
        const ok = gears.every((o, oi) => oi === pi || Math.hypot(o.x - x, o.y - y) > o.Ra + g.Ra + 0.12);
        if (!ok) continue;
        // mesh phase: a tooth of the parent at angle a faces a gap of the child
        const ratio = p.teeth / g.teeth;
        const phase0 = -ratio * (p.phase0 - a) + a + Math.PI + Math.PI / g.teeth;
        gears.push({ ...g, x, y, z: range(rngLayout, -0.05, 0.05), parent: pi, dir: (p.dir * -1) as 1 | -1, phase0 });
        placed = true;
        break;
      }
      if (placed) break;
    }
    if (!placed) throw new Error("gear layout failed");
  }
  // centre the band horizontally
  const minX = Math.min(...gears.map((g) => g.x - g.Ra));
  const maxX = Math.max(...gears.map((g) => g.x + g.Ra));
  const cx = (minX + maxX) / 2;
  for (const g of gears) g.x -= cx;
  return gears;
};

const GEARS = buildChain();

/** Rotation angle of gear i at loop phase t (radians). */
const gearAngle = (g: Gear, t: number) => g.phase0 + g.dir * (PITCHES_PER_LOOP / g.teeth) * TAU * t;
// Note: for a child, angle_c = -ratio * (angle_p - a) + a + π + π/T_c, with
// d(angle_c)/dt = -ratio * d(angle_p)/dt — exactly what dir and P/T give.

// ------------------------------------------------------------ geometry --

type GearMesh = { fill: THREE.BufferGeometry; lines: THREE.BufferGeometry; outline: THREE.Vector2[] };

const gearMesh = (teeth: number, seed: number): GearMesh => {
  const rng = mulberry32(seed);
  const R = (MODULE * teeth) / 2;
  const Ra = R + 0.72 * MODULE;
  const Rr = R - 1.05 * MODULE;
  const Rh = Rr * 0.55;
  const P = TAU / teeth;
  const baseHalf = 0.29 * P;
  const tipHalf = 0.17 * P;

  // tooth outline (also used for glints)
  const outline: THREE.Vector2[] = [];
  const rootRing: { v: THREE.Vector2; a: number; tooth: number }[] = [];
  const pol = (r: number, a: number) => new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r);
  const toothPolys: THREE.Vector2[][] = [];
  for (let k = 0; k < teeth; k++) {
    const c = k * P;
    rootRing.push({ v: pol(Rr, c - 0.5 * P), a: c - 0.5 * P, tooth: -1 });
    rootRing.push({ v: pol(Rr, c - baseHalf), a: c - baseHalf, tooth: k });
    rootRing.push({ v: pol(Rr, c + baseHalf), a: c + baseHalf, tooth: k });
    const poly = [
      pol(Rr, c - baseHalf),
      pol(R + 0.45 * MODULE, c - tipHalf - 0.03 * P),
      pol(Ra, c - tipHalf * 0.7),
      pol(Ra, c + tipHalf * 0.7),
      pol(R + 0.45 * MODULE, c + tipHalf + 0.03 * P),
      pol(Rr, c + baseHalf),
    ];
    toothPolys.push(poly);
    outline.push(pol(Rr, c - 0.5 * P), ...poly);
  }

  const verts: THREE.Vector2[] = [];
  const glowOf: number[] = [];
  const tris: number[] = [];
  const add = (v: THREE.Vector2, glow: number) => {
    verts.push(v);
    glowOf.push(glow);
    return verts.length - 1;
  };

  // rings: root polygon, a jittered middle ring, the hole
  const rootIdx = rootRing.map((r) => add(r.v, 0.75));
  const nMid = Math.round(teeth * 0.6);
  const mid = Array.from({ length: nMid }, (_, i) => {
    const a = ((i + 0.5 + range(rng, -0.3, 0.3)) / nMid) * TAU - 0.5 * P;
    const r = THREE.MathUtils.lerp(Rh, Rr, range(rng, 0.38, 0.62));
    return { a, i: add(pol(r, a), 0.25) };
  });
  const nHole = teeth;
  const hole = Array.from({ length: nHole }, (_, i) => {
    const a = (i / nHole) * TAU + range(rng, -0.12, 0.12) * P - 0.5 * P;
    return { a, i: add(pol(Rh, a), 0.6) };
  });

  const zip = (A: { a: number; i: number }[], B: { a: number; i: number }[]) => {
    // triangulate the band between two closed rings sorted by angle
    let ia = 0;
    let ib = 0;
    const na = A.length;
    const nb = B.length;
    const ang = (r: { a: number }[], k: number, n: number) => r[k % n].a + Math.floor(k / n) * TAU;
    // align B start to A start
    let best = 0;
    let bestD = 1e9;
    for (let k = 0; k < nb; k++) {
      const d = Math.abs(Math.atan2(Math.sin(B[k].a - A[0].a), Math.cos(B[k].a - A[0].a)));
      if (d < bestD) {
        bestD = d;
        best = k;
      }
    }
    const Bs = B.map((_, k) => B[(k + best) % nb]).map((b) => ({ ...b, a: b.a + (b.a < A[0].a - Math.PI ? TAU : b.a > A[0].a + Math.PI ? -TAU : 0) }));
    // make Bs monotonic
    for (let k = 1; k < nb; k++) while (Bs[k].a < Bs[k - 1].a) Bs[k].a += TAU;
    while (ia < na || ib < nb) {
      const aNext = ang(A, ia + 1, na);
      const bNext = ang(Bs, ib + 1, nb);
      const a0 = A[ia % na].i;
      const b0 = Bs[ib % nb].i;
      if ((aNext <= bNext && ia < na) || ib >= nb) {
        tris.push(a0, A[(ia + 1) % na].i, b0);
        ia++;
      } else {
        tris.push(a0, Bs[(ib + 1) % nb].i, b0);
        ib++;
      }
    }
  };
  const rootSorted = rootRing.map((r, k) => ({ a: r.a, i: rootIdx[k] }));
  zip(rootSorted, mid);
  zip(mid, hole);

  // teeth: fan from the base
  for (const poly of toothPolys) {
    const ids = poly.map((v, k) => (k === 0 || k === poly.length - 1 ? -1 : add(v, 1)));
    // base vertices are the root ring vertices already added: find them
    const findRoot = (v: THREE.Vector2) => rootIdx[rootRing.findIndex((r) => r.v.distanceTo(v) < 1e-6)];
    ids[0] = findRoot(poly[0]);
    ids[poly.length - 1] = findRoot(poly[poly.length - 1]);
    for (let k = 1; k < poly.length - 1; k++) tris.push(ids[0], ids[k], ids[k + 1]);
  }

  // fill geometry
  const fpos: number[] = [];
  const fglow: number[] = [];
  for (let k = 0; k < verts.length; k++) {
    fpos.push(verts[k].x, verts[k].y, 0);
    fglow.push(glowOf[k]);
  }
  const fill = new THREE.BufferGeometry();
  fill.setAttribute("position", new THREE.Float32BufferAttribute(fpos, 3));
  fill.setAttribute("glow", new THREE.Float32BufferAttribute(fglow, 1));
  fill.setIndex(tris);

  // unique edges -> ribbons; boundary edges (used by one triangle) are bright
  const edgeCount = new Map<string, number>();
  for (let k = 0; k < tris.length; k += 3)
    for (const [a, b] of [
      [tris[k], tris[k + 1]],
      [tris[k + 1], tris[k + 2]],
      [tris[k + 2], tris[k]],
    ]) {
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  const lpos: number[] = [];
  const lprof: number[] = [];
  const lidx: number[] = [];
  const quad = (p: THREE.Vector2[], prof: number[][]) => {
    const base = lpos.length / 3;
    p.forEach((v, k) => {
      lpos.push(v.x, v.y, 0.004);
      lprof.push(...prof[k]);
    });
    lidx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  edgeCount.forEach((count, key) => {
    const [a, b] = key.split("_").map(Number);
    const va = verts[a];
    const vb = verts[b];
    const boundary = count === 1;
    const w = boundary ? 0.045 : 0.02;
    const inten = boundary ? 1.0 : 0.12;
    const d = vb.clone().sub(va).normalize();
    const n = new THREE.Vector2(-d.y, d.x).multiplyScalar(w / 2);
    const e = d.clone().multiplyScalar(w * 0.3);
    quad(
      [va.clone().sub(e).sub(n), va.clone().sub(e).add(n), vb.clone().add(e).add(n), vb.clone().add(e).sub(n)],
      [
        [0, -1, inten],
        [0, 1, inten],
        [0, 1, inten],
        [0, -1, inten],
      ],
    );
  });
  // vertex dots
  verts.forEach((v, k) => {
    const s = (glowOf[k] > 0.7 ? 0.06 : 0.045) * range(rng, 0.8, 1.25);
    const bright = (glowOf[k] > 0.7 ? 0.5 : 0.25) + 1.1 * rng() * rng() * rng();
    quad(
      [v.clone().add(new THREE.Vector2(-s, -s)), v.clone().add(new THREE.Vector2(-s, s)), v.clone().add(new THREE.Vector2(s, s)), v.clone().add(new THREE.Vector2(s, -s))],
      [
        [-1, -1, -bright],
        [-1, 1, -bright],
        [1, 1, -bright],
        [1, -1, -bright],
      ],
    );
  });
  const lines = new THREE.BufferGeometry();
  lines.setAttribute("position", new THREE.Float32BufferAttribute(lpos, 3));
  lines.setAttribute("prof", new THREE.Float32BufferAttribute(lprof, 3));
  lines.setIndex(lidx);
  return { fill, lines, outline };
};

// ------------------------------------------------------------ shaders --

const FILL_VERT = /* glsl */ `
attribute float glow;
varying float vGlow;
void main() { vGlow = glow; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FILL_FRAG = /* glsl */ `
uniform vec3 color;
varying float vGlow;
void main() {
  float g = 0.08 + 0.16 * vGlow * vGlow;
  gl_FragColor = vec4(color * g, 1.0);
}`;
const LINE_VERT = /* glsl */ `
attribute vec3 prof;
varying vec3 vProf;
void main() { vProf = prof; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const LINE_FRAG = /* glsl */ `
uniform vec3 color;
varying vec3 vProf;
void main() {
  float a;
  float k = vProf.z;
  if (k < 0.0) {           // dot
    float r2 = dot(vProf.xy, vProf.xy);
    a = exp(-r2 * 5.0) * -k;
    a += exp(-r2 * 40.0) * -k * 1.5;
  } else {                 // edge ribbon
    a = exp(-vProf.y * vProf.y * 3.0) * k;
  }
  gl_FragColor = vec4(color * a * 0.5, 1.0);
}`;
const SPRITE_VERT = /* glsl */ `
attribute float bright;
varying vec2 vUv;
varying float vB;
void main() {
  vUv = uv * 2.0 - 1.0; vB = bright;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const GLINT_FRAG = /* glsl */ `
uniform vec3 color;
varying vec2 vUv;
varying float vB;
void main() {
  float r2 = dot(vUv, vUv);
  float core = exp(-r2 * 30.0) * 6.0 + exp(-r2 * 6.0) * 1.2;
  float star = exp(-abs(vUv.x) * 40.0) * exp(-vUv.y * vUv.y * 2.5) + exp(-abs(vUv.y) * 40.0) * exp(-vUv.x * vUv.x * 2.5);
  gl_FragColor = vec4((color * 0.7 + 0.3) * (core + star * 1.6) * vB, 1.0);
}`;
const SPECK_FRAG = /* glsl */ `
uniform vec3 color;
varying vec2 vUv;
varying float vB;
void main() {
  float r2 = dot(vUv, vUv);
  gl_FragColor = vec4(color * exp(-r2 * 6.0) * vB, 1.0);
}`;
const BG_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BG_FRAG = /* glsl */ `
uniform vec3 top, bottom;
varying vec2 vUv;
void main() {
  vec3 c = mix(bottom, top, smoothstep(0.0, 1.0, vUv.y));
  float g = exp(-pow(length((vUv - vec2(0.5, 0.5)) * vec2(1.6, 2.4)), 2.0) * 1.5);
  c *= 0.9 + 0.45 * g;
  gl_FragColor = vec4(c, 1.0);
}`;

// ------------------------------------------------------------ dynamics --

const rngFx = mulberry32(0x61_17);
const GLINTS = Array.from({ length: 12 }, (_, i) => ({
  gear: (i * 5 + 3) % GEARS.length,
  u0: rngFx(),
  speed: [1, -1, 2, 1, -2, 1][i % 6], // whole laps of the outline per loop
  size: range(rngFx, 0.12, 0.2),
}));
const SPECKS = Array.from({ length: 900 }, () => ({
  x: range(rngFx, -20, 20),
  y: range(rngFx, -10, 10),
  z: range(rngFx, -2.5, -0.4),
  s: range(rngFx, 0.01, 0.024),
  b: range(rngFx, 1.0, 3.2),
  tw: Math.floor(range(rngFx, 1, 5)),
  ph: rngFx(),
}));

const CAM_DIST = 9.6;

const POST: PostConfig = {
  exposure: 1.05,
  bloom: { strength: 0.3, threshold: 0.6, knee: 0.6, spread: 0.85 },
  dof: { focus: CAM_DIST, farBlur: 8, nearBlur: 1.0, maxCoc: 18 },
  vignette: 0.35,
  grain: 0.02,
  msaa: 4,
};

const outlinePoint = (o: THREE.Vector2[], u: number) => {
  const n = o.length;
  const f = (((u % 1) + 1) % 1) * n;
  const i = Math.floor(f);
  return o[i].clone().lerp(o[(i + 1) % n], f - i);
};

const Scene: React.FC<{ row: GearsRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const objs = useMemo(() => {
    const root = new THREE.Group();
    const edge = new THREE.Color(row.edge);
    const fillMat = new THREE.ShaderMaterial({
      vertexShader: FILL_VERT,
      fragmentShader: FILL_FRAG,
      uniforms: { color: { value: edge } },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: true,
      side: THREE.DoubleSide,
    });
    const lineMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      uniforms: { color: { value: edge } },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const backLineMat = lineMat.clone();
    backLineMat.uniforms = { color: { value: edge.clone().multiplyScalar(0.35) } };
    const meshCache = new Map<string, GearMesh>();
    const gearGroups = GEARS.map((g, i) => {
      const key = `${g.teeth}_${i % 3}`;
      if (!meshCache.has(key)) meshCache.set(key, gearMesh(g.teeth, 1000 + g.teeth * 7 + (i % 3)));
      const gm = meshCache.get(key)!;
      const grp = new THREE.Group();
      grp.position.set(g.x, g.y, g.z);
      const f = new THREE.Mesh(gm.fill, fillMat);
      f.renderOrder = 1;
      const l = new THREE.Mesh(gm.lines, lineMat);
      l.renderOrder = 2;
      // back face a little behind: gives the glass body visible thickness
      const fb = new THREE.Mesh(gm.fill, fillMat);
      fb.position.z = -0.14;
      fb.renderOrder = 1;
      const lb = new THREE.Mesh(gm.lines, backLineMat);
      lb.position.z = -0.14;
      lb.renderOrder = 2;
      grp.add(fb, lb, f, l);
      root.add(grp);
      return { grp, outline: gm.outline };
    });

    const spriteGeo = new THREE.PlaneGeometry(1, 1);
    const glintMat = new THREE.ShaderMaterial({
      vertexShader: SPRITE_VERT,
      fragmentShader: GLINT_FRAG,
      uniforms: { color: { value: edge } },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const glints = new THREE.InstancedMesh(spriteGeo, glintMat, GLINTS.length);
    glints.geometry = spriteGeo.clone();
    glints.geometry.setAttribute("bright", new THREE.InstancedBufferAttribute(new Float32Array(GLINTS.length).fill(1), 1));
    glints.frustumCulled = false;
    glints.renderOrder = 3;
    root.add(glints);

    const speckGeo = spriteGeo.clone();
    speckGeo.setAttribute("bright", new THREE.InstancedBufferAttribute(new Float32Array(SPECKS.length), 1));
    const specks = new THREE.InstancedMesh(
      speckGeo,
      new THREE.ShaderMaterial({
        vertexShader: SPRITE_VERT,
        fragmentShader: SPECK_FRAG,
        uniforms: { color: { value: edge.clone().lerp(new THREE.Color(1, 1, 1), 0.3) } },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
      SPECKS.length,
    );
    specks.frustumCulled = false;
    const m = new THREE.Matrix4();
    SPECKS.forEach((s, i) => specks.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, s.y, s.z), new THREE.Quaternion(), new THREE.Vector3(s.s * 2.2, s.s * 2.2, 1))));
    root.add(specks);

    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 52),
      new THREE.ShaderMaterial({
        vertexShader: BG_VERT,
        fragmentShader: BG_FRAG,
        uniforms: { top: { value: new THREE.Color(row.bgTop) }, bottom: { value: new THREE.Color(row.bgBottom) } },
      }),
    );
    bg.position.z = -24;
    bg.renderOrder = 0;
    root.add(bg);
    return { root, gearGroups, glints, specks };
  }, [row]);

  useLayoutEffect(() => {
    const t = loopPhase(frame);
    GEARS.forEach((g, i) => {
      objs.gearGroups[i].grp.rotation.z = gearAngle(g, t);
      objs.gearGroups[i].grp.updateMatrixWorld();
    });
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const bright = objs.glints.geometry.getAttribute("bright") as THREE.InstancedBufferAttribute;
    GLINTS.forEach((gl, i) => {
      const gg = objs.gearGroups[gl.gear];
      const u = gl.u0 + gl.speed * t;
      const lp = outlinePoint(gg.outline, u);
      const wp = new THREE.Vector3(lp.x, lp.y, 0.02).applyMatrix4(gg.grp.matrixWorld);
      // fade in and out a few times per loop so glints feel like passing light
      const fr = (((u * 2) % 1) + 1) % 1;
      const fade = Math.pow(Math.sin(Math.PI * fr), 2);
      bright.setX(i, 0.25 + 0.75 * fade);
      objs.glints.setMatrixAt(i, m.compose(wp, q, new THREE.Vector3(gl.size, gl.size, 1)));
    });
    bright.needsUpdate = true;
    objs.glints.instanceMatrix.needsUpdate = true;
    const sb = objs.specks.geometry.getAttribute("bright") as THREE.InstancedBufferAttribute;
    SPECKS.forEach((s, i) => sb.setX(i, s.b * (0.55 + 0.45 * Math.sin(TAU * (s.tw * t + s.ph)))));
    sb.needsUpdate = true;
  }, [frame, objs]);

  return <primitive object={objs.root} />;
};

export const WireframeGears: React.FC<{ row: GearsRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const camera = useMemo(() => new THREE.PerspectiveCamera(36, ASPECT, 1, 120), []);
  useLayoutEffect(() => {
    const t = loopPhase(frame);
    // slow sideways drift on a closed path (one cycle per loop)
    const cx = 2.2 * Math.sin(TAU * t);
    const cy = 0.35 * Math.sin(2 * TAU * t);
    camera.position.set(cx + 3.6, cy - 1.0, CAM_DIST * 0.95);
    camera.lookAt(cx * 0.9, cy, 0);
    camera.updateMatrixWorld();
  }, [frame, camera]);
  return (
    <LookCanvas post={POST} camera={camera}>
      <Scene row={row} />
    </LookCanvas>
  );
};

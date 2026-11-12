import { Camera } from "../engine/camera";
import { DofRenderer, H4K, W4K, applyGrain, applyVignette, makeGlowSprite, makeGrain } from "../engine/dof";
import {
  V3,
  add,
  catmull,
  clamp,
  cross,
  easeInOut,
  len,
  lerp,
  mix3,
  mixRgb,
  mulberry32,
  norm,
  randUnit,
  rgba,
  scale,
  smoothstep,
  sub,
  wobble,
} from "../engine/math";
import { Palette } from "./palettes";

export const FPS = 30;
export const DURATION_FRAMES = 799; // 26.633 s — identical to the reference clip
const LOOP_T = DURATION_FRAMES / FPS;

/* ------------------------------------------------------------------ camera */

// Path the camera looks at (the "action"), keyed in seconds.
const TARGET_KEYS: { t: number; p: V3 }[] = [
  { t: -4, p: [-0.6, -0.4, 0.4] },
  { t: 0, p: [-0.3, -0.2, 0.2] },
  { t: 4.0, p: [0, 0, 0] },
  { t: 7.0, p: [1.6, 0.9, -0.8] },
  { t: 9.6, p: [0.2, 1.9, -2.0] },
  { t: 12.2, p: [-1.8, 0.8, -1.2] },
  { t: 14.8, p: [-1.4, -1.0, 0.6] },
  { t: 17.4, p: [0.6, -1.6, 1.3] },
  { t: 20.0, p: [1.9, -0.2, 0.4] },
  { t: 22.6, p: [0.7, 1.0, 1.4] },
  { t: 25.6, p: [0.1, 0.2, 0.3] },
  { t: 30, p: [0, 0, 0] },
];

const targetAt = (t: number): V3 => {
  let i = 0;
  while (i < TARGET_KEYS.length - 2 && t > TARGET_KEYS[i + 1].t) i++;
  const a = TARGET_KEYS[i];
  const b = TARGET_KEYS[i + 1];
  const f = clamp((t - a.t) / (b.t - a.t));
  return catmull(
    TARGET_KEYS.map((k) => k.p),
    i + f,
  );
};

export type CamState = { pos: V3; target: V3; roll: number; fov: number; focus: number };

export const cameraAt = (t: number): CamState => {
  const target = targetAt(t);
  const yaw = 2.35 + 0.215 * t + 0.18 * Math.sin(t * 0.31);
  const pitch = 0.18 + 0.32 * Math.sin(t * 0.23 + 0.6) + 0.1 * Math.sin(t * 0.71);
  const R = 5.0 + 1.25 * Math.sin(t * 0.37 + 1.1) - 0.4 * smoothstep(21, 25.6, t);
  const dir: V3 = [Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw)];
  const pos = add(target, scale(dir, R));
  const roll = 0.12 * Math.sin(t * 0.19 + 0.4);
  return { pos, target, roll, fov: 52, focus: R };
};

const makeCamera = (c: CamState) => new Camera(W4K, H4K, c.pos, c.target, c.fov, c.roll);

/* ------------------------------------------------------------------ world */

type StrandPoint = { s: number; off: V3; ph: number; out: boolean };
type Strand = {
  ctrl: V3[];
  phases: number[];
  L: number;
  cum: number[]; // arc length table over u samples
  t0: number;
  t1: number; // time head reaches the end
  ease: "inout" | "linear" | "out";
  pts: StrandPoint[];
  links: number[]; // pairs of indices into pts
  radius: number;
  seed: number;
  converge: number; // weight for the final converge
  convergeTo: V3;
  hasHeadOrb: boolean;
  wanderAmp: number;
};

type Collision = { t: number; p: V3; strands: [number, number]; big?: boolean };

export type World = {
  strands: Strand[];
  collisions: Collision[];
  dust: { p: V3; ph: number; r: number; v: V3 }[];
  sparkDirs: V3[][];
  finalPoint: V3;
};

const U_SAMPLES = 160;

const buildStrand = (
  rnd: () => number,
  start: V3,
  end: V3,
  t0: number,
  t1: number,
  opts: Partial<Pick<Strand, "ease" | "radius" | "hasHeadOrb" | "wanderAmp">> & { lateral?: number; nCtrl?: number },
): Strand => {
  const n = opts.nCtrl ?? 8;
  const lateral = opts.lateral ?? 1.5;
  const dir = norm(sub(end, start));
  let a = norm(cross(dir, [0, 1, 0]));
  if (len(a) < 0.1) a = [1, 0, 0];
  const b = norm(cross(dir, a));
  const ctrl: V3[] = [];
  const pa = rnd() * 6.28;
  const pb = rnd() * 6.28;
  const fa = 0.8 + rnd() * 1.0;
  const fb = 0.7 + rnd() * 1.1;
  for (let j = 0; j < n; j++) {
    const f = j / (n - 1);
    const env = Math.sin(Math.PI * f) * lateral;
    const base = mix3(start, end, f);
    const la = Math.sin(f * Math.PI * fa + pa) * env + (rnd() - 0.5) * 0.5 * env;
    const lb = Math.sin(f * Math.PI * fb + pb) * env + (rnd() - 0.5) * 0.5 * env;
    ctrl.push(add(base, add(scale(a, la), scale(b, lb))));
  }
  // arc-length table
  const cum: number[] = [0];
  let prev = catmull(ctrl, 0);
  for (let i = 1; i <= U_SAMPLES; i++) {
    const p = catmull(ctrl, (i / U_SAMPLES) * (n - 1));
    cum.push(cum[i - 1] + len(sub(p, prev)));
    prev = p;
  }
  const L = cum[U_SAMPLES];
  const radius = opts.radius ?? 0.3 + rnd() * 0.1;
  // plexus tube points
  const pts: StrandPoint[] = [];
  const rs = rnd() * 10;
  for (let s = 0.02; s < L; s += 0.085 + rnd() * 0.05) {
    const k = 4;
    const rMod = 0.62 + 0.42 * Math.sin(s * 1.15 + rs) + 0.18 * Math.sin(s * 3.1 + rs * 2);
    const endTaper = 0.35 + 0.65 * smoothstep(0, 0.9, s) * smoothstep(0, 0.6, L - s);
    for (let i = 0; i < k; i++) {
      const out = rnd() < 0.07;
      const r = radius * rMod * endTaper * (0.6 + rnd() * 0.55) * (out ? 2.0 : 1);
      pts.push({ s: s + (rnd() - 0.5) * 0.05, off: scale(randUnit(rnd), r), ph: rnd() * 6.28, out });
    }
  }
  pts.sort((x, y) => x.s - y.s);
  const links: number[] = [];
  for (let i = 0; i < pts.length; i++) {
    const cand: { j: number; d: number }[] = [];
    for (let j = i + 1; j < Math.min(pts.length, i + 14); j++) {
      const d = len(add([pts[j].s - pts[i].s, 0, 0], sub(pts[j].off, pts[i].off)));
      if (d < 0.5) cand.push({ j, d });
    }
    cand.sort((x, y) => x.d - y.d);
    const maxL = pts[i].out ? 2 : 3;
    for (let c = 0; c < Math.min(maxL, cand.length); c++) links.push(i, cand[c].j);
  }
  return {
    ctrl,
    phases: ctrl.map(() => rnd() * 100),
    L,
    cum,
    t0,
    t1,
    ease: opts.ease ?? "out",
    pts,
    links,
    radius,
    seed: rnd() * 1000,
    converge: 0,
    convergeTo: [0, 0, 0],
    hasHeadOrb: opts.hasHeadOrb ?? true,
    wanderAmp: opts.wanderAmp ?? 0.28,
  };
};

export const buildWorld = (seed = 7): World => {
  const rnd = mulberry32(seed);
  const strands: Strand[] = [];
  const collisions: Collision[] = [];

  // --- Hero pair: strand entering bottom-left at t=0 + a partner that whips past the lens at ~2 s
  const c0 = cameraAt(0);
  const cam0 = makeCamera(c0);
  void cam0;
  const fwd0 = norm(sub(c0.target, c0.pos));
  const right0 = norm(cross(fwd0, [0, 1, 0]));
  const up0 = cross(right0, fwd0);
  const E0 = TARGET_KEYS[2].p;
  const heroStart = add(E0, add(add(scale(right0, -6.8), scale(up0, -2.4)), scale(fwd0, 1.2)));
  strands.push(buildStrand(rnd, heroStart, E0, -4.6, 4.0, { ease: "linear", lateral: 0.9 }));

  const c2 = cameraAt(2.0);
  const fwd2 = norm(sub(c2.target, c2.pos));
  const right2 = norm(cross(fwd2, [0, 1, 0]));
  const up2 = cross(right2, fwd2);
  const partnerStart = add(c2.pos, add(add(scale(fwd2, -2.0), scale(right2, -0.28)), scale(up2, -0.14)));
  strands.push(buildStrand(rnd, partnerStart, E0, 1.0, 4.0, { ease: "linear", lateral: 0.5, nCtrl: 6 }));
  collisions.push({ t: 4.0, p: E0, strands: [0, 1] });

  // --- Further collisions following the camera target path
  for (let k = 3; k < TARGET_KEYS.length - 2; k++) {
    const { t, p } = TARGET_KEYS[k];
    const d = randUnit(rnd);
    const dist = 4.2 + rnd() * 2.2;
    const s1 = add(p, scale(d, dist));
    const s2 = add(p, scale(norm(add(scale(d, -1), scale(randUnit(rnd), 0.7))), dist * (0.8 + rnd() * 0.4)));
    const dur = 3.6 + rnd() * 1.8;
    const i = strands.length;
    strands.push(buildStrand(rnd, s1, p, t - dur, t, { ease: "out" }));
    strands.push(buildStrand(rnd, s2, p, t - dur * (0.85 + rnd() * 0.3), t, { ease: "out" }));
    collisions.push({ t, p, strands: [i, i + 1] });
  }

  // --- Wandering solo strands whose heads drift through the cluster
  const soloT = [3.0, 10.5, 16.0];
  for (const t0 of soloT) {
    const a = randUnit(rnd);
    const s = scale(a, 7 + rnd() * 2);
    const e = scale(randUnit(rnd), 2 + rnd() * 1.5);
    strands.push(buildStrand(rnd, s, e, t0, t0 + 9 + rnd() * 5, { ease: "linear", lateral: 2.0 }));
  }

  // --- Final convergence: every head / junction is drawn toward one point for the big collision
  const finalPoint = TARGET_KEYS[TARGET_KEYS.length - 2].p;
  for (const st of strands) {
    st.converge = 0.15;
    st.convergeTo = add(finalPoint, scale(randUnit(rnd), 1.8 + rnd() * 1.4));
  }
  collisions.push({ t: 25.6, p: finalPoint, strands: [0, 0], big: true });

  const dust: World["dust"] = [];
  for (let i = 0; i < 1100; i++) {
    const p = scale(randUnit(rnd), 1.5 + Math.pow(rnd(), 0.6) * 10);
    dust.push({ p, ph: rnd() * 6.28, r: 0.4 + rnd() * 1.2, v: scale(randUnit(rnd), 0.03 + rnd() * 0.05) });
  }
  const sparkDirs = collisions.map(() => Array.from({ length: 70 }, () => randUnit(rnd)));
  return { strands, collisions, dust, sparkDirs, finalPoint };
};

/* ------------------------------------------------------------------ evaluation */

const CONV_A = 22.4;
const CONV_B = 25.6;

const headS = (st: Strand, t: number) => {
  const f = clamp((t - st.t0) / (st.t1 - st.t0));
  const e = st.ease === "linear" ? f : st.ease === "inout" ? easeInOut(f) : 1 - Math.pow(1 - f, 1.7);
  return e * st.L;
};

const uForS = (st: Strand, s: number) => {
  const cum = st.cum;
  if (s <= 0) return 0;
  if (s >= st.L) return st.ctrl.length - 1;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (cum[m] < s) lo = m;
    else hi = m;
  }
  const f = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
  return ((lo + f) / U_SAMPLES) * (st.ctrl.length - 1);
};

/** Control points with slow writhing + the final converge applied. */
const liveCtrl = (st: Strand, t: number): V3[] => {
  const n = st.ctrl.length;
  const conv = smoothstep(CONV_A, CONV_B, t) * st.converge;
  return st.ctrl.map((c, j) => {
    const f = j / (n - 1);
    // the collision end stays pinned so heads meet exactly
    const amp = st.wanderAmp * Math.sin(Math.PI * Math.min(1, f * 1.2));
    const ph = st.phases[j];
    let p: V3 = [
      c[0] + amp * wobble(t * 0.45, ph),
      c[1] + amp * wobble(t * 0.4, ph + 3.1),
      c[2] + amp * wobble(t * 0.5, ph + 7.7),
    ];
    if (conv > 0) {
      const w = Math.pow(f, 1.6) * conv;
      p = mix3(p, add(st.convergeTo, scale(sub(c, st.ctrl[n - 1]), 0.25)), w);
    }
    return p;
  });
};

type Orb = { p: V3; I: number; size: number; seed: number };

/* ------------------------------------------------------------------ rendering */

export type SceneAssets = {
  world: World;
  halo: HTMLCanvasElement;
  glow: HTMLCanvasElement;
  core: HTMLCanvasElement;
  grain: HTMLCanvasElement;
  dof: DofRenderer;
  styles: { lines: number[][]; dots: number[]; bokeh: number; spark: number[]; dustWarm: number };
  palette: Palette;
};

export const WARM_LEVELS = 4;
export const ALPHA_LEVELS = 4;

export const createAssets = (palette: Palette, q: number): SceneAssets => {
  const world = buildWorld(7);
  const P = palette;
  const halo = makeGlowSprite([
    [0, rgba(P.halo, 0.9)],
    [0.12, rgba(P.halo, 0.55)],
    [0.35, rgba(P.haloOuter, 0.2)],
    [0.7, rgba(P.haloOuter, 0.05)],
    [1, rgba(P.haloOuter, 0)],
  ]);
  const glow = makeGlowSprite([
    [0, rgba(P.core, 1)],
    [0.25, rgba(mixRgb(P.core, P.halo, 0.4), 0.7)],
    [0.6, rgba(P.halo, 0.18)],
    [1, rgba(P.halo, 0)],
  ]);
  const core = makeGlowSprite([
    [0, "rgba(255,255,255,1)"],
    [0.45, rgba(P.core, 0.95)],
    [0.75, rgba(P.core, 0.3)],
    [1, rgba(P.core, 0)],
  ]);
  const grain = makeGrain(mulberry32(99));
  const dof = new DofRenderer(q);
  const lines: number[][] = [];
  for (let w = 0; w < WARM_LEVELS; w++) {
    const row: number[] = [];
    const col = mixRgb(P.strand, P.strandWarm, w / (WARM_LEVELS - 1));
    for (let a = 0; a < ALPHA_LEVELS; a++) {
      const alpha = (0.15 + 0.22 * a) * (1 + 0.2 * w);
      row.push(dof.style(rgba(col, Math.min(1, alpha)), 2.6));
    }
    lines.push(row);
  }
  const dots: number[] = [];
  for (let w = 0; w < WARM_LEVELS; w++) {
    const col = mixRgb(P.strand, P.strandWarm, w / (WARM_LEVELS - 1));
    dots.push(dof.style(rgba(mixRgb(col, [255, 255, 255], 0.35), 0.9), 1));
  }
  const bokeh = dof.style(rgba(P.dust, 0.05), 1);
  const spark = [0.25, 0.5, 0.85].map((a) => dof.style(rgba(mixRgb(P.core, P.halo, 0.35), a), 3.2));
  const dustWarm = dof.style(rgba(mixRgb(P.dust, P.halo, 0.6), 0.6), 1);
  return { world, halo, glow, core, grain, dof, styles: { lines, dots, bokeh, spark, dustWarm }, palette };
};

const APERTURE = 50; // 4K px of blur for an object at infinity
const MAX_BLUR = 230;

/** Render the scene at time t (seconds) onto ctx (pixel size W4K*q). */
export const renderScene = (ctx: CanvasRenderingContext2D, A: SceneAssets, t: number, frame: number) => {
  const { world, dof, palette: P } = A;
  const q = dof.q;
  const cs = cameraAt(t);
  const cam = makeCamera(cs);
  const focus = cs.focus * (1 + 0.04 * Math.sin(t * 0.9));
  const blurAt = (z: number) => Math.min(MAX_BLUR, APERTURE * Math.abs(1 - focus / z) + 1.2);

  /* -------- background */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const pw = dof.pw;
  const ph = dof.ph;
  const bx = pw * (0.55 + 0.06 * Math.sin(t * 0.21));
  const by = ph * (0.45 + 0.05 * Math.cos(t * 0.17));
  const g = ctx.createRadialGradient(bx, by, 0, bx, by, pw * 0.75);
  g.addColorStop(0, P.bgCenter);
  g.addColorStop(0.45, P.bgMid);
  g.addColorStop(1, P.bgEdge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, pw, ph);
  const g2 = ctx.createRadialGradient(pw * 0.8, ph * 0.85, 0, pw * 0.8, ph * 0.85, pw * 0.55);
  g2.addColorStop(0, P.bgAccent);
  g2.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, pw, ph);

  /* -------- orbs (heads, junctions, final) */
  const orbs: Orb[] = [];
  const strandCtrl = world.strands.map((st) => liveCtrl(st, t));
  world.strands.forEach((st, si) => {
    const hs = headS(st, t);
    if (hs <= 0.001 || !st.hasHeadOrb) return;
    const col = world.collisions.find((c) => !c.big && (c.strands[0] === si || c.strands[1] === si));
    // after the collision only the first strand of a pair keeps the (merged) orb
    if (col && t > col.t && col.strands[1] === si) return;
    const p = catmull(strandCtrl[si], uForS(st, hs));
    const born = smoothstep(st.t0, st.t0 + 0.6, t);
    let I = 0.85 * born;
    if (col && t > col.t) I = 0.75 + 0.2 * Math.sin(t * 2.3 + st.seed);
    orbs.push({ p, I, size: 1, seed: st.seed });
  });
  // collision flashes
  for (const c of world.collisions) {
    const dt = t - c.t;
    if (dt < -0.25 || dt > 2.5) continue;
    const env = dt < 0 ? smoothstep(-0.25, 0, dt) : Math.exp(-dt * (c.big ? 1.6 : 3.2));
    const p = c.big ? add(world.finalPoint, [0, 0, 0]) : c.p;
    orbs.push({ p, I: env * (c.big ? 1.15 : 2.2), size: c.big ? 1.3 : 1.4, seed: 3 });
  }

  /* -------- strands */
  const orbW = orbs.map((o) => o.I * Math.min(1.6, o.size));
  const S = A.styles;
  dof.binGain = (lvl) => Math.pow(1 + lvl / 22, -0.75);
  for (let si = 0; si < world.strands.length; si++) {
    const st = world.strands[si];
    const hs = headS(st, t);
    if (hs <= 0.001) continue;
    const ctrl = strandCtrl[si];
    const n = st.pts.length;
    const sx = new Float32Array(n);
    const sy = new Float32Array(n);
    const sb = new Float32Array(n);
    const sa = new Float32Array(n);
    const sw = new Float32Array(n);
    const vis = new Uint8Array(n);
    let lastS = -1;
    let base: V3 = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const pt = st.pts[i];
      if (pt.s > hs) break;
      if (Math.abs(pt.s - lastS) > 0.012) {
        base = catmull(ctrl, uForS(st, pt.s));
        lastS = pt.s;
      }
      const toHead = hs - pt.s;
      const taper = st.t1 > t ? 0.18 + 0.82 * smoothstep(0, 1.1, toHead) : 1;
      const jig = 0.035;
      const o = pt.off;
      const wp: V3 = [
        base[0] + o[0] * taper + jig * Math.sin(t * 1.3 + pt.ph),
        base[1] + o[1] * taper + jig * Math.sin(t * 1.1 + pt.ph * 1.7),
        base[2] + o[2] * taper + jig * Math.sin(t * 0.9 + pt.ph * 2.3),
      ];
      const pr = cam.project(wp);
      if (!pr) continue;
      if (pr.x < -900 || pr.x > W4K + 900 || pr.y < -900 || pr.y > H4K + 900) continue;
      vis[i] = 1;
      sx[i] = pr.x;
      sy[i] = pr.y;
      sb[i] = blurAt(pr.z);
      // fade-in near the growing head, fade very near camera
      sa[i] = smoothstep(0, 0.35, toHead + 0.05) * smoothstep(0.12, 0.7, pr.z);
      let w = 0;
      for (let k = 0; k < orbs.length; k++) {
        const d = sub(wp, orbs[k].p);
        const d2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
        w += orbW[k] * Math.exp(-d2 / (2 * 0.55 * 0.55 * orbs[k].size));
      }
      sw[i] = w;
    }
    const L = st.links;
    for (let k = 0; k < L.length; k += 2) {
      const i = L[k];
      const j = L[k + 1];
      if (!vis[i] || !vis[j]) continue;
      const a = Math.min(sa[i], sa[j]);
      if (a <= 0.02) continue;
      const dx = sx[i] - sx[j];
      const dy = sy[i] - sy[j];
      if (dx * dx + dy * dy > 1400 * 1400) continue;
      const blur = (sb[i] + sb[j]) * 0.5;
      const w = Math.min(WARM_LEVELS - 1, Math.floor(((sw[i] + sw[j]) * 0.5) * 2.2));
      const al = Math.min(ALPHA_LEVELS - 1, Math.floor(a * ALPHA_LEVELS * 0.999 + (st.pts[i].out ? -1 : 0)));
      if (al < 0) continue;
      dof.line(sx[i], sy[i], sx[j], sy[j], blur, S.lines[w][al]);
    }
    for (let i = 0; i < n; i++) {
      if (!vis[i] || sa[i] < 0.3) continue;
      const w = Math.min(WARM_LEVELS - 1, Math.floor(sw[i] * 2.2));
      dof.dot(sx[i], sy[i], 3.2 + (i % 3), sb[i], S.dots[w]);
    }
  }

  /* -------- dust & bokeh */
  for (const d of world.dust) {
    const p: V3 = [
      d.p[0] + d.v[0] * t * 10 + 0.15 * Math.sin(t * 0.3 + d.ph),
      d.p[1] + d.v[1] * t * 10,
      d.p[2] + d.v[2] * t * 10 + 0.15 * Math.cos(t * 0.27 + d.ph),
    ];
    const pr = cam.project(p);
    if (!pr || pr.x < -200 || pr.x > W4K + 200 || pr.y < -200 || pr.y > H4K + 200) continue;
    const blur = blurAt(pr.z);
    const tw = 0.6 + 0.4 * Math.sin(t * 3 + d.ph * 5);
    if (blur > 30 && pr.z < 3) {
      // near out-of-focus specks become soft bokeh discs
      const r = Math.min(160, blur * 0.9);
      dof.disc(pr.x, pr.y, r, 6, S.bokeh);
    } else {
      let warm = false;
      for (const o of orbs) {
        const dd = sub(p, o.p);
        if (dd[0] * dd[0] + dd[1] * dd[1] + dd[2] * dd[2] < 1.2 * o.size) warm = true;
      }
      dof.dot(pr.x, pr.y, d.r * 2.2 * tw, blur, warm ? S.dustWarm : S.dots[0]);
    }
  }

  /* -------- sparks from collisions */
  world.collisions.forEach((c, ci) => {
    const dt = t - c.t;
    if (dt < 0 || dt > 1.6) return;
    const dirs = world.sparkDirs[ci];
    const life = 1 - dt / 1.6;
    for (let k = 0; k < dirs.length; k++) {
      const sp = (c.big ? 4.5 : 2.6) * (0.5 + ((k * 37) % 11) / 11);
      const drag = 2.6;
      const dist = (sp * (1 - Math.exp(-drag * dt))) / drag;
      const dist0 = (sp * (1 - Math.exp(-drag * Math.max(0, dt - 0.07)))) / drag;
      const p1 = add(c.p, scale(dirs[k], dist));
      const p0 = add(c.p, scale(dirs[k], dist0));
      const a = cam.project(p1);
      const b = cam.project(p0);
      if (!a || !b) continue;
      const lvl = life > 0.66 ? 2 : life > 0.33 ? 1 : 0;
      dof.line(b.x, b.y, a.x, a.y, blurAt(a.z), S.spark[lvl]);
    }
  });

  dof.composite(ctx);

  /* -------- orb glows (additive, drawn in pixel space) */
  ctx.save();
  ctx.setTransform(q, 0, 0, q, 0, 0);
  ctx.globalCompositeOperation = "lighter";
  let warmSum = 0;
  for (const o of orbs) {
    if (o.I <= 0.01) continue;
    const pr = cam.project(o.p);
    if (!pr) continue;
    const blur = blurAt(pr.z);
    const f = pr.f;
    const flick = 0.88 + 0.12 * Math.sin(t * 17 + o.seed) * Math.sin(t * 7.3 + o.seed * 3);
    const I = o.I * flick;
    const haloR = clamp(1.25 * f * o.size, 380, 2600);
    const coreR = clamp(0.075 * f * o.size, 26, 130);
    const coreEff = Math.sqrt(coreR * coreR + blur * blur * 0.8);
    const sharp = clamp((coreR * coreR) / (coreEff * coreEff), 0.08, 1);
    if (pr.x < -haloR * 2 || pr.x > W4K + haloR * 2 || pr.y < -haloR * 2 || pr.y > H4K + haloR * 2) continue;
    // scene wash
    warmSum += I * clamp(f / 900, 0.15, 3);
    ctx.globalAlpha = clamp(0.62 * I, 0, 1);
    ctx.drawImage(A.halo, pr.x - haloR, pr.y - haloR, haloR * 2, haloR * 2);
    const gr = coreEff * 5;
    ctx.globalAlpha = clamp(0.75 * I * Math.max(0.12, Math.sqrt(sharp)), 0, 1);
    ctx.drawImage(A.glow, pr.x - gr, pr.y - gr, gr * 2, gr * 2);
    ctx.globalAlpha = clamp(I * sharp * 1.2, 0, 1);
    ctx.drawImage(A.core, pr.x - coreEff * 1.6, pr.y - coreEff * 1.6, coreEff * 3.2, coreEff * 3.2);
    // fine star rays
    if (sharp > 0.25) {
      ctx.globalAlpha = clamp(0.35 * I * sharp, 0, 1);
      ctx.strokeStyle = rgba(mixRgb(P.core, P.halo, 0.3), 0.9);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      for (let r = 0; r < 3; r++) {
        const ang = o.seed + r * 2.1 + t * 0.35;
        const Lr = haloR * (0.22 + 0.12 * Math.sin(t * 2 + r + o.seed));
        ctx.moveTo(pr.x - Math.cos(ang) * Lr * 0.3, pr.y - Math.sin(ang) * Lr * 0.3);
        ctx.lineTo(pr.x + Math.cos(ang) * Lr, pr.y + Math.sin(ang) * Lr);
      }
      ctx.stroke();
    }
  }
  ctx.restore();

  /* -------- global warm wash, bloom, grade */
  const finale = smoothstep(22.8, 25.4, t) * (1 - smoothstep(25.7, 26.6, t));
  const wash = clamp(warmSum * 0.018, 0, 0.55) + 0.55 * finale;
  if (wash > 0.003) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = rgba(P.wash, Math.min(0.32, wash * 0.45));
    ctx.fillRect(0, 0, pw, ph);
    if (finale > 0) {
      // soft warm glow drifting across the frame during the climax
      const fx = pw * (0.35 + 0.2 * Math.sin(t * 0.7));
      const fy = ph * (0.45 + 0.1 * Math.cos(t * 0.5));
      const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, pw * 0.7);
      fg.addColorStop(0, rgba(P.halo, 0.35 * finale));
      fg.addColorStop(0.5, rgba(P.haloOuter, 0.14 * finale));
      fg.addColorStop(1, rgba(P.haloOuter, 0));
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, pw, ph);
    }
    ctx.restore();
  }
  dof.bloom(ctx, ctx.canvas, 0.45, 6);
  applyVignette(ctx, 0.62);
  applyGrain(ctx, A.grain, q, frame, 0.085);
  void LOOP_T;
  void lerp;
};

export const LOOP_SECONDS = LOOP_T;

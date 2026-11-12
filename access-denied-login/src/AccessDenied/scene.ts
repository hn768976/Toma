import { Camera } from "../engine/camera";
import { DofRenderer, H4K, W4K, applyGrain, applyVignette, makeGrain } from "../engine/dof";
import { V3, clamp, easeInOut, lerp, mixRgb, mulberry32, randUnit, rgba, smoothstep } from "../engine/math";

export const FPS = 30;
export const DURATION_FRAMES = 622; // 20.733 s — identical to the reference clip

export type Variant = "v1" | "v2";
type RGB = [number, number, number];

/* =====================================================================
 * Layout (panel lives in the world XY plane, z = 0, facing +z).
 * Panel spans u ∈ [-5, 5], v ∈ [-1.2, 1.2] (world units).
 * ===================================================================== */
const PW = 4.3;
const PH = 1.3;

const BLUE: RGB = [182, 192, 255];
const BLUE_HI: RGB = [228, 233, 255];
const RED: RGB = [240, 40, 36];
const RED_DIM: RGB = [150, 18, 26];
const NET: RGB = [235, 26, 36];

/* --------------------------------------------------------------- helpers */
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};
/** deterministic on/off flicker */
const flick = (t: number, seed: number, rate: number, on: number) => hash(Math.floor(t * rate) * 7.13 + seed * 3.7) < on;
const glyphs = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789#$%&@";
const scramble = (t: number, seed: number) => glyphs[Math.floor(hash(Math.floor(t * 24) + seed * 13.1) * glyphs.length)];

/* --------------------------------------------------------------- timeline (seconds) */
const T = {
  cursorIn: 0.35,
  boxOpenA: 0.72,
  boxOpenB: 1.05,
  loginA: 0.95,
  loginB: 1.55,
  fpIn: 2.35,
  ringA: 2.75,
  ringB: 3.3,
  loginOut: 2.95,
  fpMoveA: 3.3,
  fpMoveB: 3.65,
  passA: 3.9,
  passStep: 0.3,
  passCount: 8,
  scanPulse: 6.45,
  clearA: 6.95,
  blueOutA: 7.3,
  blueOutB: 7.75,
  redA: 7.75,
  redB: 8.35,
  netA: 7.85,
  netB: 8.9,
};

/* --------------------------------------------------------------- camera */
type Cam = { pos: V3; target: V3; roll: number; fov: number; focus: V3 };

const orbit = (target: V3, yawDeg: number, pitchDeg: number, dist: number): V3 => {
  const y = (yawDeg * Math.PI) / 180;
  const p = (pitchDeg * Math.PI) / 180;
  return [target[0] + Math.sin(y) * Math.cos(p) * dist, target[1] + Math.sin(p) * dist, target[2] + Math.cos(y) * Math.cos(p) * dist];
};

/** active element, used by the V2 rack focus */
const activeU = (t: number) => {
  if (t < T.fpIn) return 0.3;
  if (t < T.fpMoveA) return 0.45;
  if (t < T.fpMoveB) return lerp(0.45, -3.55, easeInOut((t - T.fpMoveA) / (T.fpMoveB - T.fpMoveA)));
  if (t < T.passA) return -3.55;
  const k = clamp((t - T.passA) / T.passStep, 0, T.passCount - 1);
  if (t < T.scanPulse) return -2.05 + k * 0.66;
  if (t < T.redA) return lerp(-2.05 + 7 * 0.66, -3.55, smoothstep(T.scanPulse, T.scanPulse + 0.3, t));
  // read "ACCESS" then "DENIED"
  return lerp(-2.2, 2.2, smoothstep(10.5, 13.5, t)) + 0.3 * Math.sin(t * 0.3);
};

export const cameraAt = (t: number, variant: Variant): Cam => {
  if (variant === "v1") {
    // Reference: left side of the panel near the lens, strong dutch roll, slow push-in, gentle drift.
    const push = easeInOut(t / 6.5);
    const drift = smoothstep(7.5, 20.7, t);
    const target: V3 = [lerp(0.7, -0.15, push) + 0.3 * drift, lerp(0.75, 0.45, push) - 0.1 * drift, 0];
    const yaw = lerp(30, 27, push) - 2 * drift;
    const pitch = lerp(7, 6, push) + 1.5 * drift;
    const dist = lerp(12.6, 9.3, push) + 0.4 * drift + 0.1 * Math.sin(t * 0.6);
    return { pos: orbit(target, -yaw, pitch, dist), target, roll: -0.33 + 0.012 * Math.sin(t * 0.4), fov: 38, focus: [0.6, 0, 0] };
  }
  // V2: mirrored low-angle view (right side nearest), continuous arcing dolly + rack focus on the active element.
  const a = t / (DURATION_FRAMES / FPS);
  const fu = activeSmooth(t);
  const target: V3 = [0.55 * fu - 0.05, lerp(-0.1, 0.05, a), 0];
  const yaw = lerp(50, 21, easeInOut(a));
  const pitch = lerp(-16, -8, a);
  const dist = lerp(10.4, 8.3, easeInOut(a)) + 0.2 * Math.sin(t * 0.5);
  return { pos: orbit(target, yaw, pitch, dist), target, roll: 0.12 + 0.02 * Math.sin(t * 0.35), fov: 40, focus: [fu, 0, 0] };
};

/** activeU low-passed (box filter over the previous ~0.9 s) so the camera and focus glide */
const activeSmooth = (t: number) => {
  let s = 0;
  const N = 18;
  for (let k = 0; k < N; k++) s += activeU(t - k * 0.05);
  return s / N;
};

/* --------------------------------------------------------------- static world */
type Bar = { u: number; v: number; w: number; h: number; kind: "pill" | "bar" | "tick"; seed: number };
type NetNode = { p: V3; ph: number; spark: boolean };

export type World = {
  bars: Bar[];
  dust: { p: V3; ph: number; r: number }[];
  nodes: NetNode[];
  links: { a: number; b: number; t0: number }[];
  fpRidges: { rx: number; ry: number; a0: number; a1: number; cx: number; cy: number }[];
};

export const buildWorld = (): World => {
  const rnd = mulberry32(2024);
  const bars: Bar[] = [];
  // row under the panel: rounded blobs (left) → barcode bars (right)
  let u = -4.9;
  while (u < 4.7) {
    const pill = u < 0.2;
    const w = pill ? 0.12 + rnd() * 0.42 : 0.05 + rnd() * 0.08;
    bars.push({ u: u + w / 2, v: -1.72, w, h: pill ? 0.2 : 0.18 + rnd() * 0.16, kind: pill ? "pill" : "bar", seed: rnd() * 100 });
    u += w + (pill ? 0.06 + rnd() * 0.35 : 0.05 + rnd() * 0.16) + (rnd() < 0.1 ? 0.5 : 0);
  }
  // second faint row
  u = -4.7;
  while (u < 4.5) {
    const w = 0.08 + rnd() * 0.3;
    bars.push({ u: u + w / 2, v: -2.2, w, h: 0.12, kind: "pill", seed: rnd() * 100 });
    u += w + 0.1 + rnd() * 0.6;
  }
  // top barcode / data ticks
  u = -1.2;
  while (u < 3.5) {
    const w = 0.04 + rnd() * 0.07;
    bars.push({ u, v: 2.05 + rnd() * 0.05, w, h: 0.25 + rnd() * 0.2, kind: "tick", seed: rnd() * 100 });
    u += w + 0.06 + rnd() * 0.18 + (rnd() < 0.15 ? 0.4 : 0);
  }
  u = -3.5;
  while (u < 0.5) {
    const w = 0.05 + rnd() * 0.12;
    bars.push({ u, v: 2.65, w, h: 0.12, kind: "tick", seed: rnd() * 100 });
    u += w + 0.12 + rnd() * 0.35;
  }
  const dust = Array.from({ length: 700 }, () => ({
    p: [(rnd() - 0.5) * 22, (rnd() - 0.5) * 12, (rnd() - 0.6) * 12] as V3,
    ph: rnd() * 6.28,
    r: 0.6 + rnd() * 1.4,
  }));
  // red security network
  const nodes: NetNode[] = [];
  for (let i = 0; i < 340; i++) {
    const p: V3 = [(rnd() - 0.5) * 20, (rnd() - 0.5) * 12, -3 + rnd() * 5.5];
    nodes.push({ p, ph: rnd() * 6.28, spark: rnd() < 0.12 });
  }
  const links: World["links"] = [];
  for (let i = 0; i < nodes.length; i++) {
    const cand: { j: number; d: number }[] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (j === i) continue;
      const dx = nodes[i].p[0] - nodes[j].p[0];
      const dy = nodes[i].p[1] - nodes[j].p[1];
      const dz = nodes[i].p[2] - nodes[j].p[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < 3.4) cand.push({ j, d });
    }
    cand.sort((a, b) => a.d - b.d);
    for (let c = 0; c < Math.min(3, cand.length); c++) {
      if (cand[c].j > i || rnd() < 0.3) links.push({ a: i, b: cand[c].j, t0: T.netA + rnd() * (T.netB - T.netA - 0.4) });
    }
  }
  // fingerprint ridges (local units, fingerprint ~ 1 x 1.35)
  const fpRidges: World["fpRidges"] = [];
  for (let k = 1; k <= 12; k++) {
    const segs = 1 + Math.floor(rnd() * 3);
    let a = -Math.PI * 0.05 + rnd() * 0.4;
    const span = Math.PI * (k < 3 ? 2 : 1.75 + rnd() * 0.25);
    for (let sgi = 0; sgi < segs; sgi++) {
      const len = (span / segs) * (0.75 + rnd() * 0.2);
      fpRidges.push({ rx: 0.04 * k, ry: 0.055 * k, a0: a - Math.PI, a1: a - Math.PI + len, cx: (rnd() - 0.5) * 0.02, cy: 0.012 * k });
      a += span / segs;
    }
  }
  return { bars, dust, nodes, links, fpRidges };
};

/* --------------------------------------------------------------- assets */
export type Assets = { world: World; dof: DofRenderer; grain: HTMLCanvasElement; dustStyle: number; netStyles: number[]; nodeStyle: number };

export const createAssets = (q: number): Assets => {
  const dof = new DofRenderer(q);
  const netStyles = [0.22, 0.5, 0.85].map((a) => dof.style(rgba(NET, a), 3));
  return {
    world: buildWorld(),
    dof,
    grain: makeGrain(mulberry32(5)),
    dustStyle: dof.style("rgba(225,230,255,0.75)", 1),
    netStyles,
    nodeStyle: dof.style(rgba([255, 70, 70], 0.9), 1),
  };
};

/* --------------------------------------------------------------- render */
const LK = 100; // local units per world unit for plane-space drawing

export const renderScene = (ctx: CanvasRenderingContext2D, A: Assets, t: number, frame: number, variant: Variant) => {
  const { dof, world } = A;
  const q = dof.q;
  const cs = cameraAt(t, variant);
  const cam = new Camera(W4K, H4K, cs.pos, cs.target, cs.fov, cs.roll);
  const focusZ = cam.depth(cs.focus);
  const APER = variant === "v1" ? 58 : 66;
  const blurAt = (z: number) => Math.min(200, APER * Math.abs(1 - focusZ / z) * (focusZ / 6) + 0.8);

  const red = smoothstep(T.redA, T.redB, t);
  const blueVis = 1 - smoothstep(T.blueOutA, T.blueOutB, t);

  /** draw something in plane space at (u,v,w) with a perspective-correct local affine frame */
  const onPlane = (u: number, v: number, w: number, extraBlur: number, fn: (c: CanvasRenderingContext2D) => void) => {
    const e = 0.02;
    const p0 = cam.project([u, v, w]);
    const pu = cam.project([u + e, v, w]);
    const pv = cam.project([u, v + e, w]);
    if (!p0 || !pu || !pv) return;
    if (p0.x < -1500 || p0.x > W4K + 1500 || p0.y < -1500 || p0.y > H4K + 1500) return;
    const a = (pu.x - p0.x) / e / LK;
    const b = (pu.y - p0.y) / e / LK;
    const c = -(pv.x - p0.x) / e / LK;
    const d = -(pv.y - p0.y) / e / LK;
    dof.custom(blurAt(p0.z) + extraBlur, (cx) => {
      cx.transform(a, b, c, d, p0.x, p0.y);
      fn(cx);
    });
  };
  /** emissive element + soft halo copy */
  const glowOnPlane = (u: number, v: number, w: number, glowAmt: number, fn: (c: CanvasRenderingContext2D, glow: boolean) => void) => {
    onPlane(u, v, w, 0, (c) => fn(c, false));
    if (glowAmt > 0) onPlane(u, v, w, 16, (c) => fn(c, true));
  };

  /* ---------- background */
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  const pw = dof.pw;
  const ph = dof.ph;
  const fadeIn = smoothstep(0.0, 0.6, t);
  const bgC = mixRgb([12, 12, 34], [34, 4, 10], red);
  const bgE = mixRgb([1, 1, 5], [5, 0, 2], red);
  const g = ctx.createRadialGradient(pw * 0.45, ph * 0.45, 0, pw * 0.45, ph * 0.45, pw * 0.7);
  g.addColorStop(0, rgba(mixRgb([0, 0, 0], bgC, fadeIn), 1));
  g.addColorStop(1, rgba(bgE, 1));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, pw, ph);

  /* ---------- dark panel body (occludes what lies behind it) */
  const boxOpen = easeInOut(clamp((t - T.boxOpenA) / (T.boxOpenB - T.boxOpenA)));
  const halfW = PW * Math.max(0.002, boxOpen);
  {
    const corners: V3[] = [
      [-halfW, PH, 0],
      [halfW, PH, 0],
      [halfW, -PH, 0],
      [-halfW, -PH, 0],
    ];
    const pr = corners.map((c) => cam.project(c));
    if (pr.every(Boolean) && boxOpen > 0) {
      ctx.save();
      ctx.setTransform(q, 0, 0, q, 0, 0);
      ctx.beginPath();
      pr.forEach((p, i) => (i ? ctx.lineTo(p!.x, p!.y) : ctx.moveTo(p!.x, p!.y)));
      ctx.closePath();
      ctx.fillStyle = rgba(mixRgb([3, 3, 12], [6, 1, 3], red), 0.55 + 0.35 * red);
      ctx.filter = `blur(${(18 * q).toFixed(1)}px)`;
      ctx.fill();
      ctx.restore();
    }
  }

  /* ---------- dust */
  for (const d of world.dust) {
    const p: V3 = [d.p[0] + 0.12 * Math.sin(t * 0.2 + d.ph) + t * 0.05, d.p[1] + 0.1 * Math.cos(t * 0.17 + d.ph), d.p[2]];
    const pr = cam.project(p);
    if (!pr || pr.x < -100 || pr.x > W4K + 100 || pr.y < -100 || pr.y > H4K + 100) continue;
    if (t < 0.25 + hash(d.ph) * 1.2) continue;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.7 + d.ph * 4));
    dof.dot(pr.x, pr.y, d.r * 2.6 * tw, blurAt(pr.z), A.dustStyle);
  }

  /* ---------- cursor */
  if (t > T.cursorIn && t < T.boxOpenB && flick(t, 1, 8, 0.8)) {
    const a = smoothstep(T.cursorIn, T.cursorIn + 0.15, t);
    glowOnPlane(0, 0, 0, 1, (c) => {
      c.fillStyle = rgba(BLUE_HI, 0.9 * a);
      c.fillRect(-3, -PH * LK * 0.9, 6, PH * LK * 1.8);
    });
  }

  /* ---------- panel border (segmented so every piece gets its own depth blur) */
  if (boxOpen > 0) {
    const colB = mixRgb(BLUE, RED_DIM, red);
    const flickA = t > T.blueOutA && t < T.redB ? (flick(t, 5, 20, 0.6) ? 1 : 0.35) : 1;
    const baseA = (0.85 * (1 - red) + 0.5 * red) * flickA;
    const thick = 0.075;
    const seg = 0.25;
    const edge = (u0: number, v0: number, u1: number, v1: number, inner: boolean) => {
      const L = Math.hypot(u1 - u0, v1 - v0);
      const n = Math.max(1, Math.ceil(L / seg));
      for (let i = 0; i < n; i++) {
        const f0 = i / n;
        const f1 = (i + 1) / n;
        const cu = lerp(u0, u1, (f0 + f1) / 2);
        const cv = lerp(v0, v1, (f0 + f1) / 2);
        const lu = (u1 - u0) * (f1 - f0);
        const lv = (v1 - v0) * (f1 - f0);
        const horiz = Math.abs(lu) > Math.abs(lv);
        const w = (horiz ? Math.abs(lu) : thick) * LK + 1;
        const h = (horiz ? thick : Math.abs(lv)) * LK + 1;
        glowOnPlane(cu, cv, 0, inner ? 0 : 1, (c, glow) => {
          c.fillStyle = rgba(glow ? colB : mixRgb(colB, BLUE_HI, 0.35 * (1 - red)), (inner ? 0.25 : glow ? 0.45 : 1) * baseA);
          c.fillRect(-w / 2, -h / 2, w, h * (inner ? 0.5 : 1));
        });
      }
    };
    edge(-halfW, PH, halfW, PH, false);
    edge(-halfW, -PH, halfW, -PH, false);
    if (boxOpen > 0.98) {
      edge(-PW, -PH, -PW, PH, false);
      edge(PW, -PH, PW, PH, false);
      edge(-PW + 0.18, PH - 0.18, PW - 0.18, PH - 0.18, true);
      edge(-PW + 0.18, -PH + 0.18, PW - 0.18, -PH + 0.18, true);
    }
    // icon divider (fingerprint slot)
    const div = smoothstep(T.fpMoveA + 0.15, T.fpMoveB, t) * blueVis;
    if (div > 0) {
      const vv = PH * div;
      edge(-2.78, -vv, -2.78, vv, false);
    }
  }

  /* ---------- "Login" */
  if (t > T.loginA && t < T.ringB) {
    const word = "Login";
    const out = smoothstep(T.loginOut, T.ringB, t);
    for (let i = 0; i < word.length; i++) {
      const ti = T.loginA + i * 0.1;
      if (t < ti) continue;
      if (out > 0 && hash(i * 3.3 + Math.floor(t * 20)) < out) continue;
      const ch = t < ti + 0.14 ? scramble(t, i) : word[i];
      const u = -1.6 + i * 1.02;
      glowOnPlane(u, 0, 0, 1, (c, glow) => {
        c.font = `${glow ? 196 : 190}px "Share Tech Mono"`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = rgba(glow ? BLUE : BLUE_HI, glow ? 0.5 : 0.92);
        c.fillText(ch, 0, 4);
      });
    }
  }

  /* ---------- fingerprint */
  const fpA = smoothstep(T.fpIn, T.fpIn + 0.35, t) * (1 - smoothstep(T.blueOutA - 0.1, T.blueOutA + 0.15, t));
  if (fpA > 0) {
    const mv = easeInOut(clamp((t - T.fpMoveA) / (T.fpMoveB - T.fpMoveA)));
    const pulse = Math.exp(-Math.pow((t - (T.scanPulse + 0.2)) / 0.22, 2));
    const fu = lerp(0.45, -3.55, mv);
    const sc = lerp(1.65, 1.3, mv) * (1 + 0.25 * pulse);
    const fill = smoothstep(T.fpMoveA, T.fpMoveB, t);
    const drawFp = (c: CanvasRenderingContext2D, glow: boolean) => {
      c.scale(sc * LK, sc * LK);
      c.lineCap = "round";
      c.lineWidth = glow ? 0.05 : 0.026;
      c.strokeStyle = rgba(BLUE_HI, (glow ? 0.4 : 0.9) * fpA * (1 + pulse));
      c.beginPath();
      for (const r of world.fpRidges) {
        c.moveTo(r.cx + Math.cos(r.a0) * r.rx, r.cy - 0.33 + Math.sin(r.a0) * r.ry);
        c.ellipse(r.cx, r.cy - 0.33 + r.ry * 0.0, r.rx, r.ry, 0, r.a0, r.a1);
      }
      c.stroke();
      if (fill > 0 && !glow) {
        // the docked icon reads as a soft filled thumb
        c.fillStyle = rgba(BLUE_HI, 0.1 * fill * fpA);
        c.beginPath();
        c.ellipse(0, -0.02, 0.36, 0.48, 0, 0, Math.PI * 2);
        c.fill();
      }
    };
    glowOnPlane(fu, 0.02, 0, 1, drawFp);
    if (pulse > 0.05) onPlane(fu, 0.02, 0.0, 30, (c) => drawFp(c, true));
    // scanning ring
    const ring = clamp((t - T.ringA) / (T.ringB - T.ringA));
    if (ring > 0 && ring < 1) {
      glowOnPlane(fu, 0.02, 0, 1, (c, glow) => {
        c.strokeStyle = rgba(BLUE_HI, (glow ? 0.35 : 0.8) * Math.sin(Math.PI * ring));
        c.lineWidth = glow ? 9 : 4;
        c.beginPath();
        c.arc(0, 0, 0.95 * LK * sc, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, ring * 1.6));
        c.stroke();
        c.lineWidth = 2;
        c.beginPath();
        c.arc(0, 0, 1.08 * LK * sc, ring * 6, ring * 6 + 1.2);
        c.stroke();
      });
    }
  }

  /* ---------- password characters */
  for (let k = 0; k < T.passCount; k++) {
    const ti = T.passA + k * T.passStep;
    const gone = T.clearA + (T.passCount - 1 - k) * 0.045;
    if (t < ti || t > gone) continue;
    const u = -2.05 + k * 0.66;
    const asDot = smoothstep(ti + 0.17, ti + 0.24, t);
    glowOnPlane(u, 0, 0, 1, (c, glow) => {
      if (asDot < 1) {
        c.font = `${glow ? 125 : 120}px "Share Tech Mono"`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = rgba(glow ? BLUE : BLUE_HI, (1 - asDot) * (glow ? 0.5 : 0.95));
        c.fillText(glyphs[Math.floor(hash(k * 9.1) * 26)], 0, 6);
      }
      if (asDot > 0) {
        c.fillStyle = rgba(BLUE_HI, asDot * (glow ? 0.5 : 0.97));
        c.beginPath();
        c.ellipse(0, 0, 26 * asDot, 30 * asDot, 0, 0, Math.PI * 2);
        c.fill();
      }
    });
  }

  /* ---------- ACCESS DENIED */
  if (t > T.redA) {
    const word = "ACCESS DENIED";
    const adv = (ch: string) => (ch === "I" ? 0.36 : ch === " " ? 0.5 : 0.62);
    const total = word.split("").reduce((acc, ch) => acc + adv(ch), 0);
    const xs: number[] = [];
    let acc = -total / 2;
    for (const ch of word) {
      xs.push(acc + adv(ch) / 2);
      acc += adv(ch);
    }
    for (let i = 0; i < word.length; i++) {
      if (word[i] === " ") continue;
      const appear = T.redA + hash(i * 2.7) * 0.5;
      if (t < appear) continue;
      const settled = t > appear + 0.25;
      if (!settled && !flick(t, i, 24, 0.55)) continue;
      // occasional glitch dropout later on
      if (settled && t > 10 && flick(t, i + 40, 12, 0.025)) continue;
      const u = xs[i];
      const ch = settled ? word[i] : scramble(t, i + 7);
      glowOnPlane(u, -0.02, 0, 1, (c, glow) => {
        c.font = `600 ${glow ? 142 : 136}px Rajdhani`;
        c.textAlign = "center";
        c.textBaseline = "middle";
        c.fillStyle = rgba(glow ? NET : RED, glow ? 0.3 : 0.82);
        c.fillText(ch, 0, 8);
      });
    }
  }

  /* ---------- data rows */
  const dataA = smoothstep(0.45, 1.2, t);
  for (const b of world.bars) {
    if (hash(b.seed) * 1.2 + 0.4 > t) continue;
    if (flick(t, b.seed, 6, 0.04)) continue;
    const scroll = b.kind === "tick" ? 0 : 0.04 * Math.sin(t * 0.8 + b.seed);
    const hMod = b.kind !== "pill" ? 0.6 + 0.4 * Math.abs(Math.sin(t * 1.5 + b.seed)) : 1;
    const col = b.kind === "tick" ? BLUE_HI : mixRgb(BLUE, [205, 210, 240], red);
    const a = dataA * (b.kind === "pill" ? 0.75 : 0.9) * (b.v < -2 ? 0.5 : 1);
    onPlane(b.u + scroll, b.v, 0, 0, (c) => {
      c.fillStyle = rgba(col, a);
      const w = b.w * LK;
      const h = b.h * LK * hMod;
      if (b.kind === "pill") {
        c.beginPath();
        c.roundRect(-w / 2, -h / 2, w, h, h / 2);
        c.fill();
      } else c.fillRect(-w / 2, -h / 2, w, h);
    });
  }

  /* ---------- red network */
  const netOn = smoothstep(T.netA, T.netB, t);
  if (netOn > 0) {
    const rot = (t - T.netA) * 0.035;
    const cr = Math.cos(rot);
    const sr = Math.sin(rot);
    const P = world.nodes.map((n) => {
      const x = n.p[0] + 0.2 * Math.sin(t * 0.3 + n.ph);
      const z = n.p[2] + 0.2 * Math.cos(t * 0.25 + n.ph);
      const wp: V3 = [x * cr - z * sr, n.p[1] + 0.15 * Math.sin(t * 0.2 + n.ph * 2), x * sr + z * cr];
      return { wp, pr: cam.project(wp) };
    });
    const behind = (p: V3) => p[2] < 0 && Math.abs(p[0]) < PW && Math.abs(p[1]) < PH;
    for (const l of world.links) {
      const g0 = clamp((t - l.t0) / 0.45);
      if (g0 <= 0) continue;
      const A0 = P[l.a];
      const B0 = P[l.b];
      if (!A0.pr || !B0.pr) continue;
      const gx = lerp(A0.pr.x, B0.pr.x, g0);
      const gy = lerp(A0.pr.y, B0.pr.y, g0);
      const mid: V3 = [(A0.wp[0] + B0.wp[0]) / 2, (A0.wp[1] + B0.wp[1]) / 2, (A0.wp[2] + B0.wp[2]) / 2];
      const blur = (blurAt(A0.pr.z) + blurAt(B0.pr.z)) / 2;
      const lvl = behind(mid) ? 0 : blur > 40 ? 1 : 2;
      dof.line(A0.pr.x, A0.pr.y, gx, gy, blur, A.netStyles[lvl]);
    }
    P.forEach((n, i) => {
      if (!n.pr) return;
      const nd = world.nodes[i];
      const b = blurAt(n.pr.z);
      const s = nd.spark ? 7 + 5 * Math.abs(Math.sin(t * 3 + nd.ph)) : 3.5;
      dof.dot(n.pr.x, n.pr.y, s * netOn, b, A.nodeStyle);
      if (nd.spark && b < 30) {
        dof.line(n.pr.x - s * 4, n.pr.y, n.pr.x + s * 4, n.pr.y, b, A.netStyles[2]);
        dof.line(n.pr.x, n.pr.y - s * 4, n.pr.x, n.pr.y + s * 4, b, A.netStyles[2]);
      }
    });
  }

  dof.binGain = (lvl) => Math.pow(1 + lvl / 40, -0.45);
  dof.composite(ctx);

  /* ---------- red ambient haze */
  if (red > 0) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    const hz = ctx.createRadialGradient(pw * 0.25, ph * 0.6, 0, pw * 0.25, ph * 0.6, pw * 0.6);
    hz.addColorStop(0, rgba([110, 8, 12], 0.45 * red));
    hz.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = hz;
    ctx.fillRect(0, 0, pw, ph);
    ctx.restore();
  }
  dof.bloom(ctx, ctx.canvas, 0.55, 5);
  applyVignette(ctx, 0.7);
  applyGrain(ctx, A.grain, q, frame, 0.06);
  // opening fade from black
  if (t < 0.5) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = `rgba(0,0,0,${1 - smoothstep(0, 0.5, t)})`;
    ctx.fillRect(0, 0, pw, ph);
    ctx.restore();
  }
  void randUnit;
};

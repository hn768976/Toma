import * as THREE from "three";
import {
  BB_RECT,
  Billboard,
  Line,
  SPRITE_DOT,
  SPRITE_FLARE,
  SPRITE_GLOW,
  Sprite,
} from "../engine/batches";
import { gauss, mulberry32, range } from "../engine/random";
import { CrashPalette } from "./palette";

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export type TickerSpec = {
  pos: THREE.Vector3;
  rotX: number;
  rotY: number;
  w: number;
  h: number;
  rows: number;
  groups: number;
  texW: number;
  texH: number;
  alpha: number;
  glow: number;
  seed: number;
};

export type SparkBurst = {
  origin: THREE.Vector3;
  t0: number;
  count: number;
  speed: [number, number];
  life: number;
  seed: number;
};

export type CrashScene = {
  sprites: Sprite[];
  lines: Line[];
  billboards: Billboard[];
  tickers: TickerSpec[];
  bursts: SparkBurst[];
};

/** A falling, jagged "stock price" polyline in the plane z = const. */
const chartPath = (
  seed: number,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  z: number,
  step: number,
  jag: number,
) => {
  const rng = mulberry32(seed);
  const n = Math.ceil((x1 - x0) / step);
  const pts: THREE.Vector3[] = [];
  let y = y0;
  let vel = 0;
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const target = y0 + (y1 - y0) * u;
    vel = vel * 0.55 + (target - y) * 0.18 + gauss(rng) * jag;
    if (rng() < 0.05) vel -= jag * 3;
    if (i > 0) y += vel;
    pts.push(v3(x0 + i * step, y, z));
  }
  return pts;
};

const polyline = (
  out: Line[],
  pts: THREE.Vector3[],
  base: Omit<Line, "a" | "b">,
  drawOn?: { start: number; duration: number },
) => {
  const n = pts.length - 1;
  for (let i = 0; i < n; i++) {
    const segDur = drawOn ? drawOn.duration / n : 0;
    out.push({
      ...base,
      a: pts[i],
      b: pts[i + 1],
      birth: drawOn ? drawOn.start + i * segDur : base.birth,
      grow: drawOn ? segDur * 1.05 : base.grow,
    });
  }
};

/** Resample a polyline at a fixed arc-length spacing. */
const resample = (pts: THREE.Vector3[], spacing: number) => {
  const out: { p: THREE.Vector3; dir: THREE.Vector3; u: number }[] = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) total += pts[i].distanceTo(pts[i + 1]);
  let acc = 0;
  let next = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const len = a.distanceTo(b);
    const dir = b.clone().sub(a).normalize();
    while (next <= acc + len) {
      const p = a.clone().add(dir.clone().multiplyScalar(next - acc));
      out.push({ p, dir, u: next / total });
      next += spacing;
    }
    acc += len;
  }
  return out;
};

export const MAIN_CHART_SEED = 919291;

export const buildCrashScene = (pal: CrashPalette, seed: number): CrashScene => {
  const rng = mulberry32(seed);
  const sprites: Sprite[] = [];
  const lines: Line[] = [];
  const billboards: Billboard[] = [];

  /* ---------------- chart lines ---------------- */
  const main = chartPath(MAIN_CHART_SEED, -40, 42, 13, -25, 0, 0.5, 0.42);
  polyline(
    lines,
    main,
    {
      colorA: pal.lineHot,
      colorB: pal.lineHot,
      alphaA: 1,
      alphaB: 1,
      width: 2.4,
    },
    { start: -1.5, duration: 9.5 },
  );
  polyline(
    lines,
    main,
    {
      colorA: pal.line,
      colorB: pal.line,
      alphaA: 0.22,
      alphaB: 0.22,
      width: 12,
    },
    { start: -1.5, duration: 9.5 },
  );
  // background / secondary charts
  const secondary: [number, number, number, number, number, number, number][] = [
    // seed, x0, x1, y0, y1, z, alpha
    [11, -60, 50, 21, -6, -16, 0.55],
    [12, -80, 70, 28, 2, -34, 0.35],
    [13, -34, 14, 3, -13, 6, 0.6],
    [14, 10, 60, -2, -30, -8, 0.45],
  ];
  secondary.forEach(([s, x0, x1, y0, y1, z, alpha], i) => {
    const pts = chartPath(s, x0, x1, y0, y1, z, 0.6, 0.38);
    polyline(
      lines,
      pts,
      {
        colorA: pal.line,
        colorB: pal.line,
        alphaA: alpha,
        alphaB: alpha,
        width: 1.8,
      },
      i === 2 ? { start: 4.5, duration: 6 } : undefined,
    );
  });

  /* ---------------- LED dot-matrix chart ---------------- */
  const ledPath = chartPath(77, -8, 36, 9, -31, 10, 0.9, 0.75);
  const dots = resample(ledPath, 0.36);
  dots.forEach((d) => {
    const nrm = v3(-d.dir.y, d.dir.x, 0);
    for (let k = -1; k <= 1; k++) {
      const p = d.p.clone().add(nrm.clone().multiplyScalar(k * 0.36));
      const item: Billboard = {
        pos: p,
        color: pal.led,
        alpha: k === 0 ? 1 : 0.8,
        w: 0.26,
        h: 0.26,
        kind: BB_RECT,
        seed: 0,
        birth: 2.6 + d.u * 7.0,
      };
      billboards.push(item);
      if (k === 0) billboards.push({ ...item, alpha: 0.35, extraBlur: 9 });
    }
  });

  /* ---------------- candlesticks ---------------- */
  const candleRow = (
    z: number,
    x0: number,
    x1: number,
    yAt: (x: number) => number,
    alpha: number,
    birth: number,
  ) => {
    for (let x = x0; x <= x1; x += 1.15) {
      const base = yAt(x);
      const o = base + range(rng, -0.9, 0.9);
      const c = base + range(rng, -0.9, 0.9);
      const hi = Math.max(o, c) + range(rng, 0.2, 1.2);
      const lo = Math.min(o, c) - range(rng, 0.2, 1.2);
      const b = birth + (x - x0) * 0.04;
      lines.push({
        a: v3(x, lo, z),
        b: v3(x, hi, z),
        colorA: pal.candle,
        colorB: pal.candle,
        alphaA: alpha * 0.7,
        alphaB: alpha * 0.7,
        width: 1.3,
        birth: b,
        grow: 0.4,
      });
      lines.push({
        a: v3(x, Math.min(o, c), z),
        b: v3(x, Math.max(o, c) + 0.05, z),
        colorA: pal.candle,
        colorB: pal.candle,
        alphaA: alpha,
        alphaB: alpha,
        width: 2,
        worldWidth: 0.5,
        birth: b,
        grow: 0.4,
      });
    }
  };
  const mainAt = (x: number) => {
    const i = Math.max(0, Math.min(main.length - 1, Math.round((x + 40) / 0.5)));
    return main[i].y;
  };
  candleRow(-5, -38, 12, (x) => mainAt(x) - 4.5, 0.75, -10);
  candleRow(-20, -50, 52, (x) => 9 - x * 0.2 + Math.sin(x * 0.4) * 1.5, 0.55, -10);
  candleRow(-12, 8, 50, (x) => 12 - (x - 8) * 0.12 + Math.sin(x * 0.7) * 1.2, 0.6, -10);
  candleRow(4, 4, 19, (x) => -4 - (x - 4) * 0.42 + Math.sin(x) * 0.8, 0.7, 5.0);

  /* ---------------- ticker boards ---------------- */
  const tickers: TickerSpec[] = [
    { pos: v3(24, -23, -2), rotX: -0.18, rotY: 0, w: 46, h: 20, rows: 10, groups: 3, texW: 4096, texH: 2048, alpha: 0.95, glow: 0.55, seed: 1 },
    { pos: v3(33, 15, -18), rotX: 0, rotY: -0.25, w: 34, h: 15, rows: 8, groups: 3, texW: 2048, texH: 1024, alpha: 0.55, glow: 0.5, seed: 2 },
    { pos: v3(-28, 14, -30), rotX: 0, rotY: 0.2, w: 46, h: 20, rows: 12, groups: 4, texW: 2048, texH: 1024, alpha: 0.38, glow: 0.5, seed: 3 },
    { pos: v3(-22, -21, -12), rotX: -0.12, rotY: 0.1, w: 40, h: 16, rows: 10, groups: 3, texW: 2048, texH: 1024, alpha: 0.6, glow: 0.5, seed: 4 },
    { pos: v3(40, 4, -34), rotX: 0, rotY: -0.35, w: 40, h: 17, rows: 9, groups: 3, texW: 2048, texH: 1024, alpha: 0.5, glow: 0.5, seed: 6 },
    { pos: v3(0, 2, -62), rotX: 0, rotY: 0, w: 130, h: 56, rows: 22, groups: 6, texW: 2048, texH: 1024, alpha: 0.2, glow: 0.6, seed: 5 },
  ];

  /* ---------------- lens flares & haze ---------------- */
  const flareSpots = [
    v3(-14, 3, 2),
    v3(6, 7, -3),
    v3(-23, -6, 5),
    v3(14, -2, 1),
    v3(-4, -4, 6),
    v3(26, 9, -10),
    v3(-34, 10, -12),
    v3(30, -12, 3),
    v3(19, -20, 2),
    v3(2, 13, -14),
    v3(36, -26, 4),
    v3(-8, -15, -2),
  ];
  flareSpots.forEach((p, i) => {
    sprites.push({
      pos: p,
      color: pal.flare,
      alpha: i < 6 ? 1 : range(rng, 0.6, 0.85),
      size: range(rng, 24, 34),
      minPx: i < 6 ? 760 : 420,
      kind: SPRITE_FLARE,
      twinklePhase: rng(),
      twinkleAmt: 0.45,
      driftAmp: 0.3,
      driftSpeed: 0.2,
    });
    sprites.push({
      pos: p,
      color: pal.flareCore,
      alpha: 1,
      size: 0.6,
      minPx: 9,
      kind: SPRITE_GLOW,
      twinklePhase: rng(),
      twinkleAmt: 0.3,
      driftAmp: 0.3,
      driftSpeed: 0.2,
    });
    sprites.push({
      pos: p,
      color: pal.haze,
      alpha: i < 5 ? 0.42 : 0.2,
      size: range(rng, 14, 22),
      minPx: 90,
      kind: SPRITE_GLOW,
    });
  });
  // big central haze
  sprites.push({
    pos: v3(-4, 0, -6),
    color: pal.haze,
    alpha: 0.38,
    size: 60,
    minPx: 260,
    kind: SPRITE_GLOW,
  });

  /* ---------------- shooting light streaks ---------------- */
  [5.6, 6.3, 6.9, 7.5, 8.1, 9.5, 11.1, 0.8, 2.9].forEach((t, i) => {
    const start = v3(range(rng, -30, 20), range(rng, 4, 22), range(rng, -10, 8));
    const dir = v3(1, -range(rng, 0.45, 0.8), range(rng, -0.1, 0.1)).normalize();
    lines.push({
      a: start,
      b: start.clone().add(dir.multiplyScalar(range(rng, 25, 40))),
      colorA: pal.lineHot,
      colorB: pal.flareCore,
      alphaA: 0.0,
      alphaB: i < 7 ? 0.95 : 0.6,
      width: 1.8,
      birth: t,
      grow: 0.55,
      tailLag: 0.2,
    });
  });

  /* ---------------- floating data chips ---------------- */
  for (let i = 0; i < 80; i++) {
    const w = range(rng, 0.3, 1.1);
    billboards.push({
      pos: v3(range(rng, -48, 48), range(rng, -30, 24), range(rng, -26, 3)),
      color: rng() < 0.5 ? pal.square : pal.line,
      alpha: range(rng, 0.25, 0.7),
      w,
      h: w * range(rng, 0.45, 1),
      kind: BB_RECT,
      seed: rng(),
      birth: rng() < 0.6 ? -10 : range(rng, 0, 10),
    });
  }

  /* ---------------- dust ---------------- */
  for (let i = 0; i < 1800; i++) {
    sprites.push({
      pos: v3(range(rng, -70, 70), range(rng, -40, 35), range(rng, -60, 30)),
      color: pal.dust,
      alpha: range(rng, 0.15, 0.55),
      size: range(rng, 0.06, 0.15),
      minPx: 1.4,
      kind: SPRITE_DOT,
      twinklePhase: rng(),
      twinkleAmt: 0.5,
      driftAmp: 0.4,
      driftSpeed: range(rng, 0.1, 0.3),
    });
  }

  const bursts: SparkBurst[] = [
    { origin: v3(-19, -5, 13), t0: 2.2, count: 260, speed: [8, 30], life: 1.7, seed: 5 },
    { origin: v3(-2, 4, 4), t0: 5.9, count: 160, speed: [6, 22], life: 1.4, seed: 6 },
  ];

  return { sprites, lines, billboards, tickers, bursts };
};

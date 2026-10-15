import { Container, Sprite, type Texture } from "pixi.js";
import { blurred, canvasTexture, makeCanvas } from "../engine/bake";
import { drawInto } from "../engine/gl";
import { hash3, mulberry32, range, type Rng } from "../engine/rng";
import type { LookFactory } from "../engine/types";

// ---------------------------------------------------------------------------
// Look 2 — Film Dust overlay. Pure white elements on exactly-black:
//   * a new layout every 2 frames from hash(bucket), bucket = floor(f/2) % 300
//   * ~5% of elements persist for 6-10 frames (3/4/5 buckets; all divide 300)
//   * density varies in soft patches (a slowly moving, closed-loop noise mask)
// No bloom, no haze: anything that is not a dust element stays (0,0,0).
// ---------------------------------------------------------------------------

export type FilmDustParams = {
  count: number; // elements on screen per frame
  seed: number;
};

const TAU = Math.PI * 2;

type Kind = "speck" | "fibre" | "thread" | "shard" | "soft" | "scratch";

// irregular fleck / chip (not a round dot)
const bakeSpeck = (rng: Rng, px: number) => {
  const r = range(rng, 0.7, 2.2) * px;
  const S = Math.ceil(r * 4 + 6 * px + 4);
  const { c, g } = makeCanvas(S, S);
  g.fillStyle = "#fff";
  g.shadowColor = "rgba(255,255,255,0.6)";
  g.shadowBlur = 1.5 * px;
  g.beginPath();
  const n = 5 + Math.floor(rng() * 3);
  const el = range(rng, 1, 2.6);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + range(rng, -0.3, 0.3);
    const rr = r * range(rng, 0.45, 1.2);
    const x = S / 2 + Math.cos(a) * rr * el;
    const y = S / 2 + Math.sin(a) * rr;
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.closePath();
  g.fill();
  return c;
};

// short, jagged, flat shard: a few straight segments with sharp kinks, varying
// width (ribbon), sometimes a twig-like fork; edge glint baked in as a glow
const bakeShard = (rng: Rng, px: number) => {
  const len = (5 + 22 * rng() ** 1.8) * px; // short flakes and slivers
  const segs = 1 + Math.floor(rng() * 4);
  const pts: [number, number][] = [[0, 0]];
  let a = range(rng, 0, TAU);
  for (let i = 0; i < segs; i++) {
    a += range(rng, -1.1, 1.1);
    const l = (len / segs) * range(rng, 0.5, 1.5);
    const [x, y] = pts[pts.length - 1];
    pts.push([x + Math.cos(a) * l, y + Math.sin(a) * l]);
  }
  const forks: [number, number, number, number][] = [];
  if (rng() < 0.45) {
    const [x, y] = pts[1 + Math.floor(rng() * (pts.length - 1))];
    const fa = a + range(rng, 0.6, 1.6) * (rng() < 0.5 ? -1 : 1);
    const fl = len * range(rng, 0.15, 0.4);
    forks.push([x, y, x + Math.cos(fa) * fl, y + Math.sin(fa) * fl]);
  }
  const all = [...pts, ...forks.map((f) => [f[2], f[3]] as [number, number])];
  const w = range(rng, 1.2, 3.0) * px;
  const pad = w * 3 + 3 * px + 4;
  const minx = Math.min(...all.map((p) => p[0])) - pad;
  const miny = Math.min(...all.map((p) => p[1])) - pad;
  const { c, g } = makeCanvas(Math.max(...all.map((p) => p[0])) - minx + pad, Math.max(...all.map((p) => p[1])) - miny + pad);
  g.lineCap = "round";
  g.lineJoin = "miter";
  g.shadowColor = "rgba(255,255,255,0.7)";
  g.shadowBlur = 1.2 * px;
  for (let i = 1; i < pts.length; i++) {
    g.strokeStyle = `rgba(255,255,255,${range(rng, 0.45, 1)})`;
    g.lineWidth = w * range(rng, 0.4, 1.2);
    g.beginPath();
    g.moveTo(pts[i - 1][0] - minx, pts[i - 1][1] - miny);
    g.lineTo(pts[i][0] - minx, pts[i][1] - miny);
    g.stroke();
  }
  for (const f of forks) {
    g.strokeStyle = `rgba(255,255,255,${range(rng, 0.4, 0.9)})`;
    g.lineWidth = w * 0.5;
    g.beginPath();
    g.moveTo(f[0] - minx, f[1] - miny);
    g.lineTo(f[2] - minx, f[3] - miny);
    g.stroke();
  }
  return c;
};

// a small piece of debris: 2-5 short angular fragments crumpled together,
// sometimes with a star / x-shaped glint; soft-edged like filmed dust
const bakeDebris = (rng: Rng, px: number) => {
  const S = Math.ceil(40 * px + 8);
  const { c, g } = makeCanvas(S, S);
  g.lineCap = "butt";
  g.lineJoin = "miter";
  const n = 2 + Math.floor(rng() * 4);
  for (let i = 0; i < n; i++) {
    const cx = S / 2 + range(rng, -7, 7) * px;
    const cy = S / 2 + range(rng, -7, 7) * px;
    const segs = 1 + Math.floor(rng() * 3);
    let a = range(rng, 0, TAU);
    let x = cx;
    let y = cy;
    g.strokeStyle = `rgba(255,255,255,${range(rng, 0.35, 0.95)})`;
    g.lineWidth = range(rng, 0.8, 2.4) * px;
    g.beginPath();
    g.moveTo(x, y);
    for (let k = 0; k < segs; k++) {
      a += range(rng, -1.6, 1.6);
      const l = range(rng, 2.5, 9) * px;
      x += Math.cos(a) * l;
      y += Math.sin(a) * l;
      g.lineTo(x, y);
    }
    g.stroke();
  }
  if (rng() < 0.25) {
    // star / x glint
    const cx = S / 2;
    const cy = S / 2;
    const arms = rng() < 0.5 ? 2 : 3;
    const a0 = range(rng, 0, TAU);
    g.strokeStyle = `rgba(255,255,255,${range(rng, 0.5, 0.9)})`;
    g.lineWidth = range(rng, 0.7, 1.3) * px;
    for (let k = 0; k < arms; k++) {
      const a = a0 + (k * Math.PI) / arms;
      const l = range(rng, 3, 7) * px;
      g.beginPath();
      g.moveTo(cx - Math.cos(a) * l, cy - Math.sin(a) * l);
      g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l);
      g.stroke();
    }
  }
  return c;
};

const strokePath = (
  rng: Rng,
  px: number,
  len: number,
  curl: number,
  width: number,
  wiggle: number,
  jitter: number,
) => {
  const steps = Math.max(6, Math.round(len / (2 * px)));
  const pts: [number, number][] = [];
  let a = range(rng, 0, TAU);
  let x = 0;
  let y = 0;
  const seg = len / steps;
  const ph = range(rng, 0, TAU);
  const freq = range(rng, 0.1, 0.5);
  for (let i = 0; i <= steps; i++) {
    pts.push([x, y]);
    a += curl + wiggle * Math.sin(i * freq + ph) + range(rng, -jitter, jitter);
    x += Math.cos(a) * seg;
    y += Math.sin(a) * seg;
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const pad = width * 2 + 2;
  const minx = Math.min(...xs) - pad;
  const miny = Math.min(...ys) - pad;
  const { c, g } = makeCanvas(Math.max(...xs) - minx + pad, Math.max(...ys) - miny + pad);
  g.lineCap = "round";
  g.lineJoin = "round";
  // one continuous stroke (no overlapping joints), brightness varied along
  // the strand with a linear gradient between its two ends
  const [x0, y0] = pts[0];
  const [x1, y1] = pts[pts.length - 1];
  const grad = g.createLinearGradient(x0 - minx, y0 - miny, x1 - minx, y1 - miny);
  const b0 = range(rng, 0.35, 1);
  const b1 = range(rng, 0.35, 1);
  grad.addColorStop(0, `rgba(255,255,255,${b0 * 0.6})`);
  grad.addColorStop(0.5, `rgba(255,255,255,${(b0 + b1) / 2})`);
  grad.addColorStop(1, `rgba(255,255,255,${b1 * 0.6})`);
  g.strokeStyle = grad;
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(x0 - minx, y0 - miny);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0] - minx, pts[i][1] - miny);
  g.stroke();
  return c;
};

const bakeFibre = (rng: Rng, px: number) => {
  // mostly short clippings, a few long hairs (10-80 px at 720p)
  const len = (8 + 72 * rng() ** 2.6) * px;
  return strokePath(rng, px, len, range(rng, -0.06, 0.06), range(rng, 0.7, 1.4) * px, range(rng, 0.0, 0.12), 0.32);
};
const bakeThread = (rng: Rng, px: number) =>
  strokePath(rng, px, range(rng, 20, 60) * px, range(rng, 0.08, 0.2) * (rng() < 0.5 ? -1 : 1), range(rng, 0.6, 1.1) * px, range(rng, 0.1, 0.3), 0.12);

const bakeScratch = (rng: Rng, px: number) => {
  const len = range(rng, 200, 720) * px;
  const w = range(rng, 0.7, 1.4) * px;
  const { c, g } = makeCanvas(w * 6 + 8, len);
  let x = c.width / 2;
  const steps = 60;
  for (let i = 0; i < steps; i++) {
    const y0 = (i / steps) * len;
    const y1 = ((i + 1) / steps) * len;
    const nx = x + range(rng, -0.3, 0.3) * px;
    const t = i / steps;
    g.strokeStyle = `rgba(255,255,255,${Math.min(1, Math.min(t, 1 - t) * 5) * range(rng, 0.5, 1)})`;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x, y0);
    g.lineTo(nx, y1);
    g.stroke();
    x = nx;
  }
  return c;
};

// 2D value noise for the density mask (JS), periodic in time via a circle.
const vnoise = (x: number, y: number, seed: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const h = (a: number, b: number) => hash3(a, b, seed);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c2 = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c2 - a) * v + (a - b - c2 + d) * u * v;
};

export const createFilmDust: LookFactory<FilmDustParams> = (ctx, params) => {
  const { W, H, px } = ctx;
  const rng = mulberry32(params.seed);
  const tex: Record<Kind, Texture[]> = {
    speck: Array.from({ length: 24 }, () => canvasTexture(bakeSpeck(rng, px))),
    fibre: Array.from({ length: 64 }, () => canvasTexture(bakeFibre(rng, px))),
    thread: Array.from({ length: 20 }, () => canvasTexture(bakeThread(rng, px))),
    shard: Array.from({ length: 96 }, (_, i) => canvasTexture(blurred(i % 3 === 0 ? bakeShard(rng, px) : bakeDebris(rng, px), 0.9 * px))),
    // out-of-focus flakes behind the sharp ones (defocused depth layer)
    soft: Array.from({ length: 48 }, () => canvasTexture(blurred(bakeDebris(rng, px * 1.5), range(rng, 1.1, 2.0) * px))),
    scratch: Array.from({ length: 6 }, () => canvasTexture(bakeScratch(rng, px))),
  };

  const N = params.count;
  const P = Math.round(N * 0.05); // persistent
  const F = N - P; // flickering (new every 2 frames)
  const stage = new Container();
  const sprites: Sprite[] = [];
  for (let i = 0; i < N + 4; i++) {
    const s = new Sprite(tex.speck[0]);
    s.anchor.set(0.5);
    s.blendMode = "add";
    stage.addChild(s);
    sprites.push(s);
  }
  const persistLife = Array.from({ length: P }, (_, j) => 3 + (j % 3)); // 3,4,5 buckets = 6,8,10 frames
  const persistOff = Array.from({ length: P }, () => Math.floor(rng() * 300));

  ctx.post.setGrade({ mode: "rgb", bloom: 0, vignette: 0, grain: 0.015, toneMap: false });

  const kindFor = (h: number): Kind =>
    h < 0.1 ? "speck" : h < 0.6 ? "shard" : h < 0.95 ? "soft" : h < 0.99 ? "fibre" : "thread";

  // density in soft patches; moves on a closed loop over 600 frames
  const density = (x: number, y: number, ph: number) => {
    const ox = Math.cos(TAU * ph) * 0.8;
    const oy = Math.sin(TAU * ph) * 0.8;
    const n = 0.65 * vnoise(x * 3 + ox, y * 3 + oy, 11) + 0.35 * vnoise(x * 7 - oy, y * 7 + ox, 12);
    const base = 0.75 + 0.25 * Math.min(1, Math.max(0, (n - 0.2) / 0.6));
    const yy = y * (W / H); // back to 0..1
    const col = 0.68 + 0.32 * Math.exp(-(((x - 0.5) / 0.3) ** 2 + ((yy - 0.5) / 0.45) ** 2));
    const tr = Math.hypot((x - 1) * 1.6, yy) < 0.75 ? 0.75 : 1;
    const bl = Math.hypot(x * 1.6, yy - 1) < 0.75 ? 0.75 : 1;
    return base * col * Math.min(tr, bl);
  };

  const place = (s: Sprite, a: number, b: number, c: number, ph: number, maxTries: number) => {
    // rejection-sample a position against the density mask
    for (let t = 0; t < maxTries; t++) {
      const x = hash3(a, b, c * 31 + t * 7 + 1);
      const y = hash3(a, b, c * 31 + t * 7 + 2);
      if (hash3(a, b, c * 31 + t * 7 + 3) <= density(x, y * (H / W), ph)) {
        const k = kindFor(hash3(a, b, c * 31 + 4));
        const list = tex[k];
        s.texture = list[Math.floor(hash3(a, b, c * 31 + 5) * list.length) % list.length];
        s.position.set(x * W, y * H);
        // a faint diagonal grain: most elements lie near one diagonal
        const hr = hash3(a, b, c * 31 + 6);
        s.rotation = hr < 0.6 ? -0.65 + (hr / 0.6 - 0.5) * 1.3 : hr * TAU;
        const sc = k === "speck" ? 0.7 + 0.6 * hash3(a, b, c * 31 + 8) : 0.75 + 0.5 * hash3(a, b, c * 31 + 8);
        s.scale.set(sc / ctx.res);
        const br = 0.3 + 0.55 * hash3(a, b, c * 31 + 9) ** 0.8; // 30-85 %: soft grey, never clipped white
        s.alpha = (k === "soft" ? br * 0.5 : br) * 0.55;
        s.visible = true;
        return;
      }
    }
    s.visible = false;
  };

  return {
    render(f) {
      const bucket = Math.floor(f / 2) % 300;
      const ph = bucket / 300;
      let si = 0;
      // flickering layout
      for (let i = 0; i < F; i++) place(sprites[si++], bucket, i, 1, ph, 12);
      // persistent elements: same layout for their whole life
      for (let j = 0; j < P; j++) {
        const L = persistLife[j];
        const epoch = Math.floor(((bucket + persistOff[j]) % 300) / L);
        place(sprites[si++], 1000 + j, epoch, 2, 0, 12);
      }
      // rare long vertical scratches (0-2 per frame)
      for (let k = 0; k < 4; k++) {
        const s = sprites[si++];
        const on = hash3(bucket, k, 77) < (k < 2 ? 0.35 : 0.08);
        s.visible = on;
        if (!on) continue;
        s.texture = tex.scratch[Math.floor(hash3(bucket, k, 78) * 6) % 6];
        s.position.set(hash3(bucket, k, 79) * W, H * (0.3 + 0.4 * hash3(bucket, k, 80)));
        s.rotation = (hash3(bucket, k, 81) - 0.5) * 0.03;
        s.scale.set(1 / ctx.res, (1.2 + hash3(bucket, k, 82)) / ctx.res);
        s.alpha = 0.12 + 0.18 * hash3(bucket, k, 83);
      }
      drawInto(ctx.renderer, stage, ctx.post.hdr, true);
      ctx.post.present(f);
    },
  };
};

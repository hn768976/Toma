/**
 * Depth-of-field renderer for Canvas 2D.
 *
 * Geometry is sorted into "blur bins" by circle-of-confusion. Each bin is
 * rasterised into its own (down-scaled) offscreen canvas, gaussian-blurred and
 * additively composited onto the output. Heavily blurred bins are rendered at
 * reduced resolution, so cost stays roughly constant regardless of blur size.
 * All coordinates passed in are 4K composition pixels (3840x2160).
 */
export const W4K = 3840;
export const H4K = 2160;

type Bucket = { style: number; segs: number[]; dots: number[]; discs: number[] };
export type CustomDraw = (ctx: CanvasRenderingContext2D) => void;
type Bin = {
  customs: CustomDraw[];
  lvl: number;
  s: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tmp: HTMLCanvasElement;
  tctx: CanvasRenderingContext2D;
  buckets: Map<number, Bucket>;
};
export type Style = { color: string; width: number };

const mk = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  const ctx = c.getContext("2d")!;
  return { c, ctx };
};

export class DofRenderer {
  readonly q: number;
  readonly pw: number;
  readonly ph: number;
  private bins: Bin[];
  private styles: Style[] = [];
  private logLv: number[];
  private bloomA: { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D };
  private bloomB: { c: HTMLCanvasElement; ctx: CanvasRenderingContext2D };

  /** brightness multiplier per blur level (defocused geometry reads as soft haze) */
  binGain: (lvl: number) => number = () => 1;

  constructor(q: number, levels = [0, 2, 4.5, 8, 14, 23, 36, 55, 85, 130, 190]) {
    this.q = q;
    this.pw = Math.round(W4K * q);
    this.ph = Math.round(H4K * q);
    this.bins = levels.map((lvl) => {
      const s = lvl <= 6 ? 1 : Math.max(0.03, 6 / lvl);
      const a = mk(this.pw * s, this.ph * s);
      const b = mk(this.pw * s, this.ph * s);
      return { customs: [], lvl, s, canvas: a.c, ctx: a.ctx, tmp: b.c, tctx: b.ctx, buckets: new Map() };
    });
    this.logLv = levels.map((l) => Math.log(1 + l));
    this.bloomA = mk(this.pw / 8, this.ph / 8);
    this.bloomB = mk(this.pw / 8, this.ph / 8);
  }

  style(color: string, width: number) {
    this.styles.push({ color, width });
    return this.styles.length - 1;
  }

  binIndex(blur: number) {
    const lb = Math.log(1 + Math.max(0, blur));
    let best = 0;
    let bd = 1e9;
    for (let i = 0; i < this.logLv.length; i++) {
      const d = Math.abs(lb - this.logLv[i]);
      if (d < bd) {
        bd = d;
        best = i;
      }
    }
    return best;
  }

  private bucket(blur: number, style: number) {
    const bin = this.bins[this.binIndex(blur)];
    let b = bin.buckets.get(style);
    if (!b) {
      b = { style, segs: [], dots: [], discs: [] };
      bin.buckets.set(style, b);
    }
    return b;
  }

  line(x1: number, y1: number, x2: number, y2: number, blur: number, style: number) {
    this.bucket(blur, style).segs.push(x1, y1, x2, y2);
  }
  /** square-ish dot of radius r (fast) */
  dot(x: number, y: number, r: number, blur: number, style: number) {
    this.bucket(blur, style).dots.push(x, y, r);
  }
  /** true circle of radius r */
  disc(x: number, y: number, r: number, blur: number, style: number) {
    this.bucket(blur, style).discs.push(x, y, r);
  }

  /** arbitrary drawing (in 4K px coordinates) placed into the bin for this blur */
  custom(blur: number, fn: CustomDraw) {
    this.bins[this.binIndex(blur)].customs.push(fn);
  }

  /** Rasterise all bins and add them onto ctx (pixel space, identity transform). */
  composite(ctx: CanvasRenderingContext2D, extraPerBin?: (binCtx: CanvasRenderingContext2D, binIndex: number) => void) {
    for (let bi = 0; bi < this.bins.length; bi++) {
      const bin = this.bins[bi];
      const hasExtra = !!extraPerBin;
      if (bin.buckets.size === 0 && bin.customs.length === 0 && !hasExtra) continue;
      const k = this.q * bin.s;
      const c = bin.ctx;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.globalCompositeOperation = "source-over";
      c.clearRect(0, 0, bin.canvas.width, bin.canvas.height);
      c.setTransform(k, 0, 0, k, 0, 0);
      c.globalCompositeOperation = "lighter";
      c.lineCap = "round";
      let drew = false;
      for (const b of bin.buckets.values()) {
        const st = this.styles[b.style];
        if (b.segs.length) {
          c.strokeStyle = st.color;
          // keep strokes at least ~0.6 device px wide; thinner lines fade instead
          const devW = st.width * k;
          c.lineWidth = Math.max(st.width, 0.6 / k);
          c.globalAlpha = devW < 0.6 ? devW / 0.6 : 1;
          c.beginPath();
          const s = b.segs;
          for (let i = 0; i < s.length; i += 4) {
            c.moveTo(s[i], s[i + 1]);
            c.lineTo(s[i + 2], s[i + 3]);
          }
          c.stroke();
          c.globalAlpha = 1;
          drew = true;
        }
        if (b.dots.length) {
          c.fillStyle = st.color;
          const d = b.dots;
          for (let i = 0; i < d.length; i += 3) {
            const r = Math.max(d[i + 2], 0.5 / k);
            c.fillRect(d[i] - r, d[i + 1] - r, r * 2, r * 2);
          }
          drew = true;
        }
        if (b.discs.length) {
          c.fillStyle = st.color;
          c.beginPath();
          const d = b.discs;
          for (let i = 0; i < d.length; i += 3) {
            c.moveTo(d[i] + d[i + 2], d[i + 1]);
            c.arc(d[i], d[i + 1], d[i + 2], 0, Math.PI * 2);
          }
          c.fill();
          drew = true;
        }
      }
      bin.buckets.clear();
      for (const fn of bin.customs) {
        c.save();
        fn(c);
        c.restore();
        drew = true;
      }
      bin.customs.length = 0;
      if (extraPerBin) {
        c.globalCompositeOperation = "lighter";
        extraPerBin(c, bi);
        drew = true;
      }
      if (!drew) continue;
      c.setTransform(1, 0, 0, 1, 0, 0);
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "lighter";
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.globalAlpha = Math.min(1, this.binGain(bin.lvl));
      if (bin.lvl > 0) {
        const t = bin.tctx;
        t.setTransform(1, 0, 0, 1, 0, 0);
        t.globalCompositeOperation = "source-over";
        t.clearRect(0, 0, bin.tmp.width, bin.tmp.height);
        t.filter = `blur(${(bin.lvl * k).toFixed(2)}px)`;
        t.drawImage(bin.canvas, 0, 0);
        t.filter = "none";
        ctx.drawImage(bin.tmp, 0, 0, this.pw, this.ph);
      } else {
        ctx.drawImage(bin.canvas, 0, 0, this.pw, this.ph);
      }
      ctx.restore();
    }
  }

  get binLevels() {
    return this.bins.map((b) => b.lvl);
  }

  /** Cheap glow: downsample, blur, add back. */
  bloom(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, strength: number, radius = 5) {
    const a = this.bloomA;
    const b = this.bloomB;
    a.ctx.setTransform(1, 0, 0, 1, 0, 0);
    a.ctx.globalCompositeOperation = "source-over";
    a.ctx.clearRect(0, 0, a.c.width, a.c.height);
    a.ctx.drawImage(canvas, 0, 0, a.c.width, a.c.height);
    b.ctx.clearRect(0, 0, b.c.width, b.c.height);
    b.ctx.filter = `blur(${(radius * this.q * 2).toFixed(2)}px)`;
    b.ctx.drawImage(a.c, 0, 0);
    b.ctx.filter = "none";
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = strength;
    ctx.drawImage(b.c, 0, 0, this.pw, this.ph);
    ctx.restore();
  }
}

/** Pre-rendered radial glow sprite. */
export const makeGlowSprite = (stops: [number, string][], size = 256) => {
  const { c, ctx } = mk(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) g.addColorStop(o, col);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
};

/** Tileable film-grain texture. */
export const makeGrain = (rnd: () => number, size = 256) => {
  const { c, ctx } = mk(size, size);
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(rnd() * 255);
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

export const applyGrain = (
  ctx: CanvasRenderingContext2D,
  grain: HTMLCanvasElement,
  q: number,
  frame: number,
  alpha: number,
) => {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const pat = ctx.createPattern(grain, "repeat")!;
  const ox = (frame * 97) % 256;
  const oy = (frame * 61) % 256;
  const m = new DOMMatrix([Math.max(1, q * 2), 0, 0, Math.max(1, q * 2), ox, oy]);
  pat.setTransform(m);
  ctx.globalCompositeOperation = "overlay";
  ctx.globalAlpha = alpha;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
};

export const applyVignette = (ctx: CanvasRenderingContext2D, strength: number) => {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.35, w / 2, h / 2, w * 0.62);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
};

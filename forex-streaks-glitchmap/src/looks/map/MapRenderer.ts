import { FONT_MONO } from "../../lib/fonts";
import { clamp, loopFrame, smoothstep } from "../../lib/loop";
import { hash01, hash32 } from "../../lib/rand";
import { buildLandGrid, COLS, ROWS } from "./landMask";

// ---------------------------------------------------------------------------
// Glitch Dot Map: Canvas 2D, a pre-rendered glyph atlas and drawImage().
// Every value is a pure function of the loop frame (frame % 600).
// ---------------------------------------------------------------------------

/** 24 glyphs: digits, symbols. No letters that could spell words. */
const CHARS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "-", ":", ".", "/", "×", "o", "=", "<", ">", "^", "v", "|", "·"];
const NG = CHARS.length;
const G_PLUS = CHARS.indexOf("+");
const G_RING = CHARS.indexOf("o");
const G_DASH = CHARS.indexOf("-");
const G_EQ = CHARS.indexOf("=");
const G_DOT = CHARS.indexOf(".");

const DENSE = ["0", "8", "6", "9", "×", "+", "=", "o", "0", "8"].map((c) => CHARS.indexOf(c));

const SEED = 0x4d41_5001;

// ---- event schedules (all periods divide 600 frames) ----------------------
const SHIFT_SLOT = 24; // 25 slots per loop
const SHIFT_FIRE = 0.68; // 25 * 0.68 = one shift every ~1.2 s on average
const FLICKER_SLOT = 20; // 30 slots per loop
const FLARE_COUNT = 48;
const FLARE_LIFE = 80; // ~2.7 s
const DISSOLVE_PERIOD = 200; // 3 per loop (6.67 s)
const DISSOLVE_START = 90;
const SCATTER = 20;
const HOLD = 15;
const REFORM = 25;

interface Band {
  y: number; // 4K px
  h: number;
  dx: number;
}

const shiftBands = (f: number): Band[] => {
  const slot = Math.floor(f / SHIFT_SLOT);
  if (hash01(SEED, slot, 1) >= SHIFT_FIRE) return [];
  const t = f - slot * SHIFT_SLOT;
  const bands: Band[] = [];
  const count = hash01(SEED, slot, 8) < 0.35 ? 2 : 1;
  for (let b = 0; b < count; b++) {
    const start = Math.floor(hash01(SEED, slot, 2) * 18) + b;
    const dur = 2 + Math.floor(hash01(SEED, slot, 3 + b * 10) * 4); // 2..5 frames
    if (t < start || t >= start + dur) continue;
    bands.push({
      y: hash01(SEED, slot, 4 + b * 10) * 2100,
      h: 8 + hash01(SEED, slot, 5 + b * 10) * 52, // 8..60 px
      dx: (20 + hash01(SEED, slot, 6 + b * 10) * 100) * (hash01(SEED, slot, 7 + b * 10) < 0.5 ? -1 : 1), // 20..120 px
    });
  }
  return bands;
};

/** Per cell-row brightness multiplier (flicker rows drop to 20% for 2-4 frames). */
const flickerRows = (f: number, rowMul: Float32Array): void => {
  rowMul.fill(1);
  const slot = Math.floor(f / FLICKER_SLOT);
  if (hash01(SEED, slot, 20) >= 0.6) return;
  const t = f - slot * FLICKER_SLOT;
  const start = Math.floor(hash01(SEED, slot, 21) * 16);
  const dur = 2 + Math.floor(hash01(SEED, slot, 22) * 3); // 2..4
  if (t < start || t >= start + dur) return;
  const n = 1 + Math.floor(hash01(SEED, slot, 23) * 3);
  for (let i = 0; i < n; i++) rowMul[Math.floor(hash01(SEED, slot, 24 + i) * ROWS)] = 0.2;
};

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number): number => t * t * (3 - 2 * t);

interface Flare {
  start: number;
  cx: number; // 0..1 of frame
  cy: number;
  glyph: number;
  peak: number;
  driftX: number; // 4K px
  driftY: number;
}
const FLARES: Flare[] = Array.from({ length: FLARE_COUNT }, (_, j) => ({
  start: Math.floor(j * (600 / FLARE_COUNT) + hash01(SEED, 100, j) * 8),
  cx: 0.04 + hash01(SEED, 101, j) * 0.92,
  cy: 0.06 + hash01(SEED, 102, j) * 0.8,
  glyph: j % 2 === 0 ? G_RING : G_PLUS,
  peak: 2.6 + hash01(SEED, 103, j) * 2,
  driftX: (hash01(SEED, 104, j) - 0.5) * 36,
  driftY: (hash01(SEED, 105, j) - 0.5) * 36,
}));

export class MapRenderer {
  readonly cw: number;
  readonly ch: number;
  private readonly s: number;
  private readonly pitchX: number;
  private readonly pitchY: number;
  private readonly gw: number;
  private readonly gh: number;
  private readonly atlas: HTMLCanvasElement; // rows: white, red, cyan
  private readonly bigAtlas: HTMLCanvasElement; // ring + plus at 3x
  private readonly layer: HTMLCanvasElement;
  private readonly lctx: CanvasRenderingContext2D;
  private readonly grainTile: HTMLCanvasElement;
  private readonly rowMul = new Float32Array(ROWS);

  // per-cell constants
  private readonly kind: Uint8Array; // 0 sea, 1 land, 2 polar dash, 3 polar speck
  private readonly density: Float32Array;
  private readonly period: Uint8Array;
  private readonly offset: Uint16Array;
  private readonly dirX: Float32Array;
  private readonly dirY: Float32Array;
  private readonly dist: Float32Array; // 4K px
  private readonly delayA: Float32Array;
  private readonly delayB: Float32Array;
  private readonly survives: Uint8Array;
  private readonly px: Int32Array; // cell top-left on canvas
  private readonly py: Int32Array;

  /** Instrumentation for timing. */
  lastGlyphCount = 0;

  constructor(cw: number, ch: number) {
    this.cw = cw;
    this.ch = ch;
    this.s = cw / 3840;
    this.pitchX = cw / COLS;
    this.pitchY = ch / ROWS;
    this.gw = Math.ceil(this.pitchX) + 1;
    this.gh = Math.ceil(this.pitchY) + 1;

    // ---- glyph atlas (pre-rendered once) ----
    const fontPx = this.pitchY * 1.0;
    const mk = (w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      return [c, c.getContext("2d")!];
    };
    const [atlas, actx] = mk(NG * this.gw, 3 * this.gh);
    this.atlas = atlas;
    const tints = ["#ffffff", "#ff2a2a", "#2ad8ff"];
    for (let v = 0; v < 3; v++) {
      actx.fillStyle = tints[v];
      actx.font = `700 ${fontPx}px "${FONT_MONO}"`;
      actx.textAlign = "center";
      actx.textBaseline = "alphabetic";
      for (let g = 0; g < NG; g++) {
        actx.fillText(CHARS[g], g * this.gw + this.gw / 2, v * this.gh + this.gh / 2 + 0.3555 * fontPx);
      }
    }
    const [big, bctx] = mk(this.gw * 3 * 2, this.gh * 3);
    this.bigAtlas = big;
    bctx.fillStyle = "#fff";
    bctx.font = `700 ${fontPx * 3}px "${FONT_MONO}"`;
    bctx.textAlign = "center";
    bctx.textBaseline = "alphabetic";
    bctx.fillText("o", this.gw * 1.5, this.gh * 1.5 + 0.3555 * fontPx * 3);
    bctx.fillText("+", this.gw * 4.5, this.gh * 1.5 + 0.3555 * fontPx * 3);

    const [layer, lctx] = mk(cw, ch);
    this.layer = layer;
    this.lctx = lctx;

    // ---- grain tile (fixed formula; offset by the loop frame at draw time) ----
    const tile = 512;
    const [gt, gctx] = mk(tile, tile);
    this.grainTile = gt;
    const block = Math.max(1, Math.round(2 * this.s)); // coarse "printout" grain
    const img = gctx.createImageData(tile, tile);
    for (let y = 0; y < tile; y++) {
      for (let x = 0; x < tile; x++) {
        const v = Math.floor(hash01(SEED + 7, Math.floor(x / block), Math.floor(y / block)) * 256);
        const o = (y * tile + x) * 4;
        img.data[o] = img.data[o + 1] = img.data[o + 2] = v;
        img.data[o + 3] = 255;
      }
    }
    gctx.putImageData(img, 0, 0);

    // ---- per-cell constants ----
    const n = COLS * ROWS;
    this.kind = new Uint8Array(n);
    this.density = new Float32Array(n);
    this.period = new Uint8Array(n);
    this.offset = new Uint16Array(n);
    this.dirX = new Float32Array(n);
    this.dirY = new Float32Array(n);
    this.dist = new Float32Array(n);
    this.delayA = new Float32Array(n);
    this.delayB = new Float32Array(n);
    this.survives = new Uint8Array(n);
    this.px = new Int32Array(n);
    this.py = new Int32Array(n);
    const { coverage, inland } = buildLandGrid();
    const bandRow = Math.round(ROWS * 0.892);
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const cov = coverage[i];
        const inl = inland[i];
        const landness = smoothstep(0.04, 0.3, cov);
        this.kind[i] = landness > 0 ? 1 : 0;
        this.density[i] = landness * (0.86 + 0.14 * smoothstep(0.25, 0.9, inl));
        // Polar edge: thin dashed band + a few rows of specks beneath it.
        if (r === bandRow || r === bandRow + 1) {
          const run = hash01(SEED, 300, Math.floor(c / 2), r) < 0.62;
          if (run) {
            this.kind[i] = 2;
            this.density[i] = 0.9;
          }
        } else if (r > bandRow + 1 && landness === 0) {
          this.kind[i] = 3; // faint dotted lattice under the polar edge
          this.density[i] = 0.62;
        } else if (r < 2 && landness === 0) {
          this.kind[i] = 3; // ... and along the very top
          this.density[i] = 0.8; // dense, tidy lattice along the very top
        }
        const h = hash32(SEED, 400, i);
        this.period[i] = 6 + (h % 15); // 6..20 frames
        this.offset[i] = (h >>> 8) % 600;
        const ang = hash01(SEED, 401, i) * Math.PI * 2;
        // outward from the map centre, mixed with a random direction
        const ox = (c + 0.5) / COLS - 0.5;
        const oy = ((r + 0.5) / ROWS - 0.5) * 0.6;
        const ol = Math.hypot(ox, oy) || 1;
        const dxv = (ox / ol) * 0.55 + Math.cos(ang) * 0.9;
        const dyv = (oy / ol) * 0.55 + Math.sin(ang) * 0.9;
        const dl = Math.hypot(dxv, dyv) || 1;
        this.dirX[i] = dxv / dl;
        this.dirY[i] = dyv / dl;
        this.dist[i] = 70 + hash01(SEED, 402, i) ** 1.6 * 520;
        this.delayA[i] = hash01(SEED, 403, i);
        this.delayB[i] = hash01(SEED, 404, i);
        this.survives[i] = hash01(SEED, 405, i) < 0.14 ? 1 : 0;
        this.px[i] = Math.round((c + 0.5) * this.pitchX - this.gw / 2);
        this.py[i] = Math.round((r + 0.5) * this.pitchY - this.gh / 2);
      }
    }
  }

  /** Dissolve phase for this loop frame: returns [phase, progress] where phase 0=formed 1=scatter 2=hold 3=reform. */
  private dissolveAt(f: number): { phase: number; t: number } {
    const t = (((f - DISSOLVE_START) % DISSOLVE_PERIOD) + DISSOLVE_PERIOD) % DISSOLVE_PERIOD;
    if (f < DISSOLVE_START) return { phase: 0, t: 0 };
    if (t < SCATTER) return { phase: 1, t };
    if (t < SCATTER + HOLD) return { phase: 2, t };
    if (t < SCATTER + HOLD + REFORM) return { phase: 3, t };
    return { phase: 0, t };
  }

  /** Draw one frame into `ctx` (same size as the renderer). */
  /** `stress` > 1 re-draws every glyph that many times (timing only: the default 1 is the real frame). */
  draw(ctx: CanvasRenderingContext2D, frame: number, stress = 1): void {
    const f = loopFrame(frame);
    const { cw, ch, s, gw, gh } = this;
    const l = this.lctx;
    l.globalCompositeOperation = "source-over";
    l.globalAlpha = 1;
    l.fillStyle = "#000";
    l.fillRect(0, 0, cw, ch);
    l.globalCompositeOperation = "lighter";

    flickerRows(f, this.rowMul);
    const { phase, t: dt } = this.dissolveAt(f);
    const off = Math.max(1, Math.round(1 * s)); // colour-fringe offset: ~1 px at 4K
    let count = 0;

    for (let r = 0; r < ROWS; r++) {
      const rm = this.rowMul[r];
      for (let c = 0; c < COLS; c++) {
        const i = r * COLS + c;
        const kind = this.kind[i];
        const per = this.period[i];
        const k = Math.floor((f + this.offset[i]) / per);
        const rnd = hash32(i, k, SEED);
        let present: boolean;
        let g: number;
        let b: number;
        if (kind === 0) {
          const u = (rnd & 0xffff) / 65536;
          present = u < 0.02 || (u > 0.5 && u < 0.58); // ~1% stray symbols + a very faint dotted lattice
          const faint = u > 0.5;
          const pick = faint ? 6 : (rnd >>> 16) % 8;
          g = pick < 3 ? G_RING : pick < 5 ? G_PLUS : pick < 6 ? G_DOT : (rnd >>> 20) % NG;
          b = faint ? 0.07 + 0.06 * (((rnd >>> 8) & 0xff) / 255) : 0.55 + 0.45 * (((rnd >>> 8) & 0xff) / 255);
        } else if (kind === 2) {
          present = true;
          const q = (rnd >>> 16) % 6;
          g = q === 0 ? G_DASH : q === 1 ? G_EQ : G_DOT;
          b = 0.4 + 0.45 * (((rnd >>> 8) & 0xff) / 255);
        } else if (kind === 3) {
          present = (rnd & 0xffff) / 65536 < this.density[i];
          g = (rnd >>> 16) % 3 === 0 ? G_DASH : G_DOT;
          b = 0.16 + 0.2 * (((rnd >>> 8) & 0xff) / 255);
        } else {
          present = (rnd & 0xffff) / 65536 < this.density[i];
          const gr = (rnd >>> 16) & 0xff;
          g = gr < 150 ? DENSE[gr % DENSE.length] : gr % NG; // ink-heavy glyphs dominate, like the reference
          b = 0.35 + 0.5 * (((rnd >>> 8) & 0xff) / 255); // 35-85%
          if ((rnd >>> 24) % 60 === 0) b = 1; // rare hot glyph
        }
        if (!present) continue;

        let x = this.px[i];
        let y = this.py[i];
        let a = b * rm;

        if (phase !== 0) {
          // dissolve: seeded per-cell stagger, outward flight + fade
          let d: number;
          if (phase === 1) d = easeOutCubic(clamp((dt - this.delayA[i] * 6) / (SCATTER - 6)));
          else if (phase === 2) d = 1;
          else d = 1 - easeInOut(clamp((dt - SCATTER - HOLD - this.delayB[i] * 8) / (REFORM - 8)));
          const keep = this.survives[i] ? 0.45 : 0;
          const fade = 1 - d * (1 - keep);
          a *= fade;
          const dd = this.dist[i] * s * d;
          x += Math.round(this.dirX[i] * dd);
          y += Math.round(this.dirY[i] * dd);
          if (a < 0.02) continue;
        }

        const sx = g * gw;
        l.globalAlpha = a;
        l.drawImage(this.atlas, sx, 0, gw, gh, x, y, gw, gh);
        for (let k = 1; k < stress; k++) l.drawImage(this.atlas, sx, 0, gw, gh, x + k, y, gw, gh);
        // slight 1 px red / blue offset on bright glyphs only
        if (a > 0.72) {
          l.globalAlpha = a * 0.55;
          l.drawImage(this.atlas, sx, gh, gw, gh, x - off, y, gw, gh);
          l.drawImage(this.atlas, sx, 2 * gh, gw, gh, x + off, y, gw, gh);
          count += 2;
        }
        count++;
      }
    }

    // flare symbols: rings and plus signs scale up 2-3x, brighten and drift for ~1 s
    if (phase === 0 || phase === 3) {
      for (const fl of FLARES) {
        const u = (((f - fl.start) % 600) + 600) % 600;
        if (u >= FLARE_LIFE) continue;
        const p = u / FLARE_LIFE;
        const bump = Math.pow(Math.sin(Math.PI * p), 0.7);
        const sc = 1 + (fl.peak - 1) * bump;
        const w = gw * sc;
        const h = gh * sc;
        const cx = fl.cx * cw + fl.driftX * s * p;
        const cy = fl.cy * ch + fl.driftY * s * p;
        l.globalAlpha = 0.55 + 0.45 * bump;
        const bx = fl.glyph === G_RING ? 0 : gw * 3;
        l.drawImage(this.bigAtlas, bx, 0, gw * 3, gh * 3, Math.round(cx - w / 2), Math.round(cy - h / 2), w, h);
        count++;
      }
    }
    l.globalAlpha = 1;
    l.globalCompositeOperation = "source-over";

    // ---- composite: row shifts ----
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.drawImage(this.layer, 0, 0);
    for (const band of shiftBands(f)) {
      const y = Math.round(band.y * s);
      const h = Math.max(1, Math.round(band.h * s));
      const dx = Math.round(band.dx * s);
      ctx.fillStyle = "#000";
      ctx.fillRect(0, y, cw, h);
      ctx.drawImage(this.layer, 0, y, cw, h, dx, y, cw, h);
      ctx.drawImage(this.layer, 0, y, cw, h, dx + (dx > 0 ? -cw : cw), y, cw, h);
    }

    // ---- grain / dither: a fixed noise tile offset by the loop frame ----
    const ox = Math.floor(hash01(SEED, 500, f) * 512);
    const oy = Math.floor(hash01(SEED, 501, f) * 512);
    const tileOnce = (): void => {
      for (let y = -oy; y < ch; y += 512) for (let x = -ox; x < cw; x += 512) ctx.drawImage(this.grainTile, x, y);
    };
    ctx.globalCompositeOperation = "overlay"; // modulates lit glyphs by ~+-3%, leaves black alone
    ctx.globalAlpha = 0.07;
    tileOnce();
    ctx.globalCompositeOperation = "lighter"; // faint floor grain in the sea (<= ~2/255)
    ctx.globalAlpha = 0.008;
    tileOnce();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    this.lastGlyphCount = count;
  }
}

const cache = new Map<string, MapRenderer>();
export const getMapRenderer = (cw: number, ch: number): MapRenderer => {
  const key = `${cw}x${ch}`;
  let r = cache.get(key);
  if (!r) {
    r = new MapRenderer(cw, ch);
    cache.set(key, r);
  }
  return r;
};

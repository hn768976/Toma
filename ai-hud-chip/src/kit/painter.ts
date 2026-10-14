import * as THREE from "three";

/**
 * HUD painter — Canvas 2D drawn ONCE into two canvases that are packed into
 * one RGBA texture:
 *
 *   R  line / text intensity     (drawn in pure red, additive)
 *   G  block-cell fill intensity (drawn in pure green, additive)
 *   B  reveal time × coverage    (time canvas, red channel)
 *   A  coverage                  (time canvas, green channel)
 *
 * The shader recovers reveal time T = B / A, so mip levels average reveal
 * times weighted by coverage. Lines that "draw on" are stroked in short
 * segments whose time grows along the path; text gets a time per character.
 * Times are 0..1 in the texture's own build timeline (mapped by uniforms).
 */
export class Painter {
  readonly w: number;
  readonly h: number;
  readonly c: CanvasRenderingContext2D;
  readonly t: CanvasRenderingContext2D;
  private cCanvas: HTMLCanvasElement;
  private tCanvas: HTMLCanvasElement;
  texture: THREE.DataTexture | null = null;
  private data: Uint8Array | null = null;

  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.cCanvas = document.createElement("canvas");
    this.tCanvas = document.createElement("canvas");
    this.cCanvas.width = this.tCanvas.width = w;
    this.cCanvas.height = this.tCanvas.height = h;
    this.c = this.cCanvas.getContext("2d", { willReadFrequently: true })!;
    this.t = this.tCanvas.getContext("2d", { willReadFrequently: true })!;
    this.clear();
  }

  /** Draw in a design space scaled by `s` (canvas px = design units × s). */
  setScale(s: number) {
    this.scale = s;
    this.c.setTransform(s, 0, 0, s, 0, 0);
    this.t.setTransform(s, 0, 0, s, 0, 0);
  }

  scale = 1;

  clear() {
    for (const ctx of [this.c, this.t]) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, this.w, this.h);
    }
    this.c.globalCompositeOperation = "lighter";
    this.setScale(this.scale);
  }

  /** Time colour for the time canvas (R = time, G = full coverage). */
  private tc(time: number) {
    const g = 1 + Math.round(Math.min(1, Math.max(0, time)) * 254);
    return `rgb(${g},255,0)`;
  }

  private lineStyle(width: number, alpha: number) {
    this.c.lineWidth = this.t.lineWidth = width;
    this.c.lineCap = this.t.lineCap = "butt";
    this.c.lineJoin = this.t.lineJoin = "miter";
    this.c.strokeStyle = `rgba(255,0,0,${alpha})`;
  }

  /** A polyline that draws on from its first point between times t0 and t1. */
  path(pts: [number, number][], t0: number, t1: number, width = 2, alpha = 1, step = 6) {
    this.lineStyle(width, alpha);
    this.c.beginPath();
    this.c.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) this.c.lineTo(pts[i][0], pts[i][1]);
    this.c.stroke();
    // time canvas: short overlapping segments with increasing time
    let total = 0;
    const lens: number[] = [];
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(l);
      total += l;
    }
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      const l = lens[i - 1];
      const n = Math.max(1, Math.ceil(l / step));
      for (let k = 0; k < n; k++) {
        const s0 = k / n;
        const s1 = Math.min(1, (k + 1) / n + 0.6 / Math.max(1, l));
        const along = (acc + l * s0) / Math.max(1e-6, total);
        this.t.strokeStyle = this.tc(t0 + (t1 - t0) * along);
        this.t.beginPath();
        this.t.moveTo(ax + (bx - ax) * s0, ay + (by - ay) * s0);
        this.t.lineTo(ax + (bx - ax) * s1, ay + (by - ay) * s1);
        this.t.stroke();
      }
      acc += l;
    }
  }

  line(x1: number, y1: number, x2: number, y2: number, t0: number, t1: number, width = 2, alpha = 1) {
    this.path([[x1, y1], [x2, y2]], t0, t1, width, alpha);
  }

  /** Cubic bezier connector (sampled), drawn on from its start. */
  bezier(p0: [number, number], p1: [number, number], p2: [number, number], p3: [number, number], t0: number, t1: number, width = 2, alpha = 1) {
    const pts: [number, number][] = [];
    const N = 64;
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      const u = 1 - s;
      pts.push([
        u * u * u * p0[0] + 3 * u * u * s * p1[0] + 3 * u * s * s * p2[0] + s * s * s * p3[0],
        u * u * u * p0[1] + 3 * u * u * s * p1[1] + 3 * u * s * s * p2[1] + s * s * s * p3[1],
      ]);
    }
    this.path(pts, t0, t1, width, alpha, 4);
  }

  /** Arc (angles in radians), drawn on from a0 to a1. */
  arc(cx: number, cy: number, r: number, a0: number, a1: number, t0: number, t1: number, width = 2, alpha = 1) {
    const n = Math.max(8, Math.ceil((Math.abs(a1 - a0) * r) / 5));
    const pts: [number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    this.path(pts, t0, t1, width, alpha, 5);
  }

  /**
   * A frame whose outline grows out of one corner in both directions.
   * `bevel` cuts the opposite corner (HUD style). Corner ticks drawn on top.
   */
  frame(x: number, y: number, w: number, h: number, t0: number, t1: number, opts: { width?: number; alpha?: number; bevel?: number; ticks?: number; corner?: 0 | 1 | 2 | 3 } = {}) {
    const { width = 2, alpha = 1, bevel = 0, ticks = 0, corner = 0 } = opts;
    // corners clockwise from top-left; bevel on bottom-right
    const tl: [number, number] = [x, y];
    const tr: [number, number] = [x + w, y];
    const br1: [number, number] = [x + w, y + h - bevel];
    const br2: [number, number] = [x + w - bevel, y + h];
    const bl: [number, number] = [x, y + h];
    const loop: [number, number][] = bevel > 0 ? [tl, tr, br1, br2, bl] : [tl, tr, [x + w, y + h], bl];
    const startIdx = corner === 0 ? 0 : corner === 1 ? 1 : corner === 2 ? (bevel > 0 ? 2 : 2) : loop.length - 1;
    const n = loop.length;
    const cw: [number, number][] = [];
    const ccw: [number, number][] = [];
    // walk halfway around each way
    const half = Math.ceil(n / 2);
    for (let i = 0; i <= half; i++) cw.push(loop[(startIdx + i) % n]);
    for (let i = 0; i <= n - half; i++) ccw.push(loop[(startIdx - i + n * 2) % n]);
    this.path(cw, t0, t1, width, alpha);
    this.path(ccw, t0, t1, width, alpha);
    if (ticks > 0) {
      const tt = t1;
      const tw = width * 2.2;
      for (const [cx, cy, dx, dy] of [
        [x, y, 1, 1],
        [x + w, y, -1, 1],
        [x, y + h, 1, -1],
      ] as const) {
        this.line(cx - dx * 4, cy, cx + dx * ticks, cy, tt, tt + 0.02, tw, alpha);
        this.line(cx, cy - dy * 4, cx, cy + dy * ticks, tt, tt + 0.02, tw, alpha);
      }
    }
  }

  /** Filled cell (green channel = pale fill colour) that pops in at `time`. */
  fill(x: number, y: number, w: number, h: number, time: number, alpha = 1) {
    this.c.fillStyle = `rgba(0,255,0,${alpha})`;
    this.c.fillRect(x, y, w, h);
    this.t.fillStyle = this.tc(time);
    this.t.fillRect(x, y, w, h);
  }

  /** Solid line-colour block (red channel), e.g. progress bars. */
  bar(x: number, y: number, w: number, h: number, t0: number, t1: number, alpha = 1) {
    this.c.fillStyle = `rgba(255,0,0,${alpha})`;
    this.c.fillRect(x, y, w, h);
    const n = Math.max(1, Math.ceil(w / 6));
    for (let k = 0; k < n; k++) {
      this.t.fillStyle = this.tc(t0 + ((t1 - t0) * k) / n);
      this.t.fillRect(x + (w * k) / n, y, w / n + 0.7, h);
    }
  }

  dot(x: number, y: number, r: number, time: number, alpha = 1, ring = false) {
    this.c.fillStyle = `rgba(255,0,0,${alpha})`;
    this.c.strokeStyle = `rgba(255,0,0,${alpha})`;
    this.t.fillStyle = this.t.strokeStyle = this.tc(time);
    for (const ctx of [this.c, this.t]) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      if (ring) {
        ctx.lineWidth = Math.max(1.5, r * 0.3);
        ctx.stroke();
      } else ctx.fill();
    }
  }

  /** Text typed in character by character between t0 and t1. */
  text(str: string, x: number, y: number, font: string, t0: number, t1: number, alpha = 1, opts: { channel?: "line" | "fill"; spacing?: number } = {}) {
    const { channel = "line", spacing = 0 } = opts;
    this.c.font = this.t.font = font;
    this.c.textBaseline = this.t.textBaseline = "alphabetic";
    this.c.fillStyle = channel === "line" ? `rgba(255,0,0,${alpha})` : `rgba(0,255,0,${alpha})`;
    let cx = x;
    const n = str.length;
    for (let i = 0; i < n; i++) {
      const ch = str[i];
      const adv = this.c.measureText(ch).width + spacing;
      if (ch !== " ") {
        this.c.fillText(ch, cx, y);
        this.t.fillStyle = this.tc(t0 + ((t1 - t0) * i) / Math.max(1, n - 1));
        this.t.fillText(ch, cx, y);
      }
      cx += adv;
    }
    return cx - x;
  }

  /** Text that appears all at once. */
  label(str: string, x: number, y: number, font: string, time: number, alpha = 1, align: CanvasTextAlign = "left") {
    this.c.font = this.t.font = font;
    this.c.textAlign = this.t.textAlign = align;
    this.c.fillStyle = `rgba(255,0,0,${alpha})`;
    this.t.fillStyle = this.tc(time);
    this.c.fillText(str, x, y);
    this.t.fillText(str, x, y);
    this.c.textAlign = this.t.textAlign = "left";
  }

  /** Pack both canvases into one RGBA texture (mipmapped, anisotropic). */
  pack(anisotropy = 8): THREE.DataTexture {
    const cd = this.c.getImageData(0, 0, this.w, this.h).data;
    const td = this.t.getImageData(0, 0, this.w, this.h).data;
    if (!this.data) this.data = new Uint8Array(this.w * this.h * 4);
    const out = this.data;
    // canvas rows are top-down; flip so uv (0,0) is bottom-left
    for (let y = 0; y < this.h; y++) {
      const src = y * this.w * 4;
      const dst = (this.h - 1 - y) * this.w * 4;
      for (let x = 0; x < this.w * 4; x += 4) {
        out[dst + x] = cd[src + x];
        out[dst + x + 1] = cd[src + x + 1];
        out[dst + x + 2] = td[src + x];
        out[dst + x + 3] = td[src + x + 1];
      }
    }
    if (!this.texture) {
      const tex = new THREE.DataTexture(out, this.w, this.h, THREE.RGBAFormat, THREE.UnsignedByteType);
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      tex.anisotropy = anisotropy;
      tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
      tex.colorSpace = THREE.NoColorSpace;
      this.texture = tex;
    }
    this.texture.needsUpdate = true;
    return this.texture;
  }
}

/** Plain colour canvas → mipmapped texture (no time channel). */
export const canvasTexture = (canvas: HTMLCanvasElement, anisotropy = 8) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = anisotropy;
  tex.colorSpace = THREE.NoColorSpace;
  tex.premultiplyAlpha = false;
  return tex;
};

export const makeCanvas = (w: number, h: number) => {
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d")!;
  return { cv, ctx };
};

/**
 * A small HUD text texture redrawn whenever its string changes (ticking
 * numbers, scrambling letters). The string is a pure function of the frame,
 * so the texture is too.
 */
export class LiveLabel {
  readonly painter: Painter;
  private last: string | null = null;
  constructor(
    w: number,
    h: number,
    private font: string,
    private align: CanvasTextAlign = "left",
    private glow = 0,
  ) {
    this.painter = new Painter(w, h);
  }
  draw(str: string) {
    if (str === this.last && this.painter.texture) return this.painter.texture;
    this.last = str;
    const p = this.painter;
    p.clear();
    const x = this.align === "center" ? p.w / 2 : this.align === "right" ? p.w - 4 : 4;
    if (this.glow > 0) {
      p.c.save();
      p.c.shadowColor = "rgba(255,0,0,0.9)";
      p.c.shadowBlur = this.glow;
      p.label(str, x, p.h * 0.72, this.font, 0, 0.6, this.align);
      p.c.restore();
    }
    p.label(str, x, p.h * 0.72, this.font, 0, 1, this.align);
    return p.pack(4);
  }
}

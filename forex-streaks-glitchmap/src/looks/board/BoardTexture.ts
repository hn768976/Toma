import * as THREE from "three";
import { FONT_DISPLAY, FONT_MONO, FONT_NUMBERS } from "../../lib/fonts";
import { clamp, loopFrame, LOOP_FRAMES } from "../../lib/loop";
import { hash01, loopNoise } from "../../lib/rand";
import { BoardPalette, ROWS, ROW_SPECS, RowSpec } from "./data";

// The board tile: 8 rows, drawn at 4096 x 4096 (or 2048 x 2048 for <= 1440p
// output), redrawn every frame from the loop frame only. The shader repeats it.

const TILE = 4096;
const ROW_H = TILE / ROWS; // 512

const SPARK_SAMPLES = 44; // visible samples
const SPARK_PERIOD = 10; // frames per new sample
const SPARK_PER_LOOP = LOOP_FRAMES / SPARK_PERIOD; // 60 -> whole loop
const SWEEP_PERIOD = 60; // a highlight sweep about every 2 s (10 per loop)
const SWEEP_LEN = 42;

/** Big value: tiny steps every tickPeriod frames, a function of the frame only. */
const tickValue = (s: RowSpec, f: number): number => {
  const q = Math.floor((f + s.tickOffset) / s.tickPeriod);
  const tickFrame = q * s.tickPeriod - s.tickOffset;
  const ph = ((((tickFrame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES)) / LOOP_FRAMES;
  const n = 0.75 * loopNoise(s.seed, ph, 1.5) + 0.25 * loopNoise(s.seed + 1, ph, 5);
  return s.base * (1 + s.amp * n);
};

/** Sparkline sample i (any integer; periodic every SPARK_PER_LOOP). */
const sparkSample = (s: RowSpec, i: number): number => {
  const m = ((i % SPARK_PER_LOOP) + SPARK_PER_LOOP) % SPARK_PER_LOOP;
  const ph = m / SPARK_PER_LOOP;
  return 0.55 * loopNoise(s.seed + 3, ph, 1.15) + 0.28 * loopNoise(s.seed + 4, ph, 3.2) + 0.17 * loopNoise(s.seed + 5, ph, 9);
};

const hex = (c: string, a: number): string => {
  const n = parseInt(c.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export class BoardTexture {
  readonly canvas: HTMLCanvasElement;
  readonly texture: THREE.CanvasTexture;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly k: number;
  /** Instrumentation for timing. */
  lastDrawMs = 0;

  constructor(readonly size: number, private readonly palette: BoardPalette) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = size;
    this.canvas.height = size;
    this.ctx = this.canvas.getContext("2d", { alpha: false })!;
    this.k = size / TILE;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.wrapS = this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = true;
  }

  draw(frame: number): void {
    const t0 = performance.now();
    const f = loopFrame(frame);
    const { ctx, k, palette: P } = this;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    for (let r = 0; r < ROWS; r++) {
      const y0 = r * ROW_H;
      const spec = ROW_SPECS[r];
      // ---- row background + hairline ----
      const bg = ctx.createLinearGradient(0, y0, 0, y0 + ROW_H);
      bg.addColorStop(0, P.baseTop);
      bg.addColorStop(1, P.baseBottom);
      ctx.fillStyle = bg;
      ctx.fillRect(0, y0, TILE, ROW_H);
      ctx.fillStyle = "rgba(255,255,255,0.03)";
      ctx.fillRect(0, y0 + ROW_H - 3, TILE, 3);

      this.drawRow(r, spec, y0, f);
    }

    // ---- highlight sweep: a soft brighter band crosses one row about every 2 s ----
    const j = Math.floor(f / SWEEP_PERIOD);
    const st = f - j * SWEEP_PERIOD;
    if (st < SWEEP_LEN) {
      const row = Math.floor(hash01(0x5eec, j) * ROWS);
      const p = st / SWEEP_LEN;
      const cx = -300 + (TILE + 600) * p;
      const grad = ctx.createLinearGradient(cx - 520, 0, cx + 520, 0);
      grad.addColorStop(0, "rgba(160,190,255,0)");
      grad.addColorStop(0.5, "rgba(160,190,255,0.17)");
      grad.addColorStop(1, "rgba(160,190,255,0)");
      ctx.globalCompositeOperation = "lighter";
      ctx.fillStyle = grad;
      ctx.fillRect(cx - 520, row * ROW_H + 3, 1040, ROW_H - 6);
      ctx.globalCompositeOperation = "source-over";
    }

    this.texture.needsUpdate = true;
    this.lastDrawMs = performance.now() - t0;
  }

  private drawRow(r: number, s: RowSpec, y0: number, f: number): void {
    const { ctx, palette: P } = this;
    const value = tickValue(s, f);
    const d = value - s.base * (1 - P.bias * s.amp);
    const up = d >= 0;
    const col = up ? P.up : P.down;
    const sign = up ? "+" : "-";
    const pct = (d / s.base) * 100;
    const set = (font: string, color: string, spacing = "0px"): void => {
      ctx.font = font;
      ctx.fillStyle = color;
      ctx.letterSpacing = spacing;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
    };

    // name + invented code
    set(`600 64px "${FONT_DISPLAY}"`, "rgba(214,222,242,0.88)", "6px");
    ctx.fillText(s.pair, 170, y0 + 200);
    set(`500 40px "${FONT_DISPLAY}"`, "rgba(105,115,145,0.8)", "4px");
    ctx.fillText(s.sub, 170, y0 + 262);

    // big value
    set(`500 164px "${FONT_NUMBERS}"`, "rgba(240,244,255,0.92)", "-2px");
    ctx.fillText(value.toFixed(s.decimals), 760, y0 + 300);

    // delta (triangle drawn as a path: no glyph dependency), percent
    ctx.fillStyle = col;
    ctx.beginPath();
    if (up) {
      ctx.moveTo(1572, y0 + 232);
      ctx.lineTo(1622, y0 + 232);
      ctx.lineTo(1597, y0 + 190);
    } else {
      ctx.moveTo(1572, y0 + 190);
      ctx.lineTo(1622, y0 + 190);
      ctx.lineTo(1597, y0 + 232);
    }
    ctx.closePath();
    ctx.fill();
    set(`500 74px "${FONT_NUMBERS}"`, col, "0px");
    ctx.fillText(`${sign}${Math.abs(d).toFixed(s.decimals)}`, 1650, y0 + 236);
    set(`500 74px "${FONT_NUMBERS}"`, col, "0px");
    ctx.fillText(`${sign}${Math.abs(pct).toFixed(2)}%`, 2130, y0 + 236);

    // two tiny rows of dim secondary values
    const sec = (label: string, v: number, x: number, y: number): void => {
      set(`400 44px "${FONT_MONO}"`, "rgba(100,110,140,0.85)", "0px");
      ctx.fillText(label, x, y0 + y);
      set(`400 48px "${FONT_NUMBERS}"`, "rgba(195,203,226,0.8)", "0px");
      ctx.fillText(v.toFixed(s.decimals), x + 190, y0 + y);
    };
    sec("OPN", s.base * 0.9994, 1572, 332);
    sec("CLS", s.base * 1.0004, 2030, 332);
    sec("HGH", s.base * 1.0021, 1572, 404);
    sec("LOW", s.base * 0.9978, 2030, 404);

    // sparkline
    const i0 = Math.floor(f / SPARK_PERIOD);
    const X0 = 2560;
    const X1 = 3540;
    const YT = y0 + 120;
    const YB = y0 + 400;
    const pts: number[] = [];
    let mn = Infinity;
    let mx = -Infinity;
    for (let n = 0; n < SPARK_SAMPLES; n++) {
      const v = sparkSample(s, i0 - (SPARK_SAMPLES - 1) + n);
      pts.push(v);
      mn = Math.min(mn, v);
      mx = Math.max(mx, v);
    }
    const span = Math.max(0.2, mx - mn);
    const yOf = (v: number): number => YB - 16 - ((v - mn) / span) * (YB - YT - 32);
    const xOf = (n: number): number => X0 + ((X1 - X0) * n) / (SPARK_SAMPLES - 1);
    ctx.beginPath();
    ctx.moveTo(xOf(0), YB);
    for (let n = 0; n < SPARK_SAMPLES; n++) ctx.lineTo(xOf(n), yOf(pts[n]));
    ctx.lineTo(xOf(SPARK_SAMPLES - 1), YB);
    ctx.closePath();
    const fill = ctx.createLinearGradient(0, YT, 0, YB);
    fill.addColorStop(0, hex(P.sparkHigh, 0.42));
    fill.addColorStop(1, hex(P.sparkLow, 0.05));
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.beginPath();
    for (let n = 0; n < SPARK_SAMPLES; n++) (n === 0 ? ctx.moveTo : ctx.lineTo).call(ctx, xOf(n), yOf(pts[n]));
    ctx.strokeStyle = P.sparkHigh;
    ctx.lineWidth = 3.5;
    ctx.lineJoin = "round";
    ctx.stroke();
    // dashed baseline in red + a tiny end label
    ctx.setLineDash([22, 16]);
    ctx.strokeStyle = hex(P.baseline, 0.8);
    ctx.lineWidth = 4;
    const by = clamp(yOf(pts[0]), YT, YB);
    ctx.beginPath();
    ctx.moveTo(X0 - 20, by);
    ctx.lineTo(X1 + 10, by);
    ctx.stroke();
    ctx.setLineDash([]);
    set(`500 50px "${FONT_NUMBERS}"`, up ? P.up : P.down, "0px");
    ctx.fillText((value * (1 + 0.0004 * pts[SPARK_SAMPLES - 1])).toFixed(s.decimals), X1 + 40, clamp(yOf(pts[SPARK_SAMPLES - 1]), YT + 40, YB));

    // chip (rounded outline button; an abstract blank pill on some rows)
    ctx.lineWidth = 6;
    ctx.strokeStyle = hex(P.sparkHigh, 0.9);
    ctx.beginPath();
    ctx.roundRect(3740, y0 + 205, 290, 100, 50);
    ctx.stroke();
    if (s.chip) {
      set(`600 46px "${FONT_DISPLAY}"`, "rgba(200,218,255,0.92)", "5px");
      ctx.textAlign = "center";
      ctx.fillText(s.chip, 3885, y0 + 260);
      ctx.textAlign = "left";
    } else {
      ctx.fillStyle = hex(P.sparkHigh, 0.18);
      ctx.beginPath();
      ctx.roundRect(3790, y0 + 235, 190, 40, 20);
      ctx.fill();
    }
  }
}

import React, { useLayoutEffect, useRef } from "react";
import type { Look } from "./look.ts";
import { iso, type Projection } from "./iso.ts";
import { WIDTH, HEIGHT, LOOP, type Camera } from "./camera.ts";

// Everything smooth in the frame (paper, vignette, the soft floor shadows) is
// computed per pixel in floating point and written with ±1/255 triangular
// dither, so none of it can band. Grain (about 1%) is a fixed hash of the
// pixel and the frame, overlaid with soft-light so it also covers the machine.

/** A soft shadow on the floor, as a super-ellipse in world x/y around (x, y). */
export interface FloorShadow {
  x: number;
  y: number;
  rx: number;
  ry: number;
  strength: number;
  /** 2 = ellipse, 4+ = rounded rectangle */
  power?: number;
  feather?: number;
}

function hash(x: number, y: number, f: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(f + 1, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function parseHex(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function useScale() {
  // Remotion renders at --scale via the device pixel ratio; draw at true resolution.
  return typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
}

export const Backdrop: React.FC<{ look: Look; frame: number; camera: Camera; P: Projection; shadows: FloorShadow[] }> = ({ look, frame, camera, P, shadows }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = useScale();
  const w = Math.round(WIDTH * dpr);
  const h = Math.round(HEIGHT * dpr);
  useLayoutEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const base = parseHex(look.background);
    const vig = look.vignette;
    const sh = look.shadow;
    // floor (z = 0) affine map: screen = o + x·ex + y·ey, then the camera zoom
    const o0 = iso([0, 0, 0], P);
    const ex0 = iso([1, 0, 0], P);
    const ey0 = iso([0, 1, 0], P);
    const toPx = (p: [number, number]) => [((p[0] - camera.cx) * camera.zoom + camera.cx) * dpr, ((p[1] - camera.cy) * camera.zoom + camera.cy) * dpr];
    const o = toPx(o0);
    const ex = toPx(ex0);
    const ey = toPx(ey0);
    const a = ex[0] - o[0];
    const c = ey[0] - o[0];
    const b = ex[1] - o[1];
    const d = ey[1] - o[1];
    const det = a * d - b * c;
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const cx = w / 2;
    const cy = h / 2;
    for (let py = 0; py < h; py++) {
      const ny = (py + 0.5 - cy) / cy;
      for (let px = 0; px < w; px++) {
        const nx = (px + 0.5 - cx) / cx;
        // vignette: elliptical, smooth, only toward the edges
        const r = Math.sqrt(nx * nx * 0.82 + ny * ny);
        const t = Math.min(1, Math.max(0, (r - 0.42) / 1.0));
        const v = look.vignetteStrength * t * t * (3 - 2 * t);
        // floor coordinates of this pixel
        const sx = px + 0.5 - o[0];
        const sy = py + 0.5 - o[1];
        const wx = (d * sx - c * sy) / det;
        const wy = (-b * sx + a * sy) / det;
        let s = 0;
        for (const shadow of shadows) {
          const p = shadow.power ?? 2;
          const qx = Math.abs(wx - shadow.x) / shadow.rx;
          const qy = Math.abs(wy - shadow.y) / shadow.ry;
          if (qx > 2.2 || qy > 2.2) continue;
          const q = Math.pow(Math.pow(qx, p) + Math.pow(qy, p), 1 / p);
          const feather = shadow.feather ?? 0.9;
          const u = Math.min(1, Math.max(0, (q - (1 - feather)) / (feather * 2)));
          const fall = 1 - u * u * (3 - 2 * u);
          s = 1 - (1 - s) * (1 - shadow.strength * fall);
        }
        s *= look.shadowStrength;
        const i = (py * w + px) * 4;
        const dither = hash(px, py, f) + hash(px + 7919, py + 104729, f) - 1;
        for (let k = 0; k < 3; k++) {
          let lin = base[k];
          lin = lin + (sh[k] - lin) * s;
          lin = lin + (vig[k] - lin) * v;
          data[i + k] = Math.round(lin + dither);
        }
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [look, frame, camera, P, shadows, w, h, dpr]);
  return <canvas ref={ref} width={w} height={h} style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT }} />;
};

/** Film grain, about 1% in mid tones, from a fixed formula of pixel and frame. */
export const Grain: React.FC<{ frame: number; amount?: number }> = ({ frame, amount = 9 }) => {
  const ref = useRef<HTMLCanvasElement>(null);
  const dpr = useScale();
  const w = Math.round(WIDTH * dpr);
  const h = Math.round(HEIGHT * dpr);
  useLayoutEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const img = ctx.createImageData(w, h);
    const data = img.data;
    const f = ((frame % LOOP) + LOOP) % LOOP;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const n = hash(px + 31, py + 17, f + 977) + hash(px + 4111, py + 9973, f + 31) - 1;
        const g = Math.round(128 + n * amount);
        const i = (py * w + px) * 4;
        data[i] = g;
        data[i + 1] = g;
        data[i + 2] = g;
        data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [frame, w, h, amount]);
  return <canvas ref={ref} width={w} height={h} style={{ position: "absolute", left: 0, top: 0, width: WIDTH, height: HEIGHT, mixBlendMode: "soft-light", pointerEvents: "none" }} />;
};

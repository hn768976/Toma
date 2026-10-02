import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, getRemotionEnvironment, useCurrentFrame } from "remotion";
import { easeInCubic, easeOutCubic, hexToRgb, lerp } from "../../lib/math";
import {
  appearFront,
  clearFront,
  H,
  PARTICLES,
  POP_FRAMES,
  RADIUS,
  TILE_SCALE,
  TILES,
  VANISH_FRAMES,
  W,
} from "./layout";
import type { HexMosaicVersion } from "./versions";

const HEX_COS = [0, 1, 2, 3, 4, 5].map((i) => Math.cos(Math.PI / 6 + (i * Math.PI) / 3));
const HEX_SIN = [0, 1, 2, 3, 4, 5].map((i) => Math.sin(Math.PI / 6 + (i * Math.PI) / 3));

const makeGlowSprite = (rgb: [number, number, number]) => {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  const [r, gg, b] = rgb.map((v) => Math.round(v * 255));
  grad.addColorStop(0, `rgba(${r},${gg},${b},1)`);
  grad.addColorStop(0.18, `rgba(${r},${gg},${b},0.55)`);
  grad.addColorStop(0.5, `rgba(${r},${gg},${b},0.12)`);
  grad.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
};

/** Multiplicative film grain from (pixel, frame): black (0,0,0) stays exactly black. */
const applyTileGrain = (data: Uint8ClampedArray, w: number, h: number, frame: number) => {
  for (let y = 0; y < h; y++) {
    let i = y * w * 4;
    for (let x = 0; x < w; x++, i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if ((r | g | b) === 0) continue;
      let hsh = Math.imul(x, 0x27d4eb2d) ^ Math.imul(y, 0x165667b1) ^ Math.imul(frame + 17, 0x9e3779b1);
      hsh = Math.imul(hsh ^ (hsh >>> 15), 0x85ebca6b);
      hsh = Math.imul(hsh ^ (hsh >>> 13), 0xc2b2ae35);
      hsh ^= hsh >>> 16;
      const n = ((hsh & 0xffff) + ((hsh >>> 16) & 0xffff)) / 65535 - 1; // triangular [-1, 1]
      const k = 1 + n * 0.12;
      data[i] = r * k;
      data[i + 1] = g * k;
      data[i + 2] = b * k;
    }
  }
};

export const HexMosaic: React.FC<{ version: HexMosaicVersion }> = ({ version }) => {
  const frame = useCurrentFrame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const env = getRemotionEnvironment();
  const deviceDpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const dpr = env.isRendering ? deviceDpr : Math.min(deviceDpr, 0.5);
  const pw = Math.round(W * dpr);
  const ph = Math.round(H * dpr);

  const colors = useMemo(
    () => ({
      dark: hexToRgb(version.tileDark),
      light: hexToRgb(version.tileLight),
      flash: hexToRgb(version.flash),
    }),
    [version],
  );
  const sprite = useMemo(() => makeGlowSprite(colors.flash), [colors]);

  useLayoutEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, pw, ph);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const glows: Array<[number, number, number, number]> = [];
    const { dark, light, flash } = colors;

    for (const t of TILES) {
      let alpha = 0;
      let scale = 1;
      let fl = 0;
      if (frame < t.tA) {
        if (frame >= 1 && t.early >= 0 && Math.abs(frame - t.early) < 3) {
          fl = 1 - Math.abs(frame - t.early) / 3;
          alpha = fl;
          scale = 0.7;
        }
      } else if (frame < t.tD + VANISH_FRAMES) {
        const k = (frame - t.tA) / POP_FRAMES;
        alpha = Math.min(1, k * 2.5);
        if (k < 1) {
          scale = 0.9 + 0.1 * easeOutCubic(k);
          fl = Math.pow(1 - k, 1.5) * t.popFlash;
        }
        for (const s of t.sparkles) fl = Math.max(fl, 1 - Math.abs(frame - s) / 3);
        if (frame >= t.tD) {
          const v = (frame - t.tD) / VANISH_FRAMES;
          fl = Math.max(fl, Math.sin(Math.PI * Math.min(1, v * 1.7)) * t.clearFlash);
          alpha *= 1 - easeInCubic(v);
          scale *= 1 - 0.3 * easeInCubic(v);
        }
      }
      if (alpha <= 0.002) continue;
      const shimmer = 1 + 0.09 * Math.sin((2 * Math.PI * frame) / 36 + t.shimmerPhase);
      const b = t.bright * shimmer;
      const r = lerp(lerp(dark[0], light[0], t.shade) * b, flash[0], fl);
      const g = lerp(lerp(dark[1], light[1], t.shade) * b, flash[1], fl);
      const bl = lerp(lerp(dark[2], light[2], t.shade) * b, flash[2], fl);
      ctx.globalAlpha = Math.min(1, alpha);
      ctx.fillStyle = `rgb(${Math.round(Math.min(1, r) * 255)},${Math.round(Math.min(1, g) * 255)},${Math.round(
        Math.min(1, bl) * 255,
      )})`;
      const rad = RADIUS * TILE_SCALE * scale;
      ctx.beginPath();
      ctx.moveTo(t.x + HEX_COS[0] * rad, t.y + HEX_SIN[0] * rad);
      for (let i = 1; i < 6; i++) ctx.lineTo(t.x + HEX_COS[i] * rad, t.y + HEX_SIN[i] * rad);
      ctx.closePath();
      ctx.fill();
      if (fl > 0.3) glows.push([t.x, t.y, fl * alpha, RADIUS * 4.2]);
    }

    ctx.globalCompositeOperation = "lighter";
    for (const [x, y, a, s] of glows) {
      ctx.globalAlpha = Math.min(1, a * 0.7);
      ctx.drawImage(sprite, x - s / 2, y - s / 2, s, s);
    }

    // Sparkle particles riding the spreading fronts.
    for (const p of PARTICLES) {
      const age = frame - p.birth;
      if (age < 0 || age > p.life) continue;
      const front = p.phase === "appear" ? appearFront(p.theta, frame) : clearFront(p.theta, frame);
      const r = Math.max(0, front + p.offset + age * p.drift);
      const x = W / 2 + Math.cos(p.theta) * r;
      const y = H / 2 + Math.sin(p.theta) * r;
      const a = Math.sin((Math.PI * age) / p.life) * p.bright;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(sprite, x - p.size * 3, y - p.size * 3, p.size * 6, p.size * 6);
      ctx.fillStyle = "#fff";
      ctx.fillRect(x - p.size / 3, y - p.size / 3, (p.size * 2) / 3, (p.size * 2) / 3);
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    // Grain on lit pixels only.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const img = ctx.getImageData(0, 0, pw, ph);
    applyTileGrain(img.data, pw, ph, frame);
    ctx.putImageData(img, 0, 0);
  }, [frame, colors, sprite, dpr, pw, ph]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} width={pw} height={ph} style={{ width: W, height: H }} />
    </AbsoluteFill>
  );
};

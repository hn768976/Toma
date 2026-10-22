import {
  CanvasTexture,
  LinearMipmapLinearFilter,
  NearestFilter,
  SRGBColorSpace,
} from "three";
import { Palette } from "./palette";
import { mulberry32 } from "./random";

const TEX_W = 512;
const TEX_H = 680;

export type GlassTextureSet = {
  // Colour of the cabinet interior seen through the smoked glass.
  base: CanvasTexture;
  // LED intensity (core + glow), filtered and mipmapped.
  leds: CanvasTexture;
  // Per-LED data: G = blink phase, B = colour index. Sampled with
  // NearestFilter so neighbouring texels never blend into a different LED.
  ledMeta: CanvasTexture;
};

const hexToRgb = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255] as const;
};

const shade = (hex: string, amount: number) => {
  const [r, g, b] = hexToRgb(hex);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(c * amount)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
};

// Draws one glass door: two panes split by a seam, a stack of rack-mounted
// units behind each pane, LED clusters on the units and faint diagonal
// reflections on the glass.
export const makeGlassTextures = (
  palette: Palette,
  seed: number,
): GlassTextureSet => {
  const weights = palette.leds.map((led) => led.weight);
  const rand = mulberry32(seed);
  const baseCanvas = document.createElement("canvas");
  baseCanvas.width = TEX_W;
  baseCanvas.height = TEX_H;
  const ledCanvas = document.createElement("canvas");
  ledCanvas.width = TEX_W;
  ledCanvas.height = TEX_H;
  const b = baseCanvas.getContext("2d")!;
  const l = ledCanvas.getContext("2d")!;
  const metaCanvas = document.createElement("canvas");
  metaCanvas.width = TEX_W;
  metaCanvas.height = TEX_H;
  const meta = metaCanvas.getContext("2d")!;

  b.fillStyle = palette.glassBase;
  b.fillRect(0, 0, TEX_W, TEX_H);
  l.fillStyle = "rgb(0,0,0)";
  l.fillRect(0, 0, TEX_W, TEX_H);

  const paneW = TEX_W / 2;
  for (let pane = 0; pane < 2; pane++) {
    const x0 = pane * paneW + 14;
    const w = paneW - 28;
    let y = 18 + rand() * 10;
    while (y < TEX_H - 30) {
      const h = 22 + Math.floor(rand() * 4) * 12;
      const blank = rand() < 0.16;
      const tone = blank ? 0.7 : 0.9 + rand() * 0.18;
      b.fillStyle = shade(palette.glassInterior, tone);
      b.fillRect(x0, y, w, h - 4);
      // shelf edge highlight
      b.fillStyle = shade(palette.glassInterior, tone * 1.1);
      b.fillRect(x0, y, w, 1);

      if (!blank) {
        const rows = Math.max(1, Math.floor((h - 6) / 16));
        for (let r = 0; r < rows; r++) {
          const ly = y + 9 + r * 16;
          // LED clusters at both ends of the unit, sometimes in the middle
          const clusters: number[] = [x0 + 10 + rand() * 18, x0 + w - 30 - rand() * 18];
          if (rand() < 0.3) clusters.push(x0 + w * (0.35 + rand() * 0.3));
          for (const cx of clusters) {
            if (rand() < 0.4) continue;
            const count = rand() < 0.7 ? 2 : 1;
            for (let k = 0; k < count; k++) {
              drawLed(l, meta, cx + k * 12, ly, rand, weights);
            }
          }
        }
      }
      y += h;
    }
  }

  // Pane seam + inner pane frames
  b.fillStyle = shade(palette.glassStreak, 0.9);
  b.fillRect(TEX_W / 2 - 1.5, 0, 3, TEX_H);
  b.strokeStyle = shade(palette.glassStreak, 0.6);
  b.lineWidth = 2;
  b.strokeRect(1, 1, TEX_W - 2, TEX_H - 2);

  // Reflections on the glass: soft vertical sheen + thin diagonal streaks
  const sheen = b.createLinearGradient(0, 0, TEX_W, TEX_H);
  sheen.addColorStop(0, "rgba(255,255,255,0.05)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(255,255,255,0.04)");
  b.fillStyle = sheen;
  b.fillRect(0, 0, TEX_W, TEX_H);
  b.strokeStyle = palette.glassStreak;
  b.lineCap = "round";
  for (let i = 0; i < 3; i++) {
    const sx = rand() * TEX_W;
    const ex = sx + (rand() - 0.5) * TEX_W * 1.6;
    // soft wide band with a slightly brighter core
    for (const [width, alpha] of [[18, 0.05], [8, 0.06], [3, 0.08]]) {
      b.globalAlpha = alpha;
      b.lineWidth = width;
      b.beginPath();
      b.moveTo(sx, 0);
      b.lineTo(ex, TEX_H);
      b.stroke();
    }
  }
  b.globalAlpha = 1;

  const base = new CanvasTexture(baseCanvas);
  base.colorSpace = SRGBColorSpace;
  base.anisotropy = 8;
  base.minFilter = LinearMipmapLinearFilter;
  const leds = new CanvasTexture(ledCanvas);
  leds.anisotropy = 8;
  leds.minFilter = LinearMipmapLinearFilter;
  const ledMeta = new CanvasTexture(metaCanvas);
  ledMeta.minFilter = NearestFilter;
  ledMeta.magFilter = NearestFilter;
  ledMeta.generateMipmaps = false;
  return { base, leds, ledMeta };
};

const drawLed = (
  l: CanvasRenderingContext2D,
  meta: CanvasRenderingContext2D,
  x: number,
  y: number,
  rand: () => number,
  weights: number[],
) => {
  const phase = Math.floor(rand() * 255);
  // Weighted colour pick, encoded in B as 0 / 128 / 255.
  const total = weights.reduce((a, w) => a + w, 0);
  let pick = rand() * total;
  let colorIndex = 0;
  while (colorIndex < weights.length - 1 && pick > weights[colorIndex]) {
    pick -= weights[colorIndex];
    colorIndex++;
  }
  const blue = [0, 128, 255][colorIndex];
  // Metadata square covers the whole glow so every texel of an LED agrees.
  meta.fillStyle = `rgb(0,${phase},${blue})`;
  meta.fillRect(x - 7, y - 7, 14, 14);

  const glow = l.createRadialGradient(x, y, 0, x, y, 6.5);
  glow.addColorStop(0, "rgba(255,255,255,0.35)");
  glow.addColorStop(1, "rgba(255,255,255,0)");
  l.fillStyle = glow;
  l.beginPath();
  l.arc(x, y, 6.5, 0, Math.PI * 2);
  l.fill();
  l.fillStyle = "#fff";
  l.beginPath();
  l.arc(x, y, 3.1, 0, Math.PI * 2);
  l.fill();
};

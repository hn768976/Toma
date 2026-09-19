import { buildCodeBlock } from "./code-text";
import { FONTS, PALETTE, scaleFor } from "./constants";
import { rand } from "./random";

// The code wall is three parallax layers of the same crash log at
// different sizes, plus an out-of-focus bloom pass.
//
// Rendering ~250 lines of text per frame per layer would dominate the
// render budget at 4K, so each layer is rasterised once into a tall strip
// and then scrolled with a single drawImage per frame. The strip is
// exactly twice the frame height, which lets it wrap seamlessly by
// blitting it a second time one strip-height up.

export type LayerSpec = {
  /** Design-grid font size, at 1920x1080. */
  fontSize: number;
  lineHeight: number;
  /** Upward drift, design-grid pixels per second. */
  speed: number;
  alpha: number;
  color: string;
  hotColor: string;
  /** Left margin on the design grid. */
  marginX: number;
  seed: number;
};

export const LAYERS: readonly LayerSpec[] = [
  // Far: small, dim, barely crawling. Reads as depth, not as text.
  {
    fontSize: 11,
    lineHeight: 15,
    speed: 9,
    alpha: 0.62,
    color: PALETTE.codeDim,
    hotColor: PALETTE.codeMid,
    marginX: 28,
    seed: 0x1a2b,
  },
  // Mid: the body of the wall.
  {
    fontSize: 15,
    lineHeight: 21,
    speed: 20,
    alpha: 0.9,
    color: PALETTE.codeMid,
    hotColor: PALETTE.codeHot,
    marginX: 48,
    seed: 0x3c4d,
  },
  // Near: the legible foreground rows.
  {
    fontSize: 20,
    lineHeight: 29,
    speed: 38,
    alpha: 1,
    color: PALETTE.codeHot,
    hotColor: PALETTE.codeWhite,
    marginX: 74,
    seed: 0x5e6f,
  },
];

type Strip = { canvas: HTMLCanvasElement; height: number };

const cache = new Map<string, Strip>();

const buildStrip = (spec: LayerSpec, width: number, height: number): Strip => {
  const s = scaleFor(width);
  const lineHeight = spec.lineHeight * s;
  const rows = Math.ceil((height * 2) / lineHeight);
  const stripHeight = Math.round(rows * lineHeight);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = stripHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas, height: stripHeight };

  ctx.textBaseline = "alphabetic";
  ctx.font = `400 ${spec.fontSize * s}px "${FONTS.code}", "DejaVu Sans Mono", monospace`;

  const lines = buildCodeBlock(spec.seed, rows);
  for (let i = 0; i < rows; i += 1) {
    const line = lines[i];
    if (!line.text) continue;
    const y = (i + 1) * lineHeight - lineHeight * 0.25;
    // A little horizontal scatter keeps the left edge from looking ruled.
    const x = spec.marginX * s + rand(spec.seed, i, 7) * 26 * s;

    if (line.kind === 1) {
      ctx.font = `700 ${spec.fontSize * s}px "${FONTS.code}", monospace`;
      ctx.fillStyle = spec.hotColor;
      ctx.globalAlpha = 0.95;
    } else if (line.kind === 2) {
      ctx.fillStyle = spec.color;
      ctx.globalAlpha = 0.4 * line.weight;
    } else {
      // One row in eight burns brighter, the way a log highlights the
      // frame that actually threw.
      const hot = rand(spec.seed, i, 13) < 0.12;
      ctx.fillStyle = hot ? spec.hotColor : spec.color;
      ctx.globalAlpha = (hot ? 1 : 0.72) * line.weight;
    }
    ctx.fillText(line.text, x, y);
    if (line.kind === 1) {
      ctx.font = `400 ${spec.fontSize * s}px "${FONTS.code}", monospace`;
    }
  }
  ctx.globalAlpha = 1;
  return { canvas, height: stripHeight };
};

export const getStrip = (
  index: number,
  width: number,
  height: number,
): Strip => {
  const key = `${width}x${height}:${index}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const strip = buildStrip(LAYERS[index], width, height);
  cache.set(key, strip);
  return strip;
};

/** Drops every cached strip. Called when the fonts finish loading. */
export const invalidateStrips = (): void => {
  cache.clear();
};

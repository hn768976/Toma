import * as THREE from "three";
import { Random } from "../three/random";
import { CODE_SNIPPETS, MICRO_TOKENS } from "./code-snippets";

export const FONT_FAMILY = "Roboto Stream";

const makeCanvas = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;
  return { canvas, ctx };
};

const toTexture = (canvas: HTMLCanvasElement) => {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return tex;
};

const microLine = (rng: Random, maxChars: number) => {
  let s = "";
  while (s.length < maxChars) {
    s += rng.pick(MICRO_TOKENS) + (rng.chance(0.7) ? " " : "");
  }
  return s.slice(0, maxChars);
};

// A dense paragraph of tiny, unreadable code lines (the streaky texture
// that fills most of the reference frame).
const drawMicroBlock = (
  ctx: CanvasRenderingContext2D,
  rng: Random,
  x: number,
  y: number,
  w: number,
  rows: number,
) => {
  const size = rng.range(9, 12);
  ctx.font = `300 ${size}px "${FONT_FAMILY}"`;
  const lh = size * rng.range(1.15, 1.5);
  const charW = size * 0.48;
  for (let r = 0; r < rows; r++) {
    if (rng.chance(0.12)) continue;
    const indent = rng.chance(0.3) ? rng.int(1, 4) * 2 : 0;
    const chars = Math.floor((w / charW) * rng.range(0.25, 1)) - indent;
    if (chars <= 2) continue;
    ctx.globalAlpha = rng.range(0.55, 1.0);
    ctx.fillText(microLine(rng, chars), x + indent * charW, y + r * lh);
  }
};

const drawCodeBlock = (
  ctx: CanvasRenderingContext2D,
  rng: Random,
  x: number,
  y: number,
) => {
  const lines = rng.pick(CODE_SNIPPETS);
  const size = rng.range(16, 24);
  ctx.font = `400 ${size}px "${FONT_FAMILY}"`;
  const lh = size * 1.32;
  const start = rng.int(0, Math.max(0, lines.length - 6));
  const count = rng.int(5, Math.min(14, lines.length - start));
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = rng.range(0.7, 1);
    ctx.fillText(lines[start + i], x, y + i * lh);
  }
};

const drawSquares = (
  ctx: CanvasRenderingContext2D,
  rng: Random,
  w: number,
  h: number,
  count: number,
) => {
  for (let i = 0; i < count; i++) {
    const s = rng.range(6, 34);
    const x = rng.range(0, w - s);
    const y = rng.range(0, h - s);
    const kind = rng.next();
    ctx.globalAlpha = rng.range(0.35, 0.9);
    if (kind < 0.45) {
      ctx.fillRect(x, y, s, s);
    } else if (kind < 0.75) {
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, s * 1.6, s * 1.6);
    } else if (kind < 0.9) {
      // dotted run "▪▪▪▪"
      const n = rng.int(3, 6);
      for (let k = 0; k < n; k++) ctx.fillRect(x + k * 9, y, 6, 6);
    } else {
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 9, y);
      ctx.lineTo(x + 9, y);
      ctx.moveTo(x, y - 9);
      ctx.lineTo(x, y + 9);
      ctx.stroke();
    }
  }
};

/** A 2048x1024 white-on-transparent panel full of code. */
export const makeCodePanel = (rng: Random) => {
  const W = 2048;
  const H = 1024;
  const { canvas, ctx } = makeCanvas(W, H);
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.textBaseline = "top";

  // Faint card rectangles: the lighter-blue slabs the code sits on.
  const cards = rng.int(3, 6);
  for (let c = 0; c < cards; c++) {
    const w = rng.range(260, 900);
    const h = rng.range(140, 520);
    ctx.globalAlpha = rng.range(0.02, 0.05);
    ctx.fillRect(rng.range(0, W - w), rng.range(0, H - h), w, h);
  }

  // Short columns of small code text
  const cols = rng.int(16, 24);
  for (let c = 0; c < cols; c++) {
    const x = rng.range(0, W - 260);
    const y = rng.range(0, H - 200);
    drawMicroBlock(ctx, rng, x, y, rng.range(160, 380), rng.int(8, 30));
  }
  // Readable code blocks
  const blocks = rng.int(1, 3);
  for (let b = 0; b < blocks; b++) {
    drawCodeBlock(ctx, rng, rng.range(20, W - 760), rng.range(20, H - 420));
  }
  drawSquares(ctx, rng, W, H, rng.int(8, 18));
  ctx.globalAlpha = 1;
  return toTexture(canvas);
};

export const makeSpriteTextures = () => {
  const S = 128;
  const fill = makeCanvas(S, S);
  const g = fill.ctx.createRadialGradient(S / 2, S / 2, S * 0.3, S / 2, S / 2, S * 0.5);
  fill.ctx.fillStyle = "#fff";
  fill.ctx.fillRect(16, 16, S - 32, S - 32);
  fill.ctx.globalAlpha = 0.35;
  fill.ctx.fillStyle = g;
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  fill.ctx.fillRect(0, 0, S, S);

  const outline = makeCanvas(S, S);
  outline.ctx.strokeStyle = "#fff";
  outline.ctx.lineWidth = 6;
  outline.ctx.strokeRect(12, 12, S - 24, S - 24);

  const cross = makeCanvas(S, S);
  cross.ctx.fillStyle = "#fff";
  cross.ctx.fillRect(S / 2 - 4, 20, 8, S - 40);
  cross.ctx.fillRect(20, S / 2 - 4, S - 40, 8);

  // Hard-edged, text-filled light panel for the lens fly-by
  const soft = makeCanvas(512, 448);
  soft.ctx.filter = "blur(4px)";
  soft.ctx.fillStyle = "#fff";
  soft.ctx.globalAlpha = 0.5;
  soft.ctx.fillRect(12, 12, 488, 424);
  soft.ctx.filter = "none";
  soft.ctx.globalAlpha = 1;
  soft.ctx.textBaseline = "top";
  soft.ctx.font = `400 15px "${FONT_FAMILY}"`;
  const lines = CODE_SNIPPETS[0];
  lines.forEach((l, i) => soft.ctx.fillText(l.slice(0, 48), 36, 40 + i * 22));
  soft.ctx.strokeStyle = "#fff";
  soft.ctx.lineWidth = 3;
  soft.ctx.strokeRect(300, 60, 60, 60);
  soft.ctx.strokeRect(330, 300, 40, 40);

  return {
    soft: toTexture(soft.canvas),
    fill: toTexture(fill.canvas),
    outline: toTexture(outline.canvas),
    cross: toTexture(cross.canvas),
  };
};

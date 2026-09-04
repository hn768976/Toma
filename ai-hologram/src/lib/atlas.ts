import * as THREE from "three";
import { GLYPH_NAMES, drawGlyph, type GlyphName } from "./glyphs";

/**
 * A single sprite atlas serving every billboarded element in the scene:
 * atmosphere particles, the node badges and their glyphs, the core's glow
 * layers, the volumetric haze and the travelling trace pulses.
 *
 * One texture means one draw call per instanced group, and — more importantly —
 * it is built once at module scope and reused for every frame. Remotion renders
 * frames out of order across threads, so nothing here may depend on time.
 */
const CELL = 512;
const COLS = 4;
const ROWS = 4;
export const ATLAS_SIZE = CELL * COLS; // 2048

/** Inset keeps mip levels from bleeding one cell into its neighbour. */
const INSET = 64;

export type AtlasCell =
  | "glow"
  | "dot"
  | "ring"
  | "disc"
  | GlyphName;

const CELL_ORDER: AtlasCell[] = ["glow", "dot", "ring", "disc", ...GLYPH_NAMES];

/** uv offset + scale for a cell, as consumed by the sprite shader. */
export const cellUv = (name: AtlasCell): [number, number, number, number] => {
  const i = CELL_ORDER.indexOf(name);
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  // three's UV origin is bottom-left; the canvas draws top-down.
  return [col / COLS, (ROWS - 1 - row) / ROWS, 1 / COLS, 1 / ROWS];
};

const radialGlow = (ctx: CanvasRenderingContext2D, hardness: number) => {
  const r = CELL / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r - 4);
  // A long, soft tail: this is what stands in for a bloom pass on the hot
  // elements, without hazing the circuit plane the way a global bloom would.
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const a = Math.pow(1 - t, hardness);
    g.addColorStop(t, `rgba(255,255,255,${a})`);
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CELL, CELL);
};

let cached: THREE.Texture | null = null;

export const getSpriteAtlas = (): THREE.Texture => {
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, ATLAS_SIZE, ATLAS_SIZE);

  CELL_ORDER.forEach((name, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    ctx.save();
    ctx.translate(col * CELL, row * CELL);
    ctx.beginPath();
    ctx.rect(0, 0, CELL, CELL);
    ctx.clip();

    if (name === "glow") {
      radialGlow(ctx, 2.6);
    } else if (name === "dot") {
      radialGlow(ctx, 1.15);
    } else if (name === "ring") {
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(CELL / 2, CELL / 2, CELL / 2 - INSET, 0, Math.PI * 2);
      ctx.stroke();
    } else if (name === "disc") {
      const r = CELL / 2 - INSET;
      const g = ctx.createRadialGradient(CELL / 2, CELL / 2, 0, CELL / 2, CELL / 2, r);
      g.addColorStop(0, "rgba(255,255,255,0.85)");
      g.addColorStop(0.75, "rgba(255,255,255,0.35)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(CELL / 2, CELL / 2, r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const box = CELL - INSET * 2;
      ctx.translate(INSET, INSET);
      ctx.scale(box, box);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 0.052;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      drawGlyph(ctx, name as GlyphName);
    }
    ctx.restore();
  });

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  cached = tex;
  return tex;
};

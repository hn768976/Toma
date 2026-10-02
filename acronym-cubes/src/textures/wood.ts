// Pale birch/beech wood, generated procedurally (no external texture file),
// and the six printed faces of each cube.
//
// One 2048x1024 sheet of long grain is generated once; each cube face is a
// different seeded crop of it with a slight per-cube tint, so neighbouring
// cubes vary like real blocks. Letters are "printed into" the wood: ink
// multiplied over the grain (so grain shows through a little), slightly
// darker at the glyph edges.

import { fbm2, makeNoise2D, range, seeded } from "../lib/prng";

export const FONT_FAMILY = "Archivo Black";
const SHEET_W = 2048;
const SHEET_H = 1024;
export const FACE_PX = 1024;
const LETTER_FRAC = 0.55; // glyph cap height / face

let sheet: HTMLCanvasElement | null = null;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(Math.max((x - a) / (b - a), 0), 1);
  return t * t * (3 - 2 * t);
};

export const woodSheet = (): HTMLCanvasElement => {
  if (sheet) return sheet;
  const rng = seeded("wood-sheet", 7);
  const nWarp = makeNoise2D(rng);
  const nRing = makeNoise2D(rng);
  const nPore = makeNoise2D(rng);
  const nTone = makeNoise2D(rng);
  const c = document.createElement("canvas");
  c.width = SHEET_W;
  c.height = SHEET_H;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(SHEET_W, SHEET_H);
  // sRGB colours: light early wood, slightly darker/warmer late wood.
  const light = [246, 219, 170];
  const dark = [214, 170, 110];
  const pore = [178, 136, 88];
  for (let y = 0; y < SHEET_H; y++) {
    for (let x = 0; x < SHEET_W; x++) {
      // Long grain runs along x; growth rings are wavy bands across y.
      const warp = 42 * fbm2(nWarp, x / 620, y / 260, 3) + 7 * nWarp(x / 90, y / 17);
      const g = (y + warp) / 21;
      const ring = g - Math.floor(g);
      const width = 0.55 + 0.35 * nRing(x / 400, Math.floor(g) * 0.37);
      const late =
        smoothstep(1 - 0.3 * width, 1 - 0.08 * width, ring) * (1 - smoothstep(0.94, 1, ring));
      const pores = Math.pow(nPore(x / 34, y / 1.6), 6) * 0.9;
      const tone = fbm2(nTone, x / 700, y / 300, 3) - 0.5;
      const k = Math.min(0.62 * late + 0.06 * tone + 0.5, 1) - 0.5;
      const i = (y * SHEET_W + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        let v = light[ch] + (dark[ch] - light[ch]) * Math.max(k * 1.6, 0) + tone * 14;
        v += (pore[ch] - v) * pores * 0.55;
        img.data[i + ch] = v;
      }
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  sheet = c;
  return c;
};

const glyphMask = (char: string) => {
  const m = document.createElement("canvas");
  m.width = FACE_PX;
  m.height = FACE_PX;
  const ctx = m.getContext("2d")!;
  // Size from the cap height of "H" so every letter/digit matches.
  ctx.font = `100px "${FONT_FAMILY}"`;
  const hm = ctx.measureText("H");
  const capH = hm.actualBoundingBoxAscent + hm.actualBoundingBoxDescent;
  let size = (100 * LETTER_FRAC * FACE_PX) / capH;
  ctx.font = `${size}px "${FONT_FAMILY}"`;
  let mm = ctx.measureText(char);
  const w = mm.actualBoundingBoxLeft + mm.actualBoundingBoxRight;
  const maxW = 0.7 * FACE_PX;
  if (w > maxW) {
    size *= maxW / w;
    ctx.font = `${size}px "${FONT_FAMILY}"`;
    mm = ctx.measureText(char);
  }
  // Centre the glyph's ink box on the face.
  const x = FACE_PX / 2 - (mm.actualBoundingBoxRight - mm.actualBoundingBoxLeft) / 2;
  const y = FACE_PX / 2 + (mm.actualBoundingBoxAscent - mm.actualBoundingBoxDescent) / 2;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#fff";
  ctx.fillText(char, x, y);
  return { canvas: m, font: ctx.font, x, y };
};

const inkLayer = (char: string, tint: string) => {
  const g = glyphMask(char);
  const ink = document.createElement("canvas");
  ink.width = FACE_PX;
  ink.height = FACE_PX;
  const ictx = ink.getContext("2d")!;
  ictx.fillStyle = tint;
  ictx.fillRect(0, 0, FACE_PX, FACE_PX);
  // Darker rim just inside the glyph edge (ink pooling).
  ictx.save();
  ictx.font = g.font;
  ictx.lineJoin = "round";
  ictx.strokeStyle = "rgba(0,0,0,0.55)";
  ictx.lineWidth = FACE_PX * 0.016;
  ictx.filter = `blur(${FACE_PX * 0.0025}px)`;
  ictx.strokeText(char, g.x, g.y);
  ictx.restore();
  ictx.globalCompositeOperation = "destination-in";
  ictx.drawImage(g.canvas, 0, 0);
  return ink;
};

// Six face canvases for one cube, in BoxGeometry group order.
export const cubeFaces = (
  seedKey: string,
  chars: string[],
): HTMLCanvasElement[] => {
  const wood = woodSheet();
  const rng = seeded("cube-wood", seedKey);
  // Per-cube variation: slight warmth/brightness shift.
  const warm = range(rng, -0.05, 0.05);
  const bright = range(rng, -0.04, 0.03);
  return chars.map((char) => {
    const c = document.createElement("canvas");
    c.width = FACE_PX;
    c.height = FACE_PX;
    const ctx = c.getContext("2d")!;
    const crop = range(rng, 600, 760);
    const sx = range(rng, 0, SHEET_W - crop);
    const sy = range(rng, 0, SHEET_H - crop);
    ctx.save();
    ctx.translate(FACE_PX / 2, FACE_PX / 2);
    // Grain runs across every face (like a real block), wandering a little.
    ctx.rotate(range(rng, -0.05, 0.05));
    if (rng() < 0.5) ctx.scale(-1, 1);
    ctx.drawImage(wood, sx, sy, crop, crop, -FACE_PX * 0.53, -FACE_PX * 0.53, FACE_PX * 1.06, FACE_PX * 1.06);
    ctx.restore();
    // Tint.
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    const r = 255;
    const gch = Math.round(255 * (1 - Math.max(warm, 0) * 0.6));
    const b = Math.round(255 * (1 - Math.max(warm, 0) * 1.2 + Math.min(warm, 0) * -0.2));
    ctx.fillStyle = `rgb(${r},${gch},${Math.min(b, 255)})`;
    ctx.fillRect(0, 0, FACE_PX, FACE_PX);
    ctx.restore();
    if (bright !== 0) {
      ctx.save();
      ctx.globalCompositeOperation = bright > 0 ? "screen" : "multiply";
      const v = bright > 0 ? Math.round(255 * bright) : Math.round(255 * (1 + bright));
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(0, 0, FACE_PX, FACE_PX);
      ctx.restore();
    }
    // Print the character: multiplied, slightly translucent so the grain
    // shows through the ink.
    ctx.save();
    ctx.globalCompositeOperation = "multiply";
    ctx.globalAlpha = 0.93;
    ctx.drawImage(inkLayer(char, "rgb(30,25,21)"), 0, 0);
    ctx.restore();
    return c;
  });
};

// Contact-darkening decal under each cube: dark across the cube's footprint,
// fading out ~0.1 cube widths beyond it, so a dark line shows where the
// cube meets the paper. The decal spans CONTACT_SIZE cube widths.
export const CONTACT_SIZE = 1.3;
let contact: HTMLCanvasElement | null = null;
export const contactCanvas = () => {
  if (contact) return contact;
  const S = 512;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const ctx = c.getContext("2d")!;
  const pxPerCube = S / CONTACT_SIZE;
  const half = 0.5 * pxPerCube; // footprint half-width in px
  ctx.filter = `blur(${0.035 * pxPerCube}px)`;
  ctx.fillStyle = "rgba(0,0,0,1)";
  ctx.beginPath();
  ctx.roundRect(S / 2 - half, S / 2 - half, 2 * half, 2 * half, 0.07 * pxPerCube);
  ctx.fill();
  contact = c;
  return c;
};

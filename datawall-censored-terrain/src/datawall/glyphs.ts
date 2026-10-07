import * as THREE from "three";

// 5x7 dot-matrix glyphs: 0-9, A-F and a few symbols. Drawn once into a Canvas 2D atlas.
const G: Record<string, string[]> = {
  "0": [".###.", "#...#", "#..##", "#.#.#", "##..#", "#...#", ".###."],
  "1": ["..#..", ".##..", "..#..", "..#..", "..#..", "..#..", ".###."],
  "2": [".###.", "#...#", "....#", "...#.", "..#..", ".#...", "#####"],
  "3": ["####.", "....#", "....#", ".###.", "....#", "....#", "####."],
  "4": ["...#.", "..##.", ".#.#.", "#..#.", "#####", "...#.", "...#."],
  "5": ["#####", "#....", "####.", "....#", "....#", "#...#", ".###."],
  "6": ["..##.", ".#...", "#....", "####.", "#...#", "#...#", ".###."],
  "7": ["#####", "....#", "...#.", "..#..", ".#...", ".#...", ".#..."],
  "8": [".###.", "#...#", "#...#", ".###.", "#...#", "#...#", ".###."],
  "9": [".###.", "#...#", "#...#", ".####", "....#", "...#.", ".##.."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  C: [".###.", "#...#", "#....", "#....", "#....", "#...#", ".###."],
  D: ["###..", "#..#.", "#...#", "#...#", "#...#", "#..#.", "###.."],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  "-": [".....", ".....", ".....", "#####", ".....", ".....", "....."],
  ".": [".....", ".....", ".....", ".....", ".....", ".##..", ".##.."],
  ":": [".....", ".##..", ".##..", ".....", ".##..", ".##..", "....."],
  "+": [".....", "..#..", "..#..", "#####", "..#..", "..#..", "....."],
  "=": [".....", ".....", "#####", ".....", "#####", ".....", "....."],
  "/": ["....#", "....#", "...#.", "..#..", ".#...", "#....", "#...."],
  "*": [".....", "#.#.#", ".###.", "#####", ".###.", "#.#.#", "....."],
  "#": [".#.#.", ".#.#.", "#####", ".#.#.", "#####", ".#.#.", ".#.#."],
  "<": ["...#.", "..#..", ".#...", "#....", ".#...", "..#..", "...#."],
  ">": [".#...", "..#..", "...#.", "....#", "...#.", "..#..", ".#..."],
  "[": [".###.", ".#...", ".#...", ".#...", ".#...", ".#...", ".###."],
  "]": [".###.", "...#.", "...#.", "...#.", "...#.", "...#.", ".###."],
};

export const ATLAS_ORDER = "0123456789ABCDEF-.:+=/*#<>[]";
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 4;
// Weighted pick table: mostly binary digits, then hex, then a few symbols (indices into ATLAS_ORDER).
export const GLYPH_TABLE = "000000000000111111111111AAAAAACC----------....0123456789ABCDEF:+="
  .split("")
  .map((c) => ATLAS_ORDER.indexOf(c));

// Cell: 64 px with 8 px dot pitch => 5x7 dots fill 40x56, centred with padding (no mip bleed).
const CELL = 64;
const PITCH = 8;

export const makeGlyphAtlas = () => {
  const canvas = document.createElement("canvas");
  canvas.width = CELL * ATLAS_COLS;
  canvas.height = CELL * ATLAS_ROWS;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  for (let i = 0; i < ATLAS_ORDER.length; i++) {
    const rows = G[ATLAS_ORDER[i]];
    const cx = (i % ATLAS_COLS) * CELL + (CELL - 5 * PITCH) / 2;
    const cy = Math.floor(i / ATLAS_COLS) * CELL + (CELL - 7 * PITCH) / 2;
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 5; c++) {
        if (rows[r][c] !== "#") continue;
        // Square-ish LED dots with a little rounding.
        ctx.beginPath();
        ctx.roundRect(cx + c * PITCH + 1, cy + r * PITCH + 1, PITCH - 2, PITCH - 2, 1.5);
        ctx.fill();
      }
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 16;
  tex.needsUpdate = true;
  return tex;
};

// Atlas UV rect of glyph cell content (5x7 dots region) for glyph index i.
export const GLYPH_CONTENT = {
  // fraction of the cell occupied by the dot area
  u0: (CELL - 5 * PITCH) / 2 / CELL,
  v0: (CELL - 7 * PITCH) / 2 / CELL,
  du: (5 * PITCH) / CELL,
  dv: (7 * PITCH) / CELL,
};

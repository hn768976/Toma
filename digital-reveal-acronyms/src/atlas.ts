import { CanvasTexture, LinearFilter, LinearMipmapLinearFilter } from "three";
import { FONT_FAMILY, FONT_WEIGHT } from "./font";

// Particle glyphs: binary digits and symbols only, never real words.
// "dash" and "dot" are drawn as shapes rather than text.
export const GLYPHS = ["0", "1", "+", "#", "=", "/", "x", "-", "dash", "dot"] as const;
export const ATLAS_COLS = 8;
export const ATLAS_ROWS = 2;
const CELL = 64;

let atlases: { sharp: CanvasTexture; soft: CanvasTexture } | null = null;

const drawSheet = (blurPx: number) => {
  const sheet = document.createElement("canvas");
  sheet.width = ATLAS_COLS * CELL;
  sheet.height = ATLAS_ROWS * CELL;
  const ctx = sheet.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  GLYPHS.forEach((g, i) => {
    const cx = (i % ATLAS_COLS) * CELL + CELL / 2;
    const cy = Math.floor(i / ATLAS_COLS) * CELL + CELL / 2;
    ctx.save();
    if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
    if (g === "dash") {
      ctx.fillRect(cx - CELL * 0.22, cy - CELL * 0.05, CELL * 0.44, CELL * 0.1);
    } else if (g === "dot") {
      ctx.beginPath();
      ctx.arc(cx, cy, CELL * 0.09, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.font = `${FONT_WEIGHT} ${CELL * 0.62}px ${FONT_FAMILY}`;
      ctx.fillText(g, cx, cy + CELL * 0.02);
    }
    ctx.restore();
  });
  const tex = new CanvasTexture(sheet);
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
};

// Drawn once per page, after the font has loaded.
export const getAtlases = () => {
  if (!atlases) atlases = { sharp: drawSheet(0), soft: drawSheet(5) };
  return atlases;
};

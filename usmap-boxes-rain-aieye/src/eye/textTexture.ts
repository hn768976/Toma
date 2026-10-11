import * as THREE from "three";
import { mulberry32, pick } from "../lib/random";

// Column text texture for the AI Eye. Built once (after fonts load) at the
// render's buffer resolution; logical layout is in 4K units so it is identical
// at every scale.
export const EYE_COLUMNS = 18;
export const STRIP_ROWS = 45;
// Strip height in units of frame height. Each column tiles vertically with this period.
export const STRIP_HEIGHT_FRAC = 1.5;

const WORDS = [
  "AI", "AI", "AI", "Algorithm", "Dataset", "Deep Learning", "Chatbot", "Knowledge",
  "Logic", "Evolutionary", "Intelligence", "Machine Learning", "Artificial",
];
// Muted: mostly teal-cyan and pale blue, white kept rare and dimmed.
const COLORS = ["rgba(58,200,232,0.72)", "rgba(58,190,200,0.75)", "rgba(138,200,240,0.75)", "rgba(138,200,240,0.75)", "rgba(232,244,255,0.55)", "rgba(58,168,184,0.5)"];

export const buildEyeTextTexture = (bufferW: number, bufferH: number) => {
  const rng = mulberry32(0xa1e7e);
  const w = Math.round(bufferW);
  const stripH = Math.round(bufferH * STRIP_HEIGHT_FRAC);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = stripH;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, w, stripH);
  const s = bufferW / 3840; // logical 4K units -> buffer px
  const colW = w / EYE_COLUMNS;
  const rowH = stripH / STRIP_ROWS;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let c = 0; c < EYE_COLUMNS; c++) {
    const cx = (c + 0.5) * colW;
    for (let r = 0; r < STRIP_ROWS; r++) {
      const isBinary = rng() < 0.17;
      let text: string;
      let font: string;
      let size: number;
      if (isBinary) {
        const n = rng() < 0.5 ? 8 : 9;
        text = "";
        for (let i = 0; i < n; i++) text += rng() < 0.5 ? "0" : "1";
        size = 30;
        font = `500 ${size * s}px "JetBrains Mono"`;
      } else {
        text = pick(rng, WORDS);
        const semibold = rng() < 0.85;
        size = text === "AI" ? 36 : [32, 34][Math.floor(rng() * 2)];
        font = `${semibold ? 600 : 500} ${size * s}px Inter`;
      }
      ctx.font = font;
      const maxW = colW * 0.78;
      const mw = ctx.measureText(text).width;
      if (mw > maxW) {
        const fitted = (size * s * maxW) / mw;
        ctx.font = font.replace(`${size * s}px`, `${fitted}px`);
      }
      const color = pick(rng, COLORS);
      ctx.fillStyle = color;
      ctx.shadowColor = "rgba(58,170,220,0.2)";
      ctx.shadowBlur = 4 * s;
      // Jitter rows a touch so columns don't look typeset on one grid.
      const cy = (r + 0.5) * rowH;
      ctx.fillText(text, cx, cy);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
};

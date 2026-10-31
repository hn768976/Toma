import * as THREE from "three";
import { Rng, range } from "../engine/random";

export const TICKER_FONT = "Oswald";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const symbol = (rng: Rng) =>
  Array.from({ length: 3 }, () => LETTERS[Math.floor(rng() * 26)]).join("");

const price = (rng: Rng) => range(rng, 10, 1200).toFixed(2);

/**
 * Draws a stock-ticker board (white text on transparent) into a canvas and
 * returns it as a mip-mapped texture. Colour is applied in the shader so the
 * same board works for every palette.
 */
export const createTickerTexture = (
  rng: Rng,
  opts: { width: number; height: number; rows: number; groups: number },
) => {
  const canvas = document.createElement("canvas");
  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, opts.width, opts.height);
  const rowH = opts.height / (opts.rows + 0.5);
  const groupW = opts.width / opts.groups;
  ctx.textBaseline = "middle";
  // Fit the font so a price ("888.88") fills ~17% of a column group.
  ctx.font = `500 100px ${TICKER_FONT}`;
  const priceW = ctx.measureText("888.88").width / 100;
  const fontPx = Math.round(Math.min(rowH * 0.74, (groupW * 0.17) / priceW));
  for (let gI = 0; gI < opts.groups; gI++) {
    const x0 = gI * groupW + groupW * 0.04;
    for (let r = 0; r < opts.rows; r++) {
      const y = (r + 0.75) * rowH;
      const dim = 0.55 + 0.45 * rng();
      ctx.fillStyle = `rgba(255,255,255,${dim})`;
      ctx.font = `500 ${fontPx}px ${TICKER_FONT}`;
      ctx.textAlign = "left";
      ctx.fillText(symbol(rng), x0, y);
      ctx.textAlign = "right";
      ctx.fillText(price(rng), x0 + groupW * 0.4, y);
      ctx.fillText(price(rng), x0 + groupW * 0.61, y);
      // down triangle + percentage
      const tx = x0 + groupW * 0.67;
      const ts = fontPx * 0.32;
      ctx.beginPath();
      ctx.moveTo(tx - ts, y - ts * 0.7);
      ctx.lineTo(tx + ts, y - ts * 0.7);
      ctx.lineTo(tx, y + ts * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.fillText(`${range(rng, 8, 30).toFixed(2)}%`, x0 + groupW * 0.93, y);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

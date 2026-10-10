import * as THREE from "three";

/**
 * Glyph atlas, drawn once with Canvas 2D paths (no fonts, so it is identical
 * on every machine). Four cells in a row: 0 = zero, 1 = one, 2 = padlock,
 * 3 = empty. White strokes on transparent; colour comes from the shader.
 */
export const GLYPH_CELL = 256;

const drawZero = (c: CanvasRenderingContext2D) => {
  // Slashed zero: tall rounded rectangle with a diagonal stroke.
  const w = 112;
  const h = 150;
  const r = 20;
  const x = (GLYPH_CELL - w) / 2;
  const y = (GLYPH_CELL - h) / 2;
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
  c.stroke();
  c.beginPath();
  c.moveTo(x + w - 18, y + 22);
  c.lineTo(x + 18, y + h - 22);
  c.stroke();
};

const drawOne = (c: CanvasRenderingContext2D) => {
  const cx = GLYPH_CELL / 2 + 6;
  const top = 53;
  const bot = 203;
  c.beginPath();
  c.moveTo(cx - 40, top + 30);
  c.lineTo(cx, top);
  c.lineTo(cx, bot);
  c.stroke();
  c.beginPath();
  c.moveTo(cx - 44, bot);
  c.lineTo(cx + 44, bot);
  c.stroke();
};

const drawLock = (c: CanvasRenderingContext2D) => {
  const cx = GLYPH_CELL / 2;
  // Shackle
  c.beginPath();
  c.moveTo(cx - 40, 128);
  c.lineTo(cx - 40, 92);
  c.arc(cx, 92, 40, Math.PI, 0);
  c.lineTo(cx + 40, 128);
  c.stroke();
  // Body (filled rounded rect) with a keyhole cut out
  const bw = 128;
  const bh = 92;
  const bx = cx - bw / 2;
  const by = 120;
  const r = 16;
  c.beginPath();
  c.moveTo(bx + r, by);
  c.arcTo(bx + bw, by, bx + bw, by + bh, r);
  c.arcTo(bx + bw, by + bh, bx, by + bh, r);
  c.arcTo(bx, by + bh, bx, by, r);
  c.arcTo(bx, by, bx + bw, by, r);
  c.closePath();
  c.fill();
  c.globalCompositeOperation = "destination-out";
  c.beginPath();
  c.arc(cx, by + 36, 14, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(cx - 7, by + 40);
  c.lineTo(cx + 7, by + 40);
  c.lineTo(cx + 5, by + 70);
  c.lineTo(cx - 5, by + 70);
  c.closePath();
  c.fill();
  c.globalCompositeOperation = "source-over";
};

export const makeGlyphAtlas = (): THREE.Texture => {
  const canvas = document.createElement("canvas");
  canvas.width = GLYPH_CELL * 4;
  canvas.height = GLYPH_CELL;
  const c = canvas.getContext("2d")!;
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.strokeStyle = "#fff";
  c.fillStyle = "#fff";
  c.lineWidth = 11;
  c.lineCap = "round";
  c.lineJoin = "round";
  const cells = [drawZero, drawOne, drawLock];
  cells.forEach((draw, i) => {
    c.save();
    c.translate(i * GLYPH_CELL, 0);
    draw(c);
    c.restore();
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 4;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
};

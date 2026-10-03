/**
 * Draws the acronym with Oxanium SemiBold (angular, chamfered display face) into a
 * 4096px-wide RGBA data texture:
 *   R = letters (sharp), G = wide soft halo, B = tight glow.
 * Called only after the font has loaded (behind delayRender).
 */
import * as THREE from "three";

export const FONT_FAMILY = "Oxanium";
export const FONT_WEIGHT = 600;
export const TEX_W = 4096;
/** Extra tracking between letters, as a fraction of the font size. */
const TRACKING = 0.06;

export type WordTexture = {
  texture: THREE.DataTexture;
  width: number;
  height: number;
  inkWidth: number; // px, from the left edge of the first glyph to the right edge of the last
  capHeight: number; // px
  cells: { x0: number; x1: number; y0: number; y1: number }[]; // per-letter ink boxes, uv (top-left origin)
};

export const makeWordTexture = (rawText: string): WordTexture => {
  const text = rawText.toUpperCase();
  const chars = [...text];
  const font = (size: number) => `${FONT_WEIGHT} ${size}px ${FONT_FAMILY}`;

  // Lay the word out at 1000px, char by char with fixed tracking (deterministic).
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = font(1000);
  const capRef = probe.measureText("H");
  const capH1000 = capRef.actualBoundingBoxAscent; // all-caps: letters share the cap height
  const glyphs: { x: number; l: number; r: number }[] = [];
  let pen = 0;
  for (const ch of chars) {
    const m = probe.measureText(ch);
    glyphs.push({ x: pen, l: pen - m.actualBoundingBoxLeft, r: pen + m.actualBoundingBoxRight });
    pen += m.width + TRACKING * 1000;
  }
  const inkL = glyphs[0].l;
  const inkR = glyphs[glyphs.length - 1].r;
  const ink1000 = inkR - inkL;

  const padX = Math.round(TEX_W * 0.07);
  const fs = ((TEX_W - 2 * padX) / ink1000) * 1000;
  const k = fs / 1000;
  const capH = capH1000 * k;
  const padY = Math.round(fs * 0.3);
  const W = TEX_W;
  const H = Math.ceil(capH + 2 * padY);
  const originX = padX - inkL * k;
  const base = padY + capH;

  const layer = (blur: number) => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.font = font(fs);
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    if (blur > 0) ctx.filter = `blur(${blur}px)`;
    chars.forEach((ch, i) => ctx.fillText(ch, originX + glyphs[i].x * k, base));
    return ctx.getImageData(0, 0, W, H).data;
  };
  const lit = layer(0);
  const halo = layer(capH * 0.16);
  const glow = layer(capH * 0.045);

  // Flip rows so uv (0,0) is bottom-left as three.js expects.
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const src = y * W * 4;
    const dst = (H - 1 - y) * W * 4;
    for (let x = 0; x < W * 4; x += 4) {
      data[dst + x] = lit[src + x];
      data[dst + x + 1] = halo[src + x];
      data[dst + x + 2] = glow[src + x];
      data[dst + x + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 8;
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;

  const cells = glyphs.map((g) => ({
    x0: (originX + g.l * k) / W,
    x1: (originX + g.r * k) / W,
    y0: (base - capH) / H,
    y1: base / H,
  }));
  return { texture, width: W, height: H, inkWidth: ink1000 * k, capHeight: capH, cells };
};

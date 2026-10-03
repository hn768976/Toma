/**
 * Draws the acronym with DSEG14 Classic into a 4096px-wide RGBA data texture:
 *   R = lit segments (sharp), G = all segments ("~", unlit ghost), B = soft glow of lit segments.
 * Called only after the font has loaded (behind delayRender).
 */
import * as THREE from "three";

export const FONT_FAMILY = "DSEG14Classic";
export const TEX_W = 4096;
const LETTER_ADVANCE = 0.92;

export type WordTexture = {
  texture: THREE.DataTexture;
  width: number;
  height: number;
  inkWidth: number; // px, width of the full 14-segment cells
  cells: { x0: number; x1: number; y0: number; y1: number }[]; // uv (top-left origin)
};

export const makeWordTexture = (rawText: string): WordTexture => {
  const text = rawText.toUpperCase();
  const n = Math.max(1, text.length);
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = `1000px ${FONT_FAMILY}`;
  const one = probe.measureText("~"); // all 14 segments lit = full cell
  const cellL = one.actualBoundingBoxLeft;
  const cellR = one.actualBoundingBoxRight;
  // Letters sit a little tighter than DSEG's native advance.
  const adv1000 = one.width * LETTER_ADVANCE;
  const ink1000 = (n - 1) * adv1000 + cellL + cellR;
  const padX = Math.round(TEX_W * 0.07);
  const fs = ((TEX_W - 2 * padX) / ink1000) * 1000;
  const k = fs / 1000;
  const asc = one.actualBoundingBoxAscent * k;
  const desc = one.actualBoundingBoxDescent * k;
  const padY = Math.round(fs * 0.22);
  const W = TEX_W;
  const H = Math.ceil(asc + desc + 2 * padY);
  const x0 = padX + cellL * k; // origin of the first glyph
  const base = padY + asc;
  const adv = adv1000 * k;

  const layer = (chars: string, blur: number) => {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    ctx.font = `${fs}px ${FONT_FAMILY}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#fff";
    if (blur > 0) ctx.filter = `blur(${blur}px)`;
    for (let i = 0; i < chars.length; i++) ctx.fillText(chars[i], x0 + i * adv, base);
    return ctx.getImageData(0, 0, W, H).data;
  };
  const lit = layer(text, 0);
  const ghost = layer("~".repeat(n), 0);
  const glow = layer(text, fs * 0.04);

  // Flip rows so uv (0,0) is bottom-left as three.js expects.
  const data = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) {
    const src = y * W * 4;
    const dst = (H - 1 - y) * W * 4;
    for (let x = 0; x < W * 4; x += 4) {
      data[dst + x] = lit[src + x];
      data[dst + x + 1] = ghost[src + x];
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

  const cells = Array.from({ length: n }, (_, i) => {
    const cx0 = x0 + i * adv - cellL * k;
    const cx1 = x0 + i * adv + cellR * k;
    return { x0: cx0 / W, x1: cx1 / W, y0: (base - asc) / H, y1: (base + desc) / H };
  });
  return { texture, width: W, height: H, inkWidth: ink1000 * k, cells };
};

import * as THREE from "three";

// Text atlas drawn with the shipped fonts (call only after loadFonts()).
export type AtlasEntry = { u0: number; v0: number; u1: number; v1: number; aspect: number };

export const makeTextAtlas = (
  items: { text: string; font: string; color: string; letterSpacing?: number; marker?: string }[],
  fontPx: number,
  width = 2048,
) => {
  const pad = Math.round(fontPx * 0.6);
  const rowH = Math.round(fontPx * 1.4) + pad * 2;
  const canvas = document.createElement("canvas");
  const ctx0 = canvas.getContext("2d")!;
  // first pass: measure & place
  const placed: { x: number; y: number; w: number; item: (typeof items)[number] }[] = [];
  let x = 0;
  let y = 0;
  for (const it of items) {
    ctx0.font = it.font.replace("{px}", `${fontPx}px`);
    (ctx0 as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(it.letterSpacing ?? 0) * fontPx}px`;
    const markerW = it.marker ? fontPx * 0.9 : 0;
    const w = Math.ceil(ctx0.measureText(it.text).width + markerW) + pad * 2;
    if (x + w > width) {
      x = 0;
      y += rowH;
    }
    placed.push({ x, y, w, item: it });
    x += w;
  }
  const height = 2 ** Math.ceil(Math.log2(y + rowH));
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")! as CanvasRenderingContext2D & { letterSpacing: string };
  ctx.clearRect(0, 0, width, height);
  const entries: AtlasEntry[] = [];
  for (const p of placed) {
    const it = p.item;
    ctx.font = it.font.replace("{px}", `${fontPx}px`);
    ctx.letterSpacing = `${(it.letterSpacing ?? 0) * fontPx}px`;
    ctx.textBaseline = "middle";
    const cy = p.y + rowH / 2;
    let tx = p.x + pad;
    if (it.marker) {
      ctx.fillStyle = it.marker;
      const s = fontPx * 0.32;
      ctx.beginPath();
      ctx.moveTo(tx + s, cy - s);
      ctx.lineTo(tx + 2 * s, cy);
      ctx.lineTo(tx + s, cy + s);
      ctx.lineTo(tx, cy);
      ctx.closePath();
      ctx.fill();
      tx += fontPx * 0.9;
    }
    ctx.fillStyle = it.color;
    ctx.fillText(it.text, tx, cy + fontPx * 0.04);
    entries.push({
      u0: p.x / width,
      u1: (p.x + p.w) / width,
      v0: 1 - (p.y + rowH) / height,
      v1: 1 - p.y / height,
      aspect: p.w / rowH,
    });
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return { tex, entries, rowPx: rowH, fontPx };
};

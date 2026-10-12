import type { Font } from "opentype.js";
import { ICONS, type IconId } from "./icons";

export const ATLAS_TILE = 256;
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 2;
const PAD = 30; // px of empty border per tile, keeps mip levels from bleeding

/**
 * Builds the icon atlas once per composition.
 * Channel R = the crisp icon mask, channel G = a blurred halo of it (the
 * accent icon's glow). Alpha is always 255, so no premultiplication issues.
 * Slot order: base icons first, the accent icon last.
 */
export function buildIconAtlas(ids: IconId[], font: Font): HTMLCanvasElement {
  if (ids.length > ATLAS_COLS * ATLAS_ROWS) {
    throw new Error(`At most ${ATLAS_COLS * ATLAS_ROWS} icons per acronym`);
  }
  const w = ATLAS_TILE * ATLAS_COLS;
  const h = ATLAS_TILE * ATLAS_ROWS;

  const sharp = document.createElement("canvas");
  sharp.width = w;
  sharp.height = h;
  const sc = sharp.getContext("2d")!;
  sc.fillStyle = "#fff";
  sc.strokeStyle = "#fff";

  ids.forEach((id, i) => {
    const tx = (i % ATLAS_COLS) * ATLAS_TILE;
    const ty = Math.floor(i / ATLAS_COLS) * ATLAS_TILE;
    const s = (ATLAS_TILE - PAD * 2) / 100;
    // Draw each icon on its own layer so "cut" operations stay inside the tile.
    const layer = document.createElement("canvas");
    layer.width = ATLAS_TILE;
    layer.height = ATLAS_TILE;
    const lc = layer.getContext("2d")!;
    lc.fillStyle = "#fff";
    lc.strokeStyle = "#fff";
    lc.translate(PAD, PAD);
    lc.scale(s, s);
    ICONS[id](lc, font);
    sc.drawImage(layer, tx, ty);
  });

  const halo = document.createElement("canvas");
  halo.width = w;
  halo.height = h;
  const hc = halo.getContext("2d")!;
  hc.filter = "blur(14px)";
  hc.drawImage(sharp, 0, 0);
  hc.drawImage(sharp, 0, 0);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const oc = out.getContext("2d")!;
  const a = sc.getImageData(0, 0, w, h).data;
  const b = hc.getImageData(0, 0, w, h).data;
  const img = oc.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = a[i + 3];
    d[i + 1] = b[i + 3];
    d[i + 2] = 0;
    d[i + 3] = 255;
  }
  oc.putImageData(img, 0, 0);
  return out;
}

/** UV offset of a slot (bottom-left origin, flipY texture). */
export function atlasSlotOffset(slot: number): [number, number] {
  const col = slot % ATLAS_COLS;
  const row = Math.floor(slot / ATLAS_COLS);
  return [col / ATLAS_COLS, 1 - (row + 1) / ATLAS_ROWS];
}

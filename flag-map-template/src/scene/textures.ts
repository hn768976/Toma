// Canvas textures for the top face (flag or region fill) and the label.
import * as THREE from 'three';
import {FLAGS} from '../flags/flags';
import type {ShapeData} from '../geo/buildShape';
import type {Row} from '../data/rows';
import {FONT_FAMILY} from './assets';

const TOP_TEX = 4096;

const shade = (hex: string, k: number) => {
  // k > 0 lightens toward white, k < 0 darkens toward black (in sRGB)
  const c = new THREE.Color(hex);
  const hsl = {h: 0, s: 0, l: 0};
  c.getHSL(hsl, THREE.SRGBColorSpace);
  const l = k >= 0 ? hsl.l + (1 - hsl.l) * k : hsl.l * (1 + k);
  return '#' + new THREE.Color().setHSL(hsl.h, hsl.s, l, THREE.SRGBColorSpace).getHexString(THREE.SRGBColorSpace);
};

/** Side wall colour: a darker shade of the top face's main colour. */
export const sideColor = (row: Row) => {
  if ('fill' in row.top) return row.top.side ?? shade(row.top.fill, -0.55);
  return shade(FLAGS[row.top.flag].main, -0.3);
};

/**
 * Top-face texture covering the shape's bbox (uv 0..1 = bbox, north up).
 * Flags: scaled to cover the bbox, shifted so the flag's focus point lands on
 * the shape's most interior point, clamped so the flag always covers.
 */
export const makeTopTexture = (row: Row, shape: ShapeData, flagImg: HTMLImageElement | null) => {
  const aspect = shape.w / shape.h;
  const cw = aspect >= 1 ? TOP_TEX : Math.round(TOP_TEX * aspect);
  const ch = aspect >= 1 ? Math.round(TOP_TEX / aspect) : TOP_TEX;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  const minX = -shape.w / 2;
  const maxY = shape.h / 2;
  const toPx = (x: number, y: number): [number, number] => [((x - minX) / shape.w) * cw, ((maxY - y) / shape.h) * ch];

  if ('fill' in row.top) {
    const g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, shade(row.top.fill, 0.14));
    g.addColorStop(1, shade(row.top.fill, -0.14));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);
    // faint member-country borders
    ctx.strokeStyle = row.id === 'Antarctica' ? 'rgba(90,130,170,0.35)' : 'rgba(255,255,255,0.42)';
    ctx.lineWidth = Math.max(cw, ch) * 0.0013;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const line of shape.borders) {
      line.forEach(([x, y], i) => {
        const [px, py] = toPx(x, y);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
    }
    ctx.stroke();
  } else {
    const def = FLAGS[row.top.flag];
    const zoom = row.top.zoom ?? 1;
    const s = Math.max(shape.w / def.w, shape.h / def.h) * zoom;
    const FW = def.w * s;
    const FH = def.h * s;
    const [ax, ay] = row.top.anchor === 'center' ? [0, 0] : shape.anchor;
    let left = ax - row.top.focus.x * FW;
    let top = ay + row.top.focus.y * FH;
    left = Math.min(-shape.w / 2, Math.max(shape.w / 2 - FW, left));
    top = Math.max(shape.h / 2, Math.min(-shape.h / 2 + FH, top));
    const [px, py] = toPx(left, top);
    ctx.drawImage(flagImg!, px, py, (FW / shape.w) * cw, (FH / shape.h) * ch);
  }
  // Edge catch-light standing in for a small bevel.
  ctx.save();
  ctx.beginPath();
  for (const poly of shape.polygons)
    for (const ring of poly)
      ring.forEach(([x, y], i) => {
        const [px, py] = toPx(x, y);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
  ctx.clip('evenodd');
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = Math.max(cw, ch) * 0.0035;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
};

/** Label text texture; returns the texture and the text's world width per world unit of font size. */
export const makeLabelTexture = (text: string) => {
  const px = 256;
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `500 ${px}px ${FONT_FAMILY}`;
  const m = probe.measureText(text);
  const pad = px * 0.25;
  const cw = Math.ceil(m.actualBoundingBoxLeft + m.actualBoundingBoxRight + pad * 2);
  const ch = Math.ceil(px * 1.5);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `500 ${px}px ${FONT_FAMILY}`;
  ctx.fillStyle = '#2A2E35';
  ctx.textBaseline = 'alphabetic';
  // cap band centred vertically: baseline at centre + capHeight/2
  const baseline = ch / 2 + (0.727 * px) / 2;
  ctx.fillText(text, pad + m.actualBoundingBoxLeft, baseline);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return {tex, widthPerEm: cw / px, heightPerEm: ch / px, inkWidthPerEm: (m.actualBoundingBoxLeft + m.actualBoundingBoxRight) / px};
};

/** One texel per dot of the floor's dotted world map. */
export const makeDotsTexture = (cols: number, rows: number, mask: string) => {
  const data = new Uint8Array(cols * rows);
  for (let i = 0; i < data.length; i++) data[i] = mask[i] === '1' ? 255 : 0;
  const tex = new THREE.DataTexture(data, cols, rows, THREE.RedFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
};

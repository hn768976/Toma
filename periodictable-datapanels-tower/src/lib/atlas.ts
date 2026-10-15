import * as THREE from "three";
import { ELEMENTS, type Element } from "./elements";

// Renders all 118 element tiles once into one texture atlas.
// Every text string is measured against the room it has; if anything
// overflows, buildAtlas() throws (which fails the render) – the "fit check".

export type TileStyle = {
  id: string;
  px: number; // tile width in atlas pixels
  aspect: number; // height / width
  layout: "classic" | "detailed";
  bg: string;
  border: string;
  borderWidth: number; // fraction of width
  radius: number; // fraction of width
  inset: number; // border inset, fraction of width
  symbol: string; // colours
  text: string;
  sub: string;
  showName: boolean;
  showMass: boolean;
  showCategory?: boolean;
  categorySize?: number;
  innerRule?: string; // optional faint second frame line inside the border
  symbolWeight: number;
  symbolSize: number; // fractions of width
  numberSize: number;
  nameSize: number;
  massSize: number;
  shellSize?: number;
  oxSize?: number;
  // Extra, look-specific decoration (drawn last), e.g. a glass sheen.
  decorate?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
};

export type FitIssue = { symbol: string; field: string; need: number; room: number };

export type Atlas = {
  texture: THREE.CanvasTexture;
  // atlas rect of each tile [u0, v0, u1, v1] (v up, texture flipY = true)
  rect: (z: number) => [number, number, number, number];
  blankRect: [number, number, number, number]; // an empty tile (index 118)
  aspect: number;
  issues: FitIssue[];
  checked: number;
  // rects of slots 0..119 as a 120×1 float texture (for texelFetch in shaders)
  rectTexture: THREE.DataTexture;
};

const COLS = 12;
const ROWS = 10; // 120 slots: 118 elements + blank + spare

const font = (weight: number, sizePx: number, family = "Inter") => `${weight} ${sizePx.toFixed(2)}px "${family}"`;

const drawTile = (
  ctx: CanvasRenderingContext2D,
  e: Element | null,
  s: TileStyle,
  issues: FitIssue[],
) => {
  const W = s.px;
  const H = Math.round(s.px * s.aspect);
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, W, H);
  if (s.borderWidth > 0) {
    const bw = Math.max(1, s.borderWidth * W);
    const ins = s.inset * W + bw / 2;
    ctx.strokeStyle = s.border;
    ctx.lineWidth = bw;
    ctx.beginPath();
    ctx.roundRect(ins, ins, W - 2 * ins, H - 2 * ins, s.radius * W);
    ctx.stroke();
    if (s.innerRule && s.innerRule !== "none") {
      const ins2 = ins + bw * 2.2;
      ctx.strokeStyle = s.innerRule;
      ctx.lineWidth = Math.max(1, bw * 0.6);
      ctx.beginPath();
      ctx.roundRect(ins2, ins2, W - 2 * ins2, H - 2 * ins2, Math.max(0, s.radius * W - bw));
      ctx.stroke();
    }
  }
  if (!e) return;

  const pad = W * (s.inset + 0.075);
  const room = W - 2 * pad;
  // vertical check: the text drawn at baseline `base` must stay between top and bottom
  const fitV = (field: string, text: string, base: number, top: number, bottom: number) => {
    const m = ctx.measureText(text);
    const t = base - m.actualBoundingBoxAscent;
    const b = base + m.actualBoundingBoxDescent;
    if (t < top - 0.01 || b > bottom + 0.01)
      issues.push({ symbol: e.symbol, field: `${field} (vertical)`, need: Math.ceil(b - t), room: Math.floor(bottom - top) });
    return { t, b };
  };
  const fit = (field: string, text: string, max = room) => {
    const need = ctx.measureText(text).width;
    if (need > max + 0.01) issues.push({ symbol: e.symbol, field, need: Math.ceil(need), room: Math.floor(max) });
    return need;
  };
  ctx.textBaseline = "alphabetic";

  if (s.layout === "classic") {
    // number top-left, mass top-right, big centred symbol, name below.
    const topY = pad + s.numberSize * W * 0.85;
    ctx.fillStyle = s.text;
    ctx.font = font(500, s.numberSize * W);
    ctx.textAlign = "left";
    const nW = fit("number", String(e.z));
    ctx.fillText(String(e.z), pad, topY);
    if (s.showMass) {
      ctx.font = font(400, s.massSize * W);
      ctx.textAlign = "right";
      fit("mass", e.mass, room - nW - W * 0.04);
      ctx.fillText(e.mass, W - pad, topY);
    }
    ctx.fillStyle = s.symbol;
    ctx.font = font(s.symbolWeight, s.symbolSize * W);
    ctx.textAlign = "center";
    fit("symbol", e.symbol);
    const symBase = H * (s.showName ? (s.showCategory ? 0.535 * 1.08 / s.aspect : 0.6) : 0.7);
    const nameBase = symBase + Math.max(s.nameSize * 2.0, 0.21) * W;
    const nameTop = nameBase - s.nameSize * W * 0.78;
    const bottom = H - W * s.inset - W * 0.03;
    const catSize = (s.categorySize ?? 0.06) * W;
    const catBase = bottom - catSize * 0.35;
    fitV("symbol", e.symbol, symBase, topY + W * 0.02, s.showName ? nameTop - W * 0.01 : H - pad);
    ctx.fillText(e.symbol, W / 2, symBase);
    if (s.showName) {
      ctx.fillStyle = s.sub;
      ctx.font = font(500, s.nameSize * W);
      fit("name", e.name);
      const nb = fitV("name", e.name, nameBase, nameTop - W * 0.01, s.showCategory ? catBase - catSize * 0.85 : bottom);
      ctx.fillText(e.name, W / 2, nameBase);
      if (s.showCategory) {
        ctx.font = font(500, catSize);
        fit("category", e.categoryLabel);
        fitV("category", e.categoryLabel, catBase, nb.b + W * 0.01, bottom + W * 0.02);
        ctx.fillText(e.categoryLabel, W / 2, catBase);
      }
    }
    return;
  }

  // detailed: number + oxidation states (top right, stacked), symbol, name,
  // mass, and electron shells as a dashed string at the bottom.
  const nSize = s.numberSize * W;
  const oSize = (s.oxSize ?? 0.1) * W;
  ctx.fillStyle = s.text;
  ctx.font = font(600, nSize);
  ctx.textAlign = "left";
  const nW = fit("number", String(e.z));
  ctx.fillText(String(e.z), pad, pad + nSize * 0.8);

  ctx.font = font(500, oSize);
  ctx.textAlign = "right";
  let oxW = 0;
  e.oxidation.forEach((o, i) => {
    oxW = Math.max(oxW, fit("oxidation", o, room - nW - W * 0.05));
    ctx.fillText(o, W - pad, pad + oSize * 0.8 + i * oSize * 1.05);
  });
  const oxBottom = pad + e.oxidation.length * oSize * 1.05;

  // centred block: symbol, name, mass, shells
  const symSize = s.symbolSize * W;
  const symBase = H * 0.5;
  ctx.fillStyle = s.symbol;
  ctx.font = font(s.symbolWeight, symSize);
  ctx.textAlign = "center";
  // the symbol may not run into the oxidation column at the top right
  const symTop = symBase - symSize * 0.72;
  const symRoom = symTop < oxBottom ? room - 2 * oxW - W * 0.06 : room;
  fit("symbol", e.symbol, symRoom);
  const nameBase = symBase + s.nameSize * W * 1.7;
  fitV("symbol", e.symbol, symBase, pad + nSize * 0.9, nameBase - s.nameSize * W * 0.78);
  ctx.fillText(e.symbol, W / 2, symBase);

  ctx.fillStyle = s.sub;
  ctx.font = font(600, s.nameSize * W);
  fit("name", e.name);
  ctx.fillText(e.name, W / 2, nameBase);

  ctx.fillStyle = s.text;
  ctx.font = font(700, s.massSize * W);
  fit("mass", e.mass);
  const massBase = nameBase + s.massSize * W * 1.3;
  ctx.fillText(e.mass, W / 2, massBase);

  const shSize = (s.shellSize ?? 0.1) * W;
  ctx.fillStyle = s.sub;
  ctx.font = font(500, shSize);
  fit("shells", e.shells);
  const shellBase = massBase + shSize * 1.35;
  if (shellBase > H - pad * 0.5) issues.push({ symbol: e.symbol, field: "shells (height)", need: Math.ceil(shellBase), room: Math.floor(H - pad * 0.5) });
  ctx.fillText(e.shells, W / 2, shellBase);
};

export const buildAtlas = (s: TileStyle, gl: THREE.WebGLRenderer, opts: { throwOnOverflow?: boolean } = {}): Atlas => {
  const W = s.px;
  const H = Math.round(s.px * s.aspect);
  const pad = Math.max(8, Math.round(W * 0.04)); // gutter repeats the tile edge
  const cw = W + 2 * pad;
  const ch = H + 2 * pad;
  const canvas = document.createElement("canvas");
  canvas.width = cw * COLS;
  canvas.height = ch * ROWS;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas unavailable");
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const tile = document.createElement("canvas");
  tile.width = W;
  tile.height = H;
  const tctx = tile.getContext("2d")!;
  const issues: FitIssue[] = [];
  const rects: [number, number, number, number][] = [];

  const place = (slot: number, e: Element | null) => {
    tctx.save();
    tctx.clearRect(0, 0, W, H);
    drawTile(tctx, e, s, issues);
    s.decorate?.(tctx, W, H);
    tctx.restore();
    const x = (slot % COLS) * cw + pad;
    const y = Math.floor(slot / COLS) * ch + pad;
    // gutters: stretch the tile's outermost pixels outwards so mipmaps never
    // pull in a neighbour.
    ctx.drawImage(tile, 0, 0, W, 1, x, y - pad, W, pad);
    ctx.drawImage(tile, 0, H - 1, W, 1, x, y + H, W, pad);
    ctx.drawImage(tile, 0, 0, 1, H, x - pad, y, pad, H);
    ctx.drawImage(tile, W - 1, 0, 1, H, x + W, y, pad, H);
    ctx.drawImage(tile, 0, 0, 1, 1, x - pad, y - pad, pad, pad);
    ctx.drawImage(tile, W - 1, 0, 1, 1, x + W, y - pad, pad, pad);
    ctx.drawImage(tile, 0, H - 1, 1, 1, x - pad, y + H, pad, pad);
    ctx.drawImage(tile, W - 1, H - 1, 1, 1, x + W, y + H, pad, pad);
    ctx.drawImage(tile, x, y);
    const u0 = x / canvas.width;
    const u1 = (x + W) / canvas.width;
    const v1 = 1 - y / canvas.height;
    const v0 = 1 - (y + H) / canvas.height;
    rects[slot] = [u0, v0, u1, v1];
  };

  ELEMENTS.forEach((e, i) => place(i, e));
  place(118, null);

  if (issues.length && opts.throwOnOverflow !== false) {
    const list = issues.map((i) => `${i.symbol}.${i.field} needs ${i.need}px, has ${i.room}px`).join("; ");
    throw new Error(`Tile fit check failed for atlas "${s.id}": ${list}`);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = gl.capabilities.getMaxAnisotropy();
  texture.needsUpdate = true;

  const rectData = new Float32Array(120 * 4);
  rects.forEach((r, i) => rectData.set(r, i * 4));
  const rectTexture = new THREE.DataTexture(rectData, 120, 1, THREE.RGBAFormat, THREE.FloatType);
  rectTexture.needsUpdate = true;

  return {
    texture,
    rectTexture,
    rect: (z: number) => rects[z - 1],
    blankRect: rects[118],
    aspect: s.aspect,
    issues,
    checked: 118,
  };
};

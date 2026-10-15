// Bakes the anatomy into one RGBA mask texture, once, at backing resolution:
//   R = sharp anatomical lines, G = tissue fill / density, B = soft glow
//   (blurred lines), A = "active" tracks that light up gold/cyan.
import { BufferImageSource, Texture } from "pixi.js";
import { mulberry32, range } from "../../lib/rand";
import { catmull, catmullClosed, V2 } from "../../lib/spline";
import * as A from "./anatomy";

/** Supersampling headroom so the slow push (up to +6%) stays crisp. */
export const SS = 1.06;

const path = (pts: V2[], closed = false, seg = 12) => {
  const p = new Path2D();
  const c = closed ? catmullClosed(pts, seg) : catmull(pts, seg);
  p.moveTo(c[0][0], c[0][1]);
  for (let i = 1; i < c.length; i++) p.lineTo(c[i][0], c[i][1]);
  if (closed) p.closePath();
  return p;
};
const rawPath = (pts: V2[], closed = false) => {
  const p = new Path2D();
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
  if (closed) p.closePath();
  return p;
};
const brainstemPoly = () => [...catmull(A.BRAINSTEM_DORSAL, 8), ...catmull(A.BRAINSTEM_VENTRAL, 8).reverse()];

type Ctx = CanvasRenderingContext2D;

const mkCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, w, h);
  return { c, ctx };
};

const stroke = (ctx: Ctx, p: Path2D, w: number, a: number) => {
  ctx.lineWidth = w;
  ctx.strokeStyle = `rgba(255,255,255,${a})`;
  ctx.stroke(p);
};
const fill = (ctx: Ctx, p: Path2D, a: number, col = 255) => {
  ctx.fillStyle = `rgba(${col},${col},${col},${a})`;
  ctx.fill(p);
};

const drawLines = (ctx: Ctx, g: A.Generated) => {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  stroke(ctx, path(A.SKIN), 2.0, 1);
  stroke(ctx, path(A.SKULL_OUT), 1.3, 0.75);
  stroke(ctx, path(A.SKULL_IN), 1.4, 0.85);
  stroke(ctx, path(A.SKULL_BASE), 1.1, 0.6);
  // bony floor of the cranium (separates brain from nasal cavity)
  stroke(ctx, path(A.SKULL_BASE.map(([x, y]) => [x, y + 7] as V2)), 0.9, 0.45);
  stroke(ctx, path(A.CLIVUS, true), 1.0, 0.6);
  stroke(ctx, path(A.CEREBRUM, true), 1.6, 1);
  for (const s of g.sulci) stroke(ctx, rawPath(s), 1.35, 0.9);
  stroke(ctx, path(A.CORPUS_CALLOSUM, true, 8), 1.4, 1);
  stroke(ctx, path(A.FORNIX), 1.1, 0.8);
  stroke(ctx, path(A.CINGULATE_SULCUS), 1.2, 0.9);
  stroke(ctx, path(A.THALAMUS, true), 1.0, 0.65);
  stroke(ctx, path(A.HYPOTHALAMUS), 0.9, 0.55);
  stroke(ctx, path(A.PITUITARY, true), 0.9, 0.75);
  stroke(ctx, path(A.PITUITARY_STALK), 0.9, 0.6);
  for (const l of A.LANDMARKS) stroke(ctx, path(l, false, 8), 1.7, 1);
  stroke(ctx, path(A.BRAINSTEM_DORSAL), 1.5, 1);
  stroke(ctx, path(A.BRAINSTEM_VENTRAL), 1.5, 1);
  stroke(ctx, path(A.FOURTH_VENTRICLE), 0.9, 0.7);
  for (const l of A.PONS_LINES) stroke(ctx, path(l), 0.7, 0.45);
  stroke(ctx, path(A.CEREBELLUM, true), 1.4, 1);
  stroke(ctx, path(A.PEDUNCLE, true), 1.0, 0.7);
  stroke(ctx, path(A.PONS, true), 1.1, 0.75);
  stroke(ctx, path(A.DENS, true), 0.9, 0.55);
  stroke(ctx, path(A.CANAL_FRONT), 0.8, 0.45);
  stroke(ctx, path(A.CANAL_BACK), 0.8, 0.45);
  for (const f of g.folia) stroke(ctx, path(f, false, 4), 0.5, 0.5);
  for (const b of g.arbor) stroke(ctx, rawPath(b.pts), Math.max(0.5, b.w * 0.55), 0.95);
  for (const vb of A.VERTEBRAE) {
    ctx.save();
    ctx.translate(vb.c[0], vb.c[1]);
    ctx.rotate(vb.a);
    ctx.lineWidth = 1.0;
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.roundRect(-vb.w / 2, -vb.h / 2, vb.w, vb.h, 5);
    ctx.stroke();
    ctx.restore();
  }
  for (const sp of A.SPINOUS) stroke(ctx, path(sp), 0.9, 0.4);
  stroke(ctx, path(A.FRONTAL_SINUS, true), 0.8, 0.55);
  stroke(ctx, path(A.NASAL_CAVITY, true), 0.9, 0.55);
  for (const t of A.TURBINATES) stroke(ctx, path(t, true), 0.8, 0.55);
  stroke(ctx, path(A.SPHENOID_SINUS, true), 0.8, 0.5);
  stroke(ctx, path(A.PALATE), 1.3, 0.8);
  stroke(ctx, path(A.PALATE_LOWER), 1.0, 0.6);
  stroke(ctx, path(A.SOFT_PALATE), 1.0, 0.6);
  stroke(ctx, path(A.PHARYNX_BACK), 0.9, 0.55);
  stroke(ctx, path(A.PHARYNX_FRONT), 0.9, 0.5);
  stroke(ctx, path(A.TONGUE, true), 1.1, 0.7);
  stroke(ctx, path(A.MANDIBLE), 1.4, 0.75);
  stroke(ctx, path(A.TEETH_UP, true), 0.8, 0.6);
  stroke(ctx, path(A.TEETH_LO, true), 0.8, 0.6);
  stroke(ctx, path(A.LIP_LINE), 0.6, 0.45);
};

const drawFill = (ctx: Ctx, g: A.Generated, px: number) => {
  const r = mulberry32(777001);
  const skin = path(A.SKIN);
  const skinClosed = new Path2D();
  skinClosed.addPath(skin);
  skinClosed.lineTo(262, 540);
  // soft tissue
  fill(ctx, skinClosed, 0.16);
  // fresnel-like rim inside the skin
  ctx.save();
  ctx.clip(skinClosed);
  ctx.filter = `blur(${5 * px}px)`;
  stroke(ctx, skin, 12, 0.55);
  ctx.filter = "none";
  ctx.restore();
  // skull bone band with marrow speckle
  const band = new Path2D();
  const out = catmull(A.SKULL_OUT, 12);
  const inn = catmull(A.SKULL_IN, 12);
  band.moveTo(out[0][0], out[0][1]);
  for (const p of out) band.lineTo(p[0], p[1]);
  for (const p of [...inn].reverse()) band.lineTo(p[0], p[1]);
  band.closePath();
  fill(ctx, band, 0.32);
  ctx.save();
  ctx.clip(band);
  for (let i = 0; i < 2600; i++) {
    const t = r();
    const k = Math.min(out.length - 1, Math.floor(t * out.length));
    const kk = Math.min(inn.length - 1, Math.floor(t * inn.length));
    const f = r();
    const x = out[k][0] * (1 - f) + inn[kk][0] * f + range(r, -2, 2);
    const y = out[k][1] * (1 - f) + inn[kk][1] * f + range(r, -2, 2);
    ctx.fillStyle = r() < 0.5 ? "rgba(0,0,0,0.5)" : "rgba(255,255,255,0.35)";
    ctx.beginPath();
    ctx.arc(x, y, range(r, 0.4, 1.2), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // brain parenchyma, with darker sulci and a bright inner rim
  const cer = path(A.CEREBRUM, true);
  fill(ctx, cer, 0.3);
  ctx.save();
  ctx.clip(cer);
  // gyri: convex folds brighter, sulcal floors darker
  {
    const gy = g.gyri;
    const gc = document.createElement("canvas");
    gc.width = gy.w;
    gc.height = gy.h;
    const gctx = gc.getContext("2d")!;
    const id = gctx.createImageData(gy.w, gy.h);
    for (let k = 0; k < gy.data.length; k++) {
      const val = Math.round(255 * gy.data[k]);
      id.data[k * 4] = id.data[k * 4 + 1] = id.data[k * 4 + 2] = val;
      id.data[k * 4 + 3] = 255;
    }
    gctx.putImageData(id, 0, 0);
    ctx.globalAlpha = 0.22;
    ctx.globalCompositeOperation = "lighter";
    ctx.imageSmoothingQuality = "high";
    ctx.filter = `blur(${1.2 * px}px)`;
    ctx.drawImage(gc, gy.x0, gy.y0);
    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  }
  ctx.filter = `blur(${4 * px}px)`;
  stroke(ctx, cer, 9, 0.5);
  ctx.filter = "none";
  ctx.restore();
  fill(ctx, path(A.CORPUS_CALLOSUM, true, 8), 0.5);
  fill(ctx, path(A.THALAMUS, true), 0.18);
  const cb = path(A.CEREBELLUM, true);
  fill(ctx, cb, 0.3);
  ctx.save();
  ctx.clip(cb);
  ctx.filter = `blur(${3 * px}px)`;
  stroke(ctx, cb, 8, 0.45);
  ctx.filter = "none";
  ctx.restore();
  fill(ctx, rawPath(brainstemPoly(), true), 0.42);
  fill(ctx, path(A.PEDUNCLE, true), 0.4);
  fill(ctx, path(A.PONS, true), 0.22);
  fill(ctx, path(A.SEPTUM, true), 0.12);
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fill(path([[420, 232], [455, 225], [494, 227], [512, 238], [470, 236], [430, 244]] as V2[], true));
  fill(ctx, path(A.CLIVUS, true), 0.35);
  fill(ctx, path(A.DENS, true), 0.3);
  ctx.fillStyle = "rgba(0,0,0,0.7)";
  ctx.fill(path(A.FOURTH_VENTRICLE, true));
  // vertebral bodies
  for (const vb of A.VERTEBRAE) {
    ctx.save();
    ctx.translate(vb.c[0], vb.c[1]);
    ctx.rotate(vb.a);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.beginPath();
    ctx.roundRect(-vb.w / 2, -vb.h / 2, vb.w, vb.h, 5);
    ctx.fill();
    ctx.restore();
  }
  // air spaces are dark
  const air = (p: Path2D, a: number) => {
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fill(p);
  };
  air(path(A.NASAL_CAVITY, true), 0.55);
  air(path(A.SPHENOID_SINUS, true), 0.6);
  air(path(A.FRONTAL_SINUS, true), 0.6);
  const airway = rawPath([...catmull(A.PHARYNX_BACK, 8), ...catmull(A.PHARYNX_FRONT, 8).reverse()], true);
  air(airway, 0.55);
  fill(ctx, path(A.TONGUE, true), 0.12);
  const floor = rawPath([...catmull(A.SKULL_BASE, 8), ...catmull(A.SKULL_BASE.map(([x, y]) => [x, y + 7] as V2), 8).reverse()], true);
  fill(ctx, floor, 0.35);
  const pal = rawPath([...catmull(A.PALATE, 8), ...catmull(A.PALATE_LOWER, 8).reverse()], true);
  fill(ctx, pal, 0.4);
  fill(ctx, path(A.PITUITARY, true), 0.35);
  for (const t of A.TURBINATES) fill(ctx, path(t, true), 0.2);
  fill(ctx, path(A.TEETH_UP, true), 0.4);
  fill(ctx, path(A.TEETH_LO, true), 0.4);
};

const drawActive = (ctx: Ctx, g: A.Generated) => {
  const r = mulberry32(5150);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const s of g.sulci) stroke(ctx, rawPath(s), 1.3, range(r, 0.45, 1));
  stroke(ctx, path(A.CINGULATE_SULCUS), 1.4, 0.9);
  stroke(ctx, path(A.CORPUS_CALLOSUM, true, 8), 1.3, 0.8);
  stroke(ctx, path(A.FORNIX), 1.2, 0.8);
  for (const b of g.arbor) stroke(ctx, rawPath(b.pts), Math.max(0.5, b.w * 0.5), 0.7);
  for (const l of A.LANDMARKS) stroke(ctx, path(l, false, 8), 1.6, 0.9);
  stroke(ctx, path(A.BRAINSTEM_DORSAL), 1.2, 0.5);
};

let GEN: A.Generated | null = null;
export const anatomy = () => (GEN ??= A.generate());

export const bakeBrain = (W: number, H: number, res: number) => {
  const g = anatomy();
  const cw = Math.round(W * res * SS);
  const ch = Math.round(H * res * SS);
  const scale = (cw / W) * A.K; // canvas px per reference unit
  const px = scale; // blur radii are given in reference units
  const layer = (draw: (ctx: Ctx) => void) => {
    const { c, ctx } = mkCanvas(cw, ch);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    draw(ctx);
    return c;
  };
  const lines = layer((ctx) => drawLines(ctx, g));
  const fillC = layer((ctx) => drawFill(ctx, g, px));
  const active = layer((ctx) => drawActive(ctx, g));
  // glow = lines blurred at two radii
  const { c: glow, ctx: gctx } = mkCanvas(cw, ch);
  gctx.globalCompositeOperation = "lighter";
  gctx.filter = `blur(${1.6 * px}px)`;
  gctx.globalAlpha = 0.9;
  gctx.drawImage(lines, 0, 0);
  gctx.filter = `blur(${6 * px}px)`;
  gctx.globalAlpha = 0.8;
  gctx.drawImage(lines, 0, 0);
  const { c: act2, ctx: actx } = mkCanvas(cw, ch);
  actx.filter = `blur(${0.6 * px}px)`;
  actx.drawImage(active, 0, 0);

  const read = (c: HTMLCanvasElement) => c.getContext("2d")!.getImageData(0, 0, cw, ch).data;
  const R = read(lines), G = read(fillC), B = read(glow), Aa = read(act2);
  const out = new Uint8Array(cw * ch * 4);
  for (let i = 0; i < cw * ch; i++) {
    out[i * 4] = R[i * 4];
    out[i * 4 + 1] = G[i * 4];
    out[i * 4 + 2] = B[i * 4];
    out[i * 4 + 3] = Aa[i * 4];
  }
  const tex = new Texture({
    source: new BufferImageSource({ resource: out, width: cw, height: ch, format: "rgba8unorm", alphaMode: "no-premultiply-alpha" }),
  });
  tex.source.style.scaleMode = "linear";
  tex.source.style.addressMode = "clamp-to-edge";
  return tex;
};

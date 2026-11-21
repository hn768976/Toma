import * as THREE from "three";
import { BARREL, MARKINGS, type Palette } from "../config";
import { SURFACE } from "../look";
import { noiseCanvas } from "../lib/noise";
import { mulberry32, range } from "../lib/random";
import { MARKING_FONT } from "./fonts";

const TEX_W = 4096;
const TEX_H = 2048;
const CIRC = 2 * Math.PI * BARREL.radius;

const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/**
 * Draws stripes, text and the warning sign. `x`/`y` convert metres to pixels,
 * so the same routine paints the colour map and the roughness map.
 */
const drawMarkings = (ctx: CanvasRenderingContext2D, w: number, h: number, ink: string) => {
  const x = (m: number) => (m / CIRC) * w;
  const y = (m: number) => (m / BARREL.height) * h;
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;

  // hazard stripe bands just inside both rims, all the way round
  const [b0, b1] = MARKINGS.stripeBandFromEnd;
  const count = Math.round(CIRC / MARKINGS.stripePitch);
  const pitch = w / count;
  for (const [ya, yb] of [
    [y(b0), y(b1)],
    [y(BARREL.height - b1), y(BARREL.height - b0)],
  ]) {
    for (let k = -1; k <= count; k++) {
      const x0 = k * pitch;
      ctx.beginPath();
      ctx.moveTo(x0 + x(MARKINGS.stripeSlant), ya);
      ctx.lineTo(x0 + x(MARKINGS.stripeSlant + MARKINGS.stripeLength), ya);
      ctx.lineTo(x0 + x(MARKINGS.stripeLength), yb);
      ctx.lineTo(x0, yb);
      ctx.closePath();
      ctx.fill();
    }
  }

  for (let r = 0; r < MARKINGS.repeats; r++) {
    const cx = ((r + 0.5) / MARKINGS.repeats) * w;

    // two lines of stencilled text, fitted to a physical width
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const probe = 200;
    ctx.font = `800 ${probe}px ${MARKING_FONT}`;
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${probe * MARKINGS.letterSpacingEm}px`;
    const fontPx = (probe * x(MARKINGS.textWidth)) / ctx.measureText(MARKINGS.line1).width;
    ctx.font = `800 ${fontPx}px ${MARKING_FONT}`;
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${fontPx * MARKINGS.letterSpacingEm}px`;
    // canvas text is not stretched: texture pixels are ~square in metres
    ctx.fillText(MARKINGS.line1, cx + fontPx * MARKINGS.letterSpacingEm * 0.5, y(MARKINGS.textLine1Y));
    ctx.fillText(MARKINGS.line2, cx + fontPx * MARKINGS.letterSpacingEm * 0.5, y(MARKINGS.textLine2Y));
    (ctx as unknown as { letterSpacing: string }).letterSpacing = "0px";

    // warning sign: rounded triangle outline with a trefoil
    const side = MARKINGS.signSide;
    const triH = (side * Math.sqrt(3)) / 2;
    const top = MARKINGS.signTopY;
    const sx = w / CIRC;
    const sy = h / BARREL.height;
    ctx.save();
    ctx.translate(cx, y(top));
    ctx.scale(sx, sy);
    const corner = 0.02;
    ctx.lineWidth = MARKINGS.signStroke;
    ctx.lineJoin = "round";
    ctx.beginPath();
    const pts: [number, number][] = [
      [0, 0],
      [side / 2, triH],
      [-side / 2, triH],
    ];
    for (let i = 0; i < 3; i++) {
      const p = pts[i];
      const n = pts[(i + 1) % 3];
      const mid: [number, number] = [(p[0] + n[0]) / 2, (p[1] + n[1]) / 2];
      if (i === 0) {
        const prev = pts[2];
        ctx.moveTo((prev[0] + p[0]) / 2, (prev[1] + p[1]) / 2);
      }
      ctx.arcTo(p[0], p[1], mid[0], mid[1], corner);
      ctx.lineTo(mid[0], mid[1]);
    }
    ctx.closePath();
    ctx.stroke();
    // trefoil at the centroid: hub + three 60-degree blades (one pointing down)
    const cy = (triH * 2) / 3;
    const u = side * 0.052;
    ctx.beginPath();
    ctx.arc(0, cy, u, 0, Math.PI * 2);
    ctx.fill();
    for (const deg of [90, 210, 330]) {
      const a0 = ((deg - 30) * Math.PI) / 180;
      const a1 = ((deg + 30) * Math.PI) / 180;
      ctx.beginPath();
      ctx.arc(0, cy, u * 1.5, a0, a1);
      ctx.arc(0, cy, u * 5, a1, a0, true);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
};

export type BarrelTextures = {
  map: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  normalMap: THREE.DataTexture;
  dispose: () => void;
};

/** Paint, wear and markings for the drums. Fully procedural and seeded. */
export const buildBarrelTextures = (palette: Palette): BarrelTextures => {
  const rnd = mulberry32(9137);
  const y = (m: number, h: number) => (m / BARREL.height) * h;
  const hoopYs = BARREL.hoopsFromTop.map((f) => f * BARREL.height);

  // shared noise layers: large variation, medium blotches, fine grain
  const large = noiseCanvas(512, 256, 11, 6, 3, 4, 0.55);
  const medium = noiseCanvas(1024, 512, 23, 40, 20, 3, 0.6);
  const fine = noiseCanvas(1024, 512, 37, 256, 128, 2, 0.6);

  // ---- colour ---------------------------------------------------------------
  const colour = makeCanvas(TEX_W, TEX_H);
  const c = colour.getContext("2d")!;
  c.fillStyle = palette.paint;
  c.fillRect(0, 0, TEX_W, TEX_H);

  // grime under rims and hoops (soft bands) and long vertical streaks
  const band = (centre: number, halfM: number, alpha: number) => {
    const g = c.createLinearGradient(0, y(centre - halfM, TEX_H), 0, y(centre + halfM, TEX_H));
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(0.5, palette.grime);
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.globalAlpha = alpha;
    c.fillStyle = g;
    c.fillRect(0, y(centre - halfM, TEX_H), TEX_W, y(2 * halfM, TEX_H));
  };
  c.globalCompositeOperation = "multiply";
  band(0.004, 0.03, 0.45);
  band(BARREL.height - 0.004, 0.03, 0.45);
  for (const hy of hoopYs) band(hy + 0.012, 0.03, 0.3);
  for (let i = 0; i < 150; i++) {
    const sx = rnd() * TEX_W;
    const startM = [0.01, ...hoopYs][Math.floor(rnd() * 3)] + range(rnd, 0, 0.02);
    const len = range(rnd, 0.05, 0.3);
    const wpx = range(rnd, 6, 46);
    const g = c.createLinearGradient(0, y(startM, TEX_H), 0, y(startM + len, TEX_H));
    g.addColorStop(0, palette.grime);
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.globalAlpha = range(rnd, 0.02, 0.06);
    c.fillStyle = g;
    c.fillRect(sx, y(startM, TEX_H), wpx, y(len, TEX_H));
    if (sx + wpx > TEX_W) c.fillRect(sx - TEX_W, y(startM, TEX_H), wpx, y(len, TEX_H));
  }
  // smudges and dirty patches: soft dark blotches of different sizes
  for (let i = 0; i < 70; i++) {
    const bx = rnd() * TEX_W;
    const by = rnd() * TEX_H;
    const br = range(rnd, 60, 340);
    const g = c.createRadialGradient(bx, by, 0, bx, by, br);
    g.addColorStop(0, palette.grime);
    g.addColorStop(1, "rgba(0,0,0,0)");
    c.globalAlpha = range(rnd, 0.04, 0.13);
    c.fillStyle = g;
    for (const ox of [0, -TEX_W, TEX_W]) c.fillRect(bx - br + ox, by - br, br * 2, br * 2);
  }
  c.globalAlpha = 0.2;
  c.drawImage(large, 0, 0, TEX_W, TEX_H);
  c.globalAlpha = 0.09;
  c.drawImage(medium, 0, 0, TEX_W, TEX_H);
  c.globalAlpha = 0.02;
  c.drawImage(fine, 0, 0, TEX_W, TEX_H);
  c.globalCompositeOperation = "source-over";

  // markings, slightly worn
  c.globalAlpha = 1;
  drawMarkings(c, TEX_W, TEX_H, palette.ink);

  // scratches and chips: thin light and dark marks over paint and ink
  const scratches: { x: number; y: number; dx: number; dy: number; w: number; light: boolean }[] = [];
  for (let i = 0; i < 160; i++) {
    const len = range(rnd, 10, 150);
    const ang = range(rnd, -0.5, 0.5) + (rnd() < 0.25 ? Math.PI / 2 : 0);
    scratches.push({
      x: rnd() * TEX_W,
      y: rnd() * TEX_H,
      dx: Math.cos(ang) * len,
      dy: Math.sin(ang) * len,
      w: range(rnd, 0.8, 2.6),
      light: rnd() < 0.6,
    });
  }
  for (const s of scratches) {
    c.globalAlpha = s.light ? 0.1 : 0.13;
    c.strokeStyle = s.light ? "#fff6c8" : palette.grime;
    c.lineWidth = s.w;
    c.beginPath();
    c.moveTo(s.x, s.y);
    c.lineTo(s.x + s.dx, s.y + s.dy);
    c.stroke();
  }
  c.globalAlpha = 1;

  // ---- roughness (green channel is read by the material) ----------------------
  const RW = 2048;
  const RH = 1024;
  const rough = makeCanvas(RW, RH);
  const r = rough.getContext("2d")!;
  const base = Math.round(SURFACE.roughness * 255);
  r.fillStyle = `rgb(${base},${base},${base})`;
  r.fillRect(0, 0, RW, RH);
  r.globalCompositeOperation = "overlay";
  r.globalAlpha = Math.min(1, SURFACE.roughnessVariation * 4);
  r.drawImage(large, 0, 0, RW, RH);
  r.globalAlpha = Math.min(1, SURFACE.roughnessVariation * 2.5);
  r.drawImage(medium, 0, 0, RW, RH);
  r.globalCompositeOperation = "source-over";
  r.globalAlpha = 0.5;
  drawMarkings(r, RW, RH, "#c8c8c8"); // ink is flatter than paint
  for (const s of scratches) {
    r.globalAlpha = 0.5;
    r.strokeStyle = "#d8d8d8";
    r.lineWidth = Math.max(1, s.w * 0.5);
    r.beginPath();
    r.moveTo(s.x / 2, s.y / 2);
    r.lineTo((s.x + s.dx) / 2, (s.y + s.dy) / 2);
    r.stroke();
  }
  r.globalAlpha = 1;

  // ---- bump: shallow dents + scratch grooves -----------------------------------
  const bump = makeCanvas(RW, RH);
  const b = bump.getContext("2d")!;
  b.fillStyle = "#808080";
  b.fillRect(0, 0, RW, RH);
  b.globalCompositeOperation = "overlay";
  b.globalAlpha = 0.55;
  b.drawImage(large, 0, 0, RW, RH);
  b.globalAlpha = 0.05;
  b.drawImage(medium, 0, 0, RW, RH);
  b.globalCompositeOperation = "source-over";
  for (const s of scratches) {
    b.globalAlpha = 0.08;
    b.strokeStyle = "#5a5a5a";
    b.lineWidth = Math.max(1, s.w * 0.5);
    b.beginPath();
    b.moveTo(s.x / 2, s.y / 2);
    b.lineTo((s.x + s.dx) / 2, (s.y + s.dy) / 2);
    b.stroke();
  }
  b.globalAlpha = 1;

  // height -> tangent-space normal map (one texture read at render time instead of
  // the three a bump map needs)
  const hd = b.getImageData(0, 0, RW, RH).data;
  const nd = new Uint8Array(RW * RH * 4);
  const hAt = (px: number, py: number) =>
    hd[(Math.min(RH - 1, Math.max(0, py)) * RW + ((px + RW) % RW)) * 4] / 255;
  for (let py = 0; py < RH; py++) {
    for (let px = 0; px < RW; px++) {
      const dx = (hAt(px + 1, py) - hAt(px - 1, py)) * 6.0;
      const dy = (hAt(px, py + 1) - hAt(px, py - 1)) * 6.0;
      const inv = 1 / Math.hypot(dx, dy, 1);
      // rows are stored bottom-up (v = 0 at the bottom of the drum)
      const o = ((RH - 1 - py) * RW + px) * 4;
      nd[o] = Math.round((-dx * inv * 0.5 + 0.5) * 255);
      nd[o + 1] = Math.round((dy * inv * 0.5 + 0.5) * 255);
      nd[o + 2] = Math.round((inv * 0.5 + 0.5) * 255);
      nd[o + 3] = 255;
    }
  }
  const normalMap = new THREE.DataTexture(nd, RW, RH, THREE.RGBAFormat);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.ClampToEdgeWrapping;
  normalMap.minFilter = THREE.LinearMipmapLinearFilter;
  normalMap.magFilter = THREE.LinearFilter;
  normalMap.generateMipmaps = true;
  normalMap.needsUpdate = true;

  const wrap = (canvas: HTMLCanvasElement, srgb: boolean) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    t.anisotropy = srgb ? 4 : 1;
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.needsUpdate = true;
    return t;
  };
  const map = wrap(colour, true);
  const roughnessMap = wrap(rough, false);
  return {
    map,
    roughnessMap,
    normalMap,
    dispose: () => {
      map.dispose();
      roughnessMap.dispose();
      normalMap.dispose();
    },
  };
};

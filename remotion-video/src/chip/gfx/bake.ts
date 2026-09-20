import {
  Container,
  Graphics,
  RenderTexture,
  type Renderer,
} from "pixi.js";
import * as THREE from "three";
import { buildTraceGraph, type GraphMode } from "./traceGraph";
import { mulberry32 } from "./random";

/**
 * Pixi is used here as a procedural 2D texture engine: it authors the board's
 * copper artwork and the chip lid, which three.js then samples as data maps.
 *
 * Channel packing for the board map (deliberately *data*, not colour):
 *   R = copper coverage        (0 none, ~0.7 trace, 1.0 pad/via)
 *   G = distance from the chip along the run, 0..1
 *   B = per-run phase, so data packets do not march in lockstep
 *   A = unused, always 1
 */
export type BakedTextures = {
  /** Radial fan around the chip footprint, used on the hero board plane. */
  board: THREE.Texture;
  /** Tiling clutter used on the wider substrate that runs to the horizon. */
  field: THREE.Texture;
  chipLid: THREE.Texture;
  dispose: () => void;
};

const encode = (r: number, g: number, b: number) =>
  ((Math.round(Math.max(0, Math.min(1, r)) * 255) << 16) |
    (Math.round(Math.max(0, Math.min(1, g)) * 255) << 8) |
    Math.round(Math.max(0, Math.min(1, b)) * 255)) >>>
  0;

const toThree = (renderer: Renderer, rt: RenderTexture): THREE.Texture => {
  const canvas = renderer.extract.canvas(rt) as HTMLCanvasElement;
  const tex = new THREE.CanvasTexture(canvas);
  // These maps carry packed data, so they must not be sRGB-decoded.
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
};

export const bakeBoardMap = (
  renderer: Renderer,
  size: number,
  seed: number,
  density: number,
  mode: GraphMode = "fan",
): THREE.Texture => {
  const paths = buildTraceGraph(seed, density, { mode });
  const root = new Container();

  // Opaque black base: zero copper everywhere to begin with.
  const bg = new Graphics();
  bg.rect(0, 0, size, size).fill({ color: 0x000000, alpha: 1 });
  root.addChild(bg);

  const g = new Graphics();
  // Sub-segment length in pixels. Each sub-segment is stroked in its own
  // colour so the G channel becomes a smooth gradient along the run.
  const STEP = 7;

  for (const path of paths) {
    const phase = path.phase;
    const w = Math.max(1.1, path.width * size);
    for (let i = 1; i < path.points.length; i++) {
      const a = path.points[i - 1];
      const b = path.points[i];
      const d0 = path.dist[i - 1];
      const d1 = path.dist[i];
      const px0 = a.x * size;
      const py0 = a.y * size;
      const px1 = b.x * size;
      const py1 = b.y * size;
      const segLen = Math.hypot(px1 - px0, py1 - py0);
      const steps = Math.max(1, Math.ceil(segLen / STEP));
      for (let s = 0; s < steps; s++) {
        const t0 = s / steps;
        const t1 = (s + 1) / steps;
        const dmid = d0 + (d1 - d0) * ((t0 + t1) * 0.5);
        g.moveTo(px0 + (px1 - px0) * t0, py0 + (py1 - py0) * t0)
          .lineTo(px0 + (px1 - px0) * t1, py0 + (py1 - py0) * t1)
          .stroke({
            color: encode(0.72, dmid, phase),
            width: w,
            cap: "round",
            join: "round",
            alpha: 1,
          });
      }
    }
    // Pads sit on top at full copper so they bloom into bright nodes.
    for (const p of path.pads) {
      const dAt = 0.5;
      g.circle(p.x * size, p.y * size, w * 1.25)
        .fill({ color: encode(1.0, dAt, phase), alpha: 1 });
    }
  }
  root.addChild(g);

  const rt = RenderTexture.create({ width: size, height: size, antialias: true });
  renderer.render({ container: root, target: rt, clear: true });
  const tex = toThree(renderer, rt);
  if (mode === "field") {
    // The field layer tiles across the wider substrate; mirroring hides the
    // seam without needing a genuinely periodic routing algorithm.
    tex.wrapS = THREE.MirroredRepeatWrapping;
    tex.wrapT = THREE.MirroredRepeatWrapping;
  }
  rt.destroy(true);
  root.destroy({ children: true });
  return tex;
};

/**
 * Chip lid artwork.
 *   R = die / pixel-matrix pattern
 *   G = "AI" marking mask
 *   B = fine on-die circuitry
 */
export const bakeChipLid = (
  renderer: Renderer,
  size: number,
  label: string,
  seed: number,
): THREE.Texture => {
  const rng = mulberry32(seed);
  const root = new Container();
  const bg = new Graphics();
  bg.rect(0, 0, size, size).fill({ color: 0x000000, alpha: 1 });
  root.addChild(bg);

  const die = new Graphics();
  // Pixel matrix: the frosted, sub-pixel grain visible across the lid.
  const cells = 52;
  const cell = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      const v = rng();
      if (v < 0.42) continue;
      const inset = cell * 0.13;
      die
        .rect(x * cell + inset, y * cell + inset, cell - inset * 2, cell - inset * 2)
        .fill({ color: encode(0.25 + v * 0.65, 0, 0), alpha: 1 });
    }
  }
  // On-die functional blocks: a few denser rectangles reading as cores/cache.
  for (let i = 0; i < 16; i++) {
    const bw = size * (0.06 + rng() * 0.16);
    const bh = size * (0.05 + rng() * 0.14);
    const bx = rng() * (size - bw);
    const by = rng() * (size - bh);
    die.rect(bx, by, bw, bh).stroke({
      color: encode(0, 0, 0.55 + rng() * 0.45),
      width: Math.max(1, size / 420),
      alpha: 1,
    });
    const lines = 3 + Math.floor(rng() * 6);
    for (let l = 0; l < lines; l++) {
      const ly = by + (bh * (l + 1)) / (lines + 1);
      die
        .moveTo(bx, ly)
        .lineTo(bx + bw, ly)
        .stroke({ color: encode(0, 0, 0.35 + rng() * 0.3), width: Math.max(1, size / 700), alpha: 1 });
    }
  }
  root.addChild(die);

  root.addChild(drawLabel(label, size));

  const rt = RenderTexture.create({ width: size, height: size, antialias: true });
  renderer.render({ container: root, target: rt, clear: true });
  const tex = toThree(renderer, rt);
  rt.destroy(true);
  root.destroy({ children: true });
  return tex;
};

/**
 * The marking is drawn as geometry rather than as text: it guarantees the
 * identical glyph on every machine with no webfont to load, and it matches the
 * geometric sans used on real package lids.
 *
 * The "A" is built as a filled triangle with its counter cut out, rather than
 * as three strokes. Stroked letterforms lose their counters the moment the
 * emissive marking blooms, and the glyph collapses into an arrow.
 */
const drawLabel = (label: string, size: number): Graphics => {
  const g = new Graphics();
  const capH = size * 0.34;
  const stroke = capH * 0.125;
  const gap = capH * 0.2;
  const aW = capH * 0.9;
  const iW = stroke;
  const col = encode(0, 1, 0); // G channel = marking mask

  const chars = label.toUpperCase().slice(0, 3).split("");
  const widths = chars.map((c) => (c === "I" ? iW : aW));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (chars.length - 1);

  let x = (size - total) / 2;
  const top = (size - capH) / 2;
  const bottom = top + capH;

  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    const w = widths[i];
    if (c === "I") {
      g.rect(x, top, iW, capH).fill({ color: col, alpha: 1 });
    } else if (c === "A") {
      const cx = x + w / 2;
      const barTop = bottom - capH * 0.34;
      const barH = stroke * 0.82;
      // Two leg quads plus a crossbar. Built from explicit polygons rather
      // than a filled triangle with its counter cut out: the counter has to
      // survive being foreshortened to a fraction of its height by the
      // low-angle cameras, and an overlap of solid quads is unambiguous where
      // a boolean cut is not.
      g.poly([cx, top, cx + stroke, top, x + stroke, bottom, x, bottom]).fill({
        color: col,
        alpha: 1,
      });
      g.poly([
        cx - stroke, top,
        cx, top,
        x + w, bottom,
        x + w - stroke, bottom,
      ]).fill({ color: col, alpha: 1 });
      g.rect(x + stroke * 1.4, barTop, w - stroke * 2.8, barH).fill({
        color: col,
        alpha: 1,
      });
    } else {
      g.rect(x, top, w, capH).fill({ color: col, alpha: 1 });
    }
    x += w + gap;
  }
  return g;
};

export const bakeAll = (
  renderer: Renderer,
  opts: { boardSize: number; lidSize: number; seed: number; density: number; label: string },
): BakedTextures => {
  const board = bakeBoardMap(renderer, opts.boardSize, opts.seed, opts.density, "fan");
  const field = bakeBoardMap(
    renderer,
    Math.max(512, opts.boardSize >> 1),
    opts.seed + 4211,
    opts.density,
    "field",
  );
  const chipLid = bakeChipLid(renderer, opts.lidSize, opts.label, opts.seed + 977);
  return {
    board,
    field,
    chipLid,
    dispose: () => {
      board.dispose();
      field.dispose();
      chipLid.dispose();
    },
  };
};

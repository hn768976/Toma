/**
 * Canvas-baked textures.
 *
 * The substrate detail and the chip lettering never animate, so baking them
 * once at startup keeps the per-frame fragment cost down — which matters a lot
 * when the render box falls back to a software WebGPU adapter.
 */

import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from "three/webgpu";
import { createRng } from "./rng";

const createCanvas = (size: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (context === null) {
    throw new Error("Could not create a 2D context to bake textures");
  }

  return { canvas, context };
};

type Element = (
  context: CanvasRenderingContext2D,
  offsetX: number,
  offsetY: number,
) => void;

/**
 * Draws every element nine times, once per neighbouring tile, so shapes that
 * cross an edge continue on the opposite side and the texture tiles cleanly.
 */
const drawSeamless = (
  context: CanvasRenderingContext2D,
  size: number,
  elements: Element[],
) => {
  for (let ox = -1; ox <= 1; ox++) {
    for (let oy = -1; oy <= 1; oy++) {
      for (let i = 0; i < elements.length; i++) {
        elements[i](context, ox * size, oy * size);
      }
    }
  }
};

/**
 * Dark fibreglass with solder mask, ground pours, tiny SMD parts and the faint
 * unlit copper that fills the space between the glowing nets.
 */
export const createSubstrateTexture = (size = 2048, seed = 20240917) => {
  const { canvas, context } = createCanvas(size);
  const rng = createRng(seed);

  context.fillStyle = "#04060b";
  context.fillRect(0, 0, size, size);

  const elements: Element[] = [];
  const grid = size / 128;
  const snap = (value: number) => Math.round(value / grid) * grid;

  // Large ground pour blocks give the board its patchy, panelled base tone.
  for (let i = 0; i < 90; i++) {
    const x = snap(rng.range(0, size));
    const y = snap(rng.range(0, size));
    const w = snap(rng.range(grid * 6, grid * 26));
    const h = snap(rng.range(grid * 6, grid * 26));
    const shade = rng.range(0.035, 0.085);
    const fill = `rgba(${Math.round(shade * 150)}, ${Math.round(
      shade * 190,
    )}, ${Math.round(shade * 255)}, 1)`;
    elements.push((ctx, ox, oy) => {
      ctx.fillStyle = fill;
      ctx.fillRect(x + ox, y + oy, w, h);
    });
  }

  // Unlit copper routing: the dense background weave.
  for (let i = 0; i < 900; i++) {
    const horizontal = rng.chance(0.5);
    const x = snap(rng.range(0, size));
    const y = snap(rng.range(0, size));
    const length = snap(rng.range(grid * 3, grid * 30));
    const thickness = Math.max(1, Math.round(grid * rng.range(0.08, 0.22)));
    const alpha = rng.range(0.1, 0.34);
    const fill = `rgba(46, 92, 150, ${alpha})`;
    elements.push((ctx, ox, oy) => {
      ctx.fillStyle = fill;
      if (horizontal) {
        ctx.fillRect(x + ox, y + oy, length, thickness);
      } else {
        ctx.fillRect(x + ox, y + oy, thickness, length);
      }
    });
  }

  // Surface-mount components: small raised blocks with a lit top edge.
  for (let i = 0; i < 260; i++) {
    const x = snap(rng.range(0, size));
    const y = snap(rng.range(0, size));
    const w = snap(rng.range(grid * 1.2, grid * 5));
    const h = snap(rng.range(grid * 0.8, grid * 3));
    const body = rng.range(0.06, 0.16);
    const fill = `rgb(${Math.round(body * 210)}, ${Math.round(
      body * 225,
    )}, ${Math.round(body * 255)})`;
    const highlight = `rgba(150, 190, 235, ${rng.range(0.08, 0.2)})`;
    const edge = Math.max(1, Math.round(grid * 0.12));
    elements.push((ctx, ox, oy) => {
      ctx.fillStyle = fill;
      ctx.fillRect(x + ox, y + oy, w, h);
      ctx.fillStyle = highlight;
      ctx.fillRect(x + ox, y + oy, w, edge);
    });
  }

  // Vias and pads.
  for (let i = 0; i < 700; i++) {
    const x = snap(rng.range(0, size));
    const y = snap(rng.range(0, size));
    const radius = grid * rng.range(0.14, 0.34);
    const alpha = rng.range(0.12, 0.42);
    const fill = `rgba(104, 156, 210, ${alpha})`;
    elements.push((ctx, ox, oy) => {
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(x + ox, y + oy, radius, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawSeamless(context, size, elements);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 16;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.needsUpdate = true;

  return texture;
};

/** Outer contour of a geometric sans "A", as x positions at a given height. */
const letterA = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  const splay = 0.34;
  const stroke = 0.185;

  const outerLeft = (t: number) => x + w * splay * (1 - t);
  const outerRight = (t: number) => x + w - w * splay * (1 - t);
  const innerLeft = (t: number) => outerLeft(t) + w * stroke;
  const innerRight = (t: number) => outerRight(t) - w * stroke;

  // Height at which the two inner edges meet — the apex of the counter.
  const apex = 1 - (1 - 2 * stroke) / (2 * splay);
  const barTop = 0.6;
  const barBottom = 0.78;

  context.beginPath();

  context.moveTo(outerLeft(1), y + h);
  context.lineTo(outerLeft(0), y);
  context.lineTo(outerRight(0), y);
  context.lineTo(outerRight(1), y + h);
  context.closePath();

  // Counter above the crossbar.
  context.moveTo(innerLeft(barTop), y + h * barTop);
  context.lineTo(innerLeft(apex), y + h * apex);
  context.lineTo(innerRight(apex), y + h * apex);
  context.lineTo(innerRight(barTop), y + h * barTop);
  context.closePath();

  // Gap between the legs below the crossbar.
  context.moveTo(innerLeft(1), y + h);
  context.lineTo(innerLeft(barBottom), y + h * barBottom);
  context.lineTo(innerRight(barBottom), y + h * barBottom);
  context.lineTo(innerRight(1), y + h);
  context.closePath();
};

const letterI = (
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  context.beginPath();
  context.rect(x, y, w, h);
  context.closePath();
};

/**
 * The package lid: a solid matte black face carrying a glowing "AI".
 *
 * The lid itself is deliberately flat and unlit — no gradient, no blue sheen —
 * so the lettering is the only thing on the package that gives off light. The
 * glow is built in the texture as a stack of widening halo passes under a
 * near-white core; the scene bloom then picks the core up and carries it past
 * the edge of the package.
 */
export const createChipLidTexture = (size = 1024, label: "AI" = "AI") => {
  const { canvas, context } = createCanvas(size);

  context.clearRect(0, 0, size, size);

  // Solid matte lid. Flat fill, not a gradient: nothing here should read as lit.
  context.fillStyle = "#05060a";
  context.fillRect(0, 0, size, size);

  // Moulded inset around the die area, in neutral grey so it does not glow.
  const inset = size * 0.085;
  context.strokeStyle = "rgba(120, 124, 132, 0.1)";
  context.lineWidth = Math.max(1, size * 0.004);
  context.strokeRect(inset, inset, size - inset * 2, size - inset * 2);

  const letterHeight = size * 0.42;
  const aWidth = letterHeight * 0.92;
  const iWidth = letterHeight * 0.185;
  const gap = letterHeight * 0.13;
  const totalWidth = aWidth + gap + iWidth;
  const left = (size - totalWidth) / 2;
  const top = (size - letterHeight) / 2;

  const paint = (style: string) => {
    context.fillStyle = style;
    context.beginPath();
    letterA(context, left, top, aWidth, letterHeight);
    context.fill("evenodd");
    letterI(context, left + aWidth + gap, top, iWidth, letterHeight);
    context.fill("evenodd");
  };

  // Halo: several passes, widest and faintest first, so the falloff is smooth
  // rather than the single hard ring one shadowBlur would give.
  const halo: Array<[number, number]> = [
    [0.085, 0.13],
    [0.045, 0.2],
    [0.022, 0.3],
    [0.011, 0.42],
  ];

  for (let i = 0; i < halo.length; i++) {
    const [blur, alpha] = halo[i];
    context.save();
    context.shadowColor = `rgba(150, 214, 255, ${alpha})`;
    context.shadowBlur = size * blur;
    paint("rgba(150, 214, 255, 0.85)");
    context.restore();
  }

  // Core: near-white with the faintest cool falloff towards the baseline, so it
  // still reads as an emitter rather than as flat paint.
  const core = context.createLinearGradient(0, top, 0, top + letterHeight);
  core.addColorStop(0.0, "#ffffff");
  core.addColorStop(0.45, "#f2fbff");
  core.addColorStop(1.0, "#d8f0ff");
  paint("#ffffff");
  context.fillStyle = core;
  context.beginPath();
  letterA(context, left, top, aWidth, letterHeight);
  context.fill("evenodd");
  letterI(context, left + aWidth + gap, top, iWidth, letterHeight);
  context.fill("evenodd");

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 16;
  texture.needsUpdate = true;
  void label;

  return texture;
};

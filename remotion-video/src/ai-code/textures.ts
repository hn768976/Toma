import { MONO_FONT_STACK } from "./fonts";
import { rand, randRange } from "./rng";

// Canvas-built sprite art for everything that is not code: the "AI"
// chips and nodes, the beaded light beams, the glass slabs with
// chromatic edges, and the soft dots.
//
// Everything is drawn on transparent black and composited additively, so
// these are luminance masks more than images — a black pixel simply adds
// nothing.

/**
 * A CPU-backed 2D canvas.
 *
 * `willReadFrequently` is not about reading here — it keeps the canvas
 * in system memory instead of on the GPU. An accelerated 2D canvas is
 * wiped blank if Chrome's GPU channel is lost, and a headless render
 * that also drives WebGL/WebGPU loses it often enough that texture
 * sources built at scene setup would be empty by the time they are
 * uploaded.
 */
const canvasOf = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const context2d = (canvas: HTMLCanvasElement) =>
  canvas.getContext("2d", { willReadFrequently: true });

const roundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

export type ChipVariant = "glass" | "particle" | "ray" | "wire";

/**
 * An "AI" chip: a rounded tile with a lit edge and a label, on a canvas
 * with generous margin so the ray variant can throw light past the tile.
 */
export const createChipTexture = (
  size: number,
  variant: ChipVariant,
  seed: number,
  accent = "#9fd8ff",
): HTMLCanvasElement => {
  const canvas = canvasOf(size, size);
  const ctx = context2d(canvas);
  if (!ctx) {
    return canvas;
  }
  const pad = size * 0.2;
  const box = size - pad * 2;
  const radius = box * 0.16;
  const cx = size / 2;
  const cy = size / 2;

  if (variant === "ray") {
    // Light streaks radiating out past the tile edge.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 26; i++) {
      const angle = randRange(seed * 31 + i, 1, 0, Math.PI * 2);
      const length = randRange(seed * 31 + i, 2, box * 0.5, size * 0.52);
      const grad = ctx.createLinearGradient(
        cx,
        cy,
        cx + Math.cos(angle) * length,
        cy + Math.sin(angle) * length,
      );
      grad.addColorStop(0, "rgba(190, 228, 255, 0.55)");
      grad.addColorStop(1, "rgba(120, 190, 255, 0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = Math.max(1, size * 0.004);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(angle) * length, cy + Math.sin(angle) * length);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Body: a dark glassy fill that still reads as a surface additively.
  const body = ctx.createLinearGradient(pad, pad, pad + box, pad + box);
  body.addColorStop(0, "rgba(28, 74, 122, 0.55)");
  body.addColorStop(0.5, "rgba(16, 44, 78, 0.38)");
  body.addColorStop(1, "rgba(40, 96, 148, 0.5)");
  roundedRect(ctx, pad, pad, box, box, radius);
  ctx.fillStyle = body;
  ctx.fill();

  if (variant === "particle" || variant === "ray") {
    // Speckle confined to the tile.
    ctx.save();
    roundedRect(ctx, pad, pad, box, box, radius);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < 220; i++) {
      const px = pad + rand(seed * 71 + i, 4) * box;
      const py = pad + rand(seed * 71 + i, 5) * box;
      const r = randRange(seed * 71 + i, 6, size * 0.002, size * 0.008);
      ctx.fillStyle = `rgba(200, 235, 255, ${randRange(seed * 71 + i, 7, 0.2, 0.95).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  if (variant === "wire") {
    // A faint circuit lattice.
    ctx.save();
    roundedRect(ctx, pad, pad, box, box, radius);
    ctx.clip();
    ctx.strokeStyle = "rgba(120, 190, 240, 0.32)";
    ctx.lineWidth = Math.max(1, size * 0.0035);
    const step = box / 7;
    for (let i = 1; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(pad + i * step, pad);
      ctx.lineTo(pad + i * step, pad + box);
      ctx.moveTo(pad, pad + i * step);
      ctx.lineTo(pad + box, pad + box * 0 + i * step);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Chromatic edge: three offset strokes read as dispersion at distance.
  roundedRect(ctx, pad, pad, box, box, radius);
  ctx.lineWidth = Math.max(1, size * 0.006);
  ctx.strokeStyle = "rgba(150, 215, 255, 0.85)";
  ctx.stroke();
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.lineWidth = Math.max(1, size * 0.004);
  ctx.translate(size * 0.004, -size * 0.003);
  roundedRect(ctx, pad, pad, box, box, radius);
  ctx.strokeStyle = "rgba(255, 120, 150, 0.4)";
  ctx.stroke();
  ctx.translate(-size * 0.008, size * 0.006);
  roundedRect(ctx, pad, pad, box, box, radius);
  ctx.strokeStyle = "rgba(110, 255, 200, 0.4)";
  ctx.stroke();
  ctx.restore();

  // Label.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.font = `700 ${Math.round(box * 0.42)}px ${MONO_FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = accent;
  ctx.shadowBlur = size * 0.035;
  ctx.fillStyle = "rgba(236, 248, 255, 0.95)";
  ctx.fillText("AI", cx, cy + box * 0.01);
  ctx.restore();

  return canvas;
};

/** A soft round dot, used for point sprites and node glows. */
export const createDotTexture = (
  size: number,
  color = "180, 225, 255",
): HTMLCanvasElement => {
  const canvas = canvasOf(size, size);
  const ctx = context2d(canvas);
  if (!ctx) {
    return canvas;
  }
  const r = size / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.25, `rgba(${color}, 0.85)`);
  grad.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return canvas;
};

/**
 * A translucent glass slab: a dim body with bright, chromatically split
 * edges along the long sides.
 */
export const createSlabTexture = (
  width: number,
  height: number,
): HTMLCanvasElement => {
  const canvas = canvasOf(width, height);
  const ctx = context2d(canvas);
  if (!ctx) {
    return canvas;
  }
  const body = ctx.createLinearGradient(0, 0, 0, height);
  body.addColorStop(0, "rgba(46, 104, 156, 0.30)");
  body.addColorStop(0.45, "rgba(18, 48, 82, 0.13)");
  body.addColorStop(1, "rgba(34, 82, 128, 0.26)");
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, width, height);

  ctx.globalCompositeOperation = "lighter";
  const edge = Math.max(2, height * 0.035);
  const stops: [number, string][] = [
    [0, "rgba(255, 110, 140, 0.32)"],
    [0.35, "rgba(190, 235, 255, 0.55)"],
    [0.65, "rgba(150, 255, 220, 0.42)"],
    [1, "rgba(120, 160, 255, 0.3)"],
  ];
  for (const y of [0, height - edge]) {
    const grad = ctx.createLinearGradient(0, 0, width, 0);
    for (const [t, c] of stops) {
      grad.addColorStop(t, c);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, y, width, edge);
  }
  return canvas;
};

/**
 * A network node: a ringed "AI" badge. `wire` draws the latitude and
 * longitude arcs that make some nodes read as wireframe spheres.
 */
export const createNodeTexture = (
  size: number,
  wire: boolean,
  color = "126, 226, 214",
): HTMLCanvasElement => {
  const canvas = canvasOf(size, size);
  const ctx = context2d(canvas);
  if (!ctx) {
    return canvas;
  }
  const c = size / 2;
  const r = size * 0.36;

  ctx.strokeStyle = `rgba(${color}, ${wire ? 0.75 : 0.45})`;
  ctx.lineWidth = Math.max(1, size * 0.008);
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.stroke();

  if (wire) {
    ctx.strokeStyle = `rgba(${color}, 0.4)`;
    ctx.lineWidth = Math.max(1, size * 0.005);
    // Longitudes as ellipses of shrinking width, latitudes as flattened
    // ellipses: a cheap sphere that costs no geometry.
    for (const k of [0.25, 0.55, 0.85]) {
      ctx.beginPath();
      ctx.ellipse(c, c, r * k, r, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(c, c, r, r * k, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.font = `700 ${Math.round(size * 0.3)}px ${MONO_FONT_STACK}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = `rgba(${color}, 0.95)`;
  ctx.fillText("AI", c, c);
  ctx.restore();
  return canvas;
};

/** Monochrome film grain, tiled and offset per frame by the optics pass. */
export const createNoiseTexture = (
  size: number,
  seed: number,
): HTMLCanvasElement => {
  const canvas = canvasOf(size, size);
  const ctx = context2d(canvas);
  if (!ctx) {
    return canvas;
  }
  const image = ctx.createImageData(size, size);
  const data = image.data;
  for (let i = 0; i < size * size; i++) {
    // Box-Muller-ish: two uniforms averaged, so the grain clusters mid
    // grey instead of salt-and-peppering.
    const v = (rand(seed * 7919 + i, 1) + rand(seed * 7919 + i, 2)) * 0.5;
    const level = Math.round(v * 255);
    data[i * 4] = level;
    data[i * 4 + 1] = level;
    data[i * 4 + 2] = level;
    data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
};

/** A soft elliptical haze, used for the lens veil and the top glow. */
export const createHazeTexture = (
  width: number,
  height: number,
  color = "110, 180, 255",
): HTMLCanvasElement => {
  const canvas = canvasOf(width, height);
  const ctx = context2d(canvas);
  if (!ctx) {
    return canvas;
  }
  const grad = ctx.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    width / 2,
  );
  grad.addColorStop(0, `rgba(${color}, 0.9)`);
  grad.addColorStop(0.35, `rgba(${color}, 0.38)`);
  grad.addColorStop(0.7, `rgba(${color}, 0.09)`);
  grad.addColorStop(1, `rgba(${color}, 0)`);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.scale(1, height / width);
  ctx.translate(-width / 2, -width / 2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, width);
  ctx.restore();
  return canvas;
};

/** A light ray: hot at the origin end, fading to nothing at the tip. */
export const createRayTexture = (
  width: number,
  height: number,
  color = "170, 215, 255",
): HTMLCanvasElement => {
  const canvas = canvasOf(width, height);
  const ctx = context2d(canvas);
  if (!ctx) {
    return canvas;
  }
  const along = ctx.createLinearGradient(0, 0, width, 0);
  along.addColorStop(0, `rgba(${color}, 0.85)`);
  along.addColorStop(0.18, `rgba(${color}, 0.42)`);
  along.addColorStop(1, `rgba(${color}, 0)`);
  ctx.fillStyle = along;
  ctx.fillRect(0, 0, width, height);

  // Soften the long edges so the ray has no hard sides.
  const across = ctx.createLinearGradient(0, 0, 0, height);
  across.addColorStop(0, "rgba(0, 0, 0, 1)");
  across.addColorStop(0.5, "rgba(0, 0, 0, 0)");
  across.addColorStop(1, "rgba(0, 0, 0, 1)");
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = across;
  ctx.fillRect(0, 0, width, height);
  return canvas;
};

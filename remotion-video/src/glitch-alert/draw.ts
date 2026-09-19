// Every pixel of this composition is painted with Canvas2D. Each function
// below is a pure painter: given a context and the frame's `Scene`, it
// draws one layer and mutates nothing else. Nothing reads the clock or
// Math.random(), so frames are reproducible in any order.

import {
  ALERT_RED,
  ALERT_RED_BRIGHT,
  BG_COLOR,
  BLOOM_COLOR,
  BLOOM_SWEEPS,
  CODE_BLUE,
  CODE_LINES,
  DIGIT_BLUE,
  FPS,
  HEADLINE_BASELINE_Y,
  HEADLINE_CONDENSE,
  HEADLINE_FONT_SIZE,
  HEADLINE_MAX_WIDTH,
  MOSAIC_BLOCK,
  MOSAIC_HUE,
  MOSAIC_MAX_LIGHTNESS,
  MOSAIC_RESHUFFLE_PERIOD,
  TRIANGLE_CENTER_Y,
  TRIANGLE_WIDTH,
} from "./constants";
import { DISPLAY_FONT, MONO_FONT } from "./fonts";
import { clamp, hash2, hash3, mix, valueNoise1D } from "./random";

export type Scene = {
  frame: number;
  seconds: number;
  /** Output size divided by the 1920x1080 authoring size. */
  scale: number;
  width: number;
  height: number;
};

type Ctx = CanvasRenderingContext2D;

/** Converts a 1x authoring value into output pixels. */
const px = (scene: Scene, v: number) => v * scene.scale;

// --- Noise ---------------------------------------------------------------

const noise2D = (x: number, y: number, seed: number) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return mix(
    mix(hash3(xi, yi, seed), hash3(xi + 1, yi, seed), u),
    mix(hash3(xi, yi + 1, seed), hash3(xi + 1, yi + 1, seed), u),
    v,
  );
};

// --- Bloom ---------------------------------------------------------------

type Bloom = { x: number; y: number; radius: number; strength: number };

/**
 * The bloom sweeps active this second, already faded in/out, in 1x
 * coordinates. They both light the field additively and multiply the
 * mosaic's own brightness, which is what makes the reference's bright
 * areas read as *more pixel structure* rather than a flat wash.
 */
export const activeBlooms = (scene: Scene): Bloom[] => {
  const out: Bloom[] = [];
  BLOOM_SWEEPS.forEach((sweep, i) => {
    const t = (scene.seconds - sweep.at) / sweep.dur;
    if (t < 0 || t > 1) return;
    // Symmetric ease in and out.
    const envelope = Math.sin(t * Math.PI) ** 1.4;
    // A slow wander so repeated viewings don't feel mechanical.
    const driftX = (valueNoise1D(scene.seconds * 0.35 + i * 3, 31) - 0.5) * 260;
    const driftY = (valueNoise1D(scene.seconds * 0.28 + i * 7, 53) - 0.5) * 160;
    out.push({
      x: sweep.x + driftX,
      y: sweep.y + driftY,
      radius: sweep.radius,
      strength: sweep.peak * envelope,
    });
  });
  return out;
};

const bloomAt = (blooms: Bloom[], x: number, y: number) => {
  let total = 0;
  for (const b of blooms) {
    const dx = x - b.x;
    const dy = y - b.y;
    const d = Math.sqrt(dx * dx + dy * dy) / b.radius;
    if (d >= 1) continue;
    const falloff = (1 - d) * (1 - d);
    total += b.strength * falloff;
  }
  return total;
};

// --- Mosaic field --------------------------------------------------------

/**
 * The blocky blue static that fills the frame. Block count is fixed
 * regardless of output size, so 1080p and 4K show the same mosaic at
 * different pixel sizes rather than 4K showing four times as many,
 * finer blocks.
 */
export const drawMosaic = (ctx: Ctx, scene: Scene, blooms: Bloom[]) => {
  const { width, height, frame } = scene;

  ctx.fillStyle = BG_COLOR;
  ctx.fillRect(0, 0, width, height);

  const block = px(scene, MOSAIC_BLOCK);
  const cols = Math.ceil(width / block);
  const rows = Math.ceil(height / block);

  // The per-block flicker only re-rolls every few frames. Re-rolling every
  // frame reads as film grain; holding it briefly reads as a digital
  // signal, which is the look here.
  const step = Math.floor(frame / MOSAIC_RESHUFFLE_PERIOD);
  const t = scene.seconds;

  for (let cy = 0; cy < rows; cy++) {
    // Horizontal band modulation — faint scan structure across the field.
    const band =
      0.82 + 0.18 * Math.sin(cy * 0.35 + t * 1.1) * valueNoise1D(t * 2 + cy, 91);

    for (let cx = 0; cx < cols; cx++) {
      // Two octaves of drifting cloud, so the field has large soft
      // structure as well as per-block noise.
      const structure =
        noise2D(cx * 0.055 + t * 0.22, cy * 0.055 - t * 0.05, 11) * 0.62 +
        noise2D(cx * 0.018 - t * 0.08, cy * 0.02 + t * 0.03, 23) * 0.38;

      const flicker = hash3(cx, cy, step);

      const bloom = bloomAt(
        blooms,
        (cx * block + block / 2) / scene.scale,
        (cy * block + block / 2) / scene.scale,
      );

      // The cloud structure *scales* the per-block flicker rather than
      // adding to it. Adding the two gives an evenly dense salt-and-pepper
      // field; multiplying makes bright blocks cluster into regions, with
      // near-dead areas between them — which is what the reference does.
      const envelope = 0.22 + structure * 1.3;
      let brightness = (0.26 + flicker * 0.74) * envelope - 0.30;
      brightness *= band;
      brightness = clamp(brightness);
      // Mild gamma only. A steeper curve crushes the mid-tones and
      // leaves isolated bright specks on black, which is not the look.
      brightness = brightness ** 1.3;
      brightness = clamp(brightness * (1 + bloom * 2.6) + bloom * 0.26);

      if (brightness < 0.008) continue;

      // Brighter blocks also desaturate slightly toward white-blue.
      const light = brightness * MOSAIC_MAX_LIGHTNESS;
      const sat = 88 - brightness * 26;
      ctx.fillStyle = `hsl(${MOSAIC_HUE} ${sat}% ${light}%)`;
      ctx.fillRect(cx * block, cy * block, block + 1, block + 1);

      // Rare hot pixels: single blocks that spike well above the field.
      // Kept blue and only moderately bright — pushed to white they read
      // as dead pixels rather than signal.
      if (flicker > 0.9975) {
        ctx.fillStyle = `hsl(${MOSAIC_HUE - 4} 80% ${Math.min(62, light * 2 + 28)}%)`;
        ctx.fillRect(cx * block, cy * block, block + 1, block + 1);
      }
    }
  }
};

/** Soft additive light pools layered over the mosaic. */
export const drawBloomGlow = (ctx: Ctx, scene: Scene, blooms: Bloom[]) => {
  if (blooms.length === 0) return;
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const b of blooms) {
    const x = px(scene, b.x);
    const y = px(scene, b.y);
    const r = px(scene, b.radius);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${BLOOM_COLOR}, ${0.26 * b.strength})`);
    g.addColorStop(0.45, `rgba(${BLOOM_COLOR}, ${0.1 * b.strength})`);
    g.addColorStop(1, `rgba(${BLOOM_COLOR}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  ctx.restore();
};

// --- Code fragments and loose digits -------------------------------------

/**
 * Small blocks of C / inline-asm that fade in and out in the corners.
 * Deliberately low-contrast: at normal viewing distance these should read
 * as texture, not as something to sit and parse.
 */
export const drawCodeFragments = (ctx: Ctx, scene: Scene) => {
  const size = px(scene, 11);
  ctx.save();
  ctx.font = `${size}px "${MONO_FONT}", monospace`;
  ctx.textBaseline = "top";

  // Six slots that each cycle through the snippet list on their own
  // offset schedule, so blocks appear and vanish independently.
  const SLOTS = 6;
  for (let slot = 0; slot < SLOTS; slot++) {
    const cycle = 3.1 + hash2(slot, 5) * 2.4; // seconds per appearance
    const phase = (scene.seconds + hash2(slot, 9) * cycle) / cycle;
    const cycleIndex = Math.floor(phase);
    const t = phase - cycleIndex;

    // Visible for the middle chunk of the cycle only.
    if (t < 0.12 || t > 0.62) continue;
    const local = (t - 0.12) / 0.5;
    const alpha = Math.sin(local * Math.PI) * 0.8;

    const r = (n: number) => hash3(slot * 17 + n, cycleIndex, 313);
    const lineCount = 2 + Math.floor(r(1) * 4);
    const first = Math.floor(r(2) * CODE_LINES.length);
    const x = px(scene, 60 + r(3) * 1420);
    const y = px(scene, 40 + r(4) * 960);

    ctx.fillStyle = CODE_BLUE;
    for (let i = 0; i < lineCount; i++) {
      const line = CODE_LINES[(first + i) % CODE_LINES.length];
      // Individual lines flicker within the block.
      const lineAlpha = alpha * (0.45 + hash3(slot, cycleIndex, i * 31) * 0.55);
      ctx.globalAlpha = lineAlpha;
      ctx.fillText(line, x, y + i * size * 1.45);
    }
  }
  ctx.restore();
};

/** Sparse single characters drifting in the field, like stray memory dumps. */
export const drawDigits = (ctx: Ctx, scene: Scene) => {
  const size = px(scene, 13);
  const COUNT = 46;
  ctx.save();
  ctx.font = `${size}px "${MONO_FONT}", monospace`;
  ctx.textBaseline = "middle";
  ctx.fillStyle = DIGIT_BLUE;

  const glyphs = "0123456789ABCDEF";
  for (let i = 0; i < COUNT; i++) {
    // Each digit lives for a couple of seconds, then respawns elsewhere.
    const life = 1.8 + hash2(i, 61) * 2.6;
    const phase = (scene.seconds + hash2(i, 71) * life) / life;
    const gen = Math.floor(phase);
    const t = phase - gen;

    const r = (n: number) => hash3(i * 13 + n, gen, 887);
    const x = px(scene, r(1) * 1900);
    const y = px(scene, r(2) * 1060);
    const glyph = glyphs[Math.floor(r(3) * glyphs.length)];

    ctx.globalAlpha = Math.sin(t * Math.PI) * (0.18 + r(4) * 0.34);
    ctx.fillText(glyph, x, y);
  }
  ctx.restore();
};

// --- Warning triangle ----------------------------------------------------

const roundedTrianglePath = (
  cx: number,
  cy: number,
  width: number,
  height: number,
  radius: number,
) => {
  const points: [number, number][] = [
    [cx, cy - height / 2], // apex
    [cx + width / 2, cy + height / 2], // bottom right
    [cx - width / 2, cy + height / 2], // bottom left
  ];

  const path = new Path2D();
  for (let i = 0; i < 3; i++) {
    const prev = points[(i + 2) % 3];
    const curr = points[i];
    const next = points[(i + 1) % 3];

    const toPrev = [prev[0] - curr[0], prev[1] - curr[1]];
    const toNext = [next[0] - curr[0], next[1] - curr[1]];
    const lenPrev = Math.hypot(toPrev[0], toPrev[1]);
    const lenNext = Math.hypot(toNext[0], toNext[1]);

    const startX = curr[0] + (toPrev[0] / lenPrev) * radius;
    const startY = curr[1] + (toPrev[1] / lenPrev) * radius;
    const endX = curr[0] + (toNext[0] / lenNext) * radius;
    const endY = curr[1] + (toNext[1] / lenNext) * radius;

    if (i === 0) path.moveTo(startX, startY);
    else path.lineTo(startX, startY);
    path.quadraticCurveTo(curr[0], curr[1], endX, endY);
  }
  path.closePath();
  return path;
};

const trianglePath = (cx: number, cy: number, width: number, height: number) => {
  const path = new Path2D();
  path.moveTo(cx, cy - height / 2);
  path.lineTo(cx + width / 2, cy + height / 2);
  path.lineTo(cx - width / 2, cy + height / 2);
  path.closePath();
  return path;
};

/**
 * The alert mark: a filled red triangle sitting inside a rounded red
 * outline, with a tapered white exclamation. Drawn onto the foreground
 * layer so the glitch pass can displace it independently of the field.
 */
export const drawTriangle = (ctx: Ctx, scene: Scene) => {
  const cx = scene.width / 2;
  const cy = px(scene, TRIANGLE_CENTER_Y);
  const w = px(scene, TRIANGLE_WIDTH);
  const h = w * 0.97;

  ctx.save();

  const outline = roundedTrianglePath(cx, cy, w, h, px(scene, 24));

  // Glow first, as its own soft pass. Putting a large shadowBlur on the
  // outline stroke itself floods the gap between the outline and the
  // inner fill, which is exactly the detail that has to stay readable.
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.strokeStyle = ALERT_RED_BRIGHT;
  ctx.lineWidth = px(scene, 11);
  ctx.lineJoin = "round";
  ctx.shadowColor = "rgba(255, 26, 60, 0.95)";
  ctx.shadowBlur = px(scene, 16);
  ctx.stroke(outline);
  ctx.restore();

  // Inner solid triangle, inset from the outline with a clear dark gap,
  // and with hard corners against the outline's rounded ones.
  const innerW = w * 0.8;
  const inner = trianglePath(cx, cy + px(scene, 12), innerW, innerW * 0.86);
  const fill = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  fill.addColorStop(0, "#f20f31");
  fill.addColorStop(0.6, ALERT_RED);
  fill.addColorStop(1, "#cf0122");
  ctx.fillStyle = fill;
  ctx.fill(inner);

  // Crisp outline last, so it sits on top of both the glow and the fill.
  ctx.strokeStyle = ALERT_RED_BRIGHT;
  ctx.lineWidth = px(scene, 11);
  ctx.lineJoin = "round";
  ctx.stroke(outline);

  // Exclamation: tapered bar, wide at the top, plus a round dot.
  const barTop = cy - h * 0.24;
  const barBottom = cy + h * 0.1;
  const topHalf = px(scene, 15);
  const bottomHalf = px(scene, 7);

  const mark = new Path2D();
  mark.moveTo(cx - topHalf, barTop);
  mark.quadraticCurveTo(cx, barTop - topHalf * 0.8, cx + topHalf, barTop);
  mark.lineTo(cx + bottomHalf, barBottom);
  mark.quadraticCurveTo(cx, barBottom + bottomHalf * 1.4, cx - bottomHalf, barBottom);
  mark.closePath();

  const markFill = ctx.createLinearGradient(0, barTop, 0, barBottom);
  markFill.addColorStop(0, "#dbe6ff");
  markFill.addColorStop(0.4, "#f6f9ff");
  markFill.addColorStop(1, "#c4d5f4");
  ctx.fillStyle = markFill;
  ctx.fill(mark);

  ctx.beginPath();
  ctx.arc(cx, cy + h * 0.24, px(scene, 13), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
};

// --- Headline ------------------------------------------------------------

/**
 * Draws the headline into `ctx` with a brushed-chrome fill: a vertical
 * white-to-steel-blue gradient, broken up by horizontal streaks masked to
 * the glyphs with `source-atop`. `ctx` must belong to a canvas holding
 * nothing but this text, or the streaks will bleed onto other layers.
 */
export const drawHeadlineText = (ctx: Ctx, scene: Scene, text: string) => {
  const fontSize = px(scene, HEADLINE_FONT_SIZE);
  ctx.save();
  ctx.font = `${fontSize}px "${DISPLAY_FONT}", sans-serif`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  // Compress horizontally to the reference's narrower proportions, then
  // compress further if a longer headline would overrun the frame.
  const natural = ctx.measureText(text).width;
  const maxWidth = px(scene, HEADLINE_MAX_WIDTH);
  const condense = Math.min(
    HEADLINE_CONDENSE,
    maxWidth / Math.max(natural, 1),
  );

  const baseline = px(scene, HEADLINE_BASELINE_Y);
  const capTop = baseline - fontSize * 0.73;

  ctx.translate(scene.width / 2, 0);
  ctx.scale(condense, 1);

  const gradient = ctx.createLinearGradient(0, capTop, 0, baseline);
  gradient.addColorStop(0, "#ffffff");
  gradient.addColorStop(0.32, "#e8f0ff");
  gradient.addColorStop(0.55, "#9fb8dd");
  gradient.addColorStop(0.72, "#f2f6ff");
  gradient.addColorStop(1, "#c3d4ee");
  ctx.fillStyle = gradient;
  ctx.fillText(text, 0, baseline);
  ctx.restore();

  // Horizontal video-noise streaks, clipped to the glyphs.
  ctx.save();
  ctx.globalCompositeOperation = "source-atop";
  const step = Math.floor(scene.frame / MOSAIC_RESHUFFLE_PERIOD);
  const bandHeight = px(scene, 3);
  const capHeight = fontSize * 0.73;
  for (let i = 0; i < 26; i++) {
    const r = hash3(i, step, 601);
    const y = capTop + r * capHeight;
    const alpha = 0.1 + hash3(i, step, 733) * 0.3;
    ctx.fillStyle =
      hash3(i, step, 811) > 0.5
        ? `rgba(120, 160, 220, ${alpha})`
        : `rgba(255, 255, 255, ${alpha * 0.8})`;
    ctx.fillRect(0, y, scene.width, bandHeight * (0.5 + r * 2));
  }
  ctx.restore();
};

// --- Full-frame finishing passes -----------------------------------------

/** Fine horizontal scanlines, plus a slowly rolling brighter band. */
export const drawScanlines = (ctx: Ctx, scene: Scene) => {
  const lineGap = Math.max(2, Math.round(px(scene, 3)));
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = "#000000";
  for (let y = 0; y < scene.height; y += lineGap) {
    ctx.fillRect(0, y, scene.width, Math.max(1, lineGap / 2));
  }

  // The roll bar: a soft bright sweep that crawls down the frame.
  const rollY =
    ((scene.seconds * 0.22) % 1.4) * (scene.height + px(scene, 400)) -
    px(scene, 200);
  const rollH = px(scene, 220);
  const g = ctx.createLinearGradient(0, rollY, 0, rollY + rollH);
  g.addColorStop(0, "rgba(90, 150, 255, 0)");
  g.addColorStop(0.5, "rgba(90, 150, 255, 0.05)");
  g.addColorStop(1, "rgba(90, 150, 255, 0)");
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.fillRect(0, rollY, scene.width, rollH);
  ctx.restore();
};

/** Darkens the corners so the eye stays on the alert mark. */
export const drawVignette = (ctx: Ctx, scene: Scene) => {
  const { width, height } = scene;
  const g = ctx.createRadialGradient(
    width / 2,
    height / 2,
    Math.min(width, height) * 0.22,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.72,
  );
  g.addColorStop(0, "rgba(0, 0, 0, 0)");
  g.addColorStop(0.65, "rgba(0, 0, 0, 0.35)");
  g.addColorStop(1, "rgba(0, 0, 0, 0.82)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, width, height);
};

export const secondsOf = (frame: number) => frame / FPS;

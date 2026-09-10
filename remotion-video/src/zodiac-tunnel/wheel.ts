// Builds the wheel ONCE into an offscreen canvas, then derives a mip
// chain from it. Every nested copy in the tunnel is a drawImage() of one
// of these bitmaps -- the geometry is never regenerated per copy, and
// per-copy texture stays consistent, which the seamless loop depends on.
//
// The mip chain is also the anti-aliasing answer. The deepest copies are
// a couple of dozen pixels across, so their line work is far below one
// pixel wide; sampling a pre-averaged smaller bitmap turns those lines
// into a faint even haze instead of letting them crawl and shimmer.

import {
  Rng,
  createCanvas,
  createNoiseTile,
  jitterCircle,
  jitterLine,
  mulberry32,
  strokeChalkPath,
  strokeChalkPolyline,
} from "./chalk";
import { SECTOR_COUNT, STROKE, WHEEL, ZodiacTheme } from "./constants";
import { ZODIAC_SIGNS } from "./glyphs";
import { FONT_FAMILY_NAME } from "../load-fonts";

const TAU = Math.PI * 2;

// Angle 0 points straight up; positive angles run clockwise, matching
// the order the signs are listed in.
const sectorCenter = (index: number) => (index / SECTOR_COUNT) * TAU;
const sectorEdge = (index: number) => ((index + 0.5) / SECTOR_COUNT) * TAU;

const drawArcText = (
  ctx: CanvasRenderingContext2D,
  text: string,
  radius: number,
  centerAngle: number,
  maxFontSize: number,
  arcBudget: number,
  rng: Rng,
) => {
  // Fit the name to its sector, but never blow past the band height:
  // SAGITTARIUS ends up a shade smaller than LEO, which is what hand
  // lettering does anyway.
  ctx.font = `${maxFontSize}px "${FONT_FAMILY_NAME}", "Segoe Script", cursive`;
  const chars = [...text];
  const rawWidths = chars.map((ch) => ctx.measureText(ch).width);
  const tracking = maxFontSize * 0.07;
  const rawTotal =
    rawWidths.reduce((sum, w) => sum + w, 0) + tracking * (chars.length - 1);
  const fontSize = Math.min(maxFontSize, (maxFontSize * arcBudget) / rawTotal);
  const scale = fontSize / maxFontSize;

  ctx.font = `${fontSize}px "${FONT_FAMILY_NAME}", "Segoe Script", cursive`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const widths = rawWidths.map((w) => w * scale);
  const gap = tracking * scale;
  const total = widths.reduce((sum, w) => sum + w, 0) + gap * (chars.length - 1);

  let cursor = centerAngle - total / 2 / radius;
  for (let i = 0; i < chars.length; i++) {
    const advance = widths[i];
    const angle = cursor + advance / 2 / radius;
    ctx.save();
    ctx.rotate(angle);
    ctx.translate((rng() - 0.5) * fontSize * 0.05, -radius);
    ctx.rotate((rng() - 0.5) * 0.05);
    ctx.globalAlpha = 0.82 + rng() * 0.18;
    ctx.fillText(chars[i], 0, 0);
    ctx.restore();
    cursor += (advance + gap) / radius;
  }
  ctx.globalAlpha = 1;
};

const drawWheelLines = (
  ctx: CanvasRenderingContext2D,
  size: number,
  theme: ZodiacTheme,
) => {
  const radius = size * 0.48; // leaves room for stroke width and the soft edge
  const rng = mulberry32(0x5a17);
  const wobble = radius * 0.0016;

  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = theme.lineColor;
  ctx.fillStyle = theme.lineColor;

  const circle = (fraction: number, strokeFraction: number, alpha: number) => {
    strokeChalkPolyline(
      ctx,
      jitterCircle(0, 0, radius * fraction, rng, wobble),
      radius * strokeFraction,
      alpha,
      rng,
    );
  };

  const radial = (
    angle: number,
    from: number,
    to: number,
    strokeFraction: number,
    alpha: number,
  ) => {
    const sin = Math.sin(angle);
    const cos = Math.cos(angle);
    strokeChalkPolyline(
      ctx,
      jitterLine(
        radius * from * sin,
        -radius * from * cos,
        radius * to * sin,
        -radius * to * cos,
        rng,
        wobble,
        4,
      ),
      radius * strokeFraction,
      alpha,
      rng,
    );
  };

  // --- concentric structure -------------------------------------------
  circle(WHEEL.outerCircle, STROKE.outerCircle, 1);
  circle(WHEEL.nameRingInner, STROKE.ring, 0.95);
  circle(WHEEL.glyphRingInner, STROKE.ring, 0.95);
  circle(WHEEL.ringA, STROKE.ring, 0.8);
  circle(WHEEL.ringB, STROKE.ring, 0.7);

  // --- degree ticks ----------------------------------------------------
  // Every 5 degrees, with a longer mark on each 30-degree sector edge.
  for (let i = 0; i < 72; i++) {
    const angle = (i / 72) * TAU + sectorEdge(0);
    const major = i % 6 === 0;
    radial(
      angle,
      major ? WHEEL.tickMajorInner : WHEEL.tickMinorInner,
      WHEEL.tickOuter,
      major ? STROKE.tickMajor : STROKE.tickMinor,
      major ? 0.88 : 0.5,
    );
  }

  // --- sector dividers -------------------------------------------------
  // These run all the way in to the inner ring cluster, so on the widest
  // copy they read as long straight lines crossing the whole frame.
  for (let i = 0; i < SECTOR_COUNT; i++) {
    radial(sectorEdge(i), WHEEL.dividerInner, WHEEL.outerCircle, STROKE.divider, 0.9);
  }

  // --- {12/5} star polygon across the interior -------------------------
  for (let i = 0; i < SECTOR_COUNT; i++) {
    const a = sectorEdge(i);
    const b = sectorEdge(i + WHEEL.chordStep);
    const r = radius * WHEEL.chordRadius;
    strokeChalkPolyline(
      ctx,
      jitterLine(
        r * Math.sin(a),
        -r * Math.cos(a),
        r * Math.sin(b),
        -r * Math.cos(b),
        rng,
        wobble,
        6,
      ),
      radius * STROKE.chord,
      0.15,
      rng,
    );
  }

  // --- glyphs ----------------------------------------------------------
  const glyphScale = (radius * WHEEL.glyphSize) / 100;
  for (let i = 0; i < SECTOR_COUNT; i++) {
    const sign = ZODIAC_SIGNS[i];
    ctx.save();
    ctx.rotate(sectorCenter(i));
    ctx.translate(0, -radius * WHEEL.glyphCenter);
    ctx.scale(glyphScale, glyphScale);
    ctx.translate(-50, -50);
    const width = (radius * STROKE.glyph) / glyphScale;
    for (const d of sign.paths) {
      strokeChalkPath(ctx, new Path2D(d), width, 1, rng);
    }
    ctx.restore();
  }

  // --- sign names ------------------------------------------------------
  const nameRadius = radius * WHEEL.nameBaseline;
  const bandHeight = radius * (WHEEL.outerCircle - WHEEL.nameRingInner);
  const arcBudget = nameRadius * (TAU / SECTOR_COUNT) * 0.86;
  for (let i = 0; i < SECTOR_COUNT; i++) {
    drawArcText(
      ctx,
      ZODIAC_SIGNS[i].name,
      nameRadius,
      sectorCenter(i),
      bandHeight * 0.86,
      arcBudget,
      rng,
    );
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
};

// Multiplies the finished line work by a tileable noise field, so the
// pigment thins and breaks along every stroke instead of running at a
// uniform density.
const applyGrainMask = (
  ctx: CanvasRenderingContext2D,
  size: number,
  seed: number,
) => {
  const tile = createNoiseTile(512, seed, 0.52, 0.58);
  const pattern = ctx.createPattern(tile, "repeat");
  if (!pattern) return;
  ctx.globalCompositeOperation = "destination-in";
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";
};

export const buildWheelMips = (
  size: number,
  theme: ZodiacTheme,
): HTMLCanvasElement[] => {
  const lines = createCanvas(size, size);
  const lctx = lines.getContext("2d");
  if (!lctx) return [lines];

  drawWheelLines(lctx, size, theme);
  applyGrainMask(lctx, size, 0x9e37);

  // Sharp line work over a blurred copy of itself: chalk sits in a faint
  // halo of dust, it doesn't have a hard vector edge.
  const master = createCanvas(size, size);
  const mctx = master.getContext("2d");
  if (!mctx) return [lines];
  mctx.filter = `blur(${size * 0.0007}px)`;
  mctx.globalAlpha = 0.34;
  mctx.drawImage(lines, 0, 0);
  mctx.filter = "none";
  mctx.globalAlpha = 1;
  mctx.drawImage(lines, 0, 0);

  const mips: HTMLCanvasElement[] = [master];
  let current = master;
  while (current.width > 32) {
    const next = createCanvas(current.width / 2, current.height / 2);
    const nctx = next.getContext("2d");
    if (!nctx) break;
    nctx.imageSmoothingEnabled = true;
    nctx.imageSmoothingQuality = "high";
    nctx.drawImage(current, 0, 0, next.width, next.height);
    mips.push(next);
    current = next;
  }
  return mips;
};

// Smallest mip that is still at least as big as the copy we are about to
// draw, so drawImage only ever downsamples by up to 2x. Depends solely
// on the on-screen size, which is a pure function of depth -- so a copy
// at depth d always samples the same bitmap, on every frame of the loop.
export const pickMip = (mips: HTMLCanvasElement[], destSize: number) => {
  const level = Math.floor(Math.log2(mips[0].width / Math.max(destSize, 1)));
  return mips[Math.max(0, Math.min(mips.length - 1, level))];
};

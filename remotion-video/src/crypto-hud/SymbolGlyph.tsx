import { useLayoutEffect, useMemo } from "react";
import { beginWorld, context2d, makeCanvas, type Buffers } from "./buffers";
import { black, shade, white, withAlpha } from "./color";
import { glyphGeometry } from "./glyph";
import {
  drawBanded,
  FRINGE_BASE,
  FRINGE_GLITCH,
  glitchSlices,
  type GlitchState,
} from "./glitch";
import {
  DURATION,
  glowPulse,
  SYMBOL_CX,
  SYMBOL_CY,
  SYMBOL_HEIGHT,
} from "./layout";
import type { VariantConfig } from "./variants";

/** Room around the glyph for the baked bloom, fringe offset and slice shifts. */
const PAD = 170;

/** Scan bands: 20px apart, drifting 0.6px a frame, 540px = exactly 27 bands. */
const SCAN_SPACING = 20;
const SCAN_SPEED = 0.6;

type Props = {
  buffers: Buffers;
  cfg: VariantConfig;
  frame: number;
  drift: { x: number; y: number };
  glitch: GlitchState;
};

const drawCentered = (ctx: CanvasRenderingContext2D, img: HTMLCanvasElement) => {
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
};

/**
 * One component with a branch on `symbolType`, not one component per mark.
 * Everything static is baked into sprites at mount; per frame we only stamp
 * the scan texture and composite three offset copies.
 */
export const SymbolGlyph: React.FC<Props> = ({ buffers, cfg, frame, drift, glitch }) => {
  const sprites = useMemo(() => {
    const geo = glyphGeometry(cfg.symbolType);
    const unit = SYMBOL_HEIGHT / (geo.maxY - geo.minY);
    const glyphW = (geo.maxX - geo.minX) * unit;
    const size = {
      w: Math.ceil(glyphW + PAD * 2),
      h: Math.ceil(SYMBOL_HEIGHT + PAD * 2),
    };
    const ox = size.w / 2 - ((geo.minX + geo.maxX) / 2) * unit;
    const oy = size.h / 2 - ((geo.minY + geo.maxY) / 2) * unit;

    const paint = (paintStyle: string | CanvasGradient) => {
      const canvas = makeCanvas(size.w, size.h);
      const ctx = context2d(canvas);
      ctx.translate(ox, oy);
      ctx.fillStyle = paintStyle;
      ctx.strokeStyle = paintStyle;
      geo.draw(ctx, unit);
      return canvas;
    };

    // Body fill: hot core in the middle falling off to the symbol hue.
    const gradientCanvas = makeCanvas(1, 1);
    const gradientCtx = context2d(gradientCanvas);
    const bodyGradient = gradientCtx.createRadialGradient(0, 0, 0, 0, 0, SYMBOL_HEIGHT * 0.5);
    bodyGradient.addColorStop(0, cfg.palette.symbolCore);
    bodyGradient.addColorStop(0.09, shade(cfg.palette.symbolMain, 0.5));
    bodyGradient.addColorStop(0.26, cfg.palette.symbolMain);
    bodyGradient.addColorStop(1, shade(cfg.palette.symbolMain, -0.28));

    const core = paint(bodyGradient);
    const fringeA = paint(cfg.palette.fringeA);
    const fringeB = paint(cfg.palette.fringeB);

    // Bloom baked once, so no per-element blur is needed at render time.
    const glow = makeCanvas(size.w, size.h);
    const glowCtx = context2d(glow);
    glowCtx.filter = "blur(26px)";
    glowCtx.drawImage(core, 0, 0);
    glowCtx.globalCompositeOperation = "lighter";
    glowCtx.filter = "blur(72px)";
    glowCtx.globalAlpha = 0.9;
    glowCtx.drawImage(core, 0, 0);

    // A wide atmospheric halo behind everything.
    const haloR = SYMBOL_HEIGHT * 1.5;
    const halo = makeCanvas(haloR * 2, haloR * 2);
    const haloCtx = context2d(halo);
    const haloGradient = haloCtx.createRadialGradient(haloR, haloR, 0, haloR, haloR, haloR);
    haloGradient.addColorStop(0, withAlpha(cfg.palette.symbolMain, 0.5));
    haloGradient.addColorStop(0.42, withAlpha(cfg.palette.symbolMain, 0.16));
    haloGradient.addColorStop(1, withAlpha(cfg.palette.symbolMain, 0));
    haloCtx.fillStyle = haloGradient;
    haloCtx.fillRect(0, 0, haloR * 2, haloR * 2);

    const scratch = makeCanvas(size.w, size.h);

    return { core, fringeA, fringeB, glow, halo, scratch, size };
  }, [cfg]);

  useLayoutEffect(() => {
    const { core, fringeA, fringeB, glow, halo, scratch, size } = sprites;

    // Restamp the drifting scan texture onto a fresh copy of the core.
    const sctx = context2d(scratch);
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.globalAlpha = 1;
    sctx.globalCompositeOperation = "source-over";
    sctx.clearRect(0, 0, size.w, size.h);
    sctx.drawImage(core, 0, 0);
    sctx.globalCompositeOperation = "source-atop";
    const offset = (frame * SCAN_SPEED) % SCAN_SPACING;
    for (let y = offset - SCAN_SPACING; y < size.h; y += SCAN_SPACING) {
      sctx.fillStyle = black(0.46);
      sctx.fillRect(0, y, size.w, 7);
      sctx.fillStyle = white(0.13);
      sctx.fillRect(0, y + 10, size.w, 2);
    }

    const ctx = beginWorld(buffers.near, drift);
    ctx.save();
    ctx.translate(SYMBOL_CX, SYMBOL_CY);
    // The composition as a whole is flipped at composite time; flip the symbol
    // group back so the mark itself never reads mirrored.
    if (cfg.mirror) {
      ctx.scale(-1, 1);
    }

    const pulse = glowPulse(frame);
    ctx.globalAlpha = 0.26 * pulse;
    drawCentered(ctx, halo);
    ctx.globalAlpha = 0.26 * pulse;
    drawCentered(ctx, glow);

    const slices = glitchSlices(cfg.seed, glitch, size.h);
    const fringe = glitch.active ? FRINGE_GLITCH : FRINGE_BASE;
    ctx.globalAlpha = 0.5;
    drawBanded(ctx, fringeA, fringe, slices);
    drawBanded(ctx, fringeB, -fringe, slices);
    ctx.globalAlpha = 1;
    drawBanded(ctx, scratch, 0, slices);

    ctx.restore();
  });

  return null;
};

/** Exported so the loop check can assert the texture wraps a whole number of times. */
export const SCAN_WRAPS_PER_LOOP = (DURATION * SCAN_SPEED) / SCAN_SPACING;

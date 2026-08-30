import { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill } from "remotion";
import { useCurrentFrame } from "remotion";
import { BokehField } from "./BokehField";
import {
  clearLayer,
  context2d,
  type Buffers,
  type Layer,
  useBuffers,
} from "./buffers";
import { black, withAlpha } from "./color";
import { drawGrain, useGrainTiles } from "./grain";
import { buildGlitchSchedule, glitchAt } from "./glitch";
import { HudFragments } from "./HudFragments";
import {
  CANVAS_H,
  CANVAS_W,
  cameraDrift,
  FAR_BLUR,
  MID_BLUR,
  RING_OUTER,
  SYMBOL_CX,
  SYMBOL_CY,
  VIGNETTE_STRENGTH,
} from "./layout";
import { LightStreak } from "./LightStreak";
import { RingBand } from "./RingBand";
import { SymbolGlyph } from "./SymbolGlyph";
import { VARIANTS, type VariantConfig, type VariantName } from "./variants";

/**
 * Clears the depth buffers. React commits layout effects in tree order, child
 * subtrees before their parent, so placing this first means every drawing
 * component below it runs against a clean buffer and the parent's composite
 * effect runs last.
 */
const BufferReset: React.FC<{ buffers: Buffers }> = ({ buffers }) => {
  useLayoutEffect(() => {
    clearLayer(buffers.near);
    clearLayer(buffers.mid);
    clearLayer(buffers.far);
  });
  return null;
};

/** One blur per buffer, at half resolution, which is what makes 4K affordable. */
const blurLayer = (src: Layer, dst: Layer, blurPx: number) => {
  clearLayer(dst);
  dst.ctx.filter = `blur(${blurPx * dst.scale}px)`;
  dst.ctx.drawImage(src.canvas, 0, 0);
  dst.ctx.filter = "none";
};

const composite = (
  canvas: HTMLCanvasElement,
  buffers: Buffers,
  cfg: VariantConfig,
  frame: number,
  drift: { x: number; y: number },
  grainTiles: HTMLCanvasElement[],
) => {
  const ctx = context2d(canvas);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  ctx.filter = "none";

  ctx.fillStyle = cfg.palette.backgroundDeep;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  blurLayer(buffers.far, buffers.farBlur, FAR_BLUR);
  blurLayer(buffers.mid, buffers.midBlur, MID_BLUR);

  ctx.save();
  // The single horizontal flip that mirrors the whole composition.
  if (cfg.mirror) {
    ctx.translate(CANVAS_W, 0);
    ctx.scale(-1, 1);
  }

  const wx = SYMBOL_CX + drift.x;
  const wy = SYMBOL_CY + drift.y;
  const wash = ctx.createRadialGradient(wx, wy, 0, wx, wy, RING_OUTER * 3.1);
  wash.addColorStop(0, withAlpha(cfg.palette.backgroundWash, 0.95));
  wash.addColorStop(0.45, withAlpha(cfg.palette.backgroundWash, 0.4));
  wash.addColorStop(1, withAlpha(cfg.palette.backgroundWash, 0));
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.globalCompositeOperation = "lighter";
  ctx.drawImage(buffers.farBlur.canvas, 0, 0, CANVAS_W, CANVAS_H);
  ctx.drawImage(buffers.midBlur.canvas, 0, 0, CANVAS_W, CANVAS_H);
  ctx.globalCompositeOperation = "source-over";
  ctx.drawImage(buffers.near.canvas, 0, 0);
  ctx.restore();

  const vr = Math.hypot(CANVAS_W, CANVAS_H) / 2;
  const vignette = ctx.createRadialGradient(
    CANVAS_W / 2,
    CANVAS_H / 2,
    vr * 0.4,
    CANVAS_W / 2,
    CANVAS_H / 2,
    vr,
  );
  vignette.addColorStop(0, black(0));
  vignette.addColorStop(1, black(VIGNETTE_STRENGTH));
  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  drawGrain(ctx, grainTiles, cfg.seed, frame, CANVAS_W, CANVAS_H);
};

export type CryptoHudProps = { variant: VariantName };

export const CryptoHud: React.FC<CryptoHudProps> = ({ variant }) => {
  const cfg = VARIANTS[variant];
  const frame = useCurrentFrame();
  const buffers = useBuffers();
  const grainTiles = useGrainTiles(cfg.seed);
  const mainRef = useRef<HTMLCanvasElement>(null);

  const drift = cameraDrift(frame);
  const schedule = useMemo(() => buildGlitchSchedule(cfg.seed), [cfg.seed]);
  const glitch = glitchAt(schedule, frame);

  useLayoutEffect(() => {
    const canvas = mainRef.current;
    if (canvas) {
      composite(canvas, buffers, cfg, frame, drift, grainTiles);
    }
  });

  const shared = { buffers, cfg, frame, drift };

  return (
    <AbsoluteFill style={{ backgroundColor: cfg.palette.backgroundDeep }}>
      <canvas
        ref={mainRef}
        width={CANVAS_W}
        height={CANVAS_H}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <BufferReset buffers={buffers} />
      <LightStreak {...shared} />
      <HudFragments {...shared} />
      <BokehField {...shared} pass="back" />
      {cfg.bands.map((band) => (
        <RingBand key={band.id} {...shared} band={band} />
      ))}
      <SymbolGlyph {...shared} glitch={glitch} />
      {/* Drawn after the symbol so these discs pass in front of it. */}
      <BokehField {...shared} pass="front" />
    </AbsoluteFill>
  );
};

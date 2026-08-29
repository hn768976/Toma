import React, { useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { BackgroundWash } from "./BackgroundWash";
import { DepthLayer } from "./DepthLayer";
import { BUFFER_BLUR, DURATION_IN_FRAMES, evaluate } from "./field";
import { drawGrain } from "./grain";
import { rgba } from "./color";
import { useFinalCanvasPass } from "./useCanvasPass";
import { VARIANTS, type VariantKey } from "./variants";

export type FormulaFieldProps = {
  variant: VariantKey;
};

const BLOOM_SCALE = 0.5;
const BLOOM_BLUR = 22;
const BLOOM_ALPHA = 0.28;
const VIGNETTE = 0.22;

const createBuffer = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
};

/**
 * A field of scientific notation drifting through a dark volume.
 *
 * One visible canvas with a 3840×2160 backing store. Behind it sit four
 * offscreen buffers: the background wash, and one per depth bucket. Each
 * bucket is blurred exactly once as it is composited, which is what makes
 * depth of field affordable across seventy glyphs at 4K.
 *
 * Every quantity is a pure function of useCurrentFrame(), and every period in
 * the piece divides 600, so the composition loops seamlessly.
 */
export const FormulaField: React.FC<FormulaFieldProps> = ({ variant: variantKey }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const variant = VARIANTS[variantKey];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const buffers = useMemo(
    () => ({
      bg: createBuffer(width, height),
      far: createBuffer(width, height),
      mid: createBuffer(width, height),
      near: createBuffer(width, height),
      bloom: createBuffer(width * BLOOM_SCALE, height * BLOOM_SCALE),
    }),
    [width, height],
  );

  const glyphs = useMemo(
    () => evaluate(variant, frame, width, height),
    [variant, frame, width, height],
  );

  // Runs last, after every child pass has painted its buffer.
  useFinalCanvasPass(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(buffers.bg, 0, 0);

    // Depth of field: three buffers, three blurs, whatever the glyph count.
    ctx.filter = `blur(${BUFFER_BLUR.far}px)`;
    ctx.drawImage(buffers.far, 0, 0);
    ctx.filter = "none";
    ctx.drawImage(buffers.mid, 0, 0);
    ctx.filter = `blur(${BUFFER_BLUR.near}px)`;
    ctx.drawImage(buffers.near, 0, 0);
    ctx.filter = "none";

    // Bloom, taken from the sharp and near glyphs only so the background wash
    // does not smear into a haze.
    const bctx = buffers.bloom.getContext("2d");
    if (bctx) {
      bctx.setTransform(1, 0, 0, 1, 0, 0);
      bctx.globalCompositeOperation = "source-over";
      bctx.globalAlpha = 1;
      bctx.clearRect(0, 0, buffers.bloom.width, buffers.bloom.height);
      bctx.drawImage(buffers.mid, 0, 0, buffers.bloom.width, buffers.bloom.height);
      bctx.globalAlpha = 0.7;
      bctx.drawImage(buffers.near, 0, 0, buffers.bloom.width, buffers.bloom.height);
      bctx.globalAlpha = 1;

      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = BLOOM_ALPHA;
      ctx.filter = `blur(${BLOOM_BLUR}px)`;
      ctx.drawImage(buffers.bloom, 0, 0, width, height);
      ctx.restore();
      ctx.filter = "none";
    }

    // Vignette.
    const vg = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.28,
      width / 2,
      height / 2,
      Math.hypot(width, height) * 0.56,
    );
    vg.addColorStop(0, rgba(variant.palette.deep, 0));
    vg.addColorStop(0.6, rgba(variant.palette.deep, VIGNETTE * 0.42));
    vg.addColorStop(1, rgba(variant.palette.deep, VIGNETTE * 4.2));
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, width, height);

    drawGrain(ctx, frame, width, height, DURATION_IN_FRAMES);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  });

  return (
    <AbsoluteFill style={{ backgroundColor: variant.palette.deep }}>
      <BackgroundWash
        buffer={buffers.bg}
        palette={variant.palette}
        width={width}
        height={height}
      />
      <DepthLayer
        buffer={buffers.far}
        variant={variant}
        bucket="far"
        glyphs={glyphs}
        motionBlur={false}
        frameW={width}
        frameH={height}
      />
      <DepthLayer
        buffer={buffers.mid}
        variant={variant}
        bucket="mid"
        glyphs={glyphs}
        motionBlur={false}
        frameW={width}
        frameH={height}
      />
      <DepthLayer
        buffer={buffers.near}
        variant={variant}
        bucket="near"
        glyphs={glyphs}
        motionBlur
        frameW={width}
        frameH={height}
      />
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};

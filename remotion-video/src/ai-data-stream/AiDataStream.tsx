import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BLUR_BUCKETS,
  DURATION_IN_FRAMES,
  FONT_FAMILY,
  LETTER_SPACING_EM,
  MONO_ADVANCE_EM,
  THEMES,
} from "./constants";
import {
  cameraAt,
  computeVisibility,
  generateLabels,
  projectLabel,
  type Projected,
} from "./field";

export const aiDataStreamSchema = z.object({
  theme: z.enum(["dark", "light"]),
  // 1 = 1080p (1920x1080), 2 = 4K (3840x2160). Must match the width/height
  // the Composition is registered with in Root.tsx.
  resolutionScale: z.number().positive(),
  // Depth-of-field strength. 0 = every label crisp (default); 1 = full
  // blur on labels far from the focus plane.
  depthOfField: z.number().min(0),
});

export type AiDataStreamProps = z.infer<typeof aiDataStreamSchema>;

export const aiDataStreamDefaults: AiDataStreamProps = {
  theme: "dark",
  resolutionScale: 1,
  depthOfField: 0,
};

type Ctx = CanvasRenderingContext2D & { letterSpacing?: string };

const createCanvas = (width: number, height: number) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(width);
  canvas.height = Math.ceil(height);
  return canvas;
};

// Which two blur buckets bracket `blur`, and how much of the label goes
// into the softer one. Returns [lowerIndex, weightOfUpper].
const bucketMix = (blur: number): [number, number] => {
  for (let i = 0; i < BLUR_BUCKETS.length - 1; i++) {
    const lo = BLUR_BUCKETS[i].radius;
    const hi = BLUR_BUCKETS[i + 1].radius;
    if (blur <= hi) return [i, Math.max(0, (blur - lo) / (hi - lo))];
  }
  return [BLUR_BUCKETS.length - 1, 0];
};

const drawLabel = (
  ctx: Ctx,
  p: Projected,
  alpha: number,
  s: number, // resolution scale of this bucket canvas
  theme: (typeof THEMES)["dark"],
) => {
  const { label } = p;
  const fontPx = label.fontSize * p.scale * s;
  ctx.save();
  ctx.translate(p.screenX * s, p.screenY * s);
  ctx.rotate(label.rotation);
  ctx.font = `${label.italic ? "italic " : ""}${label.bold ? 700 : 400} ${fontPx.toFixed(2)}px "${FONT_FAMILY}", monospace`;
  if (ctx.letterSpacing !== undefined) {
    ctx.letterSpacing = `${(fontPx * LETTER_SPACING_EM).toFixed(2)}px`;
  }

  // Chromatic split on soft foreground labels.
  if (p.depthT < 0.3 && p.blur > 4) {
    const split = Math.min(12, p.blur * 0.3) * s;
    ctx.globalAlpha = alpha * theme.aberrationAlpha;
    ctx.fillStyle = theme.aberrationColors[0];
    ctx.fillText(label.text, -split, 0);
    ctx.fillStyle = theme.aberrationColors[1];
    ctx.fillText(label.text, split, 0);
  }

  ctx.globalAlpha = alpha;
  ctx.fillStyle = theme.palette[label.colorIndex];
  ctx.fillText(label.text, 0, 0);

  if (p.glitch) {
    // Shift a horizontal slice of the label sideways for a few frames.
    const bandTop = p.glitch.bandStart * fontPx;
    const bandH = p.glitch.bandHeight * fontPx;
    const wide = label.text.length * fontPx;
    ctx.beginPath();
    ctx.rect(-wide, bandTop, wide * 2, bandH);
    ctx.clip();
    ctx.fillStyle = theme.aberrationColors[p.glitch.offset < 0 ? 0 : 1];
    ctx.fillText(label.text, p.glitch.offset * s, 0);
  }
  ctx.restore();
};

// A field of glowing monospace telemetry labels scattered through 3D
// space, with the camera slowly dollying through it. Depth of field is
// faked by drawing each label into blur-bucket layers that are blurred
// once each, bloom comes from CSS-blurred copies of the whole text pass
// blended over the crisp copy, and out-of-focus foreground labels get a
// magenta/cyan chromatic split. Everything is canvas so several hundred
// soft, glowing labels per frame stay cheap enough to render at 4K.
export const AiDataStream: React.FC<AiDataStreamProps> = ({
  theme: themeName,
  resolutionScale,
  depthOfField,
}) => {
  const frame = useCurrentFrame();
  const theme = THEMES[themeName];
  const s = resolutionScale;
  const width = BASE_WIDTH * s;
  const height = BASE_HEIGHT * s;

  const labels = useMemo(() => generateLabels(theme.palette.length), [theme]);
  // Per-frame, per-label visibility that keeps labels from overlapping.
  const visibility = useMemo(
    () => computeVisibility(labels, BASE_WIDTH, BASE_HEIGHT, theme.farDim, depthOfField),
    [labels, theme, depthOfField],
  );
  const buckets = useMemo(
    () =>
      BLUR_BUCKETS.map((b) => ({
        ...b,
        canvas: createCanvas(width / b.downscale, height / b.downscale),
      })),
    [width, height],
  );
  const composite = useMemo(() => createCanvas(width, height), [width, height]);
  const bloomRef = useRef<HTMLCanvasElement>(null);
  const haloRef = useRef<HTMLCanvasElement>(null);
  const sharpRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    if (!composite) return;
    const compositeCtx = composite.getContext("2d");
    const bucketCtxs = buckets.map((b) => b.canvas?.getContext("2d") as Ctx | null);
    const outputs = [bloomRef, haloRef, sharpRef].map((r) => r.current?.getContext("2d"));
    if (!compositeCtx || bucketCtxs.some((c) => !c) || outputs.some((c) => !c)) return;

    const camera = cameraAt(frame);
    const projected: Projected[] = [];
    for (const label of labels) {
      const p = projectLabel(label, camera, frame, BASE_WIDTH, BASE_HEIGHT, theme.farDim, depthOfField);
      const loopFrame = ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
      p.alpha *= visibility[label.index * DURATION_IN_FRAMES + loopFrame];
      if (p.alpha <= 0.01) continue;
      // Cheap cull using the monospace advance width.
      const fontPx = label.fontSize * p.scale;
      const halfW =
        (label.text.length * fontPx * (MONO_ADVANCE_EM + LETTER_SPACING_EM)) / 2 +
        p.blur * 2;
      const halfH = fontPx + p.blur * 2;
      if (
        p.screenX + halfW < 0 ||
        p.screenX - halfW > BASE_WIDTH ||
        p.screenY + halfH < 0 ||
        p.screenY - halfH > BASE_HEIGHT
      ) {
        continue;
      }
      projected.push(p);
    }
    // Painter's order: far to near.
    projected.sort((a, b) => b.z - a.z);

    for (let i = 0; i < buckets.length; i++) {
      const ctx = bucketCtxs[i] as Ctx;
      const c = buckets[i].canvas as HTMLCanvasElement;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.globalCompositeOperation = theme.composite;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
    }

    for (const p of projected) {
      const [lo, w] = bucketMix(p.blur);
      if (w < 0.999) {
        drawLabel(bucketCtxs[lo] as Ctx, p, p.alpha * (1 - w), s / buckets[lo].downscale, theme);
      }
      if (w > 0.001 && lo + 1 < buckets.length) {
        drawLabel(bucketCtxs[lo + 1] as Ctx, p, p.alpha * w, s / buckets[lo + 1].downscale, theme);
      }
    }

    // One blur per bucket, softest first so crisp text sits on top.
    compositeCtx.setTransform(1, 0, 0, 1, 0, 0);
    compositeCtx.filter = "none";
    compositeCtx.clearRect(0, 0, width, height);
    compositeCtx.globalCompositeOperation = theme.composite;
    for (let i = buckets.length - 1; i >= 0; i--) {
      const b = buckets[i];
      compositeCtx.filter = b.radius > 0 ? `blur(${(b.radius * s).toFixed(2)}px)` : "none";
      compositeCtx.drawImage(b.canvas as HTMLCanvasElement, 0, 0, width, height);
    }
    compositeCtx.filter = "none";

    for (const target of outputs) {
      const t = target as CanvasRenderingContext2D;
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.clearRect(0, 0, width, height);
      t.drawImage(composite, 0, 0);
    }
  }, [frame, labels, visibility, buckets, composite, theme, width, height, s, depthOfField]);

  const layer = (extra: React.CSSProperties): React.CSSProperties => ({
    position: "absolute",
    inset: 0,
    width,
    height,
    ...extra,
  });

  return (
    <AbsoluteFill style={{ background: theme.background }}>
      {/* Wide bloom. */}
      <canvas
        ref={bloomRef}
        width={width}
        height={height}
        style={layer({
          filter: `blur(${theme.bloomBlurPx * s}px)`,
          mixBlendMode: theme.bloomBlend,
          opacity: theme.bloomOpacity,
        })}
      />
      {/* Tight halo. */}
      <canvas
        ref={haloRef}
        width={width}
        height={height}
        style={layer({
          filter: `blur(${theme.haloBlurPx * s}px)`,
          mixBlendMode: theme.bloomBlend,
          opacity: theme.haloOpacity,
        })}
      />
      <canvas ref={sharpRef} width={width} height={height} style={layer({})} />
      {/* Fine scanlines, like a display surface. */}
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(to bottom, ${theme.scanlineColor} 0px, ${theme.scanlineColor} ${s}px, transparent ${s}px, transparent ${3 * s}px)`,
          pointerEvents: "none",
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 75% 70% at 50% 50%, transparent 45%, ${theme.vignette} 100%)`,
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import {
  BASE_HEIGHT,
  BASE_WIDTH,
  BITMAP_OVERSAMPLE,
  BITMAP_SCALE_CAP,
  BLOOM_DOWNSCALE,
  BLOOM_TIGHT_BLUR_PX,
  BLOOM_TIGHT_STRENGTH,
  BLOOM_WIDE_BLUR_PX,
  BLOOM_WIDE_STRENGTH,
  CULL_NEAR_Z,
  FOCAL,
} from "./constants";
import { blurForDepth, buildField, buildStreaks, cameraAt } from "./field";
import type { Panel, Streak } from "./field";
import { renderPanelBitmap } from "./draw";
import type { PanelBitmap } from "./draw";
import { loadCodeFont } from "./font";
import { THEMES } from "./themes";
import type { Theme } from "./themes";

export const codeWallSchema = z.object({
  /** Colourway: "blue" matches the reference, "green" is the regrade. */
  theme: z.enum(["blue", "green"]),
  /** 1 = 1080p (1920x1080), 2 = 4K (3840x2160). Must match the Composition. */
  resolutionScale: z.number().positive(),
  /** Changes the entire layout of the wall without touching the look. */
  seed: z.number().int(),
});

export type CodeWallProps = z.infer<typeof codeWallSchema>;

export const codeWallDefaults: CodeWallProps = {
  theme: "blue",
  resolutionScale: 1,
  seed: 20250914,
};

const createCanvas = (w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
};

/**
 * A fine noise tile, screened over the finished frame at a couple of
 * percent. Large, very dark gradients band badly once H.264 gets hold of
 * them; a little grain dithers the steps away and also sells the
 * "photographed screen" texture.
 */
const buildGrainTile = (size: number) => {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const img = ctx.createImageData(size, size);
  let s = 0x2f6f2b7d;
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 1664525 + 1013904223) | 0;
    const v = ((s >>> 16) & 255) * 0.5 + 40;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
};

const drawBackdrop = (
  ctx: CanvasRenderingContext2D,
  theme: Theme,
  t: number,
) => {
  // The hot spot drifts a little so the backdrop never feels like a static
  // gradient sitting behind moving content.
  const cx = BASE_WIDTH * (0.62 + Math.sin(t * Math.PI * 2) * 0.05);
  const cy = BASE_HEIGHT * (0.34 + Math.cos(t * Math.PI * 2 * 0.7) * 0.05);
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, BASE_WIDTH * 0.95);
  grad.addColorStop(0, theme.backdrop.inner);
  grad.addColorStop(0.45, theme.backdrop.mid);
  grad.addColorStop(1, theme.backdrop.outer);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
};

const drawStreaks = (
  ctx: CanvasRenderingContext2D,
  streaks: Streak[],
  theme: Theme,
  t: number,
  durationSeconds: number,
) => {
  ctx.globalCompositeOperation = "screen";
  streaks.forEach((s) => {
    // Wrap through a range slightly taller than the frame so a streak never
    // pops in or out at an edge.
    const yNorm = (((s.y0 + s.drift * t) % 1.3) + 1.3) % 1.3 - 0.15;
    const y = yNorm * BASE_HEIGHT;
    const cx = (s.x0 + s.xDrift * t) * BASE_WIDTH;
    const half = (s.length * BASE_WIDTH) / 2;
    const pulse =
      0.55 +
      0.45 *
        Math.sin(
          ((t * durationSeconds) / s.pulsePeriod + s.pulsePhase) * Math.PI * 2,
        );

    const color = s.hot ? theme.streakHot : theme.streak;
    const grad = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, "rgba(0,0,0,0)");

    ctx.filter = `blur(${s.blur.toFixed(1)}px)`;
    ctx.globalAlpha = s.intensity * pulse;
    ctx.fillStyle = grad;
    ctx.fillRect(cx - half, y - s.thickness / 2, half * 2, s.thickness);
  });
  ctx.filter = "none";
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
};

const drawVignette = (ctx: CanvasRenderingContext2D, theme: Theme) => {
  const grad = ctx.createRadialGradient(
    BASE_WIDTH / 2,
    BASE_HEIGHT / 2,
    BASE_HEIGHT * 0.22,
    BASE_WIDTH / 2,
    BASE_HEIGHT / 2,
    BASE_WIDTH * 0.78,
  );
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(0.62, "rgba(0,0,0,0)");
  grad.addColorStop(1, theme.vignette);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
};

/**
 * A drifting 3D field of translucent code panels and HUD frames, shot with
 * a shallow depth of field — the "digital data wall" look.
 *
 * Drawn on a canvas rather than with DOM nodes: the wall is ~100 panels of
 * 20-plus lines each, and no browser will lay that out (let alone blur each
 * panel independently) at 30fps in a DOM tree. Panels are rasterised once
 * into offscreen bitmaps and then blitted per frame with a per-depth blur.
 */
export const CodeWall: React.FC<CodeWallProps> = ({
  theme: themeName,
  resolutionScale,
  seed,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps, width, height } = useVideoConfig();
  const theme = THEMES[themeName];

  const [fontHandle] = useState(() => delayRender("Loading Share Tech Mono"));
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const done = () => {
      if (cancelled) return;
      setFontReady(true);
      continueRender(fontHandle);
    };
    loadCodeFont().then(done).catch(done);
    return () => {
      cancelled = true;
    };
  }, [fontHandle]);

  const panels = useMemo(() => buildField(seed), [seed]);
  const streaks = useMemo(() => buildStreaks(seed), [seed]);

  // Bitmaps depend on the font being registered, hence the fontReady gate.
  const bitmaps = useMemo<PanelBitmap[] | null>(() => {
    if (!fontReady || typeof document === "undefined") return null;
    const bitmapScale = Math.min(
      BITMAP_OVERSAMPLE * resolutionScale,
      BITMAP_SCALE_CAP,
    );
    return panels.map((panel) => {
      // Rasterise at roughly the size the panel occupies on screen at its
      // seeded depth, so bitmap resolution tracks apparent size instead of
      // authored size (far panels stay cheap, near ones stay sharp enough).
      const apparentScale = FOCAL / panel.z;
      return renderPanelBitmap(panel, theme, apparentScale * bitmapScale);
    });
  }, [panels, theme, resolutionScale, fontReady]);

  const grain = useMemo(
    () => (typeof document === "undefined" ? null : buildGrainTile(256)),
    [],
  );
  // Two persistent quarter-size scratch canvases for the bloom: one holds
  // the downscaled frame, the other each blurred tap. Allocated once —
  // creating them per frame (or round-tripping the frame through
  // getImageData) costs more than everything else in the draw combined.
  const bloomSrc = useMemo(
    () =>
      typeof document === "undefined"
        ? null
        : createCanvas(BASE_WIDTH / BLOOM_DOWNSCALE, BASE_HEIGHT / BLOOM_DOWNSCALE),
    [],
  );
  const bloomTmp = useMemo(
    () =>
      typeof document === "undefined"
        ? null
        : createCanvas(BASE_WIDTH / BLOOM_DOWNSCALE, BASE_HEIGHT / BLOOM_DOWNSCALE),
    [],
  );

  const canvasRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !bitmaps) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Draw in 1080p logical units; the backing store is resolutionScale
    // times larger, so 1080p and 4K are the identical frame at two sizes.
    ctx.setTransform(resolutionScale, 0, 0, resolutionScale, 0, 0);
    ctx.clearRect(0, 0, BASE_WIDTH, BASE_HEIGHT);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.filter = "none";

    const t = durationInFrames <= 1 ? 0 : frame / (durationInFrames - 1);
    const durationSeconds = durationInFrames / fps;
    const cam = cameraAt(t, durationSeconds);

    drawBackdrop(ctx, theme, t);

    // Panels, far to near (buildField already sorted by depth).
    //
    // Composited with plain source-over, NOT "screen": screen-blending a hot
    // orange bar over the navy backdrop lifts its blue channel and turns it
    // salmon. Straight alpha keeps the accents the colour they were authored,
    // and lets a defocused foreground panel veil what is behind it the way a
    // real pane of glass would. The additive, everything-glows quality comes
    // from the bloom pass below instead.
    ctx.globalCompositeOperation = "source-over";
    const centreX = BASE_WIDTH / 2;
    const centreY = BASE_HEIGHT / 2;

    panels.forEach((panel: Panel, i: number) => {
      const depth = panel.z - cam.z;
      if (depth <= CULL_NEAR_Z) return;

      const scale = FOCAL / depth;
      const bmp = bitmaps[i];
      const drawW = (panel.width + bmp.bleed * 2) * scale;
      const drawH = (panel.height + bmp.bleed * 2) * scale;
      const left = centreX + (panel.x - cam.x - panel.width / 2 - bmp.bleed) * scale;
      const top = centreY + (panel.y - cam.y - panel.height / 2 - bmp.bleed) * scale;

      const blur = blurForDepth(depth);
      // Blurring spreads a panel well past its own box — a CSS blur(N) is a
      // Gaussian with sigma N, so the visible tail runs to about 3N. This
      // margin is used both to decide visibility (or edge panels flick out
      // while still on screen) and to size the clip below.
      const margin = blur * 3 + 4;
      if (
        left + drawW < -margin ||
        left > BASE_WIDTH + margin ||
        top + drawH < -margin ||
        top > BASE_HEIGHT + margin
      ) {
        return;
      }

      ctx.globalAlpha = panel.opacity;
      if (blur > 0.25) {
        // Clip to the panel's blurred footprint before setting ctx.filter.
        // Without a clip Chrome sizes the intermediate layer a filtered
        // drawImage needs to the whole canvas, so ~185 panels means ~185
        // full-frame allocations per frame; clipping makes each layer the
        // size of the panel instead.
        ctx.save();
        ctx.beginPath();
        ctx.rect(left - margin, top - margin, drawW + margin * 2, drawH + margin * 2);
        ctx.clip();
        ctx.filter = `blur(${blur.toFixed(2)}px)`;
        ctx.drawImage(bmp.canvas, left, top, drawW, drawH);
        ctx.restore();
      } else {
        ctx.filter = "none";
        ctx.drawImage(bmp.canvas, left, top, drawW, drawH);
      }
    });

    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    drawStreaks(ctx, streaks, theme, t, durationSeconds);

    // Bloom: two blurred copies of the frame screened back over it — a
    // tight halo for emissive-looking text and a wide wash for haze.
    //
    // The frame is downscaled ONCE into bloomSrc, and both taps blur that
    // quarter-size copy (so the radii are divided by BLOOM_DOWNSCALE).
    // Taking both taps from the same pre-bloom downscale is also what keeps
    // the second tap from blurring the brightening the first one added.
    if (bloomSrc && bloomTmp) {
      const srcCtx = bloomSrc.getContext("2d");
      const tmpCtx = bloomTmp.getContext("2d");
      if (srcCtx && tmpCtx) {
        srcCtx.setTransform(1, 0, 0, 1, 0, 0);
        srcCtx.clearRect(0, 0, bloomSrc.width, bloomSrc.height);
        srcCtx.drawImage(canvas, 0, 0, bloomSrc.width, bloomSrc.height);

        const taps: [number, number][] = [
          [BLOOM_TIGHT_BLUR_PX, BLOOM_TIGHT_STRENGTH],
          [BLOOM_WIDE_BLUR_PX, BLOOM_WIDE_STRENGTH],
        ];
        taps.forEach(([blurPx, strength]) => {
          tmpCtx.setTransform(1, 0, 0, 1, 0, 0);
          tmpCtx.clearRect(0, 0, bloomTmp.width, bloomTmp.height);
          tmpCtx.filter = `blur(${(blurPx / BLOOM_DOWNSCALE).toFixed(2)}px)`;
          tmpCtx.drawImage(bloomSrc, 0, 0);
          tmpCtx.filter = "none";

          ctx.globalCompositeOperation = "screen";
          ctx.globalAlpha = strength * theme.bloomScale;
          ctx.drawImage(bloomTmp, 0, 0, BASE_WIDTH, BASE_HEIGHT);
        });
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      }
    }

    drawVignette(ctx, theme);

    if (grain) {
      const pattern = ctx.createPattern(grain, "repeat");
      if (pattern) {
        // Offset per frame so the grain crawls instead of sitting still.
        const ox = (frame * 37) % 256;
        const oy = (frame * 61) % 256;
        ctx.save();
        ctx.globalCompositeOperation = "overlay";
        ctx.globalAlpha = 0.05;
        ctx.translate(-ox, -oy);
        ctx.fillStyle = pattern;
        ctx.fillRect(0, 0, BASE_WIDTH + 256, BASE_HEIGHT + 256);
        ctx.restore();
      }
    }
  }, [
    frame,
    durationInFrames,
    fps,
    panels,
    bitmaps,
    streaks,
    theme,
    resolutionScale,
    bloomSrc,
    bloomTmp,
    grain,
  ]);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.backdrop.outer }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
    </AbsoluteFill>
  );
};

import React, { useMemo } from "react";
import { useVideoConfig } from "remotion";
import { makeBuffer } from "./CanvasLayer";
import { FocusPass } from "./FocusPass";
import {
  BLUR_BUCKETS,
  buildScene,
  bucketGain,
  bucketGlowGain,
  type Scene,
} from "./geometry";
import { rampAt, rgba, type Palette } from "./palettes";
import type { CompositionSpec } from "./types";

/** Glow-pass shadow radius, authored against a 3840px-wide frame. */
const SHADOW_BLUR = 26;
const GLOW_ALPHA = 0.14;
const CORE_ALPHA = 0.95;

/**
 * Alpha alone saturates at 1, so once a blur bracket asks for more brightness
 * than that, the surplus goes into the colour instead — which is what makes
 * the soft regions bloom rather than clip.
 */
const strokeFor = (
  palette: Palette,
  rampPos: number,
  baseAlpha: number,
  level: number,
  gain: number,
) => {
  const want = baseAlpha * level * gain;
  return rgba(rampAt(palette, rampPos), Math.min(1, want), Math.min(2.4, Math.max(1, want)));
};

const strokePath = (ctx: CanvasRenderingContext2D, pts: number[]) => {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
};

/**
 * Paints the scene's segments into one buffer per blur bracket.
 *
 * Every ring is laid down twice and composited with 'lighter': a wide, soft,
 * low-alpha glow with a shadow behind it, then a thin bright core. A single
 * semi-transparent stroke reads flat and never gets near the neon look.
 */
const renderBuckets = (
  scene: Scene,
  palette: Palette,
  width: number,
  height: number,
) => {
  const scale = width / 3840;
  const canvases: HTMLCanvasElement[] = [];
  const contexts: CanvasRenderingContext2D[] = [];

  for (let i = 0; i < BLUR_BUCKETS; i++) {
    const canvas = makeBuffer(width, height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2d context unavailable for a blur bracket");
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    canvases.push(canvas);
    contexts.push(ctx);
  }

  // Pass 1 — the wide soft glow, with the shadow doing the spreading.
  for (let i = 0; i < BLUR_BUCKETS; i++) {
    contexts[i].shadowBlur = SHADOW_BLUR * scale;
  }
  for (const seg of scene.segments) {
    const ctx = contexts[seg.bucket];
    const colour = strokeFor(
      palette,
      0.05 + seg.level * 0.6,
      GLOW_ALPHA * seg.weight,
      seg.level,
      bucketGlowGain(seg.bucket),
    );
    ctx.strokeStyle = colour;
    ctx.shadowColor = colour;
    ctx.lineWidth = seg.glowWidth;
    strokePath(ctx, seg.pts);
  }

  // Pass 2 — the thin bright core, no shadow.
  for (let i = 0; i < BLUR_BUCKETS; i++) {
    contexts[i].shadowBlur = 0;
    contexts[i].shadowColor = "rgba(0, 0, 0, 0)";
  }
  for (const seg of scene.segments) {
    const ctx = contexts[seg.bucket];
    ctx.strokeStyle = strokeFor(
      palette,
      0.3 + seg.level * 0.7,
      CORE_ALPHA * seg.weight,
      seg.level,
      bucketGain(seg.bucket),
    );
    ctx.lineWidth = seg.coreWidth;
    strokePath(ctx, seg.pts);
  }

  // The ripple origin itself.
  for (const glow of scene.glows) {
    const ctx = contexts[glow.bucket];
    const g = ctx.createRadialGradient(
      glow.x,
      glow.y,
      0,
      glow.x,
      glow.y,
      glow.radius,
    );
    g.addColorStop(0, rgba(rampAt(palette, 1), 0.62 * glow.level));
    g.addColorStop(0.35, rgba(rampAt(palette, 0.7), 0.24 * glow.level));
    g.addColorStop(1, rgba(rampAt(palette, 0.4), 0));
    ctx.fillStyle = g;
    ctx.fillRect(
      glow.x - glow.radius,
      glow.y - glow.radius,
      glow.radius * 2,
      glow.radius * 2,
    );
  }

  return canvases;
};

export const SphereRings: React.FC<{
  spec: CompositionSpec;
  palette: Palette;
}> = ({ spec, palette }) => {
  const { width, height } = useVideoConfig();

  const scene = useMemo(
    () => buildScene(spec, width, height),
    [spec, width, height],
  );

  // Fresh buffers on every evaluation, so a double render can never
  // additively stack the rings on top of themselves.
  const buckets = useMemo(
    () => renderBuckets(scene, palette, width, height),
    [scene, palette, width, height],
  );

  return <FocusPass buckets={buckets} blurPx={scene.blurPx} />;
};

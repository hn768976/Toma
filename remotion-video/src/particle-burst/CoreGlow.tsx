import React, { useLayoutEffect, useRef } from "react";
import { useCurrentFrame } from "remotion";
import { CENTER_X, CENTER_Y, HEIGHT, VARIANTS, WIDTH } from "./config";
import { sampleCurve } from "./motion";
import { rgba, rgbOf, type Variant } from "./theme";

// A soft radial gradient upscales perfectly, so this layer is drawn at a
// quarter of 4K and stretched. Saves ~30MB of canvas per render worker.
const RESOLUTION_SCALE = 0.25;

const LAYER_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  mixBlendMode: "plus-lighter",
};

/**
 * The light at the centre of frame: in the burst, only a faint brightening
 * just before detonation. In the implosion, the climax — a single hard
 * white-cyan flash after the particles collapse into the middle.
 */
export const CoreGlow: React.FC<{ variant: Variant }> = ({ variant }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const cfg = VARIANTS[variant];

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, WIDTH * RESOLUTION_SCALE, HEIGHT * RESOLUTION_SCALE);

    const intensity = sampleCurve(cfg.coreGlow.curve, frame);
    if (intensity <= 0.001) return;

    // Draw in full-resolution coordinates.
    ctx.scale(RESOLUTION_SCALE, RESOLUTION_SCALE);
    ctx.globalCompositeOperation = "lighter";

    const inner = rgbOf(variant, cfg.coreGlow.innerKey);
    const outer = rgbOf(variant, cfg.coreGlow.outerKey);

    // The bloom swells slightly as it peaks rather than only brightening.
    const radius = cfg.coreGlow.radiusPx * (0.72 + 0.38 * intensity);
    const bloom = ctx.createRadialGradient(
      CENTER_X,
      CENTER_Y,
      0,
      CENTER_X,
      CENTER_Y,
      radius,
    );
    bloom.addColorStop(0, rgba(inner, Math.min(1, intensity)));
    bloom.addColorStop(0.18, rgba(inner, intensity * 0.62));
    bloom.addColorStop(0.45, rgba(outer, intensity * 0.24));
    bloom.addColorStop(1, rgba(outer, 0));
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // A hot core inside the bloom, so the middle blows out rather than
    // reading as a wide soft haze.
    const core = ctx.createRadialGradient(
      CENTER_X,
      CENTER_Y,
      0,
      CENTER_X,
      CENTER_Y,
      cfg.coreGlow.hotCoreRadiusPx * (0.6 + 0.6 * intensity),
    );
    core.addColorStop(0, rgba(inner, Math.min(1, intensity * 1.35)));
    core.addColorStop(0.5, rgba(inner, intensity * 0.5));
    core.addColorStop(1, rgba(inner, 0));
    ctx.fillStyle = core;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  });

  return (
    <canvas
      ref={canvasRef}
      width={Math.round(WIDTH * RESOLUTION_SCALE)}
      height={Math.round(HEIGHT * RESOLUTION_SCALE)}
      style={LAYER_STYLE}
    />
  );
};

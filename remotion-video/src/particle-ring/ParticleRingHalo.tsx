import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import {
  BACKGROUND_COLOR,
  HALO_DRIFT_PERIOD,
  RIPPLE_PERIOD,
  SHIMMER_PERIOD,
  VIGNETTE_COLOR,
  WIGGLE_PERIOD,
  computeGeometry,
} from "./constants";
import {
  generateHaloParticles,
  generateRingParticles,
  haloStartRadius,
} from "./particles";
import { gradientColorAt } from "./color";

export const particleRingHaloSchema = z.object({
  backgroundColor: z.string(),
  // 1 = 1080p (1920x1080), 2 = 4K (3840x2160), etc. Must match the
  // width/height the Composition is registered with in Root.tsx.
  resolutionScale: z.number().positive(),
  // Optional overrides; omit to auto-scale with resolutionScale.
  ringParticleCount: z.number().int().positive().optional(),
  haloParticleCount: z.number().int().positive().optional(),
});

export type ParticleRingHaloProps = z.infer<typeof particleRingHaloSchema>;

export const particleRingHaloDefaults: ParticleRingHaloProps = {
  backgroundColor: BACKGROUND_COLOR,
  resolutionScale: 1,
};

const RIPPLE_LOBES = 3;
const RIPPLE_TIME_FREQ = (Math.PI * 2) / RIPPLE_PERIOD;
const SHIMMER_TIME_FREQ = (Math.PI * 2) / SHIMMER_PERIOD;
const WIGGLE_TIME_FREQ = (Math.PI * 2) / WIGGLE_PERIOD;

const createCanvas = (width: number, height: number) => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

// Abstract particle-ring halo: a glowing ring of thousands of tiny
// particles gradating violet -> blue -> cyan, with a soft scatter of
// particles drifting outward and fading around its outer edge. Drawn on
// canvas (not SVG/DOM) since it's the only way to push thousands of
// glowing dots per frame at a reasonable render speed. Bloom comes from
// stacking a CSS-blurred copy of the same particle pass under a crisp
// copy, both blended with "screen" over the navy background.
export const ParticleRingHalo: React.FC<ParticleRingHaloProps> = ({
  backgroundColor,
  resolutionScale,
  ringParticleCount,
  haloParticleCount,
}) => {
  const frame = useCurrentFrame();

  const geometry = useMemo(
    () => computeGeometry(resolutionScale, ringParticleCount, haloParticleCount),
    [resolutionScale, ringParticleCount, haloParticleCount],
  );
  const { width, height, centerX, centerY } = geometry;
  const haloStart = useMemo(() => haloStartRadius(geometry), [geometry]);
  const haloMaxRadius = haloStart + geometry.haloDriftDistance;

  const ringParticles = useMemo(() => generateRingParticles(geometry), [geometry]);
  const haloParticles = useMemo(() => generateHaloParticles(geometry), [geometry]);

  const offscreen = useMemo(() => createCanvas(width, height), [width, height]);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const sharpRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    if (!offscreen) return;
    const ctx = offscreen.getContext("2d");
    const glowCtx = glowRef.current?.getContext("2d");
    const sharpCtx = sharpRef.current?.getContext("2d");
    if (!ctx || !glowCtx || !sharpCtx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = "lighter";

    for (const p of ringParticles) {
      const angle =
        p.baseAngle + p.wiggleAAmp * Math.sin(frame * WIGGLE_TIME_FREQ + p.wiggleAPhase);
      const radius =
        p.baseRadius + p.wiggleRAmp * Math.sin(frame * WIGGLE_TIME_FREQ + p.wiggleRPhase);
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      const ripple =
        1 + 0.35 * Math.sin(angle * RIPPLE_LOBES - frame * RIPPLE_TIME_FREQ);
      const shimmer =
        0.85 + 0.15 * Math.sin(frame * SHIMMER_TIME_FREQ + p.shimmerPhase);
      const alpha = Math.max(0, Math.min(1, p.brightnessBase * ripple * shimmer));

      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.fillStyle;
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const p of haloParticles) {
      const t = (((frame / HALO_DRIFT_PERIOD + p.phase) % 1) + 1) % 1;
      const angle = p.angle + p.wobbleAmp * Math.sin(frame * WIGGLE_TIME_FREQ + p.wobblePhase);
      const radius = haloStart + t * geometry.haloDriftDistance;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      const verticalT = Math.max(
        0,
        Math.min(1, (y - (centerY - haloMaxRadius)) / (haloMaxRadius * 2)),
      );
      const alpha = Math.max(0, Math.min(1, Math.sin(Math.PI * t) * 0.55));

      ctx.globalAlpha = alpha;
      ctx.fillStyle = gradientColorAt(verticalT);
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    glowCtx.clearRect(0, 0, width, height);
    glowCtx.drawImage(offscreen, 0, 0);
    sharpCtx.clearRect(0, 0, width, height);
    sharpCtx.drawImage(offscreen, 0, 0);
  }, [
    frame,
    offscreen,
    ringParticles,
    haloParticles,
    width,
    height,
    centerX,
    centerY,
    haloStart,
    haloMaxRadius,
    geometry.haloDriftDistance,
  ]);

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      <canvas
        ref={glowRef}
        width={width}
        height={height}
        style={{
          position: "absolute",
          inset: 0,
          filter: `blur(${geometry.blurPx}px)`,
          opacity: 0.85,
          mixBlendMode: "screen",
        }}
      />
      <canvas
        ref={sharpRef}
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, mixBlendMode: "screen" }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 45%, ${VIGNETTE_COLOR} 100%)`,
        }}
      />
    </AbsoluteFill>
  );
};

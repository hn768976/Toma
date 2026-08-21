import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import {
  BACKGROUND_COLOR,
  HALO_DRIFT_DISTANCE,
  HALO_DRIFT_PERIOD,
  HALO_PARTICLE_COUNT,
  HEIGHT,
  RIPPLE_PERIOD,
  RING_PARTICLE_COUNT,
  SHIMMER_PERIOD,
  VIGNETTE_COLOR,
  WIDTH,
  WIGGLE_PERIOD,
} from "./constants";
import {
  HALO_START_RADIUS,
  generateHaloParticles,
  generateRingParticles,
} from "./particles";
import { gradientColorAt } from "./color";

export const particleRingHaloSchema = z.object({
  backgroundColor: z.string(),
  ringParticleCount: z.number().int().positive(),
  haloParticleCount: z.number().int().positive(),
});

export type ParticleRingHaloProps = z.infer<typeof particleRingHaloSchema>;

export const particleRingHaloDefaults: ParticleRingHaloProps = {
  backgroundColor: BACKGROUND_COLOR,
  ringParticleCount: RING_PARTICLE_COUNT,
  haloParticleCount: HALO_PARTICLE_COUNT,
};

const RIPPLE_LOBES = 3;
const RIPPLE_TIME_FREQ = (Math.PI * 2) / RIPPLE_PERIOD;
const SHIMMER_TIME_FREQ = (Math.PI * 2) / SHIMMER_PERIOD;
const WIGGLE_TIME_FREQ = (Math.PI * 2) / WIGGLE_PERIOD;
const CENTER_X = WIDTH / 2;
const CENTER_Y = HEIGHT / 2;
const HALO_MAX_RADIUS = HALO_START_RADIUS + HALO_DRIFT_DISTANCE;

const createCanvas = () => {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
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
  ringParticleCount,
  haloParticleCount,
}) => {
  const frame = useCurrentFrame();

  const ringParticles = useMemo(
    () => generateRingParticles(ringParticleCount),
    [ringParticleCount],
  );
  const haloParticles = useMemo(
    () => generateHaloParticles(haloParticleCount),
    [haloParticleCount],
  );

  const offscreen = useMemo(createCanvas, []);
  const glowRef = useRef<HTMLCanvasElement>(null);
  const sharpRef = useRef<HTMLCanvasElement>(null);

  useLayoutEffect(() => {
    if (!offscreen) return;
    const ctx = offscreen.getContext("2d");
    const glowCtx = glowRef.current?.getContext("2d");
    const sharpCtx = sharpRef.current?.getContext("2d");
    if (!ctx || !glowCtx || !sharpCtx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.globalCompositeOperation = "lighter";

    for (const p of ringParticles) {
      const angle =
        p.baseAngle + p.wiggleAAmp * Math.sin(frame * WIGGLE_TIME_FREQ + p.wiggleAPhase);
      const radius =
        p.baseRadius + p.wiggleRAmp * Math.sin(frame * WIGGLE_TIME_FREQ + p.wiggleRPhase);
      const x = CENTER_X + radius * Math.cos(angle);
      const y = CENTER_Y + radius * Math.sin(angle);

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
      const radius = HALO_START_RADIUS + t * HALO_DRIFT_DISTANCE;
      const x = CENTER_X + radius * Math.cos(angle);
      const y = CENTER_Y + radius * Math.sin(angle);

      const verticalT = Math.max(
        0,
        Math.min(1, (y - (CENTER_Y - HALO_MAX_RADIUS)) / (HALO_MAX_RADIUS * 2)),
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

    glowCtx.clearRect(0, 0, WIDTH, HEIGHT);
    glowCtx.drawImage(offscreen, 0, 0);
    sharpCtx.clearRect(0, 0, WIDTH, HEIGHT);
    sharpCtx.drawImage(offscreen, 0, 0);
  }, [frame, offscreen, ringParticles, haloParticles]);

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      <canvas
        ref={glowRef}
        width={WIDTH}
        height={HEIGHT}
        style={{
          position: "absolute",
          inset: 0,
          filter: "blur(19px)",
          opacity: 0.85,
          mixBlendMode: "screen",
        }}
      />
      <canvas
        ref={sharpRef}
        width={WIDTH}
        height={HEIGHT}
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

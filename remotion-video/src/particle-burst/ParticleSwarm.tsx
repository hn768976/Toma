import React, { useLayoutEffect, useMemo, useRef } from "react";
import { random, useCurrentFrame } from "remotion";
import {
  CENTER_X,
  CENTER_Y,
  GRAIN_ALPHA,
  GRAIN_TILE,
  HEIGHT,
  POSITION_GRID,
  VARIANTS,
  WIDTH,
} from "./config";
import {
  alphaAt,
  angleAt,
  motionBlurPasses,
  radiusAt,
  sampleCurve,
  travelAt,
  travelSpanOf,
} from "./motion";
import { buildParticles } from "./particles";
import {
  buildGlowSprites,
  buildGrainTiles,
  glowScaleFor,
} from "./textures";
import { rgbOf, solid, type Variant } from "./theme";

const LAYER_STYLE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
};

// Below this a particle contributes nothing but draw calls.
const ALPHA_CUTOFF = 0.004;

const snap = (v: number) => Math.round(v / POSITION_GRID) * POSITION_GRID;

/**
 * The swarm: ~2200 grains on a ring, drawn as small squares to match the LED
 * panel, snapped to a coarse grid so they fall into faint rows and columns.
 *
 * Everything is a pure function of `useCurrentFrame()`. Particles are drawn
 * additively into this transparent layer, which then composites normally over
 * the panel — so a lone cyan grain stays cyan and only genuinely dense
 * clusters blow out toward white.
 */
export const ParticleSwarm: React.FC<{ variant: Variant }> = ({ variant }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frame = useCurrentFrame();
  const cfg = VARIANTS[variant];

  const particles = useMemo(() => buildParticles(cfg), [cfg]);
  const sprites = useMemo(() => buildGlowSprites(variant), [variant]);
  const grainTiles = useMemo(() => buildGrainTiles(variant), [variant]);
  const colors = useMemo(() => {
    const table: Record<string, string> = {};
    for (let i = 0; i < particles.length; i++) {
      const key = particles[i].colorKey;
      if (!table[key]) table[key] = solid(rgbOf(variant, key));
    }
    return table;
  }, [particles, variant]);

  useLayoutEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.globalCompositeOperation = "lighter";

    const passes = motionBlurPasses(cfg, frame);
    const spanFrames = cfg.motionBlur.spanFrames;
    const swarmBrightness = sampleCurve(cfg.brightnessCurve, frame);

    // Weights taper across the trail; normalising by their sum keeps a blurred
    // particle the same total brightness as an unblurred one.
    let weightSum = 0;
    for (let k = 0; k < passes; k++) weightSum += 1 - k / passes;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      const radius = radiusAt(cfg, p, frame);
      const alpha = alphaAt(cfg, p, frame, radius) * swarmBrightness;
      if (alpha <= ALPHA_CUTOFF) continue;

      const span = travelSpanOf(cfg, p);
      const travelFrac = span > 0 ? travelAt(cfg, p, frame) / span : 0;
      const angle = angleAt(cfg, p, frame, travelFrac);
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const sprite = sprites[p.colorKey];
      const glowSize = p.size * glowScaleFor(p.colorKey);
      const fill = colors[p.colorKey];
      const half = p.size / 2;

      // Multi-draw along the radial vector. radiusAt() already carries
      // radialDirection, so the trail lags behind an outbound particle and
      // ahead of an inbound one without a single sign flip here.
      for (let k = 0; k < passes; k++) {
        const sampleRadius =
          k === 0
            ? radius
            : radiusAt(cfg, p, frame - (k / passes) * spanFrames);
        const x = snap(CENTER_X + sampleRadius * cos);
        const y = snap(CENTER_Y + sampleRadius * sin);
        const passAlpha = (alpha * (1 - k / passes)) / weightSum;

        if (sprite) {
          ctx.globalAlpha = Math.min(1, passAlpha);
          ctx.drawImage(
            sprite,
            x - glowSize / 2,
            y - glowSize / 2,
            glowSize,
            glowSize,
          );
        }
        ctx.globalAlpha = Math.min(1, passAlpha);
        ctx.fillStyle = fill;
        ctx.fillRect(x - half, y - half, p.size, p.size);
      }
    }

    // Fine grain over the whole frame. The tile cycles and shifts by frame, so
    // the grain moves while staying a pure function of the frame number.
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = GRAIN_ALPHA;
    const tile = grainTiles[frame % grainTiles.length];
    if (tile) {
      const offsetX = Math.floor(random(`grain-x-${frame}`) * GRAIN_TILE);
      const offsetY = Math.floor(random(`grain-y-${frame}`) * GRAIN_TILE);
      for (let y = -offsetY; y < HEIGHT; y += GRAIN_TILE) {
        for (let x = -offsetX; x < WIDTH; x += GRAIN_TILE) {
          ctx.drawImage(tile, x, y);
        }
      }
    }
    ctx.globalAlpha = 1;
  });

  return (
    <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={LAYER_STYLE} />
  );
};

import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import { z } from "zod";
import {
  DOF_BLUR_PX,
  DOF_DOWNSCALE,
  DRIFT_RADIUS_PX,
  DURATION_IN_FRAMES,
  EDGE_BLOOM_TIGHT_ALPHA,
  EDGE_BLOOM_TIGHT_BLUR_PX,
  EDGE_BLOOM_WIDE_ALPHA,
  EDGE_BLOOM_WIDE_BLUR_PX,
  HEIGHT,
  PARTICLE_BLOOM_ALPHA,
  PARTICLE_BLOOM_BLUR_PX,
  TAU,
  WIDTH,
  type DepthBucket,
} from "./constants";
import { buildField, buildGrainTiles } from "./field";
import { compositeLayer, createBuffers, prepareBuffers } from "./buffers";
import { drawGrain, drawVignette } from "./finish";
import { BackgroundWash } from "./BackgroundWash";
import { MeshLayer } from "./MeshLayer";
import { WaveBand } from "./WaveBand";
import { ParticleLayer } from "./ParticleLayer";
import { LeadingEdge } from "./LeadingEdge";
import { VARIANTS } from "./variants";

export const waveFieldSchema = z.object({
  variant: z.enum(["blue", "violet", "mono"]),
});

export type WaveFieldProps = z.infer<typeof waveFieldSchema>;

const DEPTH_ORDER: DepthBucket[] = ["far", "mid", "near"];

/**
 * A 4K particle wave field. Every visible quantity is a pure function of the
 * frame number, so a render is deterministic and frame 450 is pixel-identical
 * to frame 0.
 */
export const WaveField: React.FC<WaveFieldProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const cfg = VARIANTS[variant];

  const loopFrame =
    ((frame % DURATION_IN_FRAMES) + DURATION_IN_FRAMES) % DURATION_IN_FRAMES;
  const t = loopFrame / DURATION_IN_FRAMES;

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The field is generated once. Per frame only its wave offset and drift are
  // recomputed; regenerating it would make the field boil.
  const field = useMemo(() => buildField(cfg, variant), [cfg, variant]);
  const grainTiles = useMemo(() => buildGrainTiles(variant), [variant]);
  const buffers = useMemo(() => createBuffers(), []);

  // A closed path, so the drift returns exactly to its start at frame 450.
  const driftX = DRIFT_RADIUS_PX * Math.sin(TAU * t);
  const driftY = DRIFT_RADIUS_PX * 0.78 * Math.sin(TAU * 2 * t + 0.4);

  // Runs before the layer components below draw into these buffers.
  prepareBuffers(buffers, driftX, driftY);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    ctx.drawImage(buffers.background.canvas, 0, 0);
    // The mesh sits behind everything and never blooms.
    ctx.drawImage(buffers.mesh.canvas, 0, 0);

    for (const bucket of DEPTH_ORDER) {
      const source = buffers.depth[bucket].canvas;
      compositeLayer(ctx, source, buffers, {
        blurPx: DOF_BLUR_PX[bucket],
        divisor: DOF_DOWNSCALE[bucket],
        alpha: 1,
        additive: false,
      });
      // Moderate bloom on the brightest particles.
      compositeLayer(ctx, source, buffers, {
        blurPx: DOF_BLUR_PX[bucket] + PARTICLE_BLOOM_BLUR_PX,
        divisor: 4,
        alpha: PARTICLE_BLOOM_ALPHA[bucket],
        additive: true,
      });
    }

    // Generous bloom on the leading edge: a wide halo, a tight core, then the
    // dots themselves, which keeps them the brightest thing in the frame.
    const edge = buffers.edge.canvas;
    compositeLayer(ctx, edge, buffers, {
      blurPx: EDGE_BLOOM_WIDE_BLUR_PX,
      divisor: 8,
      alpha: EDGE_BLOOM_WIDE_ALPHA,
      additive: true,
    });
    compositeLayer(ctx, edge, buffers, {
      blurPx: EDGE_BLOOM_TIGHT_BLUR_PX,
      divisor: 4,
      alpha: EDGE_BLOOM_TIGHT_ALPHA,
      additive: true,
    });
    compositeLayer(ctx, edge, buffers, {
      blurPx: 0,
      divisor: 1,
      alpha: 1,
      additive: true,
    });

    drawVignette(ctx);
    drawGrain(ctx, grainTiles, loopFrame);
  });

  const depthTargets: Record<DepthBucket, CanvasRenderingContext2D> = {
    far: buffers.depth.far.ctx,
    mid: buffers.depth.mid.ctx,
    near: buffers.depth.near.ctx,
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ width: "100%", height: "100%", display: "block" }}
      />
      <BackgroundWash ctx={buffers.background.ctx} cfg={cfg} />
      <MeshLayer ctx={buffers.mesh.ctx} cfg={cfg} mesh={field.mesh} t={t} />
      {field.bands.map((band) => (
        <WaveBand
          key={`band-${band.index}`}
          ctx={buffers.depth[band.bucket].ctx}
          cfg={cfg}
          band={band}
          t={t}
        />
      ))}
      <ParticleLayer
        targets={depthTargets}
        cfg={cfg}
        bands={field.bands}
        batches={field.batches}
        t={t}
        loopFrame={loopFrame}
      />
      {field.bands.map((band) => (
        <LeadingEdge
          key={`edge-${band.index}`}
          ctx={buffers.edge.ctx}
          cfg={cfg}
          band={band}
          edge={field.edges[band.index]}
          t={t}
        />
      ))}
    </>
  );
};

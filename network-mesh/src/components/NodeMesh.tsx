import React, { useLayoutEffect, useMemo, useRef } from "react";
import { createBuffer } from "../lib/canvas";
import { mix } from "../lib/color";
import type { MeshFrame, MeshNodeSpec } from "../mesh/geometry";
import type { Palette } from "../variants";

export type LightBoost = (x: number, y: number) => number;

export interface NodeMeshProps {
  width: number;
  height: number;
  nodes: MeshNodeSpec[];
  mesh: MeshFrame;
  palette: Palette;
  /** Extra brightness contributed by the variant's light element, 0..1. */
  lightBoost?: LightBoost;
}

// Depth-of-field. Elements are bucketed into three offscreen buffers by depth
// and each buffer is blurred exactly once on composite — per-element blurring
// is unusably slow at 4K. The mid bucket is the focal band; near and far
// soften away from it.
const FAR_MAX = 0.45;
const NEAR_MIN = 0.72;
const BLUR_FAR = 12;
const BLUR_MID = 1.6;
const BLUR_NEAR = 20;

// Near and far are never seen sharp, so they are rendered at half resolution
// and upscaled — the blur hides it and it roughly quarters their fill cost.
const FAR_SCALE = 0.5;
const MID_SCALE = 1;
const NEAR_SCALE = 0.5;
const BLOOM_SCALE = 0.25;

const bucketOf = (z: number) => (z < FAR_MAX ? 0 : z < NEAR_MIN ? 1 : 2);

/**
 * The drifting node field: dots, and the edges that form and break between
 * them as they move. Draws through three depth buffers for DOF and adds an
 * additive bloom pass over the brightest nodes.
 */
export const NodeMesh: React.FC<NodeMeshProps> = ({
  width,
  height,
  nodes,
  mesh,
  palette,
  lightBoost,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bloomCanvasRef = useRef<HTMLCanvasElement>(null);

  const buffers = useMemo(
    () => ({
      far: createBuffer(width * FAR_SCALE, height * FAR_SCALE),
      mid: createBuffer(width * MID_SCALE, height * MID_SCALE),
      near: createBuffer(width * NEAR_SCALE, height * NEAR_SCALE),
      bloom: createBuffer(width * BLOOM_SCALE, height * BLOOM_SCALE),
    }),
    [width, height],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    const bloomCanvas = bloomCanvasRef.current;
    const { far, mid, near, bloom } = buffers;
    if (!canvas || !bloomCanvas || !far || !mid || !near || !bloom) return;

    const main = canvas.getContext("2d");
    const bloomOut = bloomCanvas.getContext("2d");
    const layers = [far, mid, near].map((buf, i) => {
      const ctx = buf.getContext("2d");
      if (!ctx) return null;
      const scale = [FAR_SCALE, MID_SCALE, NEAR_SCALE][i];
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, buf.width, buf.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.lineCap = "round";
      return ctx;
    });
    const bloomCtx = bloom.getContext("2d");
    if (!main || !bloomOut || !bloomCtx || layers.some((l) => l === null)) return;
    bloomCtx.setTransform(1, 0, 0, 1, 0, 0);
    bloomCtx.clearRect(0, 0, bloom.width, bloom.height);
    bloomCtx.setTransform(BLOOM_SCALE, 0, 0, BLOOM_SCALE, 0, 0);
    bloomCtx.globalCompositeOperation = "lighter";

    const { x, y, bright, edges } = mesh;

    // Brightness including whatever the variant's light element contributes.
    const litness = new Float64Array(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      const boost = lightBoost ? lightBoost(x[i], y[i]) : 0;
      litness[i] = bright[i] * (1 + boost * 1.5);
    }

    // ---- edges, behind the dots -------------------------------------------
    for (let e = 0; e < edges.length; e++) {
      const edge = edges[e];
      const ctx = layers[bucketOf(edge.z)]!;
      const lit = (litness[edge.a] + litness[edge.b]) * 0.5;
      const c = mix(palette.edgeDim, palette.edgeMain, edge.strength);
      const alpha = Math.min(
        1,
        edge.strength * 0.95 * (1 - 0.25 * edge.z) * lit,
      );
      if (alpha < 0.004) continue;
      ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
      ctx.lineWidth = 1.4 + edge.z * 3.4;
      ctx.beginPath();
      ctx.moveTo(x[edge.a], y[edge.a]);
      ctx.lineTo(x[edge.b], y[edge.b]);
      ctx.stroke();
    }

    // ---- node dots ---------------------------------------------------------
    for (let i = 0; i < nodes.length; i++) {
      const z = nodes[i].z;
      const ctx = layers[bucketOf(z)]!;
      const lit = litness[i];
      const c = mix(
        palette.nodePale,
        palette.nodeBright,
        Math.min(1, Math.max(0, (lit - 0.95) * 0.85)),
      );
      // Near nodes are larger and dimmer, distant ones small and sharp.
      const alpha = Math.min(1, (1 - 0.35 * z) * 0.88 * lit);
      const radius = (2.4 + z * 6.6) * (0.85 + 0.3 * Math.min(2.2, lit));
      ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(x[i], y[i], radius, 0, Math.PI * 2);
      ctx.fill();

      // Only genuinely bright nodes feed the bloom pass.
      if (lit > 1.18) {
        const strength = Math.min(1, (lit - 1.18) * 0.75);
        bloomCtx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${strength * 0.55})`;
        bloomCtx.beginPath();
        bloomCtx.arc(x[i], y[i], radius * (2.6 + strength * 5.5), 0, Math.PI * 2);
        bloomCtx.fill();
      }
    }

    // ---- composite ---------------------------------------------------------
    main.setTransform(1, 0, 0, 1, 0, 0);
    main.clearRect(0, 0, width, height);
    main.filter = `blur(${BLUR_FAR}px)`;
    main.drawImage(far, 0, 0, width, height);
    main.filter = `blur(${BLUR_MID}px)`;
    main.drawImage(mid, 0, 0, width, height);
    main.filter = `blur(${BLUR_NEAR}px)`;
    main.drawImage(near, 0, 0, width, height);
    main.filter = "none";

    bloomOut.setTransform(1, 0, 0, 1, 0, 0);
    bloomOut.clearRect(0, 0, width, height);
    bloomOut.filter = "blur(34px)";
    bloomOut.drawImage(bloom, 0, 0, width, height);
    bloomOut.filter = "none";
  });

  return (
    <>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
      <canvas
        ref={bloomCanvasRef}
        width={width}
        height={height}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          mixBlendMode: "screen",
        }}
      />
    </>
  );
};

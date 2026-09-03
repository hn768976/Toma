import React, { useLayoutEffect, useMemo, useRef } from "react";
import { createBuffer } from "../lib/canvas";
import { mix } from "../lib/color";
import type { MeshFrame } from "../mesh/geometry";
import type { Palette } from "../variants";

export interface FacetLayerProps {
  width: number;
  height: number;
  mesh: MeshFrame;
  palette: Palette;
  /** Peak alpha of a single facet. Must stay tiny. */
  opacity: number;
}

// Facets are drawn at quarter resolution and blurred on composite: they are
// large, soft and barely above the background, so there is nothing to gain
// from full-resolution triangle fills.
const SCALE = 0.25;

/**
 * Very low-alpha washes filling the triangles formed by three mutually
 * connected nodes. Kept faint on purpose — if they read as solid the mesh
 * becomes a low-poly surface instead of a network.
 */
export const FacetLayer: React.FC<FacetLayerProps> = ({
  width,
  height,
  mesh,
  palette,
  opacity,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const buffer = useMemo(
    () => createBuffer(width * SCALE, height * SCALE),
    [width, height],
  );

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !buffer) return;
    const out = canvas.getContext("2d");
    const ctx = buffer.getContext("2d");
    if (!out || !ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, buffer.width, buffer.height);
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);

    const base = palette.facet;
    if (base) {
      const { x, y, triangles } = mesh;
      for (let i = 0; i < triangles.length; i++) {
        const t = triangles[i];
        // Fill colour shifts slightly with the triangle's average depth:
        // far facets sink toward the background wash, near ones lift a little.
        const shade = mix(
          palette.backgroundWash,
          base,
          0.25 + t.z * 0.75,
        );
        ctx.fillStyle = `rgba(${shade.r}, ${shade.g}, ${shade.b}, ${
          opacity * (0.55 + t.z * 0.45)
        })`;
        ctx.beginPath();
        ctx.moveTo(x[t.a], y[t.a]);
        ctx.lineTo(x[t.b], y[t.b]);
        ctx.lineTo(x[t.c], y[t.c]);
        ctx.closePath();
        ctx.fill();
      }
    }

    out.setTransform(1, 0, 0, 1, 0, 0);
    out.clearRect(0, 0, width, height);
    out.filter = "blur(9px)";
    out.drawImage(buffer, 0, 0, width, height);
    out.filter = "none";
  });

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
    />
  );
};

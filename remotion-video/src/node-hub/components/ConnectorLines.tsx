/**
 * Draws whatever paths the layout produced, plus the dots travelling along
 * them.
 *
 * This component is deliberately arrangement-blind: it receives polylines and
 * strokes them. In "radiating" mode those polylines are straight hub spokes
 * and node-to-node cross-links; in "arcs" mode they are the sampled curved
 * rails and there are no spokes at all. Adding a third arrangement needs no
 * change here.
 *
 * Dot positions come from `resolveFrame` in layout.ts so that this layer and
 * the icon layer agree on where each dot is — that shared answer is what lets
 * a node brighten as a dot passes through it.
 */
import { useMemo } from "react";
import { withAlpha } from "../color";
import { LOOP_FRAMES, PERIODS } from "../constants";
import { makeBloom } from "../passes";
import { Layer } from "./Layer";
import type { Layout, ResolvedDot } from "../layout";
import type { Palette } from "../variants";

export type ConnectorLinesProps = {
  layout: Layout;
  dots: readonly ResolvedDot[];
  palette: Palette;
  frame: number;
  width: number;
  height: number;
};

export const ConnectorLines: React.FC<ConnectorLinesProps> = ({
  layout,
  dots,
  palette,
  frame,
  width,
  height,
}) => {
  const bloom = useMemo(() => makeBloom(width, height, 5), [width, height]);

  const draw = (ctx: CanvasRenderingContext2D) => {
    if (layout.paths.length === 0) return;

    // A path's colour comes from whichever connector tones the variant
    // defines: straight connectors use the connector pair, curved rails use
    // the arc-line tone.
    const bright =
      palette.connectorBright ?? palette.arcLine ?? palette.nodeWhite;
    const dim = palette.connector ?? palette.arcLine ?? palette.nodeDim;

    ctx.lineCap = "round";
    layout.paths.forEach((path, index) => {
      // A slow shimmer so the web is not a flat static lattice. The period
      // divides the loop, so it closes with everything else.
      const phase = (index * 0.37) % 1;
      const shimmer =
        0.78 +
        0.22 *
          Math.sin(
            ((frame % LOOP_FRAMES) / PERIODS.shimmer + phase) * Math.PI * 2,
          );

      ctx.strokeStyle = withAlpha(
        path.tone === "bright" ? bright : dim,
        (path.tone === "bright" ? 0.72 : 0.42) * shimmer,
      );
      ctx.lineWidth = path.weight;
      ctx.beginPath();
      path.points.forEach((point, i) =>
        i === 0 ? ctx.moveTo(point.x, point.y) : ctx.lineTo(point.x, point.y),
      );
      ctx.stroke();
    });

    // Travelling dots, each with a small halo of its own.
    for (const dot of dots) {
      const halo = ctx.createRadialGradient(
        dot.x,
        dot.y,
        0,
        dot.x,
        dot.y,
        dot.size * 5,
      );
      halo.addColorStop(0, withAlpha(bright, 0.55 * dot.alpha));
      halo.addColorStop(1, withAlpha(bright, 0));
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.size * 5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = withAlpha(palette.nodeWhite, dot.alpha);
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  const drawWithBloom = (ctx: CanvasRenderingContext2D) => {
    draw(ctx);
    if (layout.paths.length === 0) return;
    // Connectors are structure rather than light: one narrow pass keeps the
    // dots reading bright without hazing the lines. Reading the layer back as
    // the bloom source is safe here — makeBloom samples it into its own
    // scratch canvas before compositing the result back.
    bloom(ctx, ctx.canvas, { radii: [22], alpha: 0.28 });
  };

  return <Layer draw={drawWithBloom} width={width} height={height} />;
};

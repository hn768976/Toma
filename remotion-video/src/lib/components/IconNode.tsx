/**
 * One satellite node: a line icon, optionally inside a thin circle, optionally
 * with a short connector stub, on its own bloomed canvas.
 *
 * Each node owns a small canvas sized to its own footprint rather than sharing
 * a full-frame layer, which is what lets a bright node bloom generously while
 * a dim one barely glows. The icon geometry is rasterised ONCE per
 * (icon, size, weight, colour) into a module-level sprite cache and blitted
 * afterwards; per-frame brightness is applied as an alpha on the blit, since
 * the sprite is single-colour line work.
 *
 * It is palette-agnostic and registry-agnostic: it takes two explicit colours
 * and a `drawIcon` callback, so any icon set can be rendered through it. It
 * also does not know how the node was positioned — a bead strung on an arc and
 * the endpoint of a radial spoke render through exactly the same path.
 *
 *   <IconNode
 *     node={layout.nodes[i]}
 *     drawIcon={getIcon(layout.nodes[i].icon)}
 *     colors={{stroke: "#FFFFFF", stub: "#6F8FB8"}}
 *     boost={frameState.boosts[i]}
 *   />
 */
import { useMemo } from "react";
import { withAlpha } from "../color/hex";
import { makeBloom, makeOffscreen } from "../canvas/passes";
import { Layer } from "../canvas/Layer";
import type { IconDraw } from "../canvas/pen";
import { STUB_FROM, STUB_TO, type LayoutNode } from "../layout/satelliteLayout";

/** Room around the artwork for the glow to fall off inside the node canvas. */
const PAD = 120;

const spriteCache = new Map<string, HTMLCanvasElement>();

/**
 * Rasterises an icon once and reuses it. The cache is keyed on everything that
 * changes the pixels, so two nodes at the same size share one bitmap while a
 * different size still gets crisp strokes rather than an upscale.
 */
const getSprite = (
  cacheKey: string,
  draw: IconDraw,
  size: number,
  lineWidth: number,
  color: string,
): HTMLCanvasElement => {
  const key = `${cacheKey}/${size}/${lineWidth}/${color}`;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const { canvas, ctx } = makeOffscreen(size, size);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  draw(ctx, size);
  spriteCache.set(key, canvas);
  return canvas;
};

export type IconNodeColors = {
  /** The icon strokes and the circle around them. */
  stroke: string;
  /** The short connector stub on a bare (un-circled) icon. */
  stub: string;
};

export type IconNodeProps = {
  node: LayoutNode;
  /** How to draw this node's icon into a normalised size x size box. */
  drawIcon: IconDraw;
  colors: IconNodeColors;
  /** Extra brightness from a travelling dot passing this node, 0..1. */
  boost?: number;
};

export const IconNode: React.FC<IconNodeProps> = ({
  node,
  drawIcon,
  colors,
  boost = 0,
}) => {
  const reach = (node.ring > 0 ? node.ring : node.iconSize / 2) + PAD;
  const box = Math.ceil(reach * 2);

  // Thin strokes at every scale: the weight tracks icon size rather than being
  // fixed, so a large bare icon does not read as heavier line work than a
  // small circled one.
  const lineWidth = useMemo(
    () => Math.max(2.6, Math.round(node.iconSize * 0.032 * 10) / 10),
    [node.iconSize],
  );

  const sprite = useMemo(
    () => getSprite(node.icon, drawIcon, node.iconSize, lineWidth, colors.stroke),
    [node.icon, drawIcon, node.iconSize, lineWidth, colors.stroke],
  );

  const bloom = useMemo(() => makeBloom(box, box, 2), [box]);
  const work = useMemo(() => makeOffscreen(box, box), [box]);

  const draw = (ctx: CanvasRenderingContext2D) => {
    const { ctx: wctx } = work;
    wctx.setTransform(1, 0, 0, 1, 0, 0);
    wctx.clearRect(0, 0, box, box);

    const alpha = Math.min(1, node.bright * 0.82 + 0.18 + boost * 0.5);

    // The stub: a short line off a bare icon, standing in for the circle.
    if (node.ring === 0 && node.stub !== null) {
      const from = node.iconSize * STUB_FROM;
      const to = node.iconSize * STUB_TO;
      wctx.strokeStyle = withAlpha(colors.stub, alpha * 0.85);
      wctx.lineWidth = lineWidth * 0.8;
      wctx.lineCap = "round";
      wctx.beginPath();
      wctx.moveTo(reach + Math.cos(node.stub) * from, reach + Math.sin(node.stub) * from);
      wctx.lineTo(reach + Math.cos(node.stub) * to, reach + Math.sin(node.stub) * to);
      wctx.stroke();
    }

    if (node.ring > 0) {
      wctx.strokeStyle = withAlpha(colors.stroke, alpha * 0.95);
      wctx.lineWidth = Math.max(2.4, node.ring * 0.048);
      wctx.beginPath();
      wctx.arc(reach, reach, node.ring, 0, Math.PI * 2);
      wctx.stroke();
    }

    wctx.globalAlpha = alpha;
    wctx.drawImage(
      sprite,
      reach - node.iconSize / 2,
      reach - node.iconSize / 2,
    );
    wctx.globalAlpha = 1;

    ctx.drawImage(work.canvas, 0, 0);
    // Brighter nodes bloom harder; a dot passing through lifts it further.
    bloom(ctx, work.canvas, {
      radii: [34, 12],
      alpha: 0.2 + node.bright * 0.3 + boost * 0.35,
    });
  };

  return (
    <Layer
      draw={draw}
      width={box}
      height={box}
      left={Math.round(node.x - reach)}
      top={Math.round(node.y - reach)}
    />
  );
};

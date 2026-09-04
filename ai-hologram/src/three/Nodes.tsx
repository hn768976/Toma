import { useMemo } from "react";
import { cellUv } from "../lib/atlas";
import { hexToRgb } from "../lib/color";
import { NODES, ORBIT } from "./layout";
import { allocSprites, InstancedSprites, SpriteWriter } from "./InstancedSprites";
import type { Palette } from "../palettes";

/**
 * The icon nodes riding the orbit path.
 *
 * Each node is four instances — glow, disc, ring, glyph — and every node in the
 * scene lives in one instanced draw call. The glyphs are original line art
 * baked into the sprite atlas; nothing here comes from an icon library, because
 * a stock clip can't carry an attribution requirement.
 */
const PER_NODE = 4;

export const Nodes: React.FC<{
  palette: Palette;
  /** Radians added to every node's base angle. */
  orbitPhase: number;
  /** 0..1 per node, from the staggered entrance. */
  reveals: readonly number[];
  bobs: readonly number[];
}> = ({ palette, orbitPhase, reveals, bobs }) => {
  const capacity = NODES.length * PER_NODE;
  const buffers = useMemo(() => allocSprites(capacity), [capacity]);

  const node = hexToRgb(palette.node);
  const core = hexToRgb(palette.core);
  const glowUv = cellUv("glow");
  const discUv = cellUv("disc");
  const ringUv = cellUv("ring");

  const writer = new SpriteWriter(buffers);
  NODES.forEach((spec, i) => {
    const reveal = reveals[i];
    if (reveal <= 0.001) return;
    const a = spec.angle + orbitPhase;
    const x = Math.cos(a) * ORBIT.radius * ORBIT.stretchX;
    const z = Math.sin(a) * ORBIT.radius;
    const y = ORBIT.y + bobs[i];

    // A small overshoot on the way in, so the node lands rather than appears.
    const pop = reveal < 1 ? 1.12 - 0.12 * reveal : 1;
    const s = spec.size * (0.25 + 0.75 * reveal) * pop;
    const alpha = reveal;

    writer.push(x, y, z, s * 3.1, glowUv, [node.r, node.g, node.b], alpha * 0.5);
    writer.push(x, y, z, s * 1.0, discUv, [node.r * 0.42, node.g * 0.46, node.b * 0.6], alpha * 0.75);
    writer.push(x, y, z, s * 1.0, ringUv, [node.r, node.g, node.b], alpha * 1.5);
    writer.push(x, y, z, s * 0.5, cellUv(spec.glyph), [core.r, core.g, core.b], alpha * 1.25);
  });
  writer.done();

  return <InstancedSprites buffers={buffers} capacity={capacity} renderOrder={30} />;
};

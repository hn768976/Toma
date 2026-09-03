/**
 * One satellite, bound to this project's palette and icon registry.
 *
 * The rendering — the sprite cache, the ring, the stub and the per-node bloom
 * — lives in the vendored library and takes explicit colours. This adapter is
 * what maps a variant Palette onto them, so the palette stays confined to
 * variants.ts and the component below stays reusable.
 */
import { useMemo } from "react";
import { IconNode as LibIconNode } from "../../lib/components/IconNode";
import { getIcon } from "../icons";
import type { LayoutNode } from "../layout";
import type { Palette } from "../variants";

export type IconNodeProps = {
  node: LayoutNode;
  palette: Palette;
  /** Extra brightness from a travelling dot passing this node, 0..1. */
  boost: number;
};

export const IconNode: React.FC<IconNodeProps> = ({ node, palette, boost }) => {
  const colors = useMemo(
    () => ({ stroke: palette.nodeWhite, stub: palette.nodeDim }),
    [palette.nodeWhite, palette.nodeDim],
  );

  return (
    <LibIconNode
      node={node}
      drawIcon={getIcon(node.icon)}
      colors={colors}
      boost={boost}
    />
  );
};

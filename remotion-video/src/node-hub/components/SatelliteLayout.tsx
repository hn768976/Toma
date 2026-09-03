/**
 * Places N satellites around the hub in whichever arrangement the variant
 * asks for, and renders the result.
 *
 * The layout MODE is the only input that changes the topology: "radiating"
 * gives a cross-linked burst of spokes, "arcs" gives beads strung along
 * intersecting curved rails. Both come back as the same {nodes, paths} shape,
 * so this component — and everything below it — renders either without a
 * branch. Setting `count` to 0 removes satellites and their connectors
 * entirely.
 *
 * Positions are memoised on the static inputs; only the per-frame dot
 * positions and node brightness boosts are recomputed, and both are pure
 * functions of the frame number.
 */
import { useMemo } from "react";
import { buildLayout, resolveFrame, type Layout } from "../layout";
import { ConnectorLines } from "./ConnectorLines";
import { IconNode } from "./IconNode";
import type { Rect } from "../geometry";
import type { IconName } from "../icons";
import type { LayoutMode, Palette } from "../variants";

export type SatelliteLayoutProps = {
  mode: LayoutMode;
  count: number;
  icons: readonly IconName[];
  palette: Palette;
  frame: number;
  centreX: number;
  centreY: number;
  hubRadius: number;
  width: number;
  height: number;
  seed: string;
  /** Rectangles satellites must keep clear of — the side chrome. */
  exclusions: readonly Rect[];
};

/** Builds the layout without rendering it, for callers that want the data. */
export const useSatelliteLayout = ({
  mode,
  count,
  icons,
  centreX,
  centreY,
  hubRadius,
  width,
  height,
  seed,
  exclusions,
}: Omit<SatelliteLayoutProps, "palette" | "frame">): Layout =>
  useMemo(
    () =>
      buildLayout({
        mode,
        count,
        icons,
        hub: { x: centreX, y: centreY },
        hubRadius,
        width,
        height,
        seed,
        exclusions,
      }),
    [
      mode,
      count,
      icons,
      centreX,
      centreY,
      hubRadius,
      width,
      height,
      seed,
      exclusions,
    ],
  );

export const SatelliteLayout: React.FC<SatelliteLayoutProps> = (props) => {
  const { palette, frame, width, height } = props;
  const layout = useSatelliteLayout(props);
  const { dots, boosts } = useMemo(
    () => resolveFrame(layout, frame),
    [layout, frame],
  );

  if (layout.nodes.length === 0 && layout.paths.length === 0) return null;

  return (
    <>
      <ConnectorLines
        layout={layout}
        dots={dots}
        palette={palette}
        frame={frame}
        width={width}
        height={height}
      />
      {layout.nodes.map((node, index) => (
        <IconNode
          key={node.id}
          node={node}
          palette={palette}
          boost={boosts[index] ?? 0}
        />
      ))}
    </>
  );
};

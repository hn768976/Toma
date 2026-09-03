import React from "react";
import {CONFIG} from "../config";
import {withAlpha} from "../lib/color";
import type {Node} from "../scene/geometry";
import type {Theme} from "../theme";

/**
 * A single white point with a soft halo, sitting on a line intersection or
 * endpoint. Major nodes are noticeably larger and brighter and carry a thin
 * ring; every node pulses on its own seeded period, and a few flash brighter
 * for a handful of frames.
 *
 * Rendered as SVG rather than into the canvas layers: there are only a couple
 * of dozen of them, and vector circles keep the halo gradients crisp under the
 * push-in without costing a redraw.
 */
export const NodeMarker: React.FC<{
  node: Node;
  index: number;
  theme: Theme;
  frame: number;
  /** Halo-only pass, used to build the node bloom layer. */
  coreOnly?: boolean;
}> = ({node, index, theme, frame, coreOnly = false}) => {
  const {flashFrames, flashCycle, haloScale} = CONFIG.nodes;

  const pulse = 0.74 + 0.26 * Math.sin((frame / node.period) * Math.PI * 2 + node.phase);
  const flashing = (frame + index * 97) % flashCycle < flashFrames;
  const boost = flashing ? 1.75 : 1;

  const r = node.radius * (0.9 + 0.1 * pulse) * (flashing ? 1.22 : 1);
  const haloR = r * haloScale;
  const gradId = `node-halo-${index}${coreOnly ? "-b" : ""}`;

  return (
    <g>
      {!coreOnly ? (
        <>
          <defs>
            <radialGradient id={gradId}>
              <stop offset="0%" stopColor={withAlpha(theme.nodeHalo, 0.5 * pulse * boost)} />
              <stop offset="45%" stopColor={withAlpha(theme.nodeHalo, 0.16 * pulse * boost)} />
              <stop offset="100%" stopColor={withAlpha(theme.nodeHalo, 0)} />
            </radialGradient>
          </defs>
          <circle cx={node.x} cy={node.y} r={haloR} fill={`url(#${gradId})`} />
          {node.major ? (
            <circle
              cx={node.x}
              cy={node.y}
              r={r * 2.6}
              fill="none"
              stroke={withAlpha(theme.nodeHalo, 0.42 * pulse)}
              strokeWidth={2}
            />
          ) : null}
        </>
      ) : null}
      <circle
        cx={node.x}
        cy={node.y}
        r={r}
        fill={withAlpha(theme.nodeWhite, Math.min(1, (node.major ? 0.98 : 0.8) * pulse * boost))}
      />
    </g>
  );
};

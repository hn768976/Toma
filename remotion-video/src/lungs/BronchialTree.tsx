import React from "react";
import { LungTree } from "./tree";
import { Palette } from "./variants";

/**
 * The recursive airway tree, drawn dark against the lung fill. Geometry comes
 * in pre-generated; nothing here depends on the frame, so the tree holds still
 * while the lobe it lives in breathes.
 */
export const BronchialTree: React.FC<{ tree: LungTree; palette: Palette }> = ({
  tree,
  palette,
}) => (
  <g fill="none" stroke={palette.treeDark} strokeLinecap="round">
    {tree.branches.map((b, i) => (
      <path key={`b-${i}`} d={b.d} strokeWidth={b.width} />
    ))}
    {/* Rounded caps on the finest branches. */}
    {tree.branches
      .filter((b) => b.terminal)
      .map((b, i) => (
        <circle
          key={`t-${i}`}
          cx={b.end.x}
          cy={b.end.y}
          r={b.width / 2}
          fill={palette.treeDark}
          stroke="none"
        />
      ))}
    {/* Thickened junctions: constriction points in narrowed airways. */}
    {tree.nodes.map((n, i) => (
      <circle
        key={`n-${i}`}
        cx={n.x}
        cy={n.y}
        r={n.r}
        fill={palette.treeDark}
        stroke="none"
      />
    ))}
  </g>
);

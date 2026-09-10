import React from "react";
import { useCurrentFrame } from "remotion";
import { COLORS, type Accent } from "../theme";
import { alpha, mix } from "../color";
import { panelAlert } from "../alert";

/**
 * The shared chrome for every background panel: a thin border, a tinted
 * fill and four corner bracket marks. Panels sit on the frame's 24x16
 * grid, so placement comes in as grid coordinates.
 */
export const Panel: React.FC<{
  /** Seed key — drives this panel's flash phase during the alert. */
  id: string;
  accent: Accent;
  col: [number, number];
  row: [number, number];
  /** Column headers get the brighter filled treatment. */
  emphasis?: boolean;
  brackets?: boolean;
  padding?: number;
  /** Lay the children out as a column so a child can claim `flex: 1`. */
  column?: boolean;
  children?: React.ReactNode;
}> = ({
  id,
  accent,
  col,
  row,
  emphasis = false,
  brackets = true,
  padding = 26,
  column = false,
  children,
}) => {
  const frame = useCurrentFrame();
  const heat = panelAlert(frame, id, accent);

  const borderColor = mix(
    emphasis ? COLORS.dataBright : COLORS.panel,
    accent.color,
    heat,
  );
  const bracketColor = mix(COLORS.text, accent.color, heat);

  return (
    <div
      style={{
        gridColumn: `${col[0]} / ${col[1]}`,
        gridRow: `${row[0]} / ${row[1]}`,
        position: "relative",
        display: column ? "flex" : "block",
        flexDirection: column ? "column" : undefined,
        border: `${2 + heat * 2}px solid ${alpha(borderColor, (emphasis ? 0.85 : 0.5) + heat * 0.45)}`,
        background: emphasis ? COLORS.panelFill : COLORS.panelFillDark,
        backdropFilter: emphasis ? "brightness(1.18)" : undefined,
        padding,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      {children}
      {brackets
        ? ([
            [0, 0],
            [0, 1],
            [1, 0],
            [1, 1],
          ] as const
        ).map(([x, y]) => (
            <div
              key={`${x}-${y}`}
              style={{
                position: "absolute",
                width: 26,
                height: 26,
                [x ? "right" : "left"]: 8,
                [y ? "bottom" : "top"]: 8,
                borderTop: y ? undefined : `3px solid ${bracketColor}`,
                borderBottom: y ? `3px solid ${bracketColor}` : undefined,
                borderLeft: x ? undefined : `3px solid ${bracketColor}`,
                borderRight: x ? `3px solid ${bracketColor}` : undefined,
                opacity: 0.55 + heat * 0.45,
              }}
            />
          ))
        : null}
    </div>
  );
};

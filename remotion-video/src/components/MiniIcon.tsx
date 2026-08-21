import React from "react";
import { HAND_DRAWN_FILTER_ID } from "./HandDrawnFilter";
import { PALETTE } from "../constants";

export type MiniIconKind = "headphones" | "keyboard" | "watch" | "mouse";

type MiniIconProps = {
  kind: MiniIconKind;
  x: number;
  y: number;
  scale?: number;
  color?: string;
  opacity?: number;
};

// Tiny hand-drawn glyphs for "other things Bluetooth connects", used in a
// row on the data-transfer scene. Each is drawn inside a ~60x60 box
// centered on (0, 0) before being placed at (x, y).
export const MiniIcon: React.FC<MiniIconProps> = ({
  kind,
  x,
  y,
  scale = 1,
  color = PALETTE.ink,
  opacity = 1,
}) => {
  return (
    <g
      transform={`translate(${x} ${y}) scale(${scale})`}
      opacity={opacity}
      style={{ filter: `url(#${HAND_DRAWN_FILTER_ID})` }}
      stroke={color}
      strokeWidth={4}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    >
      {kind === "headphones" && (
        <>
          <path d="M -24 4 A 24 24 0 0 1 24 4" />
          <rect x={-30} y={2} width={14} height={22} rx={6} />
          <rect x={16} y={2} width={14} height={22} rx={6} />
        </>
      )}
      {kind === "keyboard" && (
        <>
          <rect x={-32} y={-18} width={64} height={36} rx={7} />
          {[-19, -1, 17].map((cx) => (
            <rect key={cx} x={cx - 6} y={-9} width={12} height={9} rx={2} strokeWidth={3} />
          ))}
          <rect x={-16} y={5} width={32} height={7} rx={3} strokeWidth={3} />
        </>
      )}
      {kind === "watch" && (
        <>
          <rect x={-10} y={-30} width={20} height={12} rx={3} />
          <rect x={-10} y={18} width={20} height={12} rx={3} />
          <circle cx={0} cy={0} r={20} />
          <path d="M 0 -8 L 0 0 L 7 5" />
        </>
      )}
      {kind === "mouse" && (
        <>
          <rect x={-16} y={-26} width={32} height={52} rx={16} />
          <path d="M 0 -26 L 0 -4" />
        </>
      )}
    </g>
  );
};

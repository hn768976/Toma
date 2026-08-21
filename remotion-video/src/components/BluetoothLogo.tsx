import React from "react";
import { HAND_DRAWN_FILTER_ID } from "./HandDrawnFilter";
import { useDrawOn } from "../hooks/useDrawOn";
import { PALETTE } from "../constants";

type BluetoothLogoProps = {
  progress: number; // 0 -> 1 draw-on amount
  size?: number;
  color?: string;
  strokeWidth?: number;
};

// The Bluetooth "rune" icon (a stylised merge of the Younger Futhark
// Hagall and Bjarkan runes), drawn as a single continuous hand-drawn
// stroke that reveals itself as `progress` goes from 0 to 1.
const RUNE_PATH =
  "M 0 -42 L 24 -21 L -24 21 L 0 42 L 24 21 L -24 -21 L 0 -42";

export const BluetoothLogo: React.FC<BluetoothLogoProps> = ({
  progress,
  size = 120,
  color = PALETTE.blue,
  strokeWidth = 9,
}) => {
  const { ref, dashProps } = useDrawOn();

  return (
    <svg
      width={size}
      height={size}
      viewBox="-42 -50 84 100"
      style={{ overflow: "visible", filter: `url(#${HAND_DRAWN_FILTER_ID})` }}
    >
      <path
        ref={ref}
        d={RUNE_PATH}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={dashProps(progress)}
      />
    </svg>
  );
};

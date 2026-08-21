import React from "react";
import { HAND_DRAWN_FILTER_ID } from "./HandDrawnFilter";
import { Face } from "./Face";
import { PALETTE } from "../constants";

export type CharacterProps = {
  x: number;
  y: number;
  frame: number;
  scale?: number;
  happy?: boolean;
  waving?: boolean;
  connected?: boolean;
  bluetoothOn?: boolean;
  flip?: boolean;
  bodyColor?: string;
};

// A friendly hand-drawn smartphone character: rounded body, a face on its
// screen, a small waving arm, and a little Bluetooth badge that blinks
// when its radio is on and glows with a ring once `connected`.
export const PhoneCharacter: React.FC<CharacterProps> = ({
  x,
  y,
  frame,
  scale = 1,
  happy = false,
  waving = false,
  connected = false,
  bluetoothOn = true,
  flip = false,
  bodyColor = PALETTE.white,
}) => {
  const bob = Math.sin(frame / 14) * 6;
  const armAngle = waving ? Math.sin(frame / 4) * 28 - 10 : -6;
  const badgePulse = 0.55 + 0.45 * Math.abs(Math.sin(frame / 10));

  return (
    <g transform={`translate(${x} ${y + bob}) scale(${flip ? -scale : scale} ${scale})`}>
      {connected && (
        <circle
          r={135}
          fill="none"
          stroke={PALETTE.blue}
          strokeWidth={4}
          strokeDasharray="10 10"
          opacity={0.55}
          style={{ filter: `url(#${HAND_DRAWN_FILTER_ID})` }}
        />
      )}

      <g style={{ filter: `url(#${HAND_DRAWN_FILTER_ID})` }}>
        {/* arm */}
        <g transform={`translate(78 20) rotate(${armAngle})`}>
          <path
            d="M 0 0 L 46 -8"
            stroke={PALETTE.ink}
            strokeWidth={9}
            strokeLinecap="round"
          />
        </g>

        {/* body */}
        <rect
          x={-70}
          y={-125}
          width={140}
          height={250}
          rx={30}
          fill={bodyColor}
          stroke={PALETTE.ink}
          strokeWidth={6}
        />

        {/* screen */}
        <rect
          x={-52}
          y={-95}
          width={104}
          height={170}
          rx={12}
          fill={PALETTE.blueSoft}
          opacity={0.35}
          stroke={PALETTE.ink}
          strokeWidth={3}
        />

        {/* home indicator */}
        <rect x={-24} y={95} width={48} height={6} rx={3} fill={PALETTE.ink} />

        <g transform="translate(0 -20)">
          <Face frame={frame} happy={happy} />
        </g>

        {/* bluetooth badge */}
        <g transform="translate(60 -95)">
          <circle
            r={22}
            fill={PALETTE.blue}
            opacity={bluetoothOn ? badgePulse : 0.25}
          />
          <path
            d="M 0 -11 L 6 -6 L -6 6 L 0 11 L 6 6 L -6 -6 L 0 -11"
            fill="none"
            stroke={PALETTE.white}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      </g>
    </g>
  );
};

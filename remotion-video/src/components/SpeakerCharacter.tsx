import React from "react";
import { HAND_DRAWN_FILTER_ID } from "./HandDrawnFilter";
import { Face } from "./Face";
import { PALETTE } from "../constants";
import type { CharacterProps } from "./PhoneCharacter";

// A friendly hand-drawn portable Bluetooth speaker character: a pill-shaped
// body with two speaker-grill "cheeks", a carry strap, little feet, a face,
// and the same blinking Bluetooth badge / connected ring as the phone.
export const SpeakerCharacter: React.FC<CharacterProps> = ({
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
  const bob = Math.sin(frame / 14 + 1.3) * 6;
  const footWiggle = waving ? Math.sin(frame / 5) * 6 : 0;
  const badgePulse = 0.55 + 0.45 * Math.abs(Math.sin(frame / 10 + 1));

  return (
    <g transform={`translate(${x} ${y + bob}) scale(${flip ? -scale : scale} ${scale})`}>
      {connected && (
        <circle
          r={155}
          fill="none"
          stroke={PALETTE.blue}
          strokeWidth={4}
          strokeDasharray="10 10"
          opacity={0.55}
          style={{ filter: `url(#${HAND_DRAWN_FILTER_ID})` }}
        />
      )}

      <g style={{ filter: `url(#${HAND_DRAWN_FILTER_ID})` }}>
        {/* carry strap */}
        <path
          d="M -55 -90 Q 0 -140 55 -90"
          fill="none"
          stroke={PALETTE.ink}
          strokeWidth={7}
          strokeLinecap="round"
        />

        {/* body */}
        <rect
          x={-95}
          y={-90}
          width={190}
          height={180}
          rx={60}
          fill={bodyColor}
          stroke={PALETTE.ink}
          strokeWidth={6}
        />

        {/* speaker grills */}
        {[-58, 58].map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy={0} r={46} fill={PALETTE.blueSoft} opacity={0.35} stroke={PALETTE.ink} strokeWidth={3} />
            <circle cx={cx} cy={0} r={30} fill="none" stroke={PALETTE.ink} strokeWidth={2.5} opacity={0.6} />
            <circle cx={cx} cy={0} r={14} fill="none" stroke={PALETTE.ink} strokeWidth={2.5} opacity={0.6} />
          </g>
        ))}

        <g transform="translate(0 4)">
          <Face frame={frame} happy={happy} eyeSpacing={16} />
        </g>

        {/* feet */}
        <g transform={`translate(-40 ${94 + footWiggle})`}>
          <path d="M -14 0 L 14 0" stroke={PALETTE.ink} strokeWidth={9} strokeLinecap="round" />
        </g>
        <g transform={`translate(40 ${94 - footWiggle})`}>
          <path d="M -14 0 L 14 0" stroke={PALETTE.ink} strokeWidth={9} strokeLinecap="round" />
        </g>

        {/* bluetooth badge */}
        <g transform="translate(0 -108)">
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

import React from "react";
import { PALETTE } from "../constants";

type FaceProps = {
  frame: number;
  happy?: boolean;
  color?: string;
  eyeSpacing?: number;
};

// A minimal hand-drawn face (two dot eyes + a mouth) shared by every
// character. Blinks periodically and can smile wider when `happy`.
export const Face: React.FC<FaceProps> = ({
  frame,
  happy = false,
  color = PALETTE.ink,
  eyeSpacing = 22,
}) => {
  const blinkCycle = frame % 90;
  const isBlinking = blinkCycle > 84;
  const eyeHeight = isBlinking ? 1.5 : 9;

  return (
    <g>
      <ellipse cx={-eyeSpacing} cy={0} rx={5} ry={eyeHeight} fill={color} />
      <ellipse cx={eyeSpacing} cy={0} rx={5} ry={eyeHeight} fill={color} />
      {happy ? (
        <path
          d={`M ${-eyeSpacing} 18 Q 0 40 ${eyeSpacing} 18`}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
        />
      ) : (
        <path
          d={`M ${-eyeSpacing + 4} 20 Q 0 30 ${eyeSpacing - 4} 20`}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
        />
      )}
    </g>
  );
};

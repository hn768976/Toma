import React from "react";

type Props = {
  x: number;
  y: number;
  size: number;
  pressed: boolean;
  clickPulse: number;
};

// The scripted pointer. It is rendered *inside* the screen plane, so it
// inherits the same perspective, roll and defocus as the UI underneath
// it. A cursor composited flat over a tilted screen is the single most
// common tell in fake-UI footage.
export const Cursor: React.FC<Props> = ({ x, y, size, pressed, clickPulse }) => {
  const ring = clickPulse > 0 && clickPulse < 1;
  const ringSize = size * (0.7 + clickPulse * 2.4);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: 0,
        height: 0,
        pointerEvents: "none",
      }}
    >
      {ring ? (
        <div
          style={{
            position: "absolute",
            left: -ringSize / 2,
            top: -ringSize / 2,
            width: ringSize,
            height: ringSize,
            borderRadius: "50%",
            border: `${Math.max(1, size * 0.055)}px solid rgba(226,240,250,0.9)`,
            opacity: (1 - clickPulse) * 0.8,
          }}
        />
      ) : null}
      <svg
        width={size}
        height={size * 1.5}
        viewBox="0 0 20 30"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          overflow: "visible",
          transform: pressed ? "scale(0.9)" : "scale(1)",
          transformOrigin: "0 0",
          filter: `drop-shadow(0 ${size * 0.06}px ${size * 0.12}px rgba(0,0,0,0.85))`,
        }}
      >
        <path
          d="M1 1 L1 23.4 L6.6 18.2 L10.2 26.6 L14.1 24.9 L10.6 16.8 L18.4 16.2 Z"
          fill={pressed ? "#cfe0ee" : "#f6fafd"}
          stroke="#0a1017"
          strokeWidth={1.4}
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

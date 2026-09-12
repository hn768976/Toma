import React from "react";
import type { Stage } from "./data";

/** Line glyphs drawn inside each stage card, on a 32x32 grid. */
export const StageIcon: React.FC<{ kind: Stage["icon"]; color: string; size?: number }> = ({
  kind,
  color,
  size = 34,
}) => {
  const common = {
    fill: "none",
    stroke: color,
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg width={size} height={size} viewBox="0 0 32 32">
      {kind === "feed" ? (
        <g {...common}>
          <path d="M5 11h14M5 16h18M5 21h14" />
          <path d="M22 10l6 6-6 6" />
        </g>
      ) : null}
      {kind === "check" ? (
        <g {...common}>
          <rect x="7" y="7" width="18" height="18" rx="3" />
          <path d="M12 16.5l3 3 5.5-6.5" />
        </g>
      ) : null}
      {kind === "hex" ? (
        <g {...common}>
          <path d="M16 4l10.4 6v12L16 28 5.6 22V10z" />
          <path d="M16 11l5.2 3v6L16 23l-5.2-3v-6z" />
        </g>
      ) : null}
      {kind === "branch" ? (
        <g {...common}>
          <circle cx="8" cy="16" r="3" />
          <circle cx="24" cy="8" r="3" />
          <circle cx="24" cy="24" r="3" />
          <path d="M11 14.5L21 9.5M11 17.5L21 22.5" />
        </g>
      ) : null}
      {kind === "chevrons" ? (
        <g {...common}>
          <path d="M8 9l7 7-7 7M18 9l7 7-7 7" />
        </g>
      ) : null}
      {kind === "target" ? (
        <g {...common}>
          <circle cx="16" cy="16" r="7" />
          <circle cx="16" cy="16" r="2.2" fill={color} stroke="none" />
          <path d="M16 3v4M16 25v4M3 16h4M25 16h4" />
        </g>
      ) : null}
      {kind === "exit" ? (
        <g {...common}>
          <path d="M18 6H8a2 2 0 00-2 2v16a2 2 0 002 2h10" />
          <path d="M21 11l5 5-5 5M13 16h13" />
        </g>
      ) : null}
    </svg>
  );
};

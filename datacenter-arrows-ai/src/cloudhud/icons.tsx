/**
 * Self-drawn HUD icons on a 100x100 grid. White strokes/fills only, no
 * third-party glyphs, no brand marks.
 */
import React from "react";

const S = {
  fill: "none",
  stroke: "#ffffff",
  strokeWidth: 8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};
const F = { fill: "#ffffff" };

export type IconName =
  | "lock"
  | "shield"
  | "mail"
  | "wifi"
  | "chat"
  | "globe"
  | "document"
  | "image"
  | "link"
  | "database"
  | "gear"
  | "phone";

const gearPath = () => {
  const teeth = 8;
  const pts: string[] = [];
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 4 === 0 || i % 4 === 1 ? 31 : 23;
    pts.push(`${(50 + Math.cos(a) * r).toFixed(2)} ${(50 + Math.sin(a) * r).toFixed(2)}`);
  }
  return `M ${pts.join(" L ")} Z`;
};
const GEAR = gearPath();

export const IconGlyph: React.FC<{ name: IconName }> = ({ name }) => {
  switch (name) {
    case "lock":
      return (
        <g>
          <path d="M34 46 V36 a16 16 0 0 1 32 0 V46" {...S} />
          <rect x="26" y="44" width="48" height="36" rx="6" {...F} />
          <circle cx="50" cy="59" r="5" fill="#1f5fbf" />
          <rect x="47.5" y="60" width="5" height="11" rx="2" fill="#1f5fbf" />
        </g>
      );
    case "shield":
      return (
        <g>
          <path d="M50 16 L78 26 V48 C78 66 66 78 50 85 C34 78 22 66 22 48 V26 Z" {...S} />
          <path d="M37 50 L46 59 L64 41" {...S} strokeWidth={7} />
        </g>
      );
    case "mail":
      return (
        <g>
          <rect x="18" y="28" width="64" height="44" rx="5" {...S} />
          <path d="M20 31 L50 54 L80 31" {...S} />
        </g>
      );
    case "wifi":
      return (
        <g>
          <path d="M18 44 a45 45 0 0 1 64 0" {...S} />
          <path d="M28 55 a31 31 0 0 1 44 0" {...S} />
          <path d="M38 66 a17 17 0 0 1 24 0" {...S} />
          <circle cx="50" cy="76" r="5.5" {...F} />
        </g>
      );
    case "chat":
      return (
        <g>
          <path d="M22 24 H78 a6 6 0 0 1 6 6 V60 a6 6 0 0 1 -6 6 H46 L32 78 V66 H22 a6 6 0 0 1 -6 -6 V30 a6 6 0 0 1 6 -6 Z" {...S} />
          <circle cx="36" cy="45" r="4.5" {...F} />
          <circle cx="50" cy="45" r="4.5" {...F} />
          <circle cx="64" cy="45" r="4.5" {...F} />
        </g>
      );
    case "globe":
      return (
        <g>
          <circle cx="50" cy="50" r="31" {...S} />
          <ellipse cx="50" cy="50" rx="13" ry="31" {...S} />
          <path d="M19 50 H81 M24 34 H76 M24 66 H76" {...S} strokeWidth={5} />
        </g>
      );
    case "document":
      return (
        <g>
          <path d="M28 16 H58 L74 32 V84 H28 Z" {...S} />
          <path d="M58 16 V32 H74" {...S} />
          <path d="M37 46 H65 M37 58 H65 M37 70 H56" {...S} strokeWidth={5} />
        </g>
      );
    case "image":
      return (
        <g>
          <rect x="18" y="24" width="64" height="52" rx="5" {...S} />
          <path d="M22 72 L42 50 L56 62 L64 54 L80 70" {...S} />
          <circle cx="64" cy="38" r="6" {...F} />
        </g>
      );
    case "link":
      return (
        <g transform="rotate(-45 50 50)">
          <rect x="14" y="38" width="40" height="24" rx="12" {...S} />
          <rect x="46" y="38" width="40" height="24" rx="12" {...S} />
        </g>
      );
    case "database":
      return (
        <g>
          <ellipse cx="50" cy="26" rx="26" ry="9" {...S} />
          <path d="M24 26 V74 a26 9 0 0 0 52 0 V26" {...S} />
          <path d="M24 42 a26 9 0 0 0 52 0 M24 58 a26 9 0 0 0 52 0" {...S} />
        </g>
      );
    case "gear":
      return (
        <g>
          <path d={GEAR} {...S} strokeWidth={5} />
          <circle cx="50" cy="50" r="10" {...S} />
        </g>
      );
    case "phone":
      return (
        <g>
          <rect x="31" y="14" width="38" height="72" rx="7" {...S} />
          <path d="M44 23 H56" {...S} strokeWidth={5} />
          <circle cx="50" cy="75" r="4" {...F} />
        </g>
      );
    default:
      return null;
  }
};

/** Rounded-square tile with an icon, centred on (0, 0), `size` wide. */
export const IconTile: React.FC<{ name: IconName; size: number; cyan: string }> = ({ name, size, cyan }) => (
  <g transform={`translate(${-size / 2} ${-size / 2}) scale(${size / 100})`}>
    <rect x="2" y="2" width="96" height="96" rx="5" fill="#2b6fd0" fillOpacity={0.92} stroke="#d4ecff" strokeWidth="4" />
    <g transform="translate(14 14) scale(0.72)">
      <IconGlyph name={name} />
    </g>
  </g>
);

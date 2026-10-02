import React from "react";

/**
 * Self-drawn line icons (no icon libraries). All on a 100×100 viewBox,
 * stroked in `color`.
 */
type P = { size: number; color: string; stroke?: number; style?: React.CSSProperties };

const Svg: React.FC<P & { children: React.ReactNode }> = ({ size, color, stroke = 5, style, children }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 100 100"
    fill="none"
    stroke={color}
    strokeWidth={stroke}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: "block", overflow: "visible", ...style }}
  >
    {children}
  </svg>
);

export const Padlock: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M30 44 V32 a20 20 0 0 1 40 0 V44" />
    <rect x="20" y="44" width="60" height="44" rx="6" fill={p.color} fillOpacity={0.18} />
    <circle cx="50" cy="62" r="6" fill={p.color} stroke="none" />
    <path d="M50 66 V76" />
  </Svg>
);

export const WarningTriangle: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M50 10 L92 84 H8 Z" fill={p.color} fillOpacity={0.14} />
    <path d="M50 36 V60" strokeWidth={(p.stroke ?? 5) * 1.4} />
    <circle cx="50" cy="72" r="3.5" fill={p.color} stroke="none" />
  </Svg>
);

export const Shield: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M50 8 L84 20 V46 C84 70 68 84 50 92 C32 84 16 70 16 46 V20 Z" fill={p.color} fillOpacity={0.14} />
    <path d="M34 50 L46 62 L68 38" />
  </Svg>
);

export const Globe: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="50" cy="50" r="40" />
    <ellipse cx="50" cy="50" rx="18" ry="40" />
    <path d="M10 50 H90 M16 30 H84 M16 70 H84 M50 10 V90" />
  </Svg>
);

export const Skull: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M50 10 C28 10 16 26 16 44 C16 56 22 62 28 66 V80 H72 V66 C78 62 84 56 84 44 C84 26 72 10 50 10 Z" fill={p.color} fillOpacity={0.15} />
    <circle cx="36" cy="44" r="8" fill={p.color} stroke="none" />
    <circle cx="64" cy="44" r="8" fill={p.color} stroke="none" />
    <path d="M46 60 L50 54 L54 60 Z" fill={p.color} />
    <path d="M40 80 V70 M50 80 V70 M60 80 V70" />
  </Svg>
);

export const Magnifier: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="42" cy="42" r="26" />
    <path d="M62 62 L86 86" strokeWidth={(p.stroke ?? 5) * 1.6} />
    <path d="M30 42 a12 12 0 0 1 12 -12" />
  </Svg>
);

export const Bug: React.FC<P> = (p) => (
  <Svg {...p}>
    <ellipse cx="50" cy="56" rx="20" ry="26" fill={p.color} fillOpacity={0.15} />
    <circle cx="50" cy="26" r="10" />
    <path d="M30 46 H14 M30 60 H12 M32 74 L16 84 M70 46 H86 M70 60 H88 M68 74 L84 84 M42 18 L34 8 M58 18 L66 8 M50 34 V82" />
  </Svg>
);

export const Envelope: React.FC<P> = (p) => (
  <Svg {...p}>
    <rect x="10" y="22" width="80" height="56" rx="5" fill={p.color} fillOpacity={0.12} />
    <path d="M12 26 L50 56 L88 26" />
    <path d="M70 70 l14 14 M84 70 l-14 14" strokeWidth={(p.stroke ?? 5) * 0.8} />
  </Svg>
);

export const LockFile: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M22 8 H62 L80 26 V92 H22 Z" fill={p.color} fillOpacity={0.12} />
    <path d="M62 8 V26 H80" />
    <rect x="36" y="56" width="30" height="24" rx="3" />
    <path d="M42 56 V48 a9 9 0 0 1 18 0 V56" />
  </Svg>
);

export const Nodes: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="50" cy="50" r="10" fill={p.color} fillOpacity={0.3} />
    <circle cx="16" cy="18" r="8" />
    <circle cx="84" cy="18" r="8" />
    <circle cx="16" cy="82" r="8" />
    <circle cx="84" cy="82" r="8" />
    <path d="M22 24 L42 43 M78 24 L58 43 M22 76 L42 57 M78 76 L58 57" />
  </Svg>
);

export const Key: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="30" cy="50" r="16" />
    <path d="M46 50 H90 M76 50 V64 M88 50 V60" />
  </Svg>
);

export const User: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="50" cy="34" r="18" />
    <path d="M14 90 C14 68 30 58 50 58 C70 58 86 68 86 90" />
  </Svg>
);

export const Wifi: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M10 40 C34 16 66 16 90 40" />
    <path d="M24 54 C40 38 60 38 76 54" />
    <path d="M38 68 C46 60 54 60 62 68" />
    <circle cx="50" cy="80" r="5" fill={p.color} stroke="none" />
  </Svg>
);

export const Check: React.FC<P> = (p) => (
  <Svg {...p}>
    <circle cx="50" cy="50" r="40" fill={p.color} fillOpacity={0.2} />
    <path d="M30 52 L44 66 L72 36" strokeWidth={(p.stroke ?? 5) * 1.4} />
  </Svg>
);

export const Phone: React.FC<P> = (p) => (
  <Svg {...p}>
    <rect x="28" y="8" width="44" height="84" rx="8" />
    <path d="M44 80 H56" />
  </Svg>
);

export const Pin: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M50 92 C50 92 20 60 20 38 a30 30 0 0 1 60 0 C80 60 50 92 50 92 Z" />
    <circle cx="50" cy="38" r="10" />
  </Svg>
);

export const Face: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M10 30 V14 a4 4 0 0 1 4 -4 H30 M70 10 H86 a4 4 0 0 1 4 4 V30 M90 70 V86 a4 4 0 0 1 -4 4 H70 M30 90 H14 a4 4 0 0 1 -4 -4 V70" />
    <path d="M36 38 V44 M64 38 V44 M50 40 V58 H44 M38 68 C46 74 54 74 62 68" />
  </Svg>
);

export const Fire: React.FC<P> = (p) => (
  <Svg {...p}>
    <path d="M50 92 C28 92 18 76 20 60 C22 44 36 38 38 20 C50 30 52 40 50 50 C56 46 60 40 60 32 C74 44 82 56 80 66 C78 82 66 92 50 92 Z" fill={p.color} fillOpacity={0.15} />
  </Svg>
);

export const DotsGrid: React.FC<{ size: number; color: string }> = ({ size, color }) => (
  <svg width={size * 1.6} height={size} viewBox="0 0 48 30" style={{ display: "block" }}>
    {[0, 1, 2, 3].map((c) =>
      [0, 1].map((r) => <rect key={`${c}-${r}`} x={c * 12 + 2} y={r * 14 + 3} width="8" height="8" fill={color} opacity={0.75} />),
    )}
  </svg>
);

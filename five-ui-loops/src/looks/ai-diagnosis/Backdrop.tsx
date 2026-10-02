// Out-of-focus scenery behind the panel: body silhouette (1A) or DNA helix
// (1B), and dim side panels with glowing organ-like blobs. All self-drawn.
import React from "react";
import { blobPath, smoothThrough } from "../../lib/blob";
import { rgba } from "../../lib/color";

// Right half of a standing figure, neck → crotch, in a 1000×2400 box.
const HALF: [number, number][] = [
  [548, 292], [566, 338], [640, 372], [752, 404], [800, 470], [818, 640], [842, 830],
  [872, 1040], [892, 1190], [906, 1300], [884, 1372], [846, 1350], [828, 1230],
  [800, 1060], [764, 860], [726, 650], [706, 600], [690, 820], [702, 980], [736, 1140],
  [722, 1420], [690, 1700], [668, 1840], [660, 2040], [640, 2230], [676, 2306],
  [646, 2342], [560, 2336], [548, 2240], [554, 2020], [560, 1830], [548, 1560], [516, 1260], [500, 1236],
];
const BODY_PATH = (() => {
  const right = HALF;
  const left = HALF.map(([x, y]) => [1000 - x, y] as [number, number]).reverse();
  const all = [...right, ...left.slice(1)];
  return `M${all[0][0]},${all[0][1]}` + smoothThrough(all) + "Z";
})();

export const BodySilhouette: React.FC<{ accent: string; scanY: number }> = ({ accent, scanY }) => (
  <svg viewBox="0 0 1000 2400" style={{ width: "100%", height: "100%", overflow: "visible" }}>
    <defs>
      <linearGradient id="bodyFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#2A86F0" stopOpacity="0.85" />
        <stop offset="0.55" stopColor="#1B64C8" stopOpacity="0.7" />
        <stop offset="1" stopColor="#123E86" stopOpacity="0.55" />
      </linearGradient>
      <linearGradient id="scanBand" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={accent} stopOpacity="0" />
        <stop offset="0.5" stopColor="#E8F6FF" stopOpacity="0.55" />
        <stop offset="1" stopColor={accent} stopOpacity="0" />
      </linearGradient>
      <clipPath id="bodyClip">
        <ellipse cx="500" cy="170" rx="112" ry="138" />
        <path d={BODY_PATH} />
      </clipPath>
    </defs>
    <ellipse cx="500" cy="170" rx="112" ry="138" fill="url(#bodyFill)" />
    <path d={BODY_PATH} fill="url(#bodyFill)" />
    <g clipPath="url(#bodyClip)">
      {/* faint rib arcs and spine, scan-style */}
      {Array.from({ length: 7 }, (_, i) => (
        <path
          key={i}
          d={`M${380 - i * 4},${470 + i * 52} Q500,${520 + i * 56} ${620 + i * 4},${470 + i * 52}`}
          fill="none"
          stroke="#9CD2FF"
          strokeOpacity={0.22}
          strokeWidth={8}
        />
      ))}
      <line x1="500" y1="320" x2="500" y2="1180" stroke="#9CD2FF" strokeOpacity={0.25} strokeWidth={10} strokeDasharray="26 18" />
      <rect x="0" y={scanY - 120} width="1000" height="240" fill="url(#scanBand)" />
    </g>
    <ellipse cx="500" cy="170" rx="112" ry="138" fill="none" stroke="#7CC4FF" strokeOpacity={0.6} strokeWidth={6} />
    <path d={BODY_PATH} fill="none" stroke="#7CC4FF" strokeOpacity={0.6} strokeWidth={6} />
  </svg>
);

export const Helix: React.FC<{ accent: string; phase: number }> = ({ accent, phase }) => {
  const amp = 250;
  const k = (Math.PI * 2) / 760;
  const a: string[] = [];
  const b: string[] = [];
  for (let y = -200; y <= 2600; y += 12) {
    a.push(`${(500 + amp * Math.sin(k * y + phase)).toFixed(1)},${y}`);
    b.push(`${(500 + amp * Math.sin(k * y + phase + Math.PI)).toFixed(1)},${y}`);
  }
  const rungs = [];
  for (let y = -160; y <= 2560; y += 64) {
    const s = Math.sin(k * y + phase);
    const depth = Math.cos(k * y + phase); // which strand is in front
    const x1 = 500 + amp * s;
    const x2 = 500 - amp * s;
    rungs.push(
      <g key={y}>
        <line x1={x1} y1={y} x2={x2} y2={y} stroke={accent} strokeOpacity={0.18 + 0.22 * Math.abs(s)} strokeWidth={10} />
        <circle cx={x1} cy={y} r={16 + 6 * depth} fill={accent} fillOpacity={0.45 + 0.35 * depth} />
        <circle cx={x2} cy={y} r={16 - 6 * depth} fill={accent} fillOpacity={0.45 - 0.35 * depth} />
      </g>,
    );
  }
  return (
    <svg viewBox="0 0 1000 2400" style={{ width: "100%", height: "100%", overflow: "visible" }}>
      {rungs}
      <polyline points={a.join(" ")} fill="none" stroke={accent} strokeOpacity={0.85} strokeWidth={20} strokeLinecap="round" />
      <polyline points={b.join(" ")} fill="none" stroke={accent} strokeOpacity={0.55} strokeWidth={20} strokeLinecap="round" />
    </svg>
  );
};

const ORGAN_SEEDS = [11, 23, 37, 41, 53, 67];

export const SidePanel: React.FC<{
  accent: string;
  frameColor: string;
  variant: 0 | 1;
  pulse: number;
}> = ({ accent, frameColor, variant, pulse }) => {
  const w = 900;
  const h = 1500;
  const blobs =
    variant === 0
      ? [
          { d: blobPath(ORGAN_SEEDS[0], 330, 640, 150, 300, 9, 0.22), o: 0.75 },
          { d: blobPath(ORGAN_SEEDS[1], 570, 640, 150, 300, 9, 0.22), o: 0.75 },
          { d: blobPath(ORGAN_SEEDS[2], 450, 1100, 210, 130, 8, 0.3), o: 0.55 },
        ]
      : [
          { d: blobPath(ORGAN_SEEDS[3], 450, 560, 300, 250, 10, 0.25), o: 0.7 },
          { d: blobPath(ORGAN_SEEDS[4], 450, 560, 200, 160, 10, 0.3), o: 0.5 },
          { d: blobPath(ORGAN_SEEDS[5], 450, 560, 100, 80, 9, 0.35), o: 0.6 },
          { d: blobPath(ORGAN_SEEDS[2] + 7, 450, 1130, 230, 150, 9, 0.3), o: 0.5 },
        ];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: "100%", height: "100%", overflow: "visible" }}>
      <rect x={10} y={10} width={w - 20} height={h - 20} rx={60} fill="rgba(4,16,36,0.75)" stroke={frameColor} strokeOpacity={0.5} strokeWidth={8} />
      {Array.from({ length: 9 }, (_, i) => (
        <line key={i} x1={60} x2={w - 60} y1={160 + i * 150} y2={160 + i * 150} stroke={frameColor} strokeOpacity={0.12} strokeWidth={4} />
      ))}
      {blobs.map((b, i) => (
        <path
          key={i}
          d={b.d}
          fill={rgba(accent, b.o * (0.32 + 0.08 * pulse))}
          stroke={accent}
          strokeOpacity={b.o * 0.9}
          strokeWidth={10}
        />
      ))}
    </svg>
  );
};

// The vault: cream body, circular door, spoked handle, yellow light leaking
// out of the seams. The door swings open by flattening about its left hinge,
// which reads as a swing in flat vector without any perspective.

import React from "react";
import { PALETTE } from "../constants";
import { Glow } from "../Glow";
import { Svg } from "../Svg";

export const VAULT_RADIUS = 268;
export const VAULT_HALF = 350;
/** Local drawing units → scene px. */
export const VAULT_SCALE = 0.76;

/** Where the fat sits inside the vault, in the vault's local coordinates. */
const BLOB_LAYOUT = [
  { x: -122, y: -125, r: 55 },
  { x: 12, y: -152, r: 44 },
  { x: 136, y: -96, r: 50 },
  { x: -168, y: 12, r: 46 },
  { x: -26, y: -18, r: 62 },
  { x: 126, y: 44, r: 56 },
  { x: -118, y: 138, r: 50 },
  { x: 22, y: 156, r: 53 },
  { x: 158, y: 158, r: 40 },
];

export const VAULT_BLOB_COUNT = BLOB_LAYOUT.length;

export const Vault: React.FC<{
  /** Keeps the clipPath id unique when two vaults exist in one document. */
  idSuffix: string;
  /** 0 = shut, 1 = fully open. */
  doorOpen: number;
  /** Per-blob scale, 0 to 1, same length as VAULT_BLOB_COUNT. */
  blobScales: number[];
  /** Multiplier on the yellow bloom leaking out. */
  glow: number;
  /** Idle wobble applied to the contents so the fat is never quite still. */
  wobble: number;
}> = ({ idSuffix, doorOpen, blobScales, glow, wobble }) => {
  const clipId = `vault-mouth-${idSuffix}`;
  const hingeX = -VAULT_RADIUS;
  const doorScaleX = 1 - 0.87 * doorOpen;

  return (
    <>
      <Glow
        color={PALETTE.yellow}
        size={780 + 320 * glow}
        opacity={0.16 + 0.26 * glow}
      />
      <Svg half={VAULT_HALF + 40} scale={VAULT_SCALE}>
        <defs>
          <clipPath id={clipId}>
            <circle cx={0} cy={0} r={VAULT_RADIUS - 8} />
          </clipPath>
        </defs>

        {/* Plinth */}
        <rect x={-300} y={VAULT_HALF - 18} width={90} height={52} rx={16} fill={PALETTE.cream} />
        <rect x={210} y={VAULT_HALF - 18} width={90} height={52} rx={16} fill={PALETTE.cream} />

        {/* Body */}
        <rect
          x={-VAULT_HALF}
          y={-VAULT_HALF}
          width={VAULT_HALF * 2}
          height={VAULT_HALF * 2}
          rx={54}
          fill={PALETTE.cream}
        />

        {/* Light leaking from the door seam, always on */}
        <circle
          cx={0}
          cy={0}
          r={VAULT_RADIUS + 14}
          fill={PALETTE.yellow}
          opacity={0.55 + 0.45 * glow}
        />

        {/* Doorway */}
        <circle cx={0} cy={0} r={VAULT_RADIUS} fill={PALETTE.navy} />

        {/* Contents */}
        <g clipPath={`url(#${clipId})`}>
          {BLOB_LAYOUT.map((blob, i) => {
            const s = blobScales[i] ?? 0;
            if (s <= 0) return null;
            const drift = Math.sin(wobble + i * 1.3) * 5;
            return (
              <ellipse
                key={i}
                cx={blob.x}
                cy={blob.y + drift}
                rx={blob.r * s * 1.12}
                ry={blob.r * s}
                fill={PALETTE.yellow}
              />
            );
          })}
        </g>

        {/* Door plate — hinged on the left, flattens as it swings open */}
        <g transform={`translate(${hingeX} 0) scale(${doorScaleX} 1) translate(${-hingeX} 0)`}>
          <circle cx={0} cy={0} r={VAULT_RADIUS - 4} fill={PALETTE.cream} />
          {/* Bolts around the plate — shapes, not an outline */}
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <circle
              key={angle}
              cx={Math.cos((angle * Math.PI) / 180) * (VAULT_RADIUS - 34)}
              cy={Math.sin((angle * Math.PI) / 180) * (VAULT_RADIUS - 34)}
              r={11}
              fill={PALETTE.navy}
              opacity={1 - doorOpen}
            />
          ))}
          {/* Spoked handle */}
          {[0, 45, 90, 135].map((angle) => (
            <rect
              key={angle}
              x={-104}
              y={-13}
              width={208}
              height={26}
              rx={13}
              fill={PALETTE.navy}
              transform={`rotate(${angle})`}
            />
          ))}
          <circle cx={0} cy={0} r={42} fill={PALETTE.cream} />
          <circle cx={0} cy={0} r={22} fill={PALETTE.navy} />
        </g>

        {/* Hinge post */}
        <rect x={hingeX - 26} y={-70} width={26} height={140} rx={12} fill={PALETTE.cream} />
      </Svg>
    </>
  );
};

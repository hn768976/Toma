import React from "react";
import { ENVELOPE_COLORS } from "./theme";

type IconProps = {
  size: number;
  color: string;
};

/**
 * All icons are authored in a 24x24 viewBox. `sw` converts a desired on-screen
 * stroke width (in design px) into viewBox units for a given rendered size, so
 * every outline keeps the same visual weight regardless of icon size.
 */
const sw = (strokePx: number, size: number) => (24 * strokePx) / size;

export const CheckboxIcon: React.FC<IconProps> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect
      x={2.2}
      y={2.2}
      width={19.6}
      height={19.6}
      rx={2.2}
      stroke={color}
      strokeWidth={sw(8, size)}
    />
  </svg>
);

export const StarIcon: React.FC<IconProps> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path
      d="M12 2.6l2.86 6.02 6.54.88-4.75 4.66 1.16 6.6L12 17.63 6.19 20.76l1.16-6.6L2.6 9.5l6.54-.88z"
      stroke={color}
      strokeWidth={sw(8, size)}
      strokeLinejoin="round"
    />
  </svg>
);

export const TrashIcon: React.FC<IconProps> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <g
      stroke={color}
      strokeWidth={sw(8, size)}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3.6 5.9h16.8" />
      <path d="M9.6 5.9V3.4h4.8v2.5" />
      <path d="M5.7 5.9l1 14.1a1.3 1.3 0 001.3 1.2h8a1.3 1.3 0 001.3-1.2l1-14.1" />
      <path d="M10 9.9v7.4M14 9.9v7.4" />
    </g>
  </svg>
);

export const DotsIcon: React.FC<{ width: number; color: string }> = ({
  width,
  color,
}) => (
  <svg width={width} height={width / 4} viewBox="0 0 24 6" fill={color}>
    <circle cx={3} cy={3} r={2.6} />
    <circle cx={12} cy={3} r={2.6} />
    <circle cx={21} cy={3} r={2.6} />
  </svg>
);

export const SearchIcon: React.FC<IconProps> = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <g
      stroke={color}
      strokeWidth={sw(7, size)}
      strokeLinecap="round"
      fill="none"
    >
      <circle cx={10.5} cy={10.5} r={6.8} />
      <path d="M15.6 15.6L21 21" />
    </g>
  </svg>
);

/**
 * Amber envelope. With badge="alert" a small red disc sits in the top-right
 * corner, ringed in the page colour so it reads cleanly against the amber --
 * that badge is the only thing distinguishing the phishing icon from the spam
 * one, so it keeps its colour in both themes.
 */
export const EnvelopeIcon: React.FC<{
  width: number;
  height: number;
  badge: "none" | "alert";
  pageColor: string;
}> = ({ width, height, badge, pageColor }) => (
  <svg width={width} height={height} viewBox="0 0 34 24" fill="none">
    <rect
      x={0.9}
      y={2.4}
      width={32.2}
      height={19.2}
      rx={1.6}
      fill={ENVELOPE_COLORS.fill}
      stroke={ENVELOPE_COLORS.edge}
      strokeWidth={1.1}
    />
    <path
      d="M2.4 4.1L17 14.2 31.6 4.1"
      stroke={ENVELOPE_COLORS.fold}
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      fill="none"
    />
    <path
      d="M2.4 20.1l10.4-8.1M31.6 20.1L21.2 12"
      stroke={ENVELOPE_COLORS.edge}
      strokeWidth={0.9}
      strokeLinecap="round"
      opacity={0.55}
    />
    {badge === "alert" ? (
      <>
        <circle cx={29.6} cy={5.2} r={6.1} fill={pageColor} />
        <circle cx={29.6} cy={5.2} r={4.4} fill={ENVELOPE_COLORS.alert} />
      </>
    ) : null}
  </svg>
);

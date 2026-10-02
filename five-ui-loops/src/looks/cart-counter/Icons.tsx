// Self-drawn outline icons (no icon library, no brand marks).
import React from "react";

export const CartIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg viewBox="0 0 600 520" style={{ width: size, height: (size * 520) / 600, overflow: "visible" }}>
    <g fill="none" stroke={color} strokeWidth={34} strokeLinecap="round" strokeLinejoin="round">
      <path d="M28,58 H108 L178,352 H498 L548,138 H128" />
      <path d="M160,250 H520" strokeWidth={26} />
    </g>
    <circle cx={214} cy={444} r={36} fill={color} />
    <circle cx={458} cy={444} r={36} fill={color} />
  </svg>
);

export const SearchIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg viewBox="0 0 500 500" style={{ width: size, height: size, overflow: "visible" }}>
    <rect x={20} y={20} width={460} height={460} rx={110} fill="none" stroke={color} strokeWidth={26} />
    <circle cx={215} cy={210} r={95} fill="none" stroke={color} strokeWidth={30} />
    <path d="M285,282 L370,368" stroke={color} strokeWidth={38} strokeLinecap="round" />
  </svg>
);

export const UserIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg viewBox="0 0 400 400" style={{ width: size, height: size, overflow: "visible" }}>
    <circle cx={200} cy={200} r={185} fill="none" stroke={color} strokeWidth={22} />
    <circle cx={200} cy={160} r={62} fill="none" stroke={color} strokeWidth={22} />
    <path d="M90,320 C120,250 280,250 310,320" fill="none" stroke={color} strokeWidth={22} strokeLinecap="round" />
  </svg>
);

export const BellIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg viewBox="0 0 400 400" style={{ width: size, height: size, overflow: "visible" }}>
    <circle cx={200} cy={200} r={185} fill="none" stroke={color} strokeWidth={22} />
    <path d="M130,260 V185 C130,140 160,112 200,112 C240,112 270,140 270,185 V260 L292,284 H108 Z" fill="none" stroke={color} strokeWidth={22} strokeLinejoin="round" />
    <path d="M178,306 C186,322 214,322 222,306" fill="none" stroke={color} strokeWidth={22} strokeLinecap="round" />
  </svg>
);

export const HeartIcon: React.FC<{ color: string; size: number }> = ({ color, size }) => (
  <svg viewBox="0 0 400 400" style={{ width: size, height: size, overflow: "visible" }}>
    <circle cx={200} cy={200} r={185} fill="none" stroke={color} strokeWidth={22} />
    <path d="M200,300 C120,240 100,200 112,165 C126,124 180,118 200,160 C220,118 274,124 288,165 C300,200 280,240 200,300 Z" fill="none" stroke={color} strokeWidth={22} strokeLinejoin="round" />
  </svg>
);

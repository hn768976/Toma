import React from "react";

type IconProps = { size?: number; color: string; style?: React.CSSProperties };

const svg = (size: number, style: React.CSSProperties | undefined) => ({
  width: size,
  height: size,
  viewBox: "0 0 16 16",
  style: { display: "block", flexShrink: 0, ...style },
});

export const Chevron: React.FC<IconProps & { open: boolean }> = ({
  size = 12,
  color,
  open,
  style,
}) => (
  <svg {...svg(size, style)} fill="none" stroke={color} strokeWidth={1.6}>
    <path
      d={open ? "M3.5 6L8 10.5L12.5 6" : "M6 3.5L10.5 8L6 12.5"}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const FileGlyph: React.FC<IconProps> = ({ size = 12, color, style }) => (
  <svg {...svg(size, style)} fill="none" stroke={color} strokeWidth={1.3}>
    <path d="M4 2.2h5L12 5.2V13.8H4z" strokeLinejoin="round" />
    <path d="M9 2.2V5.2H12" strokeLinejoin="round" />
  </svg>
);

export const FolderGlyph: React.FC<IconProps> = ({ size = 12, color, style }) => (
  <svg {...svg(size, style)} fill="none" stroke={color} strokeWidth={1.3}>
    <path d="M2.2 4.4h4l1.2 1.5h6.4v7.7H2.2z" strokeLinejoin="round" />
  </svg>
);

export const SearchGlyph: React.FC<IconProps> = ({ size = 12, color, style }) => (
  <svg {...svg(size, style)} fill="none" stroke={color} strokeWidth={1.5}>
    <circle cx="7" cy="7" r="4.2" />
    <path d="M10.2 10.2L13.5 13.5" strokeLinecap="round" />
  </svg>
);

export const WarnGlyph: React.FC<IconProps> = ({ size = 11, color, style }) => (
  <svg {...svg(size, style)} fill="none" stroke={color} strokeWidth={1.4}>
    <path d="M8 2.6L14.4 13.4H1.6z" strokeLinejoin="round" />
    <path d="M8 6.6v3.1" strokeLinecap="round" />
    <path d="M8 11.6v.1" strokeLinecap="round" />
  </svg>
);

export const SendGlyph: React.FC<IconProps> = ({ size = 13, color, style }) => (
  <svg {...svg(size, style)} fill="none" stroke={color} strokeWidth={1.6}>
    <path d="M2.6 8h9.6" strokeLinecap="round" />
    <path d="M8.4 4.2L12.6 8L8.4 11.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const PlusGlyph: React.FC<IconProps> = ({ size = 12, color, style }) => (
  <svg {...svg(size, style)} fill="none" stroke={color} strokeWidth={1.5}>
    <path d="M8 3.4v9.2M3.4 8h9.2" strokeLinecap="round" />
  </svg>
);

export const SplitGlyph: React.FC<IconProps> = ({ size = 12, color, style }) => (
  <svg {...svg(size, style)} fill="none" stroke={color} strokeWidth={1.3}>
    <rect x="2.4" y="3.2" width="11.2" height="9.6" rx="1.4" />
    <path d="M8 3.2v9.6" />
  </svg>
);

export const DotsGlyph: React.FC<IconProps> = ({ size = 12, color, style }) => (
  <svg {...svg(size, style)} fill={color}>
    <circle cx="3.4" cy="8" r="1.05" />
    <circle cx="8" cy="8" r="1.05" />
    <circle cx="12.6" cy="8" r="1.05" />
  </svg>
);

export const SparkGlyph: React.FC<IconProps> = ({ size = 12, color, style }) => (
  <svg {...svg(size, style)} fill="none" stroke={color} strokeWidth={1.3}>
    <path d="M8 2.4L9.3 6.7L13.6 8L9.3 9.3L8 13.6L6.7 9.3L2.4 8L6.7 6.7z" strokeLinejoin="round" />
  </svg>
);

export const PaperclipGlyph: React.FC<IconProps> = ({ size = 12, color, style }) => (
  <svg {...svg(size, style)} fill="none" stroke={color} strokeWidth={1.3}>
    <path
      d="M11.6 7.4L7.2 11.8a2.6 2.6 0 01-3.7-3.7l4.9-4.9a1.8 1.8 0 012.5 2.5l-4.8 4.8a.9.9 0 01-1.3-1.3l4.3-4.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

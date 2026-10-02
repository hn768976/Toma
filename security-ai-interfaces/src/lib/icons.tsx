import React from "react";

// Every icon in this project is hand-drawn here as SVG paths on a 24 x 24
// grid. No icon library is imported anywhere.

const gearPath = (() => {
  const teeth = 8;
  const ro = 9.6;
  const ri = 7.4;
  let d = "";
  for (let i = 0; i < teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 4 === 0 || i % 4 === 1 ? ro : ri;
    d += `${i === 0 ? "M" : "L"}${(12 + r * Math.cos(a)).toFixed(2)} ${(12 + r * Math.sin(a)).toFixed(2)}`;
  }
  return d + "Z";
})();

type Draw = (c: string, bg: string) => React.ReactNode;

const P = (d: string) => <path d={d} />;

export const ICONS: Record<string, Draw> = {
  lock: () => (
    <>
      {P("M7.5 11V7.6a4.5 4.5 0 0 1 9 0V11")}
      <rect x={4.5} y={11} width={15} height={10} rx={2} />
      <circle cx={12} cy={15.2} r={1.3} />
      {P("M12 16.5v2")}
    </>
  ),
  lockOpen: () => (
    <>
      {P("M7.5 11V7.6a4.5 4.5 0 0 1 8.8-1.3")}
      <rect x={4.5} y={11} width={15} height={10} rx={2} />
      <circle cx={12} cy={15.2} r={1.3} />
      {P("M12 16.5v2")}
    </>
  ),
  shield: () => P("M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z"),
  shieldCheck: () => (
    <>
      {P("M12 2.5l8 3v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z")}
      {P("M8.6 12.2l2.4 2.4 4.6-4.8")}
    </>
  ),
  check: () => P("M5.5 12.5l4.2 4.2 8.8-9.2"),
  checkCircle: () => (
    <>
      <circle cx={12} cy={12} r={9} />
      {P("M8 12.4l2.7 2.7 5.3-5.6")}
    </>
  ),
  warning: (c) => (
    <>
      {P("M12 3.2L21.6 20H2.4Z")}
      {P("M12 9.5v5")}
      <circle cx={12} cy={17.3} r={0.9} fill={c} stroke="none" />
    </>
  ),
  skull: (c, bg) => (
    <>
      <path
        d="M12 2.5c-4.7 0-8 3.2-8 7.6 0 2.6 1.2 4.4 3 5.4v3a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-3c1.8-1 3-2.8 3-5.4 0-4.4-3.3-7.6-8-7.6z"
        fill={c}
      />
      <circle cx={8.8} cy={10.8} r={2} fill={bg} stroke="none" />
      <circle cx={15.2} cy={10.8} r={2} fill={bg} stroke="none" />
      <path d="M12 13.4l-1.1 2.1h2.2z" fill={bg} stroke="none" />
      <path d="M10 19.5v-2.2M12 19.5v-2.2M14 19.5v-2.2" stroke={bg} />
    </>
  ),
  globe: () => (
    <>
      <circle cx={12} cy={12} r={9} />
      <ellipse cx={12} cy={12} rx={4} ry={9} />
      {P("M3 12h18M4.4 7.5h15.2M4.4 16.5h15.2")}
    </>
  ),
  folder: () =>
    P(
      "M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l2 2.2h8.4A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z",
    ),
  file: () => P("M6 3h8l4 4v14H6zM14 3v4h4"),
  fileLock: () => (
    <>
      {P("M6 3h8l4 4v6M6 3v18h6M14 3v4h4")}
      <rect x={13} y={16} width={7} height={5} rx={1} />
      {P("M14.6 16v-1.4a1.9 1.9 0 0 1 3.8 0V16")}
    </>
  ),
  fileSearch: () => (
    <>
      {P("M6 3h8l4 4v4M6 3v18h5M14 3v4h4")}
      <circle cx={16} cy={16} r={3} />
      {P("M18.2 18.2l2.5 2.5")}
    </>
  ),
  gear: () => (
    <>
      {P(gearPath)}
      <circle cx={12} cy={12} r={3} />
    </>
  ),
  search: () => (
    <>
      <circle cx={10.5} cy={10.5} r={6} />
      {P("M15 15l5.5 5.5")}
    </>
  ),
  user: () => (
    <>
      <circle cx={12} cy={8.5} r={3.8} />
      {P("M4.5 20.5c.8-4 3.8-6 7.5-6s6.7 2 7.5 6")}
    </>
  ),
  users: () => (
    <>
      <circle cx={9} cy={9} r={3.2} />
      {P("M3 19.5c.6-3.4 3-5 6-5s5.4 1.6 6 5")}
      <circle cx={16.5} cy={8} r={2.6} />
      {P("M16 13.2c2.6 0 4.5 1.4 5 4.3")}
    </>
  ),
  sliders: (c) => (
    <>
      {P("M4 7h16M4 12h16M4 17h16")}
      <circle cx={9} cy={7} r={1.9} fill={c} />
      <circle cx={15} cy={12} r={1.9} fill={c} />
      <circle cx={7} cy={17} r={1.9} fill={c} />
    </>
  ),
  layers: () => P("M12 3l9 4.5-9 4.5-9-4.5zM3 12l9 4.5 9-4.5M3 16.5l9 4.5 9-4.5"),
  chip: () => (
    <>
      <rect x={6} y={6} width={12} height={12} rx={1.5} />
      <rect x={9.2} y={9.2} width={5.6} height={5.6} rx={0.6} />
      {P("M9 6V3M12 6V3M15 6V3M9 21v-3M12 21v-3M15 21v-3M6 9H3M6 12H3M6 15H3M21 9h-3M21 12h-3M21 15h-3")}
    </>
  ),
  database: () => (
    <>
      <ellipse cx={12} cy={5.5} rx={7} ry={2.5} />
      {P("M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5")}
    </>
  ),
  bug: () => (
    <>
      <ellipse cx={12} cy={14} rx={4.6} ry={6} />
      {P("M9.4 8.6a2.6 2.6 0 0 1 5.2 0M12 9.5v10.5M7.4 12H4M7.4 16H4M16.6 12H20M16.6 16H20M8.2 19l-2.4 2M15.8 19l2.4 2")}
    </>
  ),
  wifi: (c) => (
    <>
      {P("M2.5 9a14 14 0 0 1 19 0M5.5 12.5a9.5 9.5 0 0 1 13 0M8.5 16a5 5 0 0 1 7 0")}
      <circle cx={12} cy={19.4} r={1.2} fill={c} stroke="none" />
    </>
  ),
  key: () => (
    <>
      <circle cx={8} cy={12} r={4} />
      {P("M12 12h9M18.5 12v3.2M15.6 12v2.6")}
    </>
  ),
  cloud: () => P("M7 18.5a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 17.8 9a4.5 4.5 0 0 1-.3 9.5z"),
  mic: () => (
    <>
      <rect x={9} y={3} width={6} height={11} rx={3} />
      {P("M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6")}
    </>
  ),
  send: () => P("M3.5 11.2L20.5 3.5 13 20.5l-2.4-7z"),
  server: (c) => (
    <>
      <rect x={4} y={4} width={16} height={6.5} rx={1.5} />
      <rect x={4} y={13.5} width={16} height={6.5} rx={1.5} />
      <circle cx={7.5} cy={7.25} r={0.9} fill={c} stroke="none" />
      <circle cx={7.5} cy={16.75} r={0.9} fill={c} stroke="none" />
      {P("M11 7.25h6M11 16.75h6")}
    </>
  ),
  eye: () => (
    <>
      {P("M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z")}
      <circle cx={12} cy={12} r={3} />
    </>
  ),
  cube: () => P("M12 2.8l8 4.6v9.2l-8 4.6-8-4.6V7.4zM4 7.4l8 4.6 8-4.6M12 12v9.2"),
  nodes: () => (
    <>
      {P("M6 6l6 6 6-6M6 18l6-6 6 6")}
      <circle cx={6} cy={6} r={2} />
      <circle cx={18} cy={6} r={2} />
      <circle cx={12} cy={12} r={2.2} />
      <circle cx={6} cy={18} r={2} />
      <circle cx={18} cy={18} r={2} />
    </>
  ),
  bolt: () => P("M13 2.5L5 13.5h6l-1 8 8-11h-6z"),
  clock: () => (
    <>
      <circle cx={12} cy={12} r={9} />
      {P("M12 7v5l3.5 2")}
    </>
  ),
  bell: () => P("M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"),
  code: () => P("M8.5 7L3.5 12l5 5M15.5 7l5 5-5 5M13.5 4.5l-3 15"),
  plus: () => P("M12 5v14M5 12h14"),
  message: () => P("M4 5h16v11H9.5L4 20z"),
  firewall: () => (
    <>
      <rect x={3} y={5} width={18} height={14} rx={1} />
      {P("M3 9.7h18M3 14.3h18M9 5v4.7M15 5v4.7M6 9.7v4.6M12 9.7v4.6M18 9.7v4.6M9 14.3V19M15 14.3V19")}
    </>
  ),
  radar: (c) => (
    <>
      <circle cx={12} cy={12} r={9} />
      <circle cx={12} cy={12} r={5} />
      {P("M12 12l6.4-6.4")}
      <circle cx={15.6} cy={14.2} r={1} fill={c} stroke="none" />
    </>
  ),
  help: (c) => (
    <>
      <circle cx={12} cy={12} r={9} />
      {P("M9.6 9.4a2.4 2.4 0 1 1 3.4 2.2c-.7.3-1 .8-1 1.5v.6")}
      <circle cx={12} cy={16.8} r={0.9} fill={c} stroke="none" />
    </>
  ),
  dots: (c) => (
    <>
      {[0, 1, 2].flatMap((i) =>
        [0, 1, 2].map((j) => <circle key={`${i}${j}`} cx={6 + i * 6} cy={6 + j * 6} r={1.3} fill={c} stroke="none" />),
      )}
    </>
  ),
  minus: () => P("M6 12h12"),
  square: () => <rect x={6} y={6} width={12} height={12} />,
  close: () => P("M6.5 6.5l11 11M17.5 6.5l-11 11"),
  chart: () => P("M4 20V4M4 20h16M7 16l4-5 3 3 5-7"),
  terminal: () => (
    <>
      <rect x={3} y={4.5} width={18} height={15} rx={1.5} />
      {P("M7 9.5l3 2.5-3 2.5M12 15h5")}
    </>
  ),
  arrowDown: () => P("M12 4v15M6.5 13.5L12 19l5.5-5.5"),
  arrowUp: () => P("M12 20V5M6.5 10.5L12 5l5.5 5.5"),
  arrowRight: () => P("M4 12h15M13.5 6.5L19 12l-5.5 5.5"),
  history: () => (
    <>
      {P("M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.5 4.5v3.2h3.2")}
      {P("M12 8v4.2l3 1.8")}
    </>
  ),
  home: () => P("M4 11l8-7 8 7v9H4zM10 20v-5h4v5"),
  target: (c) => (
    <>
      <circle cx={12} cy={12} r={8.5} />
      <circle cx={12} cy={12} r={4.5} />
      <circle cx={12} cy={12} r={1.2} fill={c} stroke="none" />
      {P("M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4")}
    </>
  ),
  vector: (c) => (
    <>
      {P("M5 19L19 5M5 19h5M5 19v-5")}
      <circle cx={19} cy={5} r={1.6} fill={c} stroke="none" />
      <circle cx={9} cy={8} r={1.2} fill={c} stroke="none" />
      <circle cx={16} cy={15} r={1.2} fill={c} stroke="none" />
    </>
  ),
};

export type IconName = keyof typeof ICONS;

/** Draws a 24x24 icon at (x, y) scaled to `size` design units. */
export const Icon: React.FC<{
  name: IconName;
  x: number;
  y: number;
  size: number;
  color: string;
  bg?: string;
  sw?: number; // stroke width in DESIGN units (kept constant whatever the icon size)
  opacity?: number;
  filter?: string;
}> = ({ name, x, y, size, color, bg = "#000000", sw = 1.5, opacity, filter }) => {
  const k = size / 24;
  return (
    <g
      transform={`translate(${x} ${y}) scale(${k})`}
      fill="none"
      stroke={color}
      strokeWidth={sw / k}
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity={opacity}
      filter={filter}
    >
      {ICONS[name](color, bg)}
    </g>
  );
};

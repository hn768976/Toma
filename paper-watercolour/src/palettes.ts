// Every colourway is one data row. To add one, append a row to the right
// table; Root.tsx registers a composition (and/or still) for each row.

export type BloomColourway = { name: string; paper: string; pigments: [string, string, string, string] };
export const BLOOM_COLOURWAYS: BloomColourway[] = [
  { name: "Pastel", paper: "#F3EBDD", pigments: ["#F2B8C0", "#C8B8E8", "#B8E0CC", "#F5E2A8"] },
  { name: "Sunset", paper: "#F3EBDD", pigments: ["#F08A6A", "#F5B070", "#E07A9A", "#8A5A8A"] },
  { name: "MintLavender", paper: "#F3EBDD", pigments: ["#B8E0CC", "#C8B8E8", "#9CCFB8", "#B0A0DC"] },
];

// Ink reveal / corner washes / splatter: a dark ink and a light ink; dense
// pigment leans to `dark`, thin washes to `light`.
export type InkColourway = { name: string; paper: string; dark: string; light: string };
export const INK_COLOURWAYS: InkColourway[] = [
  { name: "Indigo", paper: "#F3EBDD", dark: "#2A3A7A", light: "#6A80A8" },
  { name: "Sepia", paper: "#F3EBDD", dark: "#5A3A20", light: "#B08850" },
  { name: "Pastel", paper: "#F3EBDD", dark: "#C890B8", light: "#F2B8C0" },
  { name: "Black", paper: "#F3EBDD", dark: "#18181C", light: "#5A5A60" },
];

export type SketchColourway = { name: string; paper: string; inks: [string, string, string, string]; count: number };
export const SKETCH_COLOURWAYS: SketchColourway[] = [
  { name: "KidsBright", paper: "#FAF6EE", inks: ["#E8483A", "#F5C030", "#3A7AD8", "#4AB060"], count: 70 },
  { name: "Muted", paper: "#F3EBDD", inks: ["#C0705A", "#8AA080", "#7A90A8", "#C8A040"], count: 70 },
];

export type PencilColourway = { name: string; paper: string; lead: string };
export const PENCIL_COLOURWAYS: PencilColourway[] = [
  { name: "Graphite", paper: "#F3EBDD", lead: "#3C3C40" },
  { name: "Sepia", paper: "#F3EBDD", lead: "#5A3A20" },
];

export type StripeColourway = { name: string; paper: string; pigments: string[] };
export const STRIPE_COLOURWAYS: StripeColourway[] = [
  { name: "RainbowPastel", paper: "#F3EBDD", pigments: ["#F2A8B0", "#F5C8A0", "#F5E2A8", "#B8E0CC", "#A8CCE8", "#C8B8E8", "#E8B8D8"] },
  { name: "EarthTones", paper: "#F3EBDD", pigments: ["#A0603A", "#C89050", "#8A8A50", "#6A7A5A", "#B07850", "#7A5A40", "#C8A870"] },
];

export type MapColourway = { name: string; paper: string; ink: string; sea: string; stain: number };
export const MAP_COLOURWAYS: MapColourway[] = [
  { name: "Antique", paper: "#EBDDC0", ink: "#3A2A1A", sea: "#A8BCC4", stain: 1 },
  { name: "BlueInk", paper: "#F3EBDD", ink: "#1E3A6A", sea: "#9AB8D0", stain: 0.35 },
];

export type BoardColourway = { name: string; board: string; chalk: string };
export const BOARD_COLOURWAYS: BoardColourway[] = [
  { name: "Green", board: "#2A3A32", chalk: "#EDEBE2" },
  { name: "Black", board: "#1E2022", chalk: "#ECEAE4" },
];

export const findRow = <T extends { name: string }>(rows: T[], name: string): T => {
  const r = rows.find((x) => x.name === name);
  if (!r) throw new Error(`Unknown colourway ${name}`);
  return r;
};

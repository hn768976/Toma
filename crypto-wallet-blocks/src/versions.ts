// One data row per version. Root.tsx registers one composition per row.
//
// To add a colourway: copy a row, give it a new `id`, and change `palette`.
// To change the wallet text: edit `screen` (title and balance rows).

export type Story = "blocks" | "secure" | "hold";

export type Palette = {
  background: string; // near-black backdrop
  glow: string; // soft glow behind the wallet
  floorSpot: string; // light pool under the wallet
  rim: string; // thin bright rim around the wallet
  blockEdge: string; // glass block edges and inner glow
  blockTint: string; // glass block body
  accent: string; // panels and their circuit pattern
  lock: string; // padlock glass
  screenText: string; // text on the wallet screen
};

export type BalanceRow = { start: number; step: number };

export type Version = {
  id: string;
  story: Story;
  durationInFrames: number;
  // Period that time-based effects (grain, pulses, orbits) repeat on.
  loopFrames: number;
  palette: Palette;
  screen: { title: string; rows: [BalanceRow, BalanceRow] };
};

const BLUE: Palette = {
  background: "#04060C",
  glow: "#0A2A6A",
  floorSpot: "#D0D8E4",
  rim: "#A8D0FF",
  blockEdge: "#EAF4FF",
  blockTint: "#CCDAEC",
  accent: "#3A8AFF",
  lock: "#22A0FF",
  screenText: "#C8D0D8",
};

const GOLD: Palette = {
  background: "#0A0602",
  glow: "#6A3A0A",
  floorSpot: "#F0DCC0",
  rim: "#FFE6C4",
  blockEdge: "#FFC870",
  blockTint: "#E8C890",
  accent: "#FFB040",
  lock: "#F0A030",
  screenText: "#D8D0C4",
};

const SCREEN = {
  title: "Wallet",
  rows: [
    { start: 2, step: 10 },
    { start: 1618, step: 10 },
  ] as [BalanceRow, BalanceRow],
};

export const VERSIONS: Version[] = [
  { id: "WalletBlocks_Blue", story: "blocks", durationInFrames: 300, loopFrames: 300, palette: BLUE, screen: SCREEN },
  { id: "WalletSecure_Blue", story: "secure", durationInFrames: 300, loopFrames: 300, palette: BLUE, screen: SCREEN },
  { id: "WalletSecure_Gold", story: "secure", durationInFrames: 300, loopFrames: 300, palette: GOLD, screen: SCREEN },
  { id: "WalletSecure_HoldLoop", story: "hold", durationInFrames: 600, loopFrames: 600, palette: BLUE, screen: SCREEN },
];

export const FPS = 30;
export const WIDTH = 3840;
export const HEIGHT = 2160;

export const compositionId = (id: string) => id.replace(/_/g, "-");

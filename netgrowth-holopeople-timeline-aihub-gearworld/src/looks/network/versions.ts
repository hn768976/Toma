// One data row per colourway. Add a row here and register it in Root.tsx.
export type NetworkVersion = {
  id: string;
  background: string;
  badges: [string, string, string]; // dark, mid, pale
  line: string;
  dashed: string;
  pictogram: string;
  counter: string;
  grain: number;
};

export const NETWORK_VERSIONS: NetworkVersion[] = [
  {
    id: "NetworkGrowth-White",
    background: "#FFFFFF",
    badges: ["#1A7AD8", "#4A9AE8", "#9AC8F0"],
    line: "#5A6A7A",
    dashed: "#8A9AAA",
    pictogram: "#FFFFFF",
    counter: "#5A6A7A",
    grain: 0.015,
  },
  {
    id: "NetworkGrowth-Navy",
    background: "#061A3A",
    badges: ["#3AC8F0", "#2A8AE0", "#9AC8F0"],
    line: "#5A8AC0",
    dashed: "#4A7AB0",
    pictogram: "#FFFFFF",
    counter: "#9AC8F0",
    grain: 0.015,
  },
];

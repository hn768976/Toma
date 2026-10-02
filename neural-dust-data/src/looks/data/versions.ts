// One row per version. Add a row to get a new composition.
export type DataVersion = {
  id: string;
  bg: string; // ground / background
  teal: string; // main digit colour
  red: string; // accent cells
  white: string;
  fibreA: string; // most fibres
  fibreB: string; // accent fibres
  grid: string; // faint ground grid
};

export const DATA_VERSIONS: DataVersion[] = [
  { id: "DataPanels-TealRed", bg: "#041214", teal: "#5FE0E8", red: "#FF4A5A", white: "#E8FBFF", fibreA: "#5FD8C8", fibreB: "#FF4A5A", grid: "#0E2C30" },
];

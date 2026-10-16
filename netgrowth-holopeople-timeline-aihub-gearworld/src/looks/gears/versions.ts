// One data row per colourway.
export type GearVersion = {
  id: string;
  background: string;
  map: string;
  gear: string; // gear fill
  edge: string; // gear edges / HUD lines
  hot: string; // bright accents, readout
  grain: number;
};

export const GEAR_VERSIONS: GearVersion[] = [
  { id: "GearWorld-Blue", background: "#020A1A", map: "#1A4A8A", gear: "#145A8A", edge: "#2E9AD0", hot: "#8AF0FF", grain: 0.015 },
];

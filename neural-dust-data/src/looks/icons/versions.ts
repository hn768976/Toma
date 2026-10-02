// One row per version. Add a row to get a new composition.
export type IconVersion = {
  id: string;
  tile: string; // tile glow
  icon: string; // icon lines
  active: string; // activated tiles + check marks
  house: string;
  halo: string; // dot ring under houses
  line: string; // grid links
  floor: string;
  horizon: string;
};

export const ICON_VERSIONS: IconVersion[] = [
  { id: "IconNetwork", tile: "#3F8CFF", icon: "#DDEBFF", active: "#3FE8A0", house: "#7C74FF", halo: "#B05CFF", line: "#3FA8E8", floor: "#030A22", horizon: "#0A2A6A" },
];

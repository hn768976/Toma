export type NightSkyVersion = {
  id: string;
  skyLight: string; // upper-left
  skyDark: string; // lower-right
  star: string;
  meteor: string;
  meteorTail: string;
};

export const NIGHTSKY_VERSIONS: NightSkyVersion[] = [
  { id: "NightSkyMeteor", skyLight: "#16325A", skyDark: "#03070F", star: "#EAF2FF", meteor: "#FFFFFF", meteorTail: "#BFD8FF" },
];

// One data row per colourway.
export type AIHubVersion = {
  id: string;
  primary: string;
  secondary: string;
  background: string;
  grain: number; // 0 on pure black so the background stays exactly black
};

export const AIHUB_VERSIONS: AIHubVersion[] = [
  { id: "AIHub-TealOrange", primary: "#3AD8E8", secondary: "#F0A03A", background: "#000000", grain: 0 },
  { id: "AIHub-BlueViolet", primary: "#4A8AFF", secondary: "#B07AFF", background: "#04081A", grain: 0.015 },
];

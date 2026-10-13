// One data row per version. Add a colourway by adding a row here.
export type Version =
  | { id: string; file: string; look: "lightStreams"; frames: 600; props: { gradient: [string, string, string]; seed: number } }
  | { id: string; file: string; look: "shieldDome"; frames: 300 | 600; props: { mode: "story" | "hold" } }
  | { id: string; file: string; look: "neonWaves"; frames: 600; props: { neon: [string, string, string]; base: string; lightL: string; lightR: string } }
  | { id: string; file: string; look: "pillSpill"; frames: 600; props: { background: string; tabletA: string; tabletB: string; capA: string; capB: string; capC: string } }
  | { id: string; file: string; look: "dataStrands"; frames: 600; props: { colors: [string, number][]; haze: string; text: string } };

export const VERSIONS: Version[] = [
  { id: "LightStreams-CoralViolet", file: "LightStreams_CoralViolet", look: "lightStreams", frames: 600, props: { gradient: ["#FF5A5A", "#E83AA8", "#8A5AFF"], seed: 1033 } },
  { id: "ShieldDome-Story", file: "ShieldDome_Story", look: "shieldDome", frames: 300, props: { mode: "story" } },
  { id: "ShieldDome-HoldLoop", file: "ShieldDome_HoldLoop", look: "shieldDome", frames: 600, props: { mode: "hold" } },
  { id: "NeonWaves-PinkBlue", file: "NeonWaves_PinkBlue", look: "neonWaves", frames: 600, props: { neon: ["#FF4AC8", "#FFFFFF", "#4A8AFF"], base: "#C8B8E8", lightL: "#FF3AC0", lightR: "#3AC8FF" } },
  { id: "PillSpill-Blue", file: "PillSpill_Blue", look: "pillSpill", frames: 600, props: { background: "#A8D0F0", tabletA: "#3A9AE8", tabletB: "#2A6AC8", capA: "#2F7FD8", capB: "#5FB4EC", capC: "#2A5FC4" } },
  { id: "PillSpill-WhiteOrange", file: "PillSpill_WhiteOrange", look: "pillSpill", frames: 600, props: { background: "#F2EEE8", tabletA: "#F7F5F0", tabletB: "#EDEAE3", capA: "#F08A3A", capB: "#F7F5F0", capC: "#F08A3A" } },
  { id: "DataStrands-BlueOrange", file: "DataStrands_BlueOrange", look: "dataStrands", frames: 600, props: { colors: [["#3AE8E8", 40], ["#3A6AFF", 30], ["#FF8A4A", 20], ["#FF6AA8", 10]], haze: "#0A1A4A", text: "#5A8AFF" } },
  { id: "LightStreams-TealBlue", file: "LightStreams_TealBlue", look: "lightStreams", frames: 600, props: { gradient: ["#3AF0C8", "#3AA8FF", "#5A5AFF"], seed: 1033 } },
];

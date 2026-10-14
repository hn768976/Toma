/**
 * One data row per version. To add a colourway, copy a row, give it a new
 * id and change its colours — nothing else needs editing.
 */
export type Version =
  | { id: string; look: "dataCube"; frames: 600; params: { core: string; accent: string; bg: string; glow: string } }
  | { id: string; look: "cloudMap"; frames: 300; params: { land: string; accent: string; floor: string; grid: string } }
  | { id: string; look: "chromePortal"; frames: 600; params: { metal: string; roughness: number; bg: string; env: string; bar: string } }
  | { id: string; look: "goldPodium"; frames: 600; params: { stage: string; stageDeep: string; metal: string; ray: string } }
  | { id: string; look: "softLight"; frames: 600; params: { edge: string; glow: string; streak: string } };

export const VERSIONS: Version[] = [
  { id: "DataCube-Blue", look: "dataCube", frames: 600, params: { core: "#5AE8FF", accent: "#5AE8FF", bg: "#030A2A", glow: "#0A4AB0" } },
  { id: "CloudMap-Story", look: "cloudMap", frames: 300, params: { land: "#2A4AAA", accent: "#5AE8FF", floor: "#040C26", grid: "#1A3A8A" } },
  { id: "ChromePortal-Silver", look: "chromePortal", frames: 600, params: { metal: "#F4F5F7", roughness: 0.08, bg: "#F2F2F4", env: "#FFFFFF", bar: "#5A5C62" } },
  { id: "ChromePortal-Gold", look: "chromePortal", frames: 600, params: { metal: "#E8C070", roughness: 0.1, bg: "#F8F0E0", env: "#FFF8EC", bar: "#6A5432" } },
  { id: "GoldRibbonPodium-RedGold", look: "goldPodium", frames: 600, params: { stage: "#B01A1A", stageDeep: "#4A0606", metal: "#E8C070", ray: "#FF5A44" } },
  { id: "GoldRibbonPodium-EmeraldGold", look: "goldPodium", frames: 600, params: { stage: "#0A6A4A", stageDeep: "#032A1E", metal: "#E8C070", ray: "#BFF5D8" } },
  { id: "SoftLight-Blue", look: "softLight", frames: 600, params: { edge: "#1A2A7A", glow: "#4A8ACA", streak: "#A8D0F0" } },
  { id: "SoftLight-Violet", look: "softLight", frames: 600, params: { edge: "#2A1A6A", glow: "#8A6ACA", streak: "#D0C0F0" } },
];

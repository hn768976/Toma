/**
 * One data row per version. To add a colourway, copy a row, give it a new id
 * and file name, and change the colours. Nothing else needs editing.
 */
export type LookId = "triangleRelief" | "isoCloudChip" | "aiBrainChip" | "circuitHorizon" | "neonPodium";

export interface VersionRow {
  /** Composition id (letters, digits, hyphens). */
  id: string;
  /** Output file stem. */
  file: string;
  look: LookId;
  params: Record<string, string | number>;
}

export const VERSIONS: VersionRow[] = [
  { id: "TriangleRelief-BlackGold", file: "TriangleRelief_BlackGold", look: "triangleRelief",
    params: { tile: "#0C0C0E", line: "#E8B860", keyTint: "#FFF4E0" } },
  { id: "TriangleRelief-NavySilver", file: "TriangleRelief_NavySilver", look: "triangleRelief",
    params: { tile: "#0A1428", line: "#D8E4F8", keyTint: "#E0ECFF" } },
  { id: "IsoCloudChip-BlueViolet", file: "IsoCloudChip_BlueViolet", look: "isoCloudChip",
    params: { boardA: "#2A3ADA", boardB: "#6A3AE8", cyan: "#5AF0FF", screen: "#4AFFA8", body: "#2E2290" } },
  { id: "AIBrainChip-GoldBlue", file: "AIBrainChip_GoldBlue", look: "aiBrainChip",
    params: { brain: "#FFB04A", city: "#3A8AFF", outer: "#4A8CFF", bg: "#12298A" } },
  { id: "AIBrainChip-CyanViolet", file: "AIBrainChip_CyanViolet", look: "aiBrainChip",
    params: { brain: "#5AF0FF", city: "#8A5AFF", outer: "#9A6AFF", bg: "#2C147A" } },
  { id: "CircuitHorizon-Blue", file: "CircuitHorizon_Blue", look: "circuitHorizon",
    params: { board: "#0E1014", light: "#4A9AFF", horizon: "#1E86E8" } },
  { id: "NeonPodium-BlueMagenta", file: "NeonPodium_BlueMagenta", look: "neonPodium",
    params: { neonA: "#3A6AFF", neonB: "#E83AE8", ambient: "#0A0618" } },
  { id: "NeonPodium-OrangeTeal", file: "NeonPodium_OrangeTeal", look: "neonPodium",
    params: { neonA: "#FF8A2A", neonB: "#2AE8D0", ambient: "#0A0A10" } },
];

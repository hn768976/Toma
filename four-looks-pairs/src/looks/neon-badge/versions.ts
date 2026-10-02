/**
 * One data row per badge. Add a row here (and nothing else) to get a new
 * composition: Root.tsx maps over this list.
 */
export type BadgeTop = { kind: "text"; text: string } | { kind: "icon"; icon: "dove" };

export type NeonBadgeVersion = {
  id: string;
  top: BadgeTop;
  line1: string;
  line2: string;
  strip: string;
  ring: string; // repeated around the inside edge
  neon: string;
  stripColor: string;
  stripText: string;
  background: string;
};

export const NEON_BADGE_VERSIONS: NeonBadgeVersion[] = [
  {
    id: "NeonBadge-MadeByHuman",
    top: { kind: "text", text: "100%" },
    line1: "MADE BY",
    line2: "HUMAN",
    strip: "NO AI USED",
    ring: "NO AI USED · ",
    neon: "#5FD8FF",
    stripColor: "#E8343C",
    stripText: "#1A0A12",
    background: "#0A1A5A",
  },
  {
    id: "NeonBadge-MakePeace",
    top: { kind: "icon", icon: "dove" },
    line1: "MAKE",
    line2: "PEACE",
    strip: "NOT WAR",
    ring: "PEACE · ",
    neon: "#5FD8FF",
    stripColor: "#E8343C",
    stripText: "#1A0A12",
    background: "#0A1A5A",
  },
];

/**
 * One data row per version. To add a colourway, add one row here — nothing else.
 * `look` picks the renderer; `colors` holds every colour that look uses.
 */
export type Version =
  | { id: string; look: "pulseRings"; colors: { ring: string } }
  | { id: string; look: "cyberNetwork"; colors: { bgTop: string; bgBottom: string; node: string; link: string; badge: string } }
  | { id: string; look: "particleSphere"; colors: { particles: string; glow: string; background: string } }
  | { id: string; look: "particleWaves"; colors: { particles: string; crests: string; deep: string; skyTop: string; skyBottom: string; light: string } }
  | { id: string; look: "dataCity"; colors: { dots: string; accent: string; skyHorizon: string; skyTop: string } };

export const VERSIONS: Version[] = [
  { id: "PulseRings-White", look: "pulseRings", colors: { ring: "#FFFFFF" } },
  {
    id: "CyberNetwork-Blue",
    look: "cyberNetwork",
    colors: { bgTop: "#0A3A7A", bgBottom: "#06204A", node: "#7FDFFF", link: "#4FB8F0", badge: "#5FE8FF" },
  },
  { id: "ParticleSphere-Blue", look: "particleSphere", colors: { particles: "#9FD0FF", glow: "#2A5AFF", background: "#020818" } },
  { id: "ParticleSphere-Gold", look: "particleSphere", colors: { particles: "#FFE0A0", glow: "#FF9A2A", background: "#100802" } },
  {
    id: "ParticleWaves-Blue",
    look: "particleWaves",
    colors: { particles: "#6F9FFF", crests: "#BFE0FF", deep: "#5A4BD8", skyTop: "#03050F", skyBottom: "#0B1430", light: "#7A9CFF" },
  },
  {
    id: "ParticleWaves-VioletPink",
    look: "particleWaves",
    colors: { particles: "#B07CFF", crests: "#FFB0E0", deep: "#C03AA8", skyTop: "#06030F", skyBottom: "#170B2C", light: "#C59CFF" },
  },
  {
    id: "DataCity-TealOrange",
    look: "dataCity",
    colors: { dots: "#7FE8F0", accent: "#FF7A4A", skyHorizon: "#0E3A5A", skyTop: "#061826" },
  },
  {
    id: "DataCity-GoldViolet",
    look: "dataCity",
    colors: { dots: "#FFD27A", accent: "#9F6CFF", skyHorizon: "#2A1A40", skyTop: "#0E0818" },
  },
];

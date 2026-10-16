import type { FibreVersion } from "./looks/fibre/FibreTunnel";
import type { GlassVersion } from "./looks/glass/GlassSpiral";
import type { RetroVersion } from "./looks/retro/RetroMountains";
import type { SmokeVersion } from "./looks/smoke/ParticleSmoke";

// One data row per version. To add a colourway, copy a row, give it a new id
// and colours, and register it in Root.tsx (see README).

export const RETRO_VERSIONS: RetroVersion[] = [
  {
    id: "RetroMountains-Sunset",
    sky: { top: "#2A0A5A", mid: "#5A2ADA", horizon: "#E83A8A", midElev: 13, topElev: 24 },
    stars: { count: 9000, brightness: 0.95, size: 0.8 },
    line: { color: "#F0C8FF", far: "#FF9ADA", farFrom: 10, farTo: 70, intensity: 1.6, coreWhite: 0.5 },
    halo: "#C23AF0",
    fill: { low: "#2A0A2A", high: "#4A1A4A", tone: "#5A0A30" },
    mountFade: [40, 190],
    glow: { color: "#FFD0F0", strength: 0.75, haze: 0.18, column: 1.3 },
    fog: "#C83A8C",
    bloomStrength: 0.8,
  },
  {
    id: "RetroMountains-Midnight",
    sky: { top: "#000000", mid: "#000000", horizon: "#000000", midElev: 9, topElev: 32 },
    stars: { count: 260, brightness: 0.16, size: 0.8 },
    line: { color: "#5A6AFF", far: "#1E8A9A", farFrom: 8, farTo: 40, intensity: 1.2, coreWhite: 0.7 },
    halo: "#5A5AFF",
    fill: { low: "#04041A", high: "#05051E", tone: "#020210" },
    mountFade: [14, 110],
    glow: { color: "#3AE8FF", strength: 0.28, haze: 0.0, column: 0.5 },
    fog: "#000006",
    bloomStrength: 0.75,
  },
];

export const FIBRE_VERSIONS: FibreVersion[] = [
  {
    id: "FibreTunnel-RedCyan",
    colorA: "#FF2A4A",
    colorB: "#3AE8FF",
    hazeA: "#9A1030",
    hazeB: "#1A1A5A",
    centre: "#0C0410",
    intensity: 0.8,
  },
  {
    id: "FibreTunnel-VioletGold",
    colorA: "#9A4AFF",
    colorB: "#FFC84A",
    hazeA: "#3A1250",
    hazeB: "#5A3208",
    centre: "#0A0408",
    intensity: 0.95,
  },
];

export const GLASS_VERSIONS: GlassVersion[] = [
  {
    id: "GlassSpiral-Blue",
    tint: "#1A4AFF",
    edge: "#3AC8FF",
    strips: ["#D8ECFF", "#7AD8FF"],
    iridescence: [280, 520],
    sheen: "#FFB8E8",
    bodyGlow: 0.016,
    edgeGlow: 0.9,
  },
  {
    id: "GlassSpiral-Amber",
    tint: "#E8901A",
    edge: "#FFD27A",
    strips: ["#FFF0D8", "#FFC27A"],
    iridescence: [420, 700],
    sheen: "#FFB098",
    bodyGlow: 0.016,
    edgeGlow: 0.85,
  },
];

// White-on-black overlay: tint it in the edit with Screen / Add.
export const SMOKE_VERSIONS: SmokeVersion[] = [
  {
    id: "ParticleSmoke-White",
    grains: 250000,
    color: [1, 1, 1],
    gain: 8.0,
    threshold: -0.12,
    softness: 0.1,
    haze: 0.35,
  },
];

/**
 * One data row per version. To add a colourway, copy a row, give it a new id and
 * new colours; Root.tsx registers a composition for every row automatically.
 */
import type { WhirlVariant } from "./looks/whirl/CosmicWhirl";

export const WHIRL_VARIANTS: WhirlVariant[] = [
  {
    id: "CosmicWhirl_Blue",
    core: "#C8E8FF",
    coreGlow: "#2A6AE8",
    matter: "#1E4290",
    highlight: "#94BCF4",
    deep: "#040A22",
    sparkleA: "#FFC870",
    sparkleB: "#FFFFFF",
    warm: "#B08458",
  },
];

import type { GlassKnotVariant } from "./looks/glassknot/GlassKnot";

const KNOT_STARS = ["#FF3A2A", "#FF4A3A", "#FF5A2A", "#FFFFFF", "#FFFFFF", "#7AA0FF", "#FFA040", "#FFB060"];

export const GLASSKNOT_VARIANTS: GlassKnotVariant[] = [
  {
    id: "GlassKnot_Galaxy",
    background: "galaxy",
    bgBase: "#1C1618",
    bgA: "#5E6E8E",
    bgB: "#3A4A6A",
    bgCore: "#FFF0D8",
    inner: "#5060E0",
    starColors: KNOT_STARS,
  },
  {
    id: "GlassKnot_Nebula",
    background: "nebula",
    bgBase: "#07040E",
    bgA: "#6A2AA8",
    bgB: "#E86AA8",
    bgCore: "#FFD0E8",
    inner: "#8A70E0",
    starColors: KNOT_STARS,
  },
];

import type { NerveVariant } from "./looks/nerve/NerveFibres";

export const NERVE_VARIANTS: NerveVariant[] = [
  {
    id: "NerveFibres_Red",
    fibre: "#C81A2A",
    fibreSheen: "#FF8A90",
    web: "#8A4A4A",
    haze: "#B07A7A",
    hazeGlow: "#F0C8C0",
    tip: "#FFD0DA",
    bead: "#F49AAE",
    speck: "#D8D4D4",
  },
  {
    id: "NerveFibres_Blue",
    fibre: "#1A4AC8",
    fibreSheen: "#8AB0FF",
    web: "#4A5A8A",
    haze: "#5A6A9A",
    hazeGlow: "#C0D0F0",
    tip: "#D0F4FF",
    bead: "#C8DCF8",
    speck: "#E4ECF4",
  },
];

import type { BokehVariant } from "./looks/bokeh/BokehBurst";

export const BOKEH_VARIANTS: BokehVariant[] = [
  {
    id: "BokehBurst_Blue",
    background: "#0A1A5A",
    hazeA: "#2A6AE8",
    hazeB: "#5A3AC8",
    streakColors: ["#3A9AFF", "#3AB0FF", "#3AC0FF", "#4AD0FF", "#5AE0FF", "#3A8AFF", "#9AECFF"],
    sparkColors: ["#FFFFFF", "#FFE0F4", "#FF8AD8", "#FF6AC8", "#E8C8FF", "#A87AFF"],
    discColors: ["#2AC8F0", "#4AD8FF", "#2AB4E8", "#7AE8FF"],
  },
];

import type { SmokeOrbVariant } from "./looks/smokeorb/SmokeOrb";

export const SMOKEORB_VARIANTS: SmokeOrbVariant[] = [
  { id: "SmokeOrb_PinkGold", core: "#FFF8FC", rim: "#E8A0F0", halo: "#F0B8F0", smoke: "#E8B86A", smokeHighlight: "#F4E4CC" },
  { id: "SmokeOrb_CyanBlue", core: "#F4FCFF", rim: "#8AE8FF", halo: "#A8ECFF", smoke: "#4A8AFF", smokeHighlight: "#FFFFFF" },
];

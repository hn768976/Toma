import { ORANGE } from "./settings";
import { scratchLook } from "./looks/scratch";
import { photocopyLook } from "./looks/photocopy";
import { charcoalLook } from "./looks/charcoal";
import { brushFrameLook } from "./looks/brushframe";
import type { LookDef } from "./looks/types";

export type Variant = {
  id: string;
  look: LookDef;
  /** 0 = black background (ink is light), 1 = white background (ink is dark), 2 = coloured background (ink multiplies). */
  mode: 0 | 1 | 2;
  /** How dark/light full ink gets (1 = pure white / pure black). */
  inkScale: number;
  bg: string;
  /** Colour the marks multiply towards on a coloured background. */
  mark: string;
  blend: "Screen" | "Multiply" | "Normal";
  stainStyle: "scuff" | "toner" | "smudge";
};

// #5A5A5A at 70% on white / #C8C8C8 on black: a single dense brush stroke has ink 0.7 in the card.
const GREY_5A = 1 - 0x5a / 255;
const GREY_C8 = 0xc8 / 255;
// charcoal: darkest mark #1A1A1A
const GREY_1A = 1 - 0x1a / 255;

export const VARIANTS: Variant[] = [
  { id: "ScratchGrunge_Black", look: scratchLook, mode: 0, inkScale: 1, bg: "#000000", mark: "#ffffff", blend: "Screen", stainStyle: "scuff" },
  { id: "ScratchGrunge_White", look: scratchLook, mode: 1, inkScale: 1, bg: "#ffffff", mark: "#000000", blend: "Multiply", stainStyle: "scuff" },
  { id: "PhotocopyGrunge_White", look: photocopyLook, mode: 1, inkScale: 1, bg: "#ffffff", mark: "#000000", blend: "Multiply", stainStyle: "toner" },
  { id: "PhotocopyGrunge_Black", look: photocopyLook, mode: 0, inkScale: 1, bg: "#000000", mark: "#ffffff", blend: "Screen", stainStyle: "toner" },
  { id: "CharcoalGrunge_White", look: charcoalLook, mode: 1, inkScale: GREY_1A, bg: "#ffffff", mark: "#000000", blend: "Multiply", stainStyle: "smudge" },
  { id: "CharcoalGrunge_Orange", look: charcoalLook, mode: 2, inkScale: 1, bg: ORANGE, mark: "#1c120b", blend: "Normal", stainStyle: "smudge" },
  { id: "BrushFrame_White", look: brushFrameLook, mode: 1, inkScale: GREY_5A, bg: "#ffffff", mark: "#000000", blend: "Multiply", stainStyle: "smudge" },
  { id: "BrushFrame_Black", look: brushFrameLook, mode: 0, inkScale: GREY_C8, bg: "#000000", mark: "#ffffff", blend: "Screen", stainStyle: "smudge" },
];

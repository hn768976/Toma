import type { DrawFn } from "../lib/CanvasHost";
import { drawCrayonEyesAmber, drawCrayonEyesBlue } from "./crayonEyes";
import { drawEyesCrowdDark, drawPaleEyesDark } from "./paleEyes";
import { drawUnknownCycle, drawUnknownLineup } from "./figures";
import { drawScribbleEyesBlue, drawScribbleEyesOrange } from "./scribbleEyes";

export const LOOKS: Record<string, { draw: DrawFn; background: string }> = {
  ScribbleEyes_Blue: { draw: drawScribbleEyesBlue, background: "#000000" },
  ScribbleEyes_OrangeOnWhite: { draw: drawScribbleEyesOrange, background: "#FFFFFF" },
  CrayonEyes_Blue: { draw: drawCrayonEyesBlue, background: "#000000" },
  CrayonEyes_Amber: { draw: drawCrayonEyesAmber, background: "#000000" },
  PaleEyes_Dark: { draw: drawPaleEyesDark, background: "#000000" },
  EyesCrowd_Dark: { draw: drawEyesCrowdDark, background: "#000000" },
  UnknownPerson_Cycle: { draw: drawUnknownCycle, background: "#000000" },
  UnknownPerson_Lineup: { draw: drawUnknownLineup, background: "#000000" },
};

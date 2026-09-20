import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import { z } from "zod";
import { BASE_HEIGHT, BASE_WIDTH } from "./constants";
import { ThreeStage } from "./ThreeStage";
import { PixiLayer } from "./PixiLayer";
import { createCodePlateStage } from "./v1-code-city";
import {
  BLUE_OPTICS,
  GREEN_OPTICS,
  createCodePlateOptics,
} from "./v1-optics";

// The code-plate composition, shared by three variants:
//   V1  cards + blue grade + the default syntax palette
//   V4  no cards, a deeper blue grade
//   V5  cards + green syntax
//
// One component rather than three copies: the variants differ only in
// data, and a copy would drift the moment any of them is retouched.

const GRADES = {
  blue: "radial-gradient(120% 90% at 50% 45%, #0d2438 0%, #071729 42%, #03080f 100%)",
  // V4: the same hue held further down, for a heavier, quieter plate.
  deepBlue:
    "radial-gradient(120% 90% at 50% 45%, #071827 0%, #040f1c 44%, #01040a 100%)",
  // V5: green syntax needs a base that is not saturated blue. The plate
  // is additive over this gradient, so navy behind green composites to
  // teal no matter how bright the syntax palette is pushed.
  green:
    "radial-gradient(120% 90% at 50% 45%, #07231a 0%, #04160f 44%, #010806 100%)",
} as const;

const VIGNETTES = {
  blue: "radial-gradient(118% 88% at 50% 48%, rgba(0,0,0,0) 38%, rgba(2,6,12,0.55) 78%, rgba(1,3,7,0.86) 100%)",
  deepBlue:
    "radial-gradient(112% 84% at 50% 48%, rgba(0,0,0,0) 32%, rgba(1,4,9,0.62) 74%, rgba(0,2,5,0.92) 100%)",
  green:
    "radial-gradient(118% 88% at 50% 48%, rgba(0,0,0,0) 38%, rgba(2,10,7,0.55) 78%, rgba(0,4,3,0.88) 100%)",
} as const;

export const codeCitySchema = z.object({
  /** 1 renders 1920x1080, 2 renders 3840x2160. Everything sized in
   * pixels — textures, blur radii, grain — scales with it, so the two
   * outputs are the same picture at two resolutions. */
  resolutionScale: z.union([z.literal(1), z.literal(2)]),
  /** V4 turns the rising "AI" cards off. */
  showCards: z.boolean(),
  /** V5 uses the green syntax palette. */
  codeTheme: z.enum(["vivid", "green"]),
  grade: z.enum(["blue", "deepBlue", "green"]),
});

export type CodeCityProps = z.infer<typeof codeCitySchema>;

export const codeCityDefaults: CodeCityProps = {
  resolutionScale: 1,
  showCards: true,
  codeTheme: "vivid",
  grade: "blue",
};

export const CodeCity: React.FC<CodeCityProps> = ({
  resolutionScale,
  showCards,
  codeTheme,
  grade,
}) => {
  const width = BASE_WIDTH * resolutionScale;
  const height = BASE_HEIGHT * resolutionScale;

  const createStage = useMemo(
    () => createCodePlateStage({ showCards, codeTheme }),
    [showCards, codeTheme],
  );
  const createScene = useMemo(
    () =>
      createCodePlateOptics(codeTheme === "green" ? GREEN_OPTICS : BLUE_OPTICS),
    [codeTheme],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#03070d" }}>
      <AbsoluteFill style={{ background: GRADES[grade] }} />
      <ThreeStage
        label="code-plate"
        width={width}
        height={height}
        scale={resolutionScale}
        createStage={createStage}
      />
      <PixiLayer
        label="code-plate-optics"
        width={width}
        height={height}
        scale={resolutionScale}
        createScene={createScene}
        style={{ mixBlendMode: "screen" }}
      />
      {/* Vignette and highlight roll-off, kept in CSS so it composites
          with normal alpha over everything additive. */}
      <AbsoluteFill
        style={{ background: VIGNETTES[grade], pointerEvents: "none" }}
      />
    </AbsoluteFill>
  );
};

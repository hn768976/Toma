import React from "react";
import { Still } from "remotion";
import { Chalkboard } from "../clips/Chalkboard";
import { HatchedMap } from "../clips/HatchedMap";
import { InkReveal } from "../clips/InkReveal";
import { SketchyDrift } from "../clips/SketchyDrift";
import { WatercolourBloom } from "../clips/WatercolourBloom";
import {
  BLOOM_COLOURWAYS,
  BOARD_COLOURWAYS,
  INK_COLOURWAYS,
  MAP_COLOURWAYS,
  PENCIL_COLOURWAYS,
  SKETCH_COLOURWAYS,
  STRIPE_COLOURWAYS,
  findRow,
} from "../palettes";
import { PencilFrame } from "./PencilFrame";
import { Stripes } from "./Stripes";

export const STILL_W = 6000;
export const STILL_H = 3375;

// 8 still designs x 2 colourways, reusing the clip code at 6000x3375.
// Each colourway name refers to a row in palettes.ts.
type StillDef = { key: string; colourways: string[]; render: (colourway: string) => React.ReactElement };
export const STILL_DEFS: StillDef[] = [
  {
    key: "S1-CornerWashes",
    colourways: ["Pastel", "Indigo"],
    render: (c) => <InkReveal colourway={findRow(INK_COLOURWAYS, c)} variant="corner" still />,
  },
  {
    key: "S2-BloomField",
    colourways: ["Sunset", "MintLavender"],
    render: (c) => <WatercolourBloom colourway={findRow(BLOOM_COLOURWAYS, c)} seedId={`BloomField_${c}`} still density={1.45} />,
  },
  {
    key: "S3-SplatterFrame",
    colourways: ["Sepia", "Black"],
    render: (c) => <InkReveal colourway={findRow(INK_COLOURWAYS, c)} variant="splatter" still />,
  },
  {
    key: "S4-PencilBorder",
    colourways: ["Graphite", "Sepia"],
    render: (c) => <PencilFrame colourway={findRow(PENCIL_COLOURWAYS, c)} />,
  },
  {
    key: "S5-Stripes",
    colourways: ["RainbowPastel", "EarthTones"],
    render: (c) => <Stripes colourway={findRow(STRIPE_COLOURWAYS, c)} />,
  },
  {
    key: "S6-Confetti",
    colourways: ["KidsBright", "Muted"],
    render: (c) => <SketchyDrift colourway={findRow(SKETCH_COLOURWAYS, c)} seedId={`Confetti_${c}`} still countScale={1.5} />,
  },
  {
    key: "S7-WorldMap",
    colourways: ["Antique", "BlueInk"],
    render: (c) => <HatchedMap colourway={findRow(MAP_COLOURWAYS, c)} still />,
  },
  {
    key: "S8-ChalkDoodles",
    colourways: ["Green", "Black"],
    render: (c) => <Chalkboard colourway={findRow(BOARD_COLOURWAYS, c)} still />,
  },
];

export const StillComps: React.FC = () => (
  <>
    {STILL_DEFS.flatMap((d) =>
      d.colourways.map((c) => (
        <Still key={`${d.key}-${c}`} id={`${d.key}-${c}`} width={STILL_W} height={STILL_H} component={() => d.render(c)} />
      )),
    )}
  </>
);

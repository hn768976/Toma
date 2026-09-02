import React from "react";
import { SvgSilhouetteField } from "../../lib/SvgSilhouetteField";
import type { SvgSpriteSet } from "../../lib/useSvgSprites";
import { BANDS } from "../placement";
import type { BandName } from "../placement";
import { DURATION_IN_FRAMES } from "../constants";
import { DRIFT } from "../drift";
import { treeTintAt } from "../variants";
import type { Palette } from "../variants";

/**
 * One depth band of trees.
 *
 * All of the machinery — the single blur per band, the seeded flip / scale /
 * shear / rotation / squash per instance, the golden-ratio scale spread that
 * keeps neighbours from reading as mirrored stamps, the irregular ground ridge
 * — lives in the library's <SvgSilhouetteField>. This component only binds the
 * forest's band table and palette to it.
 */
export const TreeField: React.FC<{
  band: BandName;
  sprites: SvgSpriteSet;
  palette: Palette;
  seedPrefix: string;
}> = ({ band, sprites, palette, seedPrefix }) => (
  <SvgSilhouetteField
    sprites={sprites}
    band={BANDS[band]}
    seed={`${seedPrefix}-${band}`}
    driftAmount={DRIFT[band]}
    loopFrames={DURATION_IN_FRAMES}
    ridgeSeed={`${seedPrefix}-ridge-${band}`}
    ridgeColor={treeTintAt(palette, BANDS[band].ridgeTint)}
  />
);

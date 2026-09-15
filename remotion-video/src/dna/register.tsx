import React from "react";
import { Composition } from "remotion";
import {
  FPS,
  HD_HEIGHT,
  HD_WIDTH,
  UHD_HEIGHT,
  UHD_WIDTH,
  VERSIONS,
} from "./constants";
import { V01FrostedMolecules } from "./versions/V01FrostedMolecules";
import { V02NavySparkle } from "./versions/V02NavySparkle";
import { V03VioletCascade } from "./versions/V03VioletCascade";
import { V04ParticleStrand } from "./versions/V04ParticleStrand";
import { V05GenomeHud } from "./versions/V05GenomeHud";
import { V06ClinicalLight } from "./versions/V06ClinicalLight";
import { V07DualDust } from "./versions/V07DualDust";
import { V08NeonWire } from "./versions/V08NeonWire";
import { V09CeramicStudio } from "./versions/V09CeramicStudio";
import { V10DeepFog } from "./versions/V10DeepFog";
import { V11CrimsonNetwork } from "./versions/V11CrimsonNetwork";
import { V12GlassRimlight } from "./versions/V12GlassRimlight";
import { V13AzureCopySpace } from "./versions/V13AzureCopySpace";

/**
 * Maps each spec id to its scene component. Every version is registered twice:
 * `<id>` renders the 1080p master, `<id>4K` the 3840x2160 composition.
 */
const COMPONENTS: Record<string, React.FC> = {
  V01FrostedMolecules,
  V02NavySparkle,
  V03VioletCascade,
  V04ParticleStrand,
  V05GenomeHud,
  V06ClinicalLight,
  V07DualDust,
  V08NeonWire,
  V09CeramicStudio,
  V10DeepFog,
  V11CrimsonNetwork,
  V12GlassRimlight,
  V13AzureCopySpace,
};

export const DnaCompositions: React.FC = () => {
  return (
    <>
      {VERSIONS.flatMap((spec) => {
        const Component = COMPONENTS[spec.id];
        if (!Component) return [];
        return [
          <Composition
            key={spec.id}
            id={spec.id}
            component={Component}
            durationInFrames={spec.durationInFrames}
            fps={FPS}
            width={HD_WIDTH}
            height={HD_HEIGHT}
          />,
          <Composition
            key={`${spec.id}4K`}
            id={`${spec.id}4K`}
            component={Component}
            durationInFrames={spec.durationInFrames}
            fps={FPS}
            width={UHD_WIDTH}
            height={UHD_HEIGHT}
          />,
        ];
      })}
    </>
  );
};

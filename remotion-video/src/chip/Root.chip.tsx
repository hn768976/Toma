import { Composition } from "remotion";
import { ChipScene, chipSceneSchema, type ChipSceneProps } from "./ChipScene";
import { FPS, HD, UHD, VARIANTS, type VariantId } from "./config";

const IDS: VariantId[] = ["v1", "v2", "v3"];

const NAMES: Record<VariantId, string> = {
  v1: "EnergyPulse",
  v2: "PorcelainLab",
  v3: "SystemOnline",
};

/**
 * Six compositions: each variant at 1080p (the delivered master) and at 4K
 * (the same scene with denser textures, for re-rendering at full resolution).
 */
export const ChipCompositions: React.FC = () => (
  <>
    {IDS.map((id) => {
      const cfg = VARIANTS[id];
      const common = {
        component: ChipScene,
        durationInFrames: cfg.durationInFrames,
        fps: FPS,
        schema: chipSceneSchema,
      } as const;
      return (
        <>
          <Composition
            key={`${id}-hd`}
            id={`Chip-${id.toUpperCase()}-${NAMES[id]}-1080p`}
            {...common}
            width={HD.width}
            height={HD.height}
            defaultProps={
              { variant: id, tier: "auto", detail: 1 } satisfies ChipSceneProps
            }
          />
          <Composition
            key={`${id}-4k`}
            id={`Chip-${id.toUpperCase()}-${NAMES[id]}-4K`}
            {...common}
            width={UHD.width}
            height={UHD.height}
            defaultProps={
              { variant: id, tier: "auto", detail: 2 } satisfies ChipSceneProps
            }
          />
        </>
      );
    })}
  </>
);

import type { LookBuilder, StageOptions } from "../lib/stage";
import { buildFlareBurst } from "./FlareBurst";
import { buildLightLeak } from "./LightLeak";
import { buildLightSweep } from "./LightSweep";
import { buildPrismLight } from "./PrismLight";
import { buildRedBokeh } from "./RedBokeh";

export interface LookDef {
  build: LookBuilder<never>;
  durationInFrames: number;
  options: StageOptions;
}

const b = <P,>(f: LookBuilder<P>) => f as unknown as LookBuilder<never>;

export const LOOKS: Record<string, LookDef> = {
  lightSweep: { build: b(buildLightSweep), durationInFrames: 240, options: { overlay: true } },
  flareBurst: { build: b(buildFlareBurst), durationInFrames: 180, options: { overlay: true } },
  lightLeak: { build: b(buildLightLeak), durationInFrames: 360, options: { overlay: true } },
  prismLight: { build: b(buildPrismLight), durationInFrames: 600, options: { overlay: false, loopFrames: 600 } },
  redBokeh: { build: b(buildRedBokeh), durationInFrames: 600, options: { overlay: false, loopFrames: 600 } },
};

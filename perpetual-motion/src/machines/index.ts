import type { MachineDef } from "../lib/Stage.tsx";
import { overbalanced } from "./OverbalancedWheel.tsx";
import { rollingball } from "./RollingBallWheel.tsx";
import { magnet } from "./MagnetRamp.tsx";
import { flask } from "./SelfFlowingFlask.tsx";
import { watermill } from "./WaterScrewMill.tsx";

// Remotion composition ids may not contain "_", so the ids use "-"; the
// rendered files keep the underscore names (see scripts/render-previews.sh).
export const MACHINES: Record<string, MachineDef> = {
  "PerpetualMotion-OverbalancedWheel": overbalanced,
  "PerpetualMotion-WaterScrewMill": watermill,
  "PerpetualMotion-SelfFlowingFlask": flask,
  "PerpetualMotion-MagnetRamp": magnet,
  "PerpetualMotion-RollingBallWheel": rollingball,
};

import type { VariantConfig } from "../variants";
import type { AlertEvent, GlitchSlice } from "./schedule";
import type { Signals } from "./signals";
import type { Ctx } from "./canvas";

/**
 * The bundle every drawing component receives. It is derived once per frame in
 * <LabDashboard> and is a pure function of the frame number, so a component
 * never needs to look at a clock or hold state of its own.
 */
export type FrameState = {
  ctx: Ctx;
  cfg: VariantConfig;
  /** Raw frame, already wrapped to 0..599. */
  frame: number;
  /** 0 -> 1 across the piece; the one value all degradation is driven from. */
  instability: number;
  signals: Signals;
  alert: AlertEvent | null;
  glitch: readonly GlitchSlice[];
  /** True once the data tables have permanently frozen. */
  tablesFrozen: boolean;
  /** Frame the tables froze at, so a frozen table keeps its last values. */
  tableFreezeFrame: number;
  /** 0 = fully lit, 1 = matrix almost entirely dark. */
  matrixDarkness: number;
};

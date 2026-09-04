import type { ResolvedScene } from "./lib/scene";
import { violetTheme, warmTheme, type Theme } from "./lib/theme";
import { warmScene } from "./scenes/warm";
import { violetScene } from "./scenes/violet";

export type VariantId = "warm" | "violet";

/**
 * Compositions take a variant *name*, not the theme and scene objects.
 *
 * Remotion serialises defaultProps to JSON so the Studio can edit them
 * and the renderer can hand them to a worker, and a resolved scene is
 * full of Maps and measurement closures that would not survive the trip.
 * Passing a string and looking the scene up here keeps the props
 * serialisable and the geometry built exactly once per module load.
 */
export const VARIANTS: Record<VariantId, { theme: Theme; scene: ResolvedScene }> = {
  warm: { theme: warmTheme, scene: warmScene },
  violet: { theme: violetTheme, scene: violetScene },
};

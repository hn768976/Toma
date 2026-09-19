import { z } from "zod";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { DataFieldCanvas } from "./DataFieldCanvas";
import { AlertBanner } from "./AlertBanner";
import { ScreenOverlay } from "./ScreenOverlay";
import { glitchAt } from "./glitch";
import { KICK_GAIN } from "./constants";
import "./load-alert-font";

export const systemAlertSchema = z.object({
  /** The headline on the red plate. Kept as a prop so the second cut is a
   *  prop change rather than a forked component. */
  headline: z.string(),
  /**
   * Number of binary-digit columns across the frame. Measured off the
   * reference, whose digits run ~165 to a frame width. The cell size is a
   * fraction of the frame rather than a pixel size, so this stays the same
   * for the 1080p and 4K compositions and both produce the same picture —
   * 4K simply resolves each digit properly.
   */
  columns: z.number().min(40).max(600),
  /**
   * Softness on the headline, as a fraction of frame height (0 = crisp).
   * Expressed as a fraction rather than a pixel radius so the 1080p and 4K
   * compositions land on the same apparent focus.
   */
  textBlurFrac: z.number().min(0).max(0.01),
});

export type SystemAlertProps = z.infer<typeof systemAlertSchema>;

export const systemAlertDefaults: SystemAlertProps = {
  headline: "SYSTEM HACKED",
  columns: 165,
  textBlurFrac: 0.0016,
};

export const SystemAlert: React.FC<SystemAlertProps> = ({
  headline,
  columns,
  textBlurFrac,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const g = glitchAt(frame);

  // A whole-frame horizontal kick on the heaviest frames, so that background
  // and banner lurch together rather than the banner sliding over a fixed
  // background.
  //
  // The kick is handed to the two layers separately rather than applied to a
  // wrapper around both. Translating the wrapper drags the background off its
  // own edge and exposes the black underneath — measured as a 15-25px dead
  // bar down one side of every heavy glitch frame. The banner is a small
  // central element and can be moved freely; only the full-bleed background
  // needs to be oversized enough to cover its own displacement, which it
  // handles internally.
  const kickPx = g.intensity > 0.7 ? g.jump * KICK_GAIN * width : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <DataFieldCanvas columns={columns} kickPx={kickPx} />
      <AlertBanner headline={headline} kickPx={kickPx} textBlurFrac={textBlurFrac} />
      <ScreenOverlay />
    </AbsoluteFill>
  );
};

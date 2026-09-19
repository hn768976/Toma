import { z } from "zod";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { DataFieldCanvas } from "./DataFieldCanvas";
import { AlertBanner } from "./AlertBanner";
import { ScreenOverlay } from "./ScreenOverlay";
import { glitchAt } from "./glitch";
import "./load-alert-font";

export const systemAlertSchema = z.object({
  /** The headline on the red plate. Kept as a prop so the second cut is a
   *  prop change rather than a forked component. */
  headline: z.string(),
  /**
   * Base mosaic column count. The cell size is a fraction of the frame, not a
   * pixel size, so this stays the same for the 1080p and 4K compositions and
   * both produce the same picture.
   */
  columns: z.number().min(40).max(600),
});

export type SystemAlertProps = z.infer<typeof systemAlertSchema>;

export const systemAlertDefaults: SystemAlertProps = {
  headline: "SYSTEM HACKED",
  columns: 280,
};

export const SystemAlert: React.FC<SystemAlertProps> = ({ headline, columns }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const g = glitchAt(frame);

  // A whole-frame horizontal kick on the heaviest frames, applied once to the
  // composite so background and banner move together.
  const kick = g.intensity > 0.7 ? (g.jump * 6) * width : 0;

  return (
    <AbsoluteFill style={{ backgroundColor: "#000000", overflow: "hidden" }}>
      <AbsoluteFill style={{ transform: `translateX(${kick.toFixed(2)}px)` }}>
        <DataFieldCanvas columns={columns} />
        <AlertBanner headline={headline} />
      </AbsoluteFill>
      <ScreenOverlay />
    </AbsoluteFill>
  );
};

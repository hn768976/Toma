import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import { BASE_WIDTH } from "./constants";
import { Atmosphere, Vignette } from "./layers/Atmosphere";
import { Dashes } from "./layers/Dashes";
import { Nodes } from "./layers/Nodes";
import { Readouts } from "./layers/Readouts";
import { cameraAt } from "./projection";
import { THEMES } from "./theme";

export const dataGridSchema = z.object({
  theme: z.enum(["blue", "green"]),
});

export type DataGridProps = z.infer<typeof dataGridSchema>;

export const dataGridBlueDefaults: DataGridProps = { theme: "blue" };
export const dataGridGreenDefaults: DataGridProps = { theme: "green" };

/**
 * A 3D data field: a volume of glowing nodes, numeric readouts and data
 * dashes that the camera flies forward through. Depth is real — near
 * elements sweep past fast and large while distant ones barely move, and
 * aerial haze sinks the far ones back into the ground.
 *
 * Resolution independence: every size in this module is authored against
 * a 1920x1080 frame and multiplied by `s`, derived from the composition
 * width. The 4K composition is therefore a true 2x render — text and
 * dots are rasterised at 4K, not scaled up from 1080p.
 *
 * The camera crosses the depth slab a whole number of times and every
 * oscillation runs a whole number of periods over the clip, so frame 600
 * matches frame 0 and the export loops seamlessly.
 */
export const DataGridField: React.FC<DataGridProps> = ({ theme: themeName }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const s = width / BASE_WIDTH;

  const theme = THEMES[themeName];
  const camera = cameraAt(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bgOuter, overflow: "hidden" }}>
      <Atmosphere theme={theme} frame={frame} s={s} />
      <Dashes theme={theme} camera={camera} frame={frame} s={s} />
      <Readouts theme={theme} camera={camera} frame={frame} s={s} />
      <Nodes theme={theme} camera={camera} frame={frame} s={s} />
      <Vignette theme={theme} s={s} />
    </AbsoluteFill>
  );
};

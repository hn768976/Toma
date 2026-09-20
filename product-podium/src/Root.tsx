/**
 * All eight compositions, registered straight from the data table.
 *
 * Adding a look or a geometry variant means adding a row in
 * `src/podium/looks.ts` — nothing in this file changes.
 */
import { Composition } from "remotion";
import { PodiumStage } from "./podium/PodiumStage";
import { STAGES } from "./podium/looks";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./podium/types";

export const RemotionRoot: React.FC = () => (
  <>
    {STAGES.map((stage) => (
      <Composition
        key={stage.id}
        id={stage.id}
        component={PodiumStage}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ config: stage }}
      />
    ))}
  </>
);

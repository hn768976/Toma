import { Composition } from "remotion";
import { GrungeOverlay, type GrungeProps } from "./GrungeOverlay";
import { FPS, HEIGHT, LOOP_FRAMES, WIDTH } from "./settings";
import { VARIANTS } from "./variants";

export const RemotionRoot: React.FC = () => (
  <>
    {VARIANTS.map((v) => (
      <Composition
        key={v.id}
        // Remotion ids cannot contain "_": ScratchGrunge_Black is registered as ScratchGrunge-Black
        id={v.id.replace("_", "-")}
        component={GrungeOverlay}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: v.id, loopCheck: false } satisfies GrungeProps}
        // loopCheck: one extra frame (601) so frame 600 can be compared with frame 0
        calculateMetadata={({ props }) => ({ durationInFrames: props.loopCheck ? LOOP_FRAMES + 1 : LOOP_FRAMES })}
      />
    ))}
  </>
);

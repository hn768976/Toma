import { Composition } from "remotion";
import { LightScene } from "./LightScene";
import { DESIGN_H, DESIGN_W, FPS, LOOP } from "./kit/loop";
import { VARIANTS } from "./variants";

export const RemotionRoot: React.FC = () => (
  <>
    {VARIANTS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={LightScene}
        durationInFrames={LOOP}
        fps={FPS}
        width={DESIGN_W}
        height={DESIGN_H}
        defaultProps={{ variantId: v.id, loopCheck: false }}
        // Loop check only: --props='{"loopCheck":true}' makes the composition 601 frames
        // so frame 600 can be rendered and compared with frame 0.
        calculateMetadata={({ props }) => ({ durationInFrames: props.loopCheck ? LOOP + 1 : LOOP })}
      />
    ))}
  </>
);

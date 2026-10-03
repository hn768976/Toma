import { Composition } from "remotion";
import { DURATION, FPS } from "./engine/data";
import { compositionId, VERSIONS } from "./engine/versions";
import { VIEW_H, VIEW_W } from "./render/camera";
import { TerminalShot } from "./TerminalShot";

// One composition per row in engine/versions.ts, all 3840x2160 @ 30 fps.
// Remotion ids may not contain "_", so TradingTerminal_Bear is registered as
// TradingTerminal-Bear (output files keep the underscore name).
export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={compositionId(v.id)}
        component={TerminalShot}
        durationInFrames={DURATION}
        fps={FPS}
        width={VIEW_W}
        height={VIEW_H}
        defaultProps={{ versionId: v.id }}
      />
    ))}
  </>
);

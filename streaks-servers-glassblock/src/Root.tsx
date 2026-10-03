import React from "react";
import { Composition, Folder, getInputProps } from "remotion";
import { GLASS_COLORWAYS, HORIZON_COLORWAYS, SERVER_COLORWAYS } from "./colorways";
import { FPS, HEIGHT, LOOP, WIDTH } from "./common/constants";
import { GlassBlock, HorizonStreaks, ServerBokeh } from "./Looks";

// `--props='{"loopTest":true}'` makes every composition 601 frames so frame 600
// can be rendered and compared with frame 0 (seamless-loop check).
// Motion is driven by `frame % 600`, independent of the composition length.
const loopTest = (getInputProps() as { loopTest?: boolean }).loopTest === true;
const common = { fps: FPS, width: WIDTH, height: HEIGHT, durationInFrames: loopTest ? LOOP + 1 : LOOP };

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="HorizonLightStreaks">
      {HORIZON_COLORWAYS.map((cw) => (
        <Composition
          key={cw.id}
          id={cw.id}
          component={HorizonStreaks}
          defaultProps={{ colorway: cw }}
          {...common}
        />
      ))}
    </Folder>
    <Folder name="DefocusedServerRack">
      {SERVER_COLORWAYS.map((cw) => (
        <Composition
          key={cw.id}
          id={cw.id}
          component={ServerBokeh}
          defaultProps={{ colorway: cw }}
          {...common}
        />
      ))}
    </Folder>
    <Folder name="GlassBlockGradient">
      {GLASS_COLORWAYS.map((cw) => (
        <Composition
          key={cw.id}
          id={cw.id}
          component={GlassBlock}
          defaultProps={{ colorway: cw }}
          {...common}
        />
      ))}
    </Folder>
  </>
);

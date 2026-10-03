import { Composition } from "remotion";
import { ACRONYMS } from "./acronyms";
import { FPS, HEIGHT, LOOP, WIDTH } from "./hud/constants";
import { HudAcronym, HudAcronymProps } from "./hud/HudAcronym";

/** One composition per data row: HudAcronym-<id> (Remotion ids cannot contain "_"). */
export const RemotionRoot: React.FC = () => (
  <>
    {ACRONYMS.map((row) => (
      <Composition
        key={row.id}
        id={`HudAcronym-${row.id}`}
        component={HudAcronym}
        durationInFrames={LOOP}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ text: row.text, loopCheck: false }}
        // `--props='{"loopCheck":true}'` adds frame 600 to verify the seamless loop.
        calculateMetadata={({ props }: { props: HudAcronymProps }) => ({
          durationInFrames: props.loopCheck ? LOOP + 1 : LOOP,
        })}
      />
    ))}
  </>
);

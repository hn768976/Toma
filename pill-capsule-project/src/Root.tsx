import { Composition } from "remotion";
import { Smoke } from "./comps/Smoke";
import { SinglePillComp } from "./comps/SinglePill";
import { FallingPillsComp } from "./comps/FallingPills";
import { FALLING_ROWS, FPS, HEIGHT, SINGLE_ROWS, WIDTH } from "./data/looks";

/**
 * Six deliverable compositions, plus one *-loopcheck per looping composition.
 *
 * The loop-check compositions are verification-only and are not part of the
 * delivery. A 300-frame loop means frame 300 equals frame 0, not frame 299 —
 * but a 300-frame composition has no frame 300. Each check runs one frame
 * longer while the motion still uses the row's `loopFrames`, so rendering its
 * last frame and frame 0 should give two identical PNGs. See README.
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      {[0,1,2,3,4,5,6,7,8,9].map((v)=>(<Composition key={"Smoke"+v} id={"Smoke"+v} component={Smoke} durationInFrames={60} fps={30} width={1920} height={1080} defaultProps={{variant:v}} />))}
      {SINGLE_ROWS.map((row) => (
        <Composition
          key={row.id}
          id={row.id}
          component={SinglePillComp}
          durationInFrames={row.durationInFrames}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ row }}
        />
      ))}
      {FALLING_ROWS.map((row) => (
        <Composition
          key={row.id}
          id={row.id}
          component={FallingPillsComp}
          durationInFrames={row.durationInFrames}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ row }}
        />
      ))}

      {SINGLE_ROWS.filter((r) => !r.hasMattePass).map((row) => (
        <Composition
          key={`${row.id}-loopcheck`}
          id={`${row.id}-loopcheck`}
          component={SinglePillComp}
          durationInFrames={row.durationInFrames + 1}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ row }}
        />
      ))}
      {/* Look 2 is exempt from loop closure as a whole, but its beauty half
          should still close: this runs the beauty pass one frame long. */}
      {SINGLE_ROWS.filter((r) => r.hasMattePass).map((row) => (
        <Composition
          key={`${row.id}-loopcheck`}
          id={`${row.id}-loopcheck`}
          component={SinglePillComp}
          durationInFrames={row.loopFrames + 1}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ row: { ...row, hasMattePass: false } }}
        />
      ))}
      {FALLING_ROWS.map((row) => (
        <Composition
          key={`${row.id}-loopcheck`}
          id={`${row.id}-loopcheck`}
          component={FallingPillsComp}
          durationInFrames={row.durationInFrames + 1}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ row }}
        />
      ))}
    </>
  );
};

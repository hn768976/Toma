import { Composition } from "remotion";
import { compositionId, VERSIONS } from "./data/versions";
import { PlanetShot } from "./scene/PlanetShot";

// 17 compositions (9 Spin + 8 Crescent), one per data row, all 3840x2160 at
// 30fps. LOOP_CHECK=1 (env, at bundle time) adds one frame to every Spin
// so frames 0 and 600 can be compared for the loop check.
const loopCheck = process.env.REMOTION_LOOP_CHECK === "1";

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((row) => (
      <Composition
        key={row.id}
        id={compositionId(row)}
        component={PlanetShot}
        defaultProps={{ row }}
        durationInFrames={row.durationInFrames + (loopCheck && row.shot === "spin" ? 1 : 0)}
        fps={30}
        width={3840}
        height={2160}
      />
    ))}
  </>
);

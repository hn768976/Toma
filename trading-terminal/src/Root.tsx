import { Composition } from "remotion";
import { DURATION, FPS } from "./data";
import { Terminal } from "./Terminal";
import { VERSIONS } from "./versions";

export const RemotionRoot: React.FC = () => (
  <>
    {Object.values(VERSIONS).map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={Terminal}
        durationInFrames={DURATION}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ versionId: v.id }}
      />
    ))}
  </>
);

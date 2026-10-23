import { Composition } from "remotion";
import { Diorama } from "./Diorama";

// Both compositions are authored at 4K (3840x2160) and match the reference
// length exactly: 555 frames at 30 fps = 18.5 s.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Energy-V1-Match"
        component={Diorama}
        fps={30}
        durationInFrames={555}
        width={3840}
        height={2160}
        defaultProps={{ variant: "match" as const }}
      />
      <Composition
        id="Energy-V2-Night"
        component={Diorama}
        fps={30}
        durationInFrames={555}
        width={3840}
        height={2160}
        defaultProps={{ variant: "night" as const }}
      />
    </>
  );
};

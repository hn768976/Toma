import { Composition } from "remotion";
import { KeyboardScene } from "./KeyboardScene";

// Both compositions are authored at 4K (3840x2160) and match the reference
// length exactly: 170 frames at 30 fps = 5.667 s.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="YesKey-V1-Match"
        component={KeyboardScene}
        fps={30}
        durationInFrames={170}
        width={3840}
        height={2160}
        defaultProps={{ variant: "match" as const }}
      />
      <Composition
        id="YesKey-V2-Orbit"
        component={KeyboardScene}
        fps={30}
        durationInFrames={170}
        width={3840}
        height={2160}
        defaultProps={{ variant: "orbit" as const }}
      />
    </>
  );
};

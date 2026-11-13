import { Composition } from "remotion";
import { ChessScene } from "./chess/ChessScene";

// Both compositions are authored at 4K UHD (3840x2160), 30 fps, 300 frames
// (exactly 10.000 s — the length of the reference clip).
const W = 3840;
const H = 2160;
const FPS = 30;
const FRAMES = 300;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ChessKingV1"
        component={ChessScene}
        durationInFrames={FRAMES}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ cameraMode: "reference" as const }}
      />
      <Composition
        id="ChessKingV2"
        component={ChessScene}
        durationInFrames={FRAMES}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ cameraMode: "orbit" as const }}
      />
    </>
  );
};

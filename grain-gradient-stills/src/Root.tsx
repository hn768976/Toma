import { Composition } from "remotion";
import { GrainGradient } from "./GrainGradient";
import { ContactSheet, SHEET_HEIGHT, SHEET_WIDTH } from "./ContactSheet";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="GrainGradient"
        component={GrainGradient}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ composition: "g01", palette: "cyanMagenta" } as const}
      />
      {/* Proof sheet of the batch. See scripts/contact-sheet.ts. */}
      <Composition
        id="ContactSheet"
        component={ContactSheet}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={SHEET_WIDTH}
        height={SHEET_HEIGHT}
      />
    </>
  );
};

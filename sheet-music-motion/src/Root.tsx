import { Composition } from "remotion";
import { ScoreDolly } from "./score-dolly/ScoreDolly";
import { FloatingNotes } from "./floating-notes/FloatingNotes";
import {
  FLOATING_NOTES_FRAMES,
  FPS,
  HEIGHT,
  SCORE_DOLLY_FRAMES,
  WIDTH,
} from "./constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Composition 1: vintage score, low-angle tracking dolly (Three.js / WebGL 2) */}
      <Composition
        id="Comp1-V1-ScoreDolly"
        component={ScoreDolly}
        fps={FPS}
        durationInFrames={SCORE_DOLLY_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "reference" as const }}
      />
      <Composition
        id="Comp1-V2-ScoreCraneOrbit"
        component={ScoreDolly}
        fps={FPS}
        durationInFrames={SCORE_DOLLY_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ variant: "craneOrbit" as const }}
      />
      {/* Composition 2: floating notes over aged staff paper (Canvas 2D) */}
      <Composition
        id="Comp2-V1-FloatingNotes"
        component={FloatingNotes}
        fps={FPS}
        durationInFrames={FLOATING_NOTES_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "sepia" as const }}
      />
      <Composition
        id="Comp2-V2-FloatingNotesCyanotype"
        component={FloatingNotes}
        fps={FPS}
        durationInFrames={FLOATING_NOTES_FRAMES}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ palette: "cyanotype" as const }}
      />
    </>
  );
};

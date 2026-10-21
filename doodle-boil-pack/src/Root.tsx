import React from "react";
import { Composition } from "remotion";
import { ArrowPack } from "./ArrowPack";
import { chalkArrowCurved, chalkArrowsDown, chalkHearts } from "./doodles/chalkSingles";
import { creamArrow } from "./doodles/creamArrow";
import { doodleFrameChalk, doodleFrameCrayon } from "./doodles/doodleFrame";
import { BLACK, BRUSH_BLACK, BRUSH_BLACK_STREAK, BRUSH_WHITE, GREEN } from "./inks";
import { BoilScene, Doodle } from "./lib/scene";

const FPS = 30;
const W = 3840;
const H = 2160;
const LOOP = 300; // 10s loops
const PACK = 240; // 8s arrow packs

type LoopProps = { loopCheck: boolean };

// Composition ids can't contain "_", so they use "-" (DoodleFrame-Crayon renders to DoodleFrame_Crayon.mp4).
// `loopCheck: true` makes a loop 301 frames long, so frame 300 can be compared with frame 0.
const loopLength = ({ props }: { props: LoopProps }) => ({ durationInFrames: props.loopCheck ? LOOP + 1 : LOOP });

const LOOPS: { id: string; background: string; build: (id: string) => Doodle[] }[] = [
  { id: "DoodleFrame_Crayon", background: GREEN, build: doodleFrameCrayon },
  { id: "DoodleFrame_ChalkBlack", background: BLACK, build: doodleFrameChalk },
  { id: "BoilArrow_Cream", background: GREEN, build: (id) => [creamArrow(id)] },
  { id: "ChalkArrow_Curved", background: GREEN, build: (id) => [chalkArrowCurved(id)] },
  { id: "ChalkHearts", background: GREEN, build: (id) => [chalkHearts(id)] },
  { id: "ChalkArrows_Down", background: GREEN, build: (id) => [chalkArrowsDown(id)] },
];

const built = new Map<string, Doodle[]>();
const doodlesFor = (id: string, build: (id: string) => Doodle[]) => {
  if (!built.has(id)) built.set(id, build(id));
  return built.get(id)!;
};

export const RemotionRoot: React.FC = () => (
  <>
    {LOOPS.map(({ id, background, build }) => (
      <Composition
        key={id}
        id={id.replace("_", "-")}
        component={() => <BoilScene id={id} background={background} doodles={doodlesFor(id, build)} loop={LOOP} drift />}
        durationInFrames={LOOP}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ loopCheck: false } as LoopProps}
        calculateMetadata={loopLength}
      />
    ))}
    <Composition
      id="BrushArrowPack-Black"
      component={() => <ArrowPack id="BrushArrowPack_Black" background={BLACK} ink={BRUSH_WHITE} streakTone={null} />}
      durationInFrames={PACK}
      fps={FPS}
      width={W}
      height={H}
    />
    <Composition
      id="BrushArrowPack-Green"
      component={() => <ArrowPack id="BrushArrowPack_Green" background={GREEN} ink={BRUSH_BLACK} streakTone={BRUSH_BLACK_STREAK} />}
      durationInFrames={PACK}
      fps={FPS}
      width={W}
      height={H}
    />
  </>
);

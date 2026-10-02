import React from "react";
import { Composition, Folder } from "remotion";
import { ColonComposition } from "./ColonComposition";
import { STORIES } from "./stories";
import { modelCheckStory } from "./stories/modelCheck";
import { floraStory } from "./stories/flora";

const W = 3840;
const H = 2160;
const FPS = 30;

export const RemotionRoot: React.FC = () => (
  <>
    {STORIES.filter((s) => s !== modelCheckStory).map((s) => (
      <Composition
        key={s.id}
        id={s.id}
        component={ColonComposition}
        durationInFrames={s.durationInFrames}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ storyId: s.id }}
      />
    ))}
    {/* checks only (not deliverables): model/cut views, and comp 2 at 601 frames for the loop test */}
    <Folder name="checks">
      <Composition id={modelCheckStory.id} component={ColonComposition} durationInFrames={modelCheckStory.durationInFrames} fps={FPS} width={W} height={H} defaultProps={{ storyId: modelCheckStory.id }} />
      <Composition id="Colon-HealthyFlora-601" component={ColonComposition} durationInFrames={floraStory.durationInFrames + 1} fps={FPS} width={W} height={H} defaultProps={{ storyId: floraStory.id }} />
    </Folder>
  </>
);

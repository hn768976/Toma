import "./lib/fonts";
import React from "react";
import { Composition, getInputProps } from "remotion";
import { FPS, HEIGHT, LOOP_FRAMES, OPENER_FRAMES, WIDTH } from "./lib/constants";
import { SignalReadout } from "./signal-readout/SignalReadout";
import { BreakingNewsOpener } from "./breaking-news/BreakingNewsOpener";
import { breakingNewsDefaults } from "./breaking-news/theme";
import { AudioEditor } from "./audio-editor/AudioEditor";

// QA only: `--props='{"loopCheck":true}'` makes the looping compositions
// 601 frames long so frame 600 can be rendered and compared with frame 0.
const loopCheck = (getInputProps() as { loopCheck?: boolean }).loopCheck === true;
const LOOP_DURATION = loopCheck ? LOOP_FRAMES + 1 : LOOP_FRAMES;

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="SignalReadout" component={SignalReadout} durationInFrames={LOOP_DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
    {/* Look 2 is a one-way opener: NOT a loop. */}
    <Composition id="BreakingNewsOpener" component={BreakingNewsOpener} durationInFrames={OPENER_FRAMES} fps={FPS} width={WIDTH} height={HEIGHT} defaultProps={breakingNewsDefaults} />
    <Composition id="AudioEditor" component={AudioEditor} durationInFrames={LOOP_DURATION} fps={FPS} width={WIDTH} height={HEIGHT} />
  </>
);

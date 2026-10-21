import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { ChalkMath_Flythrough } from "./chalk/ChalkFly";
import { ChalkMath_Write } from "./chalk/ChalkWrite";
import { NeuralGlobe_Labels } from "./globe/NeuralGlobe";
import { HUDScope_Violet } from "./hud/HUDScope";
import { VHSPlayback_Clean, VHSPlayback_OSD } from "./vhs/VHSPlayback";
import { TVStatic_Datamosh, TVStatic_Transition } from "./static/TVStatic";

// Composition ids use "-" (Remotion does not allow "_"); output files keep "_".
const W = 3840;
const H = 2160;
const FPS = 30;

const loopDefaults = { loopCheck: false };
/** Loops are 600 frames; pass --props='{"loopCheck":true}' to get 601 and compare frame 600 with 0. */
const loopMeta: CalculateMetadataFunction<Record<string, unknown>> = ({ props }) => ({
  durationInFrames: props.loopCheck === true ? 601 : 600,
});

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="HUDScope-Violet" component={HUDScope_Violet} durationInFrames={600} fps={FPS} width={W} height={H} defaultProps={loopDefaults} calculateMetadata={loopMeta} />
    <Composition id="VHSPlayback-OSD" component={VHSPlayback_OSD} durationInFrames={600} fps={FPS} width={W} height={H} />
    <Composition id="VHSPlayback-Clean" component={VHSPlayback_Clean} durationInFrames={600} fps={FPS} width={W} height={H} defaultProps={loopDefaults} calculateMetadata={loopMeta} />
    <Composition id="TVStatic-Datamosh" component={TVStatic_Datamosh} durationInFrames={300} fps={FPS} width={W} height={H} />
    <Composition id="TVStatic-Transition" component={TVStatic_Transition} durationInFrames={60} fps={FPS} width={W} height={H} />
    <Composition id="ChalkMath-Flythrough" component={ChalkMath_Flythrough} durationInFrames={600} fps={FPS} width={W} height={H} defaultProps={loopDefaults} calculateMetadata={loopMeta} />
    <Composition id="ChalkMath-Write" component={ChalkMath_Write} durationInFrames={300} fps={FPS} width={W} height={H} />
    <Composition id="NeuralGlobe-Labels" component={NeuralGlobe_Labels} durationInFrames={600} fps={FPS} width={W} height={H} defaultProps={loopDefaults} calculateMetadata={loopMeta} />
  </>
);

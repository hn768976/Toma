import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { ShaderOverlay, type Look } from "./lib/ShaderOverlay";
import { bokeh } from "./looks/bokeh";
import { filmBurnSequence, filmBurnTransition } from "./looks/filmBurn";
import { filmGate } from "./looks/filmGate";
import { prismGlints } from "./looks/prismGlints";
import { starburst } from "./looks/starburst";
import { vintageColour, vintageMono } from "./looks/vintageFilm";

const FPS = 30;
const W = 3840;
const H = 2160;

type Props = { loopCheck: boolean };

// Loops are 600 frames. Render with --props='{"loopCheck":true}' to get 601
// frames, so frame 600 can be compared against frame 0.
const loopMeta: CalculateMetadataFunction<Props> = ({ props }) => ({
  durationInFrames: props.loopCheck ? 601 : 600,
});

const components = new Map<Look, React.FC<Props>>();
const componentFor = (look: Look) => {
  let C = components.get(look);
  if (!C) {
    C = () => <ShaderOverlay look={look} />;
    components.set(look, C);
  }
  return C;
};

// Remotion IDs can't contain "_", so FilmBurn_Sequence is registered as FilmBurn-Sequence.
const CLIPS: { id: string; look: Look; frames?: number }[] = [
  { id: "FilmBurn-Sequence", look: filmBurnSequence, frames: 300 },
  { id: "FilmBurn-Transition", look: filmBurnTransition, frames: 90 },
  { id: "VintageFilm-Colour", look: vintageColour },
  { id: "VintageFilm-Mono", look: vintageMono },
  { id: "FilmGate-16mm", look: filmGate },
  { id: "PrismGlints-Teal", look: prismGlints },
  { id: "BokehLeak-Warm", look: bokeh },
  { id: "Starburst-White", look: starburst },
];

export const RemotionRoot: React.FC = () => (
  <>
    {CLIPS.map(({ id, look, frames }) => (
      <Composition
        key={id}
        id={id}
        component={componentFor(look)}
        durationInFrames={frames ?? 600}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{ loopCheck: false }}
        calculateMetadata={frames ? undefined : loopMeta}
      />
    ))}
  </>
);

import React, { useMemo } from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { ThreeStage } from "./lib/ThreeStage";
import { LOOP } from "./lib/random";
import { BinaryStage } from "./looks/BinaryStage";
import { GlitterStage } from "./looks/glitter/GlitterStage";
import { makeHighway } from "./looks/highway";
import { makeLowPoly } from "./looks/lowPoly";
import { makePlexusLandscape } from "./looks/plexusLandscape";
import { BINARY, GLITTER, HIGHWAY, LOW_POLY, PLEXUS_LANDSCAPE } from "./versions";

// Every composition: 3840x2160, 30fps, 600 frames (20s seamless loop).
// `--props='{"loopCheck":true}'` makes it 601 frames so frames 0 and 600
// can be compared pixel for pixel.
type Props = { id: string; loopCheck: boolean };
const calc: CalculateMetadataFunction<Props> = ({ props }) => ({
  durationInFrames: props.loopCheck ? LOOP + 1 : LOOP,
});
const common = { fps: 30, width: 3840, height: 2160, durationInFrames: LOOP, calculateMetadata: calc };
const byId = <T extends { id: string }>(rows: T[], id: string) => rows.find((r) => r.id === id) ?? rows[0];

const Glitter: React.FC<Props> = ({ id }) => <GlitterStage v={byId(GLITTER, id).v} />;
const Highway: React.FC<Props> = ({ id }) => {
  const build = useMemo(() => makeHighway(byId(HIGHWAY, id).v), [id]);
  return <ThreeStage build={build} />;
};
const PlexusLandscape: React.FC<Props> = ({ id }) => {
  const build = useMemo(() => makePlexusLandscape(byId(PLEXUS_LANDSCAPE, id).v), [id]);
  return <ThreeStage build={build} />;
};
const LowPoly: React.FC<Props> = ({ id }) => {
  const build = useMemo(() => makeLowPoly(byId(LOW_POLY, id).v), [id]);
  return <ThreeStage build={build} />;
};
const Binary: React.FC<Props> = ({ id }) => <BinaryStage v={byId(BINARY, id).v} />;

const LOOKS: { rows: { id: string }[]; component: React.FC<Props> }[] = [
  { rows: GLITTER, component: Glitter },
  { rows: HIGHWAY, component: Highway },
  { rows: PLEXUS_LANDSCAPE, component: PlexusLandscape },
  { rows: LOW_POLY, component: LowPoly },
  { rows: BINARY, component: Binary },
];

export const RemotionRoot: React.FC = () => (
  <>
    {LOOKS.flatMap(({ rows, component }) =>
      rows.map((row) => (
        <Composition key={row.id} id={row.id} component={component} defaultProps={{ id: row.id, loopCheck: false }} {...common} />
      )),
    )}
  </>
);

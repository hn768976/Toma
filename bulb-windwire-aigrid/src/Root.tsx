import React from "react";
import { Composition, type CalculateMetadataFunction } from "remotion";
import { loadFonts } from "./engine/fonts";
import { Stage, type LookFactory } from "./engine/Stage";
import { createAigrid } from "./looks/aigrid/look";
import { createBulb, type BulbModelCheck } from "./looks/bulb/look";
import { createWindwire } from "./looks/windwire/look";
import { VERSIONS, type Version } from "./versions";

export type CompProps = {
  /** Verification only: add one frame so frame `durationInFrames` can be rendered for the loop check. */
  loopCheck?: boolean;
  /** Bulb only: render the bare bulb on grey for the model check. */
  modelCheck?: BulbModelCheck;
};

const factories = new Map<string, LookFactory>();
const factoryFor = (v: Version, props: CompProps): LookFactory => {
  const key = `${v.id}|${props.modelCheck ?? ""}`;
  let f = factories.get(key);
  if (!f) {
    if (v.look === "bulb") f = createBulb(v.palette, v.mode, props.modelCheck ?? "off");
    else if (v.look === "windwire") f = createWindwire(v.palette);
    else f = createAigrid(v.palette);
    factories.set(key, f);
  }
  return f;
};

const makeComponent = (v: Version): React.FC<CompProps> => {
  const C: React.FC<CompProps> = (props) => <Stage create={factoryFor(v, props)} prepare={loadFonts} />;
  C.displayName = v.file;
  return C;
};

const calc =
  (v: Version): CalculateMetadataFunction<CompProps> =>
  ({ props }) => ({ durationInFrames: v.durationInFrames + (props.loopCheck ? 1 : 0) });

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={makeComponent(v)}
        durationInFrames={v.durationInFrames}
        calculateMetadata={calc(v)}
        fps={30}
        width={3840}
        height={2160}
        defaultProps={{ loopCheck: false } as CompProps}
      />
    ))}
  </>
);

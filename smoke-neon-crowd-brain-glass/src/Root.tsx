import { Composition, CalculateMetadataFunction } from "remotion";
import { FPS, HEIGHT, WIDTH, glitterSmokeVersions, neonVersions, crowdVersions, brainVersions, glassVersions } from "./versions";
import { NeonPolygonFrame } from "./looks/neon/NeonPolygonFrame";
import { GlitterSmoke } from "./looks/glitter/GlitterSmoke";
import { GlassTwist } from "./looks/glass/GlassTwist";
import { CrowdSpotlight } from "./looks/crowd/CrowdSpotlight";
import { AIBrainPaths } from "./looks/brain/AIBrainPaths";

/**
 * `durationOverride` input prop lets the loop check render frame 600 of a
 * 600-frame loop (temporarily 601 frames): --props='{"durationOverride":601}'
 */
type Common = { durationOverride?: number };
const calc =
  (base: number): CalculateMetadataFunction<Common & Record<string, unknown>> =>
  ({ props }) => ({ durationInFrames: props.durationOverride ?? base });

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {glitterSmokeVersions.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={GlitterSmoke as never}
          durationInFrames={600}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ colors: v.colors }}
          calculateMetadata={calc(600)}
        />
      ))}
      {neonVersions.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={NeonPolygonFrame as never}
          durationInFrames={600}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ colors: v.colors }}
          calculateMetadata={calc(600)}
        />
      ))}
      {glassVersions.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={GlassTwist as never}
          durationInFrames={600}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ colors: v.colors }}
          calculateMetadata={calc(600)}
        />
      ))}
      {crowdVersions.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={CrowdSpotlight as never}
          durationInFrames={360}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ colors: v.colors }}
          calculateMetadata={calc(360)}
        />
      ))}
      {brainVersions.map((v) => (
        <Composition
          key={v.id}
          id={v.id}
          component={AIBrainPaths as never}
          durationInFrames={360}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ colors: v.colors }}
          calculateMetadata={calc(360)}
        />
      ))}
    </>
  );
};

   

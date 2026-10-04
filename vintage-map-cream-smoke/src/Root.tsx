import { Composition, Folder, type CalculateMetadataFunction } from "remotion";
import { CreamSwirl, type CreamSwirlProps } from "./cream-swirl/CreamSwirl";
import { CREAM_VERSIONS } from "./cream-swirl/versions";
import { ParticleSmoke, type ParticleSmokeProps } from "./particle-smoke/ParticleSmoke";
import { SMOKE_VERSIONS } from "./particle-smoke/versions";
import { MapTexturePreview } from "./vintage-map/MapTexturePreview";
import { MAP_REGIONS } from "./vintage-map/regions";
import { VintageMap } from "./vintage-map/VintageMap";

const FPS = 30;
const DURATION = 600; // 20 s
const WIDTH = 3840;
const HEIGHT = 2160;

// Pass --props='{"loopCheck":true}' to get 601 frames, so frame 600 can be
// rendered and compared with frame 0.
const withLoopCheck = <T extends { loopCheck?: boolean }>(): CalculateMetadataFunction<T> => ({ props }) => ({
  durationInFrames: props.loopCheck ? DURATION + 1 : DURATION,
});

export const RemotionRoot: React.FC = () => (
  <>
    <Folder name="VintageMap">
      {Object.values(MAP_REGIONS).map((r) => (
        <Composition
          key={r.id}
          id={`VintageMap-${r.id}`}
          component={VintageMap}
          durationInFrames={DURATION}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ region: r.id }}
        />
      ))}
    </Folder>
    <Folder name="CreamSwirl">
      {Object.values(CREAM_VERSIONS).map((v) => (
        <Composition
          key={v.id}
          id={`CreamSwirl-${v.id}`}
          component={CreamSwirl}
          durationInFrames={DURATION}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ version: v.id, loopCheck: false }}
          calculateMetadata={withLoopCheck<CreamSwirlProps>()}
        />
      ))}
    </Folder>
    <Folder name="ParticleSmoke">
      {Object.values(SMOKE_VERSIONS).map((v) => (
        <Composition
          key={v.id}
          id={`ParticleSmoke-${v.id}`}
          component={ParticleSmoke}
          durationInFrames={DURATION}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ version: v.id, loopCheck: false }}
          calculateMetadata={withLoopCheck<ParticleSmokeProps>()}
        />
      ))}
    </Folder>
    <Folder name="Debug">
      {Object.keys(MAP_REGIONS).map((id) => (
        <Composition
          key={id}
          id={`MapTexture-${id}`}
          component={MapTexturePreview}
          durationInFrames={1}
          fps={FPS}
          width={2000}
          height={1400}
          defaultProps={{ region: id, texScreenWidth: 1280 }}
        />
      ))}
    </Folder>
  </>
);

import { CalculateMetadataFunction, Composition, Folder } from "remotion";
import { BURST_FRAMES, SparkleBurst } from "./burst/SparkleBurst";
import { CoinGrowth, COIN_FRAMES } from "./coins/CoinGrowth";
import { HologramMap, MAP_FRAMES } from "./hologram/HologramMap";
import { BURST_VERSIONS, COIN_VERSIONS, MAP_VERSIONS, WORMHOLE_VERSIONS } from "./versions";
import { Wormhole, WORMHOLE_FRAMES } from "./wormhole/Wormhole";

// All compositions are defined at 3840×2160, 30fps. Previews render with
// --scale=0.3333333333333333 (1280×720); 4K renders use the default scale.
const W = 3840;
const H = 2160;
const FPS = 30;

// Loop check: render with --props='{"loopCheck":true}' to get one extra frame
// (601 total) so frame 600 can be compared against frame 0.
type LoopProps = { loopCheck?: boolean };
const loopMeta =
  (frames: number): CalculateMetadataFunction<LoopProps> =>
  ({ props }) => ({ durationInFrames: props.loopCheck ? frames + 1 : frames });

// Remotion ids may not contain "_"; output files keep the "_" names.
const compId = (id: string) => id.replace(/_/g, "-");

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Wormhole">
        {WORMHOLE_VERSIONS.map((v) => (
          <Composition
            key={v.id}
            id={compId(v.id)}
            component={() => <Wormhole palette={v} />}
            durationInFrames={WORMHOLE_FRAMES}
            fps={FPS}
            width={W}
            height={H}
            defaultProps={{ loopCheck: false } as LoopProps}
            calculateMetadata={loopMeta(WORMHOLE_FRAMES)}
          />
        ))}
      </Folder>
      <Folder name="CoinGrowth">
        {COIN_VERSIONS.map((v) => (
          <Composition key={v.id} id={compId(v.id)} component={() => <CoinGrowth palette={v} />} durationInFrames={COIN_FRAMES} fps={FPS} width={W} height={H} />
        ))}
      </Folder>
      <Folder name="HologramMap">
        {MAP_VERSIONS.map((v) => (
          <Composition
            key={v.id}
            id={compId(v.id)}
            component={() => <HologramMap palette={v} />}
            durationInFrames={MAP_FRAMES}
            fps={FPS}
            width={W}
            height={H}
            defaultProps={{ loopCheck: false } as LoopProps}
            calculateMetadata={loopMeta(MAP_FRAMES)}
          />
        ))}
      </Folder>
      <Folder name="SparkleBurst">
        {BURST_VERSIONS.map((v) => (
          <Composition key={v.id} id={compId(v.id)} component={() => <SparkleBurst palette={v} />} durationInFrames={BURST_FRAMES} fps={FPS} width={W} height={H} />
        ))}
      </Folder>
    </>
  );
};

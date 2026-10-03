import { Composition, getInputProps } from "remotion";
import { CANDLE_PALETTES, MAP_PALETTES } from "./common/palettes";
import { FPS, HEIGHT, LOOP, WIDTH } from "./common/constants";
import { GlobalMarketsMap } from "./look1/GlobalMarketsMap";
import { CandleChartFlow } from "./look2/CandleChartFlow";

// `--props='{"loopCheck":true}'` makes every composition 601 frames so frames
// 0 and 600 can be rendered and compared.
const duration = getInputProps().loopCheck ? LOOP + 1 : LOOP;

export const RemotionRoot: React.FC = () => (
  <>
    {MAP_PALETTES.map((p) => (
      <Composition
        key={p.id}
        id={MAP_PALETTES.length === 1 ? "GlobalMarketsMap" : `GlobalMarketsMap-${p.id}`}
        component={GlobalMarketsMap}
        durationInFrames={duration}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ paletteId: p.id }}
      />
    ))}
    {CANDLE_PALETTES.map((p) => (
      <Composition
        key={p.id}
        id={`CandleChartFlow-${p.id}`}
        component={CandleChartFlow}
        durationInFrames={duration}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ paletteId: p.id }}
      />
    ))}
  </>
);

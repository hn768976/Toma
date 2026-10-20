import { Still } from "remotion";
import { WatercolourStill } from "./WatercolourStill";
import { STILLS, stillId, OUTPUT_W, OUTPUT_H, PAINT_SCALE } from "./data/stills";

export const RemotionRoot: React.FC = () => (
  <>
    {STILLS.map((s) => (
      <Still
        key={stillId(s)}
        id={stillId(s)}
        component={WatercolourStill}
        width={OUTPUT_W}
        height={OUTPUT_H}
        defaultProps={{
          layout: s.layout,
          palette: s.palette,
          seed: s.seed,
          density: s.density ?? 1,
          paintScale: s.paintScale ?? PAINT_SCALE,
        }}
      />
    ))}
  </>
);

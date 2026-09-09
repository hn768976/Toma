import { Composition } from "remotion";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./config";
import { GridCorridor } from "./GridCorridor";
import { PALETTES } from "./palettes";

const VERSIONS = [
  { id: "V1-GridCorridorRed", palette: "red" },
  { id: "V2-GridCorridorCyan", palette: "cyan" },
  { id: "V3-GridCorridorMagenta", palette: "magenta" },
] as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {VERSIONS.map(({ id, palette }) => (
        <Composition
          key={id}
          id={id}
          component={GridCorridor}
          durationInFrames={DURATION_IN_FRAMES}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          defaultProps={{ palette: palette as keyof typeof PALETTES }}
        />
      ))}
    </>
  );
};

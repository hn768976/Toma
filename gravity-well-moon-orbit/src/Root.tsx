import { Composition } from "remotion";
import { ROWS, type SceneRow } from "./config";
import { FPS, LOOP } from "./lib/time";
import { SpaceScene } from "./SpaceScene";

type Props = {
  row: SceneRow;
  /** Only for the loop check: render 601 frames to compare 0 and 600. */
  durationOverride: number | null;
};

const Scene: React.FC<Props> = ({ row }) => <SpaceScene row={row} />;

export const RemotionRoot: React.FC = () => (
  <>
    {ROWS.map((row) => (
      <Composition
        key={row.id}
        id={row.id.replace(/_/g, "-")}
        component={Scene}
        width={3840}
        height={2160}
        fps={FPS}
        durationInFrames={LOOP}
        defaultProps={{ row, durationOverride: null } as Props}
        calculateMetadata={({ props }) => ({
          durationInFrames: props.durationOverride ?? LOOP,
        })}
      />
    ))}
  </>
);

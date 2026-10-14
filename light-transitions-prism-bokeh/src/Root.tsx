import { Composition } from "remotion";
import { VERSIONS } from "./data";
import { PixiLook } from "./lib/PixiLook";
import { LOOKS } from "./looks";

type Props = { row: string; durationOverride?: number };

const LookComp: React.FC<Props> = ({ row }) => {
  const v = VERSIONS.find((r) => r.id === row)!;
  const look = LOOKS[v.look];
  return <PixiLook build={look.build} params={v.params as never} options={look.options} />;
};

export const RemotionRoot: React.FC = () => (
  <>
    {VERSIONS.map((v) => (
      <Composition
        key={v.id}
        id={v.id}
        component={LookComp}
        width={3840}
        height={2160}
        fps={30}
        durationInFrames={LOOKS[v.look].durationInFrames}
        defaultProps={{ row: v.id } as Props}
        // `--props='{"durationOverride":601}'` is used only by the loop check.
        calculateMetadata={({ props }) => ({
          durationInFrames: props.durationOverride ?? LOOKS[v.look].durationInFrames,
        })}
      />
    ))}
  </>
);

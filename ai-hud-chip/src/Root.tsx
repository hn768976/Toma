import React from "react";
import { Composition } from "remotion";
import { ROWS, Row } from "./colorways";
import { AIChipReveal } from "./looks/ChipReveal";
import { AIHudPlane } from "./looks/HudPlane";
import { ParticleAIChip } from "./looks/ParticleChip";

// 16:9, defined at 3840×2160 (render 720p previews with --scale=1/3,
// 6000×3375 stills with --scale=1.5625).
const W = 3840;
const H = 2160;
const FPS = 30;

const LENGTH: Record<Row["look"], number> = {
  hudPlane: 450, // 15 s story
  particleChip: 600, // 20 s loop
  chipReveal: 300, // 10 s story
};

export const compositionId = (row: Row) => row.id.replace(/_/g, "-");

type Props = { durationOverride?: number };

const View: React.FC<{ row: Row }> = ({ row }) => {
  if (row.look === "hudPlane") return <AIHudPlane row={row} />;
  if (row.look === "particleChip") return <ParticleAIChip row={row} />;
  return <AIChipReveal row={row} />;
};

export const RemotionRoot: React.FC = () => (
  <>
    {ROWS.map((row) => (
      <Composition
        key={row.id}
        // Remotion IDs may not contain "_": AIHudPlane_Violet → AIHudPlane-Violet
        id={compositionId(row)}
        component={() => <View row={row} />}
        durationInFrames={LENGTH[row.look]}
        fps={FPS}
        width={W}
        height={H}
        defaultProps={{}}
        // `--props='{"durationOverride":601}'` is used by the loop check
        calculateMetadata={({ props }: { props: Props }) => ({
          durationInFrames: props.durationOverride ?? LENGTH[row.look],
        })}
      />
    ))}
  </>
);

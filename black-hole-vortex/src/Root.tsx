import React from "react";
import { CalculateMetadataFunction, Composition } from "remotion";
import { ShaderComposition, ShotProps } from "./engine/ShaderComposition";
import { FPS, LOOP_FRAMES, SHOTS } from "./shots";

const byId = Object.fromEntries(SHOTS.map((s) => [s.id, s]));

const Shot: React.FC<ShotProps> = ({ shotId, quality }) => (
  <ShaderComposition row={byId[shotId]} quality={quality} />
);

// durationOverride exists only for the loop check (601 frames -> frame 600
// must equal frame 0). The animation itself always loops on 600 frames.
const calculateMetadata: CalculateMetadataFunction<ShotProps> = ({ props }) => ({
  durationInFrames: props.durationOverride ?? LOOP_FRAMES,
});

export const RemotionRoot: React.FC = () => (
  <>
    {SHOTS.map((s) => (
      <Composition
        key={s.id}
        // Remotion IDs may not contain "_": BlackHole_EdgeOnPink -> BlackHole-EdgeOnPink
        id={s.id.replace("_", "-")}
        component={Shot}
        durationInFrames={LOOP_FRAMES}
        fps={FPS}
        width={3840}
        height={2160}
        defaultProps={{ shotId: s.id, quality: "auto", durationOverride: null } as ShotProps}
        calculateMetadata={calculateMetadata}
      />
    ))}
  </>
);

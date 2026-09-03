/**
 * The composition. One component, two variants — everything that differs
 * between the blue plate and the amber bar comes out of VARIANTS.
 *
 * Layer order, bottom to top:
 *   BackgroundWash -> CharacterRain -> SparkField -> RuleLines? ->
 *   CornerNodeFrame -> FilmGrade
 *
 * Every layer is its own 3840x2160 <canvas> redrawn once per React render from
 * useCurrentFrame(). There is no rAF, no CSS animation, no state and no
 * Date.now() anywhere, so `npx remotion render` is deterministic and the
 * frames can be produced out of order across workers.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { DURATION_IN_FRAMES, loopedFrame } from "./constants";
import { TAU } from "../lib/canvas";
import { BackgroundWash } from "./BackgroundWash";
import { CharacterRain } from "./CharacterRain";
import { SparkField } from "./SparkField";
import { CornerNodeFrame } from "./CornerNodeFrame";
import { RuleLines } from "./RuleLines";
import { FilmGrade } from "./FilmGrade";
import { VARIANTS, type VariantName } from "./variants";

export type NeonFrameProps = {
  variant: VariantName;
};

/** Ambient camera drift: a closed 1:2 Lissajous, +/-8px, one loop per 360. */
const AMBIENT_X = 8;
const AMBIENT_Y = 6;

export const NeonFrame: React.FC<NeonFrameProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const f = loopedFrame(frame);
  const config = VARIANTS[variant];
  const seedKey = `neon-frame-${variant}`;

  const theta = (TAU * f) / DURATION_IN_FRAMES;
  const driftX = AMBIENT_X * Math.cos(theta);
  const driftY = AMBIENT_Y * Math.sin(2 * theta);

  return (
    <AbsoluteFill
      style={{ backgroundColor: config.palette.backgroundDeep }}
    >
      {/* The drift is a per-frame transform computed from the frame number,
          not a CSS animation. The slight scale keeps the edges covered. */}
      <AbsoluteFill
        style={{
          transform: `translate(${driftX}px, ${driftY}px) scale(1.008)`,
          transformOrigin: "center center",
        }}
      >
        <BackgroundWash palette={config.palette} seedKey={seedKey} />
        <CharacterRain variant={config} seedKey={seedKey} />
        <SparkField variant={config} seedKey={seedKey} />
        {config.ruleLines ? (
          <RuleLines
            config={config.ruleLines}
            palette={config.palette}
            seedKey={seedKey}
          />
        ) : null}
        <CornerNodeFrame variant={config} />
      </AbsoluteFill>
      <FilmGrade />
    </AbsoluteFill>
  );
};

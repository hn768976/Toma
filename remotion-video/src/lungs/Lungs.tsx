import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { FORK, FRAME_HEIGHT, FRAME_WIDTH, LOBES, LOOP_FRAMES } from "./anatomy";
import { BronchialTree } from "./BronchialTree";
import { LungBody } from "./LungBody";
import { ParticleField } from "./ParticleField";
import { Trachea } from "./Trachea";
import { breathTransform } from "./breath";
import { growTree, scatterParticles } from "./tree";
import { LungVariantName, VARIANTS } from "./variants";

export type LungsProps = {
  variant: LungVariantName;
};

export const Lungs: React.FC<LungsProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const v = VARIANTS[variant];

  // Tree and particle geometry are generated once. Per-frame work is only the
  // breath transform and the particle offsets.
  const { trees, particles } = useMemo(() => {
    const grown = LOBES.map((lobe) => growTree(lobe, v));
    return {
      trees: grown,
      particles: scatterParticles(LOBES, grown, v, FORK),
    };
  }, [v]);

  const breath = breathTransform(frame, v, FORK);
  // Every drift path is phrased against the fixed loop length rather than the
  // composition duration, so frame 0 and frame 420 land on identical values.
  const loopT = frame / LOOP_FRAMES;

  return (
    <AbsoluteFill style={{ backgroundColor: v.palette.background }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${FRAME_WIDTH} ${FRAME_HEIGHT}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {LOBES.map((lobe) => (
            <clipPath key={lobe.side} id={`lobe-${lobe.side}`}>
              <path d={lobe.path} />
            </clipPath>
          ))}
        </defs>

        {/* The lobes and everything inside them breathe together. */}
        <g transform={breath.transform}>
          {LOBES.map((lobe, i) => (
            <g key={lobe.side}>
              <LungBody lobe={lobe} palette={v.palette} clipId={`lobe-${lobe.side}`} />
              <g clipPath={`url(#lobe-${lobe.side})`}>
                <BronchialTree tree={trees[i]} palette={v.palette} />
                {/* Sluggish specks sit still while the lobe moves: the inverse
                    transform cancels the breath for them exactly. */}
                <g
                  transform={
                    v.particles.behaviour === "circulating"
                      ? undefined
                      : breath.inverseTransform
                  }
                >
                  <ParticleField
                    particles={particles.filter((p) => p.lobe === i)}
                    variant={v}
                    loopT={loopT}
                    breath={breath.amount}
                  />
                </g>
              </g>
            </g>
          ))}
        </g>

        {/* Fixed: the lobes move relative to it. */}
        <Trachea palette={v.palette} />
      </svg>
    </AbsoluteFill>
  );
};

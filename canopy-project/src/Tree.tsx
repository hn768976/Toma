import React from "react";
import type { KeyedTree } from "./keying";
import { edgeDistance, VANISHING_POINT, type TreeInstance } from "./layout";
import type { Palette } from "./palette";
import { loopWave } from "./random";

/**
 * One silhouette, placed by a pure function of the loop position.
 *
 * The three nested elements each do one job, and the nesting order matters:
 * the outer element carries the placement transform, the middle one the depth
 * blur, and the inner one the alpha mask. CSS applies filters before masks on
 * the same element, so a blur and a mask together there would blur the artwork
 * and then cut it with a hard-edged mask — putting the blur on the parent
 * blurs the already-masked result instead, which is what fog actually does.
 */
export const Tree: React.FC<{
  instance: TreeInstance;
  keyed: KeyedTree;
  palette: Palette;
  /** Loop position in [0, 1). */
  t: number;
  width: number;
  height: number;
}> = ({ instance, keyed, palette, t, width, height }) => {
  const vx = VANISHING_POINT.x * width;
  const vy = VANISHING_POINT.y * height;

  const baseR = edgeDistance(instance.theta, width, height) * instance.baseOvershoot;
  const baseX = vx + Math.cos(instance.theta) * baseR;
  const baseY = vy + Math.sin(instance.theta) * baseR;

  const h = baseR * instance.reach;
  const w = h * keyed.aspect;

  // The artwork points up; rotate so that "up" runs from the foot toward the
  // vanishing point. For a foot at bearing theta that is theta - 90 degrees.
  const bearing = (instance.theta * 180) / Math.PI - 90;
  const sway = instance.swayAmp * loopWave(t, instance.swayFreq, instance.swayPhase);
  const tilt =
    instance.tilt + instance.tiltAmp * loopWave(t, instance.tiltFreq, instance.tiltPhase);

  return (
    <div
      style={{
        position: "absolute",
        left: baseX - w / 2,
        top: baseY - h,
        width: w,
        height: h,
        transformOrigin: "50% 100%",
        // Read right to left: mirror the artwork, foreshorten the crown end
        // under a perspective, then swing the whole thing into place.
        transform: [
          `rotate(${bearing + sway}deg)`,
          `perspective(${width * 1.15}px)`,
          `rotateX(${tilt}deg)`,
          `scaleX(${instance.flip})`,
        ].join(" "),
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          filter: `blur(${palette.tierBlur[instance.tier]}px)`,
          opacity: palette.tierOpacity[instance.tier],
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            backgroundColor: palette.tiers[instance.tier],
            WebkitMaskImage: `url(${keyed.url})`,
            maskImage: `url(${keyed.url})`,
            WebkitMaskSize: "100% 100%",
            maskSize: "100% 100%",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
          }}
        />
      </div>
    </div>
  );
};

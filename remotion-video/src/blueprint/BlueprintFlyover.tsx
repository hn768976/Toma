import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import {
  DESIGN_HEIGHT,
  DESIGN_WIDTH,
  DURATION_IN_FRAMES,
  THEMES,
  type Theme,
  type ThemeName,
} from "./constants";
import { generatePlan } from "./planGen";
import { PlanSvg } from "./PlanSvg";

export const blueprintFlyoverSchema = z.object({
  theme: z.enum(["neon", "paper", "lite"]),
  /** Changing this redraws an entirely different building. */
  seed: z.number().int().min(0).max(99999),
});

export type BlueprintFlyoverProps = z.infer<typeof blueprintFlyoverSchema>;

/** Plan extents in inches. ~417ft x 300ft — a whole floor plate, far wider
 *  than the frame, so the camera always has unseen plan to travel into. */
const PLAN_W = 5000;
const PLAN_H = 3600;

/** Size of the 3D plane in design px. Much larger than the frame so the
 *  camera can travel for the full 10s without ever reaching an edge. */
const PLANE_W = 8200;
const PLANE_H = 6000;

type Camera = {
  tiltX: number;
  rollZ: number;
  x: number;
  y: number;
  scale: number;
};

/** The camera move, expressed in the plane's own local space. */
const useCamera = (theme: ThemeName, frame: number): Camera => {
  const t = frame / (DURATION_IN_FRAMES - 1);
  // The lite cut travels less and sits flatter, so overlaid text stays legible.
  const calm = theme === "lite";

  const travelY = calm ? 1100 : 1560;
  const travelX = calm ? 190 : 330;
  const roll = calm ? 3.4 : 7.2;

  return {
    // A slow breath on the tilt keeps the plane from feeling like a static
    // texture scroll.
    tiltX: (calm ? 46 : 50) + Math.sin(t * Math.PI * 2) * 0.9,
    rollZ: (calm ? -4.5 : -6.4) - roll * t,
    x: 110 - travelX * t,
    y: 620 - travelY * t,
    scale: (calm ? 0.82 : 1.26) + (calm ? 0.04 : 0.06) * t,
  };
};

/** The single plan, laid on the tilted plane. The floor beneath it stays
 *  clean — nothing is drawn under the drawing. */
const PlaneLayer: React.FC<{
  theme: Theme;
  cam: Camera;
  seed: number;
  id: string;
}> = ({ theme, cam, seed, id }) => {
  const plan = useMemo(
    () =>
      generatePlan({
        seed,
        width: PLAN_W,
        height: PLAN_H,
        roomSize: theme.roomSize,
        labelDensity: theme.labelDensity,
        chains: theme.chains,
      }),
    [seed, theme],
  );

  const glow =
    theme.glow > 0
      ? // Two tight passes, not three wide ones. A wide halo reads as mush
        // rather than as neon, and blur radius dominates render cost.
        `drop-shadow(0 0 ${theme.glow * 0.55}px ${theme.glowColor}) ` +
        `drop-shadow(0 0 ${theme.glow * 1.9}px ${theme.glowColor})`
      : undefined;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        width: PLANE_W,
        height: PLANE_H,
        marginLeft: -PLANE_W / 2,
        marginTop: -PLANE_H / 2,
        transformStyle: "preserve-3d",
        transform: [
          `rotateX(${cam.tiltX}deg)`,
          `rotateZ(${cam.rollZ}deg)`,
          `scale(${cam.scale})`,
          `translate(${cam.x}px, ${cam.y}px)`,
        ].join(" "),
      }}
    >
      {/* filter lives on an inner element: putting it on the transformed
          node above would collapse the 3D context in Chromium. */}
      <div style={{ width: "100%", height: "100%", filter: glow }}>
        <PlanSvg plan={plan} theme={theme} pad={260} dots id={id} />
      </div>
    </div>
  );
};

export const BlueprintFlyover: React.FC<BlueprintFlyoverProps> = ({
  theme: themeName,
  seed,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const theme = THEMES[themeName];
  const cam = useCamera(themeName, frame);

  // Author once at 1920x1080, then scale the whole stage. The 4K comps are
  // the same drawing resolved at 4K rather than a different layout.
  const scale = Math.min(width / DESIGN_WIDTH, height / DESIGN_HEIGHT);

  const light = themeName === "paper";

  return (
    <AbsoluteFill style={{ backgroundColor: theme.bg, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          width: DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          left: "50%",
          top: "50%",
          marginLeft: -DESIGN_WIDTH / 2,
          marginTop: -DESIGN_HEIGHT / 2,
          transform: `scale(${scale})`,
          overflow: "hidden",
        }}
      >
        {/* Depth wash behind the plane. */}
        <AbsoluteFill
          style={{
            background: light
              ? `radial-gradient(120% 90% at 50% 60%, ${theme.wash} 0%, ${theme.bg} 78%)`
              : `radial-gradient(95% 70% at 50% 78%, ${theme.wash} 0%, ${theme.bg} 72%)`,
          }}
        />

        <AbsoluteFill
          style={{
            perspective: 1750,
            perspectiveOrigin: "50% 40%",
          }}
        >
          <PlaneLayer theme={theme} cam={cam} seed={seed} id={themeName} />
        </AbsoluteFill>

        {/* Atmospheric haze over the far half of the plane, so the horizon
            dissolves instead of ending at a hard edge. */}
        <AbsoluteFill
          style={{
            background: `linear-gradient(to bottom, ${theme.haze} 0%, ${theme.haze}bb 10%, ${theme.haze}55 24%, ${theme.haze}00 44%)`,
            pointerEvents: "none",
          }}
        />

        {/* Corner vignette. */}
        <AbsoluteFill
          style={{
            background: `radial-gradient(96% 96% at 50% 50%, transparent 48%, ${theme.vignetteColor} 100%)`,
            opacity: theme.vignette,
            pointerEvents: "none",
          }}
        />

        {/* A whisper of grain. Dark gradients band badly in H.264 without it. */}
        <AbsoluteFill
          style={{
            opacity: light ? 0.035 : 0.055,
            mixBlendMode: light ? "multiply" : "screen",
            pointerEvents: "none",
          }}
        >
          <svg width="100%" height="100%">
            <filter id={`${themeName}-grain`}>
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.85"
                numOctaves={2}
                stitchTiles="stitch"
              />
            </filter>
            <rect width="100%" height="100%" filter={`url(#${themeName}-grain)`} />
          </svg>
        </AbsoluteFill>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const blueprintFlyoverDefaults: BlueprintFlyoverProps = {
  theme: "neon",
  seed: 20641,
};

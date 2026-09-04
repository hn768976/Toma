import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  PERSPECTIVE,
  PLANE_SCALE,
  ROT_X,
  ROT_Z,
  VB_H,
  VB_W,
} from "./constants";
import { shift } from "./color";
import { Grain } from "./Grain";
import { PALETTES, type PaletteName } from "./palette";
import { PlaneContent } from "./PlaneContent";

export type HUDPlaneProps = {
  paletteName: PaletteName;
  /** Grain amplitude. ~0.05 reads as "fine grain at ~2%" after encoding. */
  grain: number;
  /** Depth-of-field blur, as a fraction of the frame width. */
  dofBlur: number;
  /** Vignette strength, 0-1. */
  vignette: number;
};

export const hudPlaneDefaults: HUDPlaneProps = {
  paletteName: "blue",
  grain: 0.05,
  dofBlur: 0.0013,
  vignette: 0.55,
};

/**
 * One flat plane, raked away from the camera. Everything lives on it — there is
 * no inter-element occlusion and no parallax between depths, which is what the
 * reference actually is.
 */
const Stage: React.FC<{
  frame: number;
  paletteName: PaletteName;
  idPrefix: string;
}> = ({ frame, paletteName, idPrefix }) => {
  const { width } = useVideoConfig();
  const planeW = width * PLANE_SCALE;
  const planeH = (planeW * VB_H) / VB_W;

  return (
    <AbsoluteFill
      style={{ perspective: width * PERSPECTIVE, perspectiveOrigin: "50% 50%" }}
    >
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          width: planeW,
          height: planeH,
          marginLeft: -planeW / 2,
          marginTop: -planeH / 2,
          transform: `rotateX(${ROT_X}deg) rotateZ(${ROT_Z}deg)`,
        }}
      >
        <PlaneContent
          frame={frame}
          palette={PALETTES[paletteName]}
          idPrefix={idPrefix}
          planeW={planeW}
          planeH={planeH}
        />
      </div>
    </AbsoluteFill>
  );
};

// Complementary screen-space masks: the centre band stays sharp, the extreme
// top and bottom cross-fade into a slightly blurred copy. Light depth of field,
// nothing more.
const SHARP_MASK =
  "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 11%, rgba(0,0,0,1) 89%, rgba(0,0,0,0) 100%)";
const SOFT_MASK =
  "linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 11%, rgba(0,0,0,0) 89%, rgba(0,0,0,1) 100%)";

export const HUDPlane: React.FC<HUDPlaneProps> = ({
  paletteName,
  grain,
  dofBlur,
  vignette,
}) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const p = PALETTES[paletteName];
  const blurPx = width * dofBlur;

  // The grain has a mean of 0.5, so it lifts everything under it by
  // grain/2 * 255 levels. Pre-darken the background by the same amount so the
  // finished frame lands on the specified near-black rather than a washed one.
  const lift = -(grain / 2) * 255;

  return (
    <AbsoluteFill style={{ backgroundColor: shift(p.bgOuter, lift) }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(118% 122% at 46% 52%, ${shift(p.bgInner, lift)} 0%, ${shift(p.bgMid, lift)} 46%, ${shift(p.bgOuter, lift)} 100%)`,
        }}
      />

      <AbsoluteFill
        style={{ maskImage: SHARP_MASK, WebkitMaskImage: SHARP_MASK }}
      >
        <Stage frame={frame} paletteName={paletteName} idPrefix="sharp" />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          maskImage: SOFT_MASK,
          WebkitMaskImage: SOFT_MASK,
          filter: `blur(${blurPx}px)`,
        }}
      >
        <Stage frame={frame} paletteName={paletteName} idPrefix="soft" />
      </AbsoluteFill>

      <AbsoluteFill
        style={{
          background: `radial-gradient(116% 108% at 50% 50%, rgba(0,0,0,0) 44%, rgba(0,0,0,${vignette}) 100%)`,
        }}
      />

      <Grain frame={frame} opacity={grain} />
    </AbsoluteFill>
  );
};

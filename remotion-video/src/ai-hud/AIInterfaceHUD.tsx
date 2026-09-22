import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { z } from "zod";
import { BASE_HEIGHT, BASE_WIDTH, CORE_X, PALETTE, PERSPECTIVE } from "./constants";
import { BackgroundCircuit, BackgroundWash } from "./Background";
import { BokehLayer } from "./Bokeh";
import { Core } from "./Core";
import { Counters } from "./Counters";
import { Defs } from "./Defs";
import { FarFurniture, MidCluster, NearFurniture } from "./clusters";
import { Grain } from "./Grain";
import { Plane, useHudScale } from "./Plane";
import { Traces } from "./Traces";
import { cwave, wave } from "./loop";

export const aiInterfaceHudSchema = z.object({});
export const aiInterfaceHudDefaults = {};

// ---------------------------------------------------------------------------
// "AI Interface HUD" — a glowing core with circuit traces radiating outward,
// surrounded by instrument panels on a tilted plane.
//
// Everything here is 2D: React, SVG and CSS 3D transforms. There is no WebGL
// and no three.js. Perspective comes from `perspective` + rotateX/rotateY on
// the layer stack, depth of field from a per-layer CSS blur, and the neon
// from stacked SVG feGaussianBlurs.
//
// Depth stack, back to front:
//   -1000  background circuit board (tilted more steeply, most blurred)
//    -640  bokeh behind the interface
//    -320  far instrument panels      \
//       0  core, traces, clusters      > one tilted surface
//    +320  near instrument panels     /
//    +760  foreground bokeh, heavily out of focus
// ---------------------------------------------------------------------------

export const AIInterfaceHUD: React.FC<z.infer<typeof aiInterfaceHudSchema>> = () => {
  const frame = useCurrentFrame();
  const s = useHudScale();

  // The only camera motion: a slow closed drift. One lateral cycle and two
  // vertical ones trace a figure of eight; the depth term is a cosine offset
  // so it starts at zero. No push-in, no rotation.
  const camX = wave(frame, 1) * 34;
  const camY = wave(frame, 2, 0.12) * 17;
  const camZ = (cwave(frame, 1) - 1) * 46;

  return (
    <AbsoluteFill style={{ backgroundColor: PALETTE.bgEdge, overflow: "hidden" }}>
      <Defs />
      <BackgroundWash />

      <AbsoluteFill
        style={{
          perspective: PERSPECTIVE * s,
          perspectiveOrigin: `${((CORE_X / BASE_WIDTH) * 100).toFixed(2)}% 41%`,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            transformStyle: "preserve-3d",
            transform: `translate3d(${(camX * s).toFixed(3)}px, ${(camY * s).toFixed(3)}px, ${(camZ * s).toFixed(3)}px)`,
          }}
        >
          <Plane depth={-1000} blur={7} rotXExtra={12} opacity={0.8}>
            <BackgroundCircuit />
          </Plane>

          <Plane depth={-640} tilt={false}>
            <BokehLayer front={false} />
          </Plane>

          <Plane depth={-320} blur={4.8} opacity={0.85}>
            <FarFurniture />
          </Plane>

          <Plane depth={0}>
            <MidCluster />
            <Traces />
            <Core />
            <Counters />
          </Plane>

          <Plane depth={320} blur={13} opacity={0.9}>
            <NearFurniture />
          </Plane>

          <Plane depth={760} tilt={false}>
            <BokehLayer front />
          </Plane>
        </div>
      </AbsoluteFill>

      <Grain />
    </AbsoluteFill>
  );
};

// Referenced so the authoring-space constants stay tied to the composition.
export const HUD_BASE = { width: BASE_WIDTH, height: BASE_HEIGHT };

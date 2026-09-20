/**
 * The template component.
 *
 * Every one of the eight compositions is this component with a different
 * {look, palette} pair. It owns the parts that never vary - canvas, HDRI,
 * camera, focus plane, post chain - and switches to the look's scene for the
 * parts that do.
 */

import React from "react";
import { AbsoluteFill, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { EnvironmentMap, useHdrTexture } from "./rig/environment";
import { LockedCamera, RendererSetup } from "./rig/Rig";
import { plinthTopY } from "./rig/plinthGeometry";
import { Post } from "./post/Post";
import { loopT } from "./lib/loop";
import { CAMERA } from "./looks/data";
import type { LookDefinition, StagePalette } from "./looks/types";
import { BlindShadow } from "./looks/BlindShadow";
import { HaloRing } from "./looks/HaloRing";
import { NeonTier } from "./looks/NeonTier";
import { BubbleDrift } from "./looks/BubbleDrift";

const HDRI_URL = "hdri/neutral-studio-gradient.hdr";

const Scene: React.FC<{
  look: LookDefinition;
  palette: StagePalette;
  t: number;
  frame: number;
}> = ({ look, palette, t, frame }) => {
  switch (look.scene) {
    case "blindShadow":
      return <BlindShadow look={look} palette={palette} t={t} />;
    case "haloRing":
      return <HaloRing look={look} palette={palette} t={t} frame={frame} />;
    case "neonTier":
      return <NeonTier look={look} palette={palette} t={t} />;
    case "bubbleDrift":
      return <BubbleDrift look={look} palette={palette} t={t} frame={frame} />;
  }
};

export const PodiumStage: React.FC<{
  look: LookDefinition;
  palette: StagePalette;
}> = ({ look, palette }) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const t = loopT(frame, durationInFrames);

  const hdr = useHdrTexture(staticFile(HDRI_URL));

  // The focus plane is pinned to the podium's top surface - the plane the
  // buyer's product will sit on - so that surface is always the sharp one.
  const focusTarget: [number, number, number] = [
    0,
    plinthTopY(look.plinth) + look.stageOffsetY,
    0,
  ];

  return (
    <AbsoluteFill style={{ backgroundColor: palette.backdrop }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows="soft"
        // Left to follow devicePixelRatio: Remotion's --scale sets Chrome's
        // device scale factor, so a 0.5 preview renders a 1920x1080 buffer
        // from the same 3840x2160 composition without any code change.
        gl={{ antialias: true, alpha: false }}
        style={{ width, height }}
      >
        <RendererSetup
          toneMapping={look.post.toneMapping}
          exposure={look.post.exposure}
        />
        <LockedCamera pushIn={look.pushIn} t={t} />
        {hdr ? <EnvironmentMap texture={hdr} intensity={look.post.envIntensity} /> : null}
        <Scene look={look} palette={palette} t={t} frame={frame} />
        <Post
          spec={look.post}
          frame={frame}
          focusTarget={focusTarget}
          cameraPosition={CAMERA.position}
        />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

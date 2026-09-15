import React from "react";
import type * as THREE from "three";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Look } from "../looks";
import { buildSwarm, swarmTransform, useWorldMotion } from "./motion";
import { VirusPoints } from "./VirusPoints";
import { VirusSurface } from "./VirusSurface";

export const CAMERA_Z = 5;

/** Sharp layer: the hero virus, plus a couple of in-focus companions. */
export const HeroLayer: React.FC<{
  look: Look;
  pixelScale: number;
  geometry: THREE.BufferGeometry;
}> = ({ look, pixelScale, geometry }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const motion = useWorldMotion(look, frame, fps);

  const dissolve =
    look.points.disperse > 0
      ? interpolate(
          motion.p,
          [look.points.dissolveStart, look.points.dissolveEnd],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 0;

  const heroPos = look.hero.pos;

  return (
    <group position={motion.groupPos} rotation={motion.groupRot}>
      {look.mode === "hologram" ? (
        // See-through shell only — no point sprites, which is what produced
        // the white speckle over the capsid.
        <VirusSurface
          geometry={geometry}
          look={look}
          cameraZ={CAMERA_Z}
          holo
          position={heroPos}
          rotation={motion.heroRot}
          scale={look.hero.scale}
        />
      ) : look.mode === "points" ? (
        <>
          {look.points.shell > 0 && dissolve < 0.92 ? (
            <VirusSurface
              geometry={geometry}
              look={look}
              cameraZ={CAMERA_Z}
              dim={look.points.shell}
              // The shell is an occluder that gives the cloud a silhouette; it
              // has to leave with the cloud, or the dispersal reads as a solid
              // ball with sparks around it.
              opacity={Math.max(1 - dissolve * 1.35, 0.001)}
              position={heroPos}
              rotation={motion.heroRot}
              scale={look.hero.scale * (1 - dissolve * 0.12)}
            />
          ) : null}
          <VirusPoints
            geometry={geometry}
            look={look}
            dissolve={dissolve}
            time={motion.t}
            pixelScale={pixelScale}
            position={heroPos}
            rotation={motion.heroRot}
            scale={look.hero.scale}
            // Particles stay subtle while the shell is intact and take over as
            // it disperses, so the solid virus never looks speckled.
            opacityMul={0.12 + 0.88 * Math.min(dissolve * 1.6, 1)}
          />
        </>
      ) : (
        <VirusSurface
          geometry={geometry}
          look={look}
          cameraZ={CAMERA_Z}
          position={heroPos}
          rotation={motion.heroRot}
          scale={look.hero.scale}
        />
      )}
    </group>
  );
};

/**
 * Defocused layer: the background swarm. Rendered at half resolution behind a
 * CSS blur, with the cheap shader variant — it is bokeh, not detail.
 */
export const SwarmLayer: React.FC<{
  look: Look;
  geometry: THREE.BufferGeometry;
}> = ({ look, geometry }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const motion = useWorldMotion(look, frame, fps);
  const swarm = React.useMemo(() => buildSwarm(look, "swarm"), [look]);

  return (
    <group position={motion.groupPos} rotation={motion.groupRot}>
      {swarm.map((m, i) => {
        const { pos, rot } = swarmTransform(m, motion.t, look.swarm.drift);
        return (
          <VirusSurface
            key={i}
            geometry={geometry}
            look={look}
            cameraZ={CAMERA_Z}
            simple
            dim={m.dim}
            position={pos}
            rotation={rot}
            scale={m.scale}
          />
        );
      })}
    </group>
  );
};

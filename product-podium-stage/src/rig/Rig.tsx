/**
 * The fixed rig: camera, renderer setup and soft shadows.
 *
 * Shared unchanged by all eight compositions. The camera in particular is the
 * commercial constraint of this whole project - see LockedCamera below.
 */

import React, { useLayoutEffect } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { SoftShadows } from "@react-three/drei";
import { CAMERA } from "../looks/data";

/**
 * The camera does not move.
 *
 * Buyers license these to composite their own product onto the podium. An
 * orbit, dolly, arc or eased push forces them to motion-track their product
 * onto a moving stage, and most will not bother - at which point the clip
 * stops doing the one job it exists for. So all the motion in this project
 * comes from light, atmosphere and props.
 *
 * The single permitted exception is a slow *linear* push, exposed as
 * `pushIn` on the look row and shipped at 0. It is implemented as an FOV
 * zoom rather than a dolly: a zoom scales the image about its centre with no
 * parallax, so a buyer matches it with one linear scale keyframe, and it
 * stays sharp because it is rendered rather than upscaled. Solving
 * tan(fov/2) = tan(baseFov/2) / scale gives exactly `scale` times image
 * magnification.
 *
 * Note that a push does not return to where it started, so a look with
 * `pushIn` above 0 no longer loops. That is why all eight ship locked.
 */
export const LockedCamera: React.FC<{ pushIn: number; t: number }> = ({ pushIn, t }) => {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const size = useThree((state) => state.size);

  useLayoutEffect(() => {
    camera.position.set(...CAMERA.position);
    // Pitch only. No yaw, no roll - a roll in particular cannot be matched
    // with a scale keyframe.
    camera.rotation.set(THREE.MathUtils.degToRad(CAMERA.pitchDegrees), 0, 0);
    camera.near = CAMERA.near;
    camera.far = CAMERA.far;
    camera.aspect = size.width / size.height;

    const scale = 1 + pushIn * t;
    const baseHalf = THREE.MathUtils.degToRad(CAMERA.fov) / 2;
    camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(baseHalf) / scale));
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, pushIn, t]);

  return null;
};

/** Renderer state that varies per look: tone curve and exposure. */
export const RendererSetup: React.FC<{
  toneMapping: "neutral" | "aces";
  exposure: number;
}> = ({ toneMapping, exposure }) => {
  const gl = useThree((state) => state.gl);

  useLayoutEffect(() => {
    gl.toneMapping =
      toneMapping === "aces"
        ? THREE.ACESFilmicToneMapping
        : // Khronos PBR Neutral. Holds pastel hues and light skin-adjacent
          // tones without the desaturation ACES puts on them, which is what
          // the two photographic looks need.
          THREE.NeutralToneMapping;
    gl.toneMappingExposure = exposure;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
  }, [gl, toneMapping, exposure]);

  return null;
};

/**
 * PCSS soft shadows.
 *
 * Deliberately NOT drei's <AccumulativeShadows>: that builds its result over
 * successive frames, and Remotion renders frames out of order across threads,
 * so it produces inconsistent, flickering output. It is the right tool for a
 * still and the wrong one here. PCSS is evaluated fresh every frame from the
 * shadow map, so frame 200 looks the same whoever renders it and whenever.
 *
 * Shadow quality is where this category is won or lost - a hard-edged or
 * aliased contact shadow under the plinth makes the whole frame look like a
 * first-week render, and it is also the cue a buyer matches their own
 * product's shadow to.
 */
export const StageShadows: React.FC<{ size?: number; samples?: number; focus?: number }> = ({
  size = 28,
  samples = 20,
  focus = 0.45,
}) => <SoftShadows size={size} samples={samples} focus={focus} />;

/**
 * Exponential scene fog.
 *
 * Set imperatively rather than with <fogExp2 attach="fog" />, which attaches
 * to whatever object is its parent - inside a look's <group> that is the
 * group, not the scene, and the renderer never sees it.
 */
export const SceneFog: React.FC<{ color: string; density: number }> = ({
  color,
  density,
}) => {
  const scene = useThree((state) => state.scene);

  useLayoutEffect(() => {
    const previous = scene.fog;
    scene.fog = new THREE.FogExp2(new THREE.Color(color).getHex(), density);
    return () => {
      scene.fog = previous;
    };
  }, [scene, color, density]);

  return null;
};

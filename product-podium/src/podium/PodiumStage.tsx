/**
 * The fixed rig.
 *
 * Camera, renderer, shadow technique and post chain live here and are the
 * same for every stage in the set. A look supplies geometry, materials and
 * lights; it does not get to move the camera or change the post chain.
 * That is what keeps eight compositions looking like one product.
 */
import { ThreeCanvas } from "@remotion/three";
import { PerspectiveCamera } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Grade } from "./Grade";
import { SoftShadows } from "./SoftShadows";
import { DuotoneGlassScene } from "./scenes/DuotoneGlassScene";
import { NeonRingScene } from "./scenes/NeonRingScene";
import { FlutedPlasterScene } from "./scenes/FlutedPlasterScene";
import { WoodLeafScene } from "./scenes/WoodLeafScene";
import { LOOP_FRAMES, type CameraRig, type StageConfig, type ToneConfig } from "./types";

/**
 * Locked camera.
 *
 * `push` is applied as a change of focal length, never as a dolly: a zoom
 * scales the image about its centre with no parallax at all, which is what
 * makes it matchable with a single scale keyframe. A dolly would shift the
 * plinth against the backdrop and defeat the whole point. Every shipped row
 * has push = 0.
 */
const RigCamera: React.FC<{ rig: CameraRig }> = ({ rig }) => {
  const frame = useCurrentFrame();
  const t = frame / LOOP_FRAMES;
  const scale = 1 + rig.push * t;
  const halfV = ((rig.fovDeg * Math.PI) / 180) / 2;
  const fov = ((2 * Math.atan(Math.tan(halfV) / scale)) * 180) / Math.PI;

  return (
    <PerspectiveCamera
      makeDefault
      fov={fov}
      near={0.1}
      far={300}
      position={[0, rig.height, rig.distance]}
      rotation={[(-rig.tiltDeg * Math.PI) / 180, 0, 0]}
    />
  );
};

const ToneMapping: React.FC<{ tone: ToneConfig }> = ({ tone }) => {
  const gl = useThree((s) => s.gl);
  useLayoutEffect(() => {
    gl.toneMapping =
      tone.mapping === "neutral"
        ? THREE.NeutralToneMapping
        : tone.mapping === "aces"
          ? THREE.ACESFilmicToneMapping
          : THREE.NoToneMapping;
    gl.toneMappingExposure = tone.exposure;
  }, [gl, tone.mapping, tone.exposure]);
  return null;
};

const Scene: React.FC<{ config: StageConfig }> = ({ config }) => {
  const p = config.params;
  switch (p.kind) {
    case "duotone-glass":
      return <DuotoneGlassScene params={p} />;
    case "neon-ring":
      return <NeonRingScene params={p} />;
    case "fluted-plaster":
      return <FlutedPlasterScene params={p} />;
    case "wood-leaf":
      return <WoodLeafScene params={p} />;
  }
};

/** PCSS light size per look — how fast the penumbra opens with distance. */
const shadowSoftness = (config: StageConfig) => {
  const p = config.params;
  if (p.kind === "fluted-plaster" || p.kind === "wood-leaf") {
    return p.foliage.softness;
  }
  if (p.kind === "duotone-glass") return 0.014;
  return 0.006;
};

export const PodiumStage: React.FC<{ config: StageConfig }> = ({ config }) => {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ backgroundColor: config.clear }}>
      <ThreeCanvas
        width={width}
        height={height}
        linear={false}
        flat={false}
        shadows
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        onCreated={({ gl }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.BasicShadowMap;
        }}
      >
        <SoftShadows size={shadowSoftness(config)} />
        <ToneMapping tone={config.tone} />
        <RigCamera rig={config.camera} />
        <Scene config={config} />
      </ThreeCanvas>
      <Grade dof={config.dof} grade={config.grade} />
    </AbsoluteFill>
  );
};

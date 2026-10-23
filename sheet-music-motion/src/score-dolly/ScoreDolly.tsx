import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useCanvasAssets } from "../shared/useCanvasAssets";
import { SCORE_H, SCORE_W, buildGhostCanvas, buildScoreCanvas } from "./scoreTexture";
import { CameraShot, cameraForVariant, ScoreDollyVariant } from "./camera";
import { fragmentShader, vertexShader } from "./shaders";

const PAGE_W = 16;
const PAGE_H = (PAGE_W * SCORE_H) / SCORE_W;

type Assets = { score: THREE.CanvasTexture; ghost: THREE.CanvasTexture };

const Page: React.FC<{ assets: Assets; shot: CameraShot; seconds: number }> = ({
  assets,
  shot,
  seconds,
}) => {
  const { camera, gl, size } = useThree();

  const material = useMemo(() => {
    assets.score.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader,
      fragmentShader,
      uniforms: {
        uMap: { value: assets.score },
        uGhost: { value: assets.ghost },
        uRes: { value: new THREE.Vector2(1, 1) },
        uFocus: { value: 5 },
        uAperture: { value: 0.01 },
        uTime: { value: 0 },
        uLight: { value: new THREE.Vector4(0.4, 0.7, 0.35, 0.3) },
        uGhostOffset: { value: new THREE.Vector2(0, 0) },
        uExposure: { value: 1 },
      },
    });
  }, [assets, gl]);

  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = shot.fov;
    cam.near = 0.05;
    cam.far = 100;
    cam.position.set(...shot.position);
    cam.up.set(Math.sin(shot.roll), Math.cos(shot.roll), 0);
    cam.lookAt(...shot.target);
    cam.updateProjectionMatrix();
    const dpr = gl.getPixelRatio();
    const u = material.uniforms;
    u.uRes.value.set(size.width * dpr, size.height * dpr);
    u.uFocus.value = shot.focus;
    u.uAperture.value = shot.aperture;
    u.uTime.value = seconds;
    u.uLight.value.set(...shot.light);
    u.uGhostOffset.value.set(...shot.ghostOffset);
    u.uExposure.value = shot.exposure;
  }, [camera, gl, material, seconds, shot, size]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} material={material}>
      <planeGeometry args={[PAGE_W, PAGE_H]} />
    </mesh>
  );
};

export const ScoreDolly: React.FC<{ variant: ScoreDollyVariant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();

  const assets = useCanvasAssets<Assets>(() => {
    const score = new THREE.CanvasTexture(buildScoreCanvas(1254));
    score.colorSpace = THREE.NoColorSpace;
    score.generateMipmaps = true;
    score.minFilter = THREE.LinearMipmapLinearFilter;
    score.magFilter = THREE.LinearFilter;
    const ghost = new THREE.CanvasTexture(buildGhostCanvas(77));
    ghost.wrapS = THREE.RepeatWrapping;
    ghost.wrapT = THREE.RepeatWrapping;
    ghost.colorSpace = THREE.NoColorSpace;
    return { score, ghost };
  }, "score-dolly");

  const progress = frame / (durationInFrames - 1);
  const shot = cameraForVariant(variant, progress);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      {assets ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={typeof window === "undefined" ? 1 : window.devicePixelRatio}
          gl={{ antialias: false, toneMapping: THREE.NoToneMapping, outputColorSpace: THREE.LinearSRGBColorSpace }}
          flat
          linear
          camera={{ fov: shot.fov, position: shot.position, near: 0.05, far: 100 }}
        >
          <color attach="background" args={["#000000"]} />
          <Page assets={assets} shot={shot} seconds={frame / fps} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};

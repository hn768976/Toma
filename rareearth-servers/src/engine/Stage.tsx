import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import * as THREE from "three";
import { loadFonts } from "../lib/fonts";
import { Post, PostSettings } from "./Post";

export type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  near?: number;
  far?: number;
};

const CameraRig: React.FC<{ pose: CameraPose }> = ({ pose }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  // Layout effect: runs before @remotion/three advances the canvas for this frame.
  useLayoutEffect(() => {
    camera.position.set(...pose.position);
    camera.fov = pose.fov;
    camera.near = pose.near ?? 0.05;
    camera.far = pose.far ?? 60;
    camera.aspect = size.width / size.height;
    camera.up.set(0, 1, 0);
    camera.lookAt(...pose.target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  }, [camera, pose, size.width, size.height]);
  return null;
};

const SceneSetup: React.FC<{ background: string; shadows: boolean }> = ({ background, shadows }) => {
  const { gl, scene } = useThree();
  useLayoutEffect(() => {
    scene.background = new THREE.Color(background);
    gl.shadowMap.enabled = shadows;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    gl.shadowMap.autoUpdate = true;
    gl.toneMapping = THREE.NoToneMapping;
  }, [gl, scene, background, shadows]);
  return null;
};

export type StageProps = {
  camera: CameraPose;
  post: PostSettings;
  background: string;
  shadows?: boolean;
  children: React.ReactNode;
};

// Fonts (and therefore every canvas texture built from them) are ready before
// the canvas mounts, so frame 0 never sees a fallback font.
export const useAssetsReady = () => {
  const { delayRender, continueRender } = useDelayRender();
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading fonts"));
  useLayoutEffect(() => {
    loadFonts().then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [continueRender, handle]);
  return ready;
};

export const Stage: React.FC<StageProps> = ({ camera, post, background, shadows = true, children }) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const ready = useAssetsReady();
  if (!ready) return <AbsoluteFill style={{ backgroundColor: background }} />;
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={typeof window === "undefined" ? 1 : window.devicePixelRatio}
        flat
        gl={{
          antialias: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          alpha: false,
        }}
        camera={{ fov: camera.fov, near: 0.05, far: 60, position: camera.position }}
      >
        <SceneSetup background={background} shadows={shadows} />
        <CameraRig pose={camera} />
        <Post settings={post} frame={frame}>
          {children}
        </Post>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useLayoutEffect } from "react";
import { AbsoluteFill, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";
import * as THREE from "three";
import { PostFX, PostSettings } from "./PostFX";

export type CameraPose = {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  roll?: number; // radians
  near?: number;
  far?: number;
};

const CameraRig: React.FC<{ pose: CameraPose }> = ({ pose }) => {
  const { camera } = useThree();
  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = pose.fov;
    cam.near = pose.near ?? 0.1;
    cam.far = pose.far ?? 200;
    cam.position.set(...pose.position);
    cam.up.set(Math.sin(pose.roll ?? 0), Math.cos(pose.roll ?? 0), 0);
    cam.lookAt(new THREE.Vector3(...pose.target));
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
  }, [camera, pose]);
  return null;
};

/** Pixel ratio for the WebGL drawing buffer: the render's device scale when
 * rendering (so --scale=1/3 gives a true 1280x720 buffer), capped in Studio. */
export const useCanvasDpr = () => {
  const { isRendering } = useRemotionEnvironment();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return isRendering ? dpr : Math.min(dpr, 0.5);
};

export const ThreeStage: React.FC<{
  camera: CameraPose;
  post: PostSettings;
  children: React.ReactNode;
}> = ({ camera, post, children }) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();
  const dpr = useCanvasDpr();
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        linear
        flat
        gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance", alpha: false }}
        camera={{ fov: camera.fov, near: camera.near ?? 0.1, far: camera.far ?? 200, position: camera.position }}
      >
        <CameraRig pose={camera} />
        {children}
        <PostFX settings={post} frame={frame} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

/** Full-screen background quad drawn behind everything (depth ~ far plane). */
export const BG_VERT = /* glsl */ `
out vec2 vUv;
void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.99999, 1.0); }
`;

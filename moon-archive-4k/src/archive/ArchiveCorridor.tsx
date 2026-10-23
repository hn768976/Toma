import { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { ArchiveScene, buildArchiveScene, COL_W, EYE_H } from "./scene";

export type CameraMode = "reference" | "dollyZoomRoll";

// Reference: steady forward dolly, one cabinet column every 42 frames.
const REFERENCE_PERIOD_FRAMES = 42;

type CameraPose = {
  z: number;
  fov: number;
  roll: number;
  exposure: number;
};

const poseFor = (mode: CameraMode, frame: number, fps: number, duration: number): CameraPose => {
  // The reference footage gradually brightens by roughly 10% over the shot.
  const exposure = interpolate(frame, [0, duration - 1], [0.97, 1.15]);
  if (mode === "reference") {
    return {
      z: -(frame / REFERENCE_PERIOD_FRAMES) * COL_W,
      fov: 74,
      roll: 0,
      exposure,
    };
  }
  // Alternative: "vertigo" dolly zoom with a slow barrel roll. The camera
  // pushes in while the lens widens so that a plane 12 units ahead keeps its
  // framing, stretching the corridor walls around it.
  const progress = interpolate(frame, [0, duration - 1], [0, 1], {
    easing: Easing.inOut(Easing.cubic),
  });
  const travel = 9 * progress;
  const focusStart = 12;
  const halfStart = Math.tan(THREE.MathUtils.degToRad(28 / 2));
  const fov = THREE.MathUtils.radToDeg(
    2 * Math.atan((halfStart * focusStart) / (focusStart - travel)),
  );
  return {
    z: -travel - (frame / fps) * 0.08,
    fov,
    roll: THREE.MathUtils.degToRad(-20 * progress),
    exposure,
  };
};

export const ArchiveCorridor: React.FC<{ cameraMode: CameraMode }> = ({ cameraMode }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ArchiveScene | null>(null);

  useLayoutEffect(() => {
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!sceneRef.current) {
      sceneRef.current = buildArchiveScene(canvas, width, height);
    }
    const { renderer, scene, camera } = sceneRef.current;
    const pose = poseFor(cameraMode, frame, fps, durationInFrames);
    camera.position.set(0, EYE_H, pose.z);
    camera.fov = pose.fov;
    camera.aspect = width / height;
    camera.rotation.set(0, 0, pose.roll);
    camera.updateProjectionMatrix();
    renderer.toneMappingExposure = pose.exposure;
    renderer.render(scene, camera);
    renderer.getContext().finish();
  }, [frame, fps, durationInFrames, width, height, cameraMode]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#e9ebec" }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{ width: "100%", height: "100%" }}
      />
    </AbsoluteFill>
  );
};

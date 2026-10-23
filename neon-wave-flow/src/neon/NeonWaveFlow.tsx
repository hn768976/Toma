import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { Background } from "./Background";
import { CameraPose, CameraRigName, getCameraPose } from "./cameraRigs";
import { buildLines } from "./lines";
import { Ribbons } from "./Ribbons";

export type NeonWaveFlowProps = { rig: CameraRigName };

const CameraRig: React.FC<{ pose: CameraPose }> = ({ pose }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.position.set(...pose.position);
  camera.up.set(0, 1, 0);
  camera.lookAt(...pose.target);
  camera.rotateZ(pose.roll);
  if (camera.fov !== pose.fov) {
    camera.fov = pose.fov;
    camera.updateProjectionMatrix();
  }
  camera.updateMatrixWorld();
  return null;
};

export const NeonWaveFlow: React.FC<NeonWaveFlowProps> = ({ rig }) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  // The clip period: frame N (one past the end) equals frame 0.
  const duration = durationInFrames / fps;
  const pose = getCameraPose(rig, t, duration);
  const lines = useMemo(
    () => buildLines(2024, duration).filter((l) => rig === "lowTracking" || !l.foreground),
    [rig, duration],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#01030c" }}>
      <ThreeCanvas
        width={width}
        height={height}
        flat
        linear
        camera={{ fov: pose.fov, near: 0.05, far: 400 }}
        // Follow the render scale exactly (R3F clamps to >= 1 by default), so
        // a --scale=0.5 deliverable draws a 1080p buffer, not a 4K one.
        dpr={[0.25, 2]}
        gl={{ antialias: true, alpha: false }}
      >
        <CameraRig pose={pose} />
        <Background glow={pose.glow} strength={1} />
        <Ribbons
          lines={lines}
          t={t}
          camX={pose.position[0]}
          focus={pose.focus}
          aperture={pose.aperture}
        />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

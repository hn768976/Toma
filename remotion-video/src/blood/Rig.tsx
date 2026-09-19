import { useThree } from "@react-three/fiber";
import { useLayoutEffect } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import type { BloodLook, LightSpec } from "./looks";

/**
 * Camera motion.
 *
 * The sense of travel comes from the flow itself, so the camera only breathes:
 * a slow lateral drift, a touch of roll and a gentle dolly. That keeps the cell
 * slab centred on the lens for the whole clip — no matter how long it runs —
 * while still avoiding the locked-off look of a static render.
 */
export const CameraRig: React.FC<{ look: BloodLook }> = ({ look }) => {
  const camera = useThree((state) => state.camera);
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  useLayoutEffect(() => {
    const time = frame / fps;
    const clipLength = durationInFrames / fps;

    camera.position.set(
      Math.sin(time * 0.21 + 0.6) * look.cameraDrift,
      Math.cos(time * 0.17) * look.cameraDrift * 0.75,
      Math.sin((time / clipLength) * Math.PI * 2) * look.cameraDolly * 4,
    );
    camera.rotation.set(
      Math.cos(time * 0.13) * look.cameraDrift * 0.012,
      Math.sin(time * 0.11 + 1.2) * look.cameraDrift * 0.012,
      THREE.MathUtils.degToRad(Math.sin(time * 0.19) * look.cameraRoll),
    );
    (camera as THREE.PerspectiveCamera).fov = look.fov;
    camera.updateProjectionMatrix();
  }, [camera, frame, fps, durationInFrames, look.cameraDrift, look.cameraDolly, look.cameraRoll, look.fov]);

  return null;
};

export const Lights: React.FC<{ lights: LightSpec[] }> = ({ lights }) => (
  <>
    {lights.map((light, index) => {
      const key = `${light.kind}-${index}`;
      if (light.kind === "ambient") {
        return <ambientLight key={key} color={light.color} intensity={light.intensity} />;
      }
      if (light.kind === "directional") {
        return (
          <directionalLight
            key={key}
            color={light.color}
            intensity={light.intensity}
            position={light.position ?? [0, 0, 1]}
          />
        );
      }
      return (
        <pointLight
          key={key}
          color={light.color}
          intensity={light.intensity}
          position={light.position ?? [0, 0, 0]}
          distance={light.distance ?? 0}
          decay={light.decay ?? 2}
        />
      );
    })}
  </>
);

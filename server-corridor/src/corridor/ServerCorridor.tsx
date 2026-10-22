import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { MeshStandardMaterial, NoToneMapping, PerspectiveCamera } from "three";
import { z } from "zod";
import { zColor } from "@remotion/zod-types";
import {
  CAMERA_END_Z,
  CAMERA_FOV,
  CAMERA_START_Z,
  CAMERA_Y,
  END_WALL_Z,
  HALF_WIDTH,
} from "./layout";
import { MIDNIGHT_PALETTE, Palette, REFERENCE_PALETTE } from "./palette";
import { CorridorShell, useCorridorMaterials } from "./Corridor";

export const serverCorridorSchema = z.object({
  paletteName: z.enum(["reference", "midnight"]),
  ledBoost: z.number().min(0).max(4),
  vignetteColor: zColor(),
});

export type ServerCorridorProps = z.infer<typeof serverCorridorSchema>;

const PALETTES: Record<ServerCorridorProps["paletteName"], Palette> = {
  reference: REFERENCE_PALETTE,
  midnight: MIDNIGHT_PALETTE,
};

// Constant-speed dolly straight down the aisle, as in the reference.
const CameraRig: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  useLayoutEffect(() => {
    const t = frame / (durationInFrames - 1);
    camera.position.set(0, CAMERA_Y, CAMERA_START_Z + (CAMERA_END_Z - CAMERA_START_Z) * t);
    camera.rotation.set(0, 0, 0);
    camera.fov = CAMERA_FOV;
    camera.near = 0.05;
    camera.far = 80;
    camera.updateProjectionMatrix();
  }, [camera, frame, durationInFrames]);
  return null;
};

const Scene: React.FC<{ palette: Palette; ledBoost: number }> = ({ palette, ledBoost }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const m = useCorridorMaterials(palette, ledBoost);
  const floor = useMemo(
    () =>
      new MeshStandardMaterial({
        color: palette.floor,
        roughness: 0.35,
        transparent: true,
        opacity: palette.floorOpacity,
      }),
    [palette],
  );
  for (const g of m.glass) g.uniforms.uTime.value = frame / fps;

  return (
    <>
      <color attach="background" args={[palette.background]} />
      <ambientLight intensity={palette.ambient * Math.PI} />
      <hemisphereLight args={[palette.hemiSky, palette.hemiGround, palette.hemiIntensity * Math.PI]} />
      <CorridorShell m={m} />
      <group scale={[1, -1, 1]}>
        <CorridorShell m={m} />
      </group>
      <mesh material={floor} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, (END_WALL_Z + 8) / 2]} renderOrder={1}>
        <planeGeometry args={[HALF_WIDTH * 2 + 2, 8 - END_WALL_Z]} />
      </mesh>
      <CameraRig />
    </>
  );
};

export const ServerCorridor: React.FC<ServerCorridorProps> = ({ paletteName, ledBoost, vignetteColor }) => {
  const { width, height } = useVideoConfig();
  const palette = PALETTES[paletteName];
  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        linear={false}
        // Match the drawing buffer to the output size (e.g. --scale=0.5 -> 1080p)
        dpr={typeof window === "undefined" ? 1 : window.devicePixelRatio}
        gl={{ antialias: true, toneMapping: NoToneMapping }}
        camera={{ fov: CAMERA_FOV, position: [0, CAMERA_Y, CAMERA_START_Z], near: 0.05, far: 80 }}
      >
        <Scene palette={palette} ledBoost={ledBoost} />
      </ThreeCanvas>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse at center, transparent 55%, ${vignetteColor} 130%)`,
          opacity: palette.vignette,
        }}
      />
    </AbsoluteFill>
  );
};

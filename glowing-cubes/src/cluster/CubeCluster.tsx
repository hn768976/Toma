import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { Color } from "three";
import { paletteByName } from "../palettes";
import { baseColorsFor, tintFor } from "../shared/colors";
import { CubeField, type CubeState } from "../shared/CubeField";
import { Floor } from "../shared/Floor";
import { PostFX } from "../shared/PostFX";
import { CameraRig, Stage } from "../shared/Stage";
import {
  ALL_ON,
  CAM_FOV,
  CAM_TARGET,
  CLUSTER,
  CLUSTER_Y,
  type ClusterToggles,
  clusterCamera,
  clusterPoses,
  LOOP,
} from "./layout";

export type CubeClusterProps = {
  palette: string;
  /** debug: switch motion groups off to bisect a loop mismatch */
  toggles?: ClusterToggles;
  /** debug: don't wrap the frame with % 600 (proves the motion closes by itself) */
  noWrap?: boolean;
  /** debug: make the composition 601 frames long so frame 600 can be rendered */
  loopCheck?: boolean;
};

const BG = "#050506";
const FLOOR = "#1d1e22";

export const CubeCluster: React.FC<CubeClusterProps> = ({ palette: paletteName, toggles = ALL_ON, noWrap = false }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const palette = paletteByName(paletteName);

  const loopFrame = noWrap ? frame : frame % LOOP;
  const t = loopFrame / LOOP;

  const baseColors = useMemo(() => baseColorsFor(palette), [palette]);
  const tints = useMemo(() => CLUSTER.map((c) => tintFor(palette, c.type, c.tone)), [palette]);

  const { cubes, camPos } = useMemo(() => {
    const poses = clusterPoses(t, toggles);
    const cubes: CubeState[] = CLUSTER.map((c, i) => ({
      type: c.type,
      pos: poses[i].pos,
      quat: poses[i].quat,
      scale: poses[i].scale,
      tint: tints[i],
      glow: poses[i].glow,
    }));
    return { cubes, camPos: clusterCamera(t, toggles) };
  }, [t, toggles, tints]);

  const lightColor = useMemo(() => new Color(palette.glow[1]), [palette]);

  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={typeof window === "undefined" ? 1 : window.devicePixelRatio}
        gl={{ antialias: false, powerPreference: "high-performance", preserveDrawingBuffer: true }}
        camera={{ fov: CAM_FOV, near: 0.1, far: 200, position: [0, 10, 20] }}
      >
        <color attach="background" args={[BG]} />
        <fog attach="fog" args={[BG, 26, 62]} />
        <Stage envIntensity={0.3} envRotationY={0.6}>
          <CameraRig position={camPos} target={CAM_TARGET} fov={CAM_FOV} />
          {/* soft spotlight pool under the cluster */}
          <spotLight
            position={[0, 16, 2]}
            angle={0.42}
            penumbra={1}
            intensity={240}
            decay={2}
            color="#fff6ee"
            target-position={[0, 0, 0]}
          />
          {/* tinted spill from the glowing cubes */}
          <pointLight position={[0, CLUSTER_Y, 0]} intensity={5} decay={2} color={lightColor} />
          <ambientLight intensity={0.04} />
          <Floor color={FLOOR} mixStrength={0.15} envMapIntensity={0.22} fade={10} />
          <CubeField cubes={cubes} cameraPos={camPos} baseColors={baseColors} />
          <PostFX grainFrame={toggles.grain ? loopFrame % LOOP : 0} vignette={0.7} bloomIntensity={1.5} bloomRadius={0.8} />
        </Stage>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

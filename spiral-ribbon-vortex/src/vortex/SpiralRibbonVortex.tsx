import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { buildGrooveTexture, buildLayeredSpiral, type SpiralSpec } from "./geometry";
import { CAMERA_MOVES, type CameraMoveName, type CameraPose } from "./camera";

export type SpiralRibbonVortexProps = {
  cameraMove: CameraMoveName;
};

export const PALETTE = {
  bgTop: "#7d4fd0",
  bgBottom: "#9a5fc4",
  fog: "#8458d2",
  tail: "#ff9a3c",
  mid: "#e7a2dc",
  core: "#7c62f0",
} as const;

type Layer = "near" | "far";

type VortexInstance = {
  layer: Layer;
  spec: SpiralSpec;
  position: readonly [number, number, number];
  rotation: readonly [number, number, number];
  /** spin amplitude (radians) of the looping oscillation about the axis */
  spinAmp: number;
  spinPhase: number;
};

const VORTICES: VortexInstance[] = [
  // Hero vortex, centre-right; its orange tail rises up out of frame.
  {
    layer: "near",
    spec: {
      r0: 3.3,
      tighten: 0.085,
      depthPerRad: 0.3,
      width: 2.6,
      thetaStart: -4.2,
      thetaEnd: 7 * Math.PI,
      layers: 10,
      colors: [PALETTE.tail, PALETTE.mid, PALETTE.core],
      colorStops: [3.6, 7.6],
    },
    position: [1.3, -0.7, 0],
    rotation: [0.42, -0.62, 0.75],
    spinAmp: 0.2,
    spinPhase: 0,
  },
  // Secondary vortex, left and a little further back, with its own orange tail.
  {
    layer: "near",
    spec: {
      r0: 3.0,
      tighten: 0.085,
      depthPerRad: 0.3,
      width: 2.4,
      thetaStart: -4.0,
      thetaEnd: 7 * Math.PI,
      layers: 9,
      colors: [PALETTE.tail, "#dca4e2", PALETTE.core],
      colorStops: [1.2, 5.2],
    },
    position: [-4.3, 0.9, -2.6],
    rotation: [-0.3, 0.7, 3.6],
    spinAmp: -0.16,
    spinPhase: 0.7,
  },
  // Distant vortex, top-right background (layered streaks behind the tail).
  {
    layer: "far",
    spec: {
      r0: 3.6,
      tighten: 0.09,
      depthPerRad: 0.4,
      width: 3.4,
      thetaStart: -3.2,
      thetaEnd: 4.5 * Math.PI,
      layers: 8,
      colors: ["#c9a0f0", "#9c7ef0", "#6f55e6"],
      colorStops: [0.5, 3.0],
    },
    position: [5.0, -0.2, -5.0],
    rotation: [0.25, -0.5, 4.0],
    spinAmp: 0.15,
    spinPhase: 1.9,
  },
  // Low-left far vortex.
  {
    layer: "far",
    spec: {
      r0: 3.2,
      tighten: 0.1,
      depthPerRad: 0.4,
      width: 3.0,
      thetaStart: -3.2,
      thetaEnd: 4.5 * Math.PI,
      layers: 8,
      colors: ["#f0a87a", "#a382ef", "#6a52e2"],
      colorStops: [0.4, 3.0],
    },
    position: [-4.6, -4.4, -6.0],
    rotation: [-0.2, 0.4, 1.1],
    spinAmp: 0.12,
    spinPhase: 3.1,
  },
  // Huge backdrop coil far behind everything so no flat background shows.
  {
    layer: "far",
    spec: {
      r0: 16,
      tighten: 0.075,
      depthPerRad: 0.7,
      width: 12,
      thetaStart: -2.5,
      thetaEnd: 5 * Math.PI,
      layers: 8,
      colors: ["#c99ef0", "#9b7ef2", "#6a50e0"],
      colorStops: [0.8, 4.0],
    },
    position: [-1.0, 0.5, -13],
    rotation: [0.15, 0.1, 0.6],
    spinAmp: 0.08,
    spinPhase: 0.4,
  },
];

const CameraRig: React.FC<{ pose: CameraPose }> = ({ pose }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    camera.position.set(...pose.position);
    camera.up.set(Math.sin(pose.roll), Math.cos(pose.roll), 0);
    camera.lookAt(...pose.target);
    camera.fov = pose.fov;
    camera.near = 0.1;
    camera.far = 120;
    camera.updateProjectionMatrix();
  }, [camera, pose]);
  return null;
};

const Vortex: React.FC<{ v: VortexInstance; loop: number; groove: THREE.Texture }> = ({
  v,
  loop,
  groove,
}) => {
  const geometry = useMemo(() => buildLayeredSpiral(v.spec), [v.spec]);
  const spin = v.spinAmp * Math.sin(loop * Math.PI * 2 + v.spinPhase);
  return (
    <group
      position={v.position as [number, number, number]}
      rotation={v.rotation as [number, number, number]}
    >
      <mesh geometry={geometry} rotation={[0, 0, spin]}>
        <meshStandardMaterial
          vertexColors
          map={groove}
          side={THREE.DoubleSide}
          roughness={0.74}
          metalness={0.05}
        />
      </mesh>
    </group>
  );
};

const Lights: React.FC<{ loop: number }> = ({ loop }) => {
  // subtle breathing of the key light along the loop
  const key = interpolate(Math.sin(loop * Math.PI * 2), [-1, 1], [1.7, 2.05]);
  return (
    <>
      <ambientLight intensity={0.85} color="#ffffff" />
      <hemisphereLight args={["#f8dcff", "#8a6ff0", 1.25]} />
      <directionalLight position={[-6, 8, 9]} intensity={key} color="#ffe6ef" />
      <directionalLight position={[7, -3, 4]} intensity={0.8} color="#a08cff" />
      <pointLight position={[1.4, -0.8, -2.5]} intensity={16} distance={16} decay={1.6} color="#b9a0ff" />
    </>
  );
};

/**
 * One R3F canvas holding a subset of the vortices. Two of these are stacked:
 * the "far" one is blurred with a CSS filter (fake depth of field) and the
 * "near" one is drawn sharp on a transparent background above it.
 */
const LayerCanvas: React.FC<{
  layer: Layer;
  pose: CameraPose;
  loop: number;
  blurPx: number;
}> = ({ layer, pose, loop, blurPx }) => {
  const { width, height } = useVideoConfig();
  const groove = useMemo(() => buildGrooveTexture(), []);
  return (
    <AbsoluteFill style={{ filter: blurPx > 0 ? `blur(${blurPx}px)` : undefined }}>
      <ThreeCanvas
        width={width}
        height={height}
        // Follow Remotion's --scale (device pixel ratio) so a 4K composition
        // rendered with --scale=0.5 is drawn natively at 1920x1080.
        dpr={typeof window === "undefined" ? 1 : window.devicePixelRatio}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.08;
          gl.setClearColor(0x000000, 0);
        }}
      >
        <fog attach="fog" args={[PALETTE.fog, 6, 40]} />
        <CameraRig pose={pose} />
        <Lights loop={loop} />
        {VORTICES.filter((v) => v.layer === layer).map((v, i) => (
          <Vortex key={i} v={v} loop={loop} groove={groove} />
        ))}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

/**
 * Layered spiral ribbons (Three.js via @remotion/three) at native 4K.
 * In the reference-matching version everything moves on a sine loop over the
 * clip, so the last frame flows back into the first.
 */
export const SpiralRibbonVortex: React.FC<SpiralRibbonVortexProps> = ({ cameraMove }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width } = useVideoConfig();
  const loop = frame / durationInFrames; // 0..1 (exclusive) -> seamless loop
  const pose = CAMERA_MOVES[cameraMove](loop);
  // CSS px are composition px, so the blur scales with the 4K frame.
  const farBlur = (width / 3840) * 14;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(120% 100% at 40% 35%, ${PALETTE.bgTop} 0%, ${PALETTE.bgBottom} 100%)`,
      }}
    >
      <LayerCanvas layer="far" pose={pose} loop={loop} blurPx={farBlur} />
      <LayerCanvas layer="near" pose={pose} loop={loop} blurPx={0} />
    </AbsoluteFill>
  );
};

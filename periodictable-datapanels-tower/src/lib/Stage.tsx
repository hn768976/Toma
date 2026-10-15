import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useRemotionEnvironment, useVideoConfig } from "remotion";
import * as THREE from "three";
import { type Assets, useAssets } from "./assets";
import { Pipeline, type PostParams } from "./pipeline";

// All colours are authored as display (sRGB) values and pass through
// untouched: no colour management, no tone mapping.
THREE.ColorManagement.enabled = false;

export type Look = {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  // Pose everything for this frame. Must be a pure function of `frame`.
  update: (frame: number) => PostParams;
  dispose: () => void;
};

export type LookFactory = (ctx: { gl: THREE.WebGLRenderer; assets: Assets; aspect: number }) => Look;

const Runner: React.FC<{ factory: LookFactory; assets: Assets; frame: number; grainPeriod: number }> = ({
  factory,
  assets,
  frame,
  grainPeriod,
}) => {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);
  const look = useMemo(
    () => factory({ gl, assets, aspect: size.width / size.height }),
    [factory, gl, assets, size.width, size.height],
  );
  const pipe = useMemo(() => new Pipeline(gl), [gl]);
  useEffect(() => () => look.dispose(), [look]);
  useEffect(() => () => pipe.dispose(), [pipe]);

  // Only the current frame number is read here – nothing carries over.
  const frameRef = useRef(frame);
  frameRef.current = frame;
  useFrame(() => {
    const f = frameRef.current;
    const post = look.update(f);
    pipe.render(look.scene, look.camera, ((f % grainPeriod) + grainPeriod) % grainPeriod, post);
  }, 1);
  return null;
};

export const Stage: React.FC<{
  factory: LookFactory;
  needLand?: boolean;
  background: string;
  // Frame count the grain pattern repeats over (= composition length, so a
  // loop's frame N renders identically to frame 0).
  grainPeriod: number;
}> = ({ factory, needLand = false, background, grainPeriod }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  const assets = useAssets(needLand);
  // When rendering, draw at exactly the requested output scale (`--scale`
  // sets devicePixelRatio). In the Studio, cap it so playback stays usable.
  const dpr = typeof window === "undefined" ? 1 : isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 0.5);
  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      {assets ? (
        <ThreeCanvas
          width={width}
          height={height}
          linear
          flat
          // legacy: stop R3F re-enabling THREE.ColorManagement, so hex colours
          // render exactly as authored
          legacy
          dpr={dpr}
          gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        >
          <Runner factory={factory} assets={assets} frame={frame} grainPeriod={grainPeriod} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};

import React, { useEffect, useMemo, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { Grain, Vignette } from "./Grain";
import { loadMonoFont } from "./lib/font";
import { PALETTES, Palette } from "./scene/palette";
import { buildLayout } from "./scene/layout";
import { CameraPose, cameraPoseAt } from "./scene/cameraPath";
import { Backdrop } from "./scene/Backdrop";
import { Floor } from "./scene/Floor";
import { Towers } from "./scene/Towers";
import { Debris } from "./scene/Debris";
import { DURATION_IN_FRAMES } from "./constants";

export const LAYOUT_SEED = 20250904;
export const DEBRIS_SEED = 77123;
export const CAMERA_FOV = 46;

const _target = new THREE.Vector3();

/**
 * Camera pose is a pure function of the frame — no useFrame, no clock, no delta
 * accumulation. Remotion renders frames out of order across threads.
 */
const Rig: React.FC<{ pose: CameraPose }> = ({ pose }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
  camera.up.set(Math.sin(pose.roll), Math.cos(pose.roll), 0);
  _target.set(pose.lookAt[0], pose.lookAt[1], pose.lookAt[2]);
  camera.lookAt(_target);
  camera.fov = CAMERA_FOV;
  camera.near = 0.1;
  camera.far = 900;
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);

  return null;
};

const Scene: React.FC<{ palette: Palette; frame: number }> = ({ palette, frame }) => {
  const layout = useMemo(() => buildLayout(LAYOUT_SEED), []);
  const pose = cameraPoseAt(frame / DURATION_IN_FRAMES);

  return (
    <>
      <Rig pose={pose} />
      <Backdrop palette={palette} />
      <Floor palette={palette} />
      <Towers
        layout={layout}
        palette={palette}
        frame={frame}
        camX={pose.position[0]}
        camZ={pose.position[2]}
      />
      <Debris palette={palette} frame={frame} seed={DEBRIS_SEED} />
    </>
  );
};

export type BinaryTowersProps = {
  variant: "blue" | "mono";
};

export const BinaryTowers: React.FC<BinaryTowersProps> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const palette = PALETTES[variant];
  const [fontReady, setFontReady] = useState(false);
  const [fontHandle] = useState(() => delayRender("Loading the embedded monospace font"));

  useEffect(() => {
    let alive = true;
    loadMonoFont().then(() => {
      if (alive) setFontReady(true);
      continueRender(fontHandle);
    });
    return () => {
      alive = false;
    };
  }, [fontHandle]);

  return (
    <AbsoluteFill style={{ backgroundColor: palette.bgFar }}>
      {fontReady ? (
        <ThreeCanvas
          width={width}
          height={height}
          orthographic={false}
          // `legacy` turns three's colour management off (react-three-fiber owns
          // that flag, so setting it directly does not stick). Every colour here
          // is an authored sRGB hex and the towers are hand-drawn canvases, so
          // there is no lighting for a linear workflow to be more correct about.
          // With it on, a raw ShaderMaterial writes linear values into an sRGB
          // framebuffer without the matching encode and the backdrop lands about
          // six times darker than the palette says.
          legacy
          camera={{ fov: CAMERA_FOV, near: 0.1, far: 900 }}
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NoToneMapping;
            gl.outputColorSpace = THREE.SRGBColorSpace;
          }}
        >
          <Scene palette={palette} frame={frame} />
        </ThreeCanvas>
      ) : null}
      <Vignette />
      <Grain frame={frame} />
    </AbsoluteFill>
  );
};

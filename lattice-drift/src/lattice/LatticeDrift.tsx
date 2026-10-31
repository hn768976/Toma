import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { smoothstep } from "../random";
import { Bars } from "./Bars";
import { CameraPose, CameraRig } from "./CameraRig";
import { FIELD_RADIUS, LOOP_PERIOD_Z, Palette } from "./constants";
import { generatePieces } from "./pieces";
import { StripeGround } from "./StripeGround";

export type LatticeVariant = "reference" | "crane";

export type LatticeDriftProps = {
  variant: LatticeVariant;
  palette: Palette;
  seed: number;
};

const DEG = Math.PI / 180;
// Visible width of the reference framing, in grid units. Together with
// LOOP_PERIOD_Z it reproduces the reference drift measured with phase
// correlation: 1.04 px/frame at 768 px wide, heading 40 deg up-right
// (5.5 units * 0.923 projected * 768/13.85 px/unit = 281 px over 270 frames).
const VIEW_WIDTH = 13.85;
const BASE_AZIMUTH = 45 * DEG;

const orbitPosition = (
  target: THREE.Vector3,
  azimuth: number,
  elevation: number,
  distance: number,
) =>
  new THREE.Vector3(
    target.x + Math.cos(elevation) * Math.sin(azimuth) * distance,
    target.y + Math.sin(elevation) * distance,
    target.z + Math.cos(elevation) * Math.cos(azimuth) * distance,
  );

const referencePose = (
  frame: number,
  durationInFrames: number,
  width: number,
): CameraPose => {
  // The camera travels exactly one field period along +Z over the clip, so
  // frame N would equal frame 0: a seamless loop like the reference. On
  // screen the lattice drifts up and to the right.
  const offset = new THREE.Vector3(
    0,
    0,
    LOOP_PERIOD_Z * (frame / durationInFrames - 0.5),
  );
  const target = new THREE.Vector3(0, 0, 0).add(offset);
  return {
    position: orbitPosition(target, BASE_AZIMUTH, 57 * DEG, 80),
    target,
    zoom: width / VIEW_WIDTH,
  };
};

// Alternative: a low, sweeping perspective crane move that orbits the
// lattice so the depth of the structures reads strongly.
const cranePose = (frame: number, durationInFrames: number): CameraPose => {
  const t = frame / (durationInFrames - 1);
  const e = smoothstep(0, 1, t) * 0.65 + t * 0.35; // eased but never static
  const target = new THREE.Vector3(-1.5 + 3 * e, 0.3, 1.1 - 2.2 * e);
  const azimuth = BASE_AZIMUTH - 34 * DEG + 70 * DEG * e;
  const elevation = (58 - 22 * e) * DEG;
  const distance = 13 - 2.8 * e;
  return {
    position: orbitPosition(target, azimuth, elevation, distance),
    target,
    fov: 34,
  };
};

const Lights: React.FC<{ palette: Palette }> = ({ palette }) => {
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight(
      palette.keyLight,
      palette.keyIntensity,
    );
    l.position.set(-4, 30, 9);
    l.target.position.set(0, 0, 0);
    l.castShadow = true;
    l.shadow.mapSize.set(2048, 2048);
    const r = FIELD_RADIUS + 4;
    const cam = l.shadow.camera;
    cam.left = -r;
    cam.right = r;
    cam.top = r;
    cam.bottom = -r;
    cam.near = 1;
    cam.far = 90;
    l.shadow.bias = -0.0006;
    l.shadow.normalBias = 0.0;
    // Variance shadow maps give the broad, soft contact shadows of the
    // reference's area-light look.
    l.shadow.radius = 10;
    l.shadow.blurSamples = 16;
    return l;
  }, [palette.keyLight, palette.keyIntensity]);

  return (
    <>
      <primitive object={light} />
      <primitive object={light.target} />
      <hemisphereLight
        args={[palette.sky, palette.groundBounce, palette.hemiIntensity]}
      />
      <ambientLight intensity={palette.ambientIntensity} />
    </>
  );
};

export const LatticeDrift: React.FC<LatticeDriftProps> = ({
  variant,
  palette,
  seed,
}) => {
  const frame = useCurrentFrame();
  const { width, height, fps, durationInFrames } = useVideoConfig();
  const pieces = useMemo(() => generatePieces(seed), [seed]);
  const time = frame / fps;

  const pose = useMemo(
    () =>
      variant === "reference"
        ? referencePose(frame, durationInFrames, width)
        : cranePose(frame, durationInFrames),
    [variant, frame, durationInFrames, width],
  );

  return (
    <AbsoluteFill style={{ backgroundColor: palette.background }}>
      <ThreeCanvas
        width={width}
        height={height}
        orthographic={variant === "reference"}
        shadows="variance"
        flat
        dpr={1}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
      >
        <color attach="background" args={[palette.background]} />
        {variant === "crane" ? (
          <fog attach="fog" args={[palette.background, 13, 27]} />
        ) : null}
        <CameraRig pose={pose} />
        <Lights palette={palette} />
        <StripeGround palette={palette} angle={90 * DEG} />
        <Bars pieces={pieces} time={time} palette={palette} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

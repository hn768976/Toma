import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";
import {
  createKeycapGeometry,
  KEY_TOP_SIZE,
  KEY_TOP_Y,
  KEY_TOP_Z,
} from "./keycap";
import { createLabelTexture, useLabelFont } from "./labels";

export type KeyboardVariant = "match" | "orbit";

const PITCH = 1;
const GRID_ANGLE = THREE.MathUtils.degToRad(6);
const PRESS_DEPTH = 0.17;

const COLORS = {
  background: "#00101c",
  plate: "#000d17",
  noKey: "#004a63",
  noLabel: "#2a7ca3",
  yesKey: "#ffbf1a",
  yesLabel: "#120d02",
};

// Key travel measured from the reference: eased press, short hold, quicker release.
const pressAmount = (frame: number) => {
  if (frame < 88) {
    return interpolate(frame, [71, 88], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.sin),
    });
  }
  return interpolate(frame, [90, 98], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.sin),
  });
};

type CameraPose = {
  azimuth: number;
  elevation: number;
  distance: number;
  fov: number;
  roll: number;
  target: [number, number, number];
};

const MATCH_POSE: CameraPose = {
  azimuth: 6,
  elevation: 42,
  distance: 4.85,
  fov: 26,
  roll: -12,
  target: [0.02, 0.3, -0.3],
};

const cameraPose = (variant: KeyboardVariant, frame: number): CameraPose => {
  if (variant === "match") {
    return MATCH_POSE;
  }
  // Alternative: a slow orbit that pushes in on the YES key and settles as it is pressed.
  const t = interpolate(frame, [0, 169], [0, 1], {
    easing: Easing.bezier(0.33, 0, 0.25, 1),
  });
  return {
    azimuth: interpolate(t, [0, 1], [-38, 14]),
    elevation: interpolate(t, [0, 1], [30, 52]),
    distance: interpolate(t, [0, 1], [5.4, 3.2]),
    fov: 30,
    roll: interpolate(t, [0, 1], [-4, -12]),
    target: [
      interpolate(t, [0, 1], [-0.6, 0.05]),
      0.2,
      interpolate(t, [0, 1], [0.3, -0.1]),
    ],
  };
};

const CameraRig: React.FC<{ pose: CameraPose }> = ({ pose }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  useLayoutEffect(() => {
    const az = THREE.MathUtils.degToRad(pose.azimuth);
    const el = THREE.MathUtils.degToRad(pose.elevation);
    const [tx, ty, tz] = pose.target;
    camera.position.set(
      tx + pose.distance * Math.cos(el) * Math.sin(az),
      ty + pose.distance * Math.sin(el),
      tz + pose.distance * Math.cos(el) * Math.cos(az),
    );
    camera.fov = pose.fov;
    camera.near = 0.05;
    camera.far = 100;
    camera.lookAt(tx, ty, tz);
    camera.rotateZ(THREE.MathUtils.degToRad(pose.roll));
    camera.updateProjectionMatrix();
  }, [camera, pose]);
  return null;
};

const Keys: React.FC<{ press: number }> = ({ press }) => {
  const geometry = useMemo(() => createKeycapGeometry(), []);
  const noMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: COLORS.noKey,
        roughness: 0.7,
        metalness: 0,
        specularColor: new THREE.Color("#3aa8ff"),
        specularIntensity: 0.7,
      }),
    [],
  );
  const yesMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: COLORS.yesKey,
        emissive: new THREE.Color("#5e3a00"),
        roughness: 0.42,
        metalness: 0,
      }),
    [],
  );
  const noLabel = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: createLabelTexture("NO", COLORS.noLabel, 400),
        transparent: true,
        roughness: 0.7,
        specularColor: new THREE.Color("#3aa8ff"),
        specularIntensity: 0.7,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  );
  const yesLabel = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: createLabelTexture("YES", COLORS.yesLabel, 360),
        transparent: true,
        roughness: 0.42,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    [],
  );
  const labelGeo = useMemo(
    () => new THREE.PlaneGeometry(KEY_TOP_SIZE, KEY_TOP_SIZE),
    [],
  );

  const cells = useMemo(() => {
    const out: { i: number; j: number }[] = [];
    for (let i = -8; i <= 8; i++) {
      for (let j = -8; j <= 8; j++) {
        out.push({ i, j });
      }
    }
    return out;
  }, []);

  return (
    <group rotation={[0, GRID_ANGLE, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[40, 40]} />
        <meshStandardMaterial color={COLORS.plate} roughness={0.9} />
      </mesh>
      {cells.map(({ i, j }) => {
        const isYes = i === 0 && j === 0;
        const y = isYes ? -press * PRESS_DEPTH : 0;
        return (
          <group key={`${i}:${j}`} position={[i * PITCH, y, j * PITCH]}>
            <mesh
              geometry={geometry}
              material={isYes ? yesMaterial : noMaterial}
              castShadow
              receiveShadow
            />
            <mesh
              geometry={labelGeo}
              material={isYes ? yesLabel : noLabel}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[0, KEY_TOP_Y + 0.002, KEY_TOP_Z]}
            />
          </group>
        );
      })}
    </group>
  );
};

export const KeyboardScene: React.FC<{ variant: KeyboardVariant }> = ({
  variant,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const fontReady = useLabelFont();
  const pose = cameraPose(variant, frame);
  const press = pressAmount(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.background }}>
      {fontReady ? (
        <ThreeCanvas
          width={width}
          height={height}
          shadows
          flat
          gl={{ antialias: true, preserveDrawingBuffer: true }}
          camera={{ fov: pose.fov, position: [0, 4, 4] }}
        >
          <CameraRig pose={pose} />
          <color attach="background" args={[COLORS.background]} />
          <hemisphereLight args={["#d8f0ff", "#000000", 0.3]} />
          <directionalLight
            position={[-4.5, 6.5, 3.2]}
            intensity={2.6}
            color="#ffffff"
            castShadow
            shadow-mapSize-width={4096}
            shadow-mapSize-height={4096}
            shadow-camera-left={-8}
            shadow-camera-right={8}
            shadow-camera-top={8}
            shadow-camera-bottom={-8}
            shadow-bias={-0.0004}
            shadow-normalBias={0.02}
          />
          <directionalLight position={[3, 3, 5]} intensity={0.45} color="#cfeaff" />
          <Keys press={press} />
        </ThreeCanvas>
      ) : null}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 75% 70% at 50% 48%, rgba(0,0,0,0) 55%, rgba(0,6,14,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

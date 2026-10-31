import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { StudioEnvironment } from "../common/Environment";
import { easeInOutSine, interpolateKeys, lerp, Vec3 } from "../common/math";
import { PostFX } from "../common/PostFX";
import { makeRadialTexture } from "../common/textures";
import { GlowPalette } from "./palettes";
import {
  ARROW_END,
  ARROW_TAIL,
  arrowReach,
  BAR_COUNT,
  BAR_DEPTH,
  BAR_HEIGHTS,
  BAR_WIDTH,
  barProgress,
  barX,
} from "./timeline";

/* ------------------------------------------------------------------ camera */

type CamKey = {
  t: number;
  pos: Vec3;
  target: Vec3;
  fov: number;
  roll: number;
  /** Lens shift: horizontal position of the optical centre (0.5 = centred). */
  shift: number;
};

/**
 * Continuous slow move matching the reference: starts frontal and slightly
 * high with the chart on the left, then drifts in, drops low and tilts up so
 * the bars loom and lean in the wide-angle frame.
 */
const CAMERA_KEYS: CamKey[] = [
  { t: 0, pos: [1.5, 3.3, 13.2], target: [1.5, 2.5, 0], fov: 27, roll: 0, shift: 0.5 },
  { t: 4.5, pos: [1.3, 3.6, 12.0], target: [1.0, 2.65, 0], fov: 31, roll: 0, shift: 0.5 },
  { t: 7, pos: [1.9, 3.9, 10.6], target: [1.9, 2.45, 0], fov: 38, roll: 0.02, shift: 0.56 },
  { t: 10, pos: [3.9, 4.9, 9.0], target: [3.9, 2.45, 0], fov: 47, roll: 0.05, shift: 0.68 },
  { t: 15, pos: [5.5, 6.0, 7.4], target: [5.5, 2.5, 0.4], fov: 58, roll: 0.06, shift: 0.8 },
];

const sampleCamera = (t: number) => {
  const ts = CAMERA_KEYS.map((k) => k.t);
  const ch = (f: (k: CamKey) => number) =>
    interpolateKeys(t, ts, CAMERA_KEYS.map(f), easeInOutSine);
  return {
    pos: [ch((k) => k.pos[0]), ch((k) => k.pos[1]), ch((k) => k.pos[2])] as Vec3,
    target: [
      ch((k) => k.target[0]),
      ch((k) => k.target[1]),
      ch((k) => k.target[2]),
    ] as Vec3,
    fov: ch((k) => k.fov),
    roll: ch((k) => k.roll),
    shift: ch((k) => k.shift),
  };
};

const CameraRig: React.FC<{ t: number }> = ({ t }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const c = sampleCamera(t);
  // Shifted lens (like a tilt-shift / off-centre crop): the frame is the left
  // part of a wider virtual frame, so verticals converge toward a vanishing
  // point on the right as in the reference's late, looking-down shots.
  const fullW = size.width * 2 * c.shift;
  camera.aspect = fullW / size.height;
  camera.setViewOffset(fullW, size.height, 0, 0, size.width, size.height);
  camera.position.set(...c.pos);
  camera.up.set(0, 1, 0);
  camera.lookAt(...c.target);
  camera.rotateZ(c.roll);
  camera.fov = c.fov;
  camera.near = 0.1;
  camera.far = 200;
  camera.updateProjectionMatrix();
  return null;
};

/* ------------------------------------------------------------------ floor */

const FLOOR_RADIUS = 15;
const FLOOR_CENTER = new THREE.Vector2(0.5, -4.5);

const floorVert = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const floorFrag = /* glsl */ `
uniform vec3 uFloor;
uniform vec3 uGlow;
uniform vec3 uHot;
uniform float uHotStrength;
uniform vec2 uCenter;
uniform float uRadius;
uniform vec4 uBars[7];
varying vec3 vWorld;
void main() {
  vec2 p = vWorld.xz;
  float d = length(p - uCenter);
  float edge = 1.0 - smoothstep(uRadius - 0.9, uRadius, d);
  // stage reads brighter toward its far rim, dark under the camera
  float rim = smoothstep(uRadius * 0.15, uRadius * 0.98, d);
  float back = smoothstep(2.5, -9.0, vWorld.z);
  vec3 col = uFloor * (0.018 + 0.16 * rim * (0.45 + 0.55 * back));
  // light pooling at each bar's base
  for (int i = 0; i < 7; i++) {
    vec2 q = p - uBars[i].xy;
    float g = exp(-(q.x * q.x) / 0.55 - (q.y * q.y) / 0.9);
    float halo = exp(-(q.x * q.x) / 2.6 - (q.y * q.y) / 4.0);
    col += uGlow * uBars[i].z * (1.35 * g + 0.22 * halo);
  }
  // white hot-spot in front of the chart, revealed as the camera drops
  vec2 h = p - vec2(0.9, 2.6);
  col += uHot * uHotStrength * exp(-dot(h, h) / 2.2);
  gl_FragColor = vec4(col, edge * 0.8);
}`;

const Floor: React.FC<{ palette: GlowPalette; t: number; hot: number }> = ({
  palette,
  t,
  hot,
}) => {
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: floorVert,
        fragmentShader: floorFrag,
        transparent: true,
        depthWrite: true,
        uniforms: {
          uFloor: { value: new THREE.Color(palette.floor) },
          uGlow: { value: new THREE.Color(palette.glow) },
          uHot: { value: new THREE.Color(palette.hotspot) },
          uHotStrength: { value: 0 },
          uCenter: { value: FLOOR_CENTER },
          uRadius: { value: FLOOR_RADIUS },
          uBars: {
            value: Array.from({ length: 7 }, () => new THREE.Vector4()),
          },
        },
      }),
    [palette],
  );
  useEffect(() => () => material.dispose(), [material]);

  const bars = material.uniforms.uBars.value as THREE.Vector4[];
  for (let i = 0; i < BAR_COUNT; i++) {
    const p = barProgress(i, t);
    bars[i].set(barX(i), 0, p > 0 ? 0.25 + 0.75 * p : 0, 0);
  }
  material.uniforms.uHotStrength.value = hot;

  return (
    <mesh
      rotation-x={-Math.PI / 2}
      position={[FLOOR_CENTER.x, 0, FLOOR_CENTER.y]}
      material={material}
      renderOrder={1}
    >
      <circleGeometry args={[FLOOR_RADIUS, 160]} />
    </mesh>
  );
};

/* ------------------------------------------------------------------ bars */

const luminanceCompensation = (hex: string) => {
  const c = new THREE.Color(hex); // linear
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  return l > 0.45 ? Math.pow(0.45 / l, 1.6) : 1;
};

const barGeometry = new THREE.BoxGeometry(BAR_WIDTH, 1, BAR_DEPTH).translate(
  0,
  0.5,
  0,
);

const Bars: React.FC<{
  palette: GlowPalette;
  t: number;
  reflection?: boolean;
}> = ({ palette, t, reflection }) => {
  const materials = useMemo(
    () =>
      palette.bars.map(
        (c) =>
          new THREE.MeshStandardMaterial({
            color: c,
            emissive: c,
            // keep very luminous hues (e.g. cyan) from blowing out under bloom
            emissiveIntensity:
              (reflection ? 0.3 : 0.5) * luminanceCompensation(c),
            roughness: 0.32,
            metalness: 0.05,
            envMapIntensity: 0.35,
            transparent: reflection,
            opacity: reflection ? 0.55 : 1,
            side: reflection ? THREE.BackSide : THREE.FrontSide,
            depthWrite: !reflection,
          }),
      ),
    [palette, reflection],
  );
  useEffect(() => () => materials.forEach((m) => m.dispose()), [materials]);

  return (
    <group scale={[1, reflection ? -1 : 1, 1]}>
      {BAR_HEIGHTS.map((h, i) => {
        const p = barProgress(i, t);
        if (p <= 0) return null;
        return (
          <mesh
            key={i}
            geometry={barGeometry}
            material={materials[i]}
            position={[barX(i), 0, 0]}
            scale={[1, Math.max(0.02, h * p), 1]}
            renderOrder={reflection ? 0 : 2}
          />
        );
      })}
    </group>
  );
};

/** Additive glow sprites hugging the base of each bar (and its reflection). */
const BaseGlows: React.FC<{ palette: GlowPalette; t: number }> = ({
  palette,
  t,
}) => {
  const texture = useMemo(() => makeRadialTexture(256, 1.6), []);
  const material = useMemo(
    () =>
      new THREE.SpriteMaterial({
        map: texture,
        color: palette.glow,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        transparent: true,
        opacity: 0.8,
      }),
    [palette, texture],
  );
  return (
    <group>
      {BAR_HEIGHTS.map((h, i) => {
        const p = barProgress(i, t);
        if (p <= 0) return null;
        const s = 0.35 + 0.65 * Math.min(1, p * 2);
        return (
          <React.Fragment key={i}>
            <sprite
              material={material}
              position={[barX(i), 0.05, 0.5]}
              scale={[1.9 * s, 0.9 * s, 1]}
              renderOrder={3}
            />

          </React.Fragment>
        );
      })}
    </group>
  );
};

/* ------------------------------------------------------------------ arrow */

const SHAFT_HALF = 0.17;
const HEAD_HALF = 0.42;
const HEAD_LEN = 0.68;
const ARROW_DEPTH = 0.3;

const makeArrowGeometry = (len: number) => {
  const k = Math.min(1, len / (HEAD_LEN * 1.4));
  const hl = HEAD_LEN * k;
  const hw = HEAD_HALF * Math.max(0.4, k);
  const sh = SHAFT_HALF * Math.max(0.4, k);
  const s = new THREE.Shape();
  s.moveTo(0, -sh);
  s.lineTo(len - hl, -sh);
  s.lineTo(len - hl, -hw);
  s.lineTo(len, 0);
  s.lineTo(len - hl, hw);
  s.lineTo(len - hl, sh);
  s.lineTo(0, sh);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: ARROW_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.035,
    bevelSize: 0.03,
    bevelSegments: 2,
  });
  g.translate(0, 0, -ARROW_DEPTH / 2);
  return g;
};

const Arrow: React.FC<{ palette: GlowPalette; t: number }> = ({
  palette,
  t,
}) => {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: palette.arrow,
        emissive: palette.arrowEmissive,
        roughness: 0.28,
        metalness: 0.35,
        envMapIntensity: 0.9,
      }),
    [palette],
  );
  useEffect(() => () => material.dispose(), [material]);

  const reach = arrowReach(t);
  const dx = ARROW_END[0] - ARROW_TAIL[0];
  const dy = ARROW_END[1] - ARROW_TAIL[1];
  const total = Math.hypot(dx, dy);
  const len = total * reach;
  // geometry rebuilt in 1/200 length steps; memoised per step
  const step = Math.round(len * 200) / 200;
  const geometry = useMemo(
    () => (step > 0.01 ? makeArrowGeometry(step) : null),
    [step],
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) return null;
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[ARROW_TAIL[0], ARROW_TAIL[1], -0.1]}
      rotation={[0, 0, Math.atan2(dy, dx)]}
      renderOrder={2}
    />
  );
};

/* ------------------------------------------------------------------ scene */

const Scene: React.FC<{ palette: GlowPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;
  const hot = interpolateKeys(t, [6, 15], [0, 1], easeInOutSine);

  return (
    <>
      <color attach="background" args={["#000000"]} />
      <StudioEnvironment intensity={0.05} />
      <CameraRig t={t} />
      <ambientLight intensity={0.15} />
      <directionalLight position={[-6, 9, 8]} intensity={1.3} />
      <directionalLight position={[8, 3, 6]} intensity={0.35} color="#ffd9c9" />
      <Bars palette={palette} t={t} reflection />
      <Floor palette={palette} t={t} hot={lerp(0.0, 0.55, hot)} />
      <Bars palette={palette} t={t} />
      <Arrow palette={palette} t={t} />
      <BaseGlows palette={palette} t={t} />
      <PostFX bloomStrength={1.0} bloomRadius={0.5} bloomThreshold={0.4} />
    </>
  );
};

export const GlowingDecline: React.FC<{ palette: GlowPalette }> = ({
  palette,
}) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={[0.25, 2]}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: 34, position: [0, 2, 13] }}
      >
        <Scene palette={palette} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

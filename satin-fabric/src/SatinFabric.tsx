import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useMemo } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { hexToLinear, type SatinPalette } from "./palettes";
import { FRAGMENT_GLSL, VERTEX_GLSL } from "./shader/material";

/**
 * Field-space is defined so the visible frame is 2.0 units tall. The plane
 * is built directly in those units and overfills the frame generously, so
 * no edge can enter shot at any point in the loop.
 */
const FIELD_HEIGHT = 2.0;
const OVERFILL = 1.75;
const FOV = 34;
const CAMERA_Z = 1 / Math.tan((FOV / 2) * (Math.PI / 180));

// Subdivision of the displaced plane. Shading normals are computed
// analytically per pixel, so this only has to be fine enough that the
// silhouette and the parallax on the crests stay smooth at 4K.
const SEGMENTS_X = 480;
const SEGMENTS_Y = 288;

const Surface: React.FC<{ palette: SatinPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, width, height } = useVideoConfig();
  // Pin the camera here rather than trusting the canvas prop, so the visible
  // frame is exactly FIELD_HEIGHT units tall and the fold scale is the same
  // whatever the canvas does with its default camera. Locked: no drift, no push.
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  camera.fov = FOV;
  camera.near = 0.1;
  camera.far = 50;
  camera.position.set(0, 0, CAMERA_Z);
  camera.rotation.set(0, 0, 0);
  camera.updateProjectionMatrix();

  // The loop parameter. Every temporal phase in the field is an integer
  // multiple of 2*pi*t, so t = 1 reproduces t = 0 exactly. It is a pure
  // function of useCurrentFrame(): Remotion renders frames out of order
  // across threads, so no clock or delta accumulation may be involved.
  const t = (frame % durationInFrames) / durationInFrames;

  const aspect = width / height;

  const geometry = useMemo(
    () =>
      new THREE.PlaneGeometry(
        FIELD_HEIGHT * aspect * OVERFILL,
        FIELD_HEIGHT * OVERFILL,
        SEGMENTS_X,
        SEGMENTS_Y,
      ),
    [aspect],
  );

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uAmp: { value: palette.amp },
      uCamPos: { value: new THREE.Vector3(0, 0, CAMERA_Z) },
      uTrough: { value: new THREE.Vector3(...hexToLinear(palette.trough)) },
      uBase: { value: new THREE.Vector3(...hexToLinear(palette.base)) },
      uHigh: { value: new THREE.Vector3(...hexToLinear(palette.high)) },
      uKeyDir: { value: new THREE.Vector3(...palette.keyDir) },
      uKeyInt: { value: palette.keyInt },
      uFillDir: { value: new THREE.Vector3(...palette.fillDir) },
      uFillInt: { value: palette.fillInt },
      uFillTint: { value: new THREE.Vector3(...palette.fillTint) },
      uSpecInt: { value: palette.specInt },
      uDiffuse: { value: palette.diffuse },
      uFillW: { value: palette.fillW },
      uAmbient: { value: palette.ambient },
      uWrap: { value: palette.wrap },
      uBlack: { value: palette.black },
      uContrast: { value: palette.contrast },
      uShoulder: { value: palette.shoulder },
      uRough: { value: palette.rough },
      uRoughVar: { value: palette.roughVar },
      uAnisoRatio: { value: palette.anisoRatio },
      uFillTintMix: { value: palette.fillTintMix },
      uSheen: { value: palette.sheen },
      uSheenTint: { value: new THREE.Vector3(...palette.sheenTint) },
      uWeave: { value: palette.weave },
      uGrain: { value: palette.grain },
      uVignette: { value: palette.vignette },
      uHalfExtent: { value: new THREE.Vector2(1, 1) },
      uSeed: { value: 0 },
    }),
    [palette],
  );

  uniforms.uTime.value = t;
  // Grain is re-seeded per frame so it never freezes into a static pattern.
  uniforms.uSeed.value = (frame % durationInFrames) * 17.31;
  uniforms.uHalfExtent.value.set(aspect, 1);

  const material = useMemo(
    () =>
      new THREE.RawShaderMaterial({
        vertexShader: VERTEX_GLSL,
        fragmentShader: FRAGMENT_GLSL,
        uniforms,
        glslVersion: THREE.GLSL3,
      }),
    [uniforms],
  );

  return <mesh geometry={geometry} material={material} />;
};

export const SatinFabric: React.FC<{ palette: SatinPalette }> = ({
  palette,
}) => {
  const { width, height } = useVideoConfig();

  return (
    <ThreeCanvas
      width={width}
      height={height}
      // Camera completely locked: no drift, no push.
      camera={{ fov: FOV, position: [0, 0, CAMERA_Z], near: 0.1, far: 50 }}
      gl={{ antialias: true }}
      // The shader writes display-referred sRGB itself, so three must not
      // convert again on output.
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.LinearSRGBColorSpace;
      }}
      style={{ backgroundColor: palette.trough }}
    >
      <Surface palette={palette} />
    </ThreeCanvas>
  );
};

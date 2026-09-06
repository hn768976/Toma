import { useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  BASE_ALPHA,
  CAMERA_FOV,
  CAMERA_POSITION,
  CAMERA_TARGET,
  COMP_HEIGHT,
  COMP_WIDTH,
  LINE_WIDTH_PX,
  MIN_HALF_WIDTH_PX,
  NEAR_SOFTNESS_PX,
  Palette,
  ROW_COUNT,
} from "./constants";
import { createStrokeGeometry } from "./geometry";
import { FRAGMENT_SHADER, VERTEX_SHADER } from "./shaders";

/**
 * The camera never moves — not a drift, not a sway. The stillness is what
 * makes the piece calm, and it is also what lets the strokes be composited
 * back-to-front from a fixed instance order (see geometry.ts).
 */
export const CameraRig: React.FC = () => {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const { width, height } = useVideoConfig();

  camera.position.set(...(CAMERA_POSITION as [number, number, number]));
  camera.up.set(0, 1, 0);
  camera.fov = CAMERA_FOV;
  camera.aspect = width / height;
  camera.near = 0.1;
  camera.far = 400;
  camera.lookAt(...(CAMERA_TARGET as [number, number, number]));
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();

  return null;
};

export const StrokeField: React.FC<{ palette: Palette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const gl = useThree((state) => state.gl);

  const geometry = useMemo(() => createStrokeGeometry(), []);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(COMP_WIDTH, COMP_HEIGHT) },
      uPixelScale: { value: 1 },
      uRowStep: { value: 1 / (ROW_COUNT - 1) },
      uLineWidth: { value: LINE_WIDTH_PX },
      uMinHalfWidth: { value: MIN_HALF_WIDTH_PX },
      uNearSoftness: { value: NEAR_SOFTNESS_PX },
      uBaseAlpha: { value: BASE_ALPHA },
      uColorFar: { value: new THREE.Color() },
      uColorMid: { value: new THREE.Color() },
      uColorDark: { value: new THREE.Color() },
      uColorAccent: { value: new THREE.Color() },
    }),
    [],
  );

  // Every uniform is a pure function of the frame index — no useFrame, no
  // clock, no delta accumulation. Remotion renders frames out of order across
  // worker threads, so anything stateful would desynchronise between them.
  const loopPhase = frame / durationInFrames;

  // The drawing buffer, not the CSS box: the shader sizes its hairlines in
  // device pixels. In practice `--scale` leaves this at the composition size
  // and only shrinks the screenshot Chromium hands back, but reading it here
  // keeps the stroke weight correct for any device pixel ratio.
  const bufferWidth = gl.domElement.width || COMP_WIDTH;
  const bufferHeight = gl.domElement.height || COMP_HEIGHT;

  uniforms.uTime.value = loopPhase;
  uniforms.uResolution.value.set(bufferWidth, bufferHeight);
  uniforms.uPixelScale.value = bufferWidth / COMP_WIDTH;
  uniforms.uColorFar.value.set(palette.far);
  uniforms.uColorMid.value.set(palette.mid);
  uniforms.uColorDark.value.set(palette.dark);
  uniforms.uColorAccent.value.set(palette.accent);

  return (
    <mesh frustumCulled={false} geometry={geometry}>
      <shaderMaterial
        args={[
          {
            vertexShader: VERTEX_SHADER,
            fragmentShader: FRAGMENT_SHADER,
            uniforms,
            transparent: true,
            // Normal alpha, never additive: additive compositing on white
            // does nothing except wash the frame out. Density has to come
            // from strokes overlapping, which is also why the depth buffer is
            // off and the draw order does the compositing instead.
            blending: THREE.NormalBlending,
            depthTest: false,
            depthWrite: false,
            side: THREE.DoubleSide,
          },
        ]}
      />
    </mesh>
  );
};

import { PerspectiveCamera } from "@react-three/drei";
import {
  Bloom,
  DepthOfField,
  EffectComposer,
  Vignette,
} from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { Color, PerspectiveCamera as ThreePerspectiveCamera } from "three";
import {
  ASPECT,
  buildCoinElements,
  buildHeroElements,
  buildPlaneElements,
  loopPhase,
} from "../field";
import type { TextureSet } from "../textures";
import {
  CAMERA_FAR,
  CAMERA_NEAR,
  FOV,
  type VariantConfig,
} from "../variants";
import { AccentMarks } from "./AccentMarks";
import { cameraState } from "./camera";
import { CodeField } from "./CodeField";
import { Coins } from "./Coins";

/**
 * Applies the frame-derived camera state. Nothing here reads a clock or a
 * `useFrame` delta — the only input is Remotion's current frame.
 */
const CameraRig: React.FC<{ readonly config: VariantConfig; readonly t: number }> =
  ({ config, t }) => {
    const camera = useThree((s) => s.camera);
    const state = useMemo(() => cameraState(t, config), [t, config]);

    useLayoutEffect(() => {
      camera.position.copy(state.position);
      camera.quaternion.copy(state.quaternion);
      if (camera instanceof ThreePerspectiveCamera) {
        camera.fov = FOV;
        camera.near = CAMERA_NEAR;
        camera.far = CAMERA_FAR;
        camera.aspect = ASPECT;
      }
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);
    }, [camera, state]);

    return null;
  };

const Background: React.FC<{ readonly color: string }> = ({ color }) => {
  const gl = useThree((s) => s.gl);
  useLayoutEffect(() => {
    gl.setClearColor(new Color(color), 1);
  }, [gl, color]);
  return null;
};

export const Scene: React.FC<{
  readonly config: VariantConfig;
  readonly textures: TextureSet;
}> = ({ config, textures }) => {
  const frame = useCurrentFrame();
  const t = loopPhase(frame);

  const planes = useMemo(() => buildPlaneElements(config), [config]);
  const heroes = useMemo(
    () => buildHeroElements(config, textures.hero.length),
    [config, textures.hero.length],
  );
  const coins = useMemo(() => buildCoinElements(config), [config]);
  const cam = useMemo(() => cameraState(t, config), [t, config]);

  // Depth of field is authored in world units and converted to the normalised
  // range the effect expects, so the focus band stays put if near/far change.
  const focusDistance =
    (config.focusWorldDistance - CAMERA_NEAR) / (CAMERA_FAR - CAMERA_NEAR);
  const focalLength = config.focusWorldRange / (CAMERA_FAR - CAMERA_NEAR);

  return (
    <>
      <Background color={config.palette.background} />
      <PerspectiveCamera
        makeDefault
        fov={FOV}
        near={CAMERA_NEAR}
        far={CAMERA_FAR}
      />
      <CameraRig config={config} t={t} />

      <group quaternion={cam.fieldQuaternion}>
        <CodeField
          elements={planes}
          textures={textures.code}
          smearedTextures={textures.codeSmeared}
          config={config}
          aspect={textures.codeAspect}
          t={t}
          cameraQuaternion={cam.quaternion}
          fieldQuaternion={cam.fieldQuaternion}
        />
        <CodeField
          elements={heroes}
          textures={textures.hero}
          smearedTextures={textures.hero}
          smearNearHeads={false}
          config={config}
          aspect={textures.codeAspect}
          t={t}
          cameraQuaternion={cam.quaternion}
          fieldQuaternion={cam.fieldQuaternion}
        />
        <Coins
          coins={coins}
          markTextures={textures.marks}
          config={config}
          t={t}
        />
        <AccentMarks
          textures={textures.accents}
          config={config}
          t={t}
          cameraQuaternion={cam.quaternion}
          fieldQuaternion={cam.fieldQuaternion}
        />
      </group>

      <EffectComposer multisampling={0} depthBuffer stencilBuffer={false}>
        <DepthOfField
          focusDistance={focusDistance}
          focalLength={focalLength}
          bokehScale={config.bokehScale}
          resolutionScale={1}
        />
        <Bloom
          intensity={config.bloomIntensity}
          luminanceThreshold={config.bloomThreshold}
          luminanceSmoothing={0.35}
          mipmapBlur
          radius={0.82}
        />
        <Vignette offset={0.24} darkness={0.85} />
      </EffectComposer>
    </>
  );
};

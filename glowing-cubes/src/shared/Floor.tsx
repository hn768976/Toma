import { useFrame, useThree } from "@react-three/fiber";
import { KawaseBlurPass, KernelSize } from "postprocessing";
import React, { useLayoutEffect, useMemo } from "react";
import {
  BackSide,
  Color,
  HalfFloatType,
  LinearFilter,
  type Mesh,
  Matrix4,
  MeshStandardMaterial,
  type PerspectiveCamera,
  Plane,
  ShaderMaterial,
  Vector3,
  Vector4,
  WebGLRenderTarget,
} from "three";
import { PERF } from "./perf";

/**
 * Glossy floor at y = 0 with a soft, blurred planar reflection.
 *
 * Every frame: render the scene from the camera mirrored in the floor plane
 * (oblique near plane clips everything below the floor) into a half-float
 * target, Kawase-blur it, and add it to the floor as emitted light, faded
 * with distance from the centre. Nothing is carried from one frame to the
 * next, so it is safe for Remotion's out-of-order rendering.
 *
 * (Same technique as drei's <MeshReflectorMaterial>; drei's version
 * multiplies the reflection into the albedo, which makes it vanish on a dark
 * floor, so this project carries its own small implementation.)
 */
export const Floor: React.FC<{
  color: string;
  /** reflection strength */
  mixStrength?: number;
  roughness?: number;
  envMapIntensity?: number;
  /** distance (world units) over which the reflection fades out */
  fade?: number;
  /**
   * Reflection target height in pixels. Fixed regardless of output size, so
   * the (already blurred) reflection looks the same at 1080p, 4K and 6000 px.
   */
  resolution?: number;
}> = ({ color, mixStrength = 0.5, roughness = 0.85, envMapIntensity = 0.4, fade = 14, resolution = 540 }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);

  const rtH = resolution;
  const rtW = Math.round((rtH * size.width) / size.height);

  const { rt, blurRt, blur, mirrorCam, textureMatrix } = useMemo(() => {
    const opts = { minFilter: LinearFilter, magFilter: LinearFilter, type: HalfFloatType, depthBuffer: true };
    const rt = new WebGLRenderTarget(rtW, rtH, opts);
    const blurRt = new WebGLRenderTarget(rtW, rtH, { ...opts, depthBuffer: false });
    const blur = new KawaseBlurPass({ kernelSize: KernelSize.LARGE, resolutionScale: 0.5 });
    blur.setSize(rtW, rtH);
    return { rt, blurRt, blur, mirrorCam: camera.clone(), textureMatrix: new Matrix4() };
  }, [rtW, rtH, camera]);

  useLayoutEffect(
    () => () => {
      rt.dispose();
      blurRt.dispose();
      blur.dispose();
    },
    [rt, blurRt, blur],
  );

  const material = useMemo(() => {
    const m = new MeshStandardMaterial({ color, roughness, metalness: 0.2, envMapIntensity });
    const uniforms = {
      tRefl: { value: blurRt.texture },
      uReflMatrix: { value: textureMatrix },
      uStrength: { value: mixStrength },
      uFade: { value: fade },
    };
    m.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nuniform mat4 uReflMatrix;\nvarying vec4 vReflUv;\nvarying vec3 vFloorPos;")
        .replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvec4 floorWorld = modelMatrix * vec4(transformed, 1.0);\nvFloorPos = floorWorld.xyz;\nvReflUv = uReflMatrix * floorWorld;",
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform sampler2D tRefl;\nuniform float uStrength;\nuniform float uFade;\nvarying vec4 vReflUv;\nvarying vec3 vFloorPos;",
        )
        .replace(
          "#include <emissivemap_fragment>",
          `#include <emissivemap_fragment>
float reflFade = exp(-pow(length(vFloorPos.xz) / uFade, 2.0));
totalEmissiveRadiance += max(texture2DProj(tRefl, vReflUv).rgb, 0.0) * uStrength * reflFade;`,
        );
    };
    m.customProgramCacheKey = () => "glowing-cubes-floor";
    return m;
  }, [color, roughness, envMapIntensity, blurRt, textureMatrix, mixStrength, fade]);

  const meshRef = React.useRef<Mesh>(null);

  // priority 0 → runs before the effect composer (priority 1)
  useFrame(() => {
    const floor = meshRef.current;
    if (!floor || PERF("norefl")) return;
    camera.updateMatrixWorld();
    // mirror the camera in y = 0
    const camPos = new Vector3().setFromMatrixPosition(camera.matrixWorld);
    const lookDir = new Vector3(0, 0, -1).transformDirection(camera.matrixWorld);
    const target = camPos.clone().add(lookDir);
    mirrorCam.position.set(camPos.x, -camPos.y, camPos.z);
    const upWorld = new Vector3(0, 1, 0).transformDirection(camera.matrixWorld);
    mirrorCam.up.set(upWorld.x, -upWorld.y, upWorld.z);
    mirrorCam.lookAt(target.x, -target.y, target.z);
    mirrorCam.far = camera.far;
    mirrorCam.near = camera.near;
    mirrorCam.updateMatrixWorld();
    mirrorCam.projectionMatrix.copy(camera.projectionMatrix);

    // texture matrix: world → mirror-camera clip → [0,1] uv
    textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    textureMatrix.multiply(mirrorCam.projectionMatrix).multiply(mirrorCam.matrixWorldInverse);

    // oblique near plane = floor plane (Lengyel)
    const plane = new Plane(new Vector3(0, 1, 0), 0).applyMatrix4(mirrorCam.matrixWorldInverse);
    const clip = new Vector4(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const p = mirrorCam.projectionMatrix.elements;
    const q = new Vector4(
      (Math.sign(clip.x) + p[8]) / p[0],
      (Math.sign(clip.y) + p[9]) / p[5],
      -1,
      (1 + p[10]) / p[14],
    );
    clip.multiplyScalar(2 / clip.dot(q));
    p[2] = clip.x;
    p[6] = clip.y;
    p[10] = clip.z + 1;
    p[14] = clip.w;

    floor.visible = false;
    const prevTarget = gl.getRenderTarget();
    const prevAutoClear = gl.autoClear;
    gl.autoClear = true;
    gl.setRenderTarget(rt);
    gl.clear();
    gl.render(scene, mirrorCam);
    blur.render(gl, rt, blurRt);
    gl.setRenderTarget(prevTarget);
    gl.autoClear = prevAutoClear;
    floor.visible = true;
  });

  return (
    <mesh ref={meshRef} rotation-x={-Math.PI / 2} position-y={0} material={material}>
      <planeGeometry args={[160, 160]} />
    </mesh>
  );
};

/** Huge inside-out sphere with a vertical gradient: sky above, haze at the horizon. */
export const Backdrop: React.FC<{ sky: string; haze: string; hazeBoost?: number }> = ({ sky, haze, hazeBoost = 1 }) => {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uSky: { value: new Color(sky) },
          uHaze: { value: new Color(haze).multiplyScalar(hazeBoost) },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uSky;
          uniform vec3 uHaze;
          varying vec3 vDir;
          void main() {
            float h = clamp(vDir.y, 0.0, 1.0);
            float k = pow(1.0 - h, 3.0);
            gl_FragColor = vec4(mix(uSky, uHaze, k), 1.0);
          }`,
      }),
    [sky, haze, hazeBoost],
  );
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[90, 48, 24]} />
    </mesh>
  );
};

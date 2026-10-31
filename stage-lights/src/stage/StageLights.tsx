import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { CameraMove, cameraAt } from "./camera";
import {
  BEAM_PARAMS,
  LIGHTS,
  beamDirection,
  fixturePosition,
  wheelState,
  shimmer,
  swingAngleDeg,
} from "./lights";
import {
  BEAM_FRAGMENT,
  GLOW_FRAGMENT,
  GLOW_VERTEX,
  POST_FRAGMENT,
  POST_VERTEX,
  SCREEN_VERTEX,
  WALL_FRAGMENT,
  WORLD_VERTEX,
} from "./shaders";

export type StageLightsProps = {
  cameraMove: CameraMove;
};

const WALL_Z = -6;
const EXPOSURE = 0.95;

const hslColor = (hue: number) => new THREE.Color().setHSL(hue / 360, 0.62, 0.5);

type Rig = {
  scene: THREE.Scene;
  beams: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial }[];
  glows: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial }[];
  wallMat: THREE.ShaderMaterial;
  post: { scene: THREE.Scene; camera: THREE.OrthographicCamera; mat: THREE.ShaderMaterial };
  dispose: () => void;
};

const buildRig = (): Rig => {
  const scene = new THREE.Scene();
  const disposables: { dispose: () => void }[] = [];

  // --- back wall / deep haze ---
  const wallGeo = new THREE.PlaneGeometry(400, 250);
  const wallMat = new THREE.ShaderMaterial({
    vertexShader: WORLD_VERTEX,
    fragmentShader: WALL_FRAGMENT,
    uniforms: {
      uPos: { value: LIGHTS.map(() => new THREE.Vector3()) },
      uDirs: { value: LIGHTS.map(() => new THREE.Vector3()) },
      uCols: { value: LIGHTS.map(() => new THREE.Vector3()) },
      uTans: { value: LIGHTS.map((l) => BEAM_PARAMS[l.kind].tanA) },
      // haze glow around the fixtures: strongest along the top truss
      uNear: { value: LIGHTS.map((l) => (l.kind === "top" ? 1.0 : 0.35)) },
      uTime: { value: 0 },
      uAmbient: { value: 0.13 },
    },
    depthWrite: false,
  });
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.position.set(0, 0, WALL_Z);
  wall.renderOrder = 0;
  scene.add(wall);
  disposables.push(wallGeo, wallMat);

  // --- beams: one full-screen analytic pass per fixture ---
  const screenGeo = new THREE.PlaneGeometry(2, 2);
  disposables.push(screenGeo);
  const beams = LIGHTS.map((light) => {
    const p = BEAM_PARAMS[light.kind];
    const mat = new THREE.ShaderMaterial({
      vertexShader: SCREEN_VERTEX,
      fragmentShader: BEAM_FRAGMENT,
      uniforms: {
        uApex: { value: new THREE.Vector3() },
        uDir: { value: new THREE.Vector3(0, -1, 0) },
        uColor: { value: new THREE.Color() },
        uColorB: { value: new THREE.Color() },
        uSide: { value: new THREE.Vector3(1, 0, 0) },
        uSplit: { value: 2 },
        uTanA: { value: p.tanA },
        uLen: { value: p.length },
        uIntensity: { value: p.intensity * (light.gain ?? 1) },
        uTime: { value: 0 },
        uInvViewProj: { value: new THREE.Matrix4() },
      },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(screenGeo, mat);
    mesh.renderOrder = 1;
    mesh.frustumCulled = false;
    scene.add(mesh);
    disposables.push(mat);
    return { mesh, mat };
  });

  // --- lens glows ---
  const glowGeo = new THREE.PlaneGeometry(2, 2);
  disposables.push(glowGeo);
  const glows = LIGHTS.map((light) => {
    const p = BEAM_PARAMS[light.kind];
    const mat = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERTEX,
      fragmentShader: GLOW_FRAGMENT,
      uniforms: {
        uSize: { value: p.glowSize },
        uColor: { value: new THREE.Color() },
        uIntensity: { value: p.glowIntensity },
        uFacing: { value: 1 },
      },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(glowGeo, mat);
    mesh.renderOrder = 2;
    mesh.frustumCulled = false;
    scene.add(mesh);
    disposables.push(mat);
    return { mesh, mat };
  });

  // --- post-processing quad ---
  const postScene = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const postGeo = new THREE.PlaneGeometry(2, 2);
  const postMat = new THREE.ShaderMaterial({
    vertexShader: POST_VERTEX,
    fragmentShader: POST_FRAGMENT,
    uniforms: {
      uHdr: { value: null },
      uExposure: { value: EXPOSURE },
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
    },
    depthTest: false,
    depthWrite: false,
  });
  const postQuad = new THREE.Mesh(postGeo, postMat);
  postQuad.frustumCulled = false;
  postScene.add(postQuad);
  disposables.push(postGeo, postMat);

  return {
    scene,
    beams,
    glows,
    wallMat,
    post: { scene: postScene, camera: postCamera, mat: postMat },
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
};

const FORWARD = new THREE.Vector3(0, 0, 1);

const Stage: React.FC<StageLightsProps> = ({ cameraMove }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { camera, gl } = useThree();
  const rig = useMemo(buildRig, []);
  const targetRef = useRef<THREE.WebGLRenderTarget | null>(null);

  useLayoutEffect(() => () => {
    rig.dispose();
    targetRef.current?.dispose();
  }, [rig]);

  // Update camera + all uniforms for the current frame before R3F renders.
  useLayoutEffect(() => {
    const t = frame / fps;
    const cam = camera as THREE.PerspectiveCamera;
    const shot = cameraAt(cameraMove, frame / Math.max(1, durationInFrames - 1));
    cam.position.copy(shot.position);
    cam.up.set(0, 1, 0);
    cam.lookAt(shot.target);
    if (shot.roll !== 0) cam.rotateZ(THREE.MathUtils.degToRad(shot.roll));
    cam.fov = shot.fov;
    cam.near = 0.1;
    cam.far = 200;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    LIGHTS.forEach((light, i) => {
      const p = BEAM_PARAMS[light.kind];
      const apex = fixturePosition(light.px, light.z);
      const dir = beamDirection(swingAngleDeg(light.swing, t), p.towardCamera);
      const wheel = wheelState(light.hues, t);
      const color = hslColor(wheel.hueMix);

      const { mat } = rig.beams[i];
      mat.uniforms.uApex.value.copy(apex);
      mat.uniforms.uInvViewProj.value
        .multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)
        .invert();
      mat.uniforms.uIntensity.value = p.intensity * (light.gain ?? 1) * shimmer(frame, i);
      mat.uniforms.uDir.value.copy(dir);
      mat.uniforms.uColor.value.copy(hslColor(wheel.hueA));
      mat.uniforms.uColorB.value.copy(hslColor(wheel.hueB));
      mat.uniforms.uSplit.value = wheel.split;
      mat.uniforms.uSide.value.crossVectors(dir, FORWARD).normalize();
      mat.uniforms.uTime.value = t;
      const glow = rig.glows[i];
      glow.mesh.position.copy(apex);
      glow.mat.uniforms.uColor.value.copy(color);
      const toCam = cam.position.clone().sub(apex).normalize();
      glow.mat.uniforms.uFacing.value = THREE.MathUtils.clamp(toCam.dot(dir) * 0.5 + 0.5, 0, 1);

      rig.wallMat.uniforms.uPos.value[i].copy(apex);
      rig.wallMat.uniforms.uDirs.value[i].copy(dir);
      const g = light.gain ?? 1;
      rig.wallMat.uniforms.uCols.value[i].set(color.r * g, color.g * g, color.b * g);
    });
    rig.wallMat.uniforms.uTime.value = t;
    rig.post.mat.uniforms.uTime.value = t;
  }, [frame, fps, durationInFrames, camera, cameraMove, rig]);

  // Custom render: scene -> HDR target -> tone-mapped output.
  useFrame(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    let rt = targetRef.current;
    if (!rt || rt.width !== size.x || rt.height !== size.y) {
      rt?.dispose();
      rt = new THREE.WebGLRenderTarget(size.x, size.y, {
        type: THREE.HalfFloatType,
        depthBuffer: false,
      });
      targetRef.current = rt;
    }
    gl.setRenderTarget(rt);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, true, true);
    gl.render(rig.scene, camera);
    gl.setRenderTarget(null);
    rig.post.mat.uniforms.uHdr.value = rt.texture;
    rig.post.mat.uniforms.uResolution.value.set(size.x, size.y);
    gl.render(rig.post.scene, rig.post.camera);
  }, 1);

  return null;
};

export const StageLights: React.FC<StageLightsProps> = (props) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={1}
        linear
        flat
        gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false }}
        camera={{ fov: 50, position: [0, 0, 10], near: 0.1, far: 200 }}
      >
        <Stage {...props} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

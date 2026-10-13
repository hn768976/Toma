import { useThree } from "@react-three/fiber";
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { BG_DITHER_GLSL } from "../common/glsl";
import { bgDitherOffset, Pipeline, sharedBlueNoise } from "../common/Pipeline";
import { mulberry32 } from "../common/random";
import { SceneCanvas, TAU, useFrameRender } from "../common/SceneCanvas";

// Look 5 — Cube Cluster (20 s loop, 600 frames)

export type CubeClusterProps = {
  cube: string; // satin cube colour
  glow: string; // background glow at (35%, 50%)
  edge: string; // background at the edges
  keyLight: string;
  fill: string;
};

const LOOP = 600;
const COUNT = 220;

type CubeSeed = {
  pos: THREE.Vector3;
  size: number;
  axis: THREE.Vector3;
  q0: THREE.Quaternion;
  turns: number; // whole turns per loop (0 or 1, sign = direction)
  bobAmp: number;
  bobCycles: number;
  bobPhase: number;
  light: number; // lightness variation
};

// Camera: z = 14, fov 30 → visible half-height 3.75, half-width 6.67 at z = 0.
const CUBES: CubeSeed[] = (() => {
  const rng = mulberry32(0xc0be5);
  // One shared orientation: the cubes sit on a jittered cubic lattice aligned
  // with it, so the cloud reads as a grid breaking apart.
  const common = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.42, -0.62, 0.08));
  const SPACING = 1.22;
  const cands: { pos: THREE.Vector3; key: number }[] = [];
  const v = new THREE.Vector3();
  for (let i = -16; i <= 16; i++) {
    for (let j = -10; j <= 10; j++) {
      for (let k = -6; k <= 6; k++) {
        v.set(i, j, k).multiplyScalar(SPACING).applyQuaternion(common);
        v.x += 3.2; // lattice centred right of frame centre
        v.z -= 1.5;
        if (v.z < -6 || v.z > 1.5) continue;
        const halfH = (14 - v.z) * Math.tan((15 * Math.PI) / 180);
        const halfW = halfH * (16 / 9);
        const nx = v.x / halfW;
        const ny = v.y / halfH;
        if (Math.abs(ny) > 1.15 || nx > 1.3) continue;
        // diagonal wedge: leading edge at ~40% of the width at the bottom,
        // ~65% at the top; density rises toward the right
        const edge = -0.24 + 0.28 * (ny + 1);
        if (nx < edge) continue;
        const keep = 0.2 + 0.8 * Math.min(1, (nx - edge) / 0.6);
        cands.push({ pos: v.clone(), key: rng() / keep });
      }
    }
  }
  cands.sort((a, b) => a.key - b.key);
  return cands.slice(0, COUNT).map(({ pos }) => {
    const jit = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).multiplyScalar(0.18);
    const size = 0.78 * (1 + 0.25 * (rng() + rng() - 1)); // within the 0.4–1.6× range, mostly ~1×
    const axis = new THREE.Vector3(rng() * 2 - 1, rng() * 2 - 1, rng() * 2 - 1).normalize();
    const jitter = new THREE.Quaternion().setFromEuler(
      new THREE.Euler((rng() - 0.5) * 0.16, (rng() - 0.5) * 0.16, (rng() - 0.5) * 0.16),
    );
    const turns = rng() < 0.15 ? (rng() < 0.5 ? 1 : -1) : 0;
    return {
      pos: pos.add(jit),
      size,
      axis,
      q0: common.clone().multiply(jitter),
      turns,
      bobAmp: turns === 0 ? 0.05 + rng() * 0.07 : 0.02,
      bobCycles: 1 + Math.floor(rng() * 2),
      bobPhase: rng() * TAU,
      light: rng() * 2 - 1,
    };
  });
})();

const Scene: React.FC<CubeClusterProps> = (p) => {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);

  const built = useMemo(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFSoftShadowMap;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 4, 40);
    camera.position.set(0, 0, 14);
    camera.lookAt(0, 0, 0);

    // Background: radial gradient in screen space (+ blue-noise dither).
    const bgMat = new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uGlow: { value: new THREE.Color(p.glow) },
        uEdge: { value: new THREE.Color(p.edge) },
        uAspect: { value: 16 / 9 },
        uBlueNoise: { value: sharedBlueNoise },
        uBnOffset: { value: new THREE.Vector3() },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
      fragmentShader: /* glsl */ `
        ${BG_DITHER_GLSL}
        uniform vec3 uGlow; uniform vec3 uEdge; uniform float uAspect;
        varying vec2 vUv;
        void main() {
          vec2 d = (vUv - vec2(0.35, 0.5)) * vec2(uAspect, 1.0);
          float r = length(d * vec2(0.8, 1.2));
          float t = smoothstep(0.0, 1.0, r);
          t = pow(t, 0.55);
          vec3 c = mix(uGlow, uEdge, t);
          c = mix(c, uGlow * 1.12, exp(-r * r * 30.0) * 0.6); // tighter hot spot
          c += bgDither(gl_FragCoord.xy) * (1.0 / 1024.0);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    bg.frustumCulled = false;
    bg.renderOrder = -10;
    scene.add(bg);

    const geo = new RoundedBoxGeometry(1, 1, 1, 3, 0.07);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.55,
      metalness: 0.0,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, CUBES.length);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    const base = new THREE.Color(p.cube);
    const hsl = { h: 0, s: 0, l: 0 };
    base.getHSL(hsl);
    CUBES.forEach((c, i) => {
      const col = new THREE.Color().setHSL(hsl.h, hsl.s, THREE.MathUtils.clamp(hsl.l * (1 + 0.06 * c.light), 0, 1));
      mesh.setColorAt(i, col);
    });
    // atmospheric haze: distant cubes fade toward the backdrop blue
    scene.fog = new THREE.Fog(new THREE.Color(p.edge).lerp(new THREE.Color(p.glow), 0.45), 12, 34);
    const group = new THREE.Group();
    group.add(mesh);
    scene.add(group);

    const key = new THREE.DirectionalLight(p.keyLight, 4.6);
    key.position.set(-9, 7, 6);
    key.target.position.set(2, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -9;
    key.shadow.camera.right = 9;
    key.shadow.camera.top = 7;
    key.shadow.camera.bottom = -7;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 30;
    key.shadow.bias = -0.0008;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 3;
    scene.add(key, key.target);
    const hemi = new THREE.HemisphereLight(p.fill, 0x3a78d8, 2.6);
    scene.add(hemi);
    const rim = new THREE.DirectionalLight(p.fill, 0.6);
    rim.position.set(6, -3, 4);
    scene.add(rim);

    const pipeline = new Pipeline({
      period: LOOP,
      samples: 4,
      ssao: { radius: 0.5, strength: 0.3, bias: 0.015 },
      dof: { focus: 15.2, range: 8, maxBlur: 0.005 },
      vignette: 0.38,
      vignetteColor: new THREE.Color(p.edge).multiplyScalar(0.6),
      grain: 0.015,
    });
    return { scene, camera, mesh, group, bgMat, pipeline };
  }, [gl, p.cube, p.glow, p.edge, p.keyLight, p.fill]);

  useEffect(() => () => built.pipeline.dispose(), [built]);

  const m4 = useMemo(() => new THREE.Matrix4(), []);
  const q = useMemo(() => new THREE.Quaternion(), []);
  const qs = useMemo(() => new THREE.Quaternion(), []);
  const v = useMemo(() => new THREE.Vector3(), []);
  const s3 = useMemo(() => new THREE.Vector3(), []);

  useFrameRender((frame) => {
    const { scene, camera, mesh, group, bgMat, pipeline } = built;
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const ph = (f / LOOP) * TAU;
    camera.aspect = size.width / size.height;
    camera.updateProjectionMatrix();
    bgMat.uniforms.uAspect.value = camera.aspect;
    bgMat.uniforms.uBnOffset.value.copy(bgDitherOffset(frame, LOOP));

    // cluster drifts in a closed loop
    group.position.set(0.28 * Math.sin(ph), 0.16 * Math.sin(2 * ph + 0.6), 0.2 * Math.cos(ph));
    group.rotation.set(0.03 * Math.sin(ph + 1), 0.05 * Math.sin(ph), 0);

    CUBES.forEach((c, i) => {
      qs.setFromAxisAngle(c.axis, ph * c.turns);
      q.copy(qs).multiply(c.q0);
      v.copy(c.pos);
      v.y += c.bobAmp * Math.sin(ph * c.bobCycles + c.bobPhase);
      s3.setScalar(c.size);
      m4.compose(v, q, s3);
      mesh.setMatrixAt(i, m4);
    });
    mesh.instanceMatrix.needsUpdate = true;
    pipeline.render(gl, scene, camera, frame);
  });
  return null;
};

export const CubeCluster: React.FC<CubeClusterProps> = (props) => (
  <SceneCanvas>
    <Scene {...props} />
  </SceneCanvas>
);

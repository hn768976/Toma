import React, { useLayoutEffect, useMemo } from "react";
import { staticFile, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { LookCanvas, StudioEnvironment } from "../lib/LookCanvas";
import { ASPECT, TAU, loopPhase } from "../lib/constants";
import { PostConfig } from "../lib/post";
import { TerraceRow } from "../versions";

/**
 * Look 5 — Dark Terraces. Ten bevelled plates with rounded organic outlines,
 * each smaller and higher, satin graphite. A soft key light (VSM shadows)
 * and a top-left fill drift on closed paths, one cycle per loop; the camera
 * drifts on a closed loop too.
 */

const PLATES = 18;
const STEP = 0.22;

const outline = (i: number) => {
  // superellipse-ish rounded square, gently wobbled; shrinks toward the top
  const k = i / (PLATES - 1);
  const ax = THREE.MathUtils.lerp(19, 2.2, Math.pow(k, 0.62));
  const az = THREE.MathUtils.lerp(15, 1.7, Math.pow(k, 0.62));
  const n = 4.4;
  const cx = THREE.MathUtils.lerp(2.5, -2.4, k);
  const cz = THREE.MathUtils.lerp(2.0, -1.9, k);
  const pts: THREE.Vector2[] = [];
  const N = 160;
  for (let j = 0; j < N; j++) {
    const th = (j / N) * TAU;
    const c = Math.cos(th);
    const s = Math.sin(th);
    const r = 1 / Math.pow(Math.pow(Math.abs(c), n) + Math.pow(Math.abs(s), n), 1 / n);
    const wob = 1 + 0.035 * Math.sin(3 * th + i * 0.7) + 0.025 * Math.sin(5 * th + 1.3 + i * 0.4);
    pts.push(new THREE.Vector2(cx + c * r * ax * wob, cz + s * r * az * wob));
  }
  return pts;
};

const POST: PostConfig = {
  exposure: 1.0,
  bloom: { strength: 0.12, threshold: 1.2, knee: 0.8, spread: 0.7 },
  dof: { focus: 7.2, farBlur: 9, nearBlur: 0.6, maxCoc: 12 },
  vignette: 0.55,
  grain: 0.02,
  msaa: 4,
};

const Scene: React.FC<{ row: TerraceRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const objs = useMemo(() => {
    const root = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(row.top),
      roughness: 0.6,
      metalness: 0.05,
      envMapIntensity: 0.1,
    });
    mat.userData.ownEnvIntensity = true;
    // fine pebbled (leather-like) grain: a bump from 3D value noise in world space
    mat.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGrainW;")
        .replace("#include <project_vertex>", "#include <project_vertex>\nvGrainW = (modelMatrix * vec4(transformed, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", `#include <common>
varying vec3 vGrainW;
float gHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1, 0, 0)), f.x), mix(gHash(i + vec3(0, 1, 0)), gHash(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0, 0, 1)), gHash(i + vec3(1, 0, 1)), f.x), mix(gHash(i + vec3(0, 1, 1)), gHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float gHeight(vec3 p) { return 0.65 * gNoise(p * 26.0) + 0.35 * gNoise(p * 57.0 + 3.1); }`)
        .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
  {
    float e = 0.006;
    float h0 = gHeight(vGrainW);
    vec3 gw = vec3(gHeight(vGrainW + vec3(e, 0.0, 0.0)) - h0, gHeight(vGrainW + vec3(0.0, e, 0.0)) - h0, gHeight(vGrainW + vec3(0.0, 0.0, e)) - h0) / e;
    vec3 gv = (viewMatrix * vec4(gw, 0.0)).xyz;
    gv -= normal * dot(gv, normal);
    normal = normalize(normal - 0.0018 * gv);
  }`);
    };
    for (let i = 0; i < PLATES; i++) {
      // outline points come out counter-clockwise in x/z; the shape lives in x/(-z)
      const shape = new THREE.Shape(outline(i).map((p) => new THREE.Vector2(p.x, -p.y)));
      const geo = new THREE.ExtrudeGeometry(shape, {
        depth: STEP - 0.12,
        bevelEnabled: true,
        bevelThickness: 0.06,
        bevelSize: 0.07,
        bevelSegments: 8,
        curveSegments: 1,
        steps: 1,
      });
      geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, mat);
      m.position.y = i * STEP;
      m.castShadow = true;
      m.receiveShadow = true;
      root.add(m);
    }
    const key = new THREE.DirectionalLight(0xfff0e4, 1.7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.radius = 8;
    key.shadow.blurSamples = 20;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.01;
    const sc = key.shadow.camera as THREE.OrthographicCamera;
    sc.left = -16;
    sc.right = 16;
    sc.top = 16;
    sc.bottom = -16;
    sc.near = 1;
    sc.far = 40;
    root.add(key, key.target);
    const fill = new THREE.PointLight(0xfff6ee, 40, 0, 1.3);
    root.add(fill);
    const amb = new THREE.HemisphereLight(0xa0a0a0, 0x000000, 0.06);
    root.add(amb);
    return { root, key, fill };
  }, [row]);

  useLayoutEffect(() => {
    const t = loopPhase(frame);
    const a = TAU * t;
    // key light from the upper left, swinging slowly on a closed arc
    objs.key.position.set(-12 + 3 * Math.cos(a), 6.5 + 1.2 * Math.sin(2 * a), -3 + 3 * Math.sin(a));
    objs.key.target.position.set(1, 0, 1);
    objs.key.updateMatrixWorld();
    objs.key.target.updateMatrixWorld();
    objs.fill.position.set(-4.5 + 1.2 * Math.sin(a), 8.5, -4 + 1.2 * Math.cos(a));
  }, [frame, objs]);

  return <primitive object={objs.root} />;
};

export const DarkTerraces: React.FC<{ row: TerraceRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const camera = useMemo(() => new THREE.PerspectiveCamera(46, ASPECT, 0.5, 80), []);
  useLayoutEffect(() => {
    const t = loopPhase(frame);
    const a = TAU * t;
    const target = new THREE.Vector3(2.4 + 0.3 * Math.sin(a), 0.6, 2.2 + 0.2 * Math.cos(a));
    const pitch = (50 * Math.PI) / 180; // camera tilted ~40° off top-down
    const yaw = (-28 * Math.PI) / 180 + 0.035 * Math.sin(a);
    const dist = 8.6 + 0.2 * Math.cos(a);
    camera.position.set(
      target.x + dist * Math.cos(pitch) * Math.sin(yaw),
      target.y + dist * Math.sin(pitch),
      target.z + dist * Math.cos(pitch) * Math.cos(yaw),
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
  }, [frame, camera]);
  const envRot = useMemo(() => new THREE.Euler(0, 1.2, 0), []);
  return (
    <LookCanvas post={POST} camera={camera} shadows>
      <StudioEnvironment url={staticFile("hdri/studio.exr")} intensity={1} rotation={envRot} />
      <Scene row={row} />
    </LookCanvas>
  );
};

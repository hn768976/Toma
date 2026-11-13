import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { z } from "zod";
import {
  CUBE_BASE_Y,
  CUBE_D,
  CUBE_H,
  CUBE_W,
  SUBSTRATE_H,
  SUBSTRATE_W,
} from "./scene/constants";
import { createCircuitCanvases, createCubeTraceCanvas } from "./scene/circuitTextures";
import {
  floorFragment,
  floorVertex,
  moteFragment,
  moteVertex,
  shellFragment,
  shellVertex,
} from "./scene/shaders";
import { mulberry32 } from "./scene/random";

// Colours are authored as display (sRGB) values and written straight to the
// canvas, so Three.js colour management is disabled (see also `linear`/`flat`).
THREE.ColorManagement.enabled = false;

export const circuitDataCoreSchema = z.object({
  variant: z.enum(["dolly", "orbit"]),
});
type Props = z.infer<typeof circuitDataCoreSchema>;

const FOV = 25;
const CORE_CENTER = new THREE.Vector3(0, CUBE_BASE_Y + CUBE_H / 2, 0);
const deg = THREE.MathUtils.degToRad;
const lerp = THREE.MathUtils.lerp;
const easeInOutSine = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;

type CameraState = { pos: THREE.Vector3; target: THREE.Vector3 };

// Version 1 — the reference move: a slow, gently accelerating push-in that
// drifts ~38° around the core from a corner-on to a near front-on view while
// the camera lowers from ~33° to ~18° elevation.
const dollyCamera = (u: number): CameraState => {
  // Curves measured from the reference: apparent size grows ~linearly (40% ->
  // 70% of frame width), elevation drops quickly early then settles, and the
  // view swings ~20° from corner-on towards the front face.
  const p = 1.15 * u - 0.15 * u * u;
  const az = deg(32 - 20 * u);
  const el = deg(23 + 27 * Math.pow(1 - u, 2.2));
  const dist = lerp(9.6, 5.3, p);
  const target = CORE_CENTER.clone().add(new THREE.Vector3(0, lerp(-0.18, -0.02, u), 0));
  const pos = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  )
    .multiplyScalar(dist)
    .add(target);
  return { pos, target };
};

// Version 2 — alternative camera: a low, sweeping 130° orbit that starts almost
// at board level beside the core and cranes up to a high three-quarter view.
const orbitCamera = (u: number): CameraState => {
  const e = easeInOutSine(u);
  const az = deg(lerp(-75, 55, e));
  const el = deg(lerp(14, 46, e));
  const dist = lerp(6.9, 6.0, e);
  const target = CORE_CENTER.clone().add(new THREE.Vector3(0, lerp(0.05, -0.15, e), 0));
  const pos = new THREE.Vector3(
    Math.sin(az) * Math.cos(el),
    Math.sin(el),
    Math.cos(az) * Math.cos(el),
  )
    .multiplyScalar(dist)
    .add(target);
  return { pos, target };
};

const canvasTexture = (c: HTMLCanvasElement, repeat: boolean) => {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  t.anisotropy = 8;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  return t;
};

const makeShellMaterial = (
  traceTex: THREE.Texture,
  size: THREE.Vector3,
  opts: {
    seed: number;
    intensity: number;
    cellGain: number;
    traceGain: number;
    edgeGain: number;
    sparkGain: number;
    cellSize: number;
    reflect?: boolean;
  },
) =>
  new THREE.ShaderMaterial({
    vertexShader: shellVertex,
    fragmentShader: shellFragment,
    transparent: true,
    depthWrite: false,
    depthTest: !opts.reflect,
    side: THREE.FrontSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uSize: { value: size },
      uTime: { value: 0 },
      uSeed: { value: opts.seed },
      uIntensity: { value: opts.intensity },
      uGlass: { value: new THREE.Color("#0f1a70") },
      uCell: { value: new THREE.Color("#aeb3ff") },
      uTraceColor: { value: new THREE.Color("#35b5ff") },
      uEdgeColor: { value: new THREE.Color("#7fd8ff") },
      uCellSize: { value: opts.cellSize },
      uCellGain: { value: opts.cellGain },
      uTraceGain: { value: opts.traceGain },
      uEdgeGain: { value: opts.edgeGain },
      uSparkGain: { value: opts.sparkGain },
      uTrace: { value: traceTex },
      uReflect: { value: opts.reflect ? 1 : 0 },
      uBaseY: { value: CUBE_BASE_Y },
    },
  });

const SceneContents: React.FC<Props> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const scene = useThree((s) => s.scene);
  const pxScale = height / 1080;

  const built = useMemo(() => {
    const group = new THREE.Group();
    const circuit = createCircuitCanvases(2024);
    const base = circuit.base.map((c) => canvasTexture(c, true));
    const glow = circuit.glow.map((c) => canvasTexture(c, true));
    const traceTex = canvasTexture(createCubeTraceCanvas(512), true);

    const floorUniforms = (tileSize: number, offset: [number, number], glowGain: number, baseGain: number) => ({
      uBase0: { value: base[0] },
      uBase1: { value: base[1] },
      uBase2: { value: base[2] },
      uGlow0: { value: glow[0] },
      uGlow1: { value: glow[1] },
      uGlow2: { value: glow[2] },
      uTileSize: { value: tileSize },
      uTileOffset: { value: new THREE.Vector2(...offset) },
      uFocusDist: { value: 5 },
      uDofRange: { value: 0.2 },
      uSharpBias: { value: 0.04 },
      uTime: { value: 0 },
      uGlowColor: { value: new THREE.Color("#1f6dff") },
      uGlowCore: { value: new THREE.Color("#9fe4ff") },
      uGlowGain: { value: glowGain },
      uPoolColor: { value: new THREE.Color("#1b3fa8") },
      uPoolRadius: { value: 2.6 },
      uPoolGain: { value: 0.22 },
      uFogColor: { value: new THREE.Color("#0a1430") },
      uFogNear: { value: 10 },
      uFogFar: { value: 38 },
      uBaseGain: { value: baseGain },
    });

    // Circuit floor
    const floorMat = new THREE.ShaderMaterial({
      vertexShader: floorVertex,
      fragmentShader: floorFragment,
      uniforms: floorUniforms(6.5, [0.13, 0.41], 1.0, 1.1),
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = 0;
    group.add(floor);

    // Chip substrate the core sits on: dark glass slab + circuit top + glowing rim
    const subBox = new THREE.Mesh(
      new THREE.BoxGeometry(SUBSTRATE_W, SUBSTRATE_H, SUBSTRATE_W),
      new THREE.MeshBasicMaterial({ color: "#070b1a" }),
    );
    subBox.position.y = SUBSTRATE_H / 2;
    subBox.renderOrder = 1;
    group.add(subBox);
    const subTopMat = new THREE.ShaderMaterial({
      vertexShader: floorVertex,
      fragmentShader: floorFragment,
      uniforms: floorUniforms(3.2, [0.57, 0.22], 1.7, 1.25),
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const subTop = new THREE.Mesh(new THREE.PlaneGeometry(SUBSTRATE_W, SUBSTRATE_W), subTopMat);
    subTop.rotation.x = -Math.PI / 2;
    subTop.position.y = SUBSTRATE_H + 0.0015;
    subTop.renderOrder = 2;
    group.add(subTop);
    const subSize = new THREE.Vector3(SUBSTRATE_W, SUBSTRATE_H, SUBSTRATE_W);
    const subRim = new THREE.Mesh(
      new THREE.BoxGeometry(subSize.x, subSize.y, subSize.z),
      makeShellMaterial(traceTex, subSize, {
        seed: 9,
        intensity: 0.55,
        cellGain: 0,
        traceGain: 0.2,
        edgeGain: 1.0,
        sparkGain: 0,
        cellSize: 0.05,
      }),
    );
    subRim.position.y = SUBSTRATE_H / 2;
    subRim.renderOrder = 4;
    group.add(subRim);

    // The data core: dark indigo body + nested additive glass shells.
    const shells: THREE.Mesh[] = [];
    const shellMats: THREE.ShaderMaterial[] = [];
    const coreGroup = new THREE.Group();
    coreGroup.position.copy(CORE_CENTER);
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(CUBE_W * 0.985, CUBE_H * 0.985, CUBE_D * 0.985),
      new THREE.MeshBasicMaterial({
        color: "#11134a",
        transparent: true,
        opacity: 0.93,
        depthWrite: false,
      }),
    );
    body.renderOrder = 5;
    coreGroup.add(body);

    const layers = [
      { s: 1.0, seed: 1, intensity: 1.0, cellGain: 0.95, traceGain: 0.9, edgeGain: 0.8, sparkGain: 1.0, cellSize: 0.034 },
      { s: 0.95, seed: 2, intensity: 0.55, cellGain: 0.8, traceGain: 0.4, edgeGain: 0.3, sparkGain: 0.7, cellSize: 0.033 },
      { s: 0.89, seed: 3, intensity: 0.4, cellGain: 0.8, traceGain: 0.2, edgeGain: 0.15, sparkGain: 0.5, cellSize: 0.032 },
      { s: 0.82, seed: 4, intensity: 0.3, cellGain: 0.8, traceGain: 0.1, edgeGain: 0.1, sparkGain: 0.4, cellSize: 0.031 },
      { s: 0.74, seed: 5, intensity: 0.22, cellGain: 0.8, traceGain: 0.05, edgeGain: 0.05, sparkGain: 0.3, cellSize: 0.03 },
    ];
    for (const L of layers) {
      // Inner shells shrink more horizontally than vertically (stacked strata look).
      const size = new THREE.Vector3(CUBE_W * L.s, CUBE_H * (1 - (1 - L.s) * 0.55), CUBE_D * L.s);
      const mat = makeShellMaterial(traceTex, size, L);
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat);
      mesh.renderOrder = 6;
      shells.push(mesh);
      shellMats.push(mat);
      coreGroup.add(mesh);
    }
    group.add(coreGroup);

    // Floor reflection of the core (mirrored about the substrate top).
    const reflGroup = new THREE.Group();
    reflGroup.scale.y = -1;
    reflGroup.position.y = CUBE_BASE_Y - (CORE_CENTER.y - CUBE_BASE_Y);
    for (const L of layers.slice(0, 3)) {
      const size = new THREE.Vector3(CUBE_W * L.s, CUBE_H * (1 - (1 - L.s) * 0.55), CUBE_D * L.s);
      const mat = makeShellMaterial(traceTex, size, { ...L, reflect: true });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), mat);
      mesh.renderOrder = 3;
      shellMats.push(mat);
      reflGroup.add(mesh);
    }
    group.add(reflGroup);

    // Soft bloom halo around the core.
    const haloCanvas = document.createElement("canvas");
    haloCanvas.width = 256;
    haloCanvas.height = 256;
    const hctx = haloCanvas.getContext("2d")!;
    const grad = hctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, "rgba(90,150,255,0.9)");
    grad.addColorStop(0.35, "rgba(40,90,230,0.35)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    hctx.fillStyle = grad;
    hctx.fillRect(0, 0, 256, 256);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: new THREE.CanvasTexture(haloCanvas),
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        opacity: 0.28,
      }),
    );
    halo.position.copy(CORE_CENTER);
    halo.scale.set(6.5, 6.5, 1);
    halo.renderOrder = 7;
    group.add(halo);

    // Floating data motes (bokeh when out of focus).
    const rng = mulberry32(31);
    const count = 160;
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = 1.3 + rng() * 5.5;
      const a = rng() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = 0.05 + rng() * 0.6;
      pos[i * 3 + 2] = Math.sin(a) * r;
      seeds[i] = rng();
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    moteGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const moteMat = new THREE.ShaderMaterial({
      vertexShader: moteVertex,
      fragmentShader: moteFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uFocusDist: { value: 5 },
        uPxScale: { value: pxScale },
        uColor: { value: new THREE.Color("#9fd2ff") },
      },
    });
    const motes = new THREE.Points(moteGeo, moteMat);
    motes.frustumCulled = false;
    motes.renderOrder = 8;
    group.add(motes);

    return { group, floorMats: [floorMat, subTopMat], shellMats, moteMat, shells };
  }, [pxScale]);

  useLayoutEffect(() => {
    scene.background = new THREE.Color("#0a1430");
  }, [scene]);

  useLayoutEffect(() => {
    const t = frame / fps;
    const u = frame / (durationInFrames - 1);
    const { pos, target } = variant === "dolly" ? dollyCamera(u) : orbitCamera(u);
    camera.fov = FOV;
    camera.near = 0.05;
    camera.far = 120;
    camera.aspect = width / height;
    camera.position.copy(pos);
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // Focus on the core's nearest face.
    const focus = pos.distanceTo(CORE_CENTER) - 0.6;
    for (const m of built.floorMats) {
      m.uniforms.uTime.value = t;
      m.uniforms.uFocusDist.value = focus;
    }
    for (const m of built.shellMats) {
      m.uniforms.uTime.value = t;
    }
    built.moteMat.uniforms.uTime.value = t;
    built.moteMat.uniforms.uFocusDist.value = focus;
  }, [frame, fps, durationInFrames, camera, width, height, variant, built]);

  return <primitive object={built.group} />;
};

export const CircuitDataCore: React.FC<Props> = ({ variant }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#04070f" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={1}
        linear
        flat
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: FOV, near: 0.05, far: 120, position: [0, 3, 6] }}
      >
        <SceneContents variant={variant} />
      </ThreeCanvas>
      {/* Lens vignette */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0) 55%, rgba(0,0,8,0.55) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

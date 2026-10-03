// Look 2 — Data Block City (three.js via @remotion/three, WebGL2).
//
// The scene and post chain are built imperatively once; each Remotion frame
// sets the camera and phase uniforms from the frame number alone and renders
// sky -> scene (HDR + view distance in alpha) -> depth of field -> bloom ->
// tone-map + grain + dither. No R3F clock is read.
import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import {
  AbsoluteFill,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { DATA_CITY_PALETTES, DataCityPalette } from "../palettes";
import { hexToRgb } from "../lib/random";
import { Bloom, makeTarget, pass } from "../lib/threePost";
import { CITY, LOOP_FRAMES, LX, LZ, SHIFT } from "./data";
import {
  BLOCK_FRAG,
  BLOCK_VERT,
  GROUND_FRAG,
  GROUND_VERT,
  DOF_FRAG,
  FINAL_FRAG,
  LINE_FRAG,
  LINE_VERT,
  SKY_FRAG,
  SPARK_FRAG,
  SPARK_VERT,
  TILE_FRAG,
  TILE_VERT,
} from "./shaders";

// Camera
const CAM_H = 8.0;
const CAM_PITCH = (-27 * Math.PI) / 180;
const CAM_ROLL = (-6 * Math.PI) / 180;
// yawed ~30 deg off the grid so blocks run diagonally; the glide heading is
// ~21 deg, so the camera moves forward and slightly sideways
const CAM_YAW = (-30 * Math.PI) / 180;
const FOV = 34;
const CAM_X0 = 0.3;
const CAM_Z0 = 0;

// Lens
const FOCUS = 24;
const COC_SCALE = 0.024; // fraction of output height per unit |d-f|/d
const MAX_COC = 0.009; // fraction of output height

// Region covered by tile copies (all frames of the loop)
const REGION = { x0: -60, x1: 150, z0: -LZ - 110, z1: 12 };

const lin = (hex: string, k = 1, gamma = 1.8) => {
  const c = hexToRgb(hex).map((x) => Math.pow(x, gamma));
  return new THREE.Vector3(c[0] * k, c[1] * k, c[2] * k);
};

const copies = () => {
  const out: [number, number][] = [];
  for (let k = -6; k <= 2; k++) {
    for (let m = -5; m <= 5; m++) {
      const ox = m * LX - k * SHIFT;
      const oz = k * LZ;
      if (ox + LX < REGION.x0 || ox > REGION.x1) continue;
      if (oz + LZ < REGION.z0 || oz > REGION.z1) continue;
      out.push([ox, oz]);
    }
  }
  return out;
};

const tileColor = (pal: DataCityPalette, c: number) =>
  [pal.tileCyan, pal.tileWhite, pal.tilePink, pal.tileRed, pal.tileBlue][c];

const sharedUniforms = (pal: DataCityPalette) => ({
  uHaze: { value: lin(pal.haze, 0.6) },
  uFogStart: { value: 40.0 },
  uFogDist: { value: 70.0 },
  uPhase: { value: 0 },
  uPxWorld: { value: 0.001 },
});

const buildScene = (pal: DataCityPalette) => {
  const scene = new THREE.Scene();
  const C = copies();
  const shared = sharedUniforms(pal);

  // ---- blocks
  {
    const box = new THREE.BoxGeometry(1, 1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = box.index;
    g.setAttribute("position", box.getAttribute("position"));
    g.setAttribute("normal", box.getAttribute("normal"));
    const n = CITY.blocks.length * C.length;
    const aBox = new Float32Array(n * 4);
    const aHS = new Float32Array(n * 2);
    const aOrigin = new Float32Array(n * 2);
    let i = 0;
    for (const [ox, oz] of C) {
      for (const b of CITY.blocks) {
        aBox.set([b.x0, b.z0, b.x1, b.z1], i * 4);
        aHS.set([b.h, b.shade], i * 2);
        aOrigin.set([ox, oz], i * 2);
        i++;
      }
    }
    g.setAttribute("aBox", new THREE.InstancedBufferAttribute(aBox, 4));
    g.setAttribute("aHS", new THREE.InstancedBufferAttribute(aHS, 2));
    g.setAttribute("aOrigin", new THREE.InstancedBufferAttribute(aOrigin, 2));
    g.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BLOCK_VERT,
      fragmentShader: BLOCK_FRAG,
      uniforms: { ...shared, uBlock: { value: lin(pal.block, 1.25, 1.5) } },
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 0;
    scene.add(mesh);
  }

  // ---- dark floor (moves with the camera so it always covers the view;
  // it is uniform, so this does not affect the loop)
  {
    const g = new THREE.PlaneGeometry(600, 600);
    g.rotateX(-Math.PI / 2);
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: GROUND_VERT,
      fragmentShader: GROUND_FRAG,
      uniforms: { ...shared, uBlock: { value: lin(pal.block, 1.5) } },
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.position.set(40, -0.6, -60);
    mesh.frustumCulled = false;
    scene.add(mesh);
  }

  // ---- glow tiles
  {
    const plane = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = plane.index;
    g.setAttribute("position", plane.getAttribute("position"));
    const n = CITY.tiles.length * C.length;
    const aTile = new Float32Array(n * 4);
    const aLook = new Float32Array(n * 4);
    const aPhase = new Float32Array(n);
    const aOrigin = new Float32Array(n * 2);
    let i = 0;
    for (const [ox, oz] of C) {
      for (const t of CITY.tiles) {
        const col = lin(tileColor(pal, t.color), t.intensity * (t.color === 1 ? 3.0 : 4.4), 1.5);
        aTile.set([t.x, t.z, t.y, t.size], i * 4);
        aLook.set([col.x, col.y, col.z, t.blinkCycles], i * 4);
        aPhase[i] = t.blinkPhase;
        aOrigin.set([ox, oz], i * 2);
        i++;
      }
    }
    g.setAttribute("aTile", new THREE.InstancedBufferAttribute(aTile, 4));
    g.setAttribute("aLook", new THREE.InstancedBufferAttribute(aLook, 4));
    g.setAttribute("aPhase", new THREE.InstancedBufferAttribute(aPhase, 1));
    g.setAttribute("aOrigin", new THREE.InstancedBufferAttribute(aOrigin, 2));
    g.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: TILE_VERT,
      fragmentShader: TILE_FRAG,
      uniforms: { ...shared, uBlock: { value: lin(pal.block, 1.25, 1.5) } },
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 1;
    scene.add(mesh);
  }

  // additive blending that leaves alpha (= view distance) untouched
  const additive = {
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  } as const;

  // ---- light lines
  {
    const plane = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = plane.index;
    g.setAttribute("position", plane.getAttribute("position"));
    const n = CITY.lines.length * C.length;
    const aLine = new Float32Array(n * 4);
    const aLook = new Float32Array(n * 4);
    const aPhase = new Float32Array(n);
    const aOrigin = new Float32Array(n * 2);
    let i = 0;
    for (const [ox, oz] of C) {
      for (const l of CITY.lines) {
        const col = lin(l.color === 0 ? pal.line : pal.tileWhite, l.intensity * 4.0, 1.8);
        aLine.set([l.x, l.z, l.y, l.height], i * 4);
        aLook.set([col.x, col.y, col.z, l.pulseCycles], i * 4);
        aPhase[i] = l.pulsePhase;
        aOrigin.set([ox, oz], i * 2);
        i++;
      }
    }
    g.setAttribute("aLine", new THREE.InstancedBufferAttribute(aLine, 4));
    g.setAttribute("aLook", new THREE.InstancedBufferAttribute(aLook, 4));
    g.setAttribute("aPhase", new THREE.InstancedBufferAttribute(aPhase, 1));
    g.setAttribute("aOrigin", new THREE.InstancedBufferAttribute(aOrigin, 2));
    g.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
      uniforms: shared,
      side: THREE.DoubleSide,
      ...additive,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    scene.add(mesh);
  }

  // ---- sparkles
  {
    const plane = new THREE.PlaneGeometry(1, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = plane.index;
    g.setAttribute("position", plane.getAttribute("position"));
    const n = CITY.sparks.length * C.length;
    const aSpark = new Float32Array(n * 4);
    const aLook = new Float32Array(n * 4);
    const aPhase = new Float32Array(n);
    const aOrigin = new Float32Array(n * 2);
    let i = 0;
    for (const [ox, oz] of C) {
      for (const s of CITY.sparks) {
        const col = lin([pal.tileCyan, pal.tileWhite, pal.tilePink, pal.tileRed][s.color], 3.2);
        aSpark.set([s.x, s.z, s.y, s.size], i * 4);
        aLook.set([col.x, col.y, col.z, s.cycles], i * 4);
        aPhase[i] = s.phase;
        aOrigin.set([ox, oz], i * 2);
        i++;
      }
    }
    g.setAttribute("aSpark", new THREE.InstancedBufferAttribute(aSpark, 4));
    g.setAttribute("aLook", new THREE.InstancedBufferAttribute(aLook, 4));
    g.setAttribute("aPhase", new THREE.InstancedBufferAttribute(aPhase, 1));
    g.setAttribute("aOrigin", new THREE.InstancedBufferAttribute(aOrigin, 2));
    g.instanceCount = n;
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      uniforms: shared,
      side: THREE.DoubleSide,
      ...additive,
    });
    const mesh = new THREE.Mesh(g, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 3;
    scene.add(mesh);
  }

  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.2, 400);
  camera.rotation.order = "YXZ";
  camera.rotation.set(CAM_PITCH, CAM_YAW, CAM_ROLL);

  return { scene, camera, shared };
};

type Pipeline = ReturnType<typeof buildPipeline>;

const buildPipeline = (pal: DataCityPalette) => {
  const { scene, camera, shared } = buildScene(pal);
  const sky = pass(SKY_FRAG, {
    uSky: { value: lin(pal.sky, 0.22) },
    uHaze: { value: lin(pal.haze, 0.6) },
  });
  const dof = pass(DOF_FRAG, {
    tScene: { value: null },
    uRes: { value: new THREE.Vector2() },
    uFocus: { value: FOCUS },
    uCocScale: { value: 1 },
    uMaxCoc: { value: 1 },
  });
  const final = pass(FINAL_FRAG, {
    tScene: { value: null },
    tBloom: { value: null },
    uBloom: { value: 0.09 },
    uExposure: { value: 1.0 },
    uFrame: { value: 0 },
    uGrain: { value: 0.02 },
  });
  const bloom = new Bloom(6);
  const state = {
    w: 0,
    h: 0,
    sceneRT: null as THREE.WebGLRenderTarget | null,
    dofRT: null as THREE.WebGLRenderTarget | null,
  };
  const size = new THREE.Vector2();

  const render = (gl: THREE.WebGLRenderer, frame: number, wrap: boolean) => {
    gl.getDrawingBufferSize(size);
    const w = size.x;
    const h = size.y;
    if (w !== state.w || h !== state.h) {
      state.sceneRT?.dispose();
      state.dofRT?.dispose();
      state.sceneRT = makeTarget(w, h, true);
      state.sceneRT.samples = 4;
      state.dofRT = makeTarget(w, h);
      bloom.setSize(w, h);
      state.w = w;
      state.h = h;
    }
    // loop phase in [0, 1): reduced in float64 so frame 600 gets the very
    // same GPU inputs as frame 0 (the city repeats by the camera's travel)
    const u = wrap ? (frame % LOOP_FRAMES) / LOOP_FRAMES : frame / LOOP_FRAMES;
    camera.position.set(CAM_X0 + SHIFT * u, CAM_H, CAM_Z0 - LZ * u);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    shared.uPhase.value = u;
    shared.uPxWorld.value = (2 * Math.tan((FOV * Math.PI) / 360)) / h;

    gl.autoClear = false;
    gl.setRenderTarget(state.sceneRT);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, true, false);
    sky.quad.render(gl);
    gl.render(scene, camera);

    const du = dof.material.uniforms;
    du.tScene.value = state.sceneRT!.texture;
    du.uRes.value.set(w, h);
    du.uCocScale.value = COC_SCALE * h;
    du.uMaxCoc.value = MAX_COC * h;
    gl.setRenderTarget(state.dofRT);
    dof.quad.render(gl);

    const bloomTex = bloom.render(gl, state.dofRT!.texture, w, h, 0.35);

    const fu = final.material.uniforms;
    fu.tScene.value = state.dofRT!.texture;
    fu.tBloom.value = bloomTex;
    fu.uFrame.value = frame % LOOP_FRAMES;
    gl.setRenderTarget(null);
    final.quad.render(gl);
  };
  return { render };
};

const CityScene: React.FC<{ palette: string; wrap: boolean }> = ({ palette, wrap }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const pipeline = useMemo<Pipeline>(
    () => buildPipeline(DATA_CITY_PALETTES[palette]),
    [palette],
  );
  const { gl } = useThree();
  // priority 1: we own rendering. Only the Remotion frame is read.
  useFrame(() => {
    pipeline.render(gl, frameRef.current, wrap);
  }, 1);
  return null;
};

export const DataBlockCity: React.FC<{
  palette: string;
  loopCheck?: boolean;
  noWrap?: boolean;
}> = ({ palette, noWrap }) => {
  const { width, height } = useVideoConfig();
  const dpr = getRemotionEnvironment().isRendering
    ? window.devicePixelRatio
    : Math.min(window.devicePixelRatio, 0.5);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        gl={{
          antialias: false,
          preserveDrawingBuffer: true,
          powerPreference: "high-performance",
          alpha: false,
        }}
      >
        <CityScene palette={palette} wrap={!noWrap} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};


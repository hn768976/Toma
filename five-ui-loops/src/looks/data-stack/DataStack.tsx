// Look 3 — Data Stack. 3D (@remotion/three, WebGL2). Glass layers build into a
// glowing stack on a circuit board. Custom post chain: bloom + chromatic
// aberration + grain/dither. No TAA or any temporal effect: each frame is
// rendered from scratch from the Remotion frame number.
import React, { useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { DataStackVersion } from "../../versions";
import { hexToLinear } from "../../lib/color";
import { mulberry32 } from "../../lib/random";
import {
  boardFrag,
  boardVert,
  compositeFrag,
  downFrag,
  fsVert,
  glassFrag,
  glassVert,
  spriteFrag,
  spriteVert,
  upFrag,
} from "./shaders";
import {
  BOX_H,
  BOX_HALF,
  LAYERS,
  LAYER_HALF,
  LAYER_THICK,
  bottomDraw,
  boxGlass,
  brighten,
  camera as cameraAt,
  layerState,
  layerY,
  particleWindow,
  shimmerY,
  topDraw,
  verticalRise,
} from "./timeline";

const TARGET = new THREE.Vector3(0, 1.55, 0);
const APERTURE = 0.55;
const v3 = (c: [number, number, number]) => new THREE.Vector3(...c);

// ── Seeded board lights (module level) ─────────────────────────────────────
type LightSeed = { x: number; z: number; size: number; phase: number; rate: number; accent: boolean; pick: number };
const LIGHTS: LightSeed[] = (() => {
  const rng = mulberry32(0x4c494748);
  const out: LightSeed[] = [];
  while (out.length < 2400) {
    const x0 = (rng() - 0.5) * 64;
    const z0 = (rng() - 0.5) * 64;
    const alongX = rng() < 0.5;
    const n = 2 + Math.floor(rng() * 9);
    const step = 0.1 + rng() * 0.1;
    const accent = rng() < 0.09;
    const size = accent ? 0.022 + rng() * 0.018 : 0.012 + rng() * 0.014;
    const pick = rng();
    for (let k = 0; k < n; k++) {
      const x = Math.round((x0 + (alongX ? k * step : 0)) * 8) / 8;
      const z = Math.round((z0 + (alongX ? 0 : k * step)) * 8) / 8;
      if (Math.abs(x) < 1.5 && Math.abs(z) < 1.5) continue;
      out.push({ x, z, size: size * (0.8 + rng() * 0.4), phase: rng() * Math.PI * 2, rate: 0.02 + rng() * 0.1, accent, pick });
    }
  }
  return out;
})();

const PARTICLES = (() => {
  const rng = mulberry32(0x50415254);
  return Array.from({ length: 80 }, () => ({
    x: (rng() - 0.5) * 2 * BOX_HALF * 0.95,
    z: (rng() - 0.5) * 2 * BOX_HALF * 0.95,
    y0: rng() * BOX_H,
    speed: 0.012 + rng() * 0.02,
    size: 0.008 + rng() * 0.012,
    phase: rng() * Math.PI * 2,
  }));
})();

const quadGeometry = () => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};

const spriteMaterial = (gain: number) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: spriteVert,
    fragmentShader: spriteFrag,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uCam: { value: new THREE.Vector3() },
      uFocus: { value: 10 },
      uAperture: { value: APERTURE },
      uFrame: { value: 0 },
      uGain: { value: gain },
    },
  });

const glassMaterial = (color: THREE.Vector3, half: THREE.Vector3, base: number, edge: number, grid: number) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: glassVert,
    fragmentShader: glassFrag,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uCam: { value: new THREE.Vector3() },
      uColor: { value: color },
      uHalf: { value: half },
      uBase: { value: base },
      uEdge: { value: edge },
      uGrid: { value: grid },
      uBright: { value: 1 },
      uShimmer: { value: -99 },
    },
  });

// ── Scene ──────────────────────────────────────────────────────────────────
const Scene: React.FC<{ v: DataStackVersion }> = ({ v }) => {
  const frame = useCurrentFrame();
  const cam = useThree((s) => s.camera) as THREE.PerspectiveCamera;

  const objs = useMemo(() => {
    const stack = v3(hexToLinear(v.stack));
    // Board
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 140).rotateX(-Math.PI / 2),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: boardVert,
        fragmentShader: boardFrag,
        uniforms: {
          uCam: { value: new THREE.Vector3() },
          uFocus: { value: 10 },
          uAperture: { value: APERTURE },
          uBase: { value: v3(hexToLinear(v.board)) },
          uTraceA: { value: v3(hexToLinear(v.traceA)) },
          uTraceB: { value: v3(hexToLinear(v.traceB)) },
          uStack: { value: stack },
          uStackGlow: { value: 0 },
          uStackHalf: { value: new THREE.Vector2(BOX_HALF, BOX_HALF) },
        },
      }),
    );
    board.frustumCulled = false;

    // Board lights (instanced)
    const lg = quadGeometry();
    const n = LIGHTS.length;
    const off = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    const sp = new Float32Array(n * 2);
    const rate = new Float32Array(n);
    const pal = v.lights.map(hexToLinear);
    const acc = v.accentLights.map(hexToLinear);
    LIGHTS.forEach((l, i) => {
      off.set([l.x, 0.012, l.z], i * 3);
      const c = l.accent ? acc[Math.floor(l.pick * acc.length)] : pal[Math.floor(l.pick * pal.length)];
      col.set(c.map((x) => x * (l.accent ? 1.3 : 1)), i * 3);
      sp.set([l.size, l.phase], i * 2);
      rate[i] = l.rate;
    });
    lg.setAttribute("aOffset", new THREE.InstancedBufferAttribute(off, 3));
    lg.setAttribute("aColor", new THREE.InstancedBufferAttribute(col, 3));
    lg.setAttribute("aSizePhase", new THREE.InstancedBufferAttribute(sp, 2));
    lg.setAttribute("aRate", new THREE.InstancedBufferAttribute(rate, 1));
    lg.instanceCount = n;
    const lights = new THREE.Mesh(lg, spriteMaterial(1.6));
    lights.frustumCulled = false;

    // Glass layers (instanced)
    const layerGeo = new THREE.BoxGeometry(LAYER_HALF * 2, LAYER_THICK, LAYER_HALF * 2);
    layerGeo.setAttribute("aAppear", new THREE.InstancedBufferAttribute(new Float32Array(LAYERS), 1));
    layerGeo.setAttribute("aFlash", new THREE.InstancedBufferAttribute(new Float32Array(LAYERS), 1));
    const layers = new THREE.InstancedMesh(
      layerGeo,
      glassMaterial(stack, new THREE.Vector3(LAYER_HALF, LAYER_THICK / 2, LAYER_HALF), 0.22, 1.1, 0.7),
      LAYERS,
    );
    layers.frustumCulled = false;

    // Outline box glass (one instance so it shares the instanced shader)
    const boxGeo = new THREE.BoxGeometry(BOX_HALF * 2, BOX_H, BOX_HALF * 2);
    boxGeo.setAttribute("aAppear", new THREE.InstancedBufferAttribute(new Float32Array(1), 1));
    boxGeo.setAttribute("aFlash", new THREE.InstancedBufferAttribute(new Float32Array(1), 1));
    const boxMat = glassMaterial(stack, new THREE.Vector3(BOX_HALF, BOX_H / 2, BOX_HALF), 0.015, 0.0, 0.0);
    const box = new THREE.InstancedMesh(boxGeo, boxMat, 1);
    box.frustumCulled = false;

    // Edge lines: 12 thin emissive boxes (instanced)
    const edgeGeo = new THREE.BoxGeometry(1, 1, 1);
    edgeGeo.setAttribute("aAppear", new THREE.InstancedBufferAttribute(new Float32Array(12), 1));
    edgeGeo.setAttribute("aFlash", new THREE.InstancedBufferAttribute(new Float32Array(12), 1));
    const edgeMat = glassMaterial(stack, new THREE.Vector3(0.5, 0.5, 0.5), 2.6, 0.0, 0.0);
    edgeMat.side = THREE.FrontSide;
    const edges = new THREE.InstancedMesh(edgeGeo, edgeMat, 12);
    edges.frustumCulled = false;

    // Sparks at the heads of the drawing lines + rising particles (instanced)
    const sparkGeo = quadGeometry();
    const sparkN = 8 + PARTICLES.length;
    sparkGeo.setAttribute("aOffset", new THREE.InstancedBufferAttribute(new Float32Array(sparkN * 3), 3));
    sparkGeo.setAttribute("aColor", new THREE.InstancedBufferAttribute(new Float32Array(sparkN * 3), 3));
    sparkGeo.setAttribute("aSizePhase", new THREE.InstancedBufferAttribute(new Float32Array(sparkN * 2), 2));
    sparkGeo.setAttribute("aRate", new THREE.InstancedBufferAttribute(new Float32Array(sparkN), 1));
    sparkGeo.instanceCount = sparkN;
    const sparks = new THREE.Mesh(sparkGeo, spriteMaterial(1.0));
    sparks.frustumCulled = false;
    sparks.renderOrder = 10;

    return { stack, board, lights, layers, box, edges, sparks, sparkN };
  }, [v]);

  // ── Per-frame state, written during render (before R3F advances) ────────
  const { dist, az, el } = cameraAt(frame);
  cam.fov = 30;
  cam.near = 0.1;
  cam.far = 300;
  cam.position.set(
    TARGET.x + dist * Math.cos(el) * Math.sin(az),
    TARGET.y + dist * Math.sin(el),
    TARGET.z + dist * Math.cos(el) * Math.cos(az),
  );
  cam.lookAt(TARGET);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
  const focus = cam.position.distanceTo(TARGET);

  const bm = objs.board.material as THREE.ShaderMaterial;
  bm.uniforms.uCam.value.copy(cam.position);
  bm.uniforms.uFocus.value = focus;

  const m4 = new THREE.Matrix4();
  const appearAttr = objs.layers.geometry.getAttribute("aAppear") as THREE.InstancedBufferAttribute;
  const flashAttr = objs.layers.geometry.getAttribute("aFlash") as THREE.InstancedBufferAttribute;
  let built = 0;
  for (let i = 0; i < LAYERS; i++) {
    const s = layerState(i, frame);
    m4.makeTranslation(0, layerY(i) + s.drop, 0);
    objs.layers.setMatrixAt(i, m4);
    appearAttr.setX(i, s.appear);
    flashAttr.setX(i, s.flash);
    built += s.appear;
  }
  objs.layers.instanceMatrix.needsUpdate = true;
  appearAttr.needsUpdate = true;
  flashAttr.needsUpdate = true;
  bm.uniforms.uStackGlow.value = 0.18 * verticalRise(frame) + 0.82 * (built / LAYERS) * brighten(frame) * 0.9;

  const bright = brighten(frame);
  for (const mesh of [objs.layers, objs.box, objs.edges]) {
    const mat = mesh.material as THREE.ShaderMaterial;
    mat.uniforms.uCam.value.copy(cam.position);
    mat.uniforms.uBright.value = bright;
    mat.uniforms.uShimmer.value = shimmerY(frame);
  }
  // Box glass: local coords must be centred, so shift the shimmer into box space.
  (objs.box.material as THREE.ShaderMaterial).uniforms.uShimmer.value = shimmerY(frame);
  const boxAppear = objs.box.geometry.getAttribute("aAppear") as THREE.InstancedBufferAttribute;
  boxAppear.setX(0, boxGlass(frame));
  boxAppear.needsUpdate = true;
  objs.box.setMatrixAt(0, new THREE.Matrix4().makeTranslation(0, BOX_H / 2, 0));
  objs.box.instanceMatrix.needsUpdate = true;

  // Edges
  const h = BOX_HALF;
  const w = 0.016;
  const rise = verticalRise(frame);
  const bot = bottomDraw(frame);
  const top = topDraw(frame);
  const eApp = objs.edges.geometry.getAttribute("aAppear") as THREE.InstancedBufferAttribute;
  const eFl = objs.edges.geometry.getAttribute("aFlash") as THREE.InstancedBufferAttribute;
  const corners: [number, number][] = [[-h, -h], [h, -h], [h, h], [-h, h]];
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const setEdge = (i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, a: number, fl: number) => {
    pos.set(x, y, z);
    scl.set(Math.max(sx, 1e-4), Math.max(sy, 1e-4), Math.max(sz, 1e-4));
    m4.compose(pos, q, scl);
    objs.edges.setMatrixAt(i, m4);
    eApp.setX(i, a);
    eFl.setX(i, fl);
  };
  const lineGain = 0.55 + 0.45 * bright;
  corners.forEach(([x, z], i) => {
    const len = BOX_H * rise;
    setEdge(i, x, len / 2, z, w, len, w, len > 1e-3 ? lineGain : 0, 0);
  });
  // bottom square: grows from the centre of each side
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const cx = (a[0] + b[0]) / 2;
    const cz = (a[1] + b[1]) / 2;
    const L = 2 * h * bot;
    const alongX = a[1] === b[1];
    setEdge(4 + i, cx, 0.004, cz, alongX ? L : w, w, alongX ? w : L, bot > 0 ? 0.8 * lineGain : 0, 0);
  }
  // top square: each edge grows from a corner, chasing round
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const L = 2 * h * top;
    const dx = Math.sign(b[0] - a[0]);
    const dz = Math.sign(b[1] - a[1]);
    setEdge(8 + i, a[0] + (dx * L) / 2, BOX_H, a[1] + (dz * L) / 2, dx ? L : w, w, dz ? L : w, top > 0 ? lineGain : 0, top > 0 && top < 1 ? 0.6 : 0);
  }
  objs.edges.instanceMatrix.needsUpdate = true;
  eApp.needsUpdate = true;
  eFl.needsUpdate = true;

  // Sparks + particles
  const sOff = objs.sparks.geometry.getAttribute("aOffset") as THREE.InstancedBufferAttribute;
  const sCol = objs.sparks.geometry.getAttribute("aColor") as THREE.InstancedBufferAttribute;
  const sSP = objs.sparks.geometry.getAttribute("aSizePhase") as THREE.InstancedBufferAttribute;
  const white = [1, 1, 1];
  const sc = objs.stack.toArray();
  const headGain = rise < 1 ? 1 : Math.max(0, 1 - (frame - 60) / 12);
  corners.forEach(([x, z], i) => {
    sOff.setXYZ(i, x, BOX_H * rise, z);
    const g = headGain * 2.2;
    sCol.setXYZ(i, (sc[0] * 0.5 + 0.5) * g, (sc[1] * 0.5 + 0.5) * g, (sc[2] * 0.5 + 0.5) * g);
    sSP.setXY(i, 0.05, 0);
  });
  const topGain = top > 0 && top < 1 ? 2.0 : top >= 1 ? Math.max(0, 2.0 - (frame - 285) / 6) : 0;
  corners.forEach((a, i) => {
    const b = corners[(i + 1) % 4];
    const x = a[0] + (b[0] - a[0]) * top;
    const z = a[1] + (b[1] - a[1]) * top;
    sOff.setXYZ(4 + i, x, BOX_H, z);
    sCol.setXYZ(4 + i, white[0] * topGain, white[1] * topGain, white[2] * topGain);
    sSP.setXY(4 + i, 0.045, 0);
  });
  const pw = particleWindow(frame);
  PARTICLES.forEach((p, k) => {
    const i = 8 + k;
    const y = (p.y0 + (frame - 280) * p.speed) % (BOX_H + 0.8);
    const fade = Math.min(1, y / 0.4) * Math.min(1, (BOX_H + 0.8 - y) / 0.6);
    sOff.setXYZ(i, p.x, y, p.z);
    const g = pw * fade * (0.6 + 0.4 * Math.sin(frame * 0.2 + p.phase));
    sCol.setXYZ(i, (sc[0] * 0.6 + 0.4) * g, (sc[1] * 0.6 + 0.4) * g, (sc[2] * 0.6 + 0.4) * g);
    sSP.setXY(i, p.size, 0);
  });
  sOff.needsUpdate = true;
  sCol.needsUpdate = true;
  sSP.needsUpdate = true;

  for (const mesh of [objs.lights, objs.sparks]) {
    const mat = mesh.material as THREE.ShaderMaterial;
    mat.uniforms.uCam.value.copy(cam.position);
    mat.uniforms.uFocus.value = focus;
    mat.uniforms.uFrame.value = frame;
  }
  (objs.sparks.material as THREE.ShaderMaterial).uniforms.uAperture.value = APERTURE * 0.5;

  return (
    <>
      <primitive object={objs.board} />
      <primitive object={objs.lights} />
      <primitive object={objs.box} renderOrder={1} />
      <primitive object={objs.layers} renderOrder={2} />
      <primitive object={objs.edges} renderOrder={3} />
      <primitive object={objs.sparks} />
    </>
  );
};

// ── Post chain ─────────────────────────────────────────────────────────────
const BLOOM_LEVELS = 6;

const Post: React.FC = () => {
  const frame = useCurrentFrame();
  const gl = useThree((s) => s.gl);
  const chain = useMemo(() => {
    const opts = { type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    const sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4, depthBuffer: true });
    const down = Array.from({ length: BLOOM_LEVELS }, () => new THREE.WebGLRenderTarget(1, 1, opts));
    const up = Array.from({ length: BLOOM_LEVELS }, () => new THREE.WebGLRenderTarget(1, 1, opts));
    const mk = (fragmentShader: string, uniforms: Record<string, THREE.IUniform>) =>
      new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: fsVert, fragmentShader, uniforms, depthTest: false, depthWrite: false });
    const downMat = mk(downFrag, { uSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uPrefilter: { value: 0 } });
    const upMat = mk(upFrag, { uSrc: { value: null }, uBase: { value: null }, uTexel: { value: new THREE.Vector2() } });
    const compMat = mk(compositeFrag, {
      uScene: { value: null },
      uBloom: { value: null },
      uBloomStrength: { value: 0.6 },
      uCA: { value: 0.006 },
      uExposure: { value: 1.0 },
      uFrame: { value: 0 },
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const quad = new THREE.Mesh(tri, downMat);
    quad.frustumCulled = false;
    const fsScene = new THREE.Scene();
    fsScene.add(quad);
    const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { sceneRT, down, up, downMat, upMat, compMat, quad, fsScene, fsCam, size: new THREE.Vector2() };
  }, []);

  chain.compMat.uniforms.uFrame.value = frame;

  useFrame(({ scene, camera }) => {
    const c = chain;
    gl.getDrawingBufferSize(c.size);
    const W = c.size.x;
    const H = c.size.y;
    if (c.sceneRT.width !== W || c.sceneRT.height !== H) {
      c.sceneRT.setSize(W, H);
      let w = W;
      let h = H;
      for (let i = 0; i < BLOOM_LEVELS; i++) {
        w = Math.max(1, Math.floor(w / 2));
        h = Math.max(1, Math.floor(h / 2));
        c.down[i].setSize(w, h);
        c.up[i].setSize(w, h);
      }
    }
    gl.autoClear = true;
    gl.setClearColor(0x000000, 1);
    gl.setRenderTarget(c.sceneRT);
    gl.clear();
    gl.render(scene, camera);

    const pass = (mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
      c.quad.material = mat;
      gl.setRenderTarget(target);
      gl.render(c.fsScene, c.fsCam);
    };
    // downsample chain
    let src: THREE.WebGLRenderTarget = c.sceneRT;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      c.downMat.uniforms.uSrc.value = src.texture;
      c.downMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
      c.downMat.uniforms.uPrefilter.value = i === 0 ? 1 : 0;
      pass(c.downMat, c.down[i]);
      src = c.down[i];
    }
    // upsample + accumulate
    let low: THREE.WebGLRenderTarget = c.down[BLOOM_LEVELS - 1];
    for (let i = BLOOM_LEVELS - 2; i >= 0; i--) {
      c.upMat.uniforms.uSrc.value = low.texture;
      c.upMat.uniforms.uBase.value = c.down[i].texture;
      c.upMat.uniforms.uTexel.value.set(1 / low.width, 1 / low.height);
      pass(c.upMat, c.up[i]);
      low = c.up[i];
    }
    c.compMat.uniforms.uScene.value = c.sceneRT.texture;
    c.compMat.uniforms.uBloom.value = low.texture;
    pass(c.compMat, null);
  }, 1);

  return null;
};

export const DataStack: React.FC<{ version: DataStackVersion }> = ({ version }) => {
  const { width, height } = useVideoConfig();
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        flat
        linear
        camera={{ fov: 30, near: 0.1, far: 300, position: [8, 8, 8] }}
        gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
      >
        <Scene v={version} />
        <Post />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

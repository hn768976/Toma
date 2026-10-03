// Look 3 — Growing Fibre Strands (three.js via @remotion/three, WebGL2).
//
// Each frame, every strand's visible polyline is evaluated from closed-form
// growth + sway functions of the frame (data.ts) and written into one ribbon
// mesh; heads are instanced sprites at the growth fronts. Render: additive
// HDR scene -> bloom -> tone-map. Background is cleared to exact black and
// the final pass never adds grain or dither to black.
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
import { GROWING_FIBRES_PALETTES, GrowingFibresPalette } from "../palettes";
import { hexToRgb, smoothstep } from "../lib/random";
import { HASH_GLSL } from "../lib/glsl";
import { Bloom, makeTarget, pass } from "../lib/threePost";
import { growth, POINTS, STRANDS, strandPoint } from "./data";

const HALF_W = 0.0135; // ribbon half-width (world)

const RIBBON_VERT = /* glsl */ `
in float aSide;
in float aCol;     // colour position base(0) -> tip(1)
in float aBright;
out float vSide;
out float vCol;
out float vBright;
void main() {
  vSide = aSide;
  vCol = aCol;
  vBright = aBright;
  gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0);
}
`;

const RIBBON_FRAG = /* glsl */ `
precision highp float;
in float vSide;
in float vCol;
in float vBright;
out vec4 outColor;
uniform vec3 uBase;
uniform vec3 uTip;
void main() {
  float across = exp(-vSide * vSide * 4.5);
  vec3 col = mix(uBase, uTip, smoothstep(0.3, 1.0, vCol));
  outColor = vec4(col * across * vBright, 1.0);
}
`;

const HEAD_VERT = /* glsl */ `
in vec4 aHead;  // x, y, z, size
in float aGlow;
in float aSoft; // 0 = in focus, 1 = strongly defocused (near the lens)
out vec2 vUv;
out float vGlow;
out float vSoft;
void main() {
  vUv = position.xy * 2.0;
  vGlow = aGlow;
  vSoft = aSoft;
  vec3 world = aHead.xyz + vec3(position.xy * aHead.w, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const HEAD_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vGlow;
in float vSoft;
out vec4 outColor;
uniform vec3 uHead;
uniform vec3 uHalo;
void main() {
  float r = length(vUv);
  float edge = 1.0 - smoothstep(0.75, 1.0, r);
  // defocus spreads the core into a soft disc of the same energy
  float rc = mix(0.07, 0.24, vSoft);
  float k = (0.07 * 0.07) / (rc * rc);
  float core = exp(-pow(r / rc, 2.0)) * k;
  float mid = exp(-pow(r / mix(0.17, 0.3, vSoft), 2.0)) * mix(1.0, 0.5, vSoft);
  float halo = exp(-pow(r / 0.3, 2.0));
  vec3 col = mix(uHead, vec3(1.0), 0.3) * core * 4.5 + uHead * mid * 1.0 + uHalo * halo * 0.5;
  outColor = vec4(col * edge * vGlow, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform sampler2D tHaze;
uniform vec3 uHazeColor;
uniform float uBloom;
uniform float uExposure;
uniform float uFrame;
${HASH_GLSL}
void main() {
  vec3 c = texture(tScene, vUv).rgb + texture(tBloom, vUv).rgb * uBloom;
  // wide blue ambient haze around the strands, confined to the lower part
  // of frame so the top stays exactly black
  float hz = dot(texture(tHaze, vUv).rgb, vec3(0.33));
  float mask = 1.0 - smoothstep(0.3, 0.55, vUv.y);
  c += uHazeColor * hz * mask;
  vec3 m = 1.0 - exp(-max(c, 0.0) * uExposure);
  // black stays exactly black: dither only where there is visible signal,
  // and no grain at all in this look
  float l = max(m.r, max(m.g, m.b));
  uvec2 p = uvec2(gl_FragCoord.xy);
  m += ditherTPDF(p, uint(uFrame + 0.5)) * smoothstep(1.5 / 255.0, 4.0 / 255.0, l);
  // anything below half a code value is black
  m *= step(0.5 / 255.0, l);
  outColor = vec4(clamp(m, 0.0, 1.0), 1.0);
}
`;

const lin = (hex: string, k = 1, gamma = 1.8) => {
  const c = hexToRgb(hex).map((x) => Math.pow(x, gamma));
  return new THREE.Vector3(c[0] * k, c[1] * k, c[2] * k);
};

const buildPipeline = (pal: GrowingFibresPalette) => {
  const scene = new THREE.Scene();
  const nS = STRANDS.length;
  const vPerStrand = POINTS * 2;

  // ---- ribbons (one mesh for all strands)
  const rib = new THREE.BufferGeometry();
  const pos = new Float32Array(nS * vPerStrand * 3);
  const side = new Float32Array(nS * vPerStrand);
  const colA = new Float32Array(nS * vPerStrand);
  const bright = new Float32Array(nS * vPerStrand);
  const index: number[] = [];
  for (let i = 0; i < nS; i++) {
    for (let j = 0; j < POINTS; j++) {
      const v = i * vPerStrand + j * 2;
      side[v] = -1;
      side[v + 1] = 1;
      if (j < POINTS - 1) index.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  }
  const posAttr = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
  const colAttr = new THREE.BufferAttribute(colA, 1).setUsage(THREE.DynamicDrawUsage);
  const brAttr = new THREE.BufferAttribute(bright, 1).setUsage(THREE.DynamicDrawUsage);
  rib.setAttribute("position", posAttr);
  rib.setAttribute("aSide", new THREE.BufferAttribute(side, 1));
  rib.setAttribute("aCol", colAttr);
  rib.setAttribute("aBright", brAttr);
  rib.setIndex(index);
  const additive = {
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  } as const;
  const ribMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: RIBBON_VERT,
    fragmentShader: RIBBON_FRAG,
    uniforms: {
      uBase: { value: lin(pal.stemBase, 1.0, 1.0) },
      uTip: { value: lin(pal.stemTip, 1.0, 1.0) },
    },
    ...additive,
  });
  const ribMesh = new THREE.Mesh(rib, ribMat);
  ribMesh.frustumCulled = false;
  scene.add(ribMesh);

  // ---- heads
  const plane = new THREE.PlaneGeometry(1, 1);
  const hg = new THREE.InstancedBufferGeometry();
  hg.index = plane.index;
  hg.setAttribute("position", plane.getAttribute("position"));
  const aHead = new Float32Array(nS * 4);
  const aGlow = new Float32Array(nS);
  const aSoft = new Float32Array(nS);
  const headAttr = new THREE.InstancedBufferAttribute(aHead, 4).setUsage(THREE.DynamicDrawUsage);
  const glowAttr = new THREE.InstancedBufferAttribute(aGlow, 1).setUsage(THREE.DynamicDrawUsage);
  hg.setAttribute("aHead", headAttr);
  hg.setAttribute("aGlow", glowAttr);
  const softAttr = new THREE.InstancedBufferAttribute(aSoft, 1).setUsage(THREE.DynamicDrawUsage);
  hg.setAttribute("aSoft", softAttr);
  hg.instanceCount = nS;
  const headMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: HEAD_VERT,
    fragmentShader: HEAD_FRAG,
    uniforms: {
      uHead: { value: lin(pal.head, 1.0) },
      uHalo: { value: lin(pal.halo, 1.0) },
    },
    ...additive,
  });
  const headMesh = new THREE.Mesh(hg, headMat);
  headMesh.frustumCulled = false;
  scene.add(headMesh);

  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 100);
  camera.position.set(0, 0, 10);
  camera.lookAt(0, 0, 0);

  const pts: number[][] = Array.from({ length: POINTS }, () => [0, 0, 0]);
  const tmp: [number, number, number] = [0, 0, 0];

  const update = (frame: number) => {
    // settle: heads twinkle once the field is grown
    const settled = smoothstep(285, 320, frame);
    for (let i = 0; i < nS; i++) {
      const s = STRANDS[i];
      const g = growth(i, frame);
      const base = i * vPerStrand;
      if (g <= 0) {
        for (let k = 0; k < vPerStrand; k++) {
          pos[(base + k) * 3] = 0;
          pos[(base + k) * 3 + 1] = -50;
          pos[(base + k) * 3 + 2] = 0;
          bright[base + k] = 0;
        }
        aHead[i * 4 + 1] = -50;
        aGlow[i] = 0;
        continue;
      }
      for (let j = 0; j < POINTS; j++) {
        strandPoint(i, (g * j) / (POINTS - 1), frame, tmp);
        pts[j][0] = tmp[0];
        pts[j][1] = tmp[1];
        pts[j][2] = tmp[2];
      }
      const c0 = s.parent >= 0 ? s.branchAt : 0;
      for (let j = 0; j < POINTS; j++) {
        const a = pts[Math.max(0, j - 1)];
        const b = pts[Math.min(POINTS - 1, j + 1)];
        let tx = b[0] - a[0];
        let ty = b[1] - a[1];
        const tl = Math.hypot(tx, ty) || 1;
        tx /= tl;
        ty /= tl;
        // depth of field: strands nearer the lens than the focus plane
        // (z = 0) get wider, dimmer, softer
        const soft = Math.min(1, Math.max(0, (pts[j][2] - 0.6) / 1.6, (-pts[j][2] - 1.2) / 2.5));
        const hw = HALF_W * s.width * (1 + 2.2 * soft);
        const nx = -ty * hw;
        const ny = tx * hw;
        const v = base + j * 2;
        pos[v * 3] = pts[j][0] - nx;
        pos[v * 3 + 1] = pts[j][1] - ny;
        pos[v * 3 + 2] = pts[j][2];
        pos[(v + 1) * 3] = pts[j][0] + nx;
        pos[(v + 1) * 3 + 1] = pts[j][1] + ny;
        pos[(v + 1) * 3 + 2] = pts[j][2];
        const u = (g * j) / (POINTS - 1);
        const cc = c0 + u * (1 - c0);
        // tint by absolute height in the strand; slightly dimmer right at
        // the growth front so the head reads as the bright point
        const front = 1 - 0.5 * smoothstep(0.85, 1, j / (POINTS - 1));
        colA[v] = colA[v + 1] = cc;
        bright[v] = bright[v + 1] = (s.bright * 0.5 * front) / (1 + 2.2 * soft);
      }
      const tip = pts[POINTS - 1];
      aHead[i * 4] = tip[0];
      aHead[i * 4 + 1] = tip[1];
      aHead[i * 4 + 2] = tip[2];
      const hs = Math.min(1, Math.max(0, (tip[2] - 0.6) / 1.6, (-tip[2] - 1.2) / 2.5));
      aSoft[i] = hs;
      aHead[i * 4 + 3] = 0.42 * s.headSize * (1 + 0.8 * hs);
      const tw = 0.72 + 0.28 * Math.sin((frame / 30) * s.twC * Math.PI + s.twP);
      const appear = smoothstep(0, 0.04, g);
      aGlow[i] = appear * (1 - settled + settled * tw) * (s.parent >= 0 ? 0.85 : 1);
    }
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
    brAttr.needsUpdate = true;
    headAttr.needsUpdate = true;
    glowAttr.needsUpdate = true;
    softAttr.needsUpdate = true;
  };

  const final = pass(FINAL_FRAG, {
    tScene: { value: null },
    tBloom: { value: null },
    uBloom: { value: 0.32 },
    tHaze: { value: null },
    uHazeColor: { value: lin(pal.halo, 1.1) },
    uExposure: { value: 1.0 },
    uFrame: { value: 0 },
  });
  const bloom = new Bloom(5);
  const state = { w: 0, h: 0, rt: null as THREE.WebGLRenderTarget | null };
  const size = new THREE.Vector2();

  const render = (gl: THREE.WebGLRenderer, frame: number) => {
    gl.getDrawingBufferSize(size);
    const w = size.x;
    const h = size.y;
    if (w !== state.w || h !== state.h) {
      state.rt?.dispose();
      state.rt = makeTarget(w, h, true);
      state.rt.samples = 4;
      bloom.setSize(w, h);
      state.w = w;
      state.h = h;
    }
    update(frame);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    gl.autoClear = false;
    gl.setRenderTarget(state.rt);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, false);
    gl.render(scene, camera);
    const bloomTex = bloom.render(gl, state.rt!.texture, w, h, 0.0);
    const fu = final.material.uniforms;
    fu.tScene.value = state.rt!.texture;
    fu.tBloom.value = bloomTex;
    fu.tHaze.value = bloom.down[bloom.levels - 1].texture;
    fu.uFrame.value = frame;
    gl.setRenderTarget(null);
    final.quad.render(gl);
  };
  return { render };
};

const StrandScene: React.FC<{ palette: string }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const pipeline = useMemo(
    () => buildPipeline(GROWING_FIBRES_PALETTES[palette]),
    [palette],
  );
  const { gl } = useThree();
  useFrame(() => {
    pipeline.render(gl, frameRef.current);
  }, 1);
  return null;
};

export const GrowingFibres: React.FC<{ palette: string }> = ({ palette }) => {
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
        <StrandScene palette={palette} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

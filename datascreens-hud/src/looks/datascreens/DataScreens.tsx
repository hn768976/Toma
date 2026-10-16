import React, { useMemo } from "react";
import * as THREE from "three";
import { LOOP_FRAMES, fract, hexToRgb, loopFrame } from "../../lib/loop";
import { int, mulberry32, pick, range } from "../../lib/random";
import { StageCtx, StageFactory, ThreeStage } from "../../lib/ThreeStage";
import { PanelSpec, PanelType, makePanel } from "./panels";

export interface DataScreensProps {
  ink: string; // main white
  dim: string; // dimmer grey panels
  background: string; // pure black, for Screen / Add
}

// ---------------------------------------------------------------------------
// Layout, generated once at module level.
// ---------------------------------------------------------------------------
const FOV = 40;
const TAN = Math.tan(((FOV / 2) * Math.PI) / 180);
const ASPECT = 16 / 9;
const FOCUS_Z = 7;

interface LayerDef {
  z: number; // distance
  count: number;
  widths: [number, number]; // fraction of visible width
  cycles: number; // wrap periods travelled per loop
  span: number; // wrap span as multiple of the visible width
  dz: number; // drift toward camera across one pass (world units)
  types: PanelType[];
  bigBinary: boolean;
}

const LAYERS: LayerDef[] = [
  { z: 3.4, count: 5, widths: [0.45, 0.85], cycles: 1, span: 2.6, dz: 0.5, types: ["binary", "hex", "table"], bigBinary: true },
  // hero layer: the big binary grid and large login/readout panels, nearly in focus
  { z: 5.2, count: 3, widths: [0.45, 0.7], cycles: 1, span: 2.0, dz: 0.3, types: ["login", "marker"], bigBinary: true },
  { z: 7, count: 15, widths: [0.09, 0.24], cycles: 1, span: 1.7, dz: 0.6, types: ["hex", "table", "table", "form", "marker", "code", "paragraph", "binary", "login", "login"], bigBinary: false },
  { z: 11, count: 16, widths: [0.08, 0.2], cycles: 1, span: 1.45, dz: 0.8, types: ["hex", "paragraph", "table", "code", "bars", "form", "binary", "bracket"], bigBinary: false },
  { z: 18, count: 21, widths: [0.06, 0.15], cycles: 1, span: 1.3, dz: 1.0, types: ["hex", "paragraph", "paragraph", "table", "code", "marker", "bars"], bigBinary: false },
];

interface PanelPlacement {
  spec: PanelSpec;
  layer: number;
  z: number;
  y: number;
  worldW: number;
  worldH: number;
  phase: number;
  span: number;
  cycles: number;
  dz: number;
  blur720: number;
  brightness: number;
  dimInk: boolean;
}

const visW = (z: number) => 2 * z * TAN * ASPECT;
const visH = (z: number) => 2 * z * TAN;

const layoutRng = mulberry32(0x0d47a5c3);
const PLACEMENTS: PanelPlacement[] = [];
LAYERS.forEach((L, li) => {
  // evenly staggered phases so the layer stays populated
  const order = Array.from({ length: L.count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(layoutRng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (let i = 0; i < L.count; i++) {
    const type = pick(layoutRng, L.types);
    const live = layoutRng() < 0.36;
    const big = L.bigBinary && (li === 1 ? i === 0 || i === 2 : i === 0);
    const spec = makePanel(layoutRng, big ? "binary" : type, live, big);
    const z = L.z + range(layoutRng, -0.12, 0.12) * L.z;
    let worldW = visW(L.z) * range(layoutRng, L.widths[0], L.widths[1]) * (big ? (li === 1 ? 1.15 : 1.3) : 1);
    // readout markers stay small; they read as labels, not as panels
    if (spec.type === "marker") worldW = Math.min(worldW, visW(L.z) * 0.16);
    const worldH = (worldW * spec.h) / spec.w;
    const yLim = visH(L.z) * 0.5 * (li <= 1 ? 0.75 : 1.0);
    // the hero grid rides in the upper part of the frame
    const y = li === 1 && big ? visH(L.z) * 0.22 : range(layoutRng, -yLim, yLim);
    const maxPanelW = visW(L.z) * L.widths[1] * 1.3;
    const span = Math.max(L.span * visW(L.z + L.dz), visW(L.z * 1.12 + L.dz) + maxPanelW + 1);
    const coc = Math.abs(1 - FOCUS_Z / z);
    const blur720 = li === 1 ? 0.8 : z < FOCUS_Z ? 5.5 * coc : 1.8 * coc;
    PLACEMENTS.push({
      spec,
      layer: li,
      z,
      y,
      worldW,
      worldH,
      // the two hero grids sit half a wrap apart so one is always in view
      phase: li === 1 && big ? (i === 0 ? 0.25 : 0.75) : (order[i] + range(layoutRng, 0.1, 0.9)) / L.count,
      span,
      cycles: L.cycles,
      dz: L.dz,
      blur720,
      brightness: (li === 0 ? (big ? 0.35 : 0.4) : [0.9, 1.0, 1.0, 0.7, 0.45][li]) * range(layoutRng, 0.85, 1),
      dimInk: layoutRng() < 0.2,
    });
  }
});
// a couple of spare ints keep the generator stream stable if layers change
int(layoutRng, 0, 1);

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------
const VS = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FS = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D map;
uniform vec3 uColor;
uniform float uOpacity;
void main() {
  float a = texture(map, vUv).a * uOpacity;
  outColor = vec4(uColor * a, 1.0);
}`;

interface LivePanel {
  p: PanelPlacement;
  mesh: THREE.Mesh;
  canvas: HTMLCanvasElement;
  sharp: HTMLCanvasElement | null;
  tex: THREE.CanvasTexture;
  scale: number; // texture px per design px
  pad: number;
  blurTex: number;
  key: number;
}

const createApp = (props: DataScreensProps) => (ctx: StageCtx) => {
  const { gl, width: W, height: H, u } = ctx;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, W / H, 0.1, 100);
  const ink = hexToRgb(props.ink);
  const dim = hexToRgb(props.dim);

  const panels: LivePanel[] = PLACEMENTS.map((p) => {
    // texture resolution: projected size at the panel's nearest point, x1.5
    const nearestZ = p.z - p.dz / 2;
    const projPx = (p.worldW / visW(nearestZ)) * W;
    const blurOut = p.blur720 * u;
    const over = blurOut > 4 ? 0.6 : 1.5;
    let scale = (projPx * over) / p.spec.w;
    const maxDim = 4096;
    const blurTex = blurOut * (scale * p.spec.w) / projPx;
    const pad = Math.ceil(blurTex * 2.5) + 2;
    const fit = Math.min(1, (maxDim - 2 * pad) / (p.spec.w * scale), (maxDim - 2 * pad) / (p.spec.h * scale));
    scale *= fit;
    const tw = Math.ceil(p.spec.w * scale) + 2 * pad;
    const th = Math.ceil(p.spec.h * scale) + 2 * pad;
    const canvas = document.createElement("canvas");
    canvas.width = tw;
    canvas.height = th;
    const sharp = blurTex > 0.35 ? document.createElement("canvas") : null;
    if (sharp) {
      sharp.width = tw;
      sharp.height = th;
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.NoColorSpace;
    const worldPerTex = p.worldW / (p.spec.w * scale);
    const geo = new THREE.PlaneGeometry(tw * worldPerTex, th * worldPerTex);
    const col = p.dimInk ? dim : ink;
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VS,
      fragmentShader: FS,
      uniforms: {
        map: { value: tex },
        uColor: { value: new THREE.Vector3(...col) },
        uOpacity: { value: p.brightness },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquation: THREE.AddEquation,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { p, mesh, canvas, sharp, tex, scale, pad, blurTex, key: -1 };
  });

  const redraw = (lp: LivePanel, key: number) => {
    const target = lp.sharp ?? lp.canvas;
    const c = target.getContext("2d")!;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, target.width, target.height);
    c.setTransform(lp.scale, 0, 0, lp.scale, lp.pad, lp.pad);
    c.fillStyle = "#fff";
    c.strokeStyle = "#fff";
    c.globalCompositeOperation = "source-over";
    lp.p.spec.draw(c, key);
    if (lp.sharp) {
      const o = lp.canvas.getContext("2d")!;
      o.setTransform(1, 0, 0, 1, 0, 0);
      o.clearRect(0, 0, lp.canvas.width, lp.canvas.height);
      o.filter = `blur(${lp.blurTex.toFixed(2)}px)`;
      o.drawImage(lp.sharp, 0, 0);
      o.filter = "none";
    }
    lp.tex.needsUpdate = true;
    lp.key = key;
  };

  return {
    render(frame: number) {
      const f = loopFrame(frame);
      const t = f / LOOP_FRAMES;
      for (const lp of panels) {
        const key = lp.p.spec.key(f);
        if (key !== lp.key) redraw(lp, key);
        const p = lp.p;
        // position along the wrap: whole number of spans per loop
        const s = fract(p.phase + p.cycles * t);
        const x = p.span / 2 - s * p.span;
        const z = p.z + p.dz / 2 - s * p.dz;
        lp.mesh.position.set(x, p.y, -z);
      }
      gl.setRenderTarget(null);
      gl.setClearColor(0x000000, 1);
      gl.clear(true, true, true);
      gl.render(scene, camera);
    },
    dispose() {
      panels.forEach((lp) => {
        lp.tex.dispose();
        lp.mesh.geometry.dispose();
        (lp.mesh.material as THREE.Material).dispose();
      });
    },
  };
};

export const DataScreens: React.FC<DataScreensProps> = (props) => {
  const factory: StageFactory = useMemo(
    () => createApp(props),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.ink, props.dim, props.background],
  );
  return <ThreeStage factory={factory} background={props.background} />;
};

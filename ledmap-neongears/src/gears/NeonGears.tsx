import React, { useMemo } from "react";
import * as THREE from "three";
import { GLStage, FrameRenderer } from "../lib/GLStage";
import { lin } from "../lib/color";
import { FullscreenPass, fullscreenMaterial, hdrTarget, HEADER } from "../lib/gl";
import { PostChain } from "../lib/post";
import { loopPhase, TAU } from "../lib/loop";
import type { GearRow } from "../versions";
import {
  CAM_DRIFT_X,
  CAM_DRIFT_Y,
  CAM_PUSH,
  CAM_Z0,
  FOCUS_REF,
  FOV_DEG,
  GEARS,
  gearAngle,
  LAYER_SPACING,
  LAYER_Z,
  LAYERS,
} from "./layout";
import { FILL_FRAG, FILL_VERT, gearShape, RIBBON_FRAG, RIBBON_VERT, ribbonGeometry } from "./geometry";

// ---- look constants ------------------------------------------------------------------
const SIGMA0 = 0.025; // line sigma (world) at the focus layer: ~25 px FWHM at 4K
const MIN_SIGMA_PX = 0.55; // anti-aliasing floor, in pixels of the layer's render target
const LINE_GAIN = 1.3;
const CORE_GAIN = 0.45;
const FILL_AMT = 0.004;
const FILL_HOT = 0.11;
const FAR_DIM = 0.02; // brightness of the farthest layer relative to the nearest
const DEBUG_LAYERS = process.env.REMOTION_DEBUG_LAYERS
  ? process.env.REMOTION_DEBUG_LAYERS.split(",").map(Number)
  : null;
const NEAR_DIM = 0.45;
// Defocused lines spread their energy; give them back part of it so out-of-focus gears
// read as bright soft neon (as in the references) rather than dim brown smears.
const DEFOCUS_COMP = 0.15;
const DEFOCUS_COMP_MAX = 1.5;
const ROLL = (18 * Math.PI) / 180;
const DOF_K = 0.055; // CoC radius as a fraction of frame height per unit |1 - dF/d|
const GATHER_R = 6; // max gather radius in pixels of the (downsampled) layer target
const GATHER_N = 48;

const GATHER = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uR;
in vec2 vUv;
out vec4 outColor;
void main() {
  // Fixed golden-angle disc, Gaussian-weighted: a soft bokeh that never turns a toothed
  // rim into a string of beads.
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  for (int i = 0; i < ${GATHER_N}; i++) {
    float fi = float(i) + 0.5;
    float u = sqrt(fi / ${GATHER_N}.0);
    float a = fi * 2.39996323;
    float w = exp(-2.2 * u * u);
    acc += texture(tSrc, vUv + vec2(cos(a), sin(a)) * u * uR * uTexel).rgb * w;
    wsum += w;
  }
  outColor = vec4(acc / wsum, 1.0);
}`;

// Bicubic B-spline upsample in 4 bilinear taps (smooth when a layer was blurred at 1/32 res).
const ADD_UP = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uSize;
uniform float uGain;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 p = vUv * uSize - 0.5;
  vec2 i = floor(p), f = p - i;
  vec2 f2 = f * f, f3 = f2 * f;
  vec2 w0 = (1.0 / 6.0) * (-f3 + 3.0 * f2 - 3.0 * f + 1.0);
  vec2 w1 = (1.0 / 6.0) * (3.0 * f3 - 6.0 * f2 + 4.0);
  vec2 w2 = (1.0 / 6.0) * (-3.0 * f3 + 3.0 * f2 + 3.0 * f + 1.0);
  vec2 w3 = (1.0 / 6.0) * f3;
  vec2 g0 = w0 + w1, g1 = w2 + w3;
  vec2 h0 = (i - 1.0 + w1 / g0 + 0.5) / uSize;
  vec2 h1 = (i + 1.0 + w3 / g1 + 0.5) / uSize;
  vec3 c = g0.y * (g0.x * texture(tSrc, vec2(h0.x, h0.y)).rgb + g1.x * texture(tSrc, vec2(h1.x, h0.y)).rgb)
         + g1.y * (g0.x * texture(tSrc, vec2(h0.x, h1.y)).rgb + g1.x * texture(tSrc, vec2(h1.x, h1.y)).rgb);
  outColor = vec4(c * uGain, 1.0);
}`;

export type CameraState = { x: number; y: number; z: number; roll: number; focusZ: number };

// Closed camera lap and focus shift: whole cycles of the loop phase only.
export const cameraAt = (t: number): CameraState => ({
  x: CAM_DRIFT_X * Math.sin(TAU * t),
  y: CAM_DRIFT_Y * Math.sin(TAU * 2 * t + 0.6),
  z: CAM_Z0 + CAM_PUSH * Math.sin(TAU * t + 1.1),
  roll: ROLL * Math.sin(TAU * t + 0.4),
  // between layer 2 (z = -1.5) and layer 3 (z = -3)
  focusZ: LAYER_Z(1) - LAYER_SPACING * (0.5 - 0.5 * Math.cos(TAU * t + 2.0)),
});

const makeRenderer = (row: GearRow) =>
  (gl: THREE.WebGLRenderer, w: number, h: number): FrameRenderer => {
    const tanHalf = Math.tan(((FOV_DEG / 2) * Math.PI) / 180);
    const camera = new THREE.PerspectiveCamera(FOV_DEG, w / h, 0.05, 200);
    const scenes = Array.from({ length: LAYERS }, () => new THREE.Scene());
    const ribbonMats: THREE.RawShaderMaterial[] = [];
    const meshes: { mesh: THREE.Object3D; gear: (typeof GEARS)[number] }[] = [];
    const disposables: { dispose(): void }[] = [];
    const core = lin(row.core);

    for (const g of GEARS) {
      const tl = g.layer / (LAYERS - 1);
      const list = row.perGearMix ? row.lineNear : null;
      // 2B: colour by quadrant (with a quarter of the gears mixed at random)
      const qi = (g.x > 0 ? 0 : 2) + (g.y > 0 ? 0 : 1);
      const ci = (g.seed >> 3) % 4 === 0 ? g.colorIndex : qi;
      const color = list
        ? lin(list[ci % list.length])
        : lin(row.lineNear[0]).lerp(lin(row.lineFar[0]), tl);
      const scale = (CAM_Z0 - LAYER_Z(g.layer)) / FOCUS_REF;
      // nearest layer (huge soft glows) slightly held back; far layers fade into haze
      // layers 0-2 (near + focus) at full strength; behind the focus they fade into haze
      const dim =
        g.brightness *
        (g.layer <= 2 ? 1 : Math.pow(FAR_DIM, (g.layer - 2) / (LAYERS - 3))) *
        (g.layer === 0 ? NEAR_DIM : 1);
      const shape = gearShape(g);
      const geo = ribbonGeometry(shape.polys);
      const mat = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: `${HEADER}\n${RIBBON_VERT}`,
        fragmentShader: `${HEADER}\n${RIBBON_FRAG}`,
        uniforms: {
          uSigma: { value: SIGMA0 * scale * row.lineScale },
          uViewH: { value: h },
          uTanHalf: { value: tanHalf },
          uMinPx: { value: MIN_SIGMA_PX },
          uColor: { value: color.clone() },
          uCore: { value: core },
          uGain: { value: LINE_GAIN * dim },
          uCoreGain: { value: CORE_GAIN * dim },
          uFocusCore: { value: 1 },
        },
        // MAX blending within a layer: a ribbon folding over itself on a tight curve (or two
        // lines crossing) never doubles into a hot spot. Layers are summed additively later.
        blending: THREE.CustomBlending,
        blendEquation: THREE.MaxEquation,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneFactor,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      ribbonMats.push(mat);
      const group = new THREE.Group();
      group.position.set(g.x, g.y, LAYER_Z(g.layer));
      const ribbon = new THREE.Mesh(geo, mat);
      ribbon.frustumCulled = false;
      const fillGeo = new THREE.CircleGeometry(shape.fillR, 96);
      const fillMat = new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: `${HEADER}\n${FILL_VERT}`,
        fragmentShader: `${HEADER}\n${FILL_FRAG}`,
        uniforms: {
          uR: { value: shape.fillR },
          uColor: { value: color.clone() },
          // most gears are hollow; about one in five has a glowing body
          uAmt: { value: dim * ((g.seed % 1000) / 1000 < 0.2 ? FILL_HOT : FILL_AMT) },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const fill = new THREE.Mesh(fillGeo, fillMat);
      fill.frustumCulled = false;
      group.add(fill, ribbon);
      scenes[g.layer].add(group);
      meshes.push({ mesh: group, gear: g });
      disposables.push(geo, mat, fillGeo, fillMat);
    }

    // Per-downsample-level render targets, created on first use (deterministic: depends
    // only on the frame's camera state).
    const pool = new Map<number, [THREE.WebGLRenderTarget, THREE.WebGLRenderTarget]>();
    const rtPair = (s: number) => {
      let p = pool.get(s);
      if (!p) {
        p = [hdrTarget(w / s, h / s), hdrTarget(w / s, h / s)];
        pool.set(s, p);
      }
      return p;
    };
    const accum = hdrTarget(w, h);
    const pass = new FullscreenPass();
    const gather = fullscreenMaterial(GATHER, {
      tSrc: { value: null },
      uTexel: { value: new THREE.Vector2() },
      uR: { value: 1 },
    });
    const addUp = fullscreenMaterial(
      ADD_UP,
      { tSrc: { value: null }, uSize: { value: new THREE.Vector2() }, uGain: { value: 1 } },
      THREE.AdditiveBlending,
    );
    const post = new PostChain(w, h, {
      bloom: row.bloom,
      threshold: 0.2,
      knee: 0.2,
      exposure: 1,
      shoulder: 0.6,
      huePreserve: 0.35,
      vignette: 0.45,
      grain: 0.015,
      grainFade: row.grainFade,
      bg: lin(row.bg),
      haze: lin(row.haze),
      hazeAmt: row.hazeAmt,
    });
    const hazeOffset = new THREE.Vector2();

    return {
      render(frame) {
        const t = loopPhase(frame);
        for (const { mesh, gear } of meshes) mesh.rotation.z = gearAngle(gear, t);
        const cs = cameraAt(t);
        camera.position.set(cs.x, cs.y, cs.z);
        camera.rotation.set(0, 0, cs.roll);
        camera.updateMatrixWorld(true);
        const dF = cs.z - cs.focusZ;

        gl.setClearColor(0x000000, 1);
        gl.setRenderTarget(accum);
        gl.clear(true, true, false);
        for (let l = 0; l < LAYERS; l++) {
          if (DEBUG_LAYERS && !DEBUG_LAYERS.includes(l)) continue;
          const d = cs.z - LAYER_Z(l);
          const coc = DOF_K * h * Math.abs(1 - dF / d); // gather radius, output pixels
          let s = 1;
          while (coc / s > GATHER_R && s < 32) s *= 2;
          const [rtA, rtB] = rtPair(s);
          const scale = (CAM_Z0 - LAYER_Z(l)) / FOCUS_REF;
          const linePx = (2.355 * SIGMA0 * scale * h) / (2 * d * tanHalf);
          const focus = 1 / (1 + (coc / linePx) ** 2);
          for (const m of ribbonMats) {
            m.uniforms.uViewH.value = rtA.height;
            m.uniforms.uFocusCore.value = focus;
            // Widen lines to the gather's sample spacing so the disc pattern never beads.
            m.uniforms.uMinPx.value = Math.max(
              MIN_SIGMA_PX,
              0.6 * (coc / s) * Math.sqrt(Math.PI / GATHER_N),
            );
          }
          gl.setRenderTarget(rtA);
          gl.clear(true, true, false);
          gl.render(scenes[l], camera);
          let src = rtA;
          const r = coc / s;
          if (r > 0.5) {
            gather.uniforms.tSrc.value = rtA.texture;
            (gather.uniforms.uTexel.value as THREE.Vector2).set(1 / rtA.width, 1 / rtA.height);
            gather.uniforms.uR.value = r;
            pass.render(gl, gather, rtB);
            src = rtB;
          }
          // only gears in front of the focus plane get the compensation (huge soft glows);
          // behind it they are left to dissolve into the haze
          addUp.uniforms.uGain.value =
            d < dF ? Math.min(DEFOCUS_COMP_MAX, Math.pow(1 + coc / linePx, DEFOCUS_COMP)) : 1;
          addUp.uniforms.tSrc.value = src.texture;
          (addUp.uniforms.uSize.value as THREE.Vector2).set(src.width, src.height);
          pass.render(gl, addUp, accum, false);
        }
        hazeOffset.set(cs.x * 0.06, cs.y * 0.06);
        post.render(gl, accum.texture, frame, hazeOffset);
      },
      dispose() {
        disposables.forEach((d) => d.dispose());
        pool.forEach(([a, b]) => {
          a.dispose();
          b.dispose();
        });
        accum.dispose();
        gather.dispose();
        addUp.dispose();
        post.dispose();
      },
    };
  };

export const NeonGears: React.FC<{ row: GearRow }> = ({ row }) => {
  const factory = useMemo(() => makeRenderer(row), [row]);
  return <GLStage factory={factory} />;
};

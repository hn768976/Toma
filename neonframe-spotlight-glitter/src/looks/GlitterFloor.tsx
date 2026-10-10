import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvas } from "@remotion/three";
import { useThree, useFrame } from "@react-three/fiber";
import { useCurrentFrame, useVideoConfig } from "remotion";
import {
  GLSL_GRAIN,
  loopFrame,
  LOOP_FRAMES,
  mulberry32,
  useBackingScale,
} from "../common";
import type { GlitterColorway } from "../colorways";

/* ------------------------------------------------------------------ *
 * World / camera (metres)
 * ------------------------------------------------------------------ */
const FLOOR_POINTS = 600_000;
const FLOAT_POINTS = 8_000;
const FLOOR_DEPTH = 40;
const FLOOR_WIDTH = 30;
const Z_NEAR = 0.45;
const CAM_HEIGHT = 0.15;
const FOV = 40; // vertical
const HORIZON_FROM_TOP = 0.62; // far end of the floor sits 62% down the frame
const PITCH = Math.atan(
  (1 - 2 * HORIZON_FROM_TOP) * -1 * Math.tan((FOV / 2) * (Math.PI / 180)),
); // camera looks slightly up so the horizon lands at HORIZON_FROM_TOP
const HALF_TAN_H = Math.tan((FOV / 2) * (Math.PI / 180)) * (16 / 9);
const FOCUS = 1.5;

/* ------------------------------------------------------------------ *
 * Seeded glitter field (module level, never Math.random)
 * ------------------------------------------------------------------ */
type Field = { position: Float32Array; seed: Float32Array; kind: Float32Array };

const buildFloor = (): Field => {
  const rnd = mulberry32(0x61177e12);
  const position = new Float32Array(FLOOR_POINTS * 3);
  const seed = new Float32Array(FLOOR_POINTS * 4);
  const kind = new Float32Array(FLOOR_POINTS);
  for (let i = 0; i < FLOOR_POINTS; i++) {
    // depth: roughly equal counts per metre (area density ~ 1/z), so the near field is
    // sparse in points but they are big and blurred; the far field is a fine haze
    const z = Z_NEAR + (FLOOR_DEPTH - Z_NEAR) * Math.pow(rnd(), 1.3);
    // lateral: inside the view frustum (plus margin) and inside the 30 m floor
    const half = Math.min(FLOOR_WIDTH / 2, HALF_TAN_H * z * 1.2 + 0.35);
    const x = (rnd() * 2 - 1) * half;
    // height falloff: dense on the plane, thinning upward
    let h: number;
    if (rnd() < 0.996) h = -Math.log(1 - rnd() * 0.999) * (0.006 + 0.020 * z);
    else h = -Math.log(1 - rnd() * 0.999) * (0.04 + 0.015 * Math.min(z, 6));
    position[i * 3] = x;
    position[i * 3 + 1] = h;
    position[i * 3 + 2] = -z;
    seed[i * 4] = rnd(); // size
    seed[i * 4 + 1] = rnd(); // twinkle phase
    seed[i * 4 + 2] = rnd(); // twinkle cycles / accent pick
    seed[i * 4 + 3] = rnd(); // colour
    kind[i] = rnd() < 0.02 ? 1 : 0; // 2 % can show a four-point glint
  }
  return { position, seed, kind };
};

const buildFloaters = (): Field => {
  const rnd = mulberry32(0xf10a7e55);
  const position = new Float32Array(FLOAT_POINTS * 3);
  const seed = new Float32Array(FLOAT_POINTS * 4);
  const kind = new Float32Array(FLOAT_POINTS);
  for (let i = 0; i < FLOAT_POINTS; i++) {
    const z = 1.4 + 8 * Math.pow(rnd(), 1.2);
    const half = HALF_TAN_H * z * 1.15 + 0.3;
    position[i * 3] = (rnd() * 2 - 1) * half;
    position[i * 3 + 1] = 0.02 + -Math.log(1 - rnd() * 0.999) * 0.09;
    position[i * 3 + 2] = -z;
    seed[i * 4] = rnd();
    seed[i * 4 + 1] = rnd();
    seed[i * 4 + 2] = rnd();
    seed[i * 4 + 3] = rnd();
    kind[i] = 2;
  }
  return { position, seed, kind };
};

let floorField: Field | null = null;
let floatField: Field | null = null;
const getFloor = () => (floorField ??= buildFloor());
const getFloaters = () => (floatField ??= buildFloaters());

/* ------------------------------------------------------------------ *
 * Shaders
 * ------------------------------------------------------------------ */
const quadVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const backdropFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform vec3 uHot, uMid, uOuter, uSides;
uniform float uHorizon;
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUv;
  // radial glow, hottest at the top centre
  vec2 q = (uv - vec2(0.5, 1.02)) * vec2(aspect, 1.0);
  float r = length(q * vec2(0.8, 1.0));
  vec3 col = mix(uHot, uMid, smoothstep(0.0, 0.55, r));
  col = mix(col, uOuter, smoothstep(0.6, 1.9, r));
  // slight vertical gradient
  col *= 0.92 + 0.12 * uv.y;
  // curtain folds: two soft darker vertical bands either side of centre
  float f1 = exp(-pow((uv.x - 0.27) / 0.06, 2.0));
  float f2 = exp(-pow((uv.x - 0.73) / 0.06, 2.0));
  col *= 1.0 - 0.06 * (f1 + f2) * smoothstep(0.1, 0.8, uv.y);
  // darker band just above the bed, then the floor itself
  col *= 1.0 - 0.05 * exp(-pow((uv.y - (uHorizon + 0.08)) / 0.16, 2.0));
  // dark floor below the horizon (the glitter sits on it)
  float floorM = smoothstep(uHorizon + 0.03, uHorizon - 0.22, uv.y);
  col = mix(col, uSides * 1.5, floorM * 0.92);
  // faint haze right at the horizon
  col += uMid * 0.10 * exp(-pow((uv.y - uHorizon) / 0.04, 2.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

const pointVert = /* glsl */ `
precision highp float;
attribute vec4 aSeed;
attribute float aKind;
uniform float uPh;          // loop phase 0..1 (a whole number of cycles per loop)
uniform float uFocalPx;     // focal length in device pixels
uniform float uBlur;        // aperture strength
uniform float uFocus;       // metres
uniform float uMinPx;       // smallest rendered point, device px
uniform float uPxScale;     // device px per 4K px
uniform float uSizeMul;
uniform float uGain;
uniform vec3 uC0, uC1, uC2, uAcc0, uAcc1;
uniform float uAccAmt;
varying vec3 vColor;
varying float vGain;
varying float vSoft;
varying float vGlint;
varying float vSpark;

const float TAU = 6.28318530718;

void main() {
  vec3 pos = position;
  float isFloat = step(1.5, aKind);

  // floating specks: slow closed circles, whole cycles per loop
  if (isFloat > 0.5) {
    float k = 1.0 + floor(aSeed.z * 2.999);
    float a = TAU * (k * uPh + aSeed.y);
    pos.x += 0.10 * sin(a) * (0.5 + aSeed.x);
    pos.y += 0.06 * cos(a + aSeed.w * 6.0) * (0.5 + aSeed.x);
    pos.z += 0.08 * sin(a * 1.0 + aSeed.w * 3.0);
  }

  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float z = max(-mv.z, 0.05);

  // thin the mid / far field (deterministic per grain): sparse above, dense below
  float keep = mix(1.0, 0.012, smoothstep(0.7, 3.2, z));
  if (isFloat < 0.5 && fract(aSeed.x * 91.7 + aSeed.w * 13.1 + aSeed.y * 7.3) > keep) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }

  // physical grain size (metres) -> pixels
  float sw = isFloat > 0.5 ? (0.008 + 0.012 * aSeed.x) : (0.0016 + 0.0042 * aSeed.x * aSeed.x);
  sw *= uSizeMul;
  float basePx = sw * uFocalPx / z;

  // depth of field: near field blurs strongly, far field only a little
  float coc = z < uFocus ? 0.38 * (1.0 / z - 1.0 / uFocus) : 0.55 * (1.0 / uFocus - 1.0 / z);
  float cocPx = uBlur * uFocalPx * coc;
  if (isFloat > 0.5) cocPx += 0.5 * basePx;   // floaters are always soft

  // twinkle: each grain flashes on its own whole-cycle schedule (duty 8 %)
  float cycles = 2.0 + floor(aSeed.z * 6.999);   // 2..8 flashes per grain per loop
  float s = fract(cycles * uPh + aSeed.y);
  float w = 0.08;
  float spark = s < w ? smoothstep(0.0, 0.3 * w, s) * pow(1.0 - s / w, 2.0) : 0.0;
  if (isFloat > 0.5) {
    // floaters shimmer softly rather than flash
    spark = 0.35 * (0.5 + 0.5 * sin(TAU * (cycles * uPh + aSeed.y)));
  }

  float bright = 0.55 + 0.9 * aSeed.w * aSeed.w;
  float size = sqrt(basePx * basePx + cocPx * cocPx);
  size *= 1.0 + 0.35 * spark;
  size = max(size, uMinPx);
  float glint = (aKind > 0.5 && aKind < 1.5) ? spark : 0.0;
  size *= 1.0 + 2.6 * glint;

  // energy: smaller footprint than the rendered disc => dimmer
  float cover = clamp((max(basePx, 0.0) * max(basePx, 0.0) + cocPx * 0.0) / (size * size), 0.0, 1.0);
  float gain = bright * pow(max(cover, 0.002), 0.55);
  gain *= 1.0 + 4.5 * spark;
  gain *= uGain * (isFloat > 0.5 ? 0.45 : 1.0);
  // distance haze: very far points fade a little
  gain *= 1.0 - 0.96 * smoothstep(4.0, 30.0, z);
  gain *= 1.0 + 1.0 * smoothstep(1.4, 0.45, z);

  float cv = aSeed.w;
  vec3 col = cv < 0.5 ? mix(uC0, uC1, cv * 2.0) : mix(uC1, uC2, cv * 2.0 - 1.0);
  col = mix(col, uC0, 0.25 * smoothstep(0.0, 1.0, spark));
  if (fract(aSeed.z * 37.0 + aSeed.x * 11.0) < uAccAmt) {
    col = fract(aSeed.x * 53.0) < 0.5 ? uAcc0 : uAcc1;
  }

  vColor = col;
  vGain = gain;
  vSoft = clamp(cocPx / max(size, 1.0) + 0.15, 0.0, 1.0) + (isFloat > 0.5 ? 0.4 : 0.0);
  vGlint = glint;
  vSpark = spark;
  gl_PointSize = min(size, 900.0);
  gl_Position = projectionMatrix * mv;
}
`;

const pointFrag = /* glsl */ `
precision highp float;
varying vec3 vColor;
varying float vGain;
varying float vSoft;
varying float vGlint;
varying float vSpark;
void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float r = sqrt(r2);
  float sharp = exp(-r2 * 4.5) * (1.0 - r2);
  // blurred points become flat discs with a soft edge (bokeh)
  float bokeh = (1.0 - smoothstep(0.55, 1.0, r)) * (0.8 + 0.2 * smoothstep(0.3, 0.9, r));
  float shape = mix(sharp, bokeh, clamp(vSoft, 0.0, 1.0));
  float star = 0.0;
  if (vGlint > 0.0) {
    vec2 a = abs(p);
    star = (exp(-a.x * 14.0) * exp(-a.y * a.y * 900.0) + exp(-a.y * 14.0) * exp(-a.x * a.x * 900.0)) * vGlint;
  }
  float I = vGain * shape + star * 2.2;
  gl_FragColor = vec4(vColor * I, 1.0);
}
`;

const brightFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tMap;
uniform vec2 uTexel;
uniform float uThreshold;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tMap, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tMap, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture2D(tMap, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture2D(tMap, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;
  gl_FragColor = vec4(max(c - uThreshold, 0.0), 1.0);
}
`;
const downFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tMap;
uniform vec2 uTexel;
void main() {
  vec3 c = vec3(0.0);
  c += texture2D(tMap, vUv + uTexel * vec2(-1.0, -1.0)).rgb;
  c += texture2D(tMap, vUv + uTexel * vec2( 1.0, -1.0)).rgb;
  c += texture2D(tMap, vUv + uTexel * vec2(-1.0,  1.0)).rgb;
  c += texture2D(tMap, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  gl_FragColor = vec4(c * 0.25, 1.0);
}
`;
const blurFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tMap;
uniform vec2 uDir; // texel step
void main() {
  vec3 c = texture2D(tMap, vUv).rgb * 0.2270270270;
  c += (texture2D(tMap, vUv + uDir * 1.3846153846).rgb + texture2D(tMap, vUv - uDir * 1.3846153846).rgb) * 0.3162162162;
  c += (texture2D(tMap, vUv + uDir * 3.2307692308).rgb + texture2D(tMap, vUv - uDir * 3.2307692308).rgb) * 0.0702702703;
  gl_FragColor = vec4(c, 1.0);
}
`;
const compositeFrag = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tBloomA;
uniform sampler2D tBloomB;
uniform vec2 uRes;
uniform float uLoopFrame;
uniform float uGrain;
uniform float uBloom;
uniform vec3 uSides;
${GLSL_GRAIN}

// soft per-channel shoulder: highlights roll off towards pale yellow, not lemon
vec3 shoulder(vec3 x) {
  vec3 hi = max(x - 0.9, 0.0);
  vec3 c = min(x, vec3(0.9)) + 0.1 * (1.0 - exp(-hi / 0.1));
  float m = max(x.r, max(x.g, x.b));
  return mix(c, vec3(1.0, 0.93, 0.66), 0.14 * smoothstep(0.9, 1.7, m));
}

void main() {
  vec3 c = texture2D(tScene, vUv).rgb;
  c += (texture2D(tBloomA, vUv).rgb * 0.55 + texture2D(tBloomB, vUv).rgb * 0.45) * uBloom;
  c = shoulder(c);
  // vignette, stronger at the sides
  float dx = abs(vUv.x - 0.5) * 2.0;
  float dy = vUv.y - 0.5;
  float vig = 1.0 - 0.20 * pow(dx, 2.2) - 0.04 * dy * dy * 4.0;
  c *= clamp(vig, 0.0, 1.0);
  c = ditherGrain(c, gl_FragCoord.xy, uLoopFrame, uGrain);
  gl_FragColor = vec4(c, 1.0);
}
`;

/* ------------------------------------------------------------------ *
 * Scene
 * ------------------------------------------------------------------ */
const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const V3 = (hex: string) => new THREE.Vector3(...hexToRgb(hex));

class Pass {
  scene = new THREE.Scene();
  mesh: THREE.Mesh;
  material: THREE.ShaderMaterial;
  constructor(frag: string, uniforms: Record<string, THREE.IUniform>) {
    this.material = new THREE.ShaderMaterial({
      vertexShader: quadVert,
      fragmentShader: frag,
      uniforms,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);
  }
}
const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

const rt = (w: number, h: number, linear = true) =>
  new THREE.WebGLRenderTarget(Math.max(1, w), Math.max(1, h), {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: linear ? THREE.LinearFilter : THREE.NearestFilter,
    magFilter: linear ? THREE.LinearFilter : THREE.NearestFilter,
    depthBuffer: false,
    generateMipmaps: false,
  });

const makePoints = (field: Field, u: Record<string, THREE.IUniform>) => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(field.position, 3));
  g.setAttribute("aSeed", new THREE.BufferAttribute(field.seed, 4));
  g.setAttribute("aKind", new THREE.BufferAttribute(field.kind, 1));
  const m = new THREE.ShaderMaterial({
    vertexShader: pointVert,
    fragmentShader: pointFrag,
    uniforms: u,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const p = new THREE.Points(g, m);
  p.frustumCulled = false;
  return p;
};

const Pipeline: React.FC<{ colorway: GlitterColorway; grain: number }> = ({
  colorway,
  grain,
}) => {
  const frame = useCurrentFrame();
  const { gl, camera } = useThree();
  const lf = loopFrame(frame);

  const state = useMemo(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = FOV;
    cam.near = 0.05;
    cam.far = 120;
    const horizon = 0.5 + 0.5 * (-Math.tan(PITCH) / Math.tan((FOV / 2) * (Math.PI / 180)));

    const pointU: Record<string, THREE.IUniform> = {
      uPh: { value: 0 },
      uFocalPx: { value: 1000 },
      uBlur: { value: 0.0095 },
      uFocus: { value: FOCUS },
      uMinPx: { value: 2 },
      uPxScale: { value: 1 },
      uSizeMul: { value: 1.7 },
      uGain: { value: 0.24 },
      uC0: { value: V3(colorway.glitter[0]) },
      uC1: { value: V3(colorway.glitter[1]) },
      uC2: { value: V3(colorway.glitter[2]) },
      uAcc0: { value: V3(colorway.accents[0] ?? colorway.glitter[0]) },
      uAcc1: { value: V3(colorway.accents[1] ?? colorway.glitter[0]) },
      uAccAmt: { value: colorway.accents.length ? colorway.accentAmount : 0 },
    };
    const scene = new THREE.Scene();
    const backdrop = new Pass(backdropFrag, {
      uRes: { value: new THREE.Vector2(1, 1) },
      uHot: { value: V3(colorway.glowHot) },
      uMid: { value: V3(colorway.glowMid) },
      uOuter: { value: V3(colorway.glowOuter) },
      uSides: { value: V3(colorway.sides) },
      uHorizon: { value: horizon },
    });
    // backdrop rendered first (own scene), then points on top of it, into the same target
    const floorPts = makePoints(getFloor(), pointU);
    const floatPts = makePoints(getFloaters(), pointU);
    scene.add(floorPts, floatPts);

    const mapU = () => ({
      tMap: { value: null as THREE.Texture | null },
      uTexel: { value: new THREE.Vector2() },
    });
    const bright = new Pass(brightFrag, { ...mapU(), uThreshold: { value: 0.95 } });
    const down = new Pass(downFrag, mapU());
    const blur = new Pass(blurFrag, {
      tMap: { value: null as THREE.Texture | null },
      uDir: { value: new THREE.Vector2() },
    });
    const composite = new Pass(compositeFrag, {
      tScene: { value: null as THREE.Texture | null },
      tBloomA: { value: null as THREE.Texture | null },
      tBloomB: { value: null as THREE.Texture | null },
      uRes: { value: new THREE.Vector2(1, 1) },
      uLoopFrame: { value: 0 },
      uGrain: { value: grain },
      uBloom: { value: 0.7 },
      uSides: { value: V3(colorway.sides) },
    });
    return {
      cam, horizon, pointU, scene, backdrop, bright, down, blur, composite,
      targets: null as null | {
        w: number; h: number;
        scene: THREE.WebGLRenderTarget;
        a1: THREE.WebGLRenderTarget; a2: THREE.WebGLRenderTarget;
        b1: THREE.WebGLRenderTarget; b2: THREE.WebGLRenderTarget;
      },
    };
  }, [camera, colorway, grain]);

  // dispose GPU resources on unmount
  useLayoutEffect(
    () => () => {
      state.targets?.scene.dispose();
    },
    [state],
  );

  useFrame(() => {
    const dbs = gl.getDrawingBufferSize(new THREE.Vector2());
    const W = dbs.x;
    const H = dbs.y;
    let t = state.targets;
    if (!t || t.w !== W || t.h !== H) {
      if (t) Object.values(t).forEach((o) => o instanceof THREE.WebGLRenderTarget && o.dispose());
      t = state.targets = {
        w: W, h: H,
        scene: rt(W, H),
        a1: rt(Math.round(W / 4), Math.round(H / 4)),
        a2: rt(Math.round(W / 4), Math.round(H / 4)),
        b1: rt(Math.round(W / 16), Math.round(H / 16)),
        b2: rt(Math.round(W / 16), Math.round(H / 16)),
      };
    }
    const ph = lf / LOOP_FRAMES;
    const TAU = Math.PI * 2;

    // camera: steady, a very slight sway (whole cycle)
    const cam = state.cam;
    cam.aspect = W / H;
    cam.position.set(
      0.025 * Math.sin(TAU * ph),
      CAM_HEIGHT + 0.004 * Math.sin(TAU * 2 * ph + 1.0),
      0,
    );
    cam.rotation.set(PITCH + 0.0015 * Math.sin(TAU * 2 * ph), 0.0012 * Math.sin(TAU * ph + 0.6), 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();

    const focalPx = (H / 2) / Math.tan((FOV / 2) * (Math.PI / 180));
    const pu = state.pointU;
    pu.uPh.value = ph;
    pu.uFocalPx.value = focalPx;
    pu.uPxScale.value = H / 2160;
    pu.uMinPx.value = Math.max(2.0, 4.0 * (H / 2160));

    state.backdrop.material.uniforms.uRes.value.set(W, H);

    gl.autoClear = false;
    // 1. backdrop + points into the HDR target
    gl.setRenderTarget(t.scene);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, false, false);
    gl.render(state.backdrop.scene, orthoCam);
    gl.render(state.scene, cam);

    // 2. bloom: bright-pass to 1/4, blur; 1/16 and blur
    const texel = (r: THREE.WebGLRenderTarget) => new THREE.Vector2(1 / r.width, 1 / r.height);
    // bright-pass + 4x4 box -> a1 (1/4 res)
    {
      const u = state.bright.material.uniforms;
      u.tMap.value = t.scene.texture;
      u.uTexel.value.set(1.5 / W, 1.5 / H).multiplyScalar(1);
      gl.setRenderTarget(t.a1);
      gl.render(state.bright.scene, orthoCam);
    }
    // 1/4 -> 1/16
    {
      const u = state.down.material.uniforms;
      u.tMap.value = t.a1.texture;
      u.uTexel.value.copy(texel(t.a1)).multiplyScalar(1.0);
      gl.setRenderTarget(t.b1);
      gl.render(state.down.scene, orthoCam);
    }
    const blurPass = (src: THREE.WebGLRenderTarget, tmp: THREE.WebGLRenderTarget, spread: number) => {
      const u = state.blur.material.uniforms;
      u.tMap.value = src.texture;
      u.uDir.value.set(spread / src.width, 0);
      gl.setRenderTarget(tmp);
      gl.render(state.blur.scene, orthoCam);
      u.tMap.value = tmp.texture;
      u.uDir.value.set(0, spread / src.height);
      gl.setRenderTarget(src);
      gl.render(state.blur.scene, orthoCam);
    };
    blurPass(t.a1, t.a2, 1.0);
    blurPass(t.a1, t.a2, 1.6);
    blurPass(t.b1, t.b2, 1.0);
    blurPass(t.b1, t.b2, 1.6);

    // 3. composite to the canvas
    const cu = state.composite.material.uniforms;
    cu.tScene.value = t.scene.texture;
    cu.tBloomA.value = t.a1.texture;
    cu.tBloomB.value = t.b1.texture;
    cu.uRes.value.set(W, H);
    cu.uLoopFrame.value = lf;
    gl.setRenderTarget(null);
    gl.render(state.composite.scene, orthoCam);
    gl.autoClear = true;
  }, 1);

  return null;
};

export const GlitterFloor: React.FC<{
  colorway: GlitterColorway;
  grain?: number;
}> = ({ colorway, grain = 0.02 }) => {
  const { width, height } = useVideoConfig();
  const scale = useBackingScale();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={scale}
      flat
      linear
      camera={{ fov: FOV, near: 0.05, far: 120, position: [0, CAM_HEIGHT, 0] }}
      gl={{ antialias: false, preserveDrawingBuffer: true, alpha: false }}
    >
      <Pipeline colorway={colorway} grain={grain} />
    </ThreeCanvas>
  );
};

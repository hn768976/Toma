import * as THREE from "three";
import type { SceneFactory } from "../ThreeStage";
import { FLOWERS, flowerById, flowerWorld, type FlowerDef } from "./flowers";

/* ------------------------------------------------------------------ */
/* Camera rigs                                                          */
/* ------------------------------------------------------------------ */
export type CameraState = {
  position: THREE.Vector3;
  target: THREE.Vector3;
  /** Distance from the camera at which the lens is focused. */
  focus: number;
  roll: number;
};

export type CameraRig = (t: number, duration: number) => CameraState;

/** V1: locked-off camera, focused on the main bloom, exactly like the reference. */
export const staticRig: CameraRig = () => ({
  position: new THREE.Vector3(0, 0, 20),
  target: new THREE.Vector3(0, 0, 0),
  focus: 20,
  roll: 0,
});

const easeInOut = (x: number) => {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
};

/**
 * V2: slow arcing dolly-in with a rack focus. The camera starts wide and low
 * to the right, focused on the large left bloom, then pushes in on an arc
 * toward the main bloom while the focus racks onto it.
 */
export const dollyRackRig: CameraRig = (t, duration) => {
  const p = t / duration;
  const e = easeInOut(p);
  const arc = THREE.MathUtils.degToRad(THREE.MathUtils.lerp(-11, 7, e));
  const dist = THREE.MathUtils.lerp(23.5, 15.2, e);
  const lookAt = new THREE.Vector3(
    THREE.MathUtils.lerp(-1.6, 1.9, e),
    THREE.MathUtils.lerp(-0.5, 0.5, e),
    0,
  );
  const position = new THREE.Vector3(
    lookAt.x + Math.sin(arc) * dist,
    lookAt.y + THREE.MathUtils.lerp(-2.2, 1.4, e),
    Math.cos(arc) * dist,
  );
  // rack focus from the left bloom to the main bloom between 1.6 s and 4.4 s
  const rack = easeInOut((t - 1.6) / 2.8);
  const left = flowerById("left");
  const main = flowerById("main");
  const leftFocus = position.distanceTo(
    new THREE.Vector3(left.x, left.y, left.z),
  );
  const mainFocus = position.distanceTo(
    new THREE.Vector3(main.x, main.y, main.z),
  );
  return {
    position,
    target: lookAt,
    focus: THREE.MathUtils.lerp(leftFocus, mainFocus, rack),
    roll: THREE.MathUtils.degToRad(THREE.MathUtils.lerp(-2.5, 1.5, e)),
  };
};

/* ------------------------------------------------------------------ */
/* Shared GLSL: the parametric pleated spiral funnel                    */
/* ------------------------------------------------------------------ */
const SURF_GLSL = /* glsl */ `
  uniform float uR;
  uniform float uRin;
  uniform float uDepth;
  uniform float uNpl;
  uniform float uTwist;
  uniform float uPleatAmp;
  uniform float uLobes;
  uniform float uLobeAmp;
  uniform float uLobePhase;
  uniform float uRot;
  uniform float uCurl;
  uniform float uPulse;

  float foldAt(float u, float v) {
    float psi = uNpl * (v - uRot - uTwist * pow(max(u, 0.0), 0.8));
    return pow(max(0.5 + 0.5 * cos(psi), 0.0), 0.7);
  }

  vec3 surf(float u, float v) {
    float fold = foldAt(u, v);
    float lobe = 1.0 + uLobeAmp * u * u * sin(uLobes * v + uLobePhase)
               + 0.04 * u * u * sin((uLobes + 3.0) * v - uLobePhase * 1.7);
    float r = uR * (uRin + (1.0 - uRin) * u) * lobe * (1.0 + 0.01 * fold * u);
    float z = -uDepth * pow(1.0 - u, 2.2)
              + uCurl * uR * u * u * u
              + uPleatAmp * uR * (0.12 + 0.88 * u) * fold;
    return vec3(r * cos(v), r * sin(v), z);
  }

  vec3 surfNormal(float u, float v) {
    float eu = 0.002;
    float ev = 0.0008;
    vec3 p = surf(u, v);
    vec3 a = surf(u + eu, v) - surf(u - eu, v);
    vec3 b = surf(u, v + ev) - surf(u, v - ev);
    return normalize(cross(a, b));
  }
`;

const surfaceVertex = /* glsl */ `
  ${SURF_GLSL}
  varying vec3 vNormalV;
  varying vec3 vPosV;
  varying float vU;
  varying float vFold;
  void main() {
    float u = uv.x;
    float v = uv.y * 6.28318530718;
    vec3 p = surf(u, v);
    vec3 n = surfNormal(u, v);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    vPosV = mv.xyz;
    vNormalV = normalize(normalMatrix * n);
    vU = u;
    vFold = foldAt(u, v);
    gl_Position = projectionMatrix * mv;
  }
`;

const surfaceFragment = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uSheen;
  uniform vec3 uLightV;
  uniform float uPulse;
  varying vec3 vNormalV;
  varying vec3 vPosV;
  varying float vU;
  varying float vFold;
  void main() {
    vec3 n = normalize(vNormalV);
    vec3 vd = normalize(-vPosV);
    if (dot(n, vd) < 0.0) n = -n;
    float diff = max(dot(n, uLightV), 0.0);
    vec3 h = normalize(uLightV + vd);
    float spec = pow(max(dot(n, h), 0.0), 28.0);
    float fres = pow(1.0 - max(dot(n, vd), 0.0), 3.0);
    float ao = smoothstep(0.04, 0.68, vU);
    ao *= 0.55 + 0.45 * vFold;
    vec3 col = uBase * (0.28 + 0.95 * diff * uPulse) * ao;
    col += uSheen * (spec * 0.75 * uPulse + fres * 0.22) * ao * (0.35 + 0.65 * vFold);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const dotVertex = /* glsl */ `
  ${SURF_GLSL}
  attribute vec4 aDot;   // u, pleat coordinate, size, brightness
  attribute vec4 aDot2;  // glint phase, glint amp, warm (0/1), unused
  uniform vec2 uRes;
  uniform float uCoc;     // circle of confusion radius in pixels
  uniform float uDotLen;
  uniform float uDotWid;
  uniform float uTime01;  // 0..1 loop phase
  uniform vec3 uLightV;
  varying vec2 vQuad;
  varying vec2 vAB;
  varying float vBright;
  varying float vWarm;
  varying float vAlpha;

  float vAt(float uu) {
    return (aDot.y / uNpl) * 6.28318530718 + uRot + uTwist * pow(max(uu, 0.0), 0.8);
  }

  void main() {
    float u = aDot.x;
    float v = vAt(u);
    vec3 p = surf(u, v);
    vec3 p2 = surf(u + 0.01, vAt(u + 0.01));
    vec3 n = surfNormal(u, v);
    vec4 cv = modelViewMatrix * vec4(p, 1.0);
    vec4 cv2 = modelViewMatrix * vec4(p2, 1.0);
    vec3 nv = normalize(normalMatrix * n);
    vec3 toCam = normalize(-cv.xyz);
    float facing = dot(nv, toCam);
    // lift slightly toward the camera so the dot sits on top of the surface
    cv.xyz += toCam * 0.03 * uR;
    vec4 clip = projectionMatrix * cv;
    vec4 clip2 = projectionMatrix * cv2;
    vec2 sp = clip.xy / clip.w * uRes * 0.5;
    vec2 sp2 = clip2.xy / clip2.w * uRes * 0.5;
    vec2 dir = sp2 - sp;
    dir = length(dir) > 1e-4 ? normalize(dir) : vec2(1.0, 0.0);
    vec2 perp = vec2(-dir.y, dir.x);
    float pxPerWorld = uRes.y * 0.5 * projectionMatrix[1][1] / max(-cv.z, 0.01);
    float f = clamp(facing, 0.0, 1.0);
    float lenPx = aDot.z * uDotLen * uR * pxPerWorld * (0.55 + 0.45 * u);
    float widPx = aDot.z * uDotWid * uR * pxPerWorld * (0.55 + 0.45 * u) * mix(0.35, 1.0, f);
    float a = lenPx * 0.5 + uCoc + 1.0;
    float b = widPx * 0.5 + uCoc + 1.0;
    vec2 offs = dir * position.x * 2.0 * a + perp * position.y * 2.0 * b;
    gl_Position = clip + vec4(offs / (uRes * 0.5) * clip.w, 0.0, 0.0);
    if (facing < 0.02) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vQuad = position.xy * 2.0;
    vAB = vec2(a, b);

    // lighting on the dot bump
    float diff = max(dot(nv, uLightV), 0.0);
    float lit = (0.45 + 0.85 * diff * uPulse) * smoothstep(0.08, 0.6, u);
    float tw = pow(max(0.0, sin(6.28318530718 * (uTime01 * 3.0 + aDot2.x))), 10.0);
    float glint = 1.0 + aDot2.y * tw;
    vBright = aDot.w * lit * glint;
    vWarm = aDot2.z;
    // energy spreading: a defocused dot gets dimmer, but keep bokeh readable
    float sharpArea = (lenPx * 0.5 + 1.0) * (widPx * 0.5 + 1.0);
    float blurArea = a * b;
    vAlpha = clamp(pow(sharpArea / blurArea, 0.55), 0.07, 1.0) * mix(0.6, 1.0, f);
  }
`;

const dotFragment = /* glsl */ `
  uniform vec3 uDot;
  uniform vec3 uWarm;
  uniform float uGain;
  uniform float uCoc;
  varying vec2 vQuad;
  varying vec2 vAB;
  varying float vBright;
  varying float vWarm;
  varying float vAlpha;
  void main() {
    float d = length(vQuad);
    float bokehAmt = smoothstep(2.0, 10.0, uCoc);
    float edge = max(1.4 / min(vAB.x, vAB.y), 0.28 * bokehAmt);
    float m = 1.0 - smoothstep(1.0 - edge, 1.0, d);
    if (m <= 0.0) discard;
    // bokeh discs get a slightly brighter rim, like real lens bokeh
    m *= mix(1.0, 0.85 + 0.2 * smoothstep(0.45, 0.9, d), bokehAmt);
    vec3 c = mix(uDot, uWarm, vWarm) * vBright * uGain;
    float a = m * vAlpha;
    gl_FragColor = vec4(c * a, a * 0.85);
  }
`;

const fsVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const discBlurFragment = /* glsl */ `
  uniform sampler2D tSrc;
  uniform vec2 uTexel;
  uniform float uRadius;
  varying vec2 vUv;
  void main() {
    vec4 acc = vec4(0.0);
    const int N = 72;
    for (int i = 0; i < N; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / float(N));
      float th = fi * 2.39996323;
      vec2 o = vec2(cos(th), sin(th)) * r * uRadius * uTexel;
      acc += texture2D(tSrc, vUv + o);
    }
    gl_FragColor = acc / float(N);
  }
`;

const copyFragment = /* glsl */ `
  uniform sampler2D tSrc;
  varying vec2 vUv;
  void main() { gl_FragColor = texture2D(tSrc, vUv); }
`;

const backgroundFragment = /* glsl */ `
  uniform vec3 uTop;
  uniform vec3 uBottom;
  varying vec2 vUv;
  void main() {
    vec3 c = mix(uBottom, uTop, smoothstep(0.0, 1.0, vUv.y));
    float r = length((vUv - vec2(0.55, 0.5)) * vec2(1.6, 1.0));
    c *= 1.0 - 0.45 * smoothstep(0.2, 1.1, r);
    gl_FragColor = vec4(c, 1.0);
  }
`;

const finalFragment = /* glsl */ `
  uniform sampler2D tSrc;
  uniform float uExposure;
  uniform float uSeed;
  uniform vec2 uRes;
  varying vec2 vUv;
  float hash(vec2 p) {
    p = fract(p * vec2(443.897, 441.423) + uSeed);
    p += dot(p, p.yx + 19.19);
    return fract((p.x + p.y) * p.x);
  }
  vec3 toSRGB(vec3 c) {
    c = clamp(c, 0.0, 1.0);
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  void main() {
    vec3 c = texture2D(tSrc, vUv).rgb * uExposure;
    // soft filmic shoulder that keeps hue
    float peak = max(max(c.r, c.g), c.b);
    float mapped = peak / (1.0 + max(peak - 0.7, 0.0) * 0.9);
    c *= peak > 1e-5 ? mapped / peak : 1.0;
    c = mix(c, vec3(max(max(c.r, c.g), c.b)), smoothstep(0.85, 2.0, peak) * 0.6);
    // vignette
    vec2 q = vUv - 0.5;
    c *= 1.0 - 0.32 * smoothstep(0.25, 0.85, length(q * vec2(1.25, 1.0)));
    vec3 s = toSRGB(c);
    // fine film grain (tiny, deterministic per frame) to avoid banding in the darks
    float g = hash(gl_FragCoord.xy) - 0.5;
    s += g * (1.6 / 255.0);
    gl_FragColor = vec4(s, 1.0);
  }
`;

/* deterministic PRNG */
const mulberry32 = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const linear = (hex: string) => new THREE.Color(hex);

type FlowerRuntime = {
  def: FlowerDef;
  group: THREE.Group;
  surface: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  dots: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  shared: Record<string, THREE.IUniform>;
  surfaceScene: THREE.Scene;
  dotScene: THREE.Scene;
};

/** Builds the (u, v) grid; actual positions are evaluated in the vertex shader. */
const makeParamGrid = (uSeg: number, vSeg: number) => {
  const g = new THREE.BufferGeometry();
  const verts: number[] = [];
  const uvs: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= uSeg; i++) {
    for (let j = 0; j <= vSeg; j++) {
      const u = Math.pow(i / uSeg, 0.85);
      verts.push(0, 0, 0);
      uvs.push(u, j / vSeg);
    }
  }
  const row = vSeg + 1;
  for (let i = 0; i < uSeg; i++) {
    for (let j = 0; j < vSeg; j++) {
      const a = i * row + j;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  // positions are computed on the GPU; give a generous bounding volume
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
  return g;
};

export const createSpiralBloomScene =
  (rig: CameraRig): SceneFactory =>
  (renderer, width, height, fps, durationInFrames) => {
    renderer.autoClear = false;
    renderer.toneMapping = THREE.NoToneMapping;

    const duration = durationInFrames / fps;
    const camera = new THREE.PerspectiveCamera(26, width / height, 0.5, 200);
    const lightV = new THREE.Vector3();
    const lightWorld = new THREE.Vector3(-0.5, -0.4, 0.78).normalize();
    const res = new THREE.Vector2(width, height);
    // shared light pulse: the reference brightens/dims on a 90-frame (3 s) cycle
    const pulse = { value: 1 };

    /* render targets */
    const accum = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      depthBuffer: true,
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
    });
    const makeLayer = (div: number) => ({
      div,
      a: new THREE.WebGLRenderTarget(
        Math.ceil(width / div),
        Math.ceil(height / div),
        {
          type: THREE.HalfFloatType,
          depthBuffer: true,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
        },
      ),
      b: new THREE.WebGLRenderTarget(
        Math.ceil(width / div),
        Math.ceil(height / div),
        {
          type: THREE.HalfFloatType,
          depthBuffer: false,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
        },
      ),
    });
    const layers = [makeLayer(1), makeLayer(2), makeLayer(4)];

    /* fullscreen helpers */
    const fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const fsScene = new THREE.Scene();
    const fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    fsQuad.frustumCulled = false;
    fsScene.add(fsQuad);
    const blurMat = new THREE.ShaderMaterial({
      vertexShader: fsVertex,
      fragmentShader: discBlurFragment,
      uniforms: {
        tSrc: { value: null },
        uTexel: { value: new THREE.Vector2() },
        uRadius: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const compositeMat = new THREE.ShaderMaterial({
      vertexShader: fsVertex,
      fragmentShader: copyFragment,
      uniforms: { tSrc: { value: null } },
      depthTest: false,
      depthWrite: false,
      transparent: true,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    const bgMat = new THREE.ShaderMaterial({
      vertexShader: fsVertex,
      fragmentShader: backgroundFragment,
      uniforms: {
        uTop: { value: linear("#06082a") },
        uBottom: { value: linear("#0a0626") },
      },
      depthTest: false,
      depthWrite: false,
    });
    const finalMat = new THREE.ShaderMaterial({
      vertexShader: fsVertex,
      fragmentShader: finalFragment,
      uniforms: {
        tSrc: { value: accum.texture },
        uExposure: { value: 0.92 },
        uSeed: { value: 0 },
        uRes: { value: res },
      },
      depthTest: false,
      depthWrite: false,
    });
    const drawFs = (
      mat: THREE.Material,
      target: THREE.WebGLRenderTarget | null,
    ) => {
      fsQuad.material = mat;
      renderer.setRenderTarget(target);
      renderer.render(fsScene, fsCam);
    };

    /* flowers */
    const grid = makeParamGrid(110, 1320);
    const quad = new THREE.PlaneGeometry(1, 1);
    const flowers: FlowerRuntime[] = FLOWERS.map((def) => {
      const { x, y, radius: R } = flowerWorld(def);

      const shared: Record<string, THREE.IUniform> = {
        uR: { value: R },
        uRin: { value: 0.0 },
        uDepth: { value: R * def.depth },
        uNpl: { value: def.pleats },
        uTwist: { value: def.twist * def.dir },
        uPleatAmp: { value: def.pleatAmp },
        uLobes: { value: def.lobes },
        uLobeAmp: { value: def.lobeAmp },
        uLobePhase: { value: def.lobePhase },
        uRot: { value: 0 },
        uCurl: { value: 0.12 },
        uLightV: { value: lightV },
        uPulse: pulse,
      };
      const surface = new THREE.Mesh(
        grid,
        new THREE.ShaderMaterial({
          vertexShader: surfaceVertex,
          fragmentShader: surfaceFragment,
          uniforms: {
            ...shared,
            uBase: { value: linear(def.look.base) },
            uSheen: { value: linear(def.look.sheen) },
          },
          side: THREE.DoubleSide,
        }),
      );
      surface.frustumCulled = false;

      // dot instances: pattern repeats every `loopPleats` pleats so the loop is seamless
      const rand = mulberry32(def.seed * 977);
      const motif: number[][] = [];
      for (let k = 0; k < def.loopPleats; k++) {
        const list: number[][] = [];
        const n = def.dotsPerRidge;
        for (let i = 0; i < n; i++) {
          if (rand() < def.dropout) continue;
          const uu = 0.12 + (0.86 * (i + 0.15 + rand() * 0.7)) / n;
          const off = (rand() - 0.5) * 0.36;
          const size = def.dotScale * (0.75 + rand() * 0.5);
          const bright = 0.7 + rand() * 0.6;
          const glintPhase = rand();
          const isWarm = rand() < (def.look.warmShare ?? 0) ? 1 : 0;
          const glintAmp = isWarm ? 3.5 + rand() * 4 : rand() < 0.08 ? 2.5 : 0;
          list.push([uu, off, size, bright, glintPhase, glintAmp, isWarm]);
        }
        motif.push(...list.map((d) => [k, ...d]));
      }
      const inst: number[] = [];
      const inst2: number[] = [];
      for (let p = 0; p < def.pleats; p++) {
        for (const m of motif) {
          if (m[0] !== p % def.loopPleats) continue;
          inst.push(m[1], p + m[2], m[3], m[4]);
          inst2.push(m[5], m[6], m[7], 0);
        }
      }
      const dotGeo = new THREE.InstancedBufferGeometry();
      dotGeo.index = quad.index;
      dotGeo.setAttribute("position", quad.getAttribute("position"));
      dotGeo.setAttribute(
        "aDot",
        new THREE.InstancedBufferAttribute(new Float32Array(inst), 4),
      );
      dotGeo.setAttribute(
        "aDot2",
        new THREE.InstancedBufferAttribute(new Float32Array(inst2), 4),
      );
      dotGeo.instanceCount = inst.length / 4;
      dotGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
      const dots = new THREE.Mesh(
        dotGeo,
        new THREE.ShaderMaterial({
          vertexShader: dotVertex,
          fragmentShader: dotFragment,
          uniforms: {
            ...shared,
            uRes: { value: res },
            uCoc: { value: 0 },
            uDotLen: { value: 0.046 },
            uDotWid: { value: 0.024 },
            uTime01: { value: 0 },
            uDot: { value: linear(def.look.dot) },
            uWarm: { value: linear(def.look.warm ?? def.look.dot) },
            uGain: { value: def.look.dotGain },
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.CustomBlending,
          blendEquation: THREE.AddEquation,
          blendSrc: THREE.OneFactor,
          blendDst: THREE.OneMinusSrcAlphaFactor,
        }),
      );
      dots.frustumCulled = false;

      const group = new THREE.Group();
      group.position.set(x, y, def.z);
      group.rotation.set(def.tiltX, def.tiltY, 0);
      const surfaceScene = new THREE.Scene();
      const dotScene = new THREE.Scene();
      const gS = group.clone(false);
      gS.add(surface);
      surfaceScene.add(gS);
      const gD = group.clone(false);
      gD.add(dots);
      dotScene.add(gD);
      return { def, group, surface, dots, shared, surfaceScene, dotScene };
    });

    const tmp = new THREE.Vector3();
    const camFwd = new THREE.Vector3();

    const render = (frame: number) => {
      const t = frame / fps;
      const loop = frame / durationInFrames; // 0..1, frame 270 == frame 0
      const cam = rig(t, duration);
      camera.position.copy(cam.position);
      camera.up.set(0, 1, 0);
      camera.lookAt(cam.target);
      camera.rotateZ(cam.roll);
      camera.updateMatrixWorld();
      camera.getWorldDirection(camFwd);
      lightV.copy(lightWorld).transformDirection(camera.matrixWorldInverse);
      pulse.value = 1 + 0.09 * Math.sin((Math.PI * 2 * frame) / 90);

      // coc in 4K pixels from a thin-lens model
      const K = 155 * (width / 3840);
      const sorted = flowers
        .map((f) => {
          tmp
            .set(f.group.position.x, f.group.position.y, f.group.position.z)
            .sub(camera.position);
          const d = tmp.dot(camFwd);
          return { f, d, coc: (K * Math.abs(d - cam.focus)) / d };
        })
        .sort((a, b) => b.d - a.d);

      renderer.setRenderTarget(accum);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, true);
      drawFs(bgMat, accum);

      for (const { f, coc } of sorted) {
        const def = f.def;
        const rot =
          def.dir * ((Math.PI * 2 * def.loopPleats) / def.pleats) * loop;
        f.shared.uRot.value = rot;
        f.shared.uLobePhase.value =
          def.lobePhase + 0.12 * Math.sin(Math.PI * 2 * loop + def.seed);
        const dm = f.dots.material.uniforms;
        dm.uTime01.value = loop;
        dm.uCoc.value = coc;

        // Every bloom goes through the layer path. The in-focus bloom gets a
        // tiny (~2.4 px at 4K) lens softening that removes rib aliasing and the
        // hard cut-out rim; defocused blooms get their thin-lens CoC.
        const surfRadius = Math.max(coc * 1.5, 2.4);
        const layer = coc > 14 ? layers[2] : coc > 4 ? layers[1] : layers[0];
        renderer.setRenderTarget(layer.a);
        renderer.setClearColor(0x000000, 0);
        renderer.clear(true, true, true);
        renderer.render(f.surfaceScene, camera);
        blurMat.uniforms.tSrc.value = layer.a.texture;
        blurMat.uniforms.uTexel.value.set(
          1 / layer.a.width,
          1 / layer.a.height,
        );
        // surfaces are smoother than the dots in the reference, so they get a wider kernel
        blurMat.uniforms.uRadius.value = surfRadius / layer.div;
        drawFs(blurMat, layer.b);
        compositeMat.uniforms.tSrc.value = layer.b.texture;
        drawFs(compositeMat, accum);
        // dots (or bokeh discs when defocused) are drawn at full resolution
        renderer.setRenderTarget(accum);
        renderer.clearDepth();
        renderer.render(f.dotScene, camera);
      }

      finalMat.uniforms.uSeed.value = (frame * 0.618034) % 1;
      drawFs(finalMat, null);
    };

    return {
      render,
      dispose: () => {
        accum.dispose();
        for (const l of layers) {
          l.a.dispose();
          l.b.dispose();
        }
        grid.dispose();
        quad.dispose();
        for (const f of flowers) {
          f.dots.geometry.dispose();
          f.surface.material.dispose();
          f.dots.material.dispose();
        }
      },
    };
  };

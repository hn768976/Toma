import * as THREE from "three";
import { PostPipeline } from "../lib/PostPipeline";
import { SceneFactory, clamp01, lerp, mulberry32, smoothstep } from "../lib/ThreeStage";
import { AVATAR_COUNT, AVATAR_GRID, createAvatarAtlas } from "./avatars";

/** 16.000 s reference -> 480 frames @ 30 fps */
export const DURATION_IN_FRAMES = 480;

export type Palette = {
  name: string;
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  floor: THREE.Color;
  line: THREE.Color; // contour neon colour (linear HDR)
  lineHot: THREE.Color; // core tint
  haze: THREE.Color; // dense-distance glow
  dot: THREE.Color; // node sparks on the lines
  pin: THREE.Color; // ring / stem colour
  pinHot: THREE.Color;
  lift: THREE.Vector3;
  saturation: number;
};

const c = (r: number, g: number, b: number) => new THREE.Color().setRGB(r, g, b);

export const PALETTES: Record<"reference" | "aurora", Palette> = {
  // Version 1: matches the reference -- violet contours, amber/orange pins on plum night
  reference: {
    name: "reference",
    skyTop: c(0.02, 0.005, 0.011),
    skyHorizon: c(0.036, 0.01, 0.026),
    floor: c(0.006, 0.0015, 0.01),
    line: c(0.5, 0.06, 1.0),
    lineHot: c(0.75, 0.3, 1.0),
    haze: c(0.3, 0.08, 0.62),
    dot: c(1.0, 0.32, 0.08),
    pin: c(1.0, 0.16, 0.018),
    pinHot: c(1.0, 0.36, 0.09),
    lift: new THREE.Vector3(0.006, 0.0, 0.01),
    saturation: 1.05,
  },
  // Version 2: alternative palette -- emerald/teal contours with magenta-rose pins on deep ocean night
  aurora: {
    name: "aurora",
    skyTop: c(0.002, 0.012, 0.02),
    skyHorizon: c(0.004, 0.03, 0.04),
    floor: c(0.0, 0.006, 0.008),
    line: c(0.02, 0.85, 0.62),
    lineHot: c(0.6, 1.0, 0.92),
    haze: c(0.02, 0.4, 0.38),
    dot: c(1.0, 0.18, 0.55),
    pin: c(1.0, 0.07, 0.42),
    pinHot: c(1.0, 0.35, 0.68),
    lift: new THREE.Vector3(0.0, 0.006, 0.01),
    saturation: 1.05,
  },
};

const FOV = 40;
const FOCUS_APERTURE = 30; // CoC px @1080p per unit relative defocus
const MAX_COC = 64;

// ---------------------------------------------------------------------------
const NOISE_GLSL = /* glsl */ `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash12(i), b = hash12(i + vec2(1.0, 0.0)), c = hash12(i + vec2(0.0, 1.0)), d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float fbm(vec2 p){
  float s = 0.0, a = 0.5;
  mat2 r = mat2(0.8, -0.6, 0.6, 0.8);
  for (int i = 0; i < 4; i++){ s += a * vnoise(p); p = r * p * 2.03 + 11.7; a *= 0.5; }
  return s;
}
`;

const buildGround = (palette: Palette, pxScale: number) => {
  const uniforms = {
    uCamPos: { value: new THREE.Vector3() },
    uFocus: { value: 10 },
    uAperture: { value: FOCUS_APERTURE },
    uMaxCoc: { value: MAX_COC },
    uPxScale: { value: pxScale },
    uTime: { value: 0 },
    uLine: { value: palette.line },
    uLineHot: { value: palette.lineHot },
    uHaze: { value: palette.haze },
    uFloor: { value: palette.floor },
    uDot: { value: palette.dot },
    uSkyHorizon: { value: palette.skyHorizon },
    uReveal: { value: 1 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main(){
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCamPos; uniform float uFocus, uAperture, uMaxCoc, uPxScale, uTime, uReveal;
      uniform vec3 uLine, uLineHot, uHaze, uFloor, uDot, uSkyHorizon;
      varying vec3 vWorld;
      ${NOISE_GLSL}
      float heightField(vec2 p){
        return fbm(p * 0.06) + 0.35 * fbm(p * 0.16 + vec2(5.2, -3.1));
      }
      void main(){
        vec2 p = vWorld.xz;
        float dist = length(vWorld - uCamPos);
        float f = heightField(p) * 32.0;
        float fw = max(fwidth(f), 1e-5);
        float e = abs(fract(f + 0.5) - 0.5);
        float pix = e / fw;                       // distance to the contour in pixels
        float footprint = max(length(fwidth(p)), 1e-5); // world units per pixel
        float corePx = max(0.022 / footprint, 0.85 * uPxScale);
        float coc = min(uAperture * 0.3 * abs(dist - uFocus) / dist, uMaxCoc) * uPxScale;
        float w = corePx + coc * 0.75;
        float energy = corePx / w;
        float core = exp(-pix * pix / (w * w * 0.6)) * energy;
        float glowPx = max(0.12 / footprint, 2.5 * uPxScale) + coc;
        float glow = exp(-pix / glowPx) * 0.2 * energy;
        // sub-pixel contours in the distance: replace by their average coverage
        float avg = clamp(corePx * 1.2 * fw, 0.0, 1.0) * 0.55 + 0.06;
        float far = smoothstep(0.15, 0.5, fw);
        float lineI = mix(core + glow, avg, far);
        vec3 lineCol = mix(uLine, uLineHot, clamp(core * 0.8, 0.0, 1.0) * (1.0 - far));
        vec3 col = uFloor + uLine * 0.012 + lineCol * lineI * 1.6;

        // sparse node sparks sitting on the contours
        vec2 q = p / 1.7;
        vec2 cell = floor(q);
        float sp = 0.0;
        for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++){
          vec2 cc = cell + vec2(float(i), float(j));
          vec2 h = hash22(cc);
          vec2 pt = (cc + h) * 1.7;
          float d = length(p - pt);
          float r = 0.035 + coc * footprint * 0.6;
          float on = step(0.55, hash12(cc + 17.0));
          float tw = 0.6 + 0.4 * sin(uTime * (1.5 + h.x * 3.0) + h.y * 30.0);
          sp += on * tw * exp(-d * d / (r * r)) * (0.035 / max(r, 0.035)) * (0.035 / max(r, 0.035));
        }
        float onLine = exp(-pix * pix / (w * w * 4.0));
        col += uDot * sp * onLine * 6.0 * (1.0 - far);

        // distance haze toward the horizon
        float hz = 1.0 - exp(-max(dist - 12.0, 0.0) / 70.0);
        col = mix(col, uHaze * 0.35 + uSkyHorizon, hz * 0.5);
        col *= uReveal;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(700, 700, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -10;
  return { mesh, uniforms };
};

const buildSky = (palette: Palette) => {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { uTop: { value: palette.skyTop }, uHor: { value: palette.skyHorizon }, uHaze: { value: palette.haze } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `
      uniform vec3 uTop, uHor, uHaze; varying vec3 vDir;
      void main(){
        float y = vDir.y;
        vec3 col = mix(uHor, uTop, smoothstep(0.0, 0.5, y));
        col += uHaze * 0.09 * exp(-max(y, 0.0) * 30.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 16), mat);
  mesh.renderOrder = -20;
  mesh.frustumCulled = false;
  return mesh;
};

// ---------------------------------------------------------------------------
type Pin = { x: number; z: number; H: number; R: number; tA: number; avatar: number; seed: number };

const makePins = (): Pin[] => {
  const rnd = mulberry32(8080);
  const pins: Pin[] = [];
  while (pins.length < 950) {
    const z = rnd() < 0.62 ? -3 - rnd() * 45 : -48 - Math.pow(rnd(), 0.9) * 70;
    const spread = 5 + (-z) * 0.5;
    const x = (rnd() * 2 - 1) * Math.min(spread, 40);
    // keep the camera corridor clear near the path
    if (Math.abs(x) < 0.9 && z > -45) continue;
    const u = clamp01((z + 105) / 100); // 0 far .. 1 near
    const tA = (z < -48 ? 1.6 + rnd() * 4.5 : 1.3 + rnd() * 3.2) + u * u * 2.5;
    pins.push({
      x,
      z,
      H: 0.22 + Math.pow(rnd(), 1.6) * 0.85,
      R: 0.16 + rnd() * 0.1,
      tA,
      avatar: Math.floor(rnd() * AVATAR_COUNT),
      seed: rnd(),
    });
  }
  return pins;
};

const easeOutBack = (t: number) => {
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

const buildPins = (palette: Palette, atlas: THREE.Texture, avgColors: THREE.Color[], pxScale: number) => {
  const pins = makePins();
  const N = pins.length;

  // ---- badges (sorted, premultiplied alpha) ----
  const quad = new THREE.PlaneGeometry(2, 2);
  const bGeo = new THREE.InstancedBufferGeometry();
  bGeo.index = quad.index;
  bGeo.setAttribute("position", quad.getAttribute("position"));
  const aCenter = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const aRadius = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  const aAvatar = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  const aFade = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  const aAvg = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  for (const a of [aCenter, aRadius, aAvatar, aFade, aAvg]) a.setUsage(THREE.DynamicDrawUsage);
  bGeo.setAttribute("aCenter", aCenter);
  bGeo.setAttribute("aRadius", aRadius);
  bGeo.setAttribute("aAvatar", aAvatar);
  bGeo.setAttribute("aFade", aFade);
  bGeo.setAttribute("aAvg", aAvg);
  bGeo.instanceCount = 0;

  const dofUniforms = {
    uFocus: { value: 10 },
    uAperture: { value: FOCUS_APERTURE },
    uMaxCoc: { value: MAX_COC },
    uWorldPerPx: { value: 1 }, // world units per 1080p-pixel at distance 1
    uPxScale: { value: pxScale },
  };
  const badgeMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      ...dofUniforms,
      uAtlas: { value: atlas },
      uPin: { value: palette.pin },
      uPinHot: { value: palette.pinHot },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aCenter; attribute float aRadius; attribute float aAvatar; attribute float aFade; attribute vec3 aAvg;
      uniform float uFocus, uAperture, uMaxCoc, uWorldPerPx;
      varying vec2 vLocal; varying float vR; varying float vB; varying float vAvatar; varying float vFade; varying vec3 vAvg; varying float vPx; varying float vHalf;
      void main(){
        vec4 mvC = viewMatrix * vec4(aCenter, 1.0);
        float d = max(-mvC.z, 0.05);
        float cocPx = min(uAperture * abs(d - uFocus) / d, uMaxCoc);
        float px = uWorldPerPx * d;            // world size of one 1080p pixel here
        float b = max(cocPx * px, 0.6 * px);   // blur radius in world units (min ~AA)
        float h = aRadius * 1.9 + b * 1.4;
        vec2 corner = position.xy * h;
        vec4 mv = mvC + vec4(corner, 0.0, 0.0);
        gl_Position = projectionMatrix * mv;
        vLocal = corner; vHalf = h; vR = aRadius; vB = b; vAvatar = aAvatar; vFade = aFade; vAvg = aAvg; vPx = px;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uAtlas; uniform vec3 uPin, uPinHot;
      varying vec2 vLocal; varying float vR; varying float vB; varying float vAvatar; varying float vFade; varying vec3 vAvg; varying float vPx; varying float vHalf;
      void main(){
        float r = length(vLocal);
        float R = vR, b = vB;
        float inner = R * 0.76;
        // coverage of the badge disc blurred by a disc kernel of radius b
        float disc = clamp((R + b - r) / (2.0 * b), 0.0, 1.0);
        disc = disc * disc * (3.0 - 2.0 * disc);
        float ring = clamp((r - (inner - b)) / (2.0 * b), 0.0, 1.0);
        ring = ring * ring * (3.0 - 2.0 * ring);
        // avatar lookup with blur via mip bias
        float cellIdx = vAvatar;
        vec2 cellXY = vec2(mod(cellIdx, ${AVATAR_GRID.toFixed(1)}), floor(cellIdx / ${AVATAR_GRID.toFixed(1)}));
        vec2 auv = clamp(vLocal / (inner * 2.0) * vec2(1.0, -1.0) + 0.5, 0.02, 0.98);
        vec2 uv = (cellXY + auv) / ${AVATAR_GRID.toFixed(1)};
        uv.y = 1.0 - uv.y;
        float texelsPerWorld = 256.0 / (inner * 2.0);
        float lod = log2(max(b * texelsPerWorld, 1.0));
        vec3 av = texture2D(uAtlas, uv, lod).rgb;
        float heavy = smoothstep(0.4, 1.2, b / inner);
        av = mix(av, vAvg, heavy);
        vec3 ringCol = mix(uPin, uPinHot, 0.2) * 1.3;
        vec3 inside = mix(av, vec3(1.0, 0.62, 0.42), 0.18) * 0.78 + uPin * 0.08;
        vec3 col = mix(inside, ringCol, ring);
        // heavy defocus reads as a glowing orange disc with a faint face
        col = mix(col, mix(ringCol, av, 0.2) * 0.9, heavy * 0.75);
        float energy = mix(1.0, (R * R) / ((R + b * 0.5) * (R + b * 0.5)), 0.55);
        col *= energy;
        float a = disc * vFade;
        // soft outer glow (additive, alpha 0)
        float halo = exp(-max(r - R, 0.0) / (R * 0.35 + b)) * (1.0 - disc) * 0.12 * vFade * energy;
        halo *= 1.0 - smoothstep(0.6 * vHalf, 0.98 * vHalf, r);
        gl_FragColor = vec4(col * a + uPin * halo, a);
      }`,
  });
  const badges = new THREE.Mesh(bGeo, badgeMat);
  badges.frustumCulled = false;
  badges.renderOrder = 10;

  // ---- stems + their floor reflections (additive, order independent) ----
  const sQuad = new THREE.PlaneGeometry(2, 1);
  sQuad.translate(0, 0.5, 0);
  const sGeo = new THREE.InstancedBufferGeometry();
  sGeo.index = sQuad.index;
  sGeo.setAttribute("position", sQuad.getAttribute("position"));
  const sBase = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3);
  const sHeight = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  const sFade = new THREE.InstancedBufferAttribute(new Float32Array(N), 1);
  for (const a of [sBase, sHeight, sFade]) a.setUsage(THREE.DynamicDrawUsage);
  sGeo.setAttribute("aBase", sBase);
  sGeo.setAttribute("aHeight", sHeight);
  sGeo.setAttribute("aFade", sFade);
  sGeo.instanceCount = 0;
  const makeStemMat = (reflection: boolean) =>
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { ...dofUniforms, uPin: { value: palette.pin }, uCamRight: { value: new THREE.Vector3(1, 0, 0) } },
      vertexShader: /* glsl */ `
        attribute vec3 aBase; attribute float aHeight; attribute float aFade;
        uniform float uFocus, uAperture, uMaxCoc, uWorldPerPx; uniform vec3 uCamRight;
        varying float vT; varying float vAcross; varying float vEnergy; varying float vFade; varying float vH;
        void main(){
          float t = position.y;
          float yy = ${reflection ? "-t * aHeight * 0.75" : "t * aHeight"};
          vec3 wp = aBase + vec3(0.0, yy, 0.0);
          vec4 mv = viewMatrix * vec4(wp, 1.0);
          float d = max(-mv.z, 0.05);
          float cocPx = min(uAperture * abs(d - uFocus) / d, uMaxCoc);
          float px = uWorldPerPx * d;
          float w0 = max(0.011, 0.8 * px);
          float w = w0 + cocPx * px * 0.8;
          wp += normalize(vec3(uCamRight.x, 0.0, uCamRight.z)) * position.x * w * 2.2;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
          vT = t; vAcross = position.x * 2.2; vEnergy = w0 / w; vFade = aFade; vH = aHeight;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uPin;
        varying float vT; varying float vAcross; varying float vEnergy; varying float vFade; varying float vH;
        void main(){
          float prof = exp(-vAcross * vAcross * 2.2);
          float glow = exp(-abs(vAcross) * 1.2) * 0.25;
          float i = (prof + glow) * vEnergy * vFade;
          ${
            reflection
              ? "i *= 0.42 * pow(1.0 - vT, 2.2);"
              : "i *= 0.75 + 0.5 * smoothstep(0.6, 1.0, vT); i += vEnergy * vFade * exp(-vT * vH * 14.0) * prof * 2.0;"
          }
          gl_FragColor = vec4(uPin * i * 0.9, 1.0);
        }`,
    });
  const stemMat = makeStemMat(false);
  const reflMat = makeStemMat(true);
  const stems = new THREE.Mesh(sGeo, stemMat);
  const refl = new THREE.Mesh(sGeo, reflMat);
  stems.frustumCulled = false;
  refl.frustumCulled = false;
  stems.renderOrder = 5;
  refl.renderOrder = 4;

  const order: { i: number; d: number; along: number }[] = [];
  const update = (t: number, camera: THREE.PerspectiveCamera, focus: number, worldPerPx: number) => {
    for (const m of [badgeMat, stemMat, reflMat]) {
      m.uniforms.uFocus.value = focus;
      m.uniforms.uWorldPerPx.value = worldPerPx;
    }
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    stemMat.uniforms.uCamRight.value.copy(right);
    reflMat.uniforms.uCamRight.value.copy(right);
    const growAll = 1 + 0.9 * smoothstep(7, 16, t);
    order.length = 0;
    const camPos = camera.position;
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    for (let i = 0; i < N; i++) {
      const p = pins[i];
      const k = (t - p.tA) / 1.25;
      if (k <= 0) continue;
      const dx = p.x - camPos.x;
      const dz = p.z - camPos.z;
      const along = dx * fwd.x + dz * fwd.z;
      if (along < 0.5) continue; // behind / right at the camera
      order.push({ i, d: dx * dx + dz * dz, along });
    }
    order.sort((a, b) => b.d - a.d);
    let n = 0;
    for (const { i, along } of order) {
      const p = pins[i];
      const k = clamp01((t - p.tA) / 1.25);
      const grow = easeOutBack(k);
      const h = p.H * growAll * grow + 0.02;
      const pop = 0.28 + 0.72 * smoothstep(0, 1, (t - p.tA - 0.5) / 2.4);
      const fade = smoothstep(0, 0.25, k) * smoothstep(0.5, 2.2, along);
      const R = p.R * Math.max(pop, 0);
      aCenter.setXYZ(n, p.x, h + R * 0.98, p.z);
      aRadius.setX(n, Math.max(R, 0.001));
      aAvatar.setX(n, p.avatar);
      aFade.setX(n, fade);
      const avg = avgColors[p.avatar];
      aAvg.setXYZ(n, avg.r, avg.g, avg.b);
      sBase.setXYZ(n, p.x, 0, p.z);
      sHeight.setX(n, h);
      sFade.setX(n, fade);
      n++;
    }
    bGeo.instanceCount = n;
    sGeo.instanceCount = n;
    for (const a of [aCenter, aRadius, aAvatar, aFade, aAvg, sBase, sHeight, sFade]) a.needsUpdate = true;
  };

  return { badges, stems, refl, update };
};

// ---------------------------------------------------------------------------
export type CameraStyle = "dolly";

export const createTopoScene =
  (palette: Palette): SceneFactory =>
  (renderer, width, height) => {
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    const pxScale = height / 1080;
    const scene = new THREE.Scene();
    scene.background = palette.skyTop.clone();

    const sky = buildSky(palette);
    scene.add(sky);
    const ground = buildGround(palette, pxScale);
    scene.add(ground.mesh);
    const atlas = createAvatarAtlas();
    const pins = buildPins(palette, atlas.texture, atlas.averages, pxScale);
    scene.add(pins.refl, pins.stems, pins.badges);

    const camera = new THREE.PerspectiveCamera(FOV, width / height, 0.05, 1200);
    const post = new PostPipeline(renderer, width, height, { dof: false });

    const render = (frame: number) => {
      const t = frame / 30;
      const u = frame / (DURATION_IN_FRAMES - 1);
      // steady forward glide, slightly descending, with a gentle drift
      const z = -(12 * u + 26 * u * u);
      const y = lerp(1.42, 1.22, u);
      const x = 0.35 * Math.sin(u * Math.PI * 0.9);
      camera.position.set(x, y, z);
      const pitch = (-4.2 + 0.6 * u) * (Math.PI / 180);
      const yaw = 0.04 * Math.sin(u * Math.PI * 1.1 + 0.4);
      const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch));
      camera.lookAt(camera.position.clone().add(dir));
      camera.updateMatrixWorld();
      sky.position.copy(camera.position);

      const focus = lerp(7.5, 6, u);
      const worldPerPx = (2 * Math.tan((FOV * Math.PI) / 360)) / 1080;
      ground.uniforms.uCamPos.value.copy(camera.position);
      ground.uniforms.uFocus.value = focus;
      ground.uniforms.uTime.value = t;
      ground.uniforms.uReveal.value = 1;
      pins.update(t, camera, focus, worldPerPx);

      post.render(scene, camera, {
        focusDistance: focus,
        aperture: 0,
        maxCoc: 0,
        bloomStrength: 0.45,
        bloomRadius: 0.5,
        bloomThreshold: 0.8,
        exposure: 1.0,
        vignette: 0.45,
        saturation: palette.saturation,
        lift: palette.lift,
        grain: 0.012,
        frame,
      });
    };

    return {
      render,
      dispose: () => {
        post.dispose();
        atlas.texture.dispose();
      },
    };
  };

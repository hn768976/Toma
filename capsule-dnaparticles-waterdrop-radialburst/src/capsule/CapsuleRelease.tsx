import React, { useCallback } from 'react';
import { AbsoluteFill } from 'remotion';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CapsuleRow } from '../data';
import { ThreeStage, FullscreenPass, GaussianBlur, makeTarget, DISPLAY_GLSL, blueNoiseTexture } from '../lib/ThreeStage';
import { BLUE_NOISE, BLUE_NOISE_SIZE } from '../lib/blueNoise';
import { FINISH_GLSL } from '../lib/finish';
import { gauss, mulberry32 } from '../lib/random';

// ---------------- dimensions (world units) ----------------
// Real capsule proportions: overall length 2.8 : diameter ~1.0.
export const CAP = {
  bodyR: 0.5,
  capR: 0.514, // the cap is slightly wider and slides over the body
  wall: 0.012,
  bodyLen: 1.6, // dome tip to open rim
  capLen: 1.5,
  overlap: 0.3,
  powder: 20000,
  bgCapsules: 12,
  fovY: 30,
  camZ: 6.2,
};

const FPS = 30;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const easeInOut = (x: number) => {
  const t = clamp01(x);
  return t * t * t * (t * (t * 6 - 15) + 10);
};

// Half shell along +y: closed dome at y = 0, open rim at y = len.
const halfShellGeometry = (R: number, len: number, wall: number) => {
  const pts: THREE.Vector2[] = [];
  const domeSeg = 28;
  // outer dome from the pole to the equator
  for (let i = 0; i <= domeSeg; i++) {
    const a = (i / domeSeg) * (Math.PI / 2);
    pts.push(new THREE.Vector2(Math.max(1e-4, R * Math.sin(a)), R - R * Math.cos(a)));
  }
  const cylSeg = 10;
  for (let i = 1; i <= cylSeg; i++) pts.push(new THREE.Vector2(R, R + ((len - R) * i) / cylSeg));
  // rim
  pts.push(new THREE.Vector2(R - wall * 0.5, len + wall * 0.15));
  pts.push(new THREE.Vector2(R - wall, len));
  const ri = R - wall;
  for (let i = 1; i <= cylSeg; i++) pts.push(new THREE.Vector2(ri, len - ((len - R) * i) / cylSeg));
  for (let i = 1; i <= domeSeg; i++) {
    const a = (Math.PI / 2) * (1 - i / domeSeg);
    pts.push(new THREE.Vector2(Math.max(1e-4, ri * Math.sin(a)), R - ri * Math.cos(a)));
  }
  return new THREE.LatheGeometry(pts, 96);
};

// --------- the capsule's motion: closed form functions of time ---------
// Returns the transforms of the whole capsule group and of both halves.
export const capsulePose = (t: number) => {
  const split = easeInOut((t - 2.5) / 1.5);
  const float = Math.sin((t / 12) * Math.PI * 2) * 0.04;
  const group = {
    pos: new THREE.Vector3(-0.02, 0.05 + float - 0.12 * split, 0),
    rot: new THREE.Euler(
      0.1 - 0.04 * Math.sin(t * 0.35),
      0.12 - t * 0.034,
      0.03 * Math.sin(t * 0.5),
      'YXZ',
    ),
  };
  // halves separate along the axis and tilt so their open ends rise
  const sep = 0.9 * split + 0.012 * Math.max(0, t - 4);
  // asymmetric: the cap half tips up more than the body half
  const drift = 0.004 * Math.max(0, t - 4);
  const capTilt = 0.29 * split + drift;
  const bodyTilt = 0.13 * split + drift;
  return { group, split, sep, capTilt, bodyTilt };
};

type Powder = { p0: Float32Array; v0: Float32Array; prm: Float32Array; drift: Float32Array };

const buildPowder = (): Powder => {
  const n = CAP.powder;
  const rand = mulberry32(0xca951e);
  const p0 = new Float32Array(n * 3);
  const v0 = new Float32Array(n * 3);
  const prm = new Float32Array(n * 4);
  const drift = new Float32Array(n * 4);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    // emission time: most of it pours out right after the split
    const te = 3.45 + 5.0 * Math.pow(rand(), 1.6);
    const pose = capsulePose(te);
    // emission point in group space: inside the gap, within the capsule radius
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * 0.42;
    v.set((rand() - 0.5) * 0.16, Math.sin(a) * r, Math.cos(a) * r);
    q.setFromEuler(pose.group.rot);
    m.compose(pose.group.pos, q, new THREE.Vector3(1, 1, 1));
    v.applyMatrix4(m);
    p0.set([v.x, v.y, v.z], i * 3);
    // initial velocity: a burst out of the gap, mostly up, some down and sideways
    // a narrow fountain: mostly straight up out of the gap, a trickle falls below
    const up = rand() < 0.72 ? 1 : -0.55;
    const sp = 0.25 + 1.25 * Math.pow(rand(), 1.6);
    const dir = new THREE.Vector3(gauss(rand) * 0.13, up * (0.8 + rand() * 0.4), gauss(rand) * 0.13).normalize();
    v0.set([dir.x * sp, dir.y * sp, dir.z * sp], i * 3);
    const big = rand() < 0.035;
    const size = big ? 0.015 + rand() * 0.012 : 0.004 + rand() * 0.004;
    prm.set([te, 1.4 + rand() * 1.4, size, rand()], i * 4);
    drift.set([gauss(rand) * 0.03, (up > 0 ? 0.03 : -0.02) + rand() * 0.04, gauss(rand) * 0.03, rand()], i * 4);
  }
  return { p0, v0, prm, drift };
};

const POWDER = buildPowder();

const POWDER_VERT = /* glsl */ `
attribute vec3 aP0;
attribute vec3 aV0;
attribute vec4 aPrm;   // emit time, drag, size, shade
attribute vec4 aDrift; // slow drift velocity xyz, phase
uniform float uTime;
uniform float uScale;  // pixels per world unit at depth 1
uniform float uFocus;
uniform float uAperture; // pixels of blur per unit of |1/d - 1/focus|
varying float vAlpha;
varying float vShade;
varying float vEdge;
void main() {
  float tau = uTime - aPrm.x;
  float k = aPrm.y;
  float tt = max(tau, 0.0);
  vec3 p = aP0 + aV0 * (1.0 - exp(-k * tt)) / k + aDrift.xyz * tt
         + 0.03 * vec3(sin(tt * 0.9 + aDrift.w * 6.28), sin(tt * 0.7 + aDrift.w * 9.1), cos(tt * 0.8 + aDrift.w * 4.0)) * min(tt, 1.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  float s = aPrm.z * uScale / d;
  float coc = uAperture * abs(1.0 / d - 1.0 / uFocus);
  float px = sqrt(s * s + coc * coc + 1.0);
  gl_PointSize = px * 2.0;
  vAlpha = mix(0.16, 1.0, step(0.012, aPrm.z)) * step(0.0, tau) * smoothstep(0.0, 0.12, tau) * exp(-tt / 11.0) * min(1.0, (s * s + 0.6) / (px * px));
  vShade = aPrm.w;
  vEdge = clamp(1.5 / px, 0.08, 1.0);
  gl_Position = projectionMatrix * mv;
}
`;

const POWDER_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vAlpha;
varying float vShade;
varying float vEdge;
void main() {
  float rho = length(gl_PointCoord * 2.0 - 1.0);
  float m = clamp((1.0 - rho) / vEdge, 0.0, 1.0);
  if (m <= 0.0 || vAlpha <= 0.002) discard;
  // grains shaded as small spheres lit from above left
  vec2 pc = gl_PointCoord * 2.0 - 1.0;
  vec3 n = vec3(pc.x, -pc.y, sqrt(max(0.0, 1.0 - min(rho * rho, 1.0))));
  float lit = max(dot(n, normalize(vec3(-0.4, 0.75, 0.55))), 0.0);
  float shade = mix(0.62, 0.9, vShade) * (0.45 + 0.6 * lit);
  // grey rim: the grains read as small translucent beads on the pale background
  shade *= mix(1.0, 0.55, smoothstep(0.5, 1.0, rho));
  gl_FragColor = vec4(uColor * shade * vAlpha * m, vAlpha * m * 0.82);
}
`;

const FINAL_FRAG = /* glsl */ `
uniform sampler2D tBg;      // blurred background capsules (premultiplied, linear)
uniform sampler2D tFg;      // capsule + powder (premultiplied, linear)
uniform sampler2D tNoise;   // blue noise
uniform vec3 uBgColor;      // display-space background
uniform vec2 uRes;
uniform float uFrameMod;
varying vec2 vUv;
${DISPLAY_GLSL}
${FINISH_GLSL}
vec3 layer(vec4 c) {
  vec3 lin = c.a > 1e-4 ? c.rgb / c.a : vec3(0.0);
  return linToSrgb(neutralTonemap(lin * 0.86));
}
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 q = (vUv - vec2(0.5, 0.58)) * vec2(aspect, 1.0);
  // soft radial lift in the middle, a touch darker at the edges
  vec3 col = uBgColor * (1.0 + 0.012 * exp(-dot(q, q) * 1.6) - 0.06 * smoothstep(0.5, 1.3, length(q)));
  // fixed blue-noise dither on the flat background (+-0.6/255)
  float bn = texture2D(tNoise, gl_FragCoord.xy / 64.0).r;
  col += (bn - 0.5) * (1.2 / 255.0);
  vec4 bg = texture2D(tBg, vUv);
  col = mix(col, layer(bg), clamp(bg.a, 0.0, 1.0) * 0.6);
  vec4 fg = texture2D(tFg, vUv);
  // a light atmospheric haze keeps the capsule low-contrast against the grey
  col = mix(col, mix(layer(fg), uBgColor, 0.1), clamp(fg.a, 0.0, 1.0));
  col = finishColor(col, gl_FragCoord.xy, uFrameMod, 0.015);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

const srgbColor = (hex: string) => new THREE.Color(hex); // THREE.Color parses hex as sRGB -> linear

const createScene = (row: CapsuleRow) => (renderer: THREE.WebGLRenderer, pw: number, ph: number) => {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;

  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(CAP.fovY, pw / ph, 0.1, 100);
  camera.position.set(0, 0, CAP.camZ);
  camera.lookAt(0, 0, 0);

  // ---- foreground scene ----
  const scene = new THREE.Scene();
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.42;
  const key = new THREE.DirectionalLight(0xffffff, 1.05);
  key.position.set(-1.5, 6, 3.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 14;
  key.shadow.radius = 6;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.01;
  scene.add(key);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc4c8cc, 0.65));

  const mat = (hex: string) =>
    new THREE.MeshPhysicalMaterial({
      color: srgbColor(hex),
      roughness: 0.25,
      clearcoat: 0.35,
      clearcoatRoughness: 0.3,
      metalness: 0,
      envMapIntensity: 1,
    });
  const bodyGeo = halfShellGeometry(CAP.bodyR, CAP.bodyLen, CAP.wall);
  const capGeo = halfShellGeometry(CAP.capR, CAP.capLen, CAP.wall);
  const capMat = mat(row.cap);
  const bodyMat = mat(row.body);

  // seam centre at x = 0: body rim at -overlap/2, cap rim at +overlap/2
  const group = new THREE.Group();
  const bodyPivot = new THREE.Group();
  const capPivot = new THREE.Group();
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  const cap = new THREE.Mesh(capGeo, capMat);
  // lathe axis +y (dome at 0, rim at len) -> body pointing +x, cap pointing -x
  body.rotation.z = Math.PI / 2; // +y -> -x : dome at +x after flip below
  body.position.x = CAP.bodyLen - CAP.overlap / 2;
  cap.rotation.z = -Math.PI / 2;
  cap.position.x = -(CAP.capLen - CAP.overlap / 2);
  for (const m of [body, cap]) {
    m.castShadow = true;
    m.receiveShadow = true;
  }
  // powder visible inside each open half: a recessed, grainy fill at the rim
  const grain = new Uint8Array(128 * 128 * 4);
  const grng = mulberry32(0x96a1);
  for (let i = 0; i < 128 * 128; i++) {
    const v = 125 + Math.floor(grng() * 55);
    grain.set([v, v, v + 2, 255], i * 4);
  }
  const grainTex = new THREE.DataTexture(grain, 128, 128);
  grainTex.colorSpace = THREE.SRGBColorSpace;
  grainTex.needsUpdate = true;
  const fillMat = new THREE.MeshStandardMaterial({ color: 0xc8ccd0, emissive: 0xffffff, emissiveIntensity: 0.6, emissiveMap: grainTex, roughness: 1, map: grainTex });
  const addFill = (shell: THREE.Mesh, R: number, len: number) => {
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R - CAP.wall * 1.2, 48), fillMat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = len - 0.05;
    disc.receiveShadow = true;
    shell.add(disc);
  };
  addFill(body, CAP.bodyR, CAP.bodyLen);
  addFill(cap, CAP.capR, CAP.capLen);
  bodyPivot.add(body);
  capPivot.add(cap);
  group.add(bodyPivot, capPivot);
  scene.add(group);

  // powder
  const pg = new THREE.BufferGeometry();
  pg.setAttribute('position', new THREE.BufferAttribute(POWDER.p0, 3));
  pg.setAttribute('aP0', new THREE.BufferAttribute(POWDER.p0, 3));
  pg.setAttribute('aV0', new THREE.BufferAttribute(POWDER.v0, 3));
  pg.setAttribute('aPrm', new THREE.BufferAttribute(POWDER.prm, 4));
  pg.setAttribute('aDrift', new THREE.BufferAttribute(POWDER.drift, 4));
  const focal = ph / (2 * Math.tan(((CAP.fovY / 2) * Math.PI) / 180));
  const powderMat = new THREE.ShaderMaterial({
    vertexShader: POWDER_VERT,
    fragmentShader: POWDER_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uScale: { value: focal },
      uFocus: { value: CAP.camZ },
      uAperture: { value: (ph / 2160) * 180 },
      uColor: { value: srgbColor(row.powder) },
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.OneFactor,
    blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
  });
  const powder = new THREE.Points(pg, powderMat);
  powder.frustumCulled = false;
  scene.add(powder);

  // ---- background capsules (rendered at half resolution, then blurred) ----
  const bgScene = new THREE.Scene();
  bgScene.environment = envRT.texture;
  bgScene.environmentIntensity = 0.8;
  bgScene.add(new THREE.HemisphereLight(0xffffff, 0xc0c4c8, 0.6));
  const bgKey = new THREE.DirectionalLight(0xffffff, 1.0);
  bgKey.position.set(-1.5, 6, 3.5);
  bgScene.add(bgKey);
  const bgMat = mat('#C8CCCF');
  const rand = mulberry32(0xbac6);
  const bgCaps: { obj: THREE.Group; base: THREE.Vector3; amp: THREE.Vector3; rot0: THREE.Euler; spin: THREE.Vector3; ph: number; n: number }[] = [];
  for (let i = 0; i < CAP.bgCapsules; i++) {
    const g = new THREE.Group();
    const b = new THREE.Mesh(bodyGeo, bgMat);
    b.rotation.z = Math.PI / 2;
    b.position.x = CAP.bodyLen - CAP.overlap / 2;
    const c = new THREE.Mesh(capGeo, bgMat);
    c.rotation.z = -Math.PI / 2;
    c.position.x = -(CAP.capLen - CAP.overlap / 2);
    g.add(b, c);
    const z = -8 - rand() * 8;
    const h = Math.tan(((CAP.fovY / 2) * Math.PI) / 180) * (CAP.camZ - z);
    const base = new THREE.Vector3((rand() * 2 - 1) * h * 1.7, (rand() * 2 - 1) * h * 0.95, z);
    g.scale.setScalar(0.8 + rand() * 0.5);
    bgScene.add(g);
    bgCaps.push({
      obj: g,
      base,
      amp: new THREE.Vector3(0.3 + rand() * 0.5, 0.2 + rand() * 0.4, 0.2),
      rot0: new THREE.Euler(rand() * 6.28, rand() * 6.28, rand() * 6.28),
      spin: new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5),
      ph: rand(),
      n: 1,
    });
  }

  const bw = Math.max(2, Math.round(pw / 2));
  const bh = Math.max(2, Math.round(ph / 2));
  const bgRT = makeTarget(bw, bh, 0);
  const bgBlurRT = makeTarget(bw, bh, 0);
  const blur = new GaussianBlur(bw, bh);
  const fgRT = makeTarget(pw, ph, 4);
  const noise = blueNoiseTexture(BLUE_NOISE, BLUE_NOISE_SIZE);
  const final = new FullscreenPass(FINAL_FRAG, {
    tBg: { value: bgBlurRT.texture },
    tFg: { value: fgRT.texture },
    tNoise: { value: noise },
    uBgColor: { value: new THREE.Vector3(...new THREE.Color(row.background).convertLinearToSRGB().toArray()) },
    uRes: { value: new THREE.Vector2(pw, ph) },
    uFrameMod: { value: 0 },
  });

  const render = (frame: number) => {
    const t = frame / FPS;
    // whole cycles over the 12 s story
    const T = frame / (12 * FPS);
    for (const c of bgCaps) {
      const a = Math.PI * 2 * (c.n * T + c.ph);
      c.obj.position.set(c.base.x + c.amp.x * Math.sin(a), c.base.y + c.amp.y * Math.cos(a), c.base.z);
      c.obj.rotation.set(c.rot0.x + c.spin.x * Math.sin(a), c.rot0.y + Math.PI * 2 * T * Math.sign(c.spin.y), c.rot0.z + c.spin.z * Math.cos(a));
    }
    const pose = capsulePose(t);
    group.position.copy(pose.group.pos);
    group.rotation.copy(pose.group.rot);
    bodyPivot.position.set(pose.sep / 2, 0, 0);
    bodyPivot.rotation.set(0, 0, -pose.bodyTilt);
    capPivot.position.set(-pose.sep / 2, 0, 0);
    capPivot.rotation.set(0, 0, pose.capTilt);
    powderMat.uniforms.uTime.value = t;
    final.material.uniforms.uFrameMod.value = frame % row.durationInFrames;

    renderer.setClearColor(0x000000, 0);
    renderer.setRenderTarget(bgRT);
    renderer.clear(true, true, true);
    renderer.shadowMap.enabled = false;
    renderer.render(bgScene, camera);
    blur.run(renderer, bgRT, bgBlurRT, (bh / 1080) * 34);

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.needsUpdate = true;
    renderer.setRenderTarget(fgRT);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);

    renderer.setRenderTarget(null);
    renderer.clear(true, true, true);
    final.render(renderer, null);
  };

  return {
    render,
    dispose: () => {
      [bgRT, bgBlurRT, fgRT].forEach((r) => r.dispose());
      blur.dispose();
      final.dispose();
      envRT.dispose();
      noise.dispose();
      bodyGeo.dispose();
      capGeo.dispose();
      pg.dispose();
      powderMat.dispose();
      [capMat, bodyMat, bgMat].forEach((m) => m.dispose());
    },
  };
};

export const CapsuleRelease: React.FC<{ row: CapsuleRow }> = ({ row }) => {
  const create = useCallback(createScene(row), [row]);
  return (
    <AbsoluteFill style={{ backgroundColor: row.background }}>
      <ThreeStage create={create} />
    </AbsoluteFill>
  );
};

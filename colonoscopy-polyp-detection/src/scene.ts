import * as THREE from "three";
import {
  FOLD_OFFSET,
  POLYP_THETA,
  POLYP_X,
  SEGMENT_LENGTH,
  TUBE_RADIUS,
  WALL_THICKNESS,
} from "./constants";

const X_MIN = -16;
const X_MAX = 16;
const NX = 1100;
const NT = 72;

/** Inner radius of the colon along its axis: haustra bulges + tight folds. */
export const radiusAt = (x: number) => {
  const u = (x - FOLD_OFFSET) / SEGMENT_LENGTH;
  const d = (u - Math.round(u)) * SEGMENT_LENGTH; // distance to nearest fold
  const fold = Math.exp(-(d * d) / (0.075 * 0.075));
  const bulge = Math.cos(u * Math.PI * 2); // 1 at folds, -1 mid-segment
  return TUBE_RADIUS * (1 - 0.085 * fold - 0.022 * bulge);
};

/** Point on the (half) tube. theta = 0 is the middle of the back wall. */
export const tubePoint = (x: number, theta: number, extra = 0) => {
  const r = radiusAt(x) + extra;
  return new THREE.Vector3(x, r * Math.sin(theta), -r * Math.cos(theta));
};

const buildShell = (extra: number, flip: boolean) => {
  const pos = new Float32Array((NX + 1) * (NT + 1) * 3);
  const idx: number[] = [];
  let p = 0;
  for (let i = 0; i <= NX; i++) {
    const x = X_MIN + ((X_MAX - X_MIN) * i) / NX;
    for (let j = 0; j <= NT; j++) {
      const th = -Math.PI / 2 + (Math.PI * j) / NT;
      const v = tubePoint(x, th, extra);
      pos[p++] = v.x;
      pos[p++] = v.y;
      pos[p++] = v.z;
    }
  }
  for (let i = 0; i < NX; i++) {
    for (let j = 0; j < NT; j++) {
      const a = i * (NT + 1) + j;
      const b = a + NT + 1;
      if (flip) idx.push(a, a + 1, b, b, a + 1, b + 1);
      else idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

/** Flat cut face (wall thickness) along the top (sign=1) or bottom (sign=-1) edge. */
const buildRim = (sign: number) => {
  const pos = new Float32Array((NX + 1) * 2 * 3);
  const idx: number[] = [];
  let p = 0;
  for (let i = 0; i <= NX; i++) {
    const x = X_MIN + ((X_MAX - X_MIN) * i) / NX;
    const r = radiusAt(x);
    pos[p++] = x;
    pos[p++] = sign * r;
    pos[p++] = 0;
    pos[p++] = x;
    pos[p++] = sign * (r + WALL_THICKNESS);
    pos[p++] = 0;
  }
  for (let i = 0; i < NX; i++) {
    const a = i * 2;
    if (sign > 0) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

const RING_VERT = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Segmented "lesion detected" HUD ring.
const RING_FRAG = `
precision highp float;
varying vec2 vUv;
uniform float uTime;     // seconds
uniform float uReveal;   // 0..1 sweep-in
uniform float uOpacity;  // 0..1
uniform float uGlow;
const float PI = 3.14159265;

float band(float r, float r0, float r1, float aa) {
  return smoothstep(r0 - aa, r0 + aa, r) * (1.0 - smoothstep(r1 - aa, r1 + aa, r));
}
// 1 inside the arc [a0, a0+len] (turns), with soft ends
float arc(float t, float a0, float len, float aa) {
  float d = fract(t - a0);
  return smoothstep(0.0, aa, d) * (1.0 - smoothstep(len - aa, len, d));
}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  float t = atan(p.y, p.x) / (2.0 * PI);          // turns
  float aa = fwidth(r) * 1.2;
  float ta = 0.004;

  // one thick, softly glowing segmented band (static)
  float mainBand = band(r, 0.60, 0.735, aa);
  float gA = arc(t, 0.655, 0.375 * uReveal, ta);                 // green: right + bottom
  float bA = arc(t, 0.05, 0.245 * uReveal, ta);                  // lavender: top
  float wA = arc(t, 0.31, 0.325 * uReveal, ta);                  // white: left
  vec3 green = vec3(0.52, 1.0, 0.46);
  vec3 white = vec3(1.0, 0.99, 0.97);
  vec3 lav   = vec3(0.80, 0.82, 1.0);
  float seg = clamp(gA + bA + wA, 0.0, 1.0);
  vec3 col = (green * gA + white * wA + lav * bA) * mainBand;
  float a = mainBand * seg;
  // brighter core line for a glassy look
  col += vec3(0.22) * band(r, 0.65, 0.69, aa) * seg;

  // thin pink-white outline hugging the band
  float outline = band(r, 0.752, 0.768, aa) * uReveal;
  col += vec3(1.0, 0.84, 0.90) * outline * 0.7;
  a += outline * 0.6;

  // tick marks on the inside of the top (lavender) arc
  float tickA = fract(t * 40.0);
  float ticks = band(r, 0.52, 0.60, aa) * step(0.42, tickA) * step(tickA, 0.58) * bA;
  col += vec3(0.92, 0.94, 1.0) * ticks * 0.8;
  a += ticks * 0.7;

  // soft bloom around the ring
  float gd = (r - 0.67) / 0.13;
  float glow = exp(-gd * gd) * uGlow * uReveal;
  col += vec3(0.88, 0.96, 0.92) * glow;
  a += glow * 0.5;

  a *= uOpacity;
  gl_FragColor = vec4(col * uOpacity, clamp(a, 0.0, 1.0));
}`;

export type SceneHandles = {
  scene: THREE.Scene;
  scope: THREE.Group;
  ring: THREE.Mesh;
  ringMaterial: THREE.ShaderMaterial;
  polypPosition: THREE.Vector3;
  dispose: () => void;
};

export const buildScene = (): SceneHandles => {
  const scene = new THREE.Scene();
  const disposables: { dispose: () => void }[] = [];

  // The whole anatomy is rotated a little so the tube rises to the right and
  // its right end comes towards the viewer, like the reference framing.
  const world = new THREE.Group();
  world.rotation.set(0, -0.12, 0.165);
  scene.add(world);

  // ---- colon wall -----------------------------------------------------------
  const innerMat = new THREE.MeshPhysicalMaterial({
    color: 0xdc917a,
    roughness: 0.5,
    metalness: 0.0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.45,
    sheen: 0.6,
    sheenColor: new THREE.Color(0xffc8a0),
    sheenRoughness: 0.6,
    side: THREE.DoubleSide,
  });
  const outerMat = new THREE.MeshStandardMaterial({
    color: 0xc9805c,
    roughness: 0.7,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xf2ab86,
    roughness: 0.6,
    emissive: 0x7a3d24,
    emissiveIntensity: 0.55,
  });
  const innerGeo = buildShell(0, false);
  const outerGeo = buildShell(WALL_THICKNESS, true);
  const rimTop = buildRim(1);
  const rimBottom = buildRim(-1);
  const inner = new THREE.Mesh(innerGeo, innerMat);
  inner.receiveShadow = true;
  const outer = new THREE.Mesh(outerGeo, outerMat);
  world.add(inner, outer, new THREE.Mesh(rimTop, rimMat), new THREE.Mesh(rimBottom, rimMat));
  disposables.push(innerGeo, outerGeo, rimTop, rimBottom, innerMat, outerMat, rimMat);

  // ---- polyp ----------------------------------------------------------------
  const wallPoint = tubePoint(POLYP_X, POLYP_THETA);
  const wallNormal = new THREE.Vector3(
    0,
    -Math.sin(POLYP_THETA),
    Math.cos(POLYP_THETA),
  ); // points to the tube axis
  const polypMat = new THREE.MeshPhysicalMaterial({
    color: 0xee9c74,
    roughness: 0.38,
    clearcoat: 0.6,
    clearcoatRoughness: 0.3,
    sheen: 0.5,
    sheenColor: new THREE.Color(0xffd2b0),
  });
  // lathe profile: rounded head on a smoothly flared base
  const profile: THREE.Vector2[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48; // 0 = top of head, 1 = base on wall
    const ang = t * Math.PI * 0.6;
    const head = 0.17;
    let rr = Math.sin(ang) * head;
    let yy = Math.cos(ang) * head + 0.09;
    if (t > 0.55) {
      const k = (t - 0.55) / 0.45;
      rr += k * k * k * 0.035;
      yy -= k * 0.035;
    }
    profile.push(new THREE.Vector2(Math.max(rr, 0.0001), yy));
  }
  const polypGeo = new THREE.LatheGeometry(profile.reverse(), 64);
  const polyp = new THREE.Mesh(polypGeo, polypMat);
  polyp.scale.set(1.2, 1.55, 1.75); // slightly oval
  polyp.castShadow = false;
  polyp.receiveShadow = true;
  const polypGroup = new THREE.Group();
  polypGroup.position.copy(wallPoint).addScaledVector(wallNormal, -0.1);
  polypGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), wallNormal);
  polypGroup.add(polyp);
  world.add(polypGroup);
  disposables.push(polypGeo, polypMat);

  // ---- detection ring ---------------------------------------------------------
  const ringMaterial = new THREE.ShaderMaterial({
    vertexShader: RING_VERT,
    fragmentShader: RING_FRAG,
    uniforms: {
      uTime: { value: 0 },
      uReveal: { value: 0 },
      uOpacity: { value: 0 },
      uGlow: { value: 0.3 },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    side: THREE.DoubleSide,
  });
  const ringGeo = new THREE.PlaneGeometry(1.5, 1.5);
  const ring = new THREE.Mesh(ringGeo, ringMaterial);
  ring.position.copy(wallPoint).addScaledVector(wallNormal, 0.3);
  ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), wallNormal);
  ring.renderOrder = 10;
  world.add(ring);
  disposables.push(ringGeo, ringMaterial);

  // ---- endoscope --------------------------------------------------------------
  // Local frame: tip face at x = 0, tube extends towards -x.
  const scope = new THREE.Group();
  const SR = 0.285;
  const scopeMat = new THREE.MeshPhysicalMaterial({
    color: 0x3a363c,
    roughness: 0.42,
    metalness: 0.2,
    clearcoat: 0.8,
    clearcoatRoughness: 0.25,
  });
  const bodyGeo = new THREE.CylinderGeometry(SR, SR, 9, 64, 1, true);
  bodyGeo.rotateZ(Math.PI / 2);
  bodyGeo.translate(-4.5 - 0.03, 0, 0);
  const body = new THREE.Mesh(bodyGeo, scopeMat);
  body.castShadow = true;
  // rounded bevel at the tip
  const bevelGeo = new THREE.TorusGeometry(SR - 0.03, 0.03, 20, 64);
  bevelGeo.rotateY(Math.PI / 2);
  bevelGeo.translate(-0.03, 0, 0);
  const bevel = new THREE.Mesh(bevelGeo, scopeMat);
  // distal collar seam
  const seamGeo = new THREE.TorusGeometry(SR + 0.002, 0.006, 8, 64);
  seamGeo.rotateY(Math.PI / 2);
  seamGeo.translate(-0.38, 0, 0);
  const seamMat = new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.6 });
  const seam = new THREE.Mesh(seamGeo, seamMat);
  const faceMat = new THREE.MeshPhysicalMaterial({
    color: 0x0d0c10,
    roughness: 0.25,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
  });
  const faceGeo = new THREE.CircleGeometry(SR - 0.028, 64);
  faceGeo.rotateY(Math.PI / 2);
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.position.x = -0.004;
  // light guide (bright), lens + working channel (dark, glossy)
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xf4f6ff });
  const lightGeo = new THREE.CircleGeometry(0.062, 32);
  lightGeo.rotateY(Math.PI / 2);
  const light = new THREE.Mesh(lightGeo, lightMat);
  light.position.set(0.002, 0.12, 0.05);
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.2 });
  const holeGeo = new THREE.CircleGeometry(0.066, 32);
  holeGeo.rotateY(Math.PI / 2);
  const hole1 = new THREE.Mesh(holeGeo, holeMat);
  hole1.position.set(0.002, -0.07, 0.12);
  const hole2 = new THREE.Mesh(holeGeo, holeMat);
  hole2.scale.setScalar(0.7);
  hole2.position.set(0.002, -0.09, -0.1);
  const rimGeo = new THREE.RingGeometry(0.066, 0.08, 32);
  rimGeo.rotateY(Math.PI / 2);
  const rimMat2 = new THREE.MeshStandardMaterial({ color: 0x3a3840, roughness: 0.3, metalness: 0.6 });
  const holeRim = new THREE.Mesh(rimGeo, rimMat2);
  holeRim.position.copy(hole1.position).setX(0.003);
  seam.visible = false;
  scope.add(body, bevel, seam, face, light, hole1, hole2, holeRim);
  // turned slightly so the tip face is visible and the scope aims at the polyp
  scope.rotation.set(0, -0.1, 0.085);
  scope.position.set(0, 0.15, -0.42);
  world.add(scope);
  disposables.push(
    bodyGeo, bevelGeo, seamGeo, faceGeo, lightGeo, holeGeo, rimGeo,
    scopeMat, seamMat, faceMat, lightMat, holeMat, rimMat2,
  );

  // ---- lighting ---------------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0xffe9dc, 0x4a2418, 0.40));
  const key = new THREE.DirectionalLight(0xfff1e6, 1.6);
  key.position.set(5.5, 4.0, 7);
  key.target.position.set(0.8, 0, -0.6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -6;
  key.shadow.camera.right = 6;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.radius = 9;
  key.shadow.blurSamples = 16;
  key.shadow.bias = -0.0015;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  // warm fill that brightens the wall around the polyp
  const fill = new THREE.PointLight(0xffd9c2, 11, 10, 1.6);
  fill.position.set(3.2, 1.2, 2.6);
  scene.add(fill);
  // cool rim from the left to give the scope its long highlight
  const rim = new THREE.DirectionalLight(0xcfd8ff, 0.7);
  rim.position.set(-5, 3, 4);
  scene.add(rim);

  world.updateMatrixWorld(true);
  const polypPosition = polypGroup.getWorldPosition(new THREE.Vector3());

  return {
    scene,
    scope,
    ring,
    ringMaterial,
    polypPosition,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
};

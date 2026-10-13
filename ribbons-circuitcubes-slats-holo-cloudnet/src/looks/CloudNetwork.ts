import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { defaultPost } from "../engine/post";
import { lin } from "../engine/fullscreen";
import { LookFactory } from "../engine/Stage";
import { TAU, mulberry32, phaseOf } from "../engine/rng";
import { LandMask } from "./landmask";

// Look 5 — a glowing cloud icon on a dotted world map, linked to 12 user pawns.
// Camera orbits exactly 30° and back (cosine) so the loop closes exactly.

export type CloudParams = {
  floor: string;
  dots: string;
  glow: string;
  glass: string;
  line: string;
  land?: LandMask;
};

// ---------- layout (module level, seeded once) ----------
const rng = mulberry32(0x5eed7);
const PAWNS = Array.from({ length: 12 }, (_, i) => {
  const a = (i / 12) * TAU + (rng() - 0.5) * 0.32 + 0.15;
  const r = 3.8 + rng() * 1.4 + (i % 2) * 0.45;
  return { x: Math.cos(a) * r, z: Math.sin(a) * r, cyclesOut: [1, 2, 3, 4][Math.floor(rng() * 4)], cyclesIn: [1, 2, 3, 5][Math.floor(rng() * 4)], o1: rng(), o2: rng() };
});
const MAP_W = 30; // world width of 360° of longitude
const CLOUD_Y = 0.32; // cloud base height (slightly raised)

const FLOOR_VERT = /* glsl */ `
varying vec2 vXZ;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vXZ = w.xz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const FLOOR_FRAG = /* glsl */ `
uniform sampler2D tLand;
uniform vec2 grid;      // cols, rows
uniform vec2 mapSize;   // world size of the map
uniform vec2 mapOffset; // world position of the map centre
uniform vec3 floorCol;
uniform vec3 dotCol;
uniform vec3 glowCol;
uniform vec2 pads[12];
uniform vec3 hazeCol;
varying vec2 vXZ;
void main() {
  vec2 uv = (vXZ - mapOffset) / mapSize + 0.5;
  uv.y = 1.0 - uv.y; // data rows run south → north; north is away from the camera (−z)
  vec2 cell = uv * grid;
  vec2 id = floor(cell);
  vec2 f = fract(cell) - 0.5;
  float land = 0.0;
  if (all(greaterThanEqual(id, vec2(0.0))) && all(lessThan(id, grid)))
    land = texture2D(tLand, (id + 0.5) / grid).r;
  // rounded-square dot, anti-aliased with screen-space derivatives
  vec2 fw = fwidth(cell);
  float aa = max(fw.x, fw.y);
  float d = length(f) - 0.3; // round dots
  float dotMask = (1.0 - smoothstep(-aa * 0.5, aa * 0.5, d)) * land;
  dotMask *= 1.0 - smoothstep(0.45, 0.9, aa); // fade before dots go sub-pixel
  vec3 c = floorCol;
  // broad haze across the floor (brighter to the back right)
  c += hazeCol * 1.3 * exp(-length(vXZ - vec2(9.0, -2.0)) * 0.13);
  c *= 0.55 + 0.45 * smoothstep(-14.0, 4.0, vXZ.x - 0.4 * vXZ.y); // darker to the left
  c = mix(c, c + dotCol * 0.8, dotMask);
  // light pooled under the cloud and the pedestals
  float pool = exp(-dot(vXZ, vXZ) * 0.35) * 1.4;
  for (int i = 0; i < 12; i++) {
    vec2 dd = vXZ - pads[i];
    pool += exp(-dot(dd, dd) * 2.2) * 0.75;
  }
  c += glowCol * pool * (0.35 + 0.65 * dotMask);
  gl_FragColor = vec4(c, 1.0);
}`;

const LINE_VERT = /* glsl */ `
attribute float aS;
attribute vec4 aPulse; // cyclesOut, offsetOut, cyclesIn, offsetIn
varying float vS;
varying vec4 vPulse;
void main() {
  vS = aS; vPulse = aPulse;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const LINE_FRAG = /* glsl */ `
uniform vec3 color;
uniform float phase;
varying float vS;     // 0 at the pedestal, 1 at the cloud
varying vec4 vPulse;
void main() {
  float pulse = 0.0;
  // a main pulse each way plus two small trailing beads (all whole cycles per loop)
  for (int k = 0; k < 3; k++) {
    float o = float(k) * 0.07;
    float amp = k == 0 ? 1.0 : 0.45;
    float pIn = fract(phase * vPulse.x + vPulse.y - o);          // pedestal → cloud
    float pOut = 1.0 - fract(phase * vPulse.z + vPulse.w - o);   // cloud → pedestal
    float a = vS - pIn, b = vS - pOut;
    pulse += amp * (exp(-a * a * 2500.0) + exp(-b * b * 2500.0));
  }
  gl_FragColor = vec4(color * (0.9 + pulse * 4.5), 1.0);
}`;

const cloudGeometry = () => {
  const parts: THREE.BufferGeometry[] = [];
  const add = (r: number, x: number, y: number) => {
    const g = new THREE.SphereGeometry(r, 48, 32);
    g.translate(x, y, 0);
    parts.push(g);
  };
  add(0.6, 0.18, 0.72); // big top lobe
  add(0.4, -0.48, 0.52); // small left lobe
  add(0.46, 0.72, 0.5); // right lobe
  const base = new THREE.CapsuleGeometry(0.36, 1.5, 12, 32);
  base.rotateZ(Math.PI / 2);
  base.translate(0.06, 0.36, 0);
  parts.push(base);
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  // flat bottom + slightly flattened depth like an icon
  const pos = merged.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    pos.setY(i, Math.max(pos.getY(i), 0.06));
    pos.setZ(i, pos.getZ(i) * 0.62);
  }
  merged.computeVertexNormals();
  return merged;
};

const pawnBodyGeometry = () => {
  const pts: THREE.Vector2[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // rounded cone: wide skirt tapering to the neck
    // bell: flared hem, concave waist, rounded shoulders closing at the top
    const bell = 0.3 - 0.19 * Math.pow(t, 0.7) + 0.05 * Math.pow(1 - t, 6);
    const shoulder = t > 0.82 ? Math.sqrt(Math.max(0, 1 - ((t - 0.82) / 0.18) ** 2)) : 1;
    pts.push(new THREE.Vector2(Math.max(bell * shoulder, 0.001), t * 0.44));
  }
  pts.push(new THREE.Vector2(0.001, 0.441));
  pts.unshift(new THREE.Vector2(0.001, 0));
  return new THREE.LatheGeometry(pts, 40);
};

export const createCloudNetwork: LookFactory<CloudParams> = (params, gl) => {
  gl.shadowMap.enabled = false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 1, 80);
  const glow = lin(params.glow);
  const glass = lin(params.glass);

  // ----- floor with the dotted world map -----
  const land = params.land;
  const tex = land
    ? new THREE.DataTexture(land.data, land.cols, land.rows, THREE.RedFormat, THREE.UnsignedByteType)
    : new THREE.DataTexture(new Uint8Array([0]), 1, 1, THREE.RedFormat);
  tex.flipY = false;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  const mapH = land ? (MAP_W * (land.rows / land.cols)) : MAP_W / 2;
  const floorMat = new THREE.ShaderMaterial({
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
    uniforms: {
      tLand: { value: tex },
      grid: { value: new THREE.Vector2(land?.cols ?? 1, land?.rows ?? 1) },
      mapSize: { value: new THREE.Vector2(MAP_W, mapH) },
      mapOffset: { value: new THREE.Vector2(1.5, -1.0) },
      floorCol: { value: lin(params.floor) },
      dotCol: { value: lin(params.dots) },
      glowCol: { value: glow },
      hazeCol: { value: lin(params.dots) },
      pads: { value: PAWNS.map((p) => new THREE.Vector2(p.x, p.z)) },
    },
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  // ----- environment for glass -----
  const envScene = new THREE.Scene();
  envScene.background = lin(params.floor).multiplyScalar(1.5);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(14, 6), new THREE.MeshBasicMaterial({ color: glass.clone().multiplyScalar(3), side: THREE.DoubleSide }));
  panel.position.set(-3, 7, 4);
  panel.lookAt(0, 0, 0);
  envScene.add(panel);
  const panel2 = new THREE.Mesh(new THREE.PlaneGeometry(8, 3), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(4), side: THREE.DoubleSide }));
  panel2.position.set(4, 6, -3);
  panel2.lookAt(0, 0, 0);
  envScene.add(panel2);
  const pmrem = new THREE.PMREMGenerator(gl);
  const envRT = pmrem.fromScene(envScene, 0.03);
  pmrem.dispose();
  scene.environment = envRT.texture;

  // ----- cloud: frosted glass shell around an emissive core -----
  const cloudGeo = cloudGeometry();
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: glass,
    roughness: 0.14,
    transmission: 0.35,
    thickness: 0.6,
    ior: 1.45,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    emissive: glow,
    emissiveIntensity: 0.1,
    envMapIntensity: 1.6,
  });
  const cloud = new THREE.Group();
  const shell = new THREE.Mesh(cloudGeo, shellMat);
  cloud.add(shell);
  const coreMat = new THREE.MeshBasicMaterial({ color: glow.clone().multiplyScalar(0.55) });
  const coreMesh = new THREE.Mesh(cloudGeo, coreMat);
  coreMesh.scale.setScalar(0.72);
  coreMesh.position.set(0, 0.06, 0);
  cloud.add(coreMesh);
  cloud.scale.setScalar(1.1);
  cloud.position.set(0, CLOUD_Y, 0);
  scene.add(cloud);

  // ----- pawns on pedestals (instanced) -----
  const PAWN_SCALE = 1.45;
  const bodyGeo = pawnBodyGeometry().scale(PAWN_SCALE, PAWN_SCALE, PAWN_SCALE);
  const headGeo = new THREE.SphereGeometry(0.115 * PAWN_SCALE, 32, 16);
  const discGeo = new THREE.CylinderGeometry(0.55, 0.57, 0.14, 64);
  const rimGeo = new THREE.TorusGeometry(0.565, 0.018, 8, 96);
  rimGeo.rotateX(Math.PI / 2);
  const ringGeo = new THREE.RingGeometry(0.31, 0.4, 64); // cyan glow ring around the figure's hem
  ringGeo.rotateX(-Math.PI / 2);
  const pawnMat = new THREE.MeshPhysicalMaterial({
    color: glass,
    roughness: 0.25,
    transmission: 0.15,
    thickness: 0.3,
    clearcoat: 0.8,
    emissive: glow,
    emissiveIntensity: 0.18,
    envMapIntensity: 1.5,
  });
  const discMat = new THREE.MeshPhysicalMaterial({ color: lin("#7AA8E8"), roughness: 0.18, metalness: 0.3, clearcoat: 1, envMapIntensity: 1.2 });
  const cyan = lin(params.line);
  const rimMat = new THREE.MeshBasicMaterial({ color: cyan.clone().multiplyScalar(0.35) });
  const ringMat = new THREE.MeshBasicMaterial({ color: cyan.clone().multiplyScalar(1.4), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const mk = (g: THREE.BufferGeometry, m: THREE.Material, y: number) => {
    const im = new THREE.InstancedMesh(g, m, PAWNS.length);
    const m4 = new THREE.Matrix4();
    PAWNS.forEach((p, i) => im.setMatrixAt(i, m4.makeTranslation(p.x, y, p.z)));
    scene.add(im);
    return im;
  };
  mk(discGeo, discMat, 0.07);
  mk(rimGeo, rimMat, 0.14);
  mk(ringGeo, ringMat, 0.142);
  mk(bodyGeo, pawnMat, 0.14);
  mk(headGeo, pawnMat, 0.14 + 0.54 * PAWN_SCALE);

  // ----- lines from each pedestal to the cloud base -----
  const pos: number[] = [];
  const sAttr: number[] = [];
  const pulse: number[] = [];
  const idx: number[] = [];
  const W = 0.022;
  PAWNS.forEach((p) => {
    const dir = new THREE.Vector2(-p.x, -p.z).normalize();
    const a = new THREE.Vector3(p.x + dir.x * 0.56, 0.075, p.z + dir.y * 0.56);
    const b = new THREE.Vector3(0, CLOUD_Y + 0.06, 0.1); // all lines meet under the cloud
    const n = new THREE.Vector3(-dir.y, 0, dir.x).multiplyScalar(W / 2);
    const base = pos.length / 3;
    pos.push(a.x + n.x, a.y, a.z + n.z, a.x - n.x, a.y, a.z - n.z, b.x + n.x, b.y, b.z + n.z, b.x - n.x, b.y, b.z - n.z);
    sAttr.push(0, 0, 1, 1);
    for (let k = 0; k < 4; k++) pulse.push(p.cyclesOut, p.o1, p.cyclesIn, p.o2);
    idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  });
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  lineGeo.setAttribute("aS", new THREE.Float32BufferAttribute(sAttr, 1));
  lineGeo.setAttribute("aPulse", new THREE.Float32BufferAttribute(pulse, 4));
  lineGeo.setIndex(idx);
  const lineMat = new THREE.ShaderMaterial({
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    uniforms: { color: { value: lin(params.line) }, phase: { value: 0 } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  scene.add(new THREE.Mesh(lineGeo, lineMat));

  scene.add(new THREE.HemisphereLight(glass, lin(params.floor), 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-4, 8, 5);
  scene.add(key);
  // back light for bright glassy rims on the cloud and the pawns
  const rimL = new THREE.DirectionalLight(0xffffff, 2.2);
  rimL.position.set(1, 6, -8);
  scene.add(rimL);
  const cloudLight = new THREE.PointLight(glow, 5, 6, 1.5);
  cloudLight.position.set(0, 0.25, 1.6);
  scene.add(cloudLight);

  const target = new THREE.Vector3(0.3, 0.2, 1.1);
  return {
    scene,
    camera,
    update: (frame, w, h) => {
      const t = phaseOf(frame);
      lineMat.uniforms.phase.value = t;
      const k = 0.5 - 0.5 * Math.cos(TAU * t); // 0 → 1 → 0
      const az = THREE.MathUtils.degToRad(-12 + 30 * k); // exactly 30° out and back
      const el = THREE.MathUtils.degToRad(34);
      const dist = 15.5 * (1 - 0.04 * k);
      camera.aspect = w / h;
      camera.position.set(
        target.x + dist * Math.cos(el) * Math.sin(az),
        target.y + dist * Math.sin(el),
        target.z + dist * Math.cos(el) * Math.cos(az),
      );
      camera.lookAt(target);
      camera.updateProjectionMatrix();
    },
    post: () => ({
      ...defaultPost(),
      focus: camera.position.distanceTo(cloud.position),
      dofFar: 0.004,
      dofNear: 0.005,
      dofRange: 3.5,
      bloom: 0.45,
      bloomThreshold: 0.85,
      bloomRadius: 0.6,
      vignette: 0.6,
      exposure: 1.0,
    }),
    dispose: () => {
      [cloudGeo, bodyGeo, headGeo, discGeo, rimGeo, ringGeo, lineGeo, floor.geometry].forEach((g) => g.dispose());
      [shellMat, coreMat, pawnMat, discMat, rimMat, ringMat, lineMat, floorMat].forEach((m) => m.dispose());
      tex.dispose();
      envRT.dispose();
    },
  };
};

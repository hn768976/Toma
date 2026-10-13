import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { defaultPost } from "../lib/post";
import { easeInOutCubic, mulberry32, range, TAU } from "../lib/random";
import { ThreeLook } from "../lib/ThreeStage";
import { buildIconAtlas } from "./shieldIcons";

// Look 2 — Shield Dome. Glass shield + white padlock on a ring platform, a
// geodesic half-shell, floating security pictograms, an orange horizon glow.
// mode "story": 10 s (close-up → pull back → dome assembles → hold)
// mode "hold": 20 s loop of the finished scene (±10° cosine orbit).

export type ShieldDomeProps = { mode: "story" | "hold" };

const CYAN = new THREE.Color("#5AC8FF");
const DOME_R = 3.1;
const SHIELD_Y = 1.25; // shield centre height

// ---------- shield outline ----------
const shieldShape = (s = 1) => {
  const w = 0.82 * s,
    top = 1.02 * s,
    bottom = -1.12 * s;
  const sh = new THREE.Shape();
  sh.moveTo(0, top - 0.06 * s);
  sh.quadraticCurveTo(w * 0.45, top + 0.02 * s, w * 0.92, top);
  sh.quadraticCurveTo(w, top, w, top - 0.1 * s);
  sh.bezierCurveTo(w, 0.1 * s, w * 0.85, -0.6 * s, 0, bottom);
  sh.bezierCurveTo(-w * 0.85, -0.6 * s, -w, 0.1 * s, -w, top - 0.1 * s);
  sh.quadraticCurveTo(-w, top, -w * 0.92, top);
  sh.quadraticCurveTo(-w * 0.45, top + 0.02 * s, 0, top - 0.06 * s);
  return sh;
};

const HEX_FRAG = /* glsl */ `
varying vec2 vP;
uniform float uGlow;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  // pointy hex grid
  vec2 p = vP / 0.17;
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h;
  vec2 b = mod(p - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = p - g;
  vec2 q = abs(g);
  float edge = max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
  float border = smoothstep(0.43, 0.47, edge);
  float rnd = hash(floor(id * 10.0 + 0.5));
  vec3 cell = mix(vec3(0.42, 0.58, 0.8), vec3(0.75, 0.86, 1.0), rnd);
  if (rnd > 0.93) cell = vec3(1.4, 1.1, 1.2);
  if (rnd < 0.06) cell = vec3(0.95, 0.75, 0.85);
  // bevelled tile shading
  cell *= 0.8 + 0.35 * (g.y + 0.2 * g.x);
  vec3 col = mix(cell, vec3(0.18, 0.28, 0.45), border);
  float fade = smoothstep(-0.9, 0.9, vP.y) * 0.85 + 0.15;
  col = mix(vec3(0.05, 0.22, 0.32), col, fade);
  gl_FragColor = vec4(col * fade * uGlow, 1.0);
}`;

const RINGS_FRAG = /* glsl */ `
varying vec2 vP;
uniform float uT;      // 0..1 over the pulse loop
uniform vec3 uColor;
uniform float uFade;
float band(float r, float c, float w) { return exp(-pow((r - c) / w, 2.0)); }
void main() {
  float r = length(vP);
  float s = 0.0;
  float warm = 0.0;
  float ang = atan(vP.y, vP.x);
  float hot = 1.0 + 3.0 * pow(abs(cos(ang)), 60.0);
  s += band(r, 1.3, 0.025) * 1.6 + band(r, 1.3, 0.1) * 0.3;
  s += band(r, 2.4, 0.02) * 0.35;
  s += (band(r, 3.95, 0.022) * 1.5 + band(r, 3.95, 0.09) * 0.22) * hot;
  // warm flecks along the outer ring
  float fl = pow(max(0.0, sin(ang * 23.0) * sin(ang * 7.0 + 1.3)), 24.0);
  warm += band(r, 3.95, 0.03) * (fl * 3.0 + pow(abs(cos(ang)), 30.0) * 2.0) + band(r, 1.3, 0.03) * 0.7;
  // pulses travelling outward (whole cycles over the loop)
  for (int k = 0; k < 2; k++) {
    float ph = fract(uT * 4.0 + float(k) * 0.5);
    float c = mix(0.9, 4.1, ph);
    s += band(r, c, 0.05 + 0.08 * ph) * (1.0 - ph) * (1.0 - ph) * 0.9;
  }
  // inner glow pool under the shield
  s += exp(-r * r / 0.5) * 0.25;
  gl_FragColor = vec4((uColor * s + vec3(1.6, 0.75, 0.6) * warm) * uFade, 1.0);
}`;

const FLOOR_FRAG = /* glsl */ `
varying vec2 vP;
uniform vec3 uBase;
uniform float uGrid;
void main() {
  float r = length(vP);
  // faint hex-ish tiling on the floor
  vec2 p = vP / 0.9;
  vec2 rr = vec2(1.0, 1.7320508);
  vec2 h = rr * 0.5;
  vec2 a = mod(p, rr) - h;
  vec2 b = mod(p - h, rr) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 q = abs(g);
  float edge = max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
  float line = smoothstep(0.47, 0.5, edge) * exp(-r * 0.12);
  vec3 col = uBase + vec3(0.1, 0.35, 0.8) * line * uGrid;
  // scattered small glowing dash lights in some tiles
  vec2 id = floor((p - g) * 4.0 + 0.5);
  float hh = fract(sin(dot(id, vec2(12.9898, 78.233))) * 43758.5453);
  if (hh > 0.9 && r > 3.0 && r < 18.0) {
    float dash = (1.0 - smoothstep(0.16, 0.2, abs(g.x))) * (1.0 - smoothstep(0.02, 0.045, abs(g.y)));
    vec3 lc = hh > 0.97 ? vec3(1.6, 0.6, 0.25) : vec3(0.3, 1.0, 2.0);
    col += lc * dash * exp(-r * 0.08);
  }
  col *= mix(1.25, 0.6, smoothstep(3.0, 16.0, r));
  col = mix(col, vec3(0.42, 0.26, 0.24), smoothstep(14.0, 40.0, r));
  float alpha = mix(0.62, 0.92, smoothstep(2.0, 14.0, r));
  gl_FragColor = vec4(col, alpha);
}`;

const SKY_FRAG = /* glsl */ `
varying vec3 vW;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uBar;
void main() {
  float y = vW.y;
  vec3 col = mix(uMid, uTop, smoothstep(0.0, 14.0, y));
  float bar = exp(-pow((y - 0.9) / 1.6, 2.0));
  float barX = 0.55 + 0.45 * exp(-pow(vW.x / 22.0, 2.0));
  col += uBar * bar * barX;
  col += vec3(0.5, 0.25, 0.45) * 0.06 * exp(-pow((y - 2.6) / 2.4, 2.0));
  col += vec3(1.0, 0.75, 0.55) * 0.5 * exp(-pow((y - 0.25) / 0.45, 2.0)) * exp(-pow(vW.x / 18.0, 2.0));
  gl_FragColor = vec4(col, 1.0);
}`;

const ICON_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
const ICON_FRAG = /* glsl */ `
uniform sampler2D tAtlas;
uniform vec4 uCell;   // u0, v0, du, dv
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 uv = uCell.xy + vUv * uCell.zw;
  float a = texture2D(tAtlas, uv).a;
  if (a < 0.25) discard;
  gl_FragColor = vec4(uColor * a, 1.0);
}`;

const FACE_VERT = /* glsl */ `
attribute float aAlpha;
attribute float aTint;
varying float vA;
varying float vTint;
varying vec3 vN;
varying vec3 vW;
#include <clipping_planes_pars_vertex>
void main() {
  vA = aAlpha;
  vTint = aTint;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const FACE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uCam;
varying float vA;
varying float vTint;
varying vec3 vN;
varying vec3 vW;
#include <clipping_planes_pars_fragment>
void main() {
  #include <clipping_planes_fragment>
  vec3 V = normalize(uCam - vW);
  float f = pow(1.0 - abs(dot(normalize(vN), V)), 2.0);
  vec3 c = mix(uColor, vec3(0.75, 1.1, 1.4), vTint);
  float g = 0.55 + 0.6 * smoothstep(-1.0, 3.5, vW.y);
  gl_FragColor = vec4(c * vA * g * (0.75 + 0.7 * f), 1.0);
}`;

type Edge = { a: THREE.Vector3; b: THREE.Vector3; start: number };

const buildDome = () => {
  const ico = new THREE.IcosahedronGeometry(DOME_R, 2);
  const pos = ico.getAttribute("position");
  const faces: THREE.Vector3[][] = [];
  for (let i = 0; i < pos.count; i += 3) {
    const tri = [0, 1, 2].map((k) => new THREE.Vector3().fromBufferAttribute(pos, i + k));
    const cy = (tri[0].y + tri[1].y + tri[2].y) / 3;
    if (cy > -0.15) faces.push(tri);
  }
  // unique edges
  const key = (v: THREE.Vector3) => `${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`;
  const edges = new Map<string, Edge>();
  const verts = new Map<string, THREE.Vector3>();
  for (const f of faces)
    for (let k = 0; k < 3; k++) {
      let a = f[k],
        b = f[(k + 1) % 3];
      if (a.y > b.y) [a, b] = [b, a]; // draw upwards
      const kk = [key(a), key(b)].sort().join("|");
      if (!edges.has(kk)) edges.set(kk, { a, b, start: 0 });
      verts.set(key(a), a);
      verts.set(key(b), b);
    }
  return { faces, edges: [...edges.values()], verts: [...verts.values()] };
};

export const createShieldDome =
  (props: ShieldDomeProps) =>
  (gl: THREE.WebGLRenderer): ThreeLook => {
    const story = props.mode === "story";
    const LOOP = story ? 300 : 600;
    const rng = mulberry32(1100455);
    gl.localClippingEnabled = true;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.35;

    const above = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.0);
    const below = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0.0);

    // ---- sky / horizon glow ----
    const sky = new THREE.Mesh(
      new THREE.CylinderGeometry(45, 45, 80, 64, 1, true),
      new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
        fragmentShader: SKY_FRAG,
        uniforms: {
          uTop: { value: new THREE.Color("#040A22") },
          uMid: { value: new THREE.Color("#0C1A52") },
          uBar: { value: new THREE.Color("#FF9A4A").multiplyScalar(0.7) },
        },
        side: THREE.BackSide,
      }),
    );
    sky.position.y = 30;
    scene.add(sky);

    // ---- reflective dark floor (semi-transparent over a mirrored copy) ----
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(44, 96),
      new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: FLOOR_FRAG,
        uniforms: { uBase: { value: new THREE.Color("#071A44") }, uGrid: { value: 0.9 } },
        transparent: true,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = 1;
    scene.add(floor);

    const rings = new THREE.Mesh(
      new THREE.CircleGeometry(5.4, 160),
      new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: RINGS_FRAG,
        uniforms: {
          uT: { value: 0 },
          uColor: { value: CYAN.clone().multiplyScalar(2.2) },
          uFade: { value: 1 },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    rings.rotation.x = -Math.PI / 2;
    rings.position.y = 0.004;
    rings.renderOrder = 2;
    scene.add(rings);

    // ---- the hero: shield + padlock (built once, then mirrored) ----
    const hero = new THREE.Group();
    hero.position.y = SHIELD_Y;
    hero.scale.setScalar(1.12);
    hero.rotation.y = 0.38;
    const shape = shieldShape(1);
    const depth = 0.1;
    const shieldGeo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: true,
      bevelThickness: 0.035,
      bevelSize: 0.03,
      bevelSegments: 4,
      curveSegments: 48,
    });
    shieldGeo.translate(0, 0, -depth / 2);
    const glass = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#7FC8E8"),
      metalness: 0,
      roughness: 0.08,
      transmission: 0.6,
      thickness: 0.15,
      ior: 1.45,
      transparent: true,
      opacity: 0.85,
      emissive: new THREE.Color("#2A6AA8"),
      emissiveIntensity: 0.25,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.2,
    });
    const shield = new THREE.Mesh(shieldGeo, glass);
    hero.add(shield);
    // hex pattern inside the glass
    const hexGeo = new THREE.ShapeGeometry(shieldShape(0.93), 48);
    const hexMat = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: HEX_FRAG,
      uniforms: { uGlow: { value: 0.32 } },
    });
    const hex = new THREE.Mesh(hexGeo, hexMat);
    hex.position.z = -0.01;
    hero.add(hex);
    // glowing cyan rim (outer + inner line)
    const rimPath = (s: number) =>
      new THREE.CatmullRomCurve3(
        shieldShape(s)
          .getSpacedPoints(160)
          .map((p) => new THREE.Vector3(p.x, p.y, 0)),
        true,
      );
    const rimMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#BFF0FF").multiplyScalar(1.3) });
    const rim1 = new THREE.Mesh(new THREE.TubeGeometry(rimPath(1.03), 400, 0.017, 10, true), rimMat);
    rim1.position.z = depth / 2 + 0.03;
    const rim2 = new THREE.Mesh(
      new THREE.TubeGeometry(rimPath(0.95), 400, 0.008, 6, true),
      new THREE.MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(2.2) }),
    );
    rim2.position.z = depth / 2 + 0.03;
    const rim3 = rim1.clone();
    rim3.position.z = -depth / 2 - 0.03;
    hero.add(rim1, rim2, rim3);

    // padlock: matte white body, chrome-free white shackle, glowing keyhole
    const lockMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#FBE2D8"),
      roughness: 0.42,
      metalness: 0,
      sheen: 0.4,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color("#FFD0D8"),
      emissive: new THREE.Color("#FF9AA8"),
      emissiveIntensity: 0.3,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
    });
    const lock = new THREE.Group();
    lock.position.set(0, -0.28, depth / 2 + 0.2);
    lock.scale.setScalar(0.86);
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.78, 0.64, 0.24, 6, 0.07), lockMat);
    lock.add(body);
    const shackleR = 0.235,
      tube = 0.05;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(shackleR, tube, 20, 48, Math.PI), lockMat);
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(tube, tube, 0.34, 20), lockMat);
    const legR = new THREE.Mesh(new THREE.CylinderGeometry(tube, tube, 0.16, 20), lockMat);
    // open shackle: lifted, the short leg free of the body
    const shackle = new THREE.Group();
    arc.position.y = 0.34;
    legL.position.set(-shackleR, 0.17, 0);
    legR.position.set(shackleR, 0.26, 0);
    shackle.add(arc, legL, legR);
    shackle.position.y = 0.32 + 0.06;
    lock.add(shackle);
    // keyhole
    const kh = new THREE.Shape();
    kh.absarc(0, 0.04, 0.055, 0, Math.PI * 2, false);
    const slot = new THREE.Shape();
    slot.moveTo(-0.022, 0.0);
    slot.lineTo(0.022, 0.0);
    slot.lineTo(0.032, -0.17);
    slot.lineTo(-0.032, -0.17);
    slot.closePath();
    const khMat = new THREE.MeshBasicMaterial({ color: CYAN.clone().multiplyScalar(3.2) });
    const kh1 = new THREE.Mesh(new THREE.ShapeGeometry(kh, 32), khMat);
    const kh2 = new THREE.Mesh(new THREE.ShapeGeometry(slot), khMat);
    kh1.position.z = kh2.position.z = 0.121;
    kh1.position.y = kh2.position.y = 0.02;
    lock.add(kh1, kh2);
    // a soft halo plane behind the keyhole glow
    hero.add(lock);
    scene.add(hero);

    // lighting for the solid parts
    const key = new THREE.DirectionalLight(new THREE.Color("#DDEBFF"), 1.6);
    key.position.set(-3, 5, 6);
    const rimL = new THREE.PointLight(new THREE.Color("#5AC8FF"), 6, 8, 2);
    rimL.position.set(1.5, 1.0, 1.2);
    const warm = new THREE.PointLight(new THREE.Color("#FF9A6A"), 4, 8, 2);
    warm.position.set(-1.6, 0.4, 1.6);
    scene.add(key, rimL, warm, new THREE.AmbientLight(new THREE.Color("#3A5A9A"), 0.35));

    // ---- dome ----
    const dome = buildDome();
    // draw-on schedule (story): edges rise from the base, 5.0 s → 6.8 s
    for (const e of dome.edges) {
      const h = Math.max(0, Math.min(e.a.y, e.b.y)) / DOME_R;
      e.start = 150 + h * 44 + rng() * 6;
    }
    const EDGE_DUR = 14;
    const lineMat = new LineMaterial({
      color: CYAN.clone().multiplyScalar(2.0),
      linewidth: 0.009,
      worldUnits: true,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      clippingPlanes: [above],
    });
    const lineGeo = new LineSegmentsGeometry();
    const linePos = new Float32Array(dome.edges.length * 6);
    lineGeo.setPositions(linePos);
    const domeLines = new LineSegments2(lineGeo, lineMat);
    domeLines.frustumCulled = false;
    domeLines.renderOrder = 4;
    scene.add(domeLines);

    // nodes at the vertices
    const nodeGeo = new THREE.SphereGeometry(0.017, 10, 8);
    const nodeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#BFF0FF").multiplyScalar(4) });
    const nodes = new THREE.InstancedMesh(nodeGeo, nodeMat, dome.verts.length);
    nodes.frustumCulled = false;
    scene.add(nodes);
    // fine sparkle points over the dome surface (twinkle on whole cycles)
    const SPARK = 240;
    const sparkPts = Array.from({ length: SPARK }, () => {
      const u = rng() * TAU,
        v = Math.acos(rng() * 0.98);
      const r = DOME_R * range(rng, 0.99, 1.04);
      return { p: new THREE.Vector3(Math.sin(v) * Math.cos(u) * r, Math.cos(v) * r, Math.sin(v) * Math.sin(u) * r), ph: rng(), n: 1 + Math.floor(rng() * 4) };
    });
    const sparks = new THREE.InstancedMesh(new THREE.SphereGeometry(0.009, 6, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color("#E0F8FF").multiplyScalar(5) }), SPARK);
    sparks.frustumCulled = false;
    scene.add(sparks);

    // filled faces (~30%) + floating shards
    const filled = dome.faces.filter(() => rng() < 0.3);
    const shards: THREE.Vector3[][] = [];
    for (let i = 0; i < 12; i++) {
      let f = dome.faces[Math.floor(rng() * dome.faces.length)];
      while (f[0].y + f[1].y + f[2].y > DOME_R * 1.6) f = dome.faces[Math.floor(rng() * dome.faces.length)];
      const c = f[0].clone().add(f[1]).add(f[2]).divideScalar(3);
      const n = c.clone().normalize();
      const off = range(rng, 0.05, 0.25);
      const s = range(rng, 0.35, 0.6);
      shards.push(f.map((v) => v.clone().sub(c).multiplyScalar(s).add(c).addScaledVector(n, off)));
    }
    // one glowing shard standing on the floor, right of the dome
    shards.push([new THREE.Vector3(2.55, 0, 1.9), new THREE.Vector3(3.05, 0, 1.75), new THREE.Vector3(2.85, 0.95, 1.85)]);
    const allTris = [...filled, ...shards];
    const triPos = new Float32Array(allTris.length * 9);
    allTris.forEach((t, i) => t.forEach((v, k) => triPos.set([v.x, v.y, v.z], i * 9 + k * 3)));
    const faceGeo = new THREE.BufferGeometry();
    faceGeo.setAttribute("position", new THREE.BufferAttribute(triPos, 3));
    faceGeo.computeVertexNormals();
    const faceAlpha = new Float32Array(allTris.length * 3);
    faceGeo.setAttribute("aAlpha", new THREE.BufferAttribute(faceAlpha, 1));
    const faceTint = new Float32Array(allTris.length * 3);
    for (let i = 0; i < allTris.length; i++) {
      const tnt = i >= filled.length ? 0.35 : rng() < 0.1 ? range(rng, 0.4, 0.7) : range(rng, 0, 0.12);
      faceTint.set([tnt, tnt, tnt], i * 3);
    }
    faceGeo.setAttribute("aTint", new THREE.BufferAttribute(faceTint, 1));
    const faceMat = new THREE.ShaderMaterial({
      vertexShader: FACE_VERT,
      fragmentShader: FACE_FRAG,
      uniforms: {
        uColor: { value: new THREE.Color("#1A6CFF").multiplyScalar(0.85) },
        uCam: { value: new THREE.Vector3() },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      clipping: true,
      clippingPlanes: [above],
    });
    const faces = new THREE.Mesh(faceGeo, faceMat);
    faces.frustumCulled = false;
    faces.renderOrder = 3;
    scene.add(faces);
    const faceMeta = allTris.map((_, i) => ({
      order: i,
      base: range(rng, 0.25, 1.2),
      flickN: [1, 2, 3, 4, 5, 6][Math.floor(rng() * 6)],
      flickPh: rng(),
      flicker: rng() < 0.35,
    }));
    // fill order: one by one, 6.2 s → 8.0 s
    const fillOrder = faceMeta.map((_, i) => i); // faces were picked at random, fill in that order
    const FILL_START = 186,
      FILL_END = 240;

    // depth-only proxies, drawn last: the additive dome writes no depth while
    // colour is drawn, but the DoF needs its depth (else it takes the sky's)
    const depthOnly = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.BackSide, clippingPlanes: [above] }); // far half only: keeps the shield sharp
    const faceDepth = new THREE.Mesh(faceGeo, depthOnly);
    faceDepth.renderOrder = 100;
    faceDepth.frustumCulled = false;
    scene.add(faceDepth);
    const lineDepthMat = new LineMaterial({ linewidth: 0.009, worldUnits: true, clippingPlanes: [above] });
    lineDepthMat.colorWrite = false;
    lineDepthMat.transparent = true;
    const lineDepth = new LineSegments2(lineGeo, lineDepthMat);
    lineDepth.renderOrder = 100;
    lineDepth.frustumCulled = false;
    scene.add(lineDepth);

    // ---- mirrored copy under the floor ----
    const mirror = new THREE.Group();
    mirror.scale.y = -1;
    const heroM = hero.clone(true);
    heroM.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh && m.material === glass) {
        m.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color("#6AA8D8"),
          transparent: true,
          opacity: 0.35,
          roughness: 0.2,
        });
      }
    });
    mirror.add(heroM);
    const lineMatM = lineMat.clone();
    lineMatM.clippingPlanes = [below];
    const domeLinesM = new LineSegments2(lineGeo, lineMatM);
    domeLinesM.frustumCulled = false;
    mirror.add(domeLinesM);
    const faceMatM = faceMat.clone();
    faceMatM.uniforms = faceMat.uniforms;
    faceMatM.clippingPlanes = [below];
    mirror.add(new THREE.Mesh(faceGeo, faceMatM));
    mirror.traverse((o) => {
      o.renderOrder = -1;
      o.frustumCulled = false;
    });
    scene.add(mirror);

    // ---- icons + bokeh ----
    const atlas = buildIconAtlas();
    const icons: { mesh: THREE.Mesh; base: THREE.Vector3; ph: number; n: number }[] = [];
    for (let i = 0; i < 34; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const inside = i < 5;
      const z = inside ? range(rng, -2.2, -0.8) : range(rng, -4, 2.5);
      const x = inside ? side * range(rng, 1.2, 2.3) : side * range(rng, 3.4, 5.4 + Math.max(0, -z) * 0.45);
      const y = inside ? range(rng, 1.0, 2.2) : range(rng, 0.9, 2.5);
      const size = range(rng, 0.2, 0.32);
      const glyph = Math.floor(rng() * 7);
      const card = rng() < 0.2 ? 1 : 0;
      const mat = new THREE.ShaderMaterial({
        vertexShader: ICON_VERT,
        fragmentShader: ICON_FRAG,
        uniforms: {
          tAtlas: { value: atlas },
          uCell: { value: new THREE.Vector4(glyph / 8, (1 - card) * 0.5, 1 / 8, 0.5) },
          uColor: { value: new THREE.Color("#5AD8FF").multiplyScalar(range(rng, 2.6, 4.6)) },
        },
        blending: THREE.AdditiveBlending,
        transparent: true,
      });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
      mesh.renderOrder = 5;
      scene.add(mesh);
      icons.push({ mesh, base: new THREE.Vector3(x, y, z), ph: rng(), n: 1 + Math.floor(rng() * 2) });
    }
    const BOKEH = 14;
    const bokeh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      BOKEH,
    );
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < BOKEH; i++) {
      const ang = rng() * TAU;
      const dist = range(rng, 5, 22);
      const p = new THREE.Vector3(Math.cos(ang) * dist, range(rng, 0.3, 5.5), -Math.abs(Math.sin(ang)) * dist - 2);
      if (rng() < 0.25) p.set(range(rng, -2.5, 2.5), range(rng, 0.4, 2.6), range(rng, -3, -1.2)); // close behind the lock
      const s = range(rng, 0.012, 0.03);
      m4.compose(p, new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      bokeh.setMatrixAt(i, m4);
      const c = rng() < 0.7 ? new THREE.Color("#4AB8FF") : new THREE.Color("#FF9A5A");
      bokeh.setColorAt(i, c.multiplyScalar(range(rng, 2, 6)));
    }
    scene.add(bokeh);

    // ---- camera + post ----
    const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.05, 200);
    const post = defaultPost();
    post.tonemap = 1;
    post.exposure = 1.15;
    post.saturation = 1.1;
    post.vignette = 0.3;
    post.loopFrames = LOOP;
    post.bloom = { strength: 0.55, threshold: 0.95, knee: 0.5, radius: 0.85 };
    post.dof = { focus: 10, aperture: 0.01, maxCoc: 0.035 };

    const tmpQ = new THREE.Quaternion();
    const holdCam = (az: number) => {
      const r = 10.6;
      camera.position.set(Math.sin(az) * r, 1.05, Math.cos(az) * r);
      camera.lookAt(0, 1.75, 0);
    };

    return {
      scene,
      camera,
      post,
      msaa: 4,
      update(frame, size) {
        const f = ((frame % LOOP) + LOOP) % LOOP;
        const t = f / LOOP;
        camera.aspect = size.w / size.h;
        lineMat.resolution.set(size.w, size.h);
        lineMatM.resolution.set(size.w, size.h);
        lineDepthMat.resolution.set(size.w, size.h);

        // ---- camera ----
        if (story) {
          // 0–2.5 s extreme close-up with a slow push; 2.5–5.5 s eased pull-back
          const lockC = new THREE.Vector3(0, SHIELD_Y - 0.12, depth / 2 + 0.2);
          const closePos = new THREE.Vector3(-0.55, SHIELD_Y + 0.05, 1.35);
          const push = Math.min(1, f / 75);
          const cp = closePos.clone().lerp(lockC, 0.12 * push);
          const closeLook = lockC.clone().add(new THREE.Vector3(0.05, 0.05, 0));
          const k = easeInOutCubic((f - 75) / 90);
          const az = 0;
          const holdPos = new THREE.Vector3(Math.sin(az) * 10.6, 1.05, Math.cos(az) * 10.6);
          camera.position.copy(cp).lerp(holdPos, k);
          const look = closeLook.clone().lerp(new THREE.Vector3(0, 1.75, 0), k);
          camera.lookAt(look);
          camera.fov = 32 + (1 - k) * 4;
          // heavy DoF in the close-up, eased to the hold aperture
          post.dof!.focus = camera.position.distanceTo(lockC.clone().setZ(lockC.z + 0.12));
          post.dof!.aperture = 0.045 * (1 - k) + 0.01 * k;
          post.dof!.maxCoc = 0.06 * (1 - k) + 0.035 * k;
        } else {
          const az = ((20 * Math.PI) / 180) * (0.5 - 0.5 * Math.cos(TAU * t)) - (10 * Math.PI) / 180;
          holdCam(az);
          post.dof!.focus = camera.position.distanceTo(new THREE.Vector3(0, SHIELD_Y, 0.2));
        }
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        faceMat.uniforms.uCam.value.copy(camera.position);

        // ---- dome assembly ----
        let k = 0;
        dome.edges.forEach((e) => {
          const p = story ? Math.min(1, Math.max(0, (f - e.start) / EDGE_DUR)) : 1;
          const pe = p * p * (3 - 2 * p);
          const end = e.a.clone().lerp(e.b, pe);
          linePos.set([e.a.x, e.a.y, e.a.z, end.x, end.y, end.z], k);
          k += 6;
        });
        lineGeo.setPositions(linePos);
        // nodes appear as the first edge reaches them
        dome.verts.forEach((v, i) => {
          const h = Math.max(0, v.y) / DOME_R;
          const appear = story ? Math.min(1, Math.max(0, (f - (150 + h * 44 + 4)) / 10)) : 1;
          const s = appear * (1 + 0.25 * Math.sin(TAU * (t * 2 + i * 0.37)));
          m4.compose(v, tmpQ, new THREE.Vector3(s, s, s));
          nodes.setMatrixAt(i, m4);
        });
        nodes.instanceMatrix.needsUpdate = true;
        const domeOn = story ? Math.min(1, Math.max(0, (f - 200) / 30)) : 1;
        sparkPts.forEach((sp, i) => {
          const tw = Math.max(0, Math.sin(TAU * (t * sp.n + sp.ph)));
          const sc = domeOn * (0.4 + 0.9 * tw * tw);
          m4.compose(sp.p, tmpQ, new THREE.Vector3(sc, sc, sc));
          sparks.setMatrixAt(i, m4);
        });
        sparks.instanceMatrix.needsUpdate = true;

        faceMeta.forEach((m, i) => {
          const order = fillOrder.indexOf(i) / faceMeta.length;
          const start = FILL_START + order * (FILL_END - FILL_START - 12);
          const fade = story ? Math.min(1, Math.max(0, (f - start) / 12)) : 1;
          // flicker on a schedule dividing the loop: whole cycles per loop
          const fl = m.flicker ? 0.55 + 0.45 * Math.cos(TAU * (t * m.flickN + m.flickPh)) : 1;
          const a = fade * fade * (3 - 2 * fade) * m.base * fl;
          faceAlpha[i * 3] = faceAlpha[i * 3 + 1] = faceAlpha[i * 3 + 2] = a;
        });
        (faceGeo.getAttribute("aAlpha") as THREE.BufferAttribute).needsUpdate = true;

        // rings: pulses repeat every 150 frames (divides both 300 and 600)
        (rings.material as THREE.ShaderMaterial).uniforms.uT.value = (f % 150) / 150 / 4;

        // icons drift (closed) and face the camera
        for (const ic of icons) {
          const dy = 0.08 * Math.sin(TAU * (t * ic.n + ic.ph));
          const dx = 0.05 * Math.cos(TAU * (t * ic.n + ic.ph));
          ic.mesh.position.set(ic.base.x + dx, ic.base.y + dy, ic.base.z);
          ic.mesh.quaternion.copy(camera.quaternion);
        }
      },
      dispose() {
        env.dispose();
        pmrem.dispose();
        atlas.dispose();
      },
    };
  };

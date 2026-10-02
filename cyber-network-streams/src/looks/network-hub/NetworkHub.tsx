import React, { useCallback } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { ThreeStage, BuiltScene } from "../../lib/three/ThreeStage";
import { defaultPost } from "../../lib/three/post";
import { clamp01, linColor, smoothstep } from "../../lib/three/util";
import { NetworkHubVersion } from "../../versions";
import { HUB_NODES } from "./layout";

// Look 2 — Network Hub. 12 s, not a loop. A glossy central node sends
// arrows out; nodes pop up where they land, over three generations, while
// the camera pulls back and rises.

export const NH_DURATION = 360;
const MAXN = 24;
const BASE = 1.5; // base square size
const CUBE = 0.86;
const CUBE_H = 0.8;
const LINE_W = 0.055;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
// pop: 0.9 → overshoot → 1
const popScale = (t: number) => {
  if (t <= 0) return 0.9;
  if (t >= 1) return 1;
  const c = 2.2;
  const u = t - 1;
  return 0.9 + 0.1 * (1 + (c + 1) * u * u * u + c * u * u);
};

const FLOOR_VERT = /* glsl */ `
varying vec3 vW;
void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const FLOOR_FRAG = /* glsl */ `
#define MAXN ${MAXN}
uniform vec3 uFloor; uniform vec3 uEdge; uniform vec3 uLine; uniform vec4 uNodes[MAXN]; uniform int uCount;
uniform float uShadow; uniform float uGlow; uniform vec3 uCamPos; uniform float uLight; uniform vec3 uKeyDir; uniform vec2 uRes;
varying vec3 vW;
float sdBox(vec2 p, vec2 b, float r){ vec2 q = abs(p) - b + r; return length(max(q,0.0)) + min(max(q.x,q.y),0.0) - r; }
void main(){
  vec2 p = vW.xz;
  // broad gradient: brighter pool around the centre, darker to the edges
  float rad = length(p - vec2(4.0, -6.0)) / 30.0;
  vec3 c = mix(uFloor, uEdge, smoothstep(0.1, 1.1, rad));
  // big soft out-of-focus light in the lower-left corner of the frame
  vec2 sc = gl_FragCoord.xy / uRes; sc.x *= uRes.x / uRes.y;
  float pool = exp(-dot(sc - vec2(0.0, 0.0), sc - vec2(0.0, 0.0)) / 0.12);
  c += (uLight > 0.5 ? vec3(0.0) : vec3(0.03, 0.22, 0.42)) * pool;
  // soft sheen: a wide highlight that follows the view (glossy floor)
  vec3 V = normalize(uCamPos - vW);
  vec3 H = normalize(V + normalize(uKeyDir));
  float spec = pow(max(H.y, 0.0), 40.0);
  c += uFloor * spec * (uLight > 0.5 ? 0.04 : 0.35);
  float sh = 0.0; float gl = 0.0;
  for (int i = 0; i < MAXN; i++) {
    if (i >= uCount) break;
    vec4 n = uNodes[i]; // x, z, scale, visibility
    if (n.w <= 0.0) continue;
    vec2 q = p - n.xy;
    float s = n.z;
    // contact shadow: tight core + wide penumbra, offset away from the key light
    float d = sdBox(q - vec2(0.10, 0.12)*s, vec2(${(BASE / 2).toFixed(3)})*s, 0.12);
    sh = max(sh, n.w * (0.65*exp(-max(d,0.0)/0.10) + 0.35*exp(-max(d,0.0)/0.55)));
    // glow spill from the emissive base outline
    float e = abs(sdBox(q, vec2(${(BASE / 2).toFixed(3)})*s, 0.1));
    gl += n.w * exp(-e/0.07) * 0.35 + n.w * exp(-e/0.35) * 0.08;
  }
  c *= 1.0 - uShadow * clamp(sh, 0.0, 1.0);
  c += uLine * gl * uGlow;
  gl_FragColor = vec4(c, 1.0);
}`;

const PULSE_FRAG = /* glsl */ `
uniform vec3 uCol; uniform float uA;
varying vec2 vUv;
void main(){ vec2 q = (vUv - 0.5)*2.0; float a = exp(-q.x*q.x*3.0 - q.y*q.y*2.0); gl_FragColor = vec4(uCol*a*uA, a*uA); }`;
const PULSE_VERT = /* glsl */ `
varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

const roundRectShape = (w: number, h: number, r: number) => {
  const s = new THREE.Shape();
  const x = -w / 2,
    y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
};
const outlineGeo = (size: number, width: number, r: number) => {
  const outer = roundRectShape(size, size, r);
  const inner = roundRectShape(size - width * 2, size - width * 2, Math.max(0.01, r - width));
  outer.holes.push(new THREE.Path(inner.getPoints(8).reverse()));
  const g = new THREE.ShapeGeometry(outer, 8);
  g.rotateX(-Math.PI / 2);
  return g;
};

const buildScene = (v: NetworkHubVersion, gl: THREE.WebGLRenderer): BuiltScene => {
  const light = v.theme === "light";
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(20, 16 / 9, 0.1, 400);
  const pm = new THREE.PMREMGenerator(gl);
  const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = env;
  scene.environmentIntensity = light ? 0.45 : 0.22;

  const lineCol = linColor(v.line);
  const nodeCol = linColor(v.node);

  // lights
  const key = new THREE.DirectionalLight(0xffffff, light ? 2.0 : 1.6);
  key.position.set(-4, 9, -3);
  scene.add(key);
  const fill = new THREE.DirectionalLight(light ? 0xdde8ff : 0x6fa8ff, light ? 0.6 : 0.5);
  fill.position.set(5, 3, 6);
  scene.add(fill);
  scene.add(new THREE.AmbientLight(light ? 0xffffff : 0x4060a0, light ? 0.35 : 0.25));

  // floor
  const floorU = {
    uFloor: { value: linColor(v.floor) },
    uEdge: { value: linColor(v.floorEdge) },
    uLine: { value: lineCol },
    uNodes: { value: Array.from({ length: MAXN }, () => new THREE.Vector4()) },
    uCount: { value: HUB_NODES.length },
    uShadow: { value: v.shadow },
    uGlow: { value: v.glow },
    uCamPos: { value: new THREE.Vector3() },
    uLight: { value: light ? 1 : 0 },
    uKeyDir: { value: key.position.clone().normalize() },
    uRes: { value: new THREE.Vector2(1280, 720) },
  };
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({ vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG, uniforms: floorU }),
  );
  scene.add(floor);

  // node parts
  const cubeGeo = new RoundedBoxGeometry(CUBE, CUBE_H, CUBE, 3, 0.04);
  cubeGeo.translate(0, CUBE_H / 2 + 0.07, 0);
  const cubeMat = new THREE.MeshPhysicalMaterial({
    color: nodeCol.clone().multiplyScalar(light ? 0.85 : 0.6),
    envMapIntensity: light ? 1 : 1.6,
    roughness: 0.18,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transmission: 0,
    emissive: nodeCol,
    emissiveIntensity: light ? 0.03 : 0.06,
  });
  const plateGeo = new RoundedBoxGeometry(BASE * 0.94, 0.06, BASE * 0.94, 2, 0.025);
  plateGeo.translate(0, 0.03, 0);
  const plateMat: THREE.Material = light
    ? new THREE.MeshPhysicalMaterial({ color: new THREE.Color("#E8EDF3"), roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.4 })
    : new THREE.MeshBasicMaterial({ color: linColor(v.floor).multiplyScalar(0.55) });
  const ringGeo = outlineGeo(BASE, 0.05, 0.08);
  ringGeo.translate(0, 0.064, 0);
  const ringBase = lineCol.clone().multiplyScalar(light ? 1.4 : 1.7);

  type NodeObj = { g: THREE.Group; cube: THREE.Mesh; ring: THREE.Mesh; ringMat: THREE.MeshBasicMaterial };
  const nodeObjs: NodeObj[] = HUB_NODES.map((n) => {
    const g = new THREE.Group();
    g.position.set(n.x, 0, n.z);
    const plate = new THREE.Mesh(plateGeo, plateMat);
    const ringMat = new THREE.MeshBasicMaterial({ color: ringBase.clone(), transparent: true });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    const cube = new THREE.Mesh(cubeGeo, cubeMat);
    g.add(plate, ring, cube);
    scene.add(g);
    return { g, cube, ring, ringMat };
  });

  // links: ribbon + arrowhead + travelling pulses
  const ribbonGeo = new THREE.PlaneGeometry(1, LINE_W).rotateX(-Math.PI / 2).translate(0.5, 0.012, 0);
  const headShape = new THREE.Shape();
  headShape.moveTo(0, 0);
  headShape.lineTo(-0.34, 0.15);
  headShape.lineTo(-0.25, 0);
  headShape.lineTo(-0.34, -0.15);
  headShape.closePath();
  const headGeo = new THREE.ShapeGeometry(headShape).rotateX(-Math.PI / 2).translate(0, 0.014, 0);
  const pulseGeo = new THREE.PlaneGeometry(0.9, 0.09).rotateX(-Math.PI / 2).translate(0, 0.02, 0);
  const lineHDR = lineCol.clone().multiplyScalar(light ? 1.1 : 1.15);
  type LinkObj = { g: THREE.Group; rib: THREE.Mesh; head: THREE.Mesh; pulses: THREE.Mesh[]; len: number; a0: number; a1: number };
  const links: LinkObj[] = [];
  HUB_NODES.forEach((n, i) => {
    if (n.parent < 0) return;
    const p = HUB_NODES[n.parent];
    const dx = n.x - p.x,
      dz = n.z - p.z;
    const L = Math.hypot(dx, dz);
    const g = new THREE.Group();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = -Math.atan2(dz, dx);
    const mat = new THREE.MeshBasicMaterial({ color: lineHDR, transparent: true, depthWrite: false });
    const rib = new THREE.Mesh(ribbonGeo, mat);
    const head = new THREE.Mesh(headGeo, mat);
    const pulses = [0, 1].map(() => {
      const m = new THREE.Mesh(
        pulseGeo,
        new THREE.ShaderMaterial({
          vertexShader: PULSE_VERT,
          fragmentShader: PULSE_FRAG,
          uniforms: { uCol: { value: lineCol.clone().multiplyScalar(light ? 1.2 : 1.5) }, uA: { value: 0 } },
          transparent: true,
          depthWrite: false,
          blending: light ? THREE.NormalBlending : THREE.AdditiveBlending,
          premultipliedAlpha: true,
        }),
      );
      g.add(m);
      return m;
    });
    g.add(rib, head);
    scene.add(g);
    // start / end at the base edges (along the link direction, square base)
    const edge = (BASE / 2) * Math.min(1 / Math.abs(Math.cos(Math.atan2(dz, dx)) || 1e-6), 1 / Math.abs(Math.sin(Math.atan2(dz, dx)) || 1e-6), 1.414) + 0.06;
    links.push({ g, rib, head, pulses, len: L, a0: edge, a1: L - edge });
    void i;
  });

  const target = new THREE.Vector3();
  return {
    scene,
    camera,
    clear: linColor(v.floorEdge),
    grainPeriod: 100000,
    post: light
      ? { ...defaultPost, exposure: 1.0, bloomStrength: 0.35, bloomRadius: 0.5, bloomThreshold: 0.9, toneMap: "linear", vignette: 0.12, grain: 0.012, saturation: 1 }
      : { ...defaultPost, exposure: 1.0, bloomStrength: 0.45, bloomRadius: 0.3, bloomThreshold: 0.75, toneMap: "aces", vignette: 0.32, grain: 0.02, saturation: 1.05 },
    update: (frame, info) => {
      const f = frame;
      floorU.uRes.value.set(info.width, info.height);
      // ---- camera: close at ~35°, pull back + rise over 0–240, then drift
      const k = easeInOut(clamp01(f / 240));
      const drift = Math.max(0, f - 240) / 120;
      const dist = 8 + (46 - 8) * k + drift * 1.2;
      const elev = ((33 + (37 - 33) * k) * Math.PI) / 180;
      const az = ((-34 + 12 * k + drift * 3) * Math.PI) / 180;
      target.set(-0.3 * k, 0.25 * (1 - k), 0.3 * k);
      camera.position.set(target.x + Math.sin(az) * Math.cos(elev) * dist, target.y + Math.sin(elev) * dist, target.z + Math.cos(az) * Math.cos(elev) * dist);
      camera.lookAt(target);
      floorU.uCamPos.value.copy(camera.position);

      // ---- nodes
      HUB_NODES.forEach((n, i) => {
        const t = (f - n.arrive) / 16;
        const vis = clamp01(t * 1.5);
        const o = nodeObjs[i];
        const s = t <= 0 ? 0 : popScale(clamp01(t));
        o.g.visible = t > 0;
        o.g.scale.setScalar(s);
        const rise = 1 - smoothstep(0, 0.8, t);
        o.cube.position.y = -0.5 * rise;
        o.ringMat.color.copy(ringBase).multiplyScalar(0.4 + 0.6 * vis + 0.8 * Math.exp(-Math.max(0, t) * 2.5) * (t > 0 ? 1 : 0));
        o.ringMat.opacity = vis;
        floorU.uNodes.value[i].set(n.x, n.z, s, vis);
      });

      // ---- links
      HUB_NODES.forEach((n, i) => {
        if (n.parent < 0) return;
        const lk = links[i - 1];
        const prog = clamp01((f - n.launch) / (n.arrive - n.launch));
        const shown = f >= n.launch;
        lk.g.visible = shown;
        const tip = lk.a0 + (lk.a1 - lk.a0) * smoothstep(0, 1, prog) * 0.999 + 0.001;
        lk.rib.position.x = lk.a0;
        lk.rib.scale.x = Math.max(0.001, tip - lk.a0 - 0.12);
        lk.head.position.x = tip;
        // pulses after the link is formed, travelling parent → child
        lk.pulses.forEach((pm, j) => {
          const age = f - n.arrive - 6 - j * 24;
          const mat = pm.material as THREE.ShaderMaterial;
          if (age < 0) {
            mat.uniforms.uA.value = 0;
            return;
          }
          const ph = (age % 48) / 48;
          pm.position.x = lk.a0 + (lk.a1 - lk.a0) * ph;
          mat.uniforms.uA.value = Math.sin(Math.PI * ph) * clamp01(age / 10);
        });
      });
    },
  };
};

export const NetworkHub: React.FC<{ version: NetworkHubVersion }> = ({ version }) => {
  const build = useCallback((gl: THREE.WebGLRenderer) => buildScene(version, gl), [version]);
  return <ThreeStage build={build} />;
};

import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { lin } from "../lib/color";
import { LookFactory } from "../lib/LookCanvas";
import { cwave, phase, TAU, wave } from "../lib/loop";
import { defaultPost } from "../lib/post";
import { mulberry32 } from "../lib/random";
import { getBoard, traceAt } from "./pcb";

export interface CpuCubeParams {
  edge: string; // cube edge glow
  trace: string; // board trace glow
  accent: string; // ~5% of the pulses
  die: string; // die frame colour
  core: string; // die core colour
}

const canvas = (w: number, h = w) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** Board textures for a region [x0,x1]x[z0,z1] in world units. */
const drawBoard = (size: number, x0: number, x1: number, z0: number, z1: number) => {
  const board = getBoard();
  const base = canvas(size);
  const emis = canvas(size);
  const b = base.getContext("2d")!;
  const e = emis.getContext("2d")!;
  const sx = size / (x1 - x0);
  const sz = size / (z1 - z0);
  const X = (x: number) => (x - x0) * sx;
  const Z = (z: number) => (z - z0) * sz;
  b.fillStyle = "#1A2028";
  b.fillRect(0, 0, size, size);
  e.fillStyle = "#000";
  e.fillRect(0, 0, size, size);
  // faint copper pour hatch
  b.globalAlpha = 0.5;
  b.fillStyle = "#0A111D";
  const rng = mulberry32(0x5eed01);
  for (let i = 0; i < 160; i++) {
    const cx = x0 + rng() * (x1 - x0);
    const cz = z0 + rng() * (z1 - z0);
    b.fillRect(X(cx), Z(cz), (0.5 + rng() * 2.5) * sx, (0.5 + rng() * 2.5) * sz);
  }
  b.globalAlpha = 1;
  const inView = (t: { pts: [number, number][] }) =>
    t.pts.some(([x, z]) => x > x0 - 1 && x < x1 + 1 && z > z0 - 1 && z < z1 + 1);
  b.lineCap = "round";
  b.lineJoin = "round";
  e.lineCap = "round";
  e.lineJoin = "round";
  const tw = board.pitch * 0.55;
  for (const t of board.traces) {
    if (!inView(t)) continue;
    b.strokeStyle = "#95A3B6";
    b.lineWidth = Math.max(1, tw * sx);
    b.beginPath();
    t.pts.forEach(([x, z], i) => (i ? b.lineTo(X(x), Z(z)) : b.moveTo(X(x), Z(z))));
    b.stroke();
    // emissive: soft halo + bright core
    const g = Math.round(255 * t.glow);
    e.strokeStyle = `rgba(${g},${g},${g},0.35)`;
    e.lineWidth = Math.max(1, tw * 2.2 * sx);
    e.beginPath();
    t.pts.forEach(([x, z], i) => (i ? e.lineTo(X(x), Z(z)) : e.moveTo(X(x), Z(z))));
    e.stroke();
    e.strokeStyle = `rgb(${g},${g},${g})`;
    e.lineWidth = Math.max(1, tw * 0.7 * sx);
    e.stroke();
    // vias at the ends
    const end = t.pts[t.pts.length - 1];
    const r = board.pitch * 0.45;
    b.fillStyle = "#24364F";
    b.beginPath();
    b.arc(X(end[0]), Z(end[1]), Math.max(1, r * sx), 0, TAU);
    b.fill();
    e.fillStyle = `rgb(${Math.min(255, g + 60)},${Math.min(255, g + 60)},${Math.min(255, g + 60)})`;
    e.beginPath();
    e.arc(X(end[0]), Z(end[1]), Math.max(1, r * 0.6 * sx), 0, TAU);
    e.fill();
  }
  for (const p of board.parts) {
    if (p.x < x0 - 1 || p.x > x1 + 1 || p.z < z0 - 1 || p.z > z1 + 1) continue;
    const px = X(p.x - p.w / 2);
    const pz = Z(p.z - p.h / 2);
    const pw = p.w * sx;
    const ph = p.h * sz;
    if (p.kind === "chip") {
      b.fillStyle = "#03050A";
      b.fillRect(px, pz, pw, ph);
      b.strokeStyle = "#1C2A3E";
      b.lineWidth = Math.max(1, 0.012 * sx);
      b.strokeRect(px, pz, pw, ph);
      // pad rows on the long sides
      const pads = Math.max(2, Math.floor(p.w / 0.06));
      for (let i = 0; i < pads; i++) {
        const ux = px + ((i + 0.5) / pads) * pw;
        b.fillStyle = "#2A3C55";
        b.fillRect(ux - 0.012 * sx, pz - 0.04 * sz, 0.024 * sx, 0.035 * sz);
        b.fillRect(ux - 0.012 * sx, pz + ph + 0.005 * sz, 0.024 * sx, 0.035 * sz);
        e.fillStyle = "rgba(90,90,90,1)";
        e.fillRect(ux - 0.008 * sx, pz - 0.035 * sz, 0.016 * sx, 0.025 * sz);
        e.fillRect(ux - 0.008 * sx, pz + ph + 0.01 * sz, 0.016 * sx, 0.025 * sz);
      }
      e.strokeStyle = "rgba(170,170,170,1)";
      e.lineWidth = Math.max(1, 0.012 * sx);
      e.strokeRect(px, pz, pw, ph);
    } else {
      b.fillStyle = "#0B121E";
      b.fillRect(px, pz, pw, ph);
      b.fillStyle = "#32465F";
      if (p.w > p.h) {
        b.fillRect(px, pz, pw * 0.25, ph);
        b.fillRect(px + pw * 0.75, pz, pw * 0.25, ph);
      } else {
        b.fillRect(px, pz, pw, ph * 0.25);
        b.fillRect(px, pz + ph * 0.75, pw, ph * 0.25);
      }
      e.fillStyle = "rgba(120,120,120,1)";
      e.fillRect(px + pw * 0.3, pz + ph * 0.3, pw * 0.4, ph * 0.4);
    }
  }
  return { base, emis };
};

/** One die face: frame with pin grid, gold-bronze die, dark gap, silver core. */
const drawFace = (S: number, p: CpuCubeParams) => {
  const col = canvas(S);
  const emi = canvas(S);
  const hgt = canvas(S);
  const c = col.getContext("2d")!;
  const e = emi.getContext("2d")!;
  const h = hgt.getContext("2d")!;
  const R = (ctx: CanvasRenderingContext2D, a: number, b: number, fill: string) => {
    ctx.fillStyle = fill;
    ctx.fillRect(a * S, a * S, (b - a) * S, (b - a) * S);
  };
  R(c, 0, 1, "#1C2533");
  R(e, 0, 1, "#000");
  R(h, 0, 1, "#404040");
  // pin grid
  const n = 40;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      const u = (i + 0.5) / n;
      const v = (j + 0.5) / n;
      if (u < 0.04 || u > 0.96 || v < 0.04 || v > 0.96) continue;
      if (u > 0.2 && u < 0.8 && v > 0.2 && v < 0.8) continue;
      const r = S * 0.0068;
      c.fillStyle = "#F2F6FC";
      c.beginPath();
      c.arc(u * S, v * S, r, 0, TAU);
      c.fill();
      e.fillStyle = "rgba(255,255,255,0.22)";
      e.beginPath();
      e.arc(u * S, v * S, r * 0.8, 0, TAU);
      e.fill();
      h.fillStyle = "#707070";
      h.beginPath();
      h.arc(u * S, v * S, r, 0, TAU);
      h.fill();
    }
  // die package
  R(c, 0.215, 0.785, "#1A1410");
  R(c, 0.225, 0.775, p.die);
  const gl = c.createLinearGradient(0.225 * S, 0.225 * S, 0.775 * S, 0.775 * S);
  gl.addColorStop(0, "rgba(255,240,210,0.25)");
  gl.addColorStop(0.5, "rgba(0,0,0,0)");
  gl.addColorStop(1, "rgba(0,0,0,0.25)");
  c.fillStyle = gl;
  c.fillRect(0.225 * S, 0.225 * S, 0.55 * S, 0.55 * S);
  R(c, 0.335, 0.665, "#1E160E");
  R(c, 0.35, 0.65, p.core);
  R(h, 0.225, 0.775, "#909090");
  R(h, 0.335, 0.665, "#606060");
  R(h, 0.35, 0.65, "#B0B0B0");
  R(e, 0.225, 0.775, "#140E06");
  R(e, 0.35, 0.65, "#FFFFFF");
  // thin glowing outline of the face
  e.strokeStyle = "#FFFFFF";
  e.lineWidth = S * 0.012;
  e.strokeRect(0.006 * S, 0.006 * S, 0.988 * S, 0.988 * S);
  return { col, emi, hgt };
};

const tex = (c: HTMLCanvasElement, gl: THREE.WebGLRenderer, srgb: boolean) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = gl.capabilities.getMaxAnisotropy();
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.needsUpdate = true;
  return t;
};

const PULSE_VERT = /* glsl */ `
attribute vec3 instanceTint;
varying vec2 vUv;
varying vec3 vTint;
void main() {
  vUv = uv;
  vTint = instanceTint;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const PULSE_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec3 vTint;
void main() {
  float along = vUv.x;           // 0 tail .. 1 head
  float across = (vUv.y - 0.5) * 2.0;
  float body = pow(along, 4.0) * exp(-across * across * 6.0);
  float head = exp(-pow((along - 0.9) * 9.0, 2.0) - across * across * 5.0);
  gl_FragColor = vec4(vTint * (body * 0.9 + head * 2.6), 1.0);
}`;

export const cpuCube: LookFactory<CpuCubeParams> = (p, gl) => {
  const scene = new THREE.Scene();
  scene.background = lin("#020409");
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 80);
  const post = defaultPost();
  const edge = lin(p.edge);
  const trace = lin(p.trace);
  const accent = lin(p.accent);

  const pmrem = new THREE.PMREMGenerator(gl);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  // the env map goes on the cube materials only (on the board it hazes the far field)

  // ---- board: wide outer plane + detailed centre plane ----
  const board = getBoard();
  const outer = drawBoard(4096, -board.half, board.half, -board.half, board.half);
  const innerHalf = 3.2;
  const inner = drawBoard(4096, -innerHalf, innerHalf, -innerHalf, innerHalf);
  const boardMat = (t: { base: HTMLCanvasElement; emis: HTMLCanvasElement }, offset: number) =>
    new THREE.MeshStandardMaterial({
      map: tex(t.base, gl, true),
      emissiveMap: tex(t.emis, gl, true),
      emissive: trace.clone().multiplyScalar(0.45),
      bumpMap: tex(t.base, gl, false),
      bumpScale: 2.5,
      roughness: 0.42,
      metalness: 0.35,
      envMapIntensity: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: offset,
      polygonOffsetUnits: offset,
    });
  const outerMesh = new THREE.Mesh(new THREE.PlaneGeometry(board.half * 2, board.half * 2), boardMat(outer, 0));
  outerMesh.rotation.x = -Math.PI / 2;
  scene.add(outerMesh);
  const innerMesh = new THREE.Mesh(new THREE.PlaneGeometry(innerHalf * 2, innerHalf * 2), boardMat(inner, -2));
  innerMesh.rotation.x = -Math.PI / 2;
  innerMesh.position.y = 0.0005;
  scene.add(innerMesh);
  // soft glow pool around the base of the cube (reflection of the edges)
  const poolMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uColor: { value: edge.clone() } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; varying vec2 vUv;
      void main(){ vec2 q = abs(vUv - 0.5) * 2.0; float d = max(q.x, q.y); float r = length(vUv - 0.5) * 2.0;
      float g = exp(-max(d - 0.42, 0.0) * 9.0) * 0.5 + exp(-r * r * 1.6) * 0.12;
      gl_FragColor = vec4(uColor * g, 1.0); }`,
  });
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), poolMat);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.002;
  void pool; // (the glow pool under the cube read as a glowing pad: left out)

  // ---- the cube ----
  const lift = 0.12;
  const cube = new THREE.Group();
  cube.position.y = lift + 0.5;
  scene.add(cube);
  const face = drawFace(2048, p);
  const faceMat = new THREE.MeshStandardMaterial({
    map: tex(face.col, gl, true),
    color: new THREE.Color(0.8, 0.8, 0.8),
    emissiveMap: tex(face.emi, gl, true),
    emissive: edge.clone().lerp(new THREE.Color(1, 1, 1), 0.5).multiplyScalar(0.55),
    bumpMap: tex(face.hgt, gl, false),
    bumpScale: 1.2,
    roughness: 0.38,
    metalness: 0.45,
    envMap: env,
    envMapIntensity: 0.12,
  });
  // bottom face: plain dark
  const bottomMat = new THREE.MeshStandardMaterial({ color: "#0A0D12", roughness: 0.6 });
  const cubeMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [faceMat, faceMat, faceMat, bottomMat, faceMat, faceMat]);
  cube.add(cubeMesh);
  // glowing edges
  const edgeMat = new THREE.MeshBasicMaterial({ color: edge.clone().multiplyScalar(2.2) });
  const ew = 0.009;
  for (let a = 0; a < 3; a++)
    for (const sa of [-1, 1])
      for (const sb of [-1, 1]) {
        const g = new THREE.BoxGeometry(a === 0 ? 1 + ew : ew, a === 1 ? 1 + ew : ew, a === 2 ? 1 + ew : ew);
        const m = new THREE.Mesh(g, edgeMat);
        const pos = [0, 0, 0];
        const others = [0, 1, 2].filter((k) => k !== a);
        pos[others[0]] = sa * 0.5;
        pos[others[1]] = sb * 0.5;
        m.position.set(pos[0], pos[1], pos[2]);
        cube.add(m);
      }
  // pin fringe under the cube (gull-wing: down, then out)
  const pinsPerSide = 20;
  const pinMat = new THREE.MeshStandardMaterial({ color: "#C8D2DE", metalness: 1, roughness: 0.3, emissive: edge.clone().multiplyScalar(0.15), envMap: env, envMapIntensity: 0.6 });
  const pinV = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, lift, 0.016), pinMat, pinsPerSide * 4);
  const pinH = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.012, 0.09), pinMat, pinsPerSide * 4);
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  let k = 0;
  for (let side = 0; side < 4; side++) {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), (side * Math.PI) / 2);
    for (let i = 0; i < pinsPerSide; i++) {
      const u = ((i + 0.5) / pinsPerSide - 0.5) * 0.92;
      const v1 = new THREE.Vector3(u, lift / 2, 0.47).applyQuaternion(q);
      mtx.compose(v1, q, new THREE.Vector3(1, 1, 1));
      pinV.setMatrixAt(k, mtx);
      const v2 = new THREE.Vector3(u, 0.004, 0.5).applyQuaternion(q);
      mtx.compose(v2, q, new THREE.Vector3(1, 1, 1));
      pinH.setMatrixAt(k, mtx);
      k++;
    }
  }
  scene.add(pinV, pinH);
  const baseBlock = new THREE.Mesh(new THREE.BoxGeometry(0.9, lift, 0.9), new THREE.MeshStandardMaterial({ color: "#05070B", roughness: 0.7 }));
  baseBlock.position.y = lift / 2;
  scene.add(baseBlock);

  // ---- lights ----
  scene.add(new THREE.AmbientLight(lin("#7A889E"), 0.7));
  const key = new THREE.DirectionalLight(lin("#BCD4FF"), 1.6);
  key.position.set(4, 6, -3);
  scene.add(key);
  // edge glow reflected by the glossy board
  for (const [x, z] of [[0.7, 0.7], [-0.7, 0.7], [0.7, -0.7], [-0.7, -0.7]]) {
    const l = new THREE.PointLight(edge, 1.0, 3.5, 2);
    l.position.set(x, 0.35, z);
    scene.add(l);
  }

  // ---- pulses ----
  const prng = mulberry32(0x9017e5);
  const candidates = board.traces.filter((t) => t.len > 0.8);
  const NP = 3000;
  interface Pulse { t: (typeof candidates)[number]; trips: number; off: number; len: number; w: number }
  const pulses: Pulse[] = [];
  const tint = new Float32Array(NP * 3);
  const radial = candidates.filter((c) => c.radial);
  for (let i = 0; i < NP; i++) {
    const t = prng() < 0.05 ? radial[Math.floor(prng() * radial.length)] : candidates[Math.floor(prng() * candidates.length)];
    const trips = 1 + Math.floor(prng() * (t.len < 6 ? 3 : 2));
    const c = prng() < 0.06 ? accent : trace;
    const s = 5 + prng() * 7;
    tint[i * 3] = c.r * s;
    tint[i * 3 + 1] = c.g * s;
    tint[i * 3 + 2] = c.b * s;
    const accentPulse = c === accent;
    pulses.push({ t, trips, off: prng(), len: (accentPulse ? 0.25 : 0.1) + prng() * 0.22, w: 0.018 + prng() * 0.012 });
  }
  const pulseGeo = new THREE.PlaneGeometry(1, 1);
  pulseGeo.rotateX(-Math.PI / 2);
  pulseGeo.translate(-0.5, 0, 0);
  // uv.x: 0 tail .. 1 head (head at local x=0)
  pulseGeo.setAttribute("instanceTint", new THREE.InstancedBufferAttribute(tint, 3));
  const pulseMat = new THREE.ShaderMaterial({
    vertexShader: PULSE_VERT,
    fragmentShader: PULSE_FRAG,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const pulseMesh = new THREE.InstancedMesh(pulseGeo, pulseMat, NP);
  pulseMesh.frustumCulled = false;
  scene.add(pulseMesh);
  const up = new THREE.Vector3(0, 1, 0);
  const pv = new THREE.Vector3();
  const ps = new THREE.Vector3();

  const target = new THREE.Vector3(0, 0.55, 0);
  const update = (frame: number) => {
    // pulses: whole trips per loop, travelling outward
    for (let i = 0; i < NP; i++) {
      const P = pulses[i];
      const ph = (phase(frame, P.trips) + P.off) % 1;
      const span = P.t.len + P.len;
      const s = ph * span;
      const [x, z, dx, dz] = traceAt(P.t, Math.min(s, P.t.len));
      const fade = Math.min(1, s / 0.3) * Math.min(1, (span - s) / P.len);
      q.setFromAxisAngle(up, Math.atan2(-dz, dx));
      pv.set(x, 0.02, z);
      ps.set(P.len * Math.max(0.001, fade), 1, P.w * Math.max(0.001, fade));
      mtx.compose(pv, q, ps);
      pulseMesh.setMatrixAt(i, mtx);
    }
    pulseMesh.instanceMatrix.needsUpdate = true;

    // camera: one closed lap — yaw ±35°, pitch 50°..25°, slight push
    const yaw = THREE.MathUtils.degToRad(-10 + 35 * wave(frame, 1));
    const pitch = THREE.MathUtils.degToRad(37.5 + 12.5 * cwave(frame, 1, 0.4));
    const dist = 6.3 + 0.45 * wave(frame, 1, 0.3);
    camera.position.set(
      target.x + dist * Math.cos(pitch) * Math.sin(yaw),
      target.y + dist * Math.sin(pitch),
      target.z + dist * Math.cos(pitch) * Math.cos(yaw),
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    post.focusDist = camera.position.distanceTo(target);
  };

  Object.assign(post, {
    aperture: 0.012,
    maxCoc: 0.01,
    bloomStrength: 0.85,
    bloomThreshold: 0.9,
    bloomKnee: 0.6,
    bloomSpread: 0.75,
    exposure: 1.15,
    vignette: 0.45,
    grain: 0.015,
    saturation: 1.05,
  });

  return { scene, camera, post, update, dispose: () => env.dispose() };
};

import React, { useCallback } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ThreeStage, WorldFactory } from "../../lib/ThreeStage";
import { PostPipeline } from "../../lib/post";
import { mulberry32 } from "../../lib/random";
import { loopFrame, loopPhase, loopTheta } from "../../lib/loop";
import { Capsules } from "../../lib/capsules";
import { corners, drawCircuit, makeCircuit } from "./circuit";

export interface CircuitPadlockProps {
  glass: string;
  board: string;
  trace: string;
  glow: string;
}

// ---------- layout (module level, seeded) ----------
const N = 160; // circuit cells across one board tile
const TILE = 9.6; // world units per tile → 0.06 per cell
const boardCircuit = makeCircuit(0xb0a2d002, N, 16000);
const lockCircuit = makeCircuit(0x10c4c002, 40, 260);

const cellToWorld = (p: [number, number]) => new THREE.Vector3(((p[0] + 0.5) / N - 0.5) * TILE, 0, ((p[1] + 0.5) / N - 0.5) * TILE);

// pulses that run along board traces near the lock (whole cycles per loop)
interface Pulse {
  pts: THREE.Vector3[];
  cum: number[];
  len: number;
  ph: number;
  cycles: number;
  size: number;
  bright: number;
}
const pulses: Pulse[] = (() => {
  const rnd = mulberry32(0x9a15e002);
  const out: Pulse[] = [];
  for (const t of boardCircuit.traces) {
    const pts = corners(t.pts).map(cellToWorld);
    const c = pts[0];
    // in front of / around the lock, where the camera looks
    if (c.z < -9 || c.z > 3.2 || c.x < -5 || c.x > 9) continue;
    if (t.pts.length < 7) continue;
    if (rnd() > 0.55) continue;
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
    out.push({ pts, cum, len: cum[cum.length - 1], ph: rnd(), cycles: 1 + Math.floor(rnd() * 3), size: 0.6 + rnd() * 0.8, bright: 0.6 + rnd() });
  }
  return out.slice(0, 110);
})();

// ~400 dashes flowing diagonally through the air at several depths
const DASHES = 400;
const FLOW = new THREE.Vector3(-1, -0.04, 0.42).normalize();
const FLOW_LEN = 34;
const dashes = (() => {
  const rnd = mulberry32(0xd45e5002);
  const out: { p0: THREE.Vector3; ph: number; cycles: number; len: number; rad: number; bright: number }[] = [];
  // dashes travel in short rows (like out-of-focus LED strips) or alone
  while (out.length < DASHES) {
    const depthBand = rnd();
    const p0 = new THREE.Vector3(-4 + rnd() * 24, 0.3 + Math.pow(rnd(), 0.7) * (1.0 + (1 - depthBand) * 4.5), -24 + depthBand * 21);
    const far = 1 - depthBand;
    const ph = rnd(), cycles = 1 + Math.floor(rnd() * 3);
    const n = rnd() < 0.45 ? 2 + Math.floor(rnd() * 4) : 1;
    const len = 0.12 + rnd() * 0.45;
    const rad = 0.025 + rnd() * 0.03 + far * 0.03;
    const bright = 0.6 + Math.pow(rnd(), 2) * 2.4 + far * 1.2;
    for (let k = 0; k < n && out.length < DASHES; k++) {
      out.push({ p0: p0.clone().addScaledVector(FLOW, -k * (len + 0.18)), ph, cycles, len, rad, bright });
    }
  }
  return out;
})();

const lockTexture = () => {
  const size = 1024;
  const cv = document.createElement("canvas");
  cv.width = size;
  cv.height = size;
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "rgb(20,20,20)";
  ctx.fillRect(0, 0, size, size);
  const rnd = mulberry32(0x7e47002);
  // a few darker "chip" blocks
  for (let i = 0; i < 14; i++) {
    ctx.fillStyle = `rgb(${30 + Math.floor(rnd() * 30)},${30 + Math.floor(rnd() * 30)},${30 + Math.floor(rnd() * 30)})`;
    ctx.fillRect(rnd() * size, rnd() * size, 40 + rnd() * 160, 30 + rnd() * 120);
  }
  // a hot spot glowing from inside, lower right of the face
  const hot = ctx.createRadialGradient(size * 0.72, size * 0.78, 0, size * 0.72, size * 0.78, size * 0.45);
  hot.addColorStop(0, "rgb(150,150,150)");
  hot.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = hot;
  ctx.fillRect(0, 0, size, size);
  const lines = drawCircuit(size, 40, lockCircuit, { line: 6, ring: 10, ringLine: 4.5, glow: 8 });
  ctx.globalCompositeOperation = "lighter";
  // use only the crisp red channel of the circuit drawing as white lines
  const tmp = lines.getContext("2d")!.getImageData(0, 0, size, size);
  for (let i = 0; i < tmp.data.length; i += 4) {
    const v = tmp.data[i];
    const gl = tmp.data[i + 2];
    const o = Math.min(255, v + gl * 0.35);
    tmp.data[i] = o;
    tmp.data[i + 1] = o;
    tmp.data[i + 2] = o;
  }
  const c2 = document.createElement("canvas");
  c2.width = size;
  c2.height = size;
  c2.getContext("2d")!.putImageData(tmp, 0, 0);
  ctx.drawImage(c2, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
};

const BOARD_VERT = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const BOARD_FRAG = /* glsl */ `
uniform sampler2D tCircuit;
uniform vec3 uBoard;
uniform vec3 uTrace;
uniform vec3 uGlow;
uniform float uTheta;
uniform vec3 uLockPos;
uniform float uOpacity;
varying vec2 vUv;
varying vec3 vWorld;
// software anisotropic filtering (works the same on every GPU / SwiftShader):
// taps along the long axis of the pixel footprint, each at the short axis' LOD
vec4 sampleAniso(sampler2D t, vec2 uv) {
  vec2 dx = dFdx(uv), dy = dFdy(uv);
  float lx = length(dx), ly = length(dy);
  vec2 major = lx > ly ? dx : dy;
  vec2 minor = lx > ly ? dy : dx;
  float ratio = clamp(length(major) / max(length(minor), 1e-8), 1.0, 16.0);
  int n = int(ceil(ratio));
  vec4 acc = vec4(0.0);
  for (int i = 0; i < 16; i++) {
    if (i >= n) break;
    float f = (float(i) + 0.5) / float(n) - 0.5;
    acc += textureGrad(t, uv + major * f, minor, minor);
  }
  return acc / float(n);
}
void main() {
  vec4 t = sampleAniso(tCircuit, vUv);
  float id = t.r > 0.02 ? clamp(t.g / t.r, 0.0, 1.0) : 0.0;
  float cyc = 1.0 + floor(id * 3.0);                 // 1..3 cycles per loop
  float pulse = 0.5 + 0.5 * sin(uTheta * cyc + id * 40.0);
  float traceI = t.r * (0.55 + 0.9 * pulse * pulse);
  vec3 col = uBoard * 1.8;
  col += uTrace * traceI * 1.6;
  col += uGlow * t.b * 0.22 * (0.6 + 0.4 * pulse);
  // light pool / reflection haze under the lock
  vec2 dl = vWorld.xz - uLockPos.xz;
  float pool = exp(-dot(dl * vec2(0.9, 1.6), dl * vec2(0.9, 1.6)));
  col += uGlow * pool * 0.25;
  col *= 1.0 + pool * 1.5 * t.r;
  // distance fade into the dark
  float dist = length(vWorld.xz - vec2(0.0, -2.0));
  col *= mix(1.0, 0.6, smoothstep(6.0, 30.0, dist));
  col += uGlow * 0.05 * smoothstep(5.0, 25.0, dist);
  gl_FragColor = vec4(col, uOpacity);
}
`;

const makeEnv = (renderer: THREE.WebGLRenderer, glow: THREE.Color) => {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x02080a);
  const panel = (w: number, h: number, pos: [number, number, number], i: number) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: glow.clone().multiplyScalar(i), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel(6, 2, [0, -3, 2], 1.2);
  panel(3, 3, [-4, 2, 3], 2.5);
  panel(8, 1, [4, 1, -4], 1.5);
  panel(2, 6, [5, 0, 3], 0.8);
  const white = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
  white.position.set(-3, 4, 2);
  white.lookAt(0, 0, 0);
  env.add(white);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(env, 0.02);
  pm.dispose();
  return rt;
};

const createWorld = (props: CircuitPadlockProps): WorldFactory => (renderer, w, h) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02161c);
  const glass = new THREE.Color(props.glass);
  const glow = new THREE.Color(props.glow);
  const envRT = makeEnv(renderer, glow);
  scene.environment = envRT.texture;

  const camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 80);

  // ---- board ----
  const boardCanvas = drawCircuit(4096, N, boardCircuit, { line: 3.4, ring: 7.5, ringLine: 2.8, glow: 9 });
  const boardTex = new THREE.CanvasTexture(boardCanvas);
  boardTex.colorSpace = THREE.NoColorSpace;
  boardTex.wrapS = boardTex.wrapT = THREE.RepeatWrapping;
  boardTex.repeat.set(3, 3);
  boardTex.offset.set(0.5, 0.5);
  boardTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  boardTex.generateMipmaps = true;
  boardTex.minFilter = THREE.LinearMipmapLinearFilter;
  renderer.initTexture(boardTex);
  const boardMat = new THREE.ShaderMaterial({
    vertexShader: BOARD_VERT,
    fragmentShader: BOARD_FRAG,
    uniforms: {
      tCircuit: { value: boardTex },
      uBoard: { value: new THREE.Color(props.board) },
      uTrace: { value: new THREE.Color(props.trace) },
      uGlow: { value: glow },
      uTheta: { value: 0 },
      uLockPos: { value: new THREE.Vector3(0, 0, 0) },
      uOpacity: { value: 0.62 },
    },
    // blended over the mirrored lock, but kept in the opaque list (renderOrder)
    // so the glass lock's transmission pass sees the board
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    transparent: false,
  });
  const board = new THREE.Mesh(new THREE.PlaneGeometry(TILE * 3, TILE * 3), boardMat);
  board.rotation.x = -Math.PI / 2;
  scene.add(board);

  // ---- padlock ----
  const lock = new THREE.Group();
  const lockTex = lockTexture();
  renderer.initTexture(lockTex);
  const bodyW = 1.0, bodyH = 0.86, bodyD = 0.36;
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x1478a0),
    metalness: 0,
    roughness: 0.12,
    transmission: 0.5,
    thickness: 0.35,
    ior: 1.45,
    attenuationColor: new THREE.Color(0x0a3a4c),
    attenuationDistance: 0.18,
    emissive: glass,
    emissiveMap: lockTex,
    emissiveIntensity: 0.38,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 0.5,
  });
  const rimColor = { value: glow.clone().multiplyScalar(0.7) };
  bodyMat.onBeforeCompile = (sh) => {
    sh.uniforms.uRim = rimColor;
    sh.fragmentShader = sh.fragmentShader
      .replace("void main() {", "uniform vec3 uRim;\nvoid main() {")
      .replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n  float frR = pow(1.0 - abs(dot(normal, normalize(vViewPosition))), 2.5);\n  totalEmissiveRadiance += uRim * frR;",
      );
  };
  const body = new THREE.Mesh(new RoundedBoxGeometry(bodyW, bodyH, bodyD, 4, 0.025), bodyMat);
  body.position.y = bodyH / 2;
  lock.add(body);

  // shackle: half torus + two legs, solid glowing cyan
  const shR = 0.29, shT = 0.085, legH = 0.17;
  const shMat = new THREE.MeshPhysicalMaterial({
    color: glass,
    roughness: 0.2,
    metalness: 0.65,
    emissive: glow,
    emissiveIntensity: 0.14,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
  });
  shMat.onBeforeCompile = bodyMat.onBeforeCompile;
  const arc = new THREE.Mesh(new THREE.TorusGeometry(shR, shT, 24, 64, Math.PI), shMat);
  arc.position.set(0, bodyH + legH, 0);
  lock.add(arc);
  for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(shT, shT, legH + 0.05, 24), shMat);
    leg.position.set(sx * shR, bodyH + legH / 2 - 0.02, 0);
    lock.add(leg);
  }
  // keyhole: circle + tapered slot, dark
  const kh = new THREE.Shape();
  kh.absarc(0, 0.05, 0.075, -Math.PI * 0.32, Math.PI * 1.32, false);
  kh.lineTo(-0.045, -0.2);
  kh.lineTo(0.045, -0.2);
  kh.closePath();
  const khMat = new THREE.MeshStandardMaterial({ color: 0x02121a, roughness: 0.5, emissive: 0x001820, emissiveIntensity: 1 });
  const keyhole = new THREE.Mesh(new THREE.ExtrudeGeometry(kh, { depth: 0.02, bevelEnabled: false, curveSegments: 24 }), khMat);
  keyhole.position.set(0, bodyH * 0.45, bodyD / 2 - 0.012);
  lock.add(keyhole);
  lock.position.set(0, 0, 0);
  scene.add(lock);

  // mirrored lock under the semi-transparent board = glossy reflection
  const mirror = new THREE.Group();
  const mirMat = new THREE.MeshBasicMaterial({ color: glass.clone().multiplyScalar(1.1), map: lockTex });
  const mirShMat = new THREE.MeshBasicMaterial({ color: glow.clone().multiplyScalar(0.9) });
  const mb = new THREE.Mesh(body.geometry, mirMat);
  mb.position.copy(body.position);
  mirror.add(mb);
  const ma = new THREE.Mesh(arc.geometry, mirShMat);
  ma.position.copy(arc.position);
  mirror.add(ma);
  mirror.scale.y = -1;
  mirror.traverse((o) => (o.renderOrder = -2));
  scene.add(mirror);

  // ---- lights ----
  const key = new THREE.PointLight(glow, 6, 8, 2);
  key.position.set(-1.2, 1.6, 1.8);
  scene.add(key);
  const back = new THREE.PointLight(glow, 10, 8, 2);
  back.position.set(1.0, 1.4, -1.2);
  scene.add(back);
  scene.add(new THREE.AmbientLight(glow, 0.15));
  // a cool key from the front-left models the lock's faces (side face darker)
  const front = new THREE.DirectionalLight(0xbff4ff, 1.6);
  front.position.set(-3, 2.5, 3);
  scene.add(front);

  // ---- dashes + pulses ----
  const caps = new Capsules(DASHES + pulses.length, w, h);
  scene.add(caps.mesh);
  const dashCol = glow.clone();
  const pulseCol = glow.clone().lerp(new THREE.Color(1, 1, 1), 0.1);
  const vH = new THREE.Vector3(), vT = new THREE.Vector3();
  const along = (p: Pulse, s: number, out: THREE.Vector3) => {
    const d = Math.max(0, Math.min(p.len, s));
    let i = 1;
    while (i < p.cum.length - 1 && p.cum[i] < d) i++;
    const a = p.pts[i - 1], b = p.pts[i];
    const seg = p.cum[i] - p.cum[i - 1];
    return out.copy(a).lerp(b, seg > 0 ? (d - p.cum[i - 1]) / seg : 0);
  };

  const target = new THREE.Vector3(0, 0.55, 0);
  const post = new PostPipeline(w, h, {
    samples: 4,
    dof: { focus: 5.0, focusRange: 0.5, aperture: 0.024, maxCoc: 0.018 },
    bloom: { strength: 0.9, radius: 1.0, levels: 6 },
    final: { exposure: 1.15, tone: "neutral", grain: 0.015, vignette: 0.5, saturation: 1.12, gain: [0.88, 0.98, 1.12] },
  });

  return {
    update: (frame) => {
      const th = loopTheta(frame);
      const ph = loopPhase(frame);
      boardMat.uniforms.uTheta.value = th;
      // camera: ~20° above the board, slow closed ±8° orbit
      const az = (-24 + 8 * Math.sin(th)) * (Math.PI / 180);
      const el = 17 * (Math.PI / 180);
      const dist = 5.0;
      camera.position.set(target.x + Math.sin(az) * Math.cos(el) * dist, target.y + Math.sin(el) * dist, target.z + Math.cos(az) * Math.cos(el) * dist);
      camera.lookAt(target);
      // put the lock left of centre (projection shift)
      camera.setViewOffset(w, h, w * 0.2, -h * 0.02, w, h);
      camera.updateMatrixWorld();
      post.setFocus(camera.position.distanceTo(target));

      dashes.forEach((d, i) => {
        const s = (d.ph + d.cycles * ph) % 1;
        vH.copy(d.p0).addScaledVector(FLOW, (s - 0.5) * FLOW_LEN);
        vT.copy(vH).addScaledVector(FLOW, -d.len);
        const fade = Math.sin(Math.PI * s);
        caps.set(i, vH, vT, d.rad, d.bright * 3.2 * Math.min(1, fade * 3), dashCol);
      });
      pulses.forEach((p, k) => {
        const s = ((p.ph + p.cycles * ph) % 1) * (p.len + 1.0) - 0.5;
        along(p, s, vH);
        along(p, s - 0.35 * p.size, vT);
        vH.y = vT.y = 0.012;
        const fade = Math.sin(Math.PI * Math.max(0, Math.min(1, (s + 0.5) / (p.len + 1.0))));
        caps.set(DASHES + k, vH, vT, 0.018, p.bright * 4.0 * fade, pulseCol);
      });
      caps.commit();
    },
    render: (r, lf) => {
      void loopFrame;
      post.render(r, scene, camera, lf);
    },
    dispose: () => {
      post.dispose();
      caps.dispose();
      boardTex.dispose();
      lockTex.dispose();
      envRT.dispose();
    },
  };
};

export const CircuitPadlock: React.FC<CircuitPadlockProps> = (props) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const factory = useCallback(createWorld(props), [JSON.stringify(props)]);
  return <ThreeStage factory={factory} />;
};

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { LookFactory } from '../../lib/ThreeStage';
import { CpuVersion } from '../../versions';
import { Rng } from '../../lib/rng';
import { hexToLinear, mod, TAU } from '../../lib/math';
import { displayToScene } from '../../lib/tone';
import { buildTraceGeometry, DIRS, GrowOpts, Occupancy, PathSampler, polyLength, Router, V2 } from '../../lib/pcb';
import { makeTraceMaterial, SpriteField } from '../../lib/sprites';

export const CPU_FRAMES = 600;

const S = 0.11; // track spacing
const HALF = 30; // board half-size (routed area)
const CHIP = 3.4; // substrate size
const EXPOSURE = 1.0;
const FOG_NEAR = 22;
const FOG_FAR = 60;

type Smd = { x: number; y: number; w: number; h: number; rot: number; tall: number; kind: number };

const routeBoard = (seed: number) => {
  const rng = new Rng(seed);
  const occ = new Occupancy(-HALF, -HALF, HALF * 2, HALF * 2, S / 4, false);
  const router = new Router(occ, rng);
  // the chip footprint is taken
  for (let y = -CHIP / 2; y <= CHIP / 2 + 1e-6; y += S * 0.25) occ.markSeg([-CHIP / 2, y], [CHIP / 2, y], 0.05, -2);
  const outward = (d: number, at: V2) => {
    const l = Math.hypot(at[0], at[1]) || 1;
    const dot = (DIRS[d][0] * at[0] + DIRS[d][1] * at[1]) / l;
    return Math.pow(Math.max(0.04, 0.5 + 0.5 * dot), 2);
  };
  const opts: GrowOpts = {
    spacing: S,
    minRun: 2,
    maxRun: 12,
    turnProb: 0.55,
    splitProb: 0.2,
    peelProb: 0.06,
    maxSegments: 26,
    dirWeight: (d, _from, at) => outward(d, at),
    traceWidth: () => S * rng.range(0.24, 0.32),
    bright: () => rng.range(0.35, 1.0),
    tone: () => rng.f(),
    endPad: () => (rng.chance(0.7) ? 1 : 2),
    padRadius: S * 0.42,
  };
  // 1) fan-out from the chip: bundles leaving every side
  const pinPitch = S;
  for (let side = 0; side < 4; side++) {
    const d = [0, 2, 4, 6][side];
    const n = DIRS[d];
    const t: V2 = [-n[1], n[0]];
    const groups = 4;
    const perGroup = Math.floor(CHIP / pinPitch / groups) - 1;
    for (let g = 0; g < groups; g++) {
      const along = (g + 0.5) / groups - 0.5;
      const c: V2 = [n[0] * (CHIP / 2 + 0.2) + t[0] * along * CHIP * 0.96, n[1] * (CHIP / 2 + 0.2) + t[1] * along * CHIP * 0.96];
      router.growBundle(c, d, perGroup, { ...opts, maxSegments: 40, turnProb: 0.35 }, 0);
    }
  }
  const nFan = router.traces.length;
  // 2) bundles grown from random points, biased outward
  for (let a = 0; a < 4200; a++) {
    const r = Math.sqrt(rng.f()) * HALF * 0.98;
    const ang = rng.range(0, TAU);
    const c: V2 = [Math.cos(ang) * r, Math.sin(ang) * r];
    if (Math.abs(c[0]) > HALF - 0.5 || Math.abs(c[1]) > HALF - 0.5) continue;
    let d = Math.round(Math.atan2(c[1], c[0]) / (Math.PI / 4));
    d = ((d % 8) + 8) % 8;
    if (rng.chance(0.35)) d = (d + rng.sign() + 8) % 8;
    const k = rng.chance(0.25) ? rng.int(1, 2) : rng.int(3, 9);
    router.growBundle(c, d, k, opts, rng.chance(0.8) ? 1 : 2);
  }
  router.prune(S * 3);
  // 3) SMD components in the gaps
  const smds: Smd[] = [];
  for (let a = 0; a < 12000 && smds.length < 380; a++) {
    const r = Math.sqrt(rng.f()) * HALF * 0.95;
    const ang = rng.range(0, TAU);
    const x = Math.cos(ang) * r;
    const y = Math.sin(ang) * r;
    const big = rng.chance(0.35);
    const w = big ? rng.range(0.8, 1.6) : rng.range(0.25, 0.5);
    const h = big ? rng.range(0.6, 1.1) : w * rng.range(0.4, 0.6);
    const rot = rng.chance(0.5) ? 0 : Math.PI / 2;
    const rr = Math.hypot(w, h) * 0.5 + S * 0.3;
    if (!occ.free(x, y, rr, -9)) continue;
    occ.mark(x, y, rr, -3);
    smds.push({ x, y, w, h, rot, tall: big ? rng.range(0.06, 0.1) : rng.range(0.05, 0.09), kind: big ? 1 : 0 });
  }
  return { traces: router.traces, nFan, smds };
};

const BOARD = routeBoard(4029846759);

// brightness: the fan-out and anything near the chip glows most
for (const [i, t] of BOARD.traces.entries()) {
  const p = t.pts[0];
  const r = Math.hypot(p[0], p[1]);
  const near = Math.exp(-Math.pow(r / 9, 2));
  t.bright = i < BOARD.nFan ? 1.0 : Math.min(1, t.bright * (0.6 + 0.6 * near));
}

type Particle = { path: PathSampler; s0: number; m: number; size: number; amp: number; tone: number; tw: number; ph: number };
const makeParticles = (seed: number) => {
  const rng = new Rng(seed);
  const out: Particle[] = [];
  for (const t of BOARD.traces) {
    const len = polyLength(t.pts);
    if (len < S * 4) continue;
    const sp = new PathSampler(t.pts);
    const density = 3 + 9 * t.bright; // per unit length
    const n = Math.max(1, Math.round(len * density * rng.range(0.6, 1.2)));
    const dirSign = rng.chance(0.55) ? 1 : -1; // mostly away from the chip
    for (let i = 0; i < n; i++) {
      const speed = rng.range(0.6, 1.6); // world units per second
      const m = Math.max(1, Math.round((speed * 20) / len)) * dirSign;
      out.push({
        path: sp,
        s0: rng.f(),
        m,
        size: rng.range(0.01, 0.022),
        amp: rng.range(2, 6) * (0.4 + 0.6 * t.bright),
        tone: rng.chance(0.04) ? 2 : rng.f(),
        tw: rng.int(3, 12),
        ph: rng.f(),
      });
    }
  }
  return out;
};
const PARTICLES = makeParticles(99);

const BOARD_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uBoard, uFar;
uniform float uFogNear, uFogFar;
in vec3 vWorld;
out vec4 outColor;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  float dist = length(vWorld - cameraPosition);
  float n = vnoise(vWorld.xz * 0.5) * 0.6 + vnoise(vWorld.xz * 2.1) * 0.4;
  float r = length(vWorld.xz);
  vec3 col = uBoard * (0.85 + 0.3 * n) * (1.0 + 0.6 * exp(-r * r / 30.0));
  col = mix(col, uFar, smoothstep(uFogNear, uFogFar * 1.3, dist));
  outColor = vec4(col, 1.0);
}`;

const WORLD_VERT = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const makeCpuFactory =
  (v: CpuVersion): LookFactory =>
  (assets, gl) => {
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(gl);
    // env map set per material (below) so each material's envMapIntensity applies
    const env = pm.fromEquirectangular(assets.hdri!).texture;
    pm.dispose();
    const camera = new THREE.PerspectiveCamera(36, 16 / 9, 0.1, 300);
    const boardCol = displayToScene(v.board, EXPOSURE);

    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(HALF * 2 + 40, HALF * 2 + 40, 160, 160),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: WORLD_VERT,
        fragmentShader: BOARD_FRAG,
        uniforms: {
          uBoard: { value: new THREE.Vector3(...boardCol) },
          uFar: { value: new THREE.Vector3(...boardCol).multiplyScalar(0.8) },
          uFogNear: { value: FOG_NEAR },
          uFogFar: { value: FOG_FAR },
        },
      }),
    );
    board.rotation.x = -Math.PI / 2;
    scene.add(board);

    // traces (2D y -> world -z)
    const traceGeo = buildTraceGeometry(BOARD.traces, { ring: S * 0.5, inner: 0.52, via: S * 0.28, viaInner: 0.42 }, 0.006);
    const traceMat = makeTraceMaterial({
      colA: new THREE.Vector3(...hexToLinear(v.trace)),
      colB: new THREE.Vector3(...hexToLinear(v.traceGlow)),
      gain: 1.6,
      fogNear: FOG_NEAR,
      fogFar: FOG_FAR * 1.4,
      center: new THREE.Vector2(0, 0),
      centerFalloff: 6,
      centerBoost: 1.6,
    });
    const traces = new THREE.Mesh(traceGeo, traceMat);
    traces.renderOrder = 5;
    scene.add(traces);

    // SMD components
    const smdBody = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...hexToLinear('#3a4670')), roughness: 0.4, metalness: 0.4, envMapIntensity: 0.18 });
    const smdCap = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...hexToLinear('#5a5550')), roughness: 0.6, metalness: 0.5, envMapIntensity: 0.08 });
    const box = new THREE.BoxGeometry(1, 1, 1);
    const bodies = new THREE.InstancedMesh(box, smdBody, BOARD.smds.length);
    const caps = new THREE.InstancedMesh(box, smdCap, BOARD.smds.length * 2);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    BOARD.smds.forEach((s, i) => {
      const capW = s.kind === 1 ? 0 : s.w * 0.18;
      e.set(0, s.rot, 0);
      q.setFromEuler(e);
      m4.compose(new THREE.Vector3(s.x, s.tall / 2, -s.y), q, new THREE.Vector3(s.w - capW * 2, s.tall, s.h));
      bodies.setMatrixAt(i, m4);
      for (let k = 0; k < 2; k++) {
        const off = (k ? 1 : -1) * (s.w / 2 - capW / 2);
        const ox = Math.cos(s.rot) * off;
        const oz = -Math.sin(s.rot) * off;
        m4.compose(new THREE.Vector3(s.x + ox, s.tall * 0.45, -s.y + oz), q, new THREE.Vector3(Math.max(capW, 1e-4), s.tall * 0.9, s.h * 0.96));
        caps.setMatrixAt(i * 2 + k, m4);
      }
    });
    scene.add(bodies, caps);

    // chip: layered substrate, silver heat spreader, pins, corner indicators
    const chip = new THREE.Group();
    const sub = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color().setRGB(...hexToLinear(v.substrate)),
      roughness: 0.5,
      metalness: 0.3,
      clearcoat: 0.15,
      clearcoatRoughness: 0.4,
      envMapIntensity: 0.05,
      emissive: new THREE.Color().setRGB(...hexToLinear(v.substrate)),
      emissiveIntensity: 0.4,
    });
    const sub2 = sub.clone();
    sub2.color.multiplyScalar(0.7);
    const dark = new THREE.MeshStandardMaterial({ color: 0x0c1022, roughness: 0.5, metalness: 0.3, envMapIntensity: 0.1 });
    // rough brushed lid with a faint cool self-glow so it reads as bright silver
    // from every angle of the sway (a mirror lid turned black when it caught a
    // dark part of the HDRI)
    const silver = new THREE.MeshPhysicalMaterial({
      color: 0xa8b4d8,
      metalness: 0.85,
      roughness: 0.55,
      envMapIntensity: 0.12,
      emissive: new THREE.Color(0x9aa6cc),
      emissiveIntensity: 0.55,
    });
    const layer = (w: number, h: number, y: number, mat: THREE.Material, r = 0.02) => {
      const g = new RoundedBoxGeometry(w, h, w, 2, r);
      const m = new THREE.Mesh(g, mat);
      m.position.y = y + h / 2;
      chip.add(m);
      return y + h;
    };
    let y = 0;
    y = layer(CHIP, 0.16, y, sub);
    y = layer(CHIP * 0.86, 0.12, y, sub2);
    y = layer(CHIP * 0.56, 0.2, y, dark, 0.015);
    layer(CHIP * 0.5, 0.05, y, silver, 0.015);
    // pins
    const pinMat = new THREE.MeshStandardMaterial({ color: 0x3a4152, metalness: 0.8, roughness: 0.5, envMapIntensity: 0.1 });
    const nPins = Math.floor(CHIP / 0.09);
    const pins = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), pinMat, nPins * 4);
    let pi = 0;
    for (let side = 0; side < 4; side++) {
      for (let k = 0; k < nPins; k++) {
        const a = (k + 0.5) / nPins - 0.5;
        const along = a * CHIP * 0.94;
        const out = CHIP / 2 + 0.08;
        const pos = [new THREE.Vector3(out, 0.02, along), new THREE.Vector3(-out, 0.02, along), new THREE.Vector3(along, 0.02, out), new THREE.Vector3(along, 0.02, -out)][side];
        const sc = side < 2 ? new THREE.Vector3(0.16, 0.03, 0.04) : new THREE.Vector3(0.04, 0.03, 0.16);
        m4.compose(pos, new THREE.Quaternion(), sc);
        pins.setMatrixAt(pi++, m4);
      }
    }
    pins.visible = false; // the reference shows no visible pin row
    chip.add(pins);
    const ind = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB(...hexToLinear(v.indicator)).multiplyScalar(14) });
    for (const [sx, sz] of [
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), ind);
      l.position.set(sx * CHIP * 0.46, 0.17, sz * CHIP * 0.46);
      chip.add(l);
    }
    scene.add(chip);

    const key = new THREE.DirectionalLight(0xc8d8ff, 0.4);
    key.position.set(-4, 8, 3);
    scene.add(key);

    // data particles
    const pink = new THREE.Vector3(...hexToLinear(v.dataAccent));
    const sprites = new SpriteField(PARTICLES.length, new THREE.Vector3(...hexToLinear(v.traceGlow)), new THREE.Vector3(...hexToLinear(v.data)), {
      fogNear: FOG_NEAR,
      fogFar: FOG_FAR * 1.4,
      minPx: 1.3,
      sharp: 4,
    });
    // tone 2 = accent colour: handled by a second field so the shader stays simple
    const accents = PARTICLES.filter((p) => p.tone === 2);
    const normal = PARTICLES.filter((p) => p.tone !== 2);
    const accentField = new SpriteField(accents.length, pink, pink, { fogNear: FOG_NEAR, fogFar: FOG_FAR * 1.4, minPx: 1.3, sharp: 4 });
    scene.add(sprites.mesh(), accentField.mesh());

    scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (m && m.isMeshStandardMaterial) m.envMap = env;
    });

    const tmp: V2 = [0, 0];
    const target = new THREE.Vector3(0, 0.15, 0);
    return {
      scene,
      camera,
      update: (frame, aspect, viewH) => {
        const t = frame / CPU_FRAMES;
        const write = (field: SpriteField, list: Particle[]) => {
          list.forEach((p, i) => {
            const u = mod(p.s0 + p.m * t, 1);
            p.path.at(u * p.path.length, tmp);
            const fade = Math.min(1, Math.min(u, 1 - u) * p.path.length * 2);
            const tw = 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(TAU * (p.tw * t + p.ph)), 2);
            field.set(i, tmp[0], 0.03, -tmp[1], p.size, p.amp * fade * tw, p.tone === 2 ? 0 : p.tone);
          });
          field.commit(viewH);
        };
        write(sprites, normal);
        write(accentField, accents);

        // closed sway orbit (+/-25 deg) with a gentle push in, low angle
        const az = THREE.MathUtils.degToRad(20 + 25 * Math.sin(TAU * t));
        const el = THREE.MathUtils.degToRad(28 + 2 * Math.sin(TAU * t * 2));
        const R = 20 - 1.8 * (0.5 - 0.5 * Math.cos(TAU * t));
        camera.position.set(R * Math.sin(az) * Math.cos(el), R * Math.sin(el), R * Math.cos(az) * Math.cos(el));
        camera.lookAt(target);
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
      },
      post: () => {
        const d = camera.position.distanceTo(target);
        return {
          loopFrames: CPU_FRAMES,
          exposure: EXPOSURE,
          bloomStrength: 0.5,
          bloomRadius: 0.7,
          bloomThreshold: 0.45,
          bloomKnee: 0.4,
          dof: { enabled: true, focusDistance: d, farBlur: 0.009, nearBlur: 0.012, nearScale: 1.0, sharpZone: 0.12 },
          grain: 0.02,
          vignette: 0.55,
        };
      },
    };
  };

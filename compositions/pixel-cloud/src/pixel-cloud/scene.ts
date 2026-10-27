import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { Stage, StageFactory } from "../three/ThreeStage";
import { createRandom, Random, smoothstep } from "../three/random";
import { CLOUD_BOUNDS, cloudSdf } from "./cloud-shape";
import { DofPass } from "./DofPass";
import { DITHER, SIMPLEX_3D } from "./glsl";

export type CameraMode = "locked" | "orbit";

const TILE_PITCH = 0.19;
const BOARD_TILT_X = -0.42; // top of the board leans away from camera
const BOARD_YAW = 0.58; // right side recedes
const CLOUD_LIFT = 0.28; // raised top layer gives the icon some thickness

/** Merged quad helper: every quad carries its own per-vertex attributes. */
class QuadBuilder {
  positions: number[] = [];
  uvs: number[] = [];
  attrs: Record<string, { size: number; data: number[] }> = {};
  indices: number[] = [];
  private count = 0;

  constructor(spec: Record<string, number>) {
    for (const [k, size] of Object.entries(spec)) {
      this.attrs[k] = { size, data: [] };
    }
  }

  /** corners: 4 xyz points in order bl, br, tr, tl */
  add(corners: number[][], values: Record<string, number[]>, uvs?: number[][]) {
    const base = this.count;
    const defUv = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    corners.forEach((c, i) => {
      this.positions.push(c[0], c[1], c[2]);
      const uv = (uvs ?? defUv)[i];
      this.uvs.push(uv[0], uv[1]);
      for (const [k, a] of Object.entries(this.attrs)) {
        const v = values[k];
        // values may be per-quad (size) or per-vertex (4*size)
        const off = v.length === a.size * 4 ? i * a.size : 0;
        for (let j = 0; j < a.size; j++) a.data.push(v[off + j]);
      }
    });
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.count += 4;
  }

  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(this.uvs, 2));
    for (const [k, a] of Object.entries(this.attrs)) {
      g.setAttribute(k, new THREE.Float32BufferAttribute(a.data, a.size));
    }
    g.setIndex(this.indices);
    g.computeBoundingSphere();
    return g;
  }
}

const rect = (cx: number, cy: number, w: number, h: number, z: number) => [
  [cx - w / 2, cy - h / 2, z],
  [cx + w / 2, cy - h / 2, z],
  [cx + w / 2, cy + h / 2, z],
  [cx - w / 2, cy + h / 2, z],
];

// ---------------------------------------------------------------- board ---
const makeBoard = () => {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      cTopLeft: { value: new THREE.Color("#0a2a63") },
      cMid: { value: new THREE.Color("#07224f") },
      cBottomRight: { value: new THREE.Color("#041127") },
      resolution: { value: new THREE.Vector2(3840, 2160) },
      uTime: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vBoard;
      void main() {
        vBoard = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 cTopLeft, cMid, cBottomRight;
      uniform vec2 resolution;
      varying vec2 vBoard;
      ${DITHER}
      float gridLine(vec2 p, float spacing, float width) {
        vec2 g = abs(fract(p / spacing - 0.5) - 0.5) * spacing;
        vec2 aa = fwidth(p) * 1.2;
        vec2 l = 1.0 - smoothstep(vec2(width) - aa, vec2(width) + aa, g);
        return max(l.x, l.y);
      }
      void main() {
        vec2 s = gl_FragCoord.xy / resolution;
        // screen-space grade: lighter upper-left, deep navy lower-right
        float k = clamp((1.0 - s.x) * 0.55 + s.y * 0.6 - 0.1, 0.0, 1.0);
        vec3 col = mix(cBottomRight, cMid, smoothstep(0.0, 0.6, k));
        col = mix(col, cTopLeft, smoothstep(0.55, 1.1, k));
        // faint large-scale board grid
        float g = gridLine(vBoard, 2.4, 0.006);
        col += vec3(0.02, 0.06, 0.14) * g * 0.4;
        col += dither(gl_FragCoord.xy) / 255.0;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(220, 220), mat);
};

// ---------------------------------------------------------------- tiles ---
const makeTiles = (rng: Random, z: number, layerGain: number, sizeScale: number) => {
  const qb = new QuadBuilder({ aCell: 2, aRand: 2, aEdge: 1 });
  const { minX, maxX, minY, maxY } = CLOUD_BOUNDS;
  const half = (TILE_PITCH * 0.8 * sizeScale) / 2;
  for (let y = minY; y <= maxY; y += TILE_PITCH) {
    for (let x = minX; x <= maxX; x += TILE_PITCH) {
      const d = cloudSdf(x, y);
      if (d > -TILE_PITCH * 0.25) continue;
      const edge = smoothstep(0, 0.35, -d);
      qb.add(rect(x, y, half * 2, half * 2, z), {
        aCell: [x, y],
        aRand: [rng.next(), rng.next()],
        aEdge: [edge],
      });
    }
  }
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uGain: { value: layerGain },
      cDim: { value: new THREE.Color("#0d2f8a") },
      cMid: { value: new THREE.Color("#3d93ff") },
      cHot: { value: new THREE.Color("#a8ecff") },
      bounds: { value: new THREE.Vector4(minX, maxX, minY, maxY) },
    },
    vertexShader: /* glsl */ `
      attribute vec2 aCell;
      attribute vec2 aRand;
      attribute float aEdge;
      uniform float uTime;
      uniform vec4 bounds;
      varying vec2 vUv;
      varying float vI;
      ${SIMPLEX_3D}
      void main() {
        vUv = uv;
        vec2 c = aCell;
        float n1 = snoise(vec3(c * 0.42 + vec2(uTime * 0.11, -uTime * 0.05), uTime * 0.16));
        float n2 = snoise(vec3(c * 1.05 + 11.0, uTime * 0.33));
        float blob = smoothstep(-0.15, 0.85, n1 * 0.75 + n2 * 0.45);
        float lr = (c.x - bounds.x) / (bounds.y - bounds.x);
        float bias = mix(1.25, 0.8, lr);
        float flick = 0.86 + 0.14 * sin(uTime * (1.2 + aRand.x * 2.4) + aRand.y * 6.2831);
        float rim = mix(0.75, 1.0, aEdge);
        vI = (0.4 + blob * 0.8) * bias * flick * rim;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 cDim, cMid, cHot;
      uniform float uGain;
      varying vec2 vUv;
      varying float vI;
      void main() {
        vec2 q = abs(vUv - 0.5) * 2.0;
        float r = 0.32;
        float d = length(max(q - (1.0 - r), 0.0)) - r;
        float a = 1.0 - smoothstep(-0.12, 0.06, d);
        vec3 col = mix(cDim, cMid, smoothstep(0.1, 0.65, vI));
        col = mix(col, cHot, smoothstep(0.7, 1.25, vI));
        gl_FragColor = vec4(col * vI * uGain * a, a);
      }
    `,
  });
  return new THREE.Mesh(qb.build(), mat);
};

// --------------------------------------------------------------- traces ---
type TraceSeed = {
  pts: [number, number][];
  t0: number;
  speed: number;
  hold: number;
  bright: number;
  width: number;
};

const DIRS: [number, number][] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
  [Math.SQRT1_2, Math.SQRT1_2],
  [Math.SQRT1_2, -Math.SQRT1_2],
  [-Math.SQRT1_2, Math.SQRT1_2],
  [-Math.SQRT1_2, -Math.SQRT1_2],
];

const makeTraceSeeds = (rng: Random, count: number, duration: number) => {
  const seeds: TraceSeed[] = [];
  for (let i = 0; i < count; i++) {
    let x = rng.range(-14, 18);
    let y = rng.range(-9, 13);
    // keep most traces off the cloud so the icon reads clearly
    if (cloudSdf(x, y) < 0.6 && rng.chance(0.8)) {
      x += 7;
    }
    const pts: [number, number][] = [[x, y]];
    let dir = rng.int(0, 3);
    const segs = rng.int(2, 5);
    for (let s = 0; s < segs; s++) {
      const len = dir < 4 ? rng.range(1.2, 6) : rng.range(0.25, 0.9);
      const [dx, dy] = DIRS[dir];
      x += dx * len;
      y += dy * len;
      pts.push([x, y]);
      // PCB-style: alternate between orthogonal runs and 45-degree jogs
      dir = dir < 4 ? rng.int(4, 7) : rng.int(0, 3);
    }
    const early = rng.chance(0.45);
    const base = {
      pts,
      t0: early ? rng.range(0.35, 2.0) : rng.range(1.5, duration - 2),
      speed: rng.range(3.5, 9),
      hold: early ? 60 : rng.range(2.5, 6),
      bright: rng.chance(0.15) ? rng.range(0.9, 1.4) : rng.range(0.25, 0.7),
      width: rng.chance(0.12) ? 0.022 : rng.range(0.008, 0.014),
    };
    seeds.push(base);
    // parallel bus lines, offset perpendicular to the first run
    if (rng.chance(0.3)) {
      const n = rng.int(1, 3);
      const [dx, dy] = DIRS[0 + (Math.abs(pts[1][0] - pts[0][0]) > Math.abs(pts[1][1] - pts[0][1]) ? 1 : 0)];
      for (let k = 1; k <= n; k++) {
        const off = k * 0.16;
        seeds.push({
          ...base,
          pts: pts.map(([px, py]) => [px + dx * off, py + dy * off] as [number, number]),
          t0: base.t0 + k * 0.08,
        });
      }
    }
  }
  return seeds;
};

const makeTraces = (seeds: TraceSeed[]) => {
  const qb = new QuadBuilder({ aS: 1, aAcross: 1, aInfo: 4, aLen: 1 });
  for (const tr of seeds) {
    let total = 0;
    for (let i = 1; i < tr.pts.length; i++) {
      const [x0, y0] = tr.pts[i - 1];
      const [x1, y1] = tr.pts[i];
      total += Math.hypot(x1 - x0, y1 - y0);
    }
    let s = 0;
    for (let i = 1; i < tr.pts.length; i++) {
      const [x0, y0] = tr.pts[i - 1];
      const [x1, y1] = tr.pts[i];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const tx = (x1 - x0) / len;
      const ty = (y1 - y0) / len;
      const nx = -ty * tr.width;
      const ny = tx * tr.width;
      // extend a hair past the joints to close miter gaps
      const ex = tx * tr.width;
      const ey = ty * tr.width;
      const z = 0.012;
      qb.add(
        [
          [x0 - ex - nx, y0 - ey - ny, z],
          [x1 + ex - nx, y1 + ey - ny, z],
          [x1 + ex + nx, y1 + ey + ny, z],
          [x0 - ex + nx, y0 - ey + ny, z],
        ],
        {
          aS: [s, s + len, s + len, s],
          aAcross: [-1, -1, 1, 1],
          aInfo: [tr.t0, tr.speed, tr.hold, tr.bright],
          aLen: [total],
        },
      );
      s += len;
    }
  }
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      cLine: { value: new THREE.Color("#1f73e0") },
      cHead: { value: new THREE.Color("#9fe9ff") },
    },
    vertexShader: /* glsl */ `
      attribute float aS;
      attribute float aAcross;
      attribute vec4 aInfo;
      attribute float aLen;
      varying float vS;
      varying float vAcross;
      varying vec4 vInfo;
      varying float vLen;
      void main() {
        vS = aS; vAcross = aAcross; vInfo = aInfo; vLen = aLen;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 cLine, cHead;
      varying float vS;
      varying float vAcross;
      varying vec4 vInfo;
      varying float vLen;
      void main() {
        float t = uTime - vInfo.x;
        if (t <= 0.0) discard;
        float drawn = t * vInfo.y;
        if (vS > drawn) discard;
        float drawTime = vLen / vInfo.y;
        float life = 1.0 - smoothstep(drawTime + vInfo.z, drawTime + vInfo.z + 1.2, t);
        // bright head running along the trace while it is being drawn
        float head = exp(-pow((drawn - vS) * 2.2, 2.0)) * (1.0 - smoothstep(drawTime, drawTime + 0.4, t));
        float across = 1.0 - smoothstep(0.35, 1.0, abs(vAcross));
        vec3 col = cLine * vInfo.w + cHead * head * 0.9;
        gl_FragColor = vec4(col * across * life, 1.0);
      }
    `,
  });
  return new THREE.Mesh(qb.build(), mat);
};

// --------------------------------------------------------------- labels ---
const makeLabels = (rng: Random, count: number, duration: number) => {
  const qb = new QuadBuilder({ aInfo: 4 });
  for (let i = 0; i < count; i++) {
    let x = rng.range(-12, 16);
    const y = rng.range(-8, 12);
    if (cloudSdf(x, y) < 0.4) x += 7.5;
    const t0 = i < count * 0.35 ? rng.range(0.5, 1.6) : rng.range(1.0, duration - 1.5);
    const blink = rng.chance(0.35) ? rng.range(0.6, 1.6) : 0;
    const info = [t0, blink, rng.range(0, 6.28), rng.range(0.55, 1.0)];
    const kind = rng.next();
    const h = 0.034;
    if (kind < 0.45) {
      qb.add(rect(x, y, rng.range(0.1, 0.2), h, 0.014), { aInfo: info });
    } else if (kind < 0.75) {
      // "▪ ▪ ▪" dotted cluster
      const n = rng.int(2, 4);
      for (let k = 0; k < n; k++) qb.add(rect(x + k * 0.07, y, 0.04, h, 0.014), { aInfo: info });
    } else {
      // long + short dash pair
      qb.add(rect(x, y, 0.16, h, 0.014), { aInfo: info });
      qb.add(rect(x + 0.14, y, 0.05, h, 0.014), { aInfo: info });
    }
  }
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, cLabel: { value: new THREE.Color("#e6f2ff") } },
    vertexShader: /* glsl */ `
      attribute vec4 aInfo;
      varying vec4 vInfo;
      varying vec2 vUv;
      void main() {
        vInfo = aInfo; vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 cLabel;
      varying vec4 vInfo;
      varying vec2 vUv;
      void main() {
        float on = smoothstep(vInfo.x, vInfo.x + 0.35, uTime);
        if (vInfo.y > 0.0) {
          // smooth pulse instead of hard on/off to avoid strobing
          on *= 0.45 + 0.55 * smoothstep(-0.4, 0.4, sin(uTime * vInfo.y * 3.14159 + vInfo.z));
        }
        vec2 q = abs(vUv - 0.5) * 2.0;
        float a = (1.0 - smoothstep(0.75, 1.0, q.x)) * (1.0 - smoothstep(0.6, 1.0, q.y));
        gl_FragColor = vec4(cLabel * on * vInfo.w * a, 1.0);
      }
    `,
  });
  return new THREE.Mesh(qb.build(), mat);
};

// ------------------------------------------------------------ particles ---
const makeParticles = (rng: Random, count: number) => {
  const qb = new QuadBuilder({ aInfo: 4 });
  for (let i = 0; i < count; i++) {
    const x = rng.range(2, 18);
    const y = rng.range(1, 14);
    const z = rng.range(0.2, 2.2);
    const s = rng.range(0.04, 0.09);
    qb.add(rect(x, y, s, s, z), {
      aInfo: [rng.range(0.3, 3), rng.range(0.2, 0.6), rng.range(0, 6.28), rng.range(0.3, 0.8)],
    });
  }
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, cDot: { value: new THREE.Color("#cfe4ff") } },
    vertexShader: /* glsl */ `
      attribute vec4 aInfo;
      uniform float uTime;
      varying vec4 vInfo;
      varying vec2 vUv;
      void main() {
        vInfo = aInfo; vUv = uv;
        vec3 p = position;
        p.y += sin(uTime * aInfo.y + aInfo.z) * 0.15;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 cDot;
      varying vec4 vInfo;
      varying vec2 vUv;
      void main() {
        float on = smoothstep(vInfo.x, vInfo.x + 0.8, uTime);
        float d = length(vUv - 0.5) * 2.0;
        float a = 1.0 - smoothstep(0.6, 1.0, d);
        gl_FragColor = vec4(cDot * a * on * vInfo.w, 1.0);
      }
    `,
  });
  return new THREE.Mesh(qb.build(), mat);
};

// ---------------------------------------------------------------- stage ---
export const createPixelCloudStage =
  (mode: CameraMode): StageFactory =>
  (renderer, { width, height, fps }) => {
    const rng = createRandom(1207);
    const duration = 12;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, width / height, 0.5, 200);

    const board = new THREE.Group();
    board.rotation.order = "YXZ";
    board.rotation.set(BOARD_TILT_X, BOARD_YAW, 0.0);
    scene.add(board);

    const boardMesh = makeBoard();
    (boardMesh.material as THREE.ShaderMaterial).uniforms.resolution.value.set(width, height);
    board.add(boardMesh);

    const tilesBase = makeTiles(rng, 0.01, 0.45, 1.0);
    const tilesTop = makeTiles(rng, CLOUD_LIFT, 1.0, 1.0);
    board.add(tilesBase, tilesTop);
    const traces = makeTraces(makeTraceSeeds(rng, 120, duration));
    board.add(traces);
    const labels = makeLabels(rng, 170, duration);
    board.add(labels);
    const particles = makeParticles(rng, 70);
    board.add(particles);

    const timed = [tilesBase, tilesTop, traces, labels, particles].map(
      (m) => (m.material as THREE.ShaderMaterial).uniforms.uTime,
    );

    // Post-processing chain with a depth texture for the DOF pass.
    // No MSAA here: the 4K buffer is already supersampled by the 1080p downscale.
    const rt = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
    });
    rt.depthTexture = new THREE.DepthTexture(width, height);
    const composer = new EffectComposer(renderer, rt);
    composer.setPixelRatio(1);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    const dof = new DofPass(camera, width, height);
    composer.addPass(dof);
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.6, 0.55, 0.28));
    composer.addPass(new OutputPass());

    const cloudCenter = new THREE.Vector3(0.2, 0.1, CLOUD_LIFT);
    const target = new THREE.Vector3();
    const tmp = new THREE.Vector3();

    const placeCamera = (t: number) => {
      board.updateMatrixWorld(true);
      const center = cloudCenter.clone().applyMatrix4(board.matrixWorld);
      if (mode === "locked") {
        // Locked-off shot as in the reference: cloud sits left of frame centre.
        camera.position.set(center.x + 1.55, center.y + 0.1, center.z + 13.6);
        target.set(center.x + 1.55, center.y + 0.1, center.z);
      } else {
        // Alternative: a slow orbiting dolly that arcs around the icon and
        // pushes in, revealing the tilted circuit board in parallax.
        const p = t / duration;
        const e = p * p * (3 - 2 * p);
        const az = THREE.MathUtils.lerp(1.05, -0.12, e);
        const el = THREE.MathUtils.lerp(0.32, 0.04, e);
        const dist = THREE.MathUtils.lerp(15.5, 11.8, e);
        tmp.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
        camera.position.copy(center).addScaledVector(tmp, dist);
        const lead = THREE.MathUtils.lerp(-0.9, 1.2, e);
        target.set(center.x + lead, center.y + 0.1, center.z);
      }
      camera.lookAt(target);
      camera.updateMatrixWorld();
      // focus on the cloud
      dof.focus = tmp.copy(center).applyMatrix4(camera.matrixWorldInverse).z * -1;
    };

    const render = (frame: number) => {
      const t = frame / fps;
      for (const u of timed) u.value = t;
      placeCamera(t);
      composer.render();
    };

    const stage: Stage = {
      render,
      dispose: () => {
        composer.dispose();
        dof.dispose();
        rt.dispose();
        scene.traverse((o) => {
          const m = o as THREE.Mesh;
          m.geometry?.dispose();
          (m.material as THREE.Material | undefined)?.dispose?.();
        });
      },
    };
    return stage;
  };

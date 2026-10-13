import * as THREE from "three";
import { HASH } from "../engine/glsl";
import type { Look, LookFactory } from "../engine/LoopCanvas";
import { TAU, cyc } from "../engine/loop";
import { shaderMat } from "../engine/material";
import { Post } from "../engine/post";
import { mulberry32, range } from "../engine/rng";

export interface IsoCloudChipParams {
  boardA: string; // board gradient start (blue)
  boardB: string; // board gradient end (violet)
  cyan: string;
  screen: string; // device screen tint
  body: string; // dark package / device bodies
}

// World: board is the y = 0 plane, chip centred at the origin.
// On screen, +z runs toward the lower left, -x toward the upper left.
const CHIP = 4.0;
const CHIP_H = 0.55;

// ---------------------------------------------------------------------------
// Seeded layout (module level).
// ---------------------------------------------------------------------------
const rng = mulberry32(0x150c1ad);

interface Dash { lane: number; x: number; z: number; len: number; k: number; phase: number; dir: 0 | 1; bright: number }
const DASHES: Dash[] = [];
for (let i = 0; i < 600; i++) {
  // Dashes stream toward the chip: along -z (from the lower left) or +x (from the upper left).
  const dir: 0 | 1 = rng() < 0.62 ? 0 : 1;
  DASHES.push({
    lane: i,
    x: range(rng, -15, 15),
    z: range(rng, -15, 15),
    len: range(rng, 0.25, 0.7),
    k: 1 + Math.floor(rng() * 3),
    phase: rng(),
    dir,
    bright: 0.15 + 1.25 * rng() * rng(),
  });
}

interface Dot { x: number; z: number; r: number; k: number; phase: number }
const DOTS: Dot[] = [];
{
  // A field of round dots on a hex lattice, mostly toward the back right.
  const s = 0.42;
  for (let j = -30; j < 30; j++) {
    for (let i = -30; i < 30; i++) {
      const x = i * s + (j % 2) * s * 0.5;
      const z = j * s * 0.866;
      // Screen-right-and-up corresponds to -z / +x... keep a band behind the chip.
      const u = -z * 0.7 + x * 0.3;
      if (u < 3.5 || u > 11 || Math.abs(x + z) > 12) continue;
      if (rng() < 0.55) continue;
      DOTS.push({ x, z, r: range(rng, 0.035, 0.07), k: rng() < 0.5 ? 1 + Math.floor(rng() * 3) : 0, phase: rng() });
    }
  }
  // Scattered dots elsewhere.
  for (let i = 0; i < 140; i++) DOTS.push({ x: range(rng, -12, 12), z: range(rng, -12, 12), r: range(rng, 0.03, 0.06), k: 1 + Math.floor(rng() * 2), phase: rng() });
}

// Circuit pattern on the chip's glass top: seeded traces drawn once to a canvas.
interface Trace { pts: [number, number][]; w: number }
const TRACES: Trace[] = [];
const PADS: [number, number, number][] = [];
for (let i = 0; i < 90; i++) {
  let x = rng();
  let y = rng();
  const pts: [number, number][] = [[x, y]];
  const n = 2 + Math.floor(rng() * 4);
  for (let k = 0; k < n; k++) {
    const d = range(rng, 0.04, 0.2);
    if (rng() < 0.5) x = Math.min(1, Math.max(0, x + (rng() < 0.5 ? -d : d)));
    else y = Math.min(1, Math.max(0, y + (rng() < 0.5 ? -d : d)));
    pts.push([x, y]);
  }
  TRACES.push({ pts, w: range(rng, 1.5, 4) });
  PADS.push([x, y, range(rng, 3, 7)]);
}
const CODE_ROWS: number[][] = [];
for (let r = 0; r < 26; r++) {
  const row: number[] = [];
  let x = 0;
  while (x < 1) {
    const w = range(rng, 0.03, 0.18);
    row.push(x, Math.min(1, x + w));
    x += w + range(rng, 0.02, 0.08);
  }
  CODE_ROWS.push(row);
}

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------
const makeCircuitTexture = () => {
  const S = 1024;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  g.strokeStyle = "#fff";
  g.lineCap = "round";
  g.lineJoin = "round";
  for (const t of TRACES) {
    g.globalAlpha = 0.55;
    g.lineWidth = t.w;
    g.beginPath();
    t.pts.forEach(([x, y], i) => (i ? g.lineTo(x * S, y * S) : g.moveTo(x * S, y * S)));
    g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = "#fff";
  for (const [x, y, r] of PADS) {
    g.beginPath();
    g.arc(x * S, y * S, r, 0, TAU);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  return tex;
};

const makeCodeTexture = () => {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = S;
  c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, S, S);
  CODE_ROWS.forEach((row, r) => {
    g.fillStyle = r % 5 === 0 ? "#fff" : "#9a9a9a";
    for (let i = 0; i < row.length; i += 2) g.fillRect(row[i] * S * 0.86 + S * 0.07, (r + 0.6) * (S / 27), (row[i + 1] - row[i]) * S * 0.86, S / 60);
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
};

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------
const chamferShape = (s: number, c: number) => {
  const h = s / 2;
  const sh = new THREE.Shape();
  sh.moveTo(-h + c, -h);
  sh.lineTo(h - c, -h);
  sh.lineTo(h, -h + c);
  sh.lineTo(h, h - c);
  sh.lineTo(h - c, h);
  sh.lineTo(-h + c, h);
  sh.lineTo(-h, h - c);
  sh.lineTo(-h, -h + c);
  sh.closePath();
  return sh;
};

/** Extrude a 2D shape in the xz plane upward to height h (base at y = 0). */
const slab = (shape: THREE.Shape, h: number, bevel = 0.04) => {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: h - bevel * 2,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 24,
  });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
};

const cloudShape = (w: number) => {
  // A classic three-bump cloud with a flat base, width w, centred on x.
  const s = new THREE.Shape();
  const u = w / 2.2;
  s.moveTo(-1.0 * u, -0.38 * u);
  s.lineTo(1.0 * u, -0.38 * u);
  s.absarc(1.0 * u, 0.0 * u, 0.38 * u, -Math.PI / 2, Math.PI * 0.62, false);
  s.absarc(0.28 * u, 0.32 * u, 0.62 * u, Math.PI * 0.08, Math.PI * 0.86, false);
  s.absarc(-0.62 * u, 0.12 * u, 0.48 * u, Math.PI * 0.32, Math.PI * 1.5, false);
  s.lineTo(-1.0 * u, -0.38 * u);
  return s;
};

// ---------------------------------------------------------------------------
// Shaders
// ---------------------------------------------------------------------------
const SOLID_VERT = /* glsl */ `
out vec3 vN;
out vec3 vW;
out vec3 vL;
void main() {
  vL = position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

/** Dark bodies: violet-tinted ambient, a soft key from the upper left, cyan rim. */
const SOLID_FRAG = /* glsl */ `
precision highp float;
in vec3 vN;
in vec3 vW;
in vec3 vL;
uniform vec3 uBody;
uniform vec3 uRim;
uniform vec3 uAmbient;
uniform vec3 uViewDir;
uniform float uEdgeGlow; // glow toward the base of side faces
void main() {
  vec3 N = normalize(vN);
  vec3 L = normalize(vec3(-0.6, 1.0, -0.2));
  float diff = max(dot(N, L), 0.0);
  float side = 1.0 - abs(N.y);
  vec3 col = uBody * (0.35 + 0.9 * diff) + uAmbient * 0.12 * (0.5 + 0.5 * N.y);
  float rim = pow(clamp(1.0 - abs(dot(N, -uViewDir)), 0.0, 1.0), 3.0);
  col += uRim * rim * 0.08;
  col += uRim * uEdgeGlow * side * exp(-max(vW.y, 0.0) * 14.0) * 1.5;
  gl_FragColor = vec4(col, 1.0);
}
`;

const EMIT_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uColor;
uniform float uGain;
void main() { gl_FragColor = vec4(uColor * uGain, 1.0); }
`;

/** Chip glass top: circuit texture + bright frame + pulsing inner glow. */
const TOP_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xz;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
}
`;
const TOP_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D tCircuit;
uniform vec3 uCyan;
uniform vec3 uViolet;
uniform vec3 uBlue;
uniform float uHalf;
uniform float uPulse;
float sdChamfer(vec2 p, float h, float c) {
  vec2 q = abs(p);
  float box = max(q.x, q.y) - h;
  float cut = (q.x + q.y - (2.0 * h - c)) * 0.70710678;
  return max(box, cut);
}
void main() {
  vec2 p = vUv;
  float d = sdChamfer(p, uHalf, uHalf * 0.16);
  float aa = fwidth(d) * 1.2;
  float frame = 1.0 - smoothstep(0.035, 0.035 + aa, abs(d + 0.05));
  float frame2 = 1.0 - smoothstep(0.015, 0.015 + aa, abs(d + 0.32));
  vec2 uv = p / (uHalf * 2.0) + 0.5;
  float circ = texture(tCircuit, uv).r;
  float inner = smoothstep(0.0, -0.4, d);
  float glow = exp(-length(p) * 0.55) * (0.6 + 0.4 * uPulse);
  vec3 col = mix(uViolet * 0.05, uBlue * 0.18 + uCyan * 0.03, inner);
  col += uCyan * circ * inner * (0.6 + 1.6 * glow) * smoothstep(-0.32, -0.45, d);
  col += uCyan * glow * 0.25 * inner;
  col += uCyan * (frame * 3.0 + frame2 * 1.6);
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Glass: additive fresnel shell with a bright outline at grazing angles. */
const GLASS_FRAG = /* glsl */ `
precision highp float;
in vec3 vN;
in vec3 vW;
in vec3 vL;
uniform vec3 uColor;
uniform vec3 uViewDir;
uniform float uGain;
uniform float uFill;
void main() {
  vec3 N = normalize(vN);
  float f = pow(clamp(1.0 - abs(dot(N, -uViewDir)), 0.0, 1.0), 2.0);
  float top = smoothstep(0.6, 1.0, N.y);
  vec3 col = uColor * (uFill + f * 0.9 + top * 0.25) * uGain;
  gl_FragColor = vec4(col, 1.0);
}
`;

const BOARD_VERT = /* glsl */ `
out vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const BOARD_FRAG = /* glsl */ `
precision highp float;
in vec3 vW;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uCyan;
${HASH}
void main() {
  vec2 p = vW.xz;
  // Gradient across the board: violet toward the left/back, blue toward the right/front.
  float t = clamp(0.5 + (p.y * 0.55 - p.x * 0.45) * 0.07, 0.0, 1.0);
  vec3 col = mix(uA, uB, t * t * 0.5) * 0.42;
  // Cyan light washing in from the lower left, along the light lines.
  vec2 lp = p - vec2(0.0, 7.0);
  col += uCyan * 0.05 * exp(-dot(lp, lp) * 0.012);
  col += uCyan * 0.012;
  // Violet halo beside the chip and a soft dark falloff far away.
  float r = length(p);
  vec2 hp = p - vec2(-1.5, 3.0);
  col += uB * 0.16 * exp(-dot(hp, hp) * 0.06);
  col *= 0.55 + 0.6 * exp(-r * 0.06);
  // Faint grid.
  vec2 g = p / 0.84;
  vec2 fw = fwidth(g);
  vec2 l = 1.0 - smoothstep(vec2(0.0), fw * 1.2, abs(fract(g + 0.5) - 0.5));
  col += uA * 0.012 * max(l.x, l.y);
  gl_FragColor = vec4(col, 1.0);
}
`;

const QUAD_VERT = /* glsl */ `
in vec4 aA;   // x, z, length, width
in vec4 aB;   // dirX, dirZ, intensity, kind
out vec2 vQ;
out float vI;
out float vKind;
uniform float uY;
void main() {
  vec2 d = aB.xy;
  vec2 n = vec2(-d.y, d.x);
  vec2 c = aA.xy + d * position.x * aA.z * 0.5 + n * position.y * aA.w * 0.5;
  vQ = position.xy;
  vI = aB.z;
  vKind = aB.w;
  gl_Position = projectionMatrix * viewMatrix * vec4(c.x, uY, c.y, 1.0);
}
`;
const QUAD_FRAG = /* glsl */ `
precision highp float;
in vec2 vQ;
in float vI;
in float vKind;
uniform vec3 uColor;
void main() {
  float a;
  if (vKind < 0.5) {
    // Dash: bright head toward +x of the quad, tapered tail.
    float along = vQ.x * 0.5 + 0.5;
    a = (1.0 - smoothstep(0.6, 1.0, abs(vQ.y))) * along * along * (1.0 - smoothstep(0.92, 1.0, along));
  } else {
    // Round dot.
    a = 1.0 - smoothstep(0.7, 1.0, length(vQ));
  }
  gl_FragColor = vec4(uColor * vI * a, 1.0);
}
`;

const LINE_FRAG = /* glsl */ `
precision highp float;
in vec2 vQ;
in float vI;
in float vKind;
uniform vec3 uColor;
uniform float uPhase[4];
void main() {
  float along = vQ.x * 0.5 + 0.5;
  float core = exp(-vQ.y * vQ.y * 9.0);
  int i = int(vKind + 0.5);
  float ph = uPhase[i];
  // A bright pulse running toward the chip, over a dimmer steady line.
  float dp = along - ph;
  float pulse = exp(-dp * dp * 260.0) * 3.0 + exp(-max(-dp, 0.0) * 9.0) * step(dp, 0.0) * 0.6;
  float fade = smoothstep(0.0, 0.25, along) * (1.0 - smoothstep(0.96, 1.0, along));
  gl_FragColor = vec4(uColor * core * vI * fade * (0.35 + pulse), 1.0);
}
`;

export const createIsoCloudChip: LookFactory<IsoCloudChipParams> = (gl, params): Look => {
  const post = new Post(gl, {
    msaa: 4,
    bloomStrength: 0.75,
    bloomRadius: 0.6,
    bloomThreshold: 0.8,
    bloomKnee: 0.6,
    exposure: 1.0,
    vignette: 0.35,
    grain: 0.015,
    grainDarkCut: 0,
    cornerBlur: 0.85,
  });
  const cA = new THREE.Color(params.boardA);
  const cB = new THREE.Color(params.boardB);
  const cyan = new THREE.Color(params.cyan);
  const screen = new THREE.Color(params.screen);
  const body = new THREE.Color(params.body);

  const scene = new THREE.Scene();
  const ORTHO_H = 9.6;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
  const viewDir = new THREE.Vector3();
  const disposables: { dispose(): void }[] = [];
  const keep = <T extends { dispose(): void }>(x: T) => (disposables.push(x), x);

  const solid = (color: THREE.Color, edgeGlow = 0) =>
    keep(
      shaderMat({
        vertexShader: SOLID_VERT,
        fragmentShader: SOLID_FRAG,
        uniforms: {
          uBody: { value: color },
          uRim: { value: cyan },
          uAmbient: { value: cB },
          uViewDir: { value: viewDir },
          uEdgeGlow: { value: edgeGlow },
        },
      }),
    );
  const emit = (color: THREE.Color, gain: number) =>
    keep(shaderMat({ vertexShader: SOLID_VERT, fragmentShader: EMIT_FRAG, uniforms: { uColor: { value: color }, uGain: { value: gain } } }));
  const glass = (color: THREE.Color, gain: number, fill: number) =>
    keep(
      shaderMat({
        vertexShader: SOLID_VERT,
        fragmentShader: GLASS_FRAG,
        uniforms: { uColor: { value: color }, uViewDir: { value: viewDir }, uGain: { value: gain }, uFill: { value: fill } },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
  const add = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, ry = 0) => {
    keep(g);
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    scene.add(mesh);
    return mesh;
  };

  // Board.
  const boardMat = keep(shaderMat({ vertexShader: BOARD_VERT, fragmentShader: BOARD_FRAG, uniforms: { uA: { value: cA }, uB: { value: cB }, uCyan: { value: cyan } } }));
  add(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), boardMat);

  // Chip: base slab, glowing foot ring, pins, glass top, cloud.
  const bodyMat = solid(body, 0.5);
  add(slab(chamferShape(CHIP, CHIP * 0.08), CHIP_H, 0.06), bodyMat);
  const ringOuter = chamferShape(CHIP + 0.18, CHIP * 0.1);
  ringOuter.holes.push(chamferShape(CHIP + 0.06, CHIP * 0.09) as unknown as THREE.Path);
  add(slab(ringOuter, 0.025, 0), emit(cyan, 2.2));
  const pinMat = emit(cyan, 0.45);
  const pinGeo = new THREE.BoxGeometry(0.07, 0.03, 0.2);
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < 14; i++) {
      const t = (i - 6.5) * (CHIP * 0.78 / 13);
      const off = CHIP / 2 + 0.16;
      const m = new THREE.Mesh(pinGeo, pinMat);
      const a = (s * Math.PI) / 2;
      m.position.set(Math.cos(a) * off - Math.sin(a) * t, 0.02, Math.sin(a) * off + Math.cos(a) * t);
      m.rotation.y = -a + Math.PI / 2;
      scene.add(m);
    }
  }
  keep(pinGeo);
  const circuitTex = keep(makeCircuitTexture());
  const pulse = { value: 0 };
  const topMat = keep(
    shaderMat({
      vertexShader: TOP_VERT,
      fragmentShader: TOP_FRAG,
      uniforms: { tCircuit: { value: circuitTex }, uCyan: { value: cyan }, uViolet: { value: cB }, uBlue: { value: cA }, uHalf: { value: CHIP * 0.42 }, uPulse: pulse },
    }),
  );
  add(new THREE.PlaneGeometry(CHIP * 0.84, CHIP * 0.84).rotateX(-Math.PI / 2), topMat, 0, CHIP_H + 0.002, 0);
  // Raised glass layer.
  add(slab(chamferShape(CHIP * 0.84, CHIP * 0.07), 0.12, 0.02), glass(cyan, 0.3, 0.0), 0, CHIP_H, 0);
  // Cloud, standing up on the glass and facing the camera's diagonal.
  const cloudG = new THREE.ExtrudeGeometry(cloudShape(CHIP * 0.5), { depth: 0.22, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3, curveSegments: 32 });
  cloudG.rotateX(-Math.PI / 2);
  cloudG.translate(0, CHIP_H + 0.14, 0);
  const cloud = add(cloudG, glass(cyan, 1.8, 0.12), 0, 0, 0, Math.PI / 4);
  cloud.position.set(0.1, 0, -0.1);
  // A bright outline under the cloud (its footprint glows on the glass).
  const cloudLine = new THREE.ShapeGeometry(cloudShape(CHIP * 0.53), 32);
  cloudLine.rotateX(-Math.PI / 2);
  add(cloudLine, glass(cyan, 0.5, 0.25), 0.1, CHIP_H + 0.13, -0.1, Math.PI / 4);

  // Satellites.
  const padMat = emit(cyan, 0.6);
  const padShape = (s: number) => {
    const o = chamferShape(s, s * 0.08);
    o.holes.push(chamferShape(s - 0.07, s * 0.08) as unknown as THREE.Path);
    return o;
  };
  const serverGlass = glass(cyan, 0.7, 0.18);
  const serverCore = emit(cyan, 1.6);
  const servers: [number, number][] = [[-4.0, 1.5], [-4.2, -0.4], [-4.4, -2.3]];
  for (const [x, z] of servers) {
    add(slab(padShape(1.5), 0.02, 0), padMat, x, 0, z);
    add(slab(chamferShape(1.25, 0.1), 0.25, 0.03), bodyMat, x, 0, z);
    add(new THREE.BoxGeometry(0.62, 0.18, 0.62), serverCore, x, 0.38, z);
    add(new THREE.BoxGeometry(0.9, 0.75, 0.9), serverGlass, x, 0.63, z);
  }
  const codeTex = keep(makeCodeTexture());
  const screenMat = keep(
    shaderMat({
      vertexShader: /* glsl */ `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `precision highp float; in vec2 vUv; uniform sampler2D tCode; uniform vec3 uScreen; uniform vec3 uCyan;
        void main(){ float c = texture(tCode, vUv).r; vec3 col = uScreen * (0.08 + c * 1.6) + uCyan * 0.05;
          float e = max(abs(vUv.x - 0.5), abs(vUv.y - 0.5)); col += uCyan * smoothstep(0.46, 0.5, e) * 1.2; gl_FragColor = vec4(col, 1.0); }`,
      uniforms: { tCode: { value: codeTex }, uScreen: { value: screen }, uCyan: { value: cyan } },
      side: THREE.DoubleSide,
    }),
  );
  // Phones: three tall cards toward the upper right (-z).
  const phones: [number, number][] = [[-0.4, -4.0], [1.2, -4.2], [2.8, -4.4]];
  for (const [x, z] of phones) {
    add(slab(padShape(1.0), 0.02, 0), padMat, x, 0, z);
    add(new THREE.BoxGeometry(0.5, 1.0, 0.07), bodyMat, x, 0.52, z, Math.PI / 4);
    const sc = add(new THREE.PlaneGeometry(0.42, 0.88), screenMat, 0, 0, 0, 0);
    sc.position.set(x, 0.53, z);
    sc.rotation.y = Math.PI / 4;
    sc.translateZ(0.04);
  }
  // Laptops: base + open screen, toward the lower right (+x).
  const laptops: [number, number][] = [[4.1, -2.2], [4.4, -0.3], [4.7, 1.6]];
  for (const [x, z] of laptops) {
    add(slab(padShape(1.5), 0.02, 0), padMat, x, 0, z);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = Math.PI / 4;
    scene.add(g);
    const base = new THREE.Mesh(keep(new THREE.BoxGeometry(1.1, 0.06, 0.75)), bodyMat);
    base.position.set(0, 0.05, 0.1);
    g.add(base);
    const lid = new THREE.Group();
    lid.position.set(0, 0.08, -0.27);
    lid.rotation.x = -0.32;
    g.add(lid);
    const lb = new THREE.Mesh(keep(new THREE.BoxGeometry(1.1, 0.75, 0.04)), bodyMat);
    lb.position.set(0, 0.375, 0);
    lid.add(lb);
    const ls = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.0, 0.66)), screenMat);
    ls.position.set(0, 0.375, 0.025);
    lid.add(ls);
  }
  // Small ICs scattered around.
  const ics: [number, number, number][] = [[-2.4, 3.5, 0.55], [3.0, 3.6, 0.5], [-3.2, -3.4, 0.45], [4.2, -4.0, 0.45], [-5.6, 3.2, 0.4]];
  for (const [x, z, s] of ics) {
    add(slab(chamferShape(s, s * 0.1), 0.12, 0.02), solid(body, 0.3), x, 0, z);
    add(new THREE.PlaneGeometry(s * 0.6, s * 0.6).rotateX(-Math.PI / 2), emit(cyan, 0.5), x, 0.125, z);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      for (let i = -2; i <= 2; i++) {
        const m = new THREE.Mesh(pinGeo, pinMat);
        m.scale.set(0.5, 1, 0.4);
        m.position.set(x + Math.cos(a) * (s / 2 + 0.06) - Math.sin(a) * i * s * 0.17, 0.02, z + Math.sin(a) * (s / 2 + 0.06) + Math.cos(a) * i * s * 0.17);
        m.rotation.y = -a + Math.PI / 2;
        scene.add(m);
      }
    }
  }

  // Connection traces from the chip to each satellite (L-shaped, on the board).
  const conn: { a: [number, number]; b: [number, number] }[] = [];
  const pushL = (x0: number, z0: number, x1: number, z1: number) => {
    conn.push({ a: [x0, z0], b: [x1, z0] });
    conn.push({ a: [x1, z0], b: [x1, z1] });
  };
  for (const [x, z] of servers) pushL(-CHIP / 2 - 0.4, z * 0.6, x + 0.8, z);
  for (const [x, z] of phones) pushL(x * 0.7, -CHIP / 2 - 0.4, x, z + 0.55);
  for (const [x, z] of laptops) pushL(CHIP / 2 + 0.4, z * 0.7, x - 0.8, z);

  // Instanced quads: data dashes (kind 0) and round dots (kind 1).
  const quadGeo = keep(new THREE.InstancedBufferGeometry());
  quadGeo.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  const N = DASHES.length + DOTS.length;
  const aA = new Float32Array(N * 4);
  const aB = new Float32Array(N * 4);
  const aAttr = new THREE.InstancedBufferAttribute(aA, 4);
  const bAttr = new THREE.InstancedBufferAttribute(aB, 4);
  aAttr.setUsage(THREE.DynamicDrawUsage);
  bAttr.setUsage(THREE.DynamicDrawUsage);
  quadGeo.setAttribute("aA", aAttr);
  quadGeo.setAttribute("aB", bAttr);
  quadGeo.instanceCount = N;
  const dashColor = cyan.clone().lerp(new THREE.Color("#2AF0C0"), 0.35);
  const quadMat = keep(
    shaderMat({
      vertexShader: QUAD_VERT,
      fragmentShader: QUAD_FRAG,
      uniforms: { uColor: { value: dashColor }, uY: { value: 0.03 } },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const quads = new THREE.Mesh(quadGeo, quadMat);
  quads.frustumCulled = false;
  quads.renderOrder = 5;
  scene.add(quads);

  // Static thin traces (connections) as their own quads.
  const traceGeo = keep(new THREE.InstancedBufferGeometry());
  traceGeo.setAttribute("position", quadGeo.getAttribute("position"));
  const tA = new Float32Array(conn.length * 4);
  const tB = new Float32Array(conn.length * 4);
  conn.forEach((c, i) => {
    const dx = c.b[0] - c.a[0];
    const dz = c.b[1] - c.a[1];
    const len = Math.hypot(dx, dz) + 1e-6;
    tA.set([(c.a[0] + c.b[0]) / 2, (c.a[1] + c.b[1]) / 2, len + 0.04, 0.035], i * 4);
    tB.set([dx / len, dz / len, 1.0, 0], i * 4);
  });
  traceGeo.setAttribute("aA", new THREE.InstancedBufferAttribute(tA, 4));
  traceGeo.setAttribute("aB", new THREE.InstancedBufferAttribute(tB, 4));
  traceGeo.instanceCount = conn.length;
  const traceMat = keep(
    shaderMat({
      vertexShader: QUAD_VERT,
      fragmentShader: /* glsl */ `precision highp float; in vec2 vQ; in float vI; in float vKind; uniform vec3 uColor;
        void main(){ float a = 1.0 - smoothstep(0.5, 1.0, abs(vQ.y)); gl_FragColor = vec4(uColor * a * 0.9, 1.0); }`,
      uniforms: { uColor: { value: cyan }, uY: { value: 0.012 } },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const traces = new THREE.Mesh(traceGeo, traceMat);
  traces.frustumCulled = false;
  scene.add(traces);

  // Long light lines streaking in from the lower left (+z) toward the chip.
  const LL: { x: number; k: number; off: number }[] = [
    { x: -1.1, k: 2, off: 0.0 },
    { x: -0.3, k: 3, off: 0.4 },
    { x: 0.7, k: 2, off: 0.65 },
    { x: 1.6, k: 1, off: 0.2 },
  ];
  const llGeo = keep(new THREE.InstancedBufferGeometry());
  llGeo.setAttribute("position", quadGeo.getAttribute("position"));
  const lA = new Float32Array(LL.length * 4);
  const lB = new Float32Array(LL.length * 4);
  LL.forEach((l, i) => {
    const z0 = CHIP / 2 + 0.3;
    const z1 = 24;
    lA.set([l.x, (z0 + z1) / 2, z1 - z0, 0.06], i * 4);
    lB.set([0, -1, i === 1 ? 1.3 : 0.9, i], i * 4);
  });
  llGeo.setAttribute("aA", new THREE.InstancedBufferAttribute(lA, 4));
  llGeo.setAttribute("aB", new THREE.InstancedBufferAttribute(lB, 4));
  llGeo.instanceCount = LL.length;
  const llPhase = [0, 0, 0, 0];
  const llMat = keep(
    shaderMat({
      vertexShader: QUAD_VERT,
      fragmentShader: LINE_FRAG,
      uniforms: { uColor: { value: cyan.clone().lerp(new THREE.Color(1, 1, 1), 0.2) }, uY: { value: 0.02 }, uPhase: { value: llPhase } },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const ll = new THREE.Mesh(llGeo, llMat);
  ll.frustumCulled = false;
  scene.add(ll);

  /** Per-frame positions of dashes and dot twinkle, from the frame number only. */
  const layoutQuads = (frame: number) => {
    const SPAN = 30;
    DASHES.forEach((d, i) => {
      const u = (cyc(frame, d.k) + d.phase) % 1;
      // Travel along the lane toward the chip, wrapping over SPAN (whole cycles per loop).
      let x = d.x;
      let z = d.z;
      let dx = 0;
      let dz = 0;
      if (d.dir === 0) {
        z = 15 - u * SPAN;
        dz = -1;
      } else {
        x = -15 + u * SPAN;
        dx = 1;
      }
      const edge = Math.min(1, Math.min(u, 1 - u) * 8); // fade at the wrap ends
      const nearChip = Math.max(Math.abs(x), Math.abs(z)) < CHIP / 2 + 0.3 ? 0 : 1;
      aA.set([x, z, d.len, 0.085], i * 4);
      aB.set([dx, dz, d.bright * edge * nearChip * 1.4, 0], i * 4);
    });
    DOTS.forEach((d, j) => {
      const i = DASHES.length + j;
      const tw = d.k ? 0.45 + 0.55 * (0.5 + 0.5 * Math.cos(TAU * (cyc(frame, d.k) + d.phase))) : 0.7;
      aA.set([d.x, d.z, d.r * 2, d.r * 2], i * 4);
      aB.set([1, 0, tw * 0.9, 1], i * 4);
    });
    aAttr.needsUpdate = true;
    bAttr.needsUpdate = true;
    LL.forEach((l, i) => {
      llPhase[i] = 1 - ((cyc(frame, l.k) + l.off) % 1);
    });
  };

  const black = new THREE.Color(0, 0, 0);
  return {
    render(frame) {
      post.ensureSize();
      const a = cyc(frame, 1) * TAU;
      // Isometric view (azimuth 45 deg, elevation 30 deg) with a slow closed drift.
      const az = Math.PI / 4 + ((2.0 * Math.PI) / 180) * Math.sin(a);
      const el = (30 * Math.PI) / 180 + ((0.8 * Math.PI) / 180) * Math.sin(a + 1.1);
      const target = new THREE.Vector3(0.2 * Math.cos(a), 0, 0.2 * Math.sin(a));
      camera.position.set(target.x + Math.sin(az) * Math.cos(el) * 50, Math.sin(el) * 50, target.z + Math.cos(az) * Math.cos(el) * 50);
      camera.lookAt(target);
      const W = (ORTHO_H * 16) / 9;
      // Off-centre frustum: the chip sits right of and above the frame centre.
      camera.left = -0.6 * W;
      camera.right = 0.4 * W;
      camera.top = 0.42 * ORTHO_H;
      camera.bottom = -0.58 * ORTHO_H;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      camera.getWorldDirection(viewDir);
      pulse.value = 0.5 + 0.5 * Math.cos(cyc(frame, 4) * TAU);
      layoutQuads(frame);
      post.beginScene(black);
      gl.render(scene, camera);
      post.finish(frame);
    },
    dispose() {
      post.dispose();
      for (const d of disposables) d.dispose();
    },
  };
};

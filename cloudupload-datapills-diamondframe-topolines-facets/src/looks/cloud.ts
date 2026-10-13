import * as THREE from "three";
import { makeBackdrop } from "../common/backdrop";
import { LOOP, TAU } from "../common/constants";
import { makeStripEnv } from "../common/env";
import { MONO } from "../common/fonts";
import { FRAG_OUT } from "../common/glsl";
import { mulberry32, range } from "../common/random";
import type { World } from "../common/world";

/**
 * Look 1 - Cloud Upload. A frosted-glass cloud with an up-arrow hole floats
 * over a ring platform on a circuit-board floor. Light beams (depth-tested,
 * so the cloud hides the ones behind it) and ~1500 data particles (dots,
 * dashes, JetBrains Mono glyphs) rise through it. The particles are an
 * overlay drawn after depth of field (they live at the focus distance), so
 * they stay crisp.
 */
export type CloudParams = {
  accent: string; // cyan rim / rings / beams
  glow: string; // inner glow
  background: string;
  haze: string;
  trace: string;
};

const RING_R = 1.75; // platform radius
const CLOUD_Y = 2.95;
const PARTICLES = 1500;
const BEAMS = 40;

// ---------- cloud outline: smooth union of circles + rounded box ----------
const smin = (a: number, b: number, k: number) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};
const cloudSdf = (x: number, y: number) => {
  const c = (cx: number, cy: number, r: number) => Math.hypot(x - cx, y - cy) - r;
  // rounded box: x in [-1.55, 1.55], y in [-0.78, 0.1], radius 0.42
  const bx = Math.abs(x) - (1.55 - 0.42);
  const by = Math.abs(y + 0.34) - (0.44 - 0.42);
  const box = Math.hypot(Math.max(bx, 0), Math.max(by, 0)) + Math.min(Math.max(bx, by), 0) - 0.42;
  let d = smin(box, c(-0.82, 0.02, 0.6), 0.22);
  d = smin(d, c(0.12, 0.38, 0.86), 0.22);
  d = smin(d, c(0.98, 0.0, 0.58), 0.22);
  return d;
};
const cloudOutline = (n = 240) => {
  const pts: THREE.Vector2[] = [];
  const ox = 0.05;
  const oy = -0.12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let lo = 0;
    let hi = 3;
    for (let k = 0; k < 40; k++) {
      const m = (lo + hi) / 2;
      if (cloudSdf(ox + dx * m, oy + dy * m) < 0) lo = m;
      else hi = m;
    }
    pts.push(new THREE.Vector2(ox + dx * lo, oy + dy * lo));
  }
  return pts;
};
const arrowHole = () =>
  [
    [0, 0.8],
    [-0.56, 0.18],
    [-0.23, 0.18],
    [-0.23, -0.6],
    [0.23, -0.6],
    [0.23, 0.18],
    [0.56, 0.18],
  ].map(([x, y]) => new THREE.Vector2(x, y));

const cloudGeometry = () => {
  const shape = new THREE.Shape(cloudOutline());
  shape.holes.push(new THREE.Path(arrowHole().reverse()));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: 0.5,
    bevelEnabled: true,
    bevelThickness: 0.13,
    bevelSize: 0.085,
    bevelSegments: 6,
    curveSegments: 8,
  });
  g.translate(0, 0, -0.25);
  g.computeVertexNormals();
  return g;
};

// ---------- circuit textures (canvas, built once) ----------
// R = trace coverage, G = coverage * per-trace pulse phase, B = pads/chips
const circuitTexture = (seed: number, radial: boolean, size = 4096) => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, size, size);
  g.lineCap = "round";
  g.lineJoin = "round";
  const r = mulberry32(seed);
  const C = size / 2;
  const traces = radial ? 150 : 220;
  for (let i = 0; i < traces; i++) {
    const phase = Math.floor(r() * 255);
    g.strokeStyle = `rgb(255,${phase},0)`;
    g.lineWidth = (radial ? 2.5 : 3) + r() * 3;
    let x: number;
    let y: number;
    let dir: number;
    if (radial) {
      const a = r() * TAU;
      const r0 = size * range(r, 0.07, 0.14);
      x = C + Math.cos(a) * r0;
      y = C + Math.sin(a) * r0;
      dir = Math.round(a / (Math.PI / 4)) * (Math.PI / 4);
    } else {
      x = r() * size;
      y = r() * size;
      dir = Math.floor(r() * 8) * (Math.PI / 4);
    }
    g.beginPath();
    g.moveTo(x, y);
    const segs = 3 + Math.floor(r() * 6);
    for (let s = 0; s < segs; s++) {
      const len = size * range(r, 0.015, radial ? 0.09 : 0.05);
      x += Math.cos(dir) * len;
      y += Math.sin(dir) * len;
      g.lineTo(x, y);
      // turn by +-45 deg, radial traces keep heading outward
      const turn = (r() < 0.5 ? -1 : 1) * (Math.PI / 4);
      if (radial) {
        const out = Math.atan2(y - C, x - C);
        const cand = dir + turn;
        const diff = Math.abs(Math.atan2(Math.sin(cand - out), Math.cos(cand - out)));
        dir = diff < Math.PI / 2.5 ? cand : Math.round(out / (Math.PI / 4)) * (Math.PI / 4);
      } else {
        dir += turn;
      }
    }
    g.stroke();
    // pad at the end
    g.fillStyle = `rgb(255,${phase},255)`;
    g.beginPath();
    g.arc(x, y, 6 + r() * 5, 0, TAU);
    g.fill();
    g.fillStyle = "#000";
    g.beginPath();
    g.arc(x, y, 3 + r() * 1.5, 0, TAU);
    g.fill();
  }
  // via dots and small chip outlines
  for (let i = 0; i < (radial ? 500 : 700); i++) {
    const x = r() * size;
    const y = r() * size;
    if (radial && Math.hypot(x - C, y - C) < size * 0.08) continue;
    if (r() < 0.5) continue;
    if (r() < 0.85) {
      g.fillStyle = `rgb(140,${Math.floor(r() * 255)},200)`;
      g.fillRect(x, y, 6, 6);
    } else {
      g.strokeStyle = `rgb(160,${Math.floor(r() * 255)},255)`;
      g.lineWidth = 3;
      g.strokeRect(x, y, 30 + r() * 80, 20 + r() * 50);
    }
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 16;
  tex.wrapS = tex.wrapT = radial ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  return tex;
};

const glyphAtlas = () => {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 512;
  const g = cv.getContext("2d")!;
  g.fillStyle = "#000";
  g.fillRect(0, 0, 512, 512);
  g.fillStyle = "#fff";
  g.font = `500 96px "${MONO}"`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const chars = "0101100110ABCDEF";
  for (let i = 0; i < 16; i++) {
    g.fillText(chars[i], (i % 4) * 128 + 64, Math.floor(i / 4) * 128 + 68);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
};

// ---------- shaders ----------
const surfaceVert = /* glsl */ `
out vec2 vUv;
out vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const floorFrag = /* glsl */ `
${FRAG_OUT}
uniform sampler2D circuit;
uniform vec3 base, traceCol, accent, bg;
uniform float tf, extent, fadeR, radial, traceGain;
uniform vec2 uvScale;
in vec2 vUv;
in vec3 vWorld;
void main() {
  vec4 c = texture(circuit, vUv * uvScale);
  float cov = c.r;
  float phase = c.g / max(c.r, 1e-3);
  float r = radial > 0.5 ? length(vWorld.xz) : (vWorld.x * 0.7 - vWorld.y);
  // pulses running outward: integer cycles per loop
  float p = fract(phase * 3.0 + r * 0.55 - tf * 3.0);
  float pulse = exp(-pow((p - 0.5) / 0.035, 2.0));
  float pads = c.b * (1.0 - step(0.6, c.r) * 0.0);
  vec3 col = base;
  col += traceCol * cov * traceGain * (0.35 + 2.6 * pulse);
  col += accent * pads * traceGain * 0.35;
  // glow pool around the platform (floor only)
  float rr = length(vWorld.xz);
  col += accent * radial * (0.12 * exp(-rr * rr / 6.0) + 0.05 * exp(-rr / 4.0));
  // fade into the background with distance from the platform
  float fade = smoothstep(fadeR, fadeR * 0.35, radial > 0.5 ? rr : length(vWorld.xy - vec2(-6.0, 3.0)));
  gl_FragColor = vec4(mix(bg, col, fade), 1.0);
}
`;

const beamVert = /* glsl */ `
in vec4 iBeam;   // x, z, width, height
in vec4 iFlick;  // k1, k2, phase, base brightness
uniform float tf;
out vec2 vQ;
out float vBright;
void main() {
  vec3 right = normalize(vec3(viewMatrix[0][0], 0.0, viewMatrix[2][0]));
  vec3 base = vec3(iBeam.x, 0.0, iBeam.y);
  float h = iBeam.w;
  vec3 wp = base + right * position.x * iBeam.z + vec3(0.0, (position.y * 0.5 + 0.5) * h, 0.0);
  vQ = vec2(position.x, position.y * 0.5 + 0.5);
  float fl = 0.62 + 0.24 * sin(6.28318530718 * (iFlick.x * tf + iFlick.z)) + 0.14 * sin(6.28318530718 * (iFlick.y * tf + iFlick.z * 1.7));
  vBright = iFlick.w * fl;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;
const beamFrag = /* glsl */ `
${FRAG_OUT}
uniform vec3 color;
in vec2 vQ;
in float vBright;
void main() {
  float across = exp(-vQ.x * vQ.x * 5.0);
  float core = exp(-vQ.x * vQ.x * 40.0) * 0.6;
  float v = smoothstep(0.0, 0.06, vQ.y) * (1.0 - smoothstep(0.45, 0.85, vQ.y));
  gl_FragColor = vec4(color * (across + core) * v * vBright, 1.0);
}
`;

const partVert = /* glsl */ `
in vec4 iP;     // angle, radius, y0, speed (cycles per loop)
in vec4 iM;     // kind (0 dot, 1 dash, 2 glyph), glyph index, size, brightness
uniform float tf, height;
out vec2 vQ;
out vec4 vM;
out float vFade;
void main() {
  float y = fract(iP.z + iP.w * tf) * height;
  vec3 c = vec3(cos(iP.x) * iP.y, 0.12 + y, sin(iP.x) * iP.y);
  vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 up = vec3(0.0, 1.0, 0.0);
  float s = iM.z;
  vec2 ext = iM.x < 0.5 ? vec2(s, s) : (iM.x < 1.5 ? vec2(s * 0.45, s * 1.9) : vec2(s * 1.1, s * 1.4));
  vec3 wp = c + right * position.x * ext.x + up * position.y * ext.y;
  vQ = position.xy;
  vM = iM;
  float yn = y / height;
  vFade = smoothstep(0.0, 0.08, yn) * (1.0 - smoothstep(0.55, 0.95, yn));
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;
const partFrag = /* glsl */ `
${FRAG_OUT}
uniform sampler2D glyphs;
uniform vec3 color;
in vec2 vQ;
in vec4 vM;
in float vFade;
void main() {
  float a;
  if (vM.x < 0.5) {
    a = exp(-dot(vQ, vQ) * 3.0);
  } else if (vM.x < 1.5) {
    a = exp(-vQ.x * vQ.x * 4.0) * smoothstep(1.0, 0.6, abs(vQ.y));
  } else {
    float gi = vM.y;
    vec2 cell = vec2(mod(gi, 4.0), floor(gi / 4.0));
    vec2 uv = (cell + (vec2(vQ.x, -vQ.y) * 0.5 + 0.5)) / 4.0;
    uv.y = 1.0 - uv.y;
    a = texture(glyphs, uv).r;
  }
  gl_FragColor = vec4(color * a * vM.w * vFade, 1.0);
}
`;

const rimVert = /* glsl */ `
out vec3 vN;
out vec3 vV;
out vec3 vObj;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - w.xyz);
  vObj = position;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const rimFrag = /* glsl */ `
${FRAG_OUT}
uniform vec3 rim, glow;
in vec3 vN;
in vec3 vV;
in vec3 vObj;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  // no rim on downward faces: seen edge-on from above they stack into hotspots
  float r = pow(f, 2.5) * smoothstep(-0.35, 0.15, normalize(vN).y);
  // inner white glow, stronger toward the top of the cloud
  float top = smoothstep(-0.8, 1.2, vObj.y);
  vec3 c = rim * r * 1.4 + glow * (0.01 + 0.03 * top);
  gl_FragColor = vec4(c, 1.0);
}
`;

export const makeCloud =
  (params: CloudParams) =>
  (gl: THREE.WebGLRenderer): World => {
    const accent = new THREE.Color(params.accent);
    const scene = new THREE.Scene();
    const overlay = new THREE.Scene();
    scene.add(
      makeBackdrop(params.background, [
        { x: 0.0, y: 0.6, rx: 0.42, ry: 0.5, color: params.haze, strength: 2.2 },
        { x: 0.85, y: 0.9, rx: 0.4, ry: 0.3, color: params.haze, strength: 0.45 },
        { x: 0.35, y: 0.5, rx: 0.5, ry: 0.7, color: params.haze, strength: 0.45 },
      ]),
    );
    scene.environment = makeStripEnv(
      gl,
      [
        { dir: [0, 1, 0.2], roll: 0, length: 60, width: 30, color: "#dff6ff", intensity: 3.5 },
        { dir: [-1, 0.2, 0.4], roll: 1.4, length: 50, width: 8, color: params.accent, intensity: 6 },
        { dir: [0.9, 0.1, 0.6], roll: 1.5, length: 40, width: 5, color: params.accent, intensity: 3 },
      ],
      { top: "#0a2a5a", bottom: "#020814", intensity: 1.2 },
      0.04,
    );

    const bg = new THREE.Color(params.background);
    // floor
    const floorTex = circuitTexture(0xf100, true);
    const FLOOR = 26;
    const floorMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: surfaceVert,
      fragmentShader: floorFrag,
      uniforms: {
        circuit: { value: floorTex },
        base: { value: new THREE.Color("#061a40") },
        traceCol: { value: new THREE.Color(params.trace) },
        accent: { value: accent },
        bg: { value: new THREE.Color(params.haze).lerp(bg, 0.6) },
        tf: { value: 0 },
        extent: { value: FLOOR },
        fadeR: { value: 12.5 },
        radial: { value: 1 },
        traceGain: { value: 0.6 },
        uvScale: { value: new THREE.Vector2(1, 1) },
      },
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(FLOOR, FLOOR), floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    // back wall (left) with generic circuitry
    const wallTex = circuitTexture(0x3a11, false, 2048);
    const wallMat = floorMat.clone();
    wallMat.uniforms = THREE.UniformsUtils.clone(floorMat.uniforms);
    Object.assign(wallMat.uniforms, {
      circuit: { value: wallTex },
      base: { value: new THREE.Color("#1450b0") },
      traceCol: { value: new THREE.Color(params.trace) },
      accent: { value: accent },
      bg: { value: bg.clone() },
      radial: { value: 0 },
      fadeR: { value: 24 },
      traceGain: { value: 0.9 },
      uvScale: { value: new THREE.Vector2(3, 1.5) },
    });
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(44, 16), wallMat);
    wall.position.set(-4, 7, -10);
    wall.rotation.y = 0.35;
    scene.add(wall);

    // platform
    const platform = new THREE.Group();
    const disc = new THREE.Mesh(
      new THREE.CylinderGeometry(RING_R + 0.1, RING_R + 0.12, 0.03, 96),
      new THREE.MeshStandardMaterial({ color: "#0a1e48", metalness: 0.5, roughness: 0.4, transparent: true, opacity: 0.55 }),
    );
    disc.position.y = 0.015;
    platform.add(disc);
    const ringMat = (k: number) =>
      new THREE.MeshBasicMaterial({ color: accent.clone().multiplyScalar(k), side: THREE.DoubleSide });
    const ringsA = new THREE.Group();
    const ringsB = new THREE.Group();
    const flat = (geo: THREE.BufferGeometry, mat: THREE.Material, grp: THREE.Group) => {
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.035;
      grp.add(m);
    };
    // 3 concentric rings (with gaps/ticks so their rotation reads)
    flat(new THREE.RingGeometry(RING_R - 0.04, RING_R, 128, 1, 0, TAU * 0.93), ringMat(2.2), ringsA);
    flat(new THREE.RingGeometry(RING_R * 0.78 - 0.03, RING_R * 0.78, 128, 1, 0.4, TAU * 0.8), ringMat(1.6), ringsB);
    flat(new THREE.RingGeometry(RING_R * 0.5 - 0.025, RING_R * 0.5, 96, 1, 1.0, TAU * 0.86), ringMat(1.4), ringsA);
    // dashed ring (thick segments)
    for (let i = 0; i < 12; i++) {
      flat(
        new THREE.RingGeometry(RING_R * 0.86, RING_R * 0.94, 16, 1, (i / 12) * TAU, (TAU / 12) * 0.55),
        ringMat(i % 3 === 0 ? 3.0 : 1.8),
        ringsB,
      );
    }
    // fine ticks
    for (let i = 0; i < 72; i++) {
      flat(new THREE.RingGeometry(RING_R * 0.6, RING_R * 0.66, 2, 1, (i / 72) * TAU, 0.012), ringMat(1.2), ringsA);
    }
    platform.add(ringsA, ringsB);
    scene.add(platform);

    // cloud
    const cloudGeo = cloudGeometry();
    const cloudMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#4cc4ff"),
      transmission: 0.5,
      roughness: 0.2,
      thickness: 0.3,
      ior: 1.2,
      metalness: 0,
      emissive: new THREE.Color(params.glow),
      emissiveIntensity: 0.2,
      envMapIntensity: 0.55,
      attenuationColor: new THREE.Color(params.glow),
      attenuationDistance: 0.6,
      specularIntensity: 0.6,
      clearcoat: 0.0,
      clearcoatRoughness: 0.2,
    });
    const cloud = new THREE.Group();
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    cloud.add(cloudMesh);
    const rim = new THREE.Mesh(
      cloudGeo,
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: rimVert,
        fragmentShader: rimFrag,
        uniforms: { rim: { value: accent.clone().multiplyScalar(1.4) }, glow: { value: new THREE.Color("#bff4ff") } },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    rim.renderOrder = 10;
    cloud.add(rim);
    cloud.scale.setScalar(1.05);
    scene.add(cloud);
    const key = new THREE.DirectionalLight("#bdeeff", 1.4);
    key.position.set(-3, 8, 6);
    scene.add(key);

    // ---- overlay: beams, haze column, particles ----
    const rng = mulberry32(0xc10d);
    const plane = new THREE.PlaneGeometry(2, 2);
    const beamGeo = new THREE.InstancedBufferGeometry();
    beamGeo.index = plane.index;
    beamGeo.setAttribute("position", plane.getAttribute("position"));
    const bAttr = new Float32Array((BEAMS + 3) * 4);
    const fAttr = new Float32Array((BEAMS + 3) * 4);
    for (let i = 0; i < BEAMS; i++) {
      const a = rng() * TAU;
      const rr = Math.sqrt(rng()) * RING_R * 0.85;
      bAttr.set([Math.cos(a) * rr, Math.sin(a) * rr, range(rng, 0.04, 0.2), range(rng, 4.6, 6.4)], i * 4);
      fAttr.set([4 + Math.floor(rng() * 14), 9 + Math.floor(rng() * 20), rng(), range(rng, 0.1, 0.4)], i * 4);
    }
    // 3 wide soft haze columns
    for (let i = 0; i < 3; i++) {
      const j = BEAMS + i;
      bAttr.set([(i - 1) * 0.3, 0, RING_R * (0.75 + 0.25 * i), 6.0 + 0.5 * i], j * 4);
      fAttr.set([1, 2, i * 0.3, 0.32], j * 4);
    }
    beamGeo.setAttribute("iBeam", new THREE.InstancedBufferAttribute(bAttr, 4));
    beamGeo.setAttribute("iFlick", new THREE.InstancedBufferAttribute(fAttr, 4));
    beamGeo.instanceCount = BEAMS + 3;
    const beamUniforms = { tf: { value: 0 }, color: { value: new THREE.Color(params.accent).lerp(new THREE.Color(params.glow), 0.2) } };
    const beams = new THREE.Mesh(
      beamGeo,
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: beamVert,
        fragmentShader: beamFrag,
        uniforms: beamUniforms,
        transparent: true,
        depthWrite: false,
        depthTest: true, // the cloud hides the beams behind it
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    beams.frustumCulled = false;
    beams.renderOrder = 5;
    scene.add(beams);

    const partGeo = new THREE.InstancedBufferGeometry();
    partGeo.index = plane.index;
    partGeo.setAttribute("position", plane.getAttribute("position"));
    const pP = new Float32Array(PARTICLES * 4);
    const pM = new Float32Array(PARTICLES * 4);
    for (let i = 0; i < PARTICLES; i++) {
      const a = rng() * TAU;
      const rr = Math.sqrt(rng()) * RING_R * 0.82;
      pP.set([a, rr, rng(), 1 + Math.floor(rng() * 3)], i * 4);
      const kr = rng();
      const kind = kr < 0.6 ? 0 : kr < 0.85 ? 1 : 2;
      pM.set([kind, Math.floor(rng() * 16), kind === 2 ? range(rng, 0.045, 0.07) : range(rng, 0.01, 0.024), rng() < 0.06 ? range(rng, 1.1, 1.6) : range(rng, 0.2, 0.65)], i * 4);
    }
    partGeo.setAttribute("iP", new THREE.InstancedBufferAttribute(pP, 4));
    partGeo.setAttribute("iM", new THREE.InstancedBufferAttribute(pM, 4));
    partGeo.instanceCount = PARTICLES;
    const partUniforms = {
      tf: { value: 0 },
      height: { value: CLOUD_Y - 0.55 },
      glyphs: { value: glyphAtlas() },
      color: { value: new THREE.Color("#9fefff").multiplyScalar(1.5) },
    };
    const parts = new THREE.Mesh(
      partGeo,
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: partVert,
        fragmentShader: partFrag,
        uniforms: partUniforms,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      }),
    );
    parts.frustumCulled = false;
    overlay.add(parts);

    const camera = new THREE.PerspectiveCamera(35, 16 / 9, 0.2, 200);
    const target = new THREE.Vector3();
    const tmp = new THREE.Vector3();
    const post: World["post"] = {
      dof: { focus: 11.2, farBlur: 10, nearBlur: 12, maxBlur: 18 },
      bloom: { strength: 0.6, threshold: 0.8, knee: 0.4, weights: [1.0, 0.9, 0.75, 0.55, 0.4, 0.3] },
      exposure: 1.0,
      aces: true,
      grain: 0.015,
      grainLumaFade: 0,
      msaa: 4,
    };

    return {
      scene,
      overlay,
      camera,
      post,
      update(t) {
        const f = t / LOOP;
        // cloud bobs (whole cycles)
        cloud.position.set(0, CLOUD_Y + 0.09 * Math.sin(TAU * f), 0);
        cloud.rotation.set(0.04 * Math.sin(TAU * 2 * f + 0.5), -0.18 + 0.05 * Math.sin(TAU * f + 1.3), 0);
        // rings turn whole repeats in opposite directions
        ringsA.rotation.y = TAU * f;
        ringsB.rotation.y = -TAU * f;
        // camera: ~25 deg down, subject left of centre, slow closed drift
        const pitch = ((25 + 1.2 * Math.sin(TAU * f + 0.7)) * Math.PI) / 180;
        const yaw = ((8 + 4 * Math.sin(TAU * f)) * Math.PI) / 180;
        const dist = 11.5 + 0.35 * Math.cos(TAU * f);
        target.set(2.35, 1.75, 0);
        camera.position.set(
          target.x + dist * Math.sin(yaw) * Math.cos(pitch),
          target.y + dist * Math.sin(pitch),
          target.z + dist * Math.cos(yaw) * Math.cos(pitch),
        );
        camera.lookAt(target);
        camera.updateMatrixWorld();
        camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
        // focus on the cloud
        post.dof!.focus = -tmp.copy(cloud.position).applyMatrix4(camera.matrixWorldInverse).z;
        floorMat.uniforms.tf.value = f;
        wallMat.uniforms.tf.value = f;
        beamUniforms.tf.value = f;
        partUniforms.tf.value = f;
      },
    };
  };

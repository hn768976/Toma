import * as THREE from "three";
import { GalaxyColours } from "../colourways";
import { bg, lin } from "../lib/color";
import { FullScreenQuad, PostPipeline, PostSettings, rawMat } from "../lib/pipeline";
import { gauss, mulberry32 } from "../lib/random";
import { FrameInfo, Look } from "../lib/Stage";

/**
 * LOOK 1 — Particle Galaxy Spiral (20 s loop, 600 frames).
 *
 * Loop design: the particle + streak distribution is built with exact 3-fold
 * rotational symmetry (3 arms; every generated element is instanced at 0°,
 * 120°, 240°). So a rotation by a whole number of THIRD-turns maps the galaxy
 * onto itself. Bands turn a whole number of third-turns per 600 frames:
 *   bulge (r < 1.6): 2 × 120° · disk (r ≥ 1.6): 1 × 120°.
 * Frame 600 is therefore identical to frame 0, and the outer disk turns at a
 * calm 6°/s like the reference.
 */

export const GALAXY_LOOP = 600;
export const GALAXY_POST: PostSettings = {
  bloomStrength: 1.1,
  bloomRadius: 0.85,
  bloomThreshold: 0.15,
  exposure: 1.0,
  grain: 0.02,
  pureBlack: false,
};

const SYM = 3; // rotational symmetry of the whole galaxy
const PARTICLES = 150_000; // total, after symmetry
const STREAKS = 402; // total, after symmetry (134 × 3)
const STREAK_SEGS = 40;
const ARM_PITCH = 0.32; // tan(pitch angle) of the log spiral
const BULGE_R = 1.6;

const armAngle = (r: number) => Math.log(Math.max(r, 0.05) / 0.6) / ARM_PITCH;
const bandTurns = (r: number) => (r < BULGE_R ? 2 : 1); // in units of 1/SYM turn

const COMMON = /* glsl */ `
uniform float uT;        // 0..1 over the loop
uniform float uPx;       // drawing-buffer height / 1080
uniform float uFocus;    // focus distance (view space)
vec3 spin(vec3 p, float turns) {
  float a = -6.28318530718 * turns * uT / ${SYM.toFixed(1)};
  float c = cos(a), s = sin(a);
  return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
}
`;

const POINT_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
${COMMON}
in vec3 position;
in vec4 aData;   // x: turns, y: size, z: colour mix, w: brightness
in float aTw;    // twinkle phase (0 = none)
out vec3 vCol;
out float vBokeh;
uniform vec3 uColA;
uniform vec3 uColB;
void main() {
  vec3 p = spin(position, aData.x);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  float base = aData.y * uPx * (13.0 / depth);
  // Thin-lens style circle of confusion; near side (bottom of frame) blurs most.
  float invd = 1.0 / depth - 1.0 / uFocus;
  float coc = (invd > 0.0 ? invd * 210.0 : -invd * 70.0) * uPx;
  float size = max(sqrt(base * base + coc * coc), 0.8 * uPx);
  gl_PointSize = size;
  vBokeh = clamp(coc / (base + coc + 1e-4), 0.0, 1.0);
  float energy = pow(clamp(base / size, 0.0, 1.0), 1.35);
  float tw = 1.0;
  if (aTw > 0.0) {
    // Whole-number frequencies → periodic over the loop.
    tw = 0.55 + 0.45 * sin(6.28318530718 * (3.0 * uT + aTw));
  }
  vCol = mix(uColA, uColB, aData.z) * aData.w * energy * tw;
}
`;

const POINT_FRAG = /* glsl */ `
precision highp float;
in vec3 vCol;
in float vBokeh;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  if (r2 > 1.0) discard;
  float g = exp(-r2 * 4.5);
  // Bokeh disc: flat body, slightly brighter rim, soft edge.
  float r = sqrt(r2);
  float disc = (0.75 + 0.35 * smoothstep(0.55, 0.92, r)) * (1.0 - smoothstep(0.86, 1.0, r));
  float a = mix(g, disc * 0.5, vBokeh);
  outColor = vec4(vCol * a, 1.0);
}
`;

const STREAK_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 uRes;
${COMMON}
in vec3 position;  // point on the arc
in vec3 aNext;     // next point along the arc (for screen-space normal)
in vec4 aData;     // x: turns, y: u along streak (0 tail → 1 head), z: side ±1, w: width px
in float aBright;
out float vU;
out float vSide;
out float vBright;
void main() {
  vec3 p = spin(position, aData.x);
  vec3 n = spin(aNext, aData.x);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vec4 c0 = projectionMatrix * mv;
  vec4 c1 = projectionMatrix * modelViewMatrix * vec4(n, 1.0);
  vec2 s0 = c0.xy / c0.w * uRes;
  vec2 s1 = c1.xy / c1.w * uRes;
  vec2 dir = normalize(s1 - s0 + vec2(1e-6, 0.0));
  vec2 nrm = vec2(-dir.y, dir.x);
  float depth = -mv.z;
  float w = aData.w * uPx * clamp(13.0 / depth, 0.6, 2.2);
  // Taper towards the tail.
  w *= mix(0.35, 1.0, aData.y);
  c0.xy += nrm * aData.z * w / uRes * c0.w;
  gl_Position = c0;
  vU = aData.y;
  vSide = aData.z;
  // Near-side streaks are out of focus: dimmer, so they read as soft.
  float invd = max(1.0 / depth - 1.0 / uFocus, 0.0);
  vBright = aBright / (1.0 + invd * 22.0);
}
`;

const STREAK_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCol;
uniform vec3 uHot;
in float vU;
in float vSide;
in float vBright;
out vec4 outColor;
void main() {
  float across = 1.0 - vSide * vSide;           // 0 at the edges, 1 in the middle
  across = across * across;
  float along = pow(vU, 2.2);                     // fade along the tail
  float head = smoothstep(0.9, 1.0, vU) * (1.0 - smoothstep(0.985, 1.0, vU) * 0.6);
  vec3 col = uCol * along + uHot * head * 1.6 * across;
  outColor = vec4(col * across * vBright, 1.0);
}
`;

const BG_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uTop;
uniform vec3 uBottom;
in vec2 vUv;
out vec4 outColor;
void main() {
  float t = smoothstep(0.0, 1.0, vUv.y);
  vec3 c = mix(uBottom, uTop, t);
  // A soft lift behind the disk.
  float r = length((vUv - vec2(0.5, 0.42)) * vec2(1.0, 1.7));
  c += uBottom * 0.55 * exp(-r * r * 3.0);
  outColor = vec4(c, 1.0);
}
`;

const GLOW_VERT = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv * 2.0 - 1.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

// Disk-plane haze + core glow: radially symmetric, so it needs no rotation.
const HAZE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uHaze;
uniform vec3 uCore;
in vec2 vUv;
out vec4 outColor;
void main() {
  float r = length(vUv) * 13.0; // world radius
  float haze = 0.16 * exp(-r / 3.2) + 0.035 * exp(-r / 8.0);
  float core = 0.7 * exp(-r * r / 0.5) + 0.3 * exp(-r * r / 3.0);
  outColor = vec4(uHaze * haze + uCore * core, 1.0);
}
`;

const CORE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCore;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 p = vUv * vec2(1.0, 1.75); // horizontal stretch
  float r2 = dot(p, p);
  float c = 3.2 * exp(-r2 * 90.0) + 1.1 * exp(-r2 * 16.0) + 0.35 / (1.0 + r2 * 40.0);
  c *= 1.0 - smoothstep(0.7, 1.0, sqrt(r2));
  outColor = vec4(uCore * c, 1.0);
}
`;

type Built = {
  points: THREE.BufferGeometry;
  streaks: THREE.BufferGeometry;
};

const build = (): Built => {
  const rng = mulberry32(0x9a1a);
  const base = PARTICLES / SYM;
  const pos = new Float32Array(PARTICLES * 3);
  const data = new Float32Array(PARTICLES * 4);
  const tw = new Float32Array(PARTICLES);
  let k = 0;
  for (let i = 0; i < base; i++) {
    const kind = rng();
    let r: number;
    let theta: number;
    let y: number;
    let size = 1.4 + rng() * 1.6;
    let mixc = rng() * 0.35;
    let bright = 0.55 + rng() * 0.6;
    if (kind < 0.16) {
      // Bulge.
      r = Math.abs(gauss(rng)) * 1.0 + 0.05;
      theta = rng() * Math.PI * 2;
      y = gauss(rng) * 0.22 * Math.exp(-r * 0.6);
      mixc = 0.5 + rng() * 0.5;
      bright *= 1.5;
    } else if (kind < 0.88) {
      // Arm particles: denser towards the core, scattered around the arm.
      r = 0.6 + Math.pow(rng(), 1.55) * 11.5;
      // One generated arm; the 3-fold instancing below makes the other two.
      const spread = 0.1 + 0.2 * Math.min(1, r / 9);
      theta = armAngle(r) + gauss(rng) * spread;
      r += gauss(rng) * 0.25;
      y = gauss(rng) * 0.08;
      bright *= 1.1 - 0.35 * Math.min(1, r / 11);
    } else {
      // Inter-arm disk dust.
      r = 0.8 + Math.pow(rng(), 0.9) * 12.5;
      theta = rng() * Math.PI * 2;
      y = gauss(rng) * 0.1;
      bright *= 0.3;
      size *= 0.85;
    }
    // A few large bright sparkles.
    const sparkle = rng() < 0.012;
    if (sparkle) {
      size *= 2.4;
      bright *= 4.5;
      mixc = 0.85;
    }
    const twPhase = rng() < 0.08 ? 0.001 + rng() : 0;
    const turns = bandTurns(r);
    for (let s = 0; s < SYM; s++) {
      const th = theta + (s * 2 * Math.PI) / SYM;
      pos[k * 3] = Math.cos(th) * r;
      pos[k * 3 + 1] = y;
      pos[k * 3 + 2] = Math.sin(th) * r;
      data[k * 4] = turns;
      data[k * 4 + 1] = size;
      data[k * 4 + 2] = mixc;
      data[k * 4 + 3] = bright;
      tw[k] = twPhase;
      k++;
    }
  }
  const points = new THREE.BufferGeometry();
  points.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  points.setAttribute("aData", new THREE.BufferAttribute(data, 4));
  points.setAttribute("aTw", new THREE.BufferAttribute(tw, 1));

  // Streaks: arcs that follow the spiral, rotated with their band.
  const srng = mulberry32(0x57e4);
  const baseStreaks = STREAKS / SYM;
  const vertsPer = (STREAK_SEGS + 1) * 2;
  const total = STREAKS * vertsPer;
  const sp = new Float32Array(total * 3);
  const sn = new Float32Array(total * 3);
  const sd = new Float32Array(total * 4);
  const sb = new Float32Array(total);
  const idx: number[] = [];
  let v = 0;
  for (let i = 0; i < baseStreaks; i++) {
    const r0 = 2.0 + Math.pow(srng(), 0.8) * 9.5;
    const len = 0.35 + srng() * 1.1; // radians of arc
    const offs = gauss(srng) * 0.16;
    const width = 1.2 + srng() * 1.8;
    const bright = (0.6 + srng() * 1.4) * (srng() < 0.15 ? 2.2 : 1);
    const yOff = gauss(srng) * 0.05;
    const turns = bandTurns(r0);
    // Head leads in the rotation direction (rotation is towards −θ).
    const thHead = armAngle(r0) + offs;
    for (let s = 0; s < SYM; s++) {
      const start = v;
      for (let j = 0; j <= STREAK_SEGS; j++) {
        const u = j / STREAK_SEGS; // 0 tail, 1 head
        const pt = (uu: number) => {
          const th = thHead + (1 - uu) * len + (s * 2 * Math.PI) / SYM;
          // The arc drifts outwards slightly along its length, like the arms.
          const rr = r0 * (1 + (1 - uu) * len * ARM_PITCH * 0.6);
          return [Math.cos(th) * rr, yOff, Math.sin(th) * rr];
        };
        const a = pt(u);
        const bb = pt(u + 0.5 / STREAK_SEGS);
        for (const side of [-1, 1]) {
          sp.set(a, v * 3);
          sn.set(bb, v * 3);
          sd.set([turns, u, side, width], v * 4);
          sb[v] = bright;
          v++;
        }
      }
      for (let j = 0; j < STREAK_SEGS; j++) {
        const a = start + j * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const streaks = new THREE.BufferGeometry();
  streaks.setAttribute("position", new THREE.BufferAttribute(sp, 3));
  streaks.setAttribute("aNext", new THREE.BufferAttribute(sn, 3));
  streaks.setAttribute("aData", new THREE.BufferAttribute(sd, 4));
  streaks.setAttribute("aBright", new THREE.BufferAttribute(sb, 1));
  streaks.setIndex(idx);
  return { points, streaks };
};

// Built once at module level from fixed seeds.
let BUILT: Built | null = null;
const getBuilt = () => (BUILT ??= build());

export class GalaxyLook implements Look {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(44, 16 / 9, 0.1, 200);
  bgQuad = new FullScreenQuad();
  bgMat: THREE.RawShaderMaterial;
  common: Record<string, THREE.IUniform>;
  streakMat: THREE.RawShaderMaterial;

  constructor(c: GalaxyColours) {
    const built = getBuilt();
    const elev = (20 * Math.PI) / 180;
    const dist = 14;
    this.camera.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
    this.camera.lookAt(0, -0.55, 0);
    this.camera.updateMatrixWorld();

    this.common = {
      uT: { value: 0 },
      uPx: { value: 1 },
      uFocus: { value: dist },
    };
    this.bgMat = rawMat(BG_FRAG, { uTop: { value: bg(c.bgTop) }, uBottom: { value: bg(c.bgBottom) } });

    const add = { blending: THREE.AdditiveBlending, depthTest: false, depthWrite: false, transparent: true };

    const haze = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26).rotateX(-Math.PI / 2),
      rawMat(HAZE_FRAG, { uHaze: { value: lin(c.haze) }, uCore: { value: lin(c.core) } }, add, GLOW_VERT),
    );
    haze.renderOrder = 0;

    const points = new THREE.Points(
      built.points,
      rawMat(
        POINT_FRAG,
        { ...this.common, uColA: { value: lin(c.particleA) }, uColB: { value: lin(c.particleB) } },
        add,
        POINT_VERT,
      ),
    );
    points.frustumCulled = false;
    points.renderOrder = 1;

    this.streakMat = rawMat(
      STREAK_FRAG,
      { ...this.common, uRes: { value: new THREE.Vector2(1, 1) }, uCol: { value: lin(c.streak) }, uHot: { value: lin(c.particleB) } },
      { ...add, side: THREE.DoubleSide },
      STREAK_VERT,
    );
    const streaks = new THREE.Mesh(built.streaks, this.streakMat);
    streaks.frustumCulled = false;
    streaks.renderOrder = 2;

    // Core: camera-facing billboard at the centre.
    const core = new THREE.Mesh(
      new THREE.PlaneGeometry(5.5, 5.5),
      rawMat(CORE_FRAG, { uCore: { value: lin(c.core) } }, add, GLOW_VERT),
    );
    core.quaternion.copy(this.camera.quaternion);
    core.renderOrder = 3;

    this.scene.add(haze, points, streaks, core);
  }

  render(gl: THREE.WebGLRenderer, _pipe: PostPipeline, f: FrameInfo) {
    this.camera.aspect = f.width / f.height;
    this.camera.updateProjectionMatrix();
    this.common.uT.value = f.frame / GALAXY_LOOP;
    this.common.uPx.value = f.px;
    this.streakMat.uniforms.uRes.value.set(f.width / 2, f.height / 2);
    this.bgQuad.render(gl, this.bgMat);
    gl.render(this.scene, this.camera);
  }

  dispose() {
    this.bgQuad.dispose();
    this.bgMat.dispose();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) (o.material as THREE.Material).dispose();
    });
  }
}

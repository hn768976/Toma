import * as THREE from "three";
import { HorizonColorway } from "../colorways";
import { Bloom } from "../common/Bloom";
import { hexToLinear } from "../common/color";
import { LOOP } from "../common/constants";
import { FullscreenPass, TargetCache } from "../common/FullscreenPass";
import { GRAIN_DITHER, HASH, LINEAR_TO_SRGB } from "../common/glsl";
import { LoopRenderer } from "../common/GLLoop";
import { mulberry32, range } from "../common/rng";

// =============================================================================
// Seeded layout (module level — identical on every render thread)
// =============================================================================
const STREAKS = 3000;
const SEGMENTS = 72; // subdivisions along each ribbon
const Z_NEAR = 30; // ribbons run from z = Z_NEAR (behind camera) ...
const Z_FAR = -520; // ... to z = Z_FAR (towards the vanishing point)
const HEADS_LINES = 340; // lines that carry bright head points
const HEAD_WINDOW = 16; // world units along the line where heads are drawn
const BOKEH = 14;

const rng = mulberry32(0x5eed1234);

type Streak = {
  x: number;
  y: number;
  base: number;
  width: number;
  period: number;
  duty: number;
  speed: number; // whole number of periods travelled per loop
  seed: number;
  hot: number;
};

const STREAK_DATA: Streak[] = Array.from({ length: STREAKS }, () => {
  // Lateral position: denser near the camera's line of sight, long tail to the
  // right so the plane fills the frame out to the horizon.
  const r = rng();
  const x = -0.6 + 72 * Math.pow(r, 1.1);
  return {
    x,
    y: range(rng, -0.09, 0.03),
    base: rng() < 0.65 ? range(rng, 0.0, 0.02) : range(rng, 0.03, 0.09),
    width: range(rng, 0.0035, 0.009),
    period: range(rng, 2.5, 12),
    duty: range(rng, 0.2, 0.7),
    speed: 2 + Math.floor(rng() * 4), // 2..5 whole repeats per 20 s
    seed: rng(),
    hot: Math.pow(rng(), 2.5),
  };
});

type Head = { line: Streak; m: number; size: number; bright: number; window: number };
const HEAD_DATA: Head[] = [];
for (let i = 0; i < HEADS_LINES; i++) {
  const line = STREAK_DATA[Math.floor(rng() * STREAKS)];
  // One point per dash inside the window; the window is a whole number of
  // periods long, so the *set* of points at frame 600 equals frame 0.
  const count = Math.max(1, Math.round(HEAD_WINDOW / line.period));
  const size = range(rng, 0.012, 0.03);
  const bright = range(rng, 1.2, 3.0);
  const window = count * line.period;
  for (let m = 0; m < count; m++) HEAD_DATA.push({ line, m, size, bright, window });
}

type Bokeh = {
  x: number;
  y: number;
  ax: number;
  ay: number;
  fx: number; // whole cycles per loop
  fy: number;
  px: number;
  py: number;
  r: number;
  a: number;
};
// A few large, soft lens discs in front of the plane.
const BOKEH_DATA: Bokeh[] = Array.from({ length: BOKEH }, () => {
  return {
    x: range(rng, -1.05, 1.05),
    y: range(rng, -1.0, 0.55),
    ax: range(rng, 0.02, 0.08),
    ay: range(rng, 0.015, 0.05),
    fx: 1 + Math.floor(rng() * 2),
    fy: 1 + Math.floor(rng() * 2),
    px: rng() * Math.PI * 2,
    py: rng() * Math.PI * 2,
    r: range(rng, 18, 42), // px at 720p
    a: range(rng, 0.07, 0.16),
  };
});

// =============================================================================
// Camera
// =============================================================================
const CAM_HEIGHT = 0.3;
const YAW = THREE.MathUtils.degToRad(37); // look right of the streak direction
const PITCH = THREE.MathUtils.degToRad(10.2);
const ROLL = THREE.MathUtils.degToRad(0.35);
const VFOV = 38;

// =============================================================================
// Shaders
// =============================================================================
const BG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec2 uRes;
uniform vec2 uH0;     // a point on the horizon (uv, y up)
uniform vec2 uHN;     // horizon normal pointing up (aspect-corrected space)
uniform vec3 cSky, cSkyH, cGround, cStreak, cHorizon;
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  vec2 h0 = vec2(uH0.x * aspect, uH0.y);
  float dh = dot(p - h0, uHN);           // + above horizon, in screen heights
  float along = dot(p - h0, vec2(uHN.y, -uHN.x)) / aspect + uH0.x; // ~uv.x along the line
  vec3 col;
  if (dh > 0.0) {
    col = mix(cSkyH, cSky, smoothstep(0.0, 0.14, dh));
  } else {
    float g = -dh;
    col = mix(cStreak * 0.55, cGround, smoothstep(0.0, 0.55, g));
    col = mix(col, cGround * 0.55, smoothstep(0.45, 0.8, g));
  }
  // Horizon line: thin hot core + soft glow, brightest left of centre.
  float lineI = 0.1 + 1.35 * exp(-pow((along - 0.27) / 0.2, 2.0));
  float core = exp(-pow(dh / 0.0045, 2.0));
  float glow = exp(-abs(dh) / 0.012) * 0.3 * (dh > 0.0 ? 1.0 : 0.6);
  col += cHorizon * (core * 1.8 + glow) * lineI;
  outColor = vec4(col, 1.0);
}
`;

const STREAK_VERT = /* glsl */ `
precision highp float;
in vec3 position;           // x = s (0..1 along), y = side (-1/1)
in vec4 aLine;              // x, y, base brightness, world width
in vec4 aDash;              // period, duty, speed (whole repeats), seed
in float aHot;
uniform mat4 viewMatrix, projectionMatrix;
uniform vec2 uRes;
uniform float uFocalPx, uPx, uNear, uZNear, uZFar;
uniform float uFocus, uBlurPx;
out float vAcross;
out float vU;
out float vEnergy;
out float vDepth;
out vec4 vDash;
out float vBase;
out float vHot;

vec2 toPx(vec4 c) { return c.xy / c.w * 0.5 * uRes; }

void main() {
  float s = position.x;
  float side = position.y;
  float z = mix(uZNear, uZFar, s * s);
  vec3 V0 = (viewMatrix * vec4(aLine.x, aLine.y, 0.0, 1.0)).xyz;
  vec3 Dz = (viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz;
  // Keep every vertex in front of the camera (depth >= uNear).
  float zMax = (-uNear - V0.z) / Dz.z;
  z = min(z, zMax);
  vec3 V = V0 + Dz * z;
  vec3 Vn = V0 + Dz * (z - 0.25);
  vec4 C = projectionMatrix * vec4(V, 1.0);
  vec4 Cn = projectionMatrix * vec4(Vn, 1.0);
  vec2 sp = toPx(C);
  vec2 d = toPx(Cn) - sp;
  vec2 dir = length(d) > 1e-5 ? normalize(d) : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);
  float depth = -V.z;
  float physPx = aLine.w * uFocalPx / depth;
  float corePx = max(physPx, 0.65 * uPx);
  // Circle of confusion: strong in front of the focus plane, mild far away.
  float nearT = clamp((uFocus - depth) / (uFocus - uNear), 0.0, 1.0);
  float coc = uBlurPx * uPx * pow(nearT, 1.6) + 0.6 * uPx * clamp((depth - uFocus) / 80.0, 0.0, 1.0);
  float halfW = corePx + coc;
  // Energy conservation: total light per unit length ~ physical width.
  vEnergy = physPx / halfW;
  float ext = halfW + 1.0 * uPx;
  sp += nrm * side * ext;
  vAcross = side * ext / halfW;
  gl_Position = vec4(sp / (0.5 * uRes) * C.w, C.z, C.w);
  vU = -z;
  vDepth = depth;
  vDash = aDash;
  vBase = aLine.z;
  vHot = aHot;
}
`;

const STREAK_FRAG = /* glsl */ `
precision highp float;
in float vAcross;
in float vU;
in float vEnergy;
in float vDepth;
in vec4 vDash;
in float vBase;
in float vHot;
out vec4 outColor;
uniform float uPhase;
uniform vec3 cStreak, cHot;
uniform float uGain;
void main() {
  float P = vDash.x;
  float duty = vDash.y;
  float f = fract((vU + vDash.z * P * uPhase) / P + vDash.w);
  float g = f / duty;
  float dash = g < 1.0 ? pow(1.0 - g, 1.7) * smoothstep(0.0, 0.012, f) : 0.0;
  // Anti-alias far away: fade the dash pattern to its mean when a period
  // shrinks below a few pixels.
  float w = fwidth(vU) / P;
  dash = mix(dash, duty * 0.37, smoothstep(0.04, 0.25, w));
  float prof = exp(-2.2 * vAcross * vAcross) * mix(1.0, 0.75, smoothstep(0.0, 1.0, 1.0 - vEnergy));
  float fog = 1.0 / (1.0 + pow(vDepth / 14.0, 1.7));
  float I = (vBase + dash * 1.5) * vEnergy * prof * fog * uGain;
  // Only the very tip of a bright dash goes towards the hot (white-cyan) colour.
  vec3 col = mix(cStreak, cHot, clamp((0.6 * dash + pow(dash, 4.0) * vHot) * smoothstep(40.0, 8.0, vDepth), 0.0, 1.0));
  outColor = vec4(col * I, 1.0);
}
`;

const HEAD_VERT = /* glsl */ `
precision highp float;
in vec3 position;           // quad corner (-1..1)
in vec4 aLine;              // x, y, period, speed
in vec4 aHead;              // seed, m, size, bright
in vec2 aWin;               // window start, length (whole number of periods)
uniform mat4 viewMatrix, projectionMatrix;
uniform vec2 uRes;
uniform float uFocalPx, uPx, uNear, uPhase;
uniform float uFocus, uBlurPx;
out vec2 vQ;
out float vI;
void main() {
  float P = aLine.z;
  // Head of dash m: (u + speed*P*phase)/P + seed is an integer.
  float u0 = P * (aHead.y - aHead.x) - aLine.w * P * uPhase;
  float uUMin = aWin.x;
  float uWindow = aWin.y;
  float u = uUMin + mod(u0 - uUMin, uWindow);
  vec3 W = vec3(aLine.x, aLine.y, -u);
  vec3 V = (viewMatrix * vec4(W, 1.0)).xyz;
  float depth = -V.z;
  vec4 C = projectionMatrix * vec4(V, 1.0);
  float physPx = aHead.z * uFocalPx / max(depth, 0.01);
  float corePx = max(physPx, 1.0 * uPx);
  float nearT = clamp((uFocus - depth) / (uFocus - uNear), 0.0, 1.0);
  float coc = uBlurPx * uPx * pow(nearT, 1.6);
  float r = corePx + coc;
  vec2 sp = C.xy / C.w * 0.5 * uRes + position.xy * r * 2.5;
  gl_Position = vec4(sp / (0.5 * uRes) * C.w, C.z, C.w);
  if (depth < uNear) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vQ = position.xy * 2.5;
  float edge = smoothstep(uUMin, uUMin + uWindow * 0.25, u) * (1.0 - smoothstep(uUMin + uWindow * 0.6, uUMin + uWindow, u));
  vI = aHead.w * smoothstep(1.4, 2.6, depth) * smoothstep(20.0, 5.0, depth) * min(physPx * physPx / (r * r), 1.0) * edge / (1.0 + depth / 45.0);
}
`;

const HEAD_FRAG = /* glsl */ `
precision highp float;
in vec2 vQ;
in float vI;
out vec4 outColor;
uniform vec3 cHot, cStreak;
void main() {
  float d2 = dot(vQ, vQ);
  float core = exp(-3.0 * d2);
  float halo = exp(-0.6 * d2) * 0.18;
  outColor = vec4((mix(cHot, vec3(1.0), 0.35) * core * 1.6 + cHot * halo) * vI, 1.0);
}
`;

const BOKEH_VERT = /* glsl */ `
precision highp float;
in vec3 position;
in vec4 aBokeh;   // ndc x, ndc y, radius px@720, alpha
uniform vec2 uRes;
uniform float uPx;
out vec2 vQ;
out float vA;
out float vR;
void main() {
  float r = aBokeh.z * uPx;
  vec2 sp = aBokeh.xy * 0.5 * uRes + position.xy * (r + 1.5 * uPx);
  gl_Position = vec4(sp / (0.5 * uRes), 0.0, 1.0);
  vQ = position.xy * (r + 1.5 * uPx) / r;
  vA = aBokeh.w;
  vR = r;
}
`;

const BOKEH_FRAG = /* glsl */ `
precision highp float;
in vec2 vQ;
in float vA;
in float vR;
out vec4 outColor;
uniform vec3 cBokeh;
void main() {
  float d = length(vQ);
  float soft = clamp(0.5 + 2.0 / vR, 0.0, 0.85);
  float disc = 1.0 - smoothstep(1.0 - soft, 1.0, d);
  float rim = 0.0;
  outColor = vec4(cBokeh * (disc * 0.75 + rim) * vA, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tScene;
uniform sampler2D tBloom;
uniform float uBloom;
${HASH}
${LINEAR_TO_SRGB}
${GRAIN_DITHER}
float shoulder(float x) {
  // Identity below 0.6, smooth roll-off to 1.0 above (keeps the flat sky exact).
  const float a = 0.6;
  return x < a ? x : a + (1.0 - a) * (1.0 - exp(-(x - a) / (1.0 - a)));
}
void main() {
  vec3 c = texture(tScene, vUv).rgb + texture(tBloom, vUv).rgb * uBloom;
  // Very hot values bleed towards white (cyan-white cores like the reference).
  // Hue-preserving roll-off on the peak channel, then hot values bleed to
  // white (cyan-white cores, like real over-exposed light trails).
  float peak = max(c.b, max(c.g, c.r));
  float over = max(peak - 1.0, 0.0);
  c *= shoulder(peak) / max(peak, 1e-5);
  c = mix(c, vec3(0.55, 0.9, 1.0), clamp(over * 0.05, 0.0, 0.3));
  outColor = vec4(grainDither(linearToSrgb(c)), 1.0);
}
`;

// =============================================================================
// Geometry builders
// =============================================================================
const quadGeometry = () => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0]), 3),
  );
  return g;
};

const streakGeometry = () => {
  const g = new THREE.InstancedBufferGeometry();
  const pos: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const s0 = i / SEGMENTS;
    const s1 = (i + 1) / SEGMENTS;
    pos.push(s0, -1, 0, s1, -1, 0, s1, 1, 0, s0, -1, 0, s1, 1, 0, s0, 1, 0);
  }
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  const line = new Float32Array(STREAKS * 4);
  const dash = new Float32Array(STREAKS * 4);
  const hot = new Float32Array(STREAKS);
  STREAK_DATA.forEach((s, i) => {
    line.set([s.x, s.y, s.base, s.width], i * 4);
    dash.set([s.period, s.duty, s.speed, s.seed], i * 4);
    hot[i] = s.hot;
  });
  g.setAttribute("aLine", new THREE.InstancedBufferAttribute(line, 4));
  g.setAttribute("aDash", new THREE.InstancedBufferAttribute(dash, 4));
  g.setAttribute("aHot", new THREE.InstancedBufferAttribute(hot, 1));
  g.instanceCount = STREAKS;
  return g;
};

const headGeometry = () => {
  const g = quadGeometry();
  const line = new Float32Array(HEAD_DATA.length * 4);
  const head = new Float32Array(HEAD_DATA.length * 4);
  const win = new Float32Array(HEAD_DATA.length * 2);
  HEAD_DATA.forEach((h, i) => {
    // The window sits where the line crosses the view (u ~ x for this yaw).
    win.set([h.line.x * 0.9 - 4, h.window], i * 2);
    line.set([h.line.x, h.line.y, h.line.period, h.line.speed], i * 4);
    head.set([h.line.seed, h.m, h.size, h.bright], i * 4);
  });
  g.setAttribute("aLine", new THREE.InstancedBufferAttribute(line, 4));
  g.setAttribute("aHead", new THREE.InstancedBufferAttribute(head, 4));
  g.setAttribute("aWin", new THREE.InstancedBufferAttribute(win, 2));
  g.instanceCount = HEAD_DATA.length;
  return g;
};

// =============================================================================
// Renderer
// =============================================================================
export class HorizonStreaksRenderer implements LoopRenderer {
  private targets = new TargetCache();
  private bloom = new Bloom(6);
  private bg: FullscreenPass;
  private final: FullscreenPass;
  private scene = new THREE.Scene();
  private overlay = new THREE.Scene();
  private overlayCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private camera = new THREE.PerspectiveCamera(VFOV, 16 / 9, 0.05, 2000);
  private streakMat: THREE.RawShaderMaterial;
  private headMat: THREE.RawShaderMaterial;
  private bokehMat: THREE.RawShaderMaterial;
  private bokehAttr: THREE.InstancedBufferAttribute;
  private shared: Record<string, THREE.IUniform>;
  private geoms: THREE.BufferGeometry[] = [];

  constructor(cw: HorizonColorway) {
    const v3 = (hex: string) => new THREE.Vector3(...hexToLinear(hex));
    this.shared = {
      uRes: { value: new THREE.Vector2(1, 1) },
      uFocalPx: { value: 1 },
      uPx: { value: 1 },
      uNear: { value: 0.3 },
      uZNear: { value: Z_NEAR },
      uZFar: { value: Z_FAR },
      uPhase: { value: 0 },
      uFocus: { value: 1.8 },
      uBlurPx: { value: 60 },
      uGain: { value: 0.36 },
      cStreak: { value: v3(cw.streak) },
      cHot: { value: v3(cw.streakHot) },
      cBokeh: { value: v3(cw.streakHot).lerp(new THREE.Vector3(1, 1, 1), 0.15) },
    };
    const additive = (vertexShader: string, fragmentShader: string) =>
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader,
        fragmentShader,
        uniforms: this.shared,
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
    this.streakMat = additive(STREAK_VERT, STREAK_FRAG);
    this.headMat = additive(HEAD_VERT, HEAD_FRAG);
    this.bokehMat = additive(BOKEH_VERT, BOKEH_FRAG);

    const sg = streakGeometry();
    const hg = headGeometry();
    const bg = quadGeometry();
    this.bokehAttr = new THREE.InstancedBufferAttribute(new Float32Array(BOKEH * 4), 4);
    bg.setAttribute("aBokeh", this.bokehAttr);
    bg.instanceCount = BOKEH;
    this.geoms.push(sg, hg, bg);
    for (const [g, m, sc] of [
      [sg, this.streakMat, this.scene],
      [hg, this.headMat, this.scene],
      [bg, this.bokehMat, this.overlay],
    ] as const) {
      const mesh = new THREE.Mesh(g, m);
      mesh.frustumCulled = false;
      sc.add(mesh);
    }

    this.bg = new FullscreenPass(BG_FRAG, {
      uRes: this.shared.uRes,
      uH0: { value: new THREE.Vector2() },
      uHN: { value: new THREE.Vector2(0, 1) },
      cSky: { value: v3(cw.sky) },
      cSkyH: { value: v3(cw.skyHorizon) },
      cGround: { value: v3(cw.ground) },
      cStreak: { value: v3(cw.streak) },
      cHorizon: { value: v3(cw.horizon) },
    });
    this.final = new FullscreenPass(FINAL_FRAG, {
      tScene: { value: null },
      tBloom: { value: null },
      uBloom: { value: 0.8 },
      uGrainFrame: { value: 0 },
      uGrain: { value: 0.02 },
    });
  }

  private placeCamera(phase: number, aspect: number) {
    const cam = this.camera;
    cam.aspect = aspect;
    cam.fov = VFOV;
    cam.updateProjectionMatrix();
    // Steady, with a barely-there sway (whole cycles per loop).
    const a = phase * Math.PI * 2;
    cam.position.set(0.02 * Math.sin(a), CAM_HEIGHT + 0.006 * Math.sin(2 * a), 0);
    cam.rotation.order = "YXZ";
    cam.rotation.set(-PITCH + 0.002 * Math.sin(a + 1), -YAW + 0.003 * Math.cos(a), ROLL);
    cam.updateMatrixWorld(true);
  }

  render(gl: THREE.WebGLRenderer, frame: number, w: number, h: number) {
    const f = frame % LOOP;
    const phase = f / LOOP;
    const aspect = w / h;
    this.placeCamera(phase, aspect);
    const u = this.shared;
    u.uRes.value.set(w, h);
    u.uPx.value = h / 720;
    u.uFocalPx.value = (0.5 * h) / Math.tan(THREE.MathUtils.degToRad(VFOV) / 2);
    u.uPhase.value = phase;

    // Horizon line on screen: project two far points at camera height.
    const cam = this.camera;
    const proj = (yaw: number) => {
      const p = new THREE.Vector3(
        cam.position.x + 1e5 * Math.sin(yaw),
        cam.position.y,
        cam.position.z - 1e5 * Math.cos(yaw),
      ).project(cam);
      return new THREE.Vector2(p.x * 0.5 + 0.5, p.y * 0.5 + 0.5);
    };
    const a = proj(YAW - 0.3);
    const b = proj(YAW + 0.3);
    const dir = new THREE.Vector2((b.x - a.x) * aspect, b.y - a.y).normalize();
    this.bg.uniforms.uH0.value.copy(a);
    this.bg.uniforms.uHN.value.set(-dir.y, dir.x);

    // Bokeh on closed paths.
    const arr = this.bokehAttr.array as Float32Array;
    BOKEH_DATA.forEach((bk, i) => {
      const t = phase * Math.PI * 2;
      arr[i * 4] = bk.x + bk.ax * Math.sin(bk.fx * t + bk.px);
      arr[i * 4 + 1] = bk.y + bk.ay * Math.cos(bk.fy * t + bk.py);
      arr[i * 4 + 2] = bk.r;
      arr[i * 4 + 3] = bk.a;
    });
    this.bokehAttr.needsUpdate = true;

    const sceneRT = this.targets.get("scene", w, h);
    this.bg.render(gl, sceneRT);
    gl.setRenderTarget(sceneRT);
    gl.render(this.scene, cam);
    gl.render(this.overlay, this.overlayCam);

    const bloomTex = this.bloom.render(gl, sceneRT, 0.12);
    this.final.uniforms.tScene.value = sceneRT.texture;
    this.final.uniforms.tBloom.value = bloomTex;
    this.final.uniforms.uGrainFrame.value = f;
    this.final.render(gl, null);
  }

  dispose() {
    this.targets.dispose();
    this.bloom.dispose();
    this.bg.dispose();
    this.final.dispose();
    this.streakMat.dispose();
    this.headMat.dispose();
    this.bokehMat.dispose();
    this.geoms.forEach((g) => g.dispose());
  }
}

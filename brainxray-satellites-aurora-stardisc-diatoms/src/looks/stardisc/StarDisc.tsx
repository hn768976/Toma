import { Container, RenderTexture } from "pixi.js";
import React, { useMemo } from "react";
import { fullscreenMesh, GLSL_HEADER, ShaderMesh } from "../../lib/pixi/helpers";
import { makeInstanced } from "../../lib/pixi/instanced";
import { PixiCanvas, PixiLook } from "../../lib/pixi/PixiCanvas";
import { gauss, loopPhase, mulberry32, range, TAU } from "../../lib/rand";

export type StarDiscParams = {
  core: string; // star core
  glow: string; // big warm glow
  dust: string; // dust tint
  particles: number;
};

const hex = (h: string) => {
  const n = parseInt(h.replace("#", ""), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// ------------------------------------------------------------------ disc data
// Radial density with rings and 2-3 clear gaps (fraction of the outer radius).
const RINGS: { r: number; w: number; d: number }[] = [
  { r: 0.33, w: 0.022, d: 0.7 }, // ring close around the star
  { r: 0.55, w: 0.04, d: 0.45 }, // middle ring
  { r: 0.86, w: 0.06, d: 1.0 }, // wide outer band
];
const GAPS: { r: number; w: number }[] = [
  { r: 0.42, w: 0.03 },
  { r: 0.72, w: 0.025 },
];
const density = (r: number) => {
  let d = 0.22;
  for (const g of RINGS) d += g.d * Math.exp(-Math.pow((r - g.r) / g.w, 2));
  for (const g of GAPS) d *= 1 - 0.5 * Math.exp(-Math.pow((r - g.r) / g.w, 4));
  if (r < 0.28) d *= Math.pow(r / 0.28, 4);
  if (r > 0.94) d *= 0.08 + 0.92 * Math.exp(-(r - 0.94) / 0.04);
  return d;
};
/** Whole turns per 600 frames for the band containing r (inner bands faster). */
export const bandTurns = (r: number) => Math.max(1, Math.min(4, Math.round(1.2 * Math.pow(0.42 / r, 1.5))));

const FPI = 8;
const buildDisc = (count: number) => {
  const r = mulberry32(31337);
  const data = new Float32Array(count * FPI);
  let n = 0;
  while (n < count) {
    const rr = 0.06 + r() * 1.2;
    if (r() * 1.15 > density(rr)) continue;
    const rock = r() < 0.05;
    const o = n * FPI;
    data[o] = rr + gauss(r) * 0.004; // radius
    data[o + 1] = r() * TAU; // phase angle
    data[o + 2] = gauss(r) * 0.006 * (0.6 + rr); // height above plane
    data[o + 3] = rock ? range(r, 4, 10) * (r() < 0.15 ? 1.6 : 1) : Math.pow(r(), 5) * 1.4 + 0.6; // size (design px at 4K)
    data[o + 4] = rock ? range(r, 0.5, 0.9) : range(r, 0.25, 1.0); // albedo
    data[o + 5] = bandTurns(rr); // turns per loop
    data[o + 6] = rock ? 1 : 0;
    data[o + 7] = r() * 1000; // seed
    n++;
  }
  return data;
};

// ------------------------------------------------------------------ shaders
const DISC_VERT = /* glsl */ `${GLSL_HEADER}
in vec2 aPosition;
in vec4 aI0; // radius, angle0, height, size
in vec4 aI1; // albedo, turns, rock, seed
out vec2 vC;
out float vI;
out float vRock;
out float vSeed;
out float vWarm;
out vec2 vLit;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform mat4 uVP;
uniform float uPhase;
uniform float uRadius;   // world radius of the disc
uniform float uPxScale;  // backing px per design px
uniform vec2 uDesign;
void main() {
  float a = aI0.y + 6.28318530718 * aI1.y * uPhase;
  vec3 P = vec3(cos(a) * aI0.x, aI0.z, sin(a) * aI0.x) * uRadius;
  vec4 clip = uVP * vec4(P, 1.0);
  vec2 ndc = clip.xy / clip.w;
  vec2 sp = vec2((ndc.x * 0.5 + 0.5) * uDesign.x, (0.5 - ndc.y * 0.5) * uDesign.y);
  // perspective size; never smaller than ~1.3 backing px (energy kept)
  float persp = 2.4 / clip.w;
  float sizePx = aI0.w * persp * (aI1.z > 0.5 ? 1.0 : 1.0);
  float minPx = 1.0 / uPxScale;
  float s = max(sizePx, minPx);
  float energy = (sizePx * sizePx) / (s * s);
  vec2 p = sp + aPosition * s;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(p, 1.0)).xy, 0.0, 1.0);
  vC = aPosition;
  // lit from the star: brighter inside, a little forward-scatter on the far side
  float rr = aI0.x;
  float light = 0.22 / (0.35 + rr);
  float far = clamp(sin(a), -1.0, 1.0);
  vI = aI1.x * light * (0.85 + 0.25 * far) * energy;
  vRock = aI1.z;
  vSeed = aI1.w;
  vWarm = exp(-rr * 4.0);
  vLit = normalize(uDesign * 0.5 - sp + vec2(0.001)) * 0.8;
  if (clip.w < 0.05) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
const DISC_FRAG = /* glsl */ `${GLSL_HEADER}
in vec2 vC;
in float vI;
in float vRock;
in float vSeed;
in float vWarm;
in vec2 vLit;
out vec4 finalColor;
uniform vec3 uDust;
uniform vec3 uGlow;
void main() {
  float r2 = dot(vC, vC);
  if (r2 > 1.0) discard;
  float m;
  if (vRock > 0.5) {
    // lumpy lit rock: irregular outline, brighter on the star side
    float ang = atan(vC.y, vC.x);
    float edge = 0.78 + 0.12 * sin(ang * 3.0 + vSeed) + 0.07 * sin(ang * 5.0 + vSeed * 1.7);
    float d = length(vC) / edge;
    // shaded chunk: lit edge facing the star (toward screen centre/up), dark side
    vec2 L = normalize(vec2(0.0, -1.0) + vLit);
    float lit = clamp(dot(vC, L) * 0.9 + 0.35, 0.08, 1.0);
    m = smoothstep(1.0, 0.85, d) * lit * 2.2;
  } else {
    m = smoothstep(1.0, 0.6, r2);
  }
  vec3 c = mix(uDust, uGlow, vWarm * 0.18) * m * vI;
  finalColor = vec4(c, 0.0);
}`;

// Star, lens streak, rays, ghosts and faint background stars (additive pass).
const STAR = /* glsl */ `${GLSL_HEADER}
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uDisc;
uniform vec2 uStar;   // star position (design px)
uniform vec3 uCore;
uniform vec3 uGlow;
uniform float uTheta;
uniform float uZoom;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main() {
  vec2 p = vUV * vec2(3840.0, 2160.0);
  vec3 col = texture(uDisc, vUV).rgb;
  // faint background stars (static, from a fixed lattice)
  vec2 cell = floor(p / 48.0);
  float h = hash(cell);
  if (h > 0.86) {
    vec2 sp = (cell + vec2(hash(cell + 3.1), hash(cell + 7.7))) * 48.0;
    float d = length(p - sp);
    col += vec3(0.75, 0.78, 0.85) * pow(hash(cell + 1.3), 8.0) * 0.5 * exp(-d * d / 6.0);
  }
  vec2 d = (p - uStar) / 2160.0;
  float r = length(d);
  float pulse = 1.0 + 0.04 * sin(uTheta * 3.0);
  float z = uZoom;
  // warm haze lifting the whole frame, stronger around the star
  col += uGlow * (0.01 + 0.025 * exp(-r / (0.3 * z)));
  // small white-hot core inside a large amber halo
  col += vec3(1.0, 0.97, 0.9) * exp(-r * r / (0.00012 * z * z)) * 2.0 * pulse;
  col += uCore * exp(-r / (0.01 * z)) * 0.8;
  vec3 salmon = mix(uGlow, vec3(1.0, 0.62, 0.48), 0.35);
  col += salmon * exp(-r / (0.075 * z)) * 0.9;
  col += salmon * exp(-r / (0.12 * z)) * 0.22;
  // soft ray burst fanning mainly upward, faint below
  float a = atan(d.x, -d.y); // 0 = straight up
  float up = 0.65 + 0.35 * smoothstep(0.0, -0.15, d.y);
  float rays = pow(0.5 + 0.5 * cos(a * 7.0), 6.0) * 0.6 + pow(0.5 + 0.5 * cos(a * 11.0 + 1.3), 10.0) * 0.4;
  col += mix(uGlow, uCore, 0.25) * rays * exp(-r / (0.22 * z)) * 0.35 * up * pulse;
  // thin sharp spikes in all directions, long ones reaching down past the disc
  float spikes = pow(abs(cos(a * 6.0 + 0.3)), 400.0) + 0.6 * pow(abs(cos(a * 9.0 + 1.1)), 600.0);
  float down = 1.0 + 1.5 * smoothstep(0.85, 1.0, abs(cos(a)) * step(0.0, d.y));
  col += mix(uGlow, uCore, 0.5) * spikes * exp(-r / (0.09 * z * down)) * 0.3 * pulse;
  // stacked anamorphic streaks (orange-pink), the main one across the frame
  float sy = d.y;
  float streak = exp(-abs(sy) / 0.004) * exp(-abs(d.x) / 0.6) * 0.8
               + exp(-abs(sy - 0.009) / 0.0018) * exp(-abs(d.x) / 0.45) * 0.9
               + exp(-abs(sy + 0.008) / 0.0018) * exp(-abs(d.x) / 0.4) * 0.8
               + exp(-abs(sy - 0.018) / 0.0016) * exp(-abs(d.x) / 0.25) * 0.5
               + exp(-abs(sy) / 0.015) * exp(-abs(d.x) / 0.8) * 0.15;
  col += mix(uGlow, vec3(1.0, 0.62, 0.55), 0.45) * streak * pulse;
  // lens ghosts on a diagonal toward the lower left
  for (int i = 0; i < 5; i++) {
    float t = 0.9 + float(i) * 0.28;
    vec2 gp = uStar + vec2(-0.43, 0.3) * t * 2160.0;
    float gr = (60.0 + float(i) * 14.0);
    float gd = length(p - gp) / gr;
    // hexagonal soft ghost
    vec2 gq = (p - gp) / gr; float hx = max(abs(gq.x) * 0.866 + abs(gq.y) * 0.5, abs(gq.y));
    col += mix(uGlow, vec3(0.6, 0.6, 0.25), float(i % 2) * 0.5) * 0.09 * smoothstep(1.0, 0.55, hx);
  }
  finalColor = vec4(col, 1.0);
}`;

// Large out-of-focus rocks drifting past near the camera.
const FG_VERT = /* glsl */ `${GLSL_HEADER}
in vec2 aPosition;
in vec4 aI0; // x, y, radius, alpha
in vec4 aI1;
out vec2 vC;
out float vA;
out float vS;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  vec2 p = aI0.xy + aPosition * aI0.z;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(p, 1.0)).xy, 0.0, 1.0);
  vC = aPosition; vA = aI0.w; vS = aI1.x;
}`;
const FG_FRAG = /* glsl */ `${GLSL_HEADER}
in vec2 vC;
in float vA;
in float vS;
out vec4 finalColor;
uniform vec3 uGlow;
void main() {
  float ang = atan(vC.y, vC.x);
  float e = 0.8 + 0.1 * sin(ang * 3.0 + vS) + 0.06 * sin(ang * 5.0 + vS * 2.0);
  float d = length(vC) / e;
  float m = smoothstep(1.0, 0.55, d);
  // dark body with a faint warm rim facing the star (upper side)
  float rim = smoothstep(0.55, 0.95, d) * m * clamp(-vC.y * 0.8 + 0.3, 0.0, 1.0);
  vec3 c = uGlow * rim * 0.05;
  finalColor = vec4(c * vA, m * vA * 0.85);
}`;

// ------------------------------------------------------------------ camera
const mat4 = {
  perspective(fovy: number, aspect: number, near: number, far: number) {
    const f = 1 / Math.tan(fovy / 2);
    const nf = 1 / (near - far);
    return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
  },
  lookAt(eye: number[], target: number[], up: number[]) {
    const z = norm(sub(eye, target));
    const x = norm(cross(up, z));
    const y = cross(z, x);
    return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1];
  },
  mul(a: number[], b: number[]) {
    const o = new Array(16).fill(0);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
    return o;
  },
};
const sub = (a: number[], b: number[]) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: number[], b: number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a: number[]) => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};

const ELEV = (18 * Math.PI) / 180; // camera ~15 degrees above the disc plane
const CAM_DIST = 2.1;
const FOV = (44 * Math.PI) / 180;
const camera = (phase: number) => {
  // slow closed push: +-6% distance, cosine
  const dist = CAM_DIST * (1 + 0.06 * Math.cos(phase * TAU));
  const eye = [0, Math.sin(ELEV) * dist, -Math.cos(ELEV) * dist];
  const target = [0, -0.36, 0.3];
  const view = mat4.lookAt(eye, target, [0, 1, 0]);
  const proj = mat4.perspective(FOV, 16 / 9, 0.05, 50);
  return { vp: mat4.mul(proj, view), dist };
};
const project = (vp: number[], p: number[]) => {
  const x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
  const y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
  const w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
  return [(x / w * 0.5 + 0.5) * 3840, (0.5 - (y / w) * 0.5) * 2160];
};

// Foreground rocks: closed elliptical drifts (whole cycles per loop).
const FG = (() => {
  const r = mulberry32(8080);
  return Array.from({ length: 7 }, () => ({
    cx: r() < 0.5 ? range(r, -100, 700) : range(r, 3100, 3950),
    cy: range(r, 1750, 2350),
    ax: range(r, 250, 700) * (r() < 0.5 ? -1 : 1),
    ay: range(r, 40, 140),
    ph: r() * TAU,
    rad: range(r, 60, 150),
    alpha: range(r, 0.6, 1),
    seed: r() * 100,
  }));
})();

type Scene = {
  root: Container;
  discLayer: Container;
  rt: RenderTexture;
  disc: ReturnType<typeof makeInstanced>;
  fg: ReturnType<typeof makeInstanced>;
  star: ShaderMesh;
};

const makeLook = (params: StarDiscParams): PixiLook<Scene> => ({
  post: { grain: 0.015, darkFade: true, blueNoise: 0.6 },
  build: ({ W, H, res }) => {
    const data = buildDisc(params.particles);
    const disc = makeInstanced({
      count: params.particles,
      floatsPerInstance: FPI,
      vertex: DISC_VERT,
      fragment: DISC_FRAG,
      data,
      uniforms: {
        uVP: { value: new Float32Array(16), type: "mat4x4<f32>" },
        uPhase: { value: 0, type: "f32" },
        uRadius: { value: 1, type: "f32" },
        uPxScale: { value: res, type: "f32" },
        uDesign: { value: [W, H], type: "vec2<f32>" },
        uDust: { value: hex(params.dust), type: "vec3<f32>" },
        uGlow: { value: hex(params.glow), type: "vec3<f32>" },
      },
      name: "stardisc-dust",
    });
    disc.mesh.blendMode = "add";
    disc.upload();
    const fg = makeInstanced({
      count: FG.length,
      floatsPerInstance: 8,
      vertex: FG_VERT,
      fragment: FG_FRAG,
      uniforms: { uGlow: { value: hex(params.glow), type: "vec3<f32>" } },
      name: "stardisc-fg",
    });
    fg.mesh.blendMode = "normal";
    const rt = RenderTexture.create({ width: W, height: H, resolution: res, format: "rgba16float" });
    const discLayer = new Container();
    discLayer.addChild(disc.mesh);
    const star = fullscreenMesh(
      W,
      H,
      STAR,
      {
        uStar: { value: [W / 2, H / 2], type: "vec2<f32>" },
        uCore: { value: hex(params.core), type: "vec3<f32>" },
        uGlow: { value: hex(params.glow), type: "vec3<f32>" },
        uTheta: { value: 0, type: "f32" },
        uZoom: { value: 1, type: "f32" },
      },
      { uDisc: rt.source },
      "stardisc-star",
    );
    const root = new Container();
    root.addChild(star.mesh, fg.mesh);
    return { root, discLayer, rt, disc, fg, star };
  },
  update: (s, frame, ctx) => {
    const ph = loopPhase(frame);
    const cam = camera(ph);
    (s.disc.u.uVP as Float32Array).set(cam.vp);
    s.disc.u.uPhase = ph;
    const sp = project(cam.vp, [0, 0.07, 0]);
    s.star.u.uStar = sp;
    s.star.u.uTheta = ph * TAU;
    s.star.u.uZoom = CAM_DIST / cam.dist;
    const d = s.fg.data;
    FG.forEach((g, i) => {
      const a = g.ph + ph * TAU;
      d[i * 8] = g.cx + g.ax * Math.cos(a);
      d[i * 8 + 1] = g.cy + g.ay * Math.sin(a);
      d[i * 8 + 2] = g.rad;
      d[i * 8 + 3] = g.alpha;
      d[i * 8 + 4] = g.seed;
    });
    s.fg.upload();
    ctx.app.renderer.render({ container: s.discLayer, target: s.rt, clear: true, clearColor: [0, 0, 0, 1] });
  },
  root: (s) => s.root,
});

export const StarDisc: React.FC<{ params: StarDiscParams }> = ({ params }) => {
  const look = useMemo(() => makeLook(params), [params]);
  return <PixiCanvas look={look} />;
};

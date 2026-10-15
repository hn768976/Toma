import { Container, Geometry, Mesh, Shader, UniformGroup } from 'pixi.js';
import { FINISH, NOISE } from '../lib/glsl';
import { Bloom, Pass, es3, makeRT } from '../lib/pixi';
import type { SceneFactory } from '../lib/PixiStage';
import { hexToLinear, mulberry32 } from '../lib/random';

export interface GalaxyParams {
  arm: string;   // arm / cluster colour
  armAlt: string; // second arm colour (blue-white / white)
  core: string;  // core colour
  haze: string;  // haze colour
  loopFrames: number;
}

/* ------------- star field: generated once, rotated by formula ------------- */
// Per star: aPosition = (r, theta0); aStar = (height, size, brightness, turns);
// aKind = (type, colourMix, armSharpness, unused). type: 0 disc, 1 bulge, 2 cluster, 3 background
const N_DISC = 118000;
const N_BULGE = 36000;
const N_CLUSTER = 300;
const N_BG = 5700;
const N = N_DISC + N_BULGE + N_CLUSTER + N_BG; // 160,000

/** whole turns per 600-frame loop for a radius: inner bands turn faster */
export const turnsFor = (r: number) => (r < 0.14 ? 3 : r < 0.38 ? 2 : 1);

const STARS = (() => {
  const rnd = mulberry32(0x6a1a5e);
  const gauss = () => {
    let u = 0;
    for (let i = 0; i < 4; i++) u += rnd();
    return (u - 2) / 0.577;
  };
  const pos = new Float32Array(N * 2);
  const star = new Float32Array(N * 4);
  const kind = new Float32Array(N * 4);
  let i = 0;
  const push = (r: number, th: number, h: number, size: number, b: number, type: number, mix: number, sharp: number) => {
    pos[i * 2] = r;
    pos[i * 2 + 1] = th;
    star.set([h, size, b, turnsFor(r)], i * 4);
    kind.set([type, mix, sharp, 0], i * 4);
    i++;
  };
  for (let k = 0; k < N_DISC; k++) {
    // exponential disc, denser toward the core, out to r ≈ 1.05
    const r = Math.min(1.08, 0.05 + -Math.log(1 - rnd() * 0.96) * 0.36);
    const th = rnd() * Math.PI * 2;
    const h = gauss() * 0.012 * (1.2 - 0.5 * r);
    push(r, th, h, 3.2 + 3.5 * rnd() * rnd(), 0.35 + 0.65 * rnd(), 0, rnd(), 1.4 + rnd() * 2.2);
  }
  for (let k = 0; k < N_BULGE; k++) {
    const x = gauss() * 0.11;
    const y = gauss() * 0.08;
    const z = gauss() * 0.06;
    push(Math.hypot(x, y), Math.atan2(y, x), z, 2.0 + 2.5 * rnd(), 0.4 + 0.6 * rnd(), 1, rnd(), 0);
  }
  for (let k = 0; k < N_CLUSTER; k++) {
    const r = 0.2 + 0.75 * Math.pow(rnd(), 0.9);
    push(r, rnd() * Math.PI * 2, gauss() * 0.01, 14 + 12 * rnd(), 0.7 + 0.3 * rnd(), 2, rnd(), 3);
  }
  for (let k = 0; k < N_BG; k++) {
    // static distant stars in screen space (r, theta hold u, v)
    push(rnd(), rnd(), 0, 1.6 + 1.6 * rnd() * rnd(), 0.03 + 0.1 * Math.pow(rnd(), 3), 3, rnd(), 0);
  }
  return { pos, star, kind };
})();

const STAR_VERT = /* glsl */ `
in vec2 aPosition;  // r, theta0
in vec4 aStar;      // height, size (design px), brightness, turns
in vec4 aKind;      // type, colour mix, arm sharpness
out vec3 vCol;
out float vSoft;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
uniform float uS;          // physical px per design px
uniform float uPhase;      // 0..1 over the loop
uniform float uTilt;       // radians from face-on
uniform vec3 uView;        // centre x, centre y (design px), scale (design px per unit)
uniform vec3 uArm; uniform vec3 uArmAlt; uniform vec3 uCore;
const float TAU = 6.2831853;
void main() {
  float type = aKind.x;
  vec2 screen;
  float bright = aStar.z;
  float depth = 0.0;
  vec3 col;
  if (type > 2.5) {
    // background star: fixed in screen space
    screen = aPosition * vec2(3840.0, 2160.0);
    col = mix(vec3(0.75, 0.8, 1.0), vec3(1.0, 0.9, 0.8), aKind.y);
  } else {
    float r = aPosition.x;
    float th = aPosition.y + TAU * aStar.w * uPhase;         // whole turns per loop
    // two-arm logarithmic spiral pattern, turning half a turn per loop (2-fold symmetric)
    float spiral = log(max(r, 0.03) / 0.12) * 6.5;
    float phi = th - spiral - TAU * 0.5 * uPhase;
    float arm = pow(0.5 + 0.5 * cos(2.0 * phi), aKind.z);
    // dust lane on the inner (leading) edge of each arm: fewer visible stars there
    float lane = cos(2.0 * phi + 0.9);
    float dust = smoothstep(0.75, 0.97, lane) * smoothstep(0.12, 0.3, r) * (1.0 - smoothstep(0.7, 0.95, r));
    vec3 P = vec3(r * cos(th), r * sin(th), aStar.x);
    if (type < 0.5) {
      bright *= mix(0.3, 2.0, arm) * (1.0 - 0.7 * dust) * smoothstep(1.08, 0.85, r);
      float warm = 1.0 - smoothstep(0.1, 0.26, r);
      col = mix(mix(uArm, uArmAlt, aKind.y * aKind.y), uCore, warm * 0.8);
    } else if (type < 1.5) {
      col = mix(uCore * vec3(1.0, 0.55, 0.22), uCore, aKind.y * 0.5);
      bright *= 0.14;
    } else {
      bright *= smoothstep(0.3, 0.85, arm) * 1.8;
      col = mix(uArmAlt, uArm, 0.25 + 0.35 * aKind.y);
    }
    // tilt the disc away from face-on, then a gentle perspective
    float ct = cos(uTilt), st = sin(uTilt);
    vec3 V = vec3(P.x, P.y * ct + P.z * st, P.y * st - P.z * ct);
    float persp = 3.2 / (3.2 + V.z);
    screen = uView.xy + vec2(V.x, V.y) * persp * uView.z;
    depth = V.z;
  }
  // keep points at least ~1.6 physical px wide; conserve their energy
  float want = aStar.y * uS;
  float sz = max(want, 1.6);
  bright *= (want * want) / (sz * sz);
  gl_PointSize = sz * 2.0;  // gaussian needs room
  vCol = col * bright;
  vSoft = type > 1.5 && type < 2.5 ? 1.0 : 0.0;
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(screen * uS, 1.0)).xy, 0.0, 1.0);
}
`;

const STAR_FRAG = /* glsl */ `
in vec3 vCol;
in float vSoft;
out vec4 finalColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;   // -1..1 across the sprite (2x the star size)
  float r2 = dot(d, d) * 4.0;           // in units of the star radius
  float g = exp(-r2 * (vSoft > 0.5 ? 1.2 : 2.2));
  if (vSoft > 0.5) g += 0.35 * exp(-r2 * 0.6);
  g *= 1.0 - smoothstep(0.6, 1.0, dot(d, d)); // round sprite, no square cut-off
  finalColor = vec4(vCol * g, 1.0);
}
`;

const OUT_FRAG = /* glsl */ `
in vec2 vUV; out vec4 finalColor;
uniform sampler2D uSrc;
uniform sampler2D uB0; uniform sampler2D uB1; uniform sampler2D uB2; uniform sampler2D uB3; uniform sampler2D uB4;
uniform vec2 uRes; uniform float uS;
uniform vec3 uView; uniform float uTilt;
uniform vec3 uCore; uniform vec3 uHaze;
uniform float uFrameMod;
${NOISE}
${FINISH}
float win(float d, float r) { float x = clamp(1.0 - d / r, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
void main() {
  vec3 stars = texture(uSrc, vUV).rgb;
  vec3 bl = texture(uB0, vUV).rgb * 0.6 + texture(uB1, vUV).rgb * 0.7 + texture(uB2, vUV).rgb * 0.8
          + texture(uB3, vUV).rgb * 0.9 + texture(uB4, vUV).rgb * 1.0;
  vec2 px = vUV * uRes / uS;
  // position in the galaxy's projected frame (units of radius)
  vec2 q = (px - uView.xy) / uView.z;
  q.y /= cos(uTilt);
  float rq = length(q);
  // warm core glow and the broad haze around it
  vec3 c = stars * 1.1 + bl * 0.9;
  // core: white-hot centre in a saturated gold/orange halo crossed by dark dust swirls
  float ang = atan(q.y, q.x);
  float swirl = gnoise(vec2(ang * 2.0 + rq * 14.0, rq * 9.0)) * 0.5 + 0.5;
  float lanes = 1.0 - 0.55 * smoothstep(0.55, 0.85, swirl) * smoothstep(0.02, 0.06, rq);
  c += uCore * 2.2 * exp(-rq * rq / 0.0008);
  c += uCore * vec3(1.0, 0.5, 0.12) * (2.2 * exp(-rq * rq / 0.01) + 0.5 * exp(-rq * rq / 0.03)) * lanes;
  // saturated blue-violet glow filling the disc, fading sharply at its edge
  c += uHaze * (0.8 * exp(-rq * rq / 0.05) + 0.33 * smoothstep(1.0, 0.5, rq)) * win(rq, 1.15);
  c = 1.0 - exp(-c * 1.2);
  vec3 s = linearToSrgb(c);
  s = max(s - 1.0 / 255.0, 0.0) * (255.0 / 254.0);
  finalColor = vec4(finishColor(s, uFrameMod, 0.015), 1.0);
}
`;

export const galaxyScene: SceneFactory<GalaxyParams> = ({ renderer, w, h, s }, p) => {
  const starRT = makeRT(w, h);
  const bloom = new Bloom(w, h, 5, 2);
  const geometry = new Geometry({
    attributes: {
      aPosition: { buffer: STARS.pos, format: 'float32x2' },
      aStar: { buffer: STARS.star, format: 'float32x4' },
      aKind: { buffer: STARS.kind, format: 'float32x4' },
    },
    topology: 'point-list',
  });
  const group = new UniformGroup({
    uS: { value: s, type: 'f32' },
    uPhase: { value: 0, type: 'f32' },
    uTilt: { value: (66 * Math.PI) / 180, type: 'f32' },
    uView: { value: [1920, 1080, 1400], type: 'vec3<f32>' },
    uArm: { value: hexToLinear(p.arm), type: 'vec3<f32>' },
    uArmAlt: { value: hexToLinear(p.armAlt), type: 'vec3<f32>' },
    uCore: { value: hexToLinear(p.core), type: 'vec3<f32>' },
  } as any);
  const shader = Shader.from({ gl: { vertex: es3(STAR_VERT), fragment: es3(STAR_FRAG) }, resources: { u: group } });
  const mesh = new Mesh({ geometry, shader });
  mesh.blendMode = 'add';
  const root = new Container();
  root.addChild(mesh);

  const out = new Pass(
    w,
    h,
    OUT_FRAG,
    {
      uRes: { value: [w, h], type: 'vec2<f32>' },
      uS: { value: s, type: 'f32' },
      uView: { value: [1920, 1080, 1400], type: 'vec3<f32>' },
      uTilt: { value: (66 * Math.PI) / 180, type: 'f32' },
      uCore: { value: hexToLinear(p.core), type: 'vec3<f32>' },
      uHaze: { value: hexToLinear(p.haze), type: 'vec3<f32>' },
      uFrameMod: { value: 0, type: 'f32' },
    },
    {
      uSrc: starRT.source,
      uB0: bloom.levels[0].source,
      uB1: bloom.levels[1].source,
      uB2: bloom.levels[2].source,
      uB3: bloom.levels[3].source,
      uB4: bloom.levels[4].source,
    },
  );
  return {
    render(frame) {
      const f = frame % 600;
      const ph = f / 600;
      // fixed camera with a gentle closed drift
      const view = [
        1920 + 40 * Math.sin(2 * Math.PI * ph),
        870 + 22 * Math.sin(4 * Math.PI * ph + 0.6),
        1620 * (1 + 0.02 * Math.cos(2 * Math.PI * ph)),
      ];
      group.uniforms.uPhase = ph;
      group.uniforms.uView = view;
      out.u.uView = view;
      renderer.render({ container: root, target: starRT, clear: true, clearColor: [0, 0, 0, 0] });
      bloom.run(renderer, starRT, 2);
      out.u.uFrameMod = frame % p.loopFrames;
      out.draw(renderer);
    },
  };
};

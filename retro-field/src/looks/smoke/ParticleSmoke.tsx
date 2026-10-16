import { Application, BlurFilter, Container, Geometry, Mesh, Shader } from "pixi.js";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import { LOOP_FRAMES } from "../../lib/loop";
import { mulberry32 } from "../../lib/random";

export type SmokeVersion = {
  id: string;
  grains: number;
  color: [number, number, number]; // linear-ish display colour, white for the overlay
  gain: number;
  threshold: number; // density where grains start to light
  softness: number; // width of the soft threshold
  haze: number; // gain of the blurred glow layer relative to the grains
};

// --- grain data, seeded once at module level ---------------------------------
// aPosition: home position in frame units (x: 0..16/9, y: 0..1, y down)
// aSeed: orbit radius, orbit phase, orbit cycles (whole number), size
// aSeed2: brightness, curl-response, unused, unused
const ASPECT = 16 / 9;
const buildGrains = (n: number) => {
  const rng = mulberry32(4051351549);
  const pos = new Float32Array(n * 2);
  const seed = new Float32Array(n * 4);
  const seed2 = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    pos[i * 2] = rng() * ASPECT * 1.1 - ASPECT * 0.05;
    // heavier in the top half, thinning toward the bottom edge
    pos[i * 2 + 1] = Math.pow(rng(), 1.45) * 1.08 - 0.06;
    seed[i * 4] = (0.01 + rng() * 0.02) * ASPECT; // 1–3 % of frame width
    seed[i * 4 + 1] = rng();
    seed[i * 4 + 2] = 1 + Math.floor(rng() * 3); // 1, 2 or 3 orbits per loop
    seed[i * 4 + 3] = 0.6 + Math.pow(rng(), 0.5) * 1.0; // 0.6–1.6 px at 720p
    // brightness; about one grain in twenty is a brighter speck
    seed2[i * 2] = rng() < 0.05 ? 1.6 : 0.5 + rng() * 0.45;
    seed2[i * 2 + 1] = 0.7 + rng() * 0.6;
  }
  return { pos, seed, seed2 };
};

const vertex = /* glsl */ `
precision highp float;
in vec2 aPosition;
in vec4 aSeed;
in vec2 aSeed2;
uniform float uTime;   // loop phase t in [0, 1)
uniform float uPxScale; // drawing-buffer height / 720
uniform float uGain;
uniform float uThreshold;
uniform float uSoftness;
uniform float uScreenH; // stage height in Pixi units (CSS px)
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
out float vEnergy;
out float vRadius;

// Periodic classic Perlin noise (Stefan Gustavson, webgl-noise, MIT).
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec3 fade(vec3 t) { return t * t * t * (t * (t * 6.0 - 15.0) + 10.0); }
float pnoise(vec3 P, vec3 rep) {
  vec3 Pi0 = mod(floor(P), rep);
  vec3 Pi1 = mod(Pi0 + vec3(1.0), rep);
  Pi0 = mod289(Pi0);
  Pi1 = mod289(Pi1);
  vec3 Pf0 = fract(P);
  vec3 Pf1 = Pf0 - vec3(1.0);
  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
  vec4 iy = vec4(Pi0.yy, Pi1.yy);
  vec4 iz0 = Pi0.zzzz;
  vec4 iz1 = Pi1.zzzz;
  vec4 ixy = permute(permute(ix) + iy);
  vec4 ixy0 = permute(ixy + iz0);
  vec4 ixy1 = permute(ixy + iz1);
  vec4 gx0 = ixy0 * (1.0 / 7.0);
  vec4 gy0 = fract(floor(gx0) * (1.0 / 7.0)) - 0.5;
  gx0 = fract(gx0);
  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
  vec4 sz0 = step(gz0, vec4(0.0));
  gx0 -= sz0 * (step(0.0, gx0) - 0.5);
  gy0 -= sz0 * (step(0.0, gy0) - 0.5);
  vec4 gx1 = ixy1 * (1.0 / 7.0);
  vec4 gy1 = fract(floor(gx1) * (1.0 / 7.0)) - 0.5;
  gx1 = fract(gx1);
  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
  vec4 sz1 = step(gz1, vec4(0.0));
  gx1 -= sz1 * (step(0.0, gx1) - 0.5);
  gy1 -= sz1 * (step(0.0, gy1) - 0.5);
  vec3 g000 = vec3(gx0.x, gy0.x, gz0.x);
  vec3 g100 = vec3(gx0.y, gy0.y, gz0.y);
  vec3 g010 = vec3(gx0.z, gy0.z, gz0.z);
  vec3 g110 = vec3(gx0.w, gy0.w, gz0.w);
  vec3 g001 = vec3(gx1.x, gy1.x, gz1.x);
  vec3 g101 = vec3(gx1.y, gy1.y, gz1.y);
  vec3 g011 = vec3(gx1.z, gy1.z, gz1.z);
  vec3 g111 = vec3(gx1.w, gy1.w, gz1.w);
  vec4 norm0 = taylorInvSqrt(vec4(dot(g000, g000), dot(g010, g010), dot(g100, g100), dot(g110, g110)));
  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
  vec4 norm1 = taylorInvSqrt(vec4(dot(g001, g001), dot(g011, g011), dot(g101, g101), dot(g111, g111)));
  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
  float n000 = dot(g000, Pf0);
  float n100 = dot(g100, vec3(Pf1.x, Pf0.yz));
  float n010 = dot(g010, vec3(Pf0.x, Pf1.y, Pf0.z));
  float n110 = dot(g110, vec3(Pf1.xy, Pf0.z));
  float n001 = dot(g001, vec3(Pf0.xy, Pf1.z));
  float n101 = dot(g101, vec3(Pf1.x, Pf0.y, Pf1.z));
  float n011 = dot(g011, vec3(Pf0.x, Pf1.yz));
  float n111 = dot(g111, Pf1);
  vec3 fade_xyz = fade(Pf0);
  vec4 n_z = mix(vec4(n000, n100, n010, n110), vec4(n001, n101, n011, n111), fade_xyz.z);
  vec2 n_yz = mix(n_z.xy, n_z.zw, fade_xyz.y);
  return 2.2 * mix(n_yz.x, n_yz.y, fade_xyz.x);
}

// Noise space: x tiles every PX units, time tiles every PT units, so both the
// sideways drift (one PX per loop) and the evolution (one PT per loop) close.
const float FREQ = 1.65;
const float PX = 3.0;
const float PT = 2.0;

float fbm(vec3 p, int oct) {
  float s = 0.0;
  float a = 0.5;
  vec3 rep = vec3(PX, 289.0, PT);
  for (int i = 0; i < 5; i++) {
    if (i >= oct) break;
    s += a * pnoise(p, rep);
    p = p * 2.0 + vec3(0.0, 17.3, 0.0);
    rep *= 2.0;
    a *= 0.5;
  }
  return s;
}

// smoke density at frame position q (frame units)
// returns (density, fibre ridge)
vec2 density(vec2 q, float t) {
  vec3 p = vec3(q.x * FREQ + PX * t, q.y * FREQ, PT * t);
  // two rounds of domain warping → curling hooks and long tendrils
  vec2 w1 = vec2(fbm(p + vec3(0.0, 3.1, 0.0), 3), fbm(p + vec3(0.0, 9.7, 0.0), 3));
  vec3 pw = p + vec3(w1.x * 2.0, w1.y * 1.4, 0.0);
  vec2 w2 = vec2(fbm(pw + vec3(0.0, 21.4, 0.0), 2), fbm(pw + vec3(0.0, 33.8, 0.0), 2));
  vec3 pf = pw + vec3(w2 * 1.3, 0.0);
  float body = fbm(pf, 3);
  float detail = fbm(pf * vec3(2.0, 2.0, 2.0) + vec3(0.0, 71.0, 0.0), 2);
  float d = body + detail * 0.22;
  // fibrous flow lines: thin ridges of noise in the warped space
  // stretched across x so the grain reads as brushed, directional wisps
  float fib = 1.0 - abs(pnoise(pf * vec3(2.0, 5.0, 1.0) + vec3(0.0, 13.0, 0.0), vec3(PX * 2.0, 289.0, PT)) * 1.8);
  // heavier at the top, fading out toward the bottom edge
  float bias = mix(0.04, -0.28, smoothstep(0.12, 1.0, q.y));
  return vec2(d + bias, fib);
}

// curl of a scalar potential (finite differences) → divergence-free swirl
vec2 curl(vec2 q, float t) {
  float e = 0.004;
  vec3 p = vec3(q.x * FREQ * 0.8 + PX * t, q.y * FREQ * 0.8 + 51.0, PT * t);
  vec3 rep = vec3(PX, 289.0, PT);
  float s = FREQ * 0.8;
  float n1 = pnoise(p + vec3(0.0, e * s, 0.0), rep) + 0.5 * pnoise(2.0 * (p + vec3(0.0, e * s, 0.0)), rep * 2.0);
  float n2 = pnoise(p - vec3(0.0, e * s, 0.0), rep) + 0.5 * pnoise(2.0 * (p - vec3(0.0, e * s, 0.0)), rep * 2.0);
  float n3 = pnoise(p + vec3(e * s, 0.0, 0.0), rep) + 0.5 * pnoise(2.0 * (p + vec3(e * s, 0.0, 0.0)), rep * 2.0);
  float n4 = pnoise(p - vec3(e * s, 0.0, 0.0), rep) + 0.5 * pnoise(2.0 * (p - vec3(e * s, 0.0, 0.0)), rep * 2.0);
  return vec2(n1 - n2, -(n3 - n4)) / (2.0 * e);
}

void main() {
  float t = uTime;
  float ang = 6.2831853 * (aSeed.z * t + aSeed.y);
  vec2 q = aPosition + aSeed.x * vec2(cos(ang), sin(ang));
  q += curl(aPosition, t) * 0.0045 * aSeed2.y;
  vec2 df = density(q, t);
  float d = df.x;
  float fib = df.y;
  // crisp leading edge, then brightness keeps building into the billow cores
  // the edge softness itself wanders: crisp curling fronts in places, soft
  // dissolving ones in others
  float soft = uSoftness * (0.6 + 2.2 * smoothstep(-0.2, 0.35, fbm(vec3(q * FREQ * 0.7 + vec2(PX * t, 7.0), PT * t + 3.0), 2)));
  float edge = smoothstep(uThreshold, uThreshold + soft, d);
  float core = smoothstep(uThreshold, uThreshold + 0.75, d);
  float b = edge * (0.14 + 0.86 * core * core);
  // fibrous flow lines inside the wisps: thin ridges of a warped noise
  b *= 0.45 + 0.75 * clamp(fib, 0.0, 1.0);
  // sparse grains scattered between the wisps
  b = max(b, 0.03 * smoothstep(uThreshold - 0.12, uThreshold, d));
  // compress the hottest billows so the cores stay soft grey-white
  b = b / (1.0 + 1.1 * b);
  float size = aSeed.w * uPxScale;
  // Each grain deposits energy ∝ its area through a normalised Gaussian
  // footprint (its own size plus ~0.5 px of anti-alias softness), so
  // sub-pixel grains get dimmer rather than blockier and never alias.
  float sigma = sqrt(size * size * 0.09 + 0.72 * 0.72 * uPxScale * uPxScale);
  vEnergy = b * aSeed2.x * uGain * size * size * 0.35;
  vRadius = sigma;
  gl_PointSize = ceil(sigma * 6.0) + 1.0;
  // through Pixi's own matrices, so the same mesh also renders correctly
  // into the (flipped) render texture of the blur filter
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(q * uScreenH, 1.0)).xy, 0.0, 1.0);
  if (vEnergy < 0.0005) gl_Position = vec4(2.0, 2.0, 2.0, 1.0); // cull
}`;

const fragment = /* glsl */ `
precision highp float;
in float vEnergy;
in float vRadius;
uniform vec3 uColor;
out vec4 finalColor;
void main() {
  vec2 p = (gl_PointCoord - 0.5) * (ceil(vRadius * 6.0) + 1.0);
  float a = exp(-dot(p, p) / (2.0 * vRadius * vRadius)) / (6.2831853 * vRadius * vRadius);
  // soft cap so dense billows don't burn to pure white
  vec3 c = uColor * vEnergy * a;
  finalColor = vec4(c, 0.0);
}`;

export const ParticleSmoke: React.FC<{ version: SmokeVersion }> = ({ version }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const shaderRef = useRef<Shader | null>(null);
  const hazeRef = useRef<Shader | null>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const { delayRender, continueRender, cancelRender } = useDelayRender();

  const draw = (f: number) => {
    const app = appRef.current;
    const shader = shaderRef.current;
    if (!app || !shader) return;
    const loopFrame = ((f % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
    for (const sh of [shader, hazeRef.current]) {
      if (!sh) continue;
      const u = sh.resources.smoke.uniforms;
      u.uTime = loopFrame / LOOP_FRAMES;
      u.uPxScale = (app.renderer.height * app.renderer.resolution) / 720;
    }
    app.renderer.render(app.stage);
  };

  useEffect(() => {
    const handle = delayRender("Initialising PixiJS");
    let disposed = false;
    const app = new Application();
    const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
    app
      .init({
        canvas: canvasRef.current!,
        width,
        height,
        resolution: dpr,
        autoDensity: true,
        background: "#000000",
        backgroundAlpha: 1,
        antialias: false,
        preference: "webgl",
        preserveDrawingBuffer: true,
        autoStart: false,
        sharedTicker: false,
        hello: false,
      })
      .then(() => {
        if (disposed) {
          app.destroy();
          return;
        }
        const g = buildGrains(version.grains);
        const geometry = new Geometry({
          attributes: {
            aPosition: { buffer: g.pos, format: "float32x2" },
            aSeed: { buffer: g.seed, format: "float32x4" },
            aSeed2: { buffer: g.seed2, format: "float32x2" },
          },
          topology: "point-list",
        });
        const shader = Shader.from({
          gl: { vertex, fragment },
          resources: {
            smoke: {
              uTime: { value: 0, type: "f32" },
              uPxScale: { value: 1, type: "f32" },
              uGain: { value: version.gain, type: "f32" },
              uThreshold: { value: version.threshold, type: "f32" },
              uSoftness: { value: version.softness, type: "f32" },
              uColor: { value: new Float32Array(version.color), type: "vec3<f32>" },
              uScreenH: { value: height, type: "f32" },
            },
          },
        });
        const mesh = new Mesh({ geometry, shader });
        mesh.blendMode = "add";
        // soft volumetric haze: the same grains, blurred and dimmed, added
        // underneath. Blur of empty black stays exactly black.
        const hazeShader = Shader.from({
          gl: { vertex, fragment },
          resources: {
            smoke: {
              uTime: { value: 0, type: "f32" },
              uPxScale: { value: 1, type: "f32" },
              uGain: { value: version.gain * version.haze, type: "f32" },
              uThreshold: { value: version.threshold, type: "f32" },
              uSoftness: { value: version.softness, type: "f32" },
              uColor: { value: new Float32Array(version.color), type: "vec3<f32>" },
              uScreenH: { value: height, type: "f32" },
            },
          },
        });
        const hazeMesh = new Mesh({ geometry, shader: hazeShader });
        hazeMesh.blendMode = "add";
        const haze = new Container();
        haze.addChild(hazeMesh);
        const dprNow = app.renderer.resolution;
        haze.filters = [new BlurFilter({ strength: 7 * (height * dprNow) / 720 / dprNow, quality: 4, resolution: dprNow })];
        haze.filterArea = app.screen;
        haze.blendMode = "add";
        app.stage.addChild(haze);
        app.stage.addChild(mesh);
        appRef.current = app;
        shaderRef.current = shader;
        hazeRef.current = hazeShader;
        draw(frameRef.current);
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      disposed = true;
      if (appRef.current) {
        appRef.current.destroy(false, { children: true });
        appRef.current = null;
        shaderRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, width, height]);

  useLayoutEffect(() => {
    draw(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvasRef} style={{ width, height }} />
    </AbsoluteFill>
  );
};

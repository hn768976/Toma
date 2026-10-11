import {
  Application, BufferImageSource, Container, Filter, GlProgram, Mesh, MeshGeometry, Particle, ParticleContainer,
  Rectangle, Shader, Texture,
} from "pixi.js";
import { motionFrame, wrapFrame } from "../lib/loop";
import { mulberry32 } from "../lib/random";
import { BANDS, DROPS, H, LOOP, POOL, SPARKLES, W } from "./rainData";

export interface RainPalette {
  rainA: string;
  rainB: string;
  poolCore: string;
  poolGlow: string;
  sparkleA: string;
  sparkleB: string;
  bgTop: string;
  bgMid: string;
}

const hexNum = (h: string) => parseInt(h.replace("#", ""), 16);
const rgb = (h: string) => {
  const n = hexNum(h);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
const lerpHex = (a: string, b: string, t: number) => {
  const A = rgb(a), B = rgb(b);
  const c = A.map((v, i) => Math.round((v + (B[i] - v) * t) * 255));
  return (c[0] << 16) | (c[1] << 8) | c[2];
};

const BG_VERT = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
}
`;

const BG_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uShafts;
uniform float uFrame;
uniform float uBreath;
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uShaft;
uniform vec3 uPoolCore;
uniform vec3 uPoolGlow;
uniform vec4 uPool; // cx, cy, rx, ry in 4K px

uniform sampler2D uNoise;
uniform vec2 uNoiseOffset;
uniform float uMist;
// Fixed 128x128 seeded noise tile (RGBA uniform 0..1), offset per frame (frame % 600).
vec4 noiseTile(vec2 fragCoord) {
  vec2 c = mod(floor(fragCoord) + uNoiseOffset, 128.0);
  return texture(uNoise, (c + 0.5) / 128.0);
}

void main() {
  vec2 p = vUV * vec2(${W.toFixed(1)}, ${H.toFixed(1)});
  float y = vUV.y; // 0 top
  vec3 c = mix(uTop, uMid, smoothstep(0.0, 0.6, y));
  c *= mix(0.6, 1.0, exp(-pow((vUV.x - 0.52) / 0.4, 2.0)));
  // dark band below the pool
  c = mix(c, uTop * 0.7, smoothstep(0.86, 0.98, y));
  // corners into deep blue-black
  vec2 q = (vUV - vec2(0.5, 0.62)) * vec2(1.25, 1.0);
  c *= 1.0 - 0.45 * smoothstep(0.5, 1.0, length(q));
  // light shafts behind the dense rain bands
  float prof = texture(uShafts, vec2(vUV.x, 0.5)).r;
  float vert = (1.0 - 0.45 * smoothstep(0.38, 0.62, y)) * (1.0 - smoothstep(0.6, 0.8, y));
  // Fine falling mist grain inside the shafts (noise tile scrolled down a whole number of tiles per loop).
  vec2 mc = mod(floor(gl_FragCoord.xy * vec2(1.0, 0.5) + vec2(0.0, uMist)), 128.0);
  float mist = texture(uNoise, (mc + 0.5) / 128.0).g;
  float side = exp(-pow((vUV.x - 0.53) / 0.42, 2.0));
  c += uShaft * (0.32 + 0.8 * prof) * vert * side * (0.5 + 0.4 * mist);
  // floor pool
  vec2 e = (p - uPool.xy) / uPool.zw;
  float d2 = dot(e, e);
  c += uPoolGlow * 0.30 * exp(-d2 * 0.55) * uBreath;
  c += uPoolCore * 0.2 * exp(-dot(e - vec2(0.3, 0.0), e - vec2(0.3, 0.0)) * 1.4) * uBreath;
  vec4 n = noiseTile(gl_FragCoord.xy);
  c += (vec3(n.r + n.g, n.g + n.b, n.b + n.a) - 1.0) / 255.0;
  finalColor = vec4(c, 1.0);
}
`;

const DEFAULT_FILTER_VERT = /* glsl */ `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
void main(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  gl_Position = vec4(position, 0.0, 1.0);
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

// Final grain (2%) + +-1/255 dither from a fixed hash of pixel and frame % 600.
const GRAIN_FRAG = /* glsl */ `
precision highp float;
precision highp int;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uFrame;

uniform sampler2D uNoise;
uniform vec2 uNoiseOffset;
// Fixed 128x128 seeded noise tile (RGBA uniform 0..1), offset per frame (frame % 600).
vec4 noiseTile(vec2 fragCoord) {
  vec2 c = mod(floor(fragCoord) + uNoiseOffset, 128.0);
  return texture(uNoise, (c + 0.5) / 128.0);
}

void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  vec4 n = noiseTile(gl_FragCoord.xy + vec2(61.0, 17.0));
  float grain = (n.r + n.g - 1.0) * 0.02;
  vec3 g = c.rgb + grain * (0.6 + 0.4 * (1.0 - abs(c.rgb - 0.5) * 2.0));
  g += (vec3(n.b + n.a, n.a + n.r, n.g + n.b) - 1.0) / 255.0;
  finalColor = vec4(g, 1.0);
}
`;

const buildAtlas = () => {
  // streak 16x128 at (0,0); dot 32x32 at (16,0); glint 64x64 at (48,0)
  const cv = document.createElement("canvas");
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(128, 128);
  const put = (x: number, y: number, a: number) => {
    const i = (y * 128 + x) * 4;
    const v = Math.max(0, Math.min(255, Math.round(a * 255)));
    img.data[i] = 255; img.data[i + 1] = 255; img.data[i + 2] = 255; img.data[i + 3] = v;
  };
  for (let y = 0; y < 128; y++) for (let x = 0; x < 16; x++) {
    const dx = (x + 0.5 - 8) / 3.2;
    const t = (y + 0.5) / 128;
    const along = Math.sin(Math.PI * t) * (0.35 + 0.65 * t); // brighter head at the bottom
    put(x, y, Math.exp(-dx * dx) * along);
  }
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const dx = (x + 0.5 - 16) / 16, dy = (y + 0.5 - 16) / 16;
    const r2 = dx * dx + dy * dy;
    put(16 + x, y, Math.exp(-r2 * 9) + 0.25 * Math.exp(-r2 * 3) * (r2 < 1 ? 1 : 0));
  }
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
    const dx = (x + 0.5 - 32) / 32, dy = (y + 0.5 - 32) / 32;
    const r2 = dx * dx + dy * dy;
    const star = Math.exp(-Math.abs(dx) * 22) * Math.exp(-dy * dy * 3) + Math.exp(-Math.abs(dy) * 22) * Math.exp(-dx * dx * 3);
    put(48 + x, y, Math.min(1, star * 0.9 + Math.exp(-r2 * 30)));
  }
  ctx.putImageData(img, 0, 0);
  const base = Texture.from(cv);
  base.source.scaleMode = "linear";
  const sub = (x: number, y: number, w: number, h: number) =>
    new Texture({ source: base.source, frame: new Rectangle(x, y, w, h) });
  return { streak: sub(0, 0, 16, 128), dot: sub(16, 0, 32, 32), glint: sub(48, 0, 64, 64) };
};

const buildShaftProfile = () => {
  const N = 1024;
  const cv = document.createElement("canvas");
  cv.width = N;
  cv.height = 1;
  const ctx = cv.getContext("2d")!;
  const img = ctx.createImageData(N, 1);
  for (let i = 0; i < N; i++) {
    const x = ((i + 0.5) / N) * W;
    let v = 0;
    for (const b of BANDS) v += b.s * Math.exp(-Math.pow((x - b.x) / (b.w * 1.25), 2) / 2);
    const c = Math.round(Math.min(1, v) * 255);
    img.data[i * 4] = c; img.data[i * 4 + 1] = c; img.data[i * 4 + 2] = c; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = Texture.from(cv);
  t.source.scaleMode = "linear";
  return t;
};

const buildNoiseTile = () => {
  const rng = mulberry32(0x0d17e);
  const data = new Uint8Array(128 * 128 * 4);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(rng() * 256);
  const source = new BufferImageSource({
    resource: data, width: 128, height: 128, format: "rgba8unorm",
    scaleMode: "nearest", addressMode: "repeat", alphaMode: "no-premultiply-alpha",
  });
  return new Texture({ source });
};

const noiseOffset = (f: number) => new Float32Array([(f * 37) % 128, (f * 71) % 128]);

export interface RainStage {
  app: Application;
  render: (frame: number) => void;
}

export const createRainStage = async (canvas: HTMLCanvasElement, pal: RainPalette, resolution: number): Promise<RainStage> => {
  const app = new Application();
  await app.init({
    canvas,
    width: W,
    height: H,
    resolution,
    autoDensity: false,
    preference: "webgl",
    antialias: false,
    backgroundColor: 0x000000,
    preserveDrawingBuffer: true,
    autoStart: false,
    sharedTicker: false,
  });
  app.ticker?.stop();

  const atlas = buildAtlas();
  const shafts = buildShaftProfile();
  const noise = buildNoiseTile();

  // Background (gradient, shafts, pool glow) computed in float in one shader.
  const geom = new MeshGeometry({
    positions: new Float32Array([0, 0, W, 0, W, H, 0, H]),
    uvs: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]),
    indices: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
  const v3 = (h: string) => ({ value: new Float32Array(rgb(h)), type: "vec3<f32>" as const });
  const bgShader = Shader.from({
    gl: { vertex: BG_VERT, fragment: BG_FRAG },
    resources: {
      bgUniforms: {
        uFrame: { value: 0, type: "f32" },
        uBreath: { value: 1, type: "f32" },
        uTop: v3(pal.bgTop),
        uMid: v3(pal.bgMid),
        uShaft: v3(pal.rainA),
        uPoolCore: v3(pal.poolCore),
        uPoolGlow: v3(pal.poolGlow),
        uNoiseOffset: { value: noiseOffset(0), type: "vec2<f32>" },
        uMist: { value: 0, type: "f32" },
        uPool: { value: new Float32Array([POOL.cx, POOL.cy, POOL.rx, POOL.ry]), type: "vec4<f32>" },
      },
      uShafts: shafts.source,
      uNoise: noise.source,
    },
  });
  const bg = new Mesh({ geometry: geom, shader: bgShader });

  const rain = new ParticleContainer({
    texture: atlas.streak,
    dynamicProperties: { position: true, vertex: true, color: true, rotation: false, uvs: false },
  });
  rain.blendMode = "add";
  const rainParticles = DROPS.map((d) => {
    const p = new Particle({ texture: atlas.streak, anchorX: 0.5, anchorY: 1, x: d.x, y: 0 });
    p.tint = lerpHex(pal.rainA, pal.rainB, d.mix);
    p.scaleX = 5.0 / 16;
    p.scaleY = d.len / 128;
    rain.addParticle(p);
    return p;
  });

  const sparkles = new ParticleContainer({
    texture: atlas.dot,
    dynamicProperties: { position: false, vertex: false, color: true, rotation: false, uvs: false },
  });
  sparkles.blendMode = "add";
  const sparkleParticles = SPARKLES.map((s) => {
    const tex = s.glint ? atlas.glint : atlas.dot;
    const p = new Particle({ texture: tex, anchorX: 0.5, anchorY: 0.5, x: s.x, y: s.y });
    p.tint = lerpHex(pal.sparkleA, pal.sparkleB, s.mix);
    const sc = s.size / (s.glint ? 64 : 32) * (s.glint ? 1 : 2.2);
    p.scaleX = sc;
    p.scaleY = sc;
    sparkles.addParticle(p);
    return p;
  });

  const root = new Container();
  root.addChild(bg, rain, sparkles);
  const grain = new Filter({
    glProgram: GlProgram.from({ vertex: DEFAULT_FILTER_VERT, fragment: GRAIN_FRAG, name: "grain" }),
    resources: {
      grainUniforms: { uFrame: { value: 0, type: "f32" }, uNoiseOffset: { value: noiseOffset(0), type: "vec2<f32>" } },
      uNoise: noise.source,
    },
  });
  root.filters = [grain];
  root.filterArea = new Rectangle(0, 0, W, H);
  app.stage.addChild(root);

  const TAU = Math.PI * 2;
  const render = (frame: number) => {
    const f = wrapFrame(frame, LOOP);
    const t = motionFrame(frame, LOOP) / LOOP;
    for (let i = 0; i < DROPS.length; i++) {
      const d = DROPS[i];
      const p = rainParticles[i];
      const span = d.land - d.y0;
      const u = (((d.phase + d.falls * t) % 1) + 1) % 1;
      const y = d.y0 + u * span;
      p.y = y;
      // fade in at the top, keep the frame top dark, fade right at the landing
      const yn = y / H;
      const fadeTop = Math.min(1, Math.max(0, (yn + 0.06) / 0.1));
      const fadeEnd = Math.min(1, (1 - u) / 0.04);
      const dip = 1 - 0.4 * Math.exp(-Math.pow((yn - 0.66) / 0.05, 2));
      p.alpha = d.alpha * fadeTop * fadeTop * fadeEnd * dip;
    }
    for (let i = 0; i < SPARKLES.length; i++) {
      const s = SPARKLES[i];
      const w = 0.5 + 0.5 * Math.sin(TAU * (s.k * t + s.phase));
      sparkleParticles[i].alpha = s.alpha * (0.15 + 0.85 * w * w);
    }
    rain.update();
    const u = bgShader.resources.bgUniforms.uniforms;
    u.uFrame = f;
    u.uBreath = 1 + 0.07 * Math.sin(TAU * 2 * t);
    u.uNoiseOffset = noiseOffset(f);
    u.uMist = (128 * 24 * t) % 128; // 24 whole tiles per loop
    grain.resources.grainUniforms.uniforms.uFrame = f;
    grain.resources.grainUniforms.uniforms.uNoiseOffset = noiseOffset((f * 7 + 13) % LOOP);
    app.renderer.render(app.stage);
  };
  return { app, render };
};

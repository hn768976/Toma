// Look 2 — Champagne Bubbles (PixiJS 8, WebGL2).
//
// ~4,000 bubble particles in four focus layers plus eight nucleation streams,
// over a shader-drawn liquid gradient. Everything is drawn into a half-float
// render texture, then a final pass adds grain + blue-noise dither.
//
// Motion is closed form: y = ((y0 − k·t) mod 1)·span with integer k, so each
// bubble wraps a whole number of times per loop; bigger bubbles get larger k.
import {
  Application,
  BufferImageSource,
  Container,
  Geometry,
  Mesh,
  Particle,
  ParticleContainer,
  RenderTexture,
  Shader,
  Texture,
  Rectangle,
} from "pixi.js";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, useCurrentFrame } from "remotion";
import { getBlueNoise, BLUE_NOISE_SIZE } from "../lib/blueNoise";
import { HEIGHT, LOOP, loopFrame, TAU, WIDTH } from "../lib/constants";
import { GLSL_HEADER, GRAIN_DITHER, HASH } from "../lib/glsl";
import { mulberry32, range } from "../lib/random";
import { useOutputPixels } from "../lib/output";
import type { ChampagnePalette } from "../versions";

// ---------------------------------------------------------------------------
// Seeded layout (module level, generated once). Units: 4K pixels.

const MARGIN = 160;
const SPAN = HEIGHT + 2 * MARGIN;

type Bubble = {
  layer: number; // 0 sharp · 1 slightly soft · 2 soft · 3 very soft & large
  x0: number;
  y0: number; // 0..1 of SPAN
  d: number; // diameter at the bottom, px
  k: number; // whole wraps per loop
  m: number; // whole wobble cycles per loop
  amp: number;
  ph: number;
  alpha: number;
};

type StreamBubble = { x: number; yOrigin: number; len: number; j: number; n: number; k: number; dMax: number };

const LAYERS = [
  { count: 2050, dMin: 5, dMax: 20, kMin: 1, kMax: 3, alpha: [0.75, 1.0] },
  { count: 1100, dMin: 7, dMax: 28, kMin: 1, kMax: 3, alpha: [0.55, 0.85] },
  { count: 560, dMin: 12, dMax: 46, kMin: 2, kMax: 4, alpha: [0.35, 0.6] },
  { count: 70, dMin: 60, dMax: 170, kMin: 4, kMax: 6, alpha: [0.18, 0.32] },
] as const;

const buildBubbles = (): Bubble[] => {
  const rng = mulberry32(14040221);
  const out: Bubble[] = [];
  LAYERS.forEach((L, layer) => {
    for (let i = 0; i < L.count; i++) {
      // many tiny, few large (power law)
      const u = Math.pow(rng(), 2.6);
      const d = L.dMin + (L.dMax - L.dMin) * u;
      // bigger bubbles rise faster: k grows with size
      const k = Math.min(L.kMax, L.kMin + Math.floor(u * (L.kMax - L.kMin + 1) + rng() * 0.6));
      out.push({
        layer,
        x0: range(rng, -40, WIDTH + 40),
        y0: rng(),
        d,
        k,
        m: 2 + Math.floor(rng() * 6),
        amp: range(rng, 0.5, 2.5) * (0.4 + d / 30),
        ph: rng() * TAU,
        alpha: range(rng, L.alpha[0], L.alpha[1]),
      });
    }
  });
  return out;
};

const buildStreams = (): StreamBubble[] => {
  const rng = mulberry32(8);
  const out: StreamBubble[] = [];
  for (let s = 0; s < 8; s++) {
    const x = range(rng, 0.06, 0.94) * WIDTH;
    // nucleation point: somewhere in the lower part of the glass (or below it)
    const yOrigin = range(rng, 0.55, 1.1) * HEIGHT;
    const len = yOrigin + MARGIN;
    const n = Math.round(len / range(rng, 34, 52));
    const k = 2 + Math.floor(rng() * 2);
    const dMax = range(rng, 10, 17);
    for (let j = 0; j < n; j++) out.push({ x, yOrigin, len, j, n, k, dMax });
  }
  return out;
};

const BUBBLES = buildBubbles();
const STREAMS = buildStreams();

// ---------------------------------------------------------------------------
// Bubble sprite atlas: one texture source, four cells (one per focus layer).

const CELL = 160;
const BLUR = [0, 2.2, 6, 16]; // atlas px

const drawAtlas = (p: ChampagnePalette) => {
  const c = document.createElement("canvas");
  c.width = CELL * 4;
  c.height = CELL;
  const ctx = c.getContext("2d")!;
  const R = CELL * 0.28;
  for (let i = 0; i < 4; i++) {
    const cx = CELL * i + CELL / 2;
    const cy = CELL / 2;
    ctx.save();
    ctx.filter = BLUR[i] > 0 ? `blur(${BLUR[i]}px)` : "none";
    // body: dark refracting rim, lighter core
    const body = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
    body.addColorStop(0, hexA(p.rim, 0.12));
    body.addColorStop(0.62, hexA(p.rim, 0.28));
    body.addColorStop(0.86, hexA(p.rim, 0.92));
    body.addColorStop(1.0, hexA(p.rim, 0.0));
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    // faint inner glow: light focused through the sphere, lower right
    const glow = ctx.createRadialGradient(cx + R * 0.18, cy + R * 0.22, 0, cx + R * 0.18, cy + R * 0.22, R * 0.55);
    glow.addColorStop(0, hexA(p.highlight, 0.55));
    glow.addColorStop(1, hexA(p.highlight, 0));
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.8, 0, TAU);
    ctx.fill();
    // specular highlight dot, top left
    const hx = cx - R * 0.36;
    const hy = cy - R * 0.38;
    const hl = ctx.createRadialGradient(hx, hy, 0, hx, hy, R * 0.26);
    hl.addColorStop(0, hexA(p.highlight, 1));
    hl.addColorStop(0.5, hexA(p.highlight, 0.85));
    hl.addColorStop(1, hexA(p.highlight, 0));
    ctx.fillStyle = hl;
    ctx.beginPath();
    ctx.arc(hx, hy, R * 0.26, 0, TAU);
    ctx.fill();
    ctx.restore();
  }
  return c;
};

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const hexVec = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// ---------------------------------------------------------------------------
// Shaders. Pixi 8 compiles a program as GLSL ES 3.00 only if its source
// contains "#version 300 es"; otherwise it falls back to ES 1.00 macros.
const ES3 = "#version 300 es\n";

const QUAD_VERT = ES3 + /* glsl */ `
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

const LIQUID_FRAG =
  ES3 +
  GLSL_HEADER +
  /* glsl */ `
in vec2 vUV;
out vec4 finalColor;
uniform vec2 uRes;
uniform float uT;
uniform vec3 uLiquid, uGlow, uVignette;
void main() {
  // vUV: (0,0) top-left
  float asp = uRes.x / uRes.y;
  vec2 p = vec2(vUV.x * asp, vUV.y);
  // the light behind the glass drifts once round a small circle per loop
  vec2 g = vec2(0.56 * asp + 0.05 * cos(6.28318530718 * uT), 0.16 + 0.03 * sin(6.28318530718 * uT));
  float d = length(p - g);
  vec3 c = mix(uGlow, uLiquid, smoothstep(0.0, 0.95, d));
  c += (uGlow - uLiquid) * 0.25 * exp(-d * d / 0.03);
  // warm vignette
  vec2 q = (vUV - vec2(0.5, 0.45)) * vec2(1.0, 0.9);
  float v = smoothstep(0.28, 0.85, length(q * vec2(1.25, 1.0)));
  c = mix(c, uVignette, 0.78 * v);
  c *= 1.0 + 0.035 * cos(6.28318530718 * uT);
  finalColor = vec4(c, 1.0);
}
`;

const FINAL_FRAG =
  ES3 +
  GLSL_HEADER +
  HASH +
  GRAIN_DITHER +
  /* glsl */ `
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uSrc;
void main() {
  ivec2 px = ivec2(gl_FragCoord.xy);
  vec3 c = texture(uSrc, vUV).rgb;
  finalColor = vec4(grainDither(c, px), 1.0);
}
`;

const quadGeometry = (w: number, h: number) =>
  new Geometry({
    attributes: {
      aPosition: [0, 0, w, 0, w, h, 0, h],
      aUV: [0, 0, 1, 0, 1, 1, 0, 1],
    },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });

// ---------------------------------------------------------------------------

type Scene = { render: (f: number) => void; destroy: () => void };

const createScene = async (canvas: HTMLCanvasElement, pw: number, ph: number, p: ChampagnePalette): Promise<Scene> => {
  const app = new Application();
  await app.init({
    canvas,
    width: pw,
    height: ph,
    resolution: 1,
    autoDensity: false,
    antialias: false,
    preference: "webgl",
    preserveDrawingBuffer: true,
    autoStart: false,
    sharedTicker: false,
    backgroundColor: 0x000000,
    hello: false,
  });
  app.ticker.stop();
  const renderer = app.renderer;
  const s = pw / WIDTH; // 4K px → output px

  const target = RenderTexture.create({ width: pw, height: ph, format: "rgba16float", resolution: 1 });

  const world = new Container();

  const liquidShader = Shader.from({
    gl: { vertex: QUAD_VERT, fragment: LIQUID_FRAG },
    resources: {
      liquidUniforms: {
        uRes: { value: [pw, ph], type: "vec2<f32>" },
        uT: { value: 0, type: "f32" },
        uLiquid: { value: hexVec(p.liquid), type: "vec3<f32>" },
        uGlow: { value: hexVec(p.glow), type: "vec3<f32>" },
        uVignette: { value: hexVec(p.vignette), type: "vec3<f32>" },
      },
    },
  });
  world.addChild(new Mesh({ geometry: quadGeometry(pw, ph), shader: liquidShader }));

  const atlasSource = Texture.from(drawAtlas(p)).source;
  atlasSource.scaleMode = "linear";
  const cellTex = [0, 1, 2, 3].map((i) => new Texture({ source: atlasSource, frame: new Rectangle(i * CELL, 0, CELL, CELL) }));
  const spriteScale = (d: number) => (d * s) / (CELL * 0.56);

  const mkContainer = () =>
    new ParticleContainer({
      dynamicProperties: { position: true, vertex: true, rotation: false, uvs: false, color: false },
      texture: cellTex[0],
    });
  const layers = [mkContainer(), mkContainer(), mkContainer(), mkContainer()];
  const streamC = mkContainer();
  const bubbleParticles = BUBBLES.map((b) => {
    const part = new Particle({ texture: cellTex[b.layer], anchorX: 0.5, anchorY: 0.5, alpha: b.alpha });
    layers[b.layer].addParticle(part);
    return part;
  });
  const streamParticles = STREAMS.map(() => {
    const part = new Particle({ texture: cellTex[0], anchorX: 0.5, anchorY: 0.5, alpha: 0.9 });
    streamC.addParticle(part);
    return part;
  });
  // back to front: soft (behind focus) → slightly soft → streams → sharp → very soft foreground
  world.addChild(layers[2], layers[1], streamC, layers[0], layers[3]);
  for (const c of [...layers, streamC]) c.boundsArea = new Rectangle(0, 0, pw, ph);

  const finalShader = Shader.from({
    gl: { vertex: QUAD_VERT, fragment: FINAL_FRAG },
    resources: {
      uSrc: target.source,
      uBlue: blueNoiseTexture().source,
      finalUniforms: { uFrame: { value: 0, type: "f32" } },
    },
  });
  const finalStage = new Container();
  finalStage.addChild(new Mesh({ geometry: quadGeometry(pw, ph), shader: finalShader }));

  const render = (f: number) => {
    const t = f / LOOP;
    liquidShader.resources.liquidUniforms.uniforms.uT = t;
    for (let i = 0; i < BUBBLES.length; i++) {
      const b = BUBBLES[i];
      const part = bubbleParticles[i];
      const yy = (((b.y0 - b.k * t) % 1) + 1) % 1; // 0 top … 1 bottom
      const y = yy * SPAN - MARGIN;
      const progress = 1 - yy; // how far it has risen
      const sc = spriteScale(b.d * (1 + 0.28 * progress));
      part.x = (b.x0 + b.amp * Math.sin(TAU * b.m * t + b.ph)) * s;
      part.y = y * s;
      part.scaleX = sc;
      part.scaleY = sc;
    }
    for (let i = 0; i < STREAMS.length; i++) {
      const b = STREAMS[i];
      const part = streamParticles[i];
      // evenly spaced; the whole line advances k stream-lengths per loop
      const u = (((b.j / b.n + b.k * t) % 1) + 1) % 1; // 0 at the nucleation point
      const y = b.yOrigin - u * b.len;
      const sc = spriteScale(3 + (b.dMax - 3) * Math.sqrt(u));
      part.x = b.x * s;
      part.y = y * s;
      part.scaleX = sc;
      part.scaleY = sc;
    }
    renderer.render({ container: world, target, clear: true });
    finalShader.resources.finalUniforms.uniforms.uFrame = f;
    renderer.render({ container: finalStage });
  };

  return {
    render,
    destroy: () => {
      target.destroy(true);
      app.destroy(false, { children: true, texture: true });
    },
  };
};

let blueTex: Texture | null = null;
const blueNoiseTexture = () => {
  if (!blueTex) {
    const bn = getBlueNoise();
    const rgba = new Uint8Array(bn.length * 4);
    for (let i = 0; i < bn.length; i++) {
      rgba[i * 4] = bn[i];
      rgba[i * 4 + 1] = bn[i];
      rgba[i * 4 + 2] = bn[i];
      rgba[i * 4 + 3] = 255;
    }
    blueTex = new Texture({
      source: new BufferImageSource({
        resource: rgba,
        width: BLUE_NOISE_SIZE,
        height: BLUE_NOISE_SIZE,
        scaleMode: "nearest",
        addressMode: "repeat",
      }),
    });
  }
  return blueTex;
};

export const Champagne: React.FC<ChampagnePalette> = (p) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const { pw, ph, width, height } = useOutputPixels();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);

  useEffect(() => {
    const handle = delayRender("PixiJS init");
    let alive = true;
    createScene(canvasRef.current!, pw, ph, p)
      .then((scene) => {
        if (!alive) {
          scene.destroy();
          return;
        }
        sceneRef.current = scene;
        scene.render(loopFrame(frameRef.current));
        continueRender(handle);
      })
      .catch((e) => cancelRender(e));
    return () => {
      alive = false;
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, [pw, ph, p]);

  useLayoutEffect(() => {
    sceneRef.current?.render(loopFrame(frame));
  }, [frame]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} width={pw} height={ph} style={{ width, height }} />
    </AbsoluteFill>
  );
};

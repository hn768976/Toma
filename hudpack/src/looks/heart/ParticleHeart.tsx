import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { useLayoutEffect, useMemo, useRef } from "react";
import {
  Container,
  Geometry,
  GlProgram,
  Mesh,
  RenderTexture,
  Shader,
  Texture,
  CanvasSource,
  UniformGroup,
  WebGLRenderer,
} from "pixi.js";
import { GLSL_HASH } from "../../lib/random";
import { backingSize } from "../../lib/scale";
import type { HeartPalette } from "../../versions";
import { getHeartData, HEART_UNITS_H, heartPath, ORIGIN } from "./heartData";

const FPS = 30;
const rgb = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return new Float32Array([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]);
};

// ---------------------------------------------------------------- shaders
// Everything moves in closed form: position = formula(particle data, time).
// Positions are in the 1280x720 design space and mapped straight to clip
// space, so the scene, the bloom passes and the composite share one
// orientation and nothing depends on Pixi's projection.

const COMMON = /* glsl */ `
${GLSL_HASH}
float easeIO(float x) { x = clamp(x, 0.0, 1.0); return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0; }
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
vec4 toClip(vec2 p) { return vec4(p.x / 640.0 - 1.0, 1.0 - p.y / 360.0, 0.0, 1.0); }
`;

const GLITTER_VERT = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 aPosition;   // heart target (heart units, y up)
in vec2 aBurst;
in vec4 aTime;       // launch, burst duration, gather start, gather duration
in vec4 aMisc;       // size, tone, swirl, kind
in vec4 aMisc2;      // near, curl, drift angle, edge
uniform float uT;
uniform float uBucket;
uniform vec2 uCenter;
uniform float uScale;
uniform vec2 uOrigin;
uniform float uPx;
uniform float uIntensity;
uniform vec3 uTone0;
uniform vec3 uTone1;
uniform vec3 uTone2;
out vec3 vColor;
out float vSoft;
${COMMON}
vec2 burstPos(float t) {
  float u = clamp((t - aTime.x) / aTime.y, 0.0, 1.0);
  float e = 1.0 - pow(1.0 - u, 3.0);
  vec2 d = aBurst - uOrigin;
  vec2 p = uOrigin + d * e + vec2(-d.y, d.x) * aMisc2.y * sin(3.14159265 * e);
  float dt = max(0.0, t - aTime.x - aTime.y);
  return p + vec2(cos(aMisc2.z), sin(aMisc2.z)) * dt * 7.0;
}
void main() {
  float t = uT;
  if (t < aTime.x) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); gl_PointSize = 1.0; vColor = vec3(0.0); vSoft = 0.0; return; }
  uint id = uint(gl_VertexID);
  bool heart = aMisc.w < 0.5;
  vec2 pos;
  float e = 0.0;
  if (heart) {
    float breathe = 1.0 + 0.02 * sin(6.2831853 * (t - 6.2) / 2.6) * smoothstep(6.2, 6.8, t);
    vec2 tgt = aPosition * vec2(1.0, -1.0) * uScale * breathe;
    // loose until the lock, then sharp
    float ja = hash3(id, 11u, 0u) * 6.2831853;
    float loose = 1.0 - smoothstep(5.5, 6.2, t);
    tgt += vec2(cos(ja), sin(ja)) * hash3(id, 12u, 0u) * (9.0 * loose + 7.0 * aMisc2.w * aMisc2.w);
    vec2 a = burstPos(t) - uCenter;
    float phi = aMisc.z;
    e = easeIO((t - aTime.z) / aTime.w);
    pos = uCenter + rot(phi * (1.0 - e)) * mix(rot(-phi) * a, tgt, e);
  } else {
    pos = burstPos(t);
  }

  // twinkle: hash of id and a 4-frame bucket, blended between buckets
  float bf = floor(uBucket);
  float h0 = hash3(id, uint(bf), 1u);
  float h1 = hash3(id, uint(bf) + 1u, 1u);
  float tw = mix(h0, h1, smoothstep(0.0, 1.0, uBucket - bf));
  if (heart) {
    // chunky sequins: small cells of the heart twinkle together
    uvec2 cell = uvec2(floor((aPosition + 20.0) / vec2(0.5, 0.42)));
    float c0 = hash3(cell.x, cell.y, uint(bf) + 77u);
    float c1 = hash3(cell.x, cell.y, uint(bf) + 78u);
    tw = mix(tw, mix(c0, c1, smoothstep(0.0, 1.0, uBucket - bf)), 0.6);
  }
  float b = 0.12 + 1.7 * tw * tw * tw;
  if (heart) {
    // soft light patches drifting through the heart (two moving waves)
    vec2 q = aPosition;
    float blot = sin(q.x * 1.7 + t * 0.9) * sin(q.y * 1.5 - t * 0.6) + 0.5 * sin(q.x * 0.9 - q.y * 1.1 + t * 1.1);
    b *= 0.75 + 0.75 * smoothstep(0.3, 1.4, blot);
  }
  if (hash3(id, uint(floor(uBucket * 0.5)), 2u) > 0.992) b += 2.5;

  // shimmer wave across the heart as it locks
  if (heart) {
    float w = mix(-1.3, 1.3, clamp((t - 5.55) / 0.65, 0.0, 1.0));
    float win = step(5.5, t) * (1.0 - smoothstep(6.15, 6.3, t));
    b *= 1.0 + 2.2 * win * exp(-pow((aPosition.x / 16.0 - w) / 0.16, 2.0));
    b *= mix(0.3, 1.0, e); // sparse, dim glitter in flight; full once in the heart
  } else {
    b *= mix(1.0, aMisc2.x > 0.0 ? 0.9 : 0.0, smoothstep(4.5, 6.0, t));
  }

  // fake depth: near particles are bigger, softer and dimmer
  float near = aMisc2.x * (heart ? (1.0 - e) : 1.0);
  float size = aMisc.y < 0.5 ? aMisc.x : aMisc.x * 0.9;
  size *= 1.0 + 4.0 * near;
  b /= pow(1.0 + 4.0 * near, 1.4);

  float fadeIn = smoothstep(aTime.x, aTime.x + 0.15, t);
  vec3 tone = aMisc.y < 0.5 ? uTone0 : (aMisc.y < 1.5 ? uTone1 : uTone2);
  if (!heart && aMisc2.x > 0.0) tone = mix(tone, uTone0 * vec3(0.85, 0.35, 0.45), 0.6);
  vColor = tone * b * fadeIn * uIntensity;
  vSoft = near;
  gl_Position = toClip(pos);
  gl_PointSize = max(1.0, size * uPx * 2.0);
}
`;

const GLITTER_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec3 vColor;
in float vSoft;
out vec4 finalColor;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r2 = dot(q, q) * 4.0;
  float a = exp(-r2 * mix(3.2, 1.8, vSoft));
  if (a < 0.02) discard;
  finalColor = vec4(vColor * a, a);
}
`;

const HEARTS_VERT = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 aPosition;   // gather: heart target; stay: (orbit radius, angle)
in vec2 aBurst;
in vec4 aTime;
in vec4 aMisc;       // size, blur level, rotation, kind
in vec4 aMisc2;      // brightness, orbit speed, bob phase
uniform float uT;
uniform vec2 uCenter;
uniform float uScale;
uniform float uHalfH;
uniform vec2 uOrigin;
uniform float uPx;
uniform vec3 uColor;
out vec4 vColor;
out float vLevel;
out float vAngle;
${COMMON}
void main() {
  float t = uT;
  if (t < aTime.x) { gl_Position = vec4(2.0, 2.0, 0.0, 1.0); gl_PointSize = 1.0; vColor = vec4(0.0); vLevel = 0.0; vAngle = 0.0; return; }
  float u = clamp((t - aTime.x) / aTime.y, 0.0, 1.0);
  float eb = 1.0 - pow(1.0 - u, 3.0);
  vec2 d = aBurst - uOrigin;
  vec2 bp = uOrigin + d * eb + vec2(-d.y, d.x) * 0.15 * sin(3.14159265 * eb);
  bp += vec2(0.0, -10.0) * max(0.0, t - aTime.x - aTime.y);
  bool stay = aMisc.w > 0.5;
  vec2 tgt;
  if (stay) {
    float th = aPosition.y + aMisc2.y * t;
    tgt = vec2(cos(th) * 1.25, sin(th)) * aPosition.x * uHalfH + vec2(0.0, 7.0 * sin(0.9 * t + aMisc2.z));
  } else {
    tgt = aPosition * vec2(1.0, -1.0) * uScale;
  }
  float e = easeIO((t - aTime.z) / aTime.w);
  float phi = 1.3;
  vec2 pos = uCenter + rot(phi * (1.0 - e)) * mix(rot(-phi) * (bp - uCenter), tgt, e);
  float alpha = smoothstep(aTime.x, aTime.x + 0.2, t);
  if (!stay) alpha *= 1.0 - smoothstep(0.45, 0.95, e);
  float size = aMisc.x * (stay ? mix(1.0, 0.75, e) : 1.0);
  vColor = vec4(uColor * aMisc2.x, 1.0) * alpha;
  vLevel = aMisc.y;
  vAngle = aMisc.z + 0.25 * sin(1.3 * t + aMisc2.z);
  gl_Position = toClip(pos);
  gl_PointSize = max(1.0, size * uPx * 1.25);
}
`;

const HEARTS_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec4 vColor;
in float vLevel;
in float vAngle;
uniform sampler2D uAtlas;
out vec4 finalColor;
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, s, -s, c); }
void main() {
  vec2 uv = rot(vAngle) * (gl_PointCoord - 0.5) * 1.25 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
  float a = texture(uAtlas, vec2((vLevel + uv.x) / 4.0, uv.y)).a * vColor.a;
  if (a < 0.004) discard;
  finalColor = vec4(vColor.rgb * a, a);
}
`;

const QUAD_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
out vec2 vUV;
void main() { vUV = aPosition; gl_Position = vec4(aPosition * 2.0 - 1.0, 0.0, 1.0); }
`;

const DOWN_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uTexel;
out vec4 finalColor;
void main() {
  vec4 c = texture(uTex, vUV + uTexel * vec2(-1.0, -1.0)) + texture(uTex, vUV + uTexel * vec2(1.0, -1.0))
         + texture(uTex, vUV + uTexel * vec2(-1.0, 1.0)) + texture(uTex, vUV + uTexel * vec2(1.0, 1.0));
  finalColor = c * 0.25;
}
`;

const BLUR_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uTex;
uniform vec2 uStep;
out vec4 finalColor;
void main() {
  float w[5] = float[](0.2270270, 0.1945946, 0.1216216, 0.0540541, 0.0162162);
  vec4 c = texture(uTex, vUV) * w[0];
  for (int i = 1; i < 5; i++) {
    c += texture(uTex, vUV + uStep * float(i)) * w[i];
    c += texture(uTex, vUV - uStep * float(i)) * w[i];
  }
  finalColor = c;
}
`;

const COMP_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUV;
uniform sampler2D uScene;
uniform sampler2D uBloomA;
uniform sampler2D uBloomB;
uniform float uBloomK;
uniform vec2 uGlowPos;   // design px
uniform float uGlowR;    // design px
uniform float uGlowAmp;
uniform vec3 uGlowColor;
out vec4 finalColor;
void main() {
  vec3 c = texture(uScene, vUV).rgb;
  c += (texture(uBloomA, vUV).rgb * 0.55 + texture(uBloomB, vUV).rgb * 0.75) * uBloomK;
  vec2 p = vec2(vUV.x * 1280.0, (1.0 - vUV.y) * 720.0);
  float d = length(p - uGlowPos) / uGlowR;
  c += uGlowColor * uGlowAmp * exp(-d * d);
  // soft shoulder so dense glitter keeps its colour instead of clipping to white
  c = c / (1.0 + 0.1 * max(max(c.r, c.g), c.b));
  finalColor = vec4(clamp(c * 1.1, 0.0, 1.0), 1.0);
}
`;

// ---------------------------------------------------------------- pixi setup

const quadGeometry = () =>
  new Geometry({
    attributes: { aPosition: { buffer: new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), format: "float32x2" } },
    indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
    topology: "triangle-list",
  });

const program = (vertex: string, fragment: string, name: string) => GlProgram.from({ vertex, fragment, name });

const heartAtlas = () => {
  const cell = 128;
  const c = document.createElement("canvas");
  c.width = cell * 4;
  c.height = cell;
  const ctx = c.getContext("2d")!;
  [0, 4, 9, 16].forEach((blur, i) => {
    ctx.save();
    ctx.filter = blur ? `blur(${blur}px)` : "none";
    ctx.fillStyle = "#ffffff";
    heartPath(ctx, i * cell + cell / 2, cell / 2, cell * (blur ? 0.62 - blur * 0.008 : 0.8));
    ctx.fill();
    ctx.restore();
  });
  const source = new CanvasSource({
    resource: c,
    autoGenerateMipmaps: true,
    alphaMode: "premultiply-alpha-on-upload",
  });
  source.style.minFilter = "linear";
  source.style.magFilter = "linear";
  source.style.mipmapFilter = "linear";
  return new Texture({ source });
};

interface HeartRig {
  renderer: WebGLRenderer;
  draw: (frame: number) => void;
  destroy: () => void;
}

const createRig = async (host: HTMLDivElement, w: number, h: number, cssW: number, cssH: number, palette: HeartPalette): Promise<HeartRig> => {
  const renderer = new WebGLRenderer();
  await renderer.init({
    width: w,
    height: h,
    resolution: 1,
    autoDensity: false,
    antialias: false,
    background: 0x000000,
    backgroundAlpha: 1,
    preserveDrawingBuffer: true,
    preferWebGLVersion: 2,
    powerPreference: "high-performance",
    hello: false,
  });
  const canvas = renderer.canvas as HTMLCanvasElement;
  Object.assign(canvas.style, { position: "absolute", left: "0px", top: "0px", width: `${cssW}px`, height: `${cssH}px` });
  host.appendChild(canvas);

  const data = getHeartData();
  const px = w / 1280;
  const scale = (palette.heartHeight * 720) / HEART_UNITS_H; // design px per heart unit
  const center = new Float32Array([640, 360]);
  const origin = new Float32Array([ORIGIN.x, ORIGIN.y]);

  // glitter
  const g = data.glitter;
  const glitterU = new UniformGroup({
    uT: { value: 0, type: "f32" },
    uBucket: { value: 0, type: "f32" },
    uCenter: { value: center, type: "vec2<f32>" },
    uScale: { value: scale, type: "f32" },
    uOrigin: { value: origin, type: "vec2<f32>" },
    uPx: { value: px, type: "f32" },
    uIntensity: { value: 0.62, type: "f32" },
    uTone0: { value: rgb(palette.glitter[0]), type: "vec3<f32>" },
    uTone1: { value: rgb(palette.glitter[1]), type: "vec3<f32>" },
    uTone2: { value: rgb(palette.glitter[2]), type: "vec3<f32>" },
  });
  const glitter = new Mesh({
    geometry: new Geometry({
      attributes: {
        aPosition: { buffer: g.target, format: "float32x2" },
        aBurst: { buffer: g.burst, format: "float32x2" },
        aTime: { buffer: g.time, format: "float32x4" },
        aMisc: { buffer: g.misc, format: "float32x4" },
        aMisc2: { buffer: g.misc2, format: "float32x4" },
      },
      topology: "point-list",
    }),
    shader: new Shader({ glProgram: program(GLITTER_VERT, GLITTER_FRAG, "glitter"), resources: { glitterU } }),
  });
  glitter.blendMode = "add";

  // tiny hearts
  const hs = data.hearts;
  const atlas = heartAtlas();
  const heartsU = new UniformGroup({
    uT: { value: 0, type: "f32" },
    uCenter: { value: center, type: "vec2<f32>" },
    uScale: { value: scale, type: "f32" },
    uHalfH: { value: (palette.heartHeight * 720) / 2, type: "f32" },
    uOrigin: { value: origin, type: "vec2<f32>" },
    uPx: { value: px, type: "f32" },
    uColor: { value: rgb(palette.hearts), type: "vec3<f32>" },
  });
  const hearts = new Mesh({
    geometry: new Geometry({
      attributes: {
        aPosition: { buffer: hs.target, format: "float32x2" },
        aBurst: { buffer: hs.burst, format: "float32x2" },
        aTime: { buffer: hs.time, format: "float32x4" },
        aMisc: { buffer: hs.misc, format: "float32x4" },
        aMisc2: { buffer: hs.misc2, format: "float32x4" },
      },
      topology: "point-list",
    }),
    shader: new Shader({ glProgram: program(HEARTS_VERT, HEARTS_FRAG, "hearts"), resources: { heartsU, uAtlas: atlas.source } }),
  });
  hearts.blendMode = "normal";

  const sceneC = new Container();
  sceneC.addChild(glitter, hearts);

  // half-float targets: scene, and two bloom levels (1/4 and 1/8)
  const rt = (rw: number, rh: number) => RenderTexture.create({ width: Math.max(1, Math.round(rw)), height: Math.max(1, Math.round(rh)), format: "rgba16float", resolution: 1 });
  const rtScene = rt(w, h);
  const rtA1 = rt(w / 4, h / 4);
  const rtA2 = rt(w / 4, h / 4);
  const rtB1 = rt(w / 8, h / 8);
  const rtB2 = rt(w / 8, h / 8);

  const quad = quadGeometry();
  const pass = (frag: string, name: string, resources: Record<string, unknown>) =>
    new Mesh({ geometry: quad, shader: new Shader({ glProgram: program(QUAD_VERT, frag, name), resources }) });

  const downA = pass(DOWN_FRAG, "downA", {
    uTex: rtScene.source,
    downAU: new UniformGroup({ uTexel: { value: new Float32Array([1 / w, 1 / h]), type: "vec2<f32>" } }),
  });
  const blurA1 = pass(BLUR_FRAG, "blurA1", { uTex: rtA1.source, bU: new UniformGroup({ uStep: { value: new Float32Array([1.4 / rtA1.width, 0]), type: "vec2<f32>" } }) });
  const blurA2 = pass(BLUR_FRAG, "blurA2", { uTex: rtA2.source, bU: new UniformGroup({ uStep: { value: new Float32Array([0, 1.4 / rtA1.height]), type: "vec2<f32>" } }) });
  const downB = pass(DOWN_FRAG, "downB", {
    uTex: rtA1.source,
    downBU: new UniformGroup({ uTexel: { value: new Float32Array([0.5 / rtA1.width, 0.5 / rtA1.height]), type: "vec2<f32>" } }),
  });
  const blurB1 = pass(BLUR_FRAG, "blurB1", { uTex: rtB1.source, bU: new UniformGroup({ uStep: { value: new Float32Array([1.6 / rtB1.width, 0]), type: "vec2<f32>" } }) });
  const blurB2 = pass(BLUR_FRAG, "blurB2", { uTex: rtB2.source, bU: new UniformGroup({ uStep: { value: new Float32Array([0, 1.6 / rtB1.height]), type: "vec2<f32>" } }) });
  const compU = new UniformGroup({
    uBloomK: { value: 0.16, type: "f32" },
    uGlowPos: { value: origin, type: "vec2<f32>" },
    uGlowR: { value: 90, type: "f32" },
    uGlowAmp: { value: 0, type: "f32" },
    uGlowColor: { value: rgb(palette.glitter[1]), type: "vec3<f32>" },
  });
  const comp = pass(COMP_FRAG, "composite", { uScene: rtScene.source, uBloomA: rtA1.source, uBloomB: rtB1.source, compU });

  const draw = (frame: number) => {
    const t = frame / FPS;
    glitterU.uniforms.uT = t;
    glitterU.uniforms.uBucket = frame / 4;
    glitterU.update();
    heartsU.uniforms.uT = t;
    heartsU.update();
    // the lower-left glow: appears in the first second, flares with the
    // burst, gone by 3 s (exactly zero after)
    const appear = Math.min(1, t / 1.0);
    const flare = t < 1 ? 0 : Math.exp(-Math.pow((t - 1.25) / 0.35, 2));
    const out = t < 1.6 ? 1 : Math.max(0, 1 - (t - 1.6) / 1.4);
    compU.uniforms.uGlowAmp = (0.22 * appear * appear + 0.55 * flare) * out;
    compU.uniforms.uGlowR = 70 + 50 * flare;
    compU.update();

    renderer.render({ container: sceneC, target: rtScene, clear: true, clearColor: [0, 0, 0, 0] });
    renderer.render({ container: downA, target: rtA1, clear: true, clearColor: [0, 0, 0, 0] });
    renderer.render({ container: blurA1, target: rtA2, clear: true, clearColor: [0, 0, 0, 0] });
    renderer.render({ container: blurA2, target: rtA1, clear: true, clearColor: [0, 0, 0, 0] });
    renderer.render({ container: downB, target: rtB1, clear: true, clearColor: [0, 0, 0, 0] });
    renderer.render({ container: blurB1, target: rtB2, clear: true, clearColor: [0, 0, 0, 0] });
    renderer.render({ container: blurB2, target: rtB1, clear: true, clearColor: [0, 0, 0, 0] });
    renderer.render({ container: comp, clear: true, clearColor: [0, 0, 0, 1] });
  };

  return {
    renderer,
    draw,
    destroy: () => {
      canvas.remove();
      renderer.destroy();
    },
  };
};

export const ParticleHeart: React.FC<{ palette: HeartPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const host = useRef<HTMLDivElement>(null);
  const rig = useRef<HeartRig | null>(null);
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const size = useMemo(() => backingSize(width, height), [width, height]);

  useLayoutEffect(() => {
    let alive = true;
    const handle = delayRender("Initialising PixiJS");
    createRig(host.current!, size.w, size.h, width, height, palette)
      .then((r) => {
        if (!alive) return r.destroy();
        rig.current = r;
        r.draw(frameRef.current);
        continueRender(handle);
      })
      .catch((e) => {
        console.error(e);
        continueRender(handle);
      });
    return () => {
      alive = false;
      rig.current?.destroy();
      rig.current = null;
    };
  }, [palette, size, width, height]);

  useLayoutEffect(() => {
    rig.current?.draw(frame);
  }, [frame]);

  return <AbsoluteFill ref={host} style={{ backgroundColor: "#000" }} />;
};

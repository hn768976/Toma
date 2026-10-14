import { Application, Container, Geometry, Mesh, RenderTexture, Shader } from "pixi.js";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, useCurrentFrame, useDelayRender, useRemotionEnvironment, useVideoConfig } from "remotion";
import { GRAIN_GLSL, SIMPLEX3_GLSL } from "../lib/glsl";
import { mulberry32, phaseOf } from "../lib/random";
import type { OrbPalette } from "../versions";

const COUNT = 120_000;

// Base directions (uniform on the sphere) + per-particle randoms, built once.
const BASE = (() => {
  const rnd = mulberry32(1904226409);
  const pos = new Float32Array(COUNT * 3);
  const rand = new Float32Array(COUNT * 2);
  for (let i = 0; i < COUNT; i++) {
    const z = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(1 - z * z);
    pos[i * 3] = r * Math.cos(a);
    pos[i * 3 + 1] = z;
    pos[i * 3 + 2] = r * Math.sin(a);
    rand[i * 2] = rnd();
    rand[i * 2 + 1] = rnd();
  }
  return { pos, rand };
})();

const hexToLinear = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [f((n >> 16) & 255), f((n >> 8) & 255), f(n & 255)];
};

const ORB_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec3 aPosition;
in vec2 aRand;
uniform float uPhase;
uniform vec2 uRes;
uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uBot;
out vec3 vColor;
out float vPx;
${SIMPLEX3_GLSL}
const float TAU = 6.28318530718;
// Velocity on the unit sphere at point p: divergence-free curl of a stream
// function, plus a small gradient term that piles particles into ridges.
vec3 sphereFlow(vec3 p, vec3 tOff){
  vec4 s = snoiseGrad(p * 0.9 + tOff);
  vec3 g = s.xyz - p * dot(p, s.xyz);
  vec3 curl = cross(p, g);
  vec4 c = snoiseGrad(p * 1.7 + tOff.zxy + vec3(11.3, 4.1, 7.7));
  vec3 g2 = c.xyz - p * dot(p, c.xyz);
  return curl + 0.012 * g2;
}
vec3 warpQ(vec3 p, vec3 tOff){
  vec3 q = p;
  for (int i = 0; i < 2; i++) q = normalize(q + 0.11 * sphereFlow(q, tOff + vec3(0.0, 0.0, 0.4 + float(i) * 0.1)));
  return q;
}
void main(){
  float th = TAU * uPhase;
  // time enters only as a point on a circle in noise space -> exactly periodic
  vec3 tOff = vec3(cos(th), sin(th), 0.0) * 0.55;
  vec3 tOff2 = vec3(0.0, cos(th), sin(th)) * 0.55 + vec3(3.7, 1.9, 5.3);
  vec3 p = aPosition;
  // closed-path advection: integrate a short streamline of the (periodic) field;
  // nothing is carried between frames
  for (int i = 0; i < 5; i++) {
    vec3 off = tOff + vec3(0.0, 0.0, float(i) * 0.05);
    p = normalize(p + 0.03 * sphereFlow(p, off));
  }
  // Thick swirling bands: a low-frequency field on a swirled copy of the
  // sphere; particles outside the bands are hidden, so the orb reads as a
  // few rope-like ribbons with black gaps between them.
  // Particles that fall in a gap are reflected across the band edge into the
  // band (one Newton-style step on the field), so the bands are densely
  // packed and the gaps are truly empty, without piling onto a crest line.
  {
    vec3 q0 = warpQ(p, tOff);
    vec4 f0 = snoiseGrad(q0 * 0.55 + tOff2);
    float n0 = 0.85 * f0.w;
    if (n0 < -0.02) {
      vec3 gt0 = 0.55 * 0.85 * (f0.xyz - p * dot(p, f0.xyz));
      float gg = max(dot(gt0, gt0), 0.04);
      vec3 stepv = gt0 * ((0.06 - 2.0 * n0) / gg);
      float L = length(stepv);
      p = normalize(p + stepv * min(1.0, 0.45 / max(L, 1e-4)));
    }
  }
  vec3 q = warpQ(p, tOff);
  vec4 g1 = snoiseGrad(q * 0.55 + tOff2);
  vec4 g2 = snoiseGrad(q * 2.6 - tOff2.yzx);
  float nsum = 0.85 * g1.w + 0.15 * g2.w;
  // radial displacement +-8%: bands lifted, gaps sunk -> folds and ridges
  float an = nsum;
  float disp = 0.08 * clamp(1.5 * nsum, -1.0, 1.0);
  // normal of the displaced surface (for fold shading)
  vec3 dgn = 0.85 * 0.55 * g1.xyz + 0.15 * 2.6 * g2.xyz;
  vec3 dg = 0.08 * 1.5 * dgn * step(abs(1.5 * nsum), 1.0);
  // shading normal exaggerates the slope 3.5x so +-8% folds read as deep creases
  vec3 fn = normalize(p - 5.0 * (dg - p * dot(p, dg)));
  float r = 1.0 + disp;
  // a slight shell thickness so the surface reads as a cloud of particles
  r += (aRand.y - 0.5) * 0.025;
  // stragglers outside the bands scatter a little -> frayed, broken silhouette
  r += (1.0 - smoothstep(-0.05, 0.25, nsum)) * (aRand.x - 0.3) * 0.12;
  vec3 P = p * r;
  // rotation: exactly 360 degrees per loop about a slightly tilted axis
  float ang = TAU * uPhase;
  float ca = cos(ang), sa = sin(ang);
  P = vec3(ca * P.x + sa * P.z, P.y, -sa * P.x + ca * P.z);
  vec3 N = vec3(ca * p.x + sa * p.z, p.y, -sa * p.x + ca * p.z);
  float tilt = 0.28;
  float ct = cos(tilt), st = sin(tilt);
  P = vec3(P.x, ct * P.y - st * P.z, st * P.y + ct * P.z);
  N = vec3(N.x, ct * N.y - st * N.z, st * N.y + ct * N.z);
  // camera on +z at distance 4, looking at the origin
  float camD = 4.0;
  float focal = 3.1; // sphere silhouette ~0.40-0.42 of frame height incl. folds
  float zv = camD - P.z;
  float aspect = uRes.x / uRes.y;
  gl_Position = vec4(P.x * focal / (zv * aspect), P.y * focal / zv, (zv - 2.0) / 4.0, 1.0);
  float scale = uRes.y / 720.0;
  float px = (1.2 + aRand.x * 0.8) * scale;
  vPx = px;
  gl_PointSize = px + 1.0;
  // colour: gradient by height, shifted along the folds
  float hgt = clamp(P.y * 0.5 + 0.5 + disp * 1.6, 0.0, 1.0);
  vec3 col = hgt > 0.5 ? mix(uMid, uTop, smoothstep(0.5, 0.95, hgt)) : mix(uBot, uMid, smoothstep(0.05, 0.5, hgt));
  // rim: brighter at the silhouette; back hemisphere dimmer
  vec3 V = normalize(vec3(0.0, 0.0, camD) - P);
  float facing = dot(N, V);
  float rim = pow(1.0 - abs(facing), 2.5);
  float front = facing > 0.0 ? 1.0 : 0.03;
  // limb darkening: removes the bright circular rim a thin shell would give
  front *= mix(0.35, 1.0, smoothstep(0.0, 0.6, facing));
  vec3 FN = vec3(ca * fn.x + sa * fn.z, fn.y, -sa * fn.x + ca * fn.z);
  FN = vec3(FN.x, ct * FN.y - st * FN.z, st * FN.y + ct * FN.z);
  float lit = max(dot(FN, normalize(vec3(-0.35, 0.55, 0.75))), 0.0);
  float fold = smoothstep(-0.08, 0.08, disp);
  float crease = smoothstep(-0.55, -0.1, an);
  float band = smoothstep(-0.1, 0.06, nsum);
  float b = (0.75 + 0.8 * lit) * (0.55 + 0.45 * fold) * band * front * (0.7 + 0.6 * aRand.y);
  vColor = col * b * 1.7;
  // keep the hue: compress instead of clipping the blue channel toward cyan
  float mx = max(vColor.r, max(vColor.g, vColor.b));
  vColor *= min(1.0, 0.9 / max(mx, 1e-4));
}
`;

const ORB_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec3 vColor;
in float vPx;
out vec4 fragColor;
void main(){
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r = length(q) * (vPx + 1.0) * 0.5;
  float a = 1.0 - smoothstep(vPx * 0.5 - 0.5, vPx * 0.5 + 0.5, r);
  fragColor = vec4(vColor * a, a);
}
`;

const COMP_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
void main(){ gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const COMP_FRAG = /* glsl */ `#version 300 es
precision highp float;
uniform sampler2D uTexture;
uniform vec2 uRes;
uniform float uFrame;
out vec4 fragColor;
${GRAIN_GLSL}
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  vec3 c = texture(uTexture, uv).rgb;
  // soft glow: 24-tap golden-spiral blur, radius ~7px at 720p
  float s = uRes.y / 720.0;
  vec3 g = vec3(0.0);
  for (int i = 0; i < 24; i++) {
    float rr = 7.0 * s * sqrt((float(i) + 0.5) / 24.0);
    float a = float(i) * 2.39996323;
    g += texture(uTexture, uv + vec2(cos(a), sin(a)) * rr / uRes).rgb;
  }
  c += g / 24.0 * 0.15;
  vec3 hi = max(c - 0.8, 0.0);
  c = min(c, 0.8) + hi / (1.0 + hi * 2.5);
  vec3 srgb = linearToSrgb(c);
  srgb = grainDither(srgb, gl_FragCoord.xy, uFrame, 0.015, 1.0);
  fragColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}
`;

type PixiState = {
  app: Application;
  orbStage: Container;
  compStage: Container;
  rt: RenderTexture;
  orbShader: Shader;
  compShader: Shader;
};

export const ParticleOrb: React.FC<{ palette: OrbPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { isRendering } = useRemotionEnvironment();
  const { delayRender, continueRender } = useDelayRender();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<PixiState | null>(null);
  const [initHandle] = useState(() => delayRender("PixiJS init"));
  const released = useRef(false);
  const dpr = typeof window === "undefined" ? 1 : isRendering ? window.devicePixelRatio || 1 : Math.min(window.devicePixelRatio || 1, 0.5);
  const bw = Math.round(width * dpr);
  const bh = Math.round(height * dpr);

  useEffect(() => {
    let cancelled = false;
    let created: PixiState | null = null;
    (async () => {
      const app = new Application();
      await app.init({
        canvas: canvasRef.current!,
        width: bw,
        height: bh,
        resolution: 1,
        autoDensity: false,
        preference: "webgl",
        antialias: false,
        autoStart: false,
        sharedTicker: false,
        backgroundColor: 0x000000,
        preserveDrawingBuffer: true,
        hello: false,
      });
      app.ticker?.stop();
      const geometry = new Geometry({
        attributes: {
          aPosition: { buffer: BASE.pos, format: "float32x3", stride: 12 },
          aRand: { buffer: BASE.rand, format: "float32x2", stride: 8 },
        },
        topology: "point-list",
      });
      const top = hexToLinear(palette.top), mid = hexToLinear(palette.mid), bot = hexToLinear(palette.bottom);
      const orbShader = Shader.from({
        gl: { vertex: ORB_VERT, fragment: ORB_FRAG },
        resources: {
          orbUniforms: {
            uPhase: { value: 0, type: "f32" },
            uRes: { value: [bw, bh], type: "vec2<f32>" },
            uTop: { value: top, type: "vec3<f32>" },
            uMid: { value: mid, type: "vec3<f32>" },
            uBot: { value: bot, type: "vec3<f32>" },
          },
        },
      });
      const orb = new Mesh({ geometry, shader: orbShader });
      orb.blendMode = "add";
      const orbStage = new Container();
      orbStage.addChild(orb);

      const rt = RenderTexture.create({ width: bw, height: bh, resolution: 1, format: "rgba16float", antialias: false });
      const quad = new Geometry({
        attributes: { aPosition: { buffer: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]), format: "float32x2" } },
        indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
      });
      const compShader = Shader.from({
        gl: { vertex: COMP_VERT, fragment: COMP_FRAG },
        resources: {
          uTexture: rt.source,
          compUniforms: {
            uRes: { value: [bw, bh], type: "vec2<f32>" },
            uFrame: { value: 0, type: "f32" },
          },
        },
      });
      const comp = new Mesh({ geometry: quad, shader: compShader });
      const compStage = new Container();
      compStage.addChild(comp);
      created = { app, orbStage, compStage, rt, orbShader, compShader };
      if (cancelled) {
        app.destroy();
        return;
      }
      setState(created);
    })().catch((e) => {
      // surface init errors to the renderer instead of timing out
      throw e;
    });
    return () => {
      cancelled = true;
      if (created) created.app.destroy();
    };
  }, [bw, bh, palette]);

  // Render the stage once per Remotion frame (no ticker).
  useLayoutEffect(() => {
    if (!state) return;
    const f = ((frame % 600) + 600) % 600;
    state.orbShader.resources.orbUniforms.uniforms.uPhase = phaseOf(frame);
    state.compShader.resources.compUniforms.uniforms.uFrame = f;
    state.app.renderer.render({ container: state.orbStage, target: state.rt, clear: true, clearColor: [0, 0, 0, 1] });
    state.app.renderer.render({ container: state.compStage, clear: true, clearColor: [0, 0, 0, 1] });
    if (!released.current) {
      released.current = true;
      continueRender(initHandle);
    }
  }, [state, frame, continueRender, initHandle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} width={bw} height={bh} style={{ width, height }} />
    </AbsoluteFill>
  );
};

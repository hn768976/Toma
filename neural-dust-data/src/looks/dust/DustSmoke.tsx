import React, { useMemo } from "react";
import {
  Application,
  Container,
  Filter,
  Geometry,
  GlProgram,
  Mesh,
  Particle,
  ParticleContainer,
  Rectangle,
  RenderTexture,
  Shader,
  Sprite,
  Texture,
  defaultFilterVert,
} from "pixi.js";
import { PixiFactory, PixiLook } from "../../lib/pixi/PixiLook";
import { mulberry32, TAU } from "../../lib/random";
import { hexToRgb } from "../../lib/color";
import { DustVersion } from "./versions";

export const DUST_LOOP = 600;

// ---------------------------------------------------------------------------
// Camera model (projection done in JS): vertical FOV 50deg, focus at ZF.
// ---------------------------------------------------------------------------
const TANH = Math.tan((25 * Math.PI) / 180);
const ASPECT = 16 / 9;
const ZF = 5.0;
const COC_K = 48; // CoC diameter in 4K px = COC_K * |1/z - 1/ZF|
const N_SPECKS = 200_000;
const LEVELS = 8; // bokeh textures: 0 = sharp dot ... 7 = big soft disc
const CELL = 128;

// Flow: three divergence-free sine "stream function" terms + per-speck wobble.
// Time enters only as cos/sin(n * theta), theta = 2*pi*frame/600 -> closed paths.
const FLOW = [
  { kx: 0.9, ky: 0.55, kz: 0.3, c: 0.3, n: 1, a: 0.075 },
  { kx: -0.5, ky: 1.1, kz: -0.45, c: 2.1, n: 1, a: 0.06 },
  { kx: 1.6, ky: -0.9, kz: 0.8, c: 4.4, n: 2, a: 0.03 },
];

// Particle data, built once at module level from a fixed seed.
const SPECK = (() => {
  const rnd = mulberry32(1100478509);
  const xn0 = new Float32Array(N_SPECKS);
  const yn0 = new Float32Array(N_SPECKS);
  const inv = new Float32Array(N_SPECKS); // 1 / (z * tanH): world -> normalised y
  const level = new Uint8Array(N_SPECKS);
  const diam = new Float32Array(N_SPECKS); // sprite diameter, 4K px
  const alpha = new Float32Array(N_SPECKS);
  const cs = new Float32Array(N_SPECKS * FLOW.length * 2); // cos/sin of spatial phase
  const wob = new Float32Array(N_SPECKS * 4); // radius, cos psi, sin psi, harmonic
  for (let i = 0; i < N_SPECKS; i++) {
    const z = 0.7 + 13.3 * Math.cbrt(rnd()); // density ~ z^2 (uniform in the frustum)
    const xn = (rnd() * 2 - 1) * 1.15;
    const yn = (rnd() * 2 - 1) * 1.15;
    xn0[i] = xn;
    yn0[i] = yn;
    inv[i] = 1 / (z * TANH);
    const xw = xn * z * TANH * ASPECT;
    const yw = yn * z * TANH;
    FLOW.forEach((f, k) => {
      const ph = f.kx * xw + f.ky * yw + f.kz * z + f.c;
      cs[(i * FLOW.length + k) * 2] = Math.cos(ph);
      cs[(i * FLOW.length + k) * 2 + 1] = Math.sin(ph);
    });
    const psi = rnd() * TAU;
    wob[i * 4] = 0.004 + rnd() * 0.012;
    wob[i * 4 + 1] = Math.cos(psi);
    wob[i * 4 + 2] = Math.sin(psi);
    wob[i * 4 + 3] = 1 + Math.floor(rnd() * 3);

    const sw = 0.006 + Math.pow(rnd(), 2) * 0.012; // world size
    const d0 = (sw / (2 * z * TANH)) * 2160; // in-focus diameter, 4K px
    const coc = COC_K * Math.abs(1 / z - 1 / ZF);
    const D = Math.sqrt(d0 * d0 + coc * coc);
    const b = 0.12 + 0.42 * Math.pow(rnd(), 3.0);
    level[i] = Math.min(LEVELS - 1, Math.floor((coc / D) * LEVELS * 0.999 + (D > 40 ? 1 : 0)));
    diam[i] = D;
    // lower alpha as discs grow so near motes don't over-brighten
    // lower alpha as discs grow so near motes don't over-brighten
    alpha[i] = b * Math.pow(Math.min(1, d0 / D), 1.4) * (D > 24 ? 0.45 : 1);
  }
  return { xn0, yn0, inv, level, diam, alpha, cs, wob };
})();

// A handful of large bright motes close to the camera, drifting across.
const MOTES = (() => {
  const rnd = mulberry32(1100478485);
  return Array.from({ length: 9 }, () => ({
    x0: rnd() * 3.6 - 1.8,
    y0: (rnd() * 2 - 1) * 0.85,
    z: 0.45 + rnd() * 0.6,
    reps: rnd() < 0.5 ? 1 : -1, // whole lap across the (wrapped) width per loop
    bob: 0.03 + rnd() * 0.05,
    ph: rnd() * TAU,
    b: 0.5 + rnd() * 0.5,
  }));
})();

// ---------------------------------------------------------------------------
const makeAtlas = () => {
  const c = document.createElement("canvas");
  c.width = CELL * LEVELS;
  c.height = CELL;
  const g = c.getContext("2d")!;
  for (let l = 0; l < LEVELS; l++) {
    const cx = l * CELL + CELL / 2;
    const cy = CELL / 2;
    const R = CELL * 0.4; // disc radius inside the cell (transparent margin)
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    if (l === 0) {
      // sharp speck: gaussian-ish dot
      gr.addColorStop(0, "rgba(255,255,255,1)");
      gr.addColorStop(0.35, "rgba(255,255,255,0.75)");
      gr.addColorStop(0.7, "rgba(255,255,255,0.18)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
    } else {
      // soft disc: flatter core and a softer edge for the most defocused levels
      const t = l / (LEVELS - 1);
      const edge = 0.55 + 0.33 * t; // where the falloff starts
      gr.addColorStop(0, `rgba(255,255,255,${0.8 + 0.1 * t})`);
      gr.addColorStop(edge * 0.85, `rgba(255,255,255,${0.85 + 0.1 * t})`);
      gr.addColorStop(edge, `rgba(255,255,255,${0.9})`);
      gr.addColorStop(Math.min(0.999, edge + (1 - edge) * 0.6), "rgba(255,255,255,0.25)");
      gr.addColorStop(1, "rgba(255,255,255,0)");
    }
    g.fillStyle = gr;
    g.beginPath();
    g.arc(cx, cy, R, 0, TAU);
    g.fill();
  }
  const base = Texture.from(c);
  base.source.scaleMode = "linear";
  return Array.from(
    { length: LEVELS },
    (_, l) => new Texture({ source: base.source, frame: new Rectangle(l * CELL, 0, CELL, CELL) }),
  );
};
// sprite size so that the disc (radius 0.4*CELL) spans D
const SCALE_PER_D = 1 / (CELL * 0.8);

const makeBeamTexture = () => {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const g = c.getContext("2d")!;
  const img = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 256; x++) {
      const u = (x - 127.5) / 128;
      const v = (y - 127.5) / 128;
      const a = Math.exp(-u * u * 4.5) * Math.exp(-Math.pow(Math.abs(v), 3) * 2.2);
      const i = (y * 256 + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = Math.round(a * 255);
    }
  g.putImageData(img, 0, 0);
  return Texture.from(c);
};

const MESH_VERT = /* glsl */ `#version 300 es
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

const SMOKE_FRAG = /* glsl */ `#version 300 es
in vec2 vUV;
out vec4 finalColor;
uniform float uC1; uniform float uS1; uniform float uC2; uniform float uS2;
uniform vec3 uSmoke; uniform float uAmount;

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g; g.x = a0.x * x0.x + h.x * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { s += a * snoise(p); p = p * 2.07 + vec2(17.1, 9.2); a *= 0.36; }
  return s;
}
void main() {
  vec2 uv = vUV; // 0..1 over the frame, y down
  vec2 p = vec2(uv.x * 1.7778, uv.y) * 0.26;
  vec2 t1 = vec2(uC1, uS1);
  vec2 t2 = vec2(uC2, uS2);
  // warp field, looping around a circle in time
  vec2 q = vec2(fbm(p * 2.0 + 0.35 * t1), fbm(p * 2.0 + vec2(5.2, 1.3) - 0.35 * t1.yx));
  vec2 r = vec2(fbm(p * 2.0 + 1.4 * q + vec2(1.7, 9.2) + 0.25 * t2), fbm(p * 2.0 + 1.4 * q + vec2(8.3, 2.8) - 0.25 * t2.yx));
  // main cloud: billowing out of the lower-left, edge broken up by the warp
  vec2 wp = uv + 0.16 * q + 0.06 * r;
  float d = length((wp - vec2(-0.02, 0.98)) * vec2(1.0, 1.25));
  float cloud = smoothstep(0.62, 0.05, d + 0.2 * fbm(p * 1.6 + 1.2 * r));
  float inner = 0.5 + 0.5 * smoothstep(-0.5, 0.6, fbm(p * 1.5 + 0.8 * r));
  // faint secondary haze elsewhere, with darker voids between
  float haze = smoothstep(0.0, 0.8, fbm(p * 1.1 + 0.7 * q - 0.2 * t2)) * 0.3;
  // a curling plume in the upper middle and a soft lit haze on the right edge
  vec2 sw = uv - vec2(0.5, 0.32) + 0.08 * r;
  float ang = atan(sw.y, sw.x * 1.4);
  float rad = length(sw * vec2(1.4, 1.0));
  float swirl = smoothstep(0.13, 0.0, abs(rad - 0.17 - 0.06 * sin(ang * 2.0 + 3.0 * q.x))) * smoothstep(0.34, 0.08, rad)
    * smoothstep(-0.3, 0.5, fbm(p * 2.2 + 1.5 * r + vec2(ang * 0.6, 0.0))) * 0.2;
  float right = smoothstep(0.7, 1.0, uv.x) * smoothstep(0.75, 0.25, abs(uv.y - 0.38) * 2.0) * 0.28 * (0.6 + 0.4 * fbm(p * 2.0 + q));
  haze += swirl + right;
  float smoke = cloud * inner + haze * (1.0 - cloud);
  float a = clamp(smoke * uAmount, 0.0, 1.0);
  finalColor = vec4(uSmoke * a, a);
}
`;

const FINAL_FRAG = /* glsl */ `#version 300 es
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec3 uBg; uniform vec3 uBgLight;
uniform float uVignette; uniform float uGrain; uniform float uFrame;
float hash3(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return float(v.x & 0xffffffu) / 16777216.0;
}
void main() {
  vec4 s = texture(uTexture, vTextureCoord);
  vec2 px = vTextureCoord * uInputSize.xy;
  vec2 uv = px / uOutputFrame.zw;
  // background in float: soft lighter area at top-left
  float l = exp(-dot((uv - vec2(0.18, 0.12)) * vec2(1.3, 1.0), (uv - vec2(0.18, 0.12)) * vec2(1.3, 1.0)) / 0.22);
  vec3 c = mix(uBg, uBgLight, l) + s.rgb;
  vec2 q = uv - 0.5; q.x *= 1.7778;
  c *= 1.0 - uVignette * smoothstep(0.3, 1.1, length(q));
  uvec2 p = uvec2(px);
  uint f = uint(uFrame);
  float g = hash3(uvec3(p, f)) - 0.5;
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  c += g * uGrain * (0.4 + 0.6 * sqrt(clamp(lum * 3.0, 0.0, 1.0)));
  float d = hash3(uvec3(p, f + 7919u)) + hash3(uvec3(p.yx, f + 104729u)) - 1.0;
  c += d / 255.0;
  finalColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

const bgr = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((v) => Math.round(v * 255));
  return (b << 16) | (g << 8) | r;
};

export const createDust =
  (v: DustVersion): PixiFactory =>
    (app: Application, W: number, H: number, dpr: number) => {
      const stage = app.stage;
      const tex = makeAtlas();
      const scene = new Container();
      stage.addChild(scene);

      // smoke (teal version): a full-frame mesh with a domain-warped fbm shader
      let smokeShader: Shader | null = null;
      let smokeMesh: Mesh<Geometry, Shader> | null = null;
      let smokeRT: RenderTexture | null = null;
      if (v.smoke > 0) {
        const geometry = new Geometry({
          attributes: {
            aPosition: [0, 0, W, 0, W, H, 0, H],
            aUV: [0, 0, 1, 0, 1, 1, 0, 1],
          },
          indexBuffer: [0, 1, 2, 0, 2, 3],
        });
        smokeShader = new Shader({
          glProgram: GlProgram.from({ vertex: MESH_VERT, fragment: SMOKE_FRAG, name: "dust-smoke", preferredFragmentPrecision: "highp" }),
          resources: {
            smokeUniforms: {
              uC1: { value: 1, type: "f32" },
              uS1: { value: 0, type: "f32" },
              uC2: { value: 1, type: "f32" },
              uS2: { value: 0, type: "f32" },
              uSmoke: { value: hexToRgb(v.smokeColor), type: "vec3<f32>" },
              uAmount: { value: 0.72 * v.smoke, type: "f32" },
            },
          },
        });
        // smoke is soft: draw it at 1/4 resolution into a render texture each frame
        smokeMesh = new Mesh({ geometry, shader: smokeShader });
        smokeMesh.scale.set(0.25);
        smokeRT = RenderTexture.create({ width: W / 4, height: H / 4, resolution: dpr });
        const smokeSprite = new Sprite(smokeRT);
        smokeSprite.scale.set(4);
        scene.addChild(smokeSprite);
      }

      // light beam: a large blurred gradient sprite
      let beam: Sprite | null = null;
      if (v.beam > 0) {
        beam = new Sprite(makeBeamTexture());
        beam.anchor.set(0.5);
        beam.width = W * 1.05;
        beam.height = H * 2.6;
        beam.rotation = -0.42;
        beam.position.set(W * 0.3, H * 0.35);
        beam.tint = v.speck;
        beam.alpha = 0.045 * v.beam;
        beam.blendMode = "add";
        scene.addChild(beam);
      }

      // specks
      const pc = new ParticleContainer({
        dynamicProperties: { position: true, color: true, vertex: false, rotation: false, uvs: false },
        texture: tex[0],
      });
      pc.blendMode = "add";
      const tint = bgr(v.speck);
      const parts: Particle[] = new Array(N_SPECKS);
      for (let i = 0; i < N_SPECKS; i++) {
        const sc = SPECK.diam[i] * SCALE_PER_D;
        parts[i] = new Particle({ texture: tex[SPECK.level[i]], anchorX: 0.5, anchorY: 0.5, scaleX: sc, scaleY: sc });
      }
      pc.addParticle(...parts.slice(0, 1));
      // addParticle with 200k spread args would overflow the stack; push directly
      for (let i = 1; i < N_SPECKS; i++) pc.particleChildren.push(parts[i]);
      pc.update();
      scene.addChild(pc);

      // near motes: ordinary sprites, biggest bokeh disc
      const motes = MOTES.map((m) => {
        const s = new Sprite(tex[LEVELS - 1]);
        s.anchor.set(0.5);
        s.blendMode = "add";
        s.tint = v.speck;
        const coc = COC_K * Math.abs(1 / m.z - 1 / ZF);
        const D = coc * 1.6;
        s.scale.set(D * SCALE_PER_D);
        scene.addChild(s);
        return { m, s, D };
      });

      // final pass: float background, vignette, grain, dither (not on pure black 2C)
      let finalFilter: Filter | null = null;
      if (v.grain > 0) {
        finalFilter = new Filter({
          glProgram: GlProgram.from({ vertex: defaultFilterVert, fragment: FINAL_FRAG, name: "dust-final", preferredFragmentPrecision: "highp" }),
          resources: {
            finalUniforms: {
              uBg: { value: hexToRgb(v.bg), type: "vec3<f32>" },
              uBgLight: { value: hexToRgb(v.bgLight), type: "vec3<f32>" },
              uVignette: { value: v.vignette, type: "f32" },
              uGrain: { value: v.grain, type: "f32" },
              uFrame: { value: 0, type: "f32" },
            },
          },
        });
        scene.filters = [finalFilter];
        scene.filterArea = new Rectangle(0, 0, W, H);
      }

      const nF = FLOW.length;
      return {
        update(frame: number) {
          const f = ((frame % DUST_LOOP) + DUST_LOOP) % DUST_LOOP;
          const th = (TAU * f) / DUST_LOOP;
          const C = FLOW.map((fl) => Math.cos(fl.n * th));
          const S = FLOW.map((fl) => Math.sin(fl.n * th));
          const Ch = [1, Math.cos(th), Math.cos(2 * th), Math.cos(3 * th)];
          const Sh = [0, Math.sin(th), Math.sin(2 * th), Math.sin(3 * th)];
          const { xn0, yn0, inv, alpha, cs, wob } = SPECK;
          const hw = W / 2;
          const hh = H / 2;
          const beamOn = v.beam;
          // beam axis in normalised coords (matches the sprite)
          const bnx = Math.cos(-0.42);
          const bny = Math.sin(-0.42);
          const gain = v.speckGain;
          for (let i = 0; i < N_SPECKS; i++) {
            let dx = 0;
            let dy = 0;
            for (let k = 0; k < nF; k++) {
              const fl = FLOW[k];
              const c = cs[(i * nF + k) * 2] * C[k] - cs[(i * nF + k) * 2 + 1] * S[k]; // cos(phase + n*theta)
              dx += fl.a * fl.ky * c;
              dy -= fl.a * fl.kx * c;
            }
            const h = wob[i * 4 + 3];
            const r = wob[i * 4];
            dx += r * (wob[i * 4 + 1] * Ch[h] - wob[i * 4 + 2] * Sh[h]);
            dy += r * (wob[i * 4 + 2] * Ch[h] + wob[i * 4 + 1] * Sh[h]);
            const xn = xn0[i] + (dx * inv[i]) / ASPECT;
            const yn = yn0[i] + dy * inv[i];
            const p = parts[i];
            const px = hw + xn * hw;
            const py = hh - yn * hh;
            p.x = px;
            p.y = py;
            let a = alpha[i] * gain;
            if (beamOn > 0) {
              // distance from the beam axis (screen space, 4K px)
              const ddx = px - W * 0.3;
              const ddy = py - H * 0.35;
              const across = (ddx * bnx + ddy * bny) / (W * 0.32);
              a *= 0.6 + 0.8 * beamOn * Math.exp(-across * across);
            }
            const a8 = a >= 1 ? 255 : (a * 255) | 0;
            p.color = tint + (a8 << 24);
          }
          for (const { m, s, D } of motes) {
            // wraps across [-1.8, 1.8] (offscreen), whole laps per loop
            let x = m.x0 + (m.reps * 3.6 * f) / DUST_LOOP;
            x = ((((x + 1.8) % 3.6) + 3.6) % 3.6) - 1.8;
            const y = m.y0 + m.bob * Math.sin(th + m.ph);
            s.position.set(hw + x * hw * (1 + D / W), hh - y * hh);
            s.alpha = 0.05 * m.b;
          }
          if (smokeShader) {
            const u = smokeShader.resources.smokeUniforms.uniforms;
            u.uC1 = Math.cos(th);
            u.uS1 = Math.sin(th);
            u.uC2 = Math.cos(2 * th + 1.0);
            u.uS2 = Math.sin(2 * th + 1.0);
            app.renderer.render({ container: smokeMesh!, target: smokeRT!, clear: true });
          }
          if (finalFilter) finalFilter.resources.finalUniforms.uniforms.uFrame = f;
        },
        destroy() {
          /* textures are destroyed with the app */
        },
      };
    };

export const DustSmoke: React.FC<{ version: DustVersion; durationOverride?: number }> = ({ version }) => {
  const create = useMemo(() => createDust(version), [version]);
  return <PixiLook create={create} />;
};

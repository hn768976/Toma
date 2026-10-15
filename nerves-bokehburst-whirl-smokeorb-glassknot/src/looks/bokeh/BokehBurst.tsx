import { Buffer, BufferUsage, Container, Geometry, Mesh, Renderer, Shader, Sprite } from "pixi.js";
import React, { useCallback } from "react";
import { hexToNumber, hexToRgb } from "../../lib/color";
import { FINISH, SHOULDER } from "../../lib/glsl";
import { grainFrame, loopPhase, TAU } from "../../lib/loop";
import { PixiLook, PixiLookFactory } from "../../lib/PixiLook";
import { makeHdrTarget, makeQuad, makeTexture } from "../../lib/pixiUtil";
import { irange, mulberry32, pick, range } from "../../lib/rng";

export type BokehVariant = {
  id: string;
  background: string;
  hazeA: string;
  hazeB: string;
  /** long fine fibres */
  streakColors: string[];
  /** short hot sparks */
  sparkColors: string[];
  discColors: string[];
};

// 3 000 streaks in total: long curved fibres (ribbon mesh) + short hot sparks (sprites)
const FIBRES = 1000;
const SPARKS = 2000; // ~300 bright hot sparks, the rest faint dust streaks
const SEG = 10; // segments per fibre ribbon
const DISCS = 60;
const DOTS = 24;

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// ---------- deterministic layout (seeded) ----------
type FibreSpec = { blur: number; ang: number; curl: number; wob: number; wobF: number; ph: number; cycles: number; off: number; len: number; thick: number; col: [number, number, number]; bright: number; r0: number };
type SparkSpec = { ang: number; cycles: number; off: number; len: number; thick: number; color: string; bright: number; r0: number };
type DiscSpec = { x: number; y: number; z: number; size: number; color: string; alpha: number };
type HazeSpec = { x: number; y: number; ax: number; ay: number; ph: number; size: number; color: string; alpha: number };

const buildLayout = (v: BokehVariant) => {
  const rng = mulberry32(0xb0ce4);
  const fibres: FibreSpec[] = [];
  for (let i = 0; i < FIBRES; i++) {
    const blurred = rng() < 0.3;
    fibres.push({
      blur: blurred ? 1 : 0,
      ang: rng() * TAU,
      curl: range(rng, -0.9, 0.9),
      wob: range(rng, 0.0, 0.09),
      wobF: range(rng, 4, 10),
      ph: rng() * TAU,
      // whole number of wraps per 600 frames -> exact loop
      cycles: irange(rng, 1, 3),
      off: rng(),
      len: range(rng, 0.25, 0.8),
      thick: blurred ? range(rng, 0.004, 0.007) : range(rng, 0.0011, 0.0018),
      col: hexToRgb(pick(rng, v.streakColors)),
      bright: blurred ? range(rng, 0.08, 0.18) : range(rng, 0.25, 0.75),
      r0: range(rng, 0.12, 0.26),
    });
  }
  const sparks: SparkSpec[] = [];
  for (let i = 0; i < SPARKS; i++) {
    const hot = i < 300;
    sparks.push({
      ang: rng() * TAU,
      cycles: irange(rng, 2, 5),
      off: rng(),
      len: range(rng, 0.02, 0.055),
      thick: range(rng, 0.0011, 0.0018),
      color: hot ? pick(rng, v.sparkColors) : pick(rng, v.streakColors),
      bright: hot ? range(rng, 0.8, 1.6) : range(rng, 0.04, 0.12),
      r0: range(rng, 0.15, 0.3),
    });
  }
  const discs: DiscSpec[] = [];
  for (let i = 0; i < DISCS; i++) {
    const u = range(rng, -1, 1);
    const a = rng() * TAU;
    const s = Math.sqrt(1 - u * u);
    const rr = range(rng, 0.82, 1.0);
    const crisp = rng() < 0.3;
    discs.push({ x: s * Math.cos(a) * rr, y: u * rr, z: s * Math.sin(a) * rr, size: range(rng, 0.045, 0.075), color: crisp ? "#D8F6FF" : pick(rng, v.discColors), alpha: crisp ? range(rng, 0.3, 0.5) : range(rng, 0.1, 0.22) });
  }
  const dots: DiscSpec[] = [];
  for (let i = 0; i < DOTS; i++) {
    const u = range(rng, -1, 1);
    const a = rng() * TAU;
    const s = Math.sqrt(1 - u * u);
    const rr = Math.pow(rng(), 0.5) * 0.9;
    dots.push({ x: s * Math.cos(a) * rr, y: u * rr, z: s * Math.sin(a) * rr, size: range(rng, 0.008, 0.016), color: pick(rng, v.discColors), alpha: range(rng, 0.5, 1) });
  }
  // large, very soft defocused blobs in the background (upper left, upper right, violet on the right, ...)
  const hazeDefs: [number, number, number, string, number][] = [
    [0.15, 0.25, 0.55, v.hazeA, 0.42],
    [0.82, 0.15, 0.5, v.hazeA, 0.38],
    [0.95, 0.55, 0.45, v.hazeB, 0.38],
    [0.3, 0.8, 0.5, v.hazeA, 0.25],
    [0.65, 0.85, 0.45, v.hazeB, 0.2],
    [0.05, 0.6, 0.4, v.hazeA, 0.25],
    [0.55, 0.05, 0.4, v.hazeA, 0.2],
    [0.97, 0.05, 0.45, v.hazeB, 0.3],
    [0.97, 0.95, 0.45, v.hazeB, 0.3],
    [0.02, 0.3, 0.35, v.hazeB, 0.25],
  ];
  const haze: HazeSpec[] = hazeDefs.map(([x, y, size, color, alpha]) => ({
    x,
    y,
    size,
    color,
    alpha,
    ax: range(rng, 0.02, 0.05),
    ay: range(rng, 0.015, 0.04),
    ph: rng(),
  }));
  return { fibres, sparks, discs, dots, haze };
};

// ---------- prebaked sprites ----------
const sparkTex = () =>
  makeTexture(128, 16, (u, v) => {
    const along = smooth(0, 0.5, u) * (1 - smooth(0.85, 1.0, u));
    const across = Math.exp(-Math.pow((v - 0.5) / 0.2, 2));
    return [1, 1, 1, along * across];
  });
const discTex = () =>
  makeTexture(128, 128, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const a = (1 - smooth(0.88, 1.0, d)) * (0.65 + 0.35 * smooth(0.6, 0.96, d));
    return [1, 1, 1, a];
  });
const glowTex = () =>
  makeTexture(128, 128, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    return [1, 1, 1, Math.exp(-d * d * 4.5) * (1 - smooth(0.9, 1.0, d))];
  });

const RIBBON_VERT = /* glsl */ `
in vec2 aPosition;
in vec2 aUV;
in vec4 aColor;
out vec2 vUV;
out vec4 vColor;
uniform mat3 uProjectionMatrix;
uniform mat3 uWorldTransformMatrix;
uniform mat3 uTransformMatrix;
void main() {
  mat3 mvp = uProjectionMatrix * uWorldTransformMatrix * uTransformMatrix;
  gl_Position = vec4((mvp * vec3(aPosition, 1.0)).xy, 0.0, 1.0);
  vUV = aUV;
  vColor = aColor;
}
`;
const RIBBON_FRAG = /* glsl */ `
in vec2 vUV;
in vec4 vColor;
out vec4 finalColor;
void main() {
  // vUV.x: 0 tail -> 1 head; vUV.y: -1..1 across
  float across = exp(-vUV.y * vUV.y * 3.0);
  float along = pow(vUV.x, 1.3) * (1.0 - smoothstep(0.96, 1.0, vUV.x));
  finalColor = vec4(vColor.rgb * vColor.a * across * along, 0.0);
}
`;

const BLUR_FRAG = /* glsl */ `
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uSrc;
uniform vec2 uDir;
void main() {
  vec3 c = texture(uSrc, vUV).rgb * 0.1964825501511404;
  vec2 o1 = uDir * 1.411764705882353;
  vec2 o2 = uDir * 3.2941176470588234;
  vec2 o3 = uDir * 5.176470588235294;
  c += (texture(uSrc, vUV + o1).rgb + texture(uSrc, vUV - o1).rgb) * 0.2969069646728344;
  c += (texture(uSrc, vUV + o2).rgb + texture(uSrc, vUV - o2).rgb) * 0.09447039785044732;
  c += (texture(uSrc, vUV + o3).rgb + texture(uSrc, vUV - o3).rgb) * 0.010381362401148057;
  finalColor = vec4(c, 1.0);
}
`;

const FINAL_FRAG = /* glsl */ `
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uFrame;
uniform float uAspect;
uniform float uBloomAmt;
uniform float uRadial;
${FINISH}
${SHOULDER}
void main() {
  vec2 d = vUV - 0.5;
  float r = length(d * vec2(uAspect, 1.0));
  float amt = uRadial * smoothstep(0.25, 0.95, r);
  vec3 c = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    c += texture(uScene, vUV - d * amt * float(i) / 11.0).rgb;
  }
  c /= 12.0;
  c += texture(uBloom, vUV).rgb * uBloomAmt;
  float vig = smoothstep(0.35, 1.0, length((vUV - vec2(0.5, 0.42)) * vec2(uAspect * 0.8, 1.0)));
  c *= 1.0 - 0.45 * vig;
  c = shoulder(c);
  finalColor = vec4(finish(c, gl_FragCoord.xy, uFrame, 0.015, 0.0), 1.0);
}
`;

const makeFactory =
  (v: BokehVariant): PixiLookFactory =>
  (renderer: Renderer, W: number, H: number) => {
    const L = buildLayout(v);
    const texSpark = sparkTex();
    const texDisc = discTex();
    const texGlow = glowTex();

    const stage = new Container();
    const hazeLayer = new Container();
    const streakLayer = new Container();
    const clusterLayer = new Container();
    stage.addChild(hazeLayer, streakLayer, clusterLayer);

    const hazeSprites = L.haze.map((h) => {
      const s = new Sprite(texGlow);
      s.anchor.set(0.5);
      s.blendMode = "add";
      s.tint = hexToNumber(h.color);
      s.alpha = h.alpha;
      s.width = s.height = h.size * H;
      hazeLayer.addChild(s);
      return s;
    });
    const core = new Sprite(texGlow);
    core.anchor.set(0.5);
    core.blendMode = "add";
    core.tint = hexToNumber(v.discColors[0]);
    core.alpha = 0.16;
    core.position.set(W / 2, H / 2);
    hazeLayer.addChild(core);

    // ---- fibre ribbons: one dynamic mesh, (SEG+1)*2 vertices per fibre ----
    const VPF = (SEG + 1) * 2;
    const pos = new Float32Array(FIBRES * VPF * 2);
    const col = new Float32Array(FIBRES * VPF * 4);
    const uv = new Float32Array(FIBRES * VPF * 2);
    const idx = new Uint32Array(FIBRES * SEG * 6);
    for (let f = 0; f < FIBRES; f++) {
      const c = L.fibres[f].col;
      for (let k = 0; k <= SEG; k++) {
        for (let side = 0; side < 2; side++) {
          const vi = f * VPF + k * 2 + side;
          uv[vi * 2] = k / SEG;
          uv[vi * 2 + 1] = side === 0 ? -1 : 1;
          col[vi * 4] = c[0];
          col[vi * 4 + 1] = c[1];
          col[vi * 4 + 2] = c[2];
        }
        if (k < SEG) {
          const b = f * VPF + k * 2;
          const ii = (f * SEG + k) * 6;
          idx.set([b, b + 1, b + 2, b + 1, b + 3, b + 2], ii);
        }
      }
    }
    const posBuf = new Buffer({ data: pos, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    const colBuf = new Buffer({ data: col, usage: BufferUsage.VERTEX | BufferUsage.COPY_DST });
    const ribbonGeo = new Geometry({
      attributes: {
        aPosition: { buffer: posBuf, format: "float32x2" },
        aUV: { buffer: uv, format: "float32x2" },
        aColor: { buffer: colBuf, format: "float32x4" },
      },
      indexBuffer: idx,
    });
    const ribbons = new Mesh({
      geometry: ribbonGeo as never,
      shader: Shader.from({ gl: { vertex: RIBBON_VERT, fragment: RIBBON_FRAG }, resources: {} }) as never,
    });
    ribbons.blendMode = "add";
    streakLayer.addChild(ribbons);

    const sparkSprites = L.sparks.map((st) => {
      const s = new Sprite(texSpark);
      s.anchor.set(1, 0.5);
      s.blendMode = "add";
      s.tint = hexToNumber(st.color);
      streakLayer.addChild(s);
      return s;
    });

    const discSprites = L.discs.map((d) => {
      const s = new Sprite(texDisc);
      s.anchor.set(0.5);
      s.blendMode = "add";
      s.tint = hexToNumber(d.color);
      clusterLayer.addChild(s);
      return s;
    });
    const dotSprites = L.dots.map((d) => {
      const s = new Sprite(texGlow);
      s.anchor.set(0.5);
      s.blendMode = "add";
      s.tint = hexToNumber(d.color);
      clusterLayer.addChild(s);
      return s;
    });

    // ---------- post ----------
    const rtScene = makeHdrTarget(W, H);
    const qW = Math.round(W / 4);
    const qH = Math.round(H / 4);
    const rtQ1 = makeHdrTarget(qW, qH);
    const rtQ2 = makeHdrTarget(qW, qH);
    const blurRadius = (H / 720) * 1.6;
    const down = makeQuad(qW, qH, BLUR_FRAG, { uSrc: rtScene.source, blurU: { uDir: { value: new Float32Array([1.5 / W, 1.5 / H]), type: "vec2<f32>" } } });
    const blurH = makeQuad(qW, qH, BLUR_FRAG, { uSrc: rtQ1.source, blurU: { uDir: { value: new Float32Array([blurRadius / qW, 0]), type: "vec2<f32>" } } });
    const blurV = makeQuad(qW, qH, BLUR_FRAG, { uSrc: rtQ2.source, blurU: { uDir: { value: new Float32Array([0, blurRadius / qH]), type: "vec2<f32>" } } });
    const final = makeQuad(W, H, FINAL_FRAG, {
      uScene: rtScene.source,
      uBloom: rtQ1.source,
      finalU: {
        uFrame: { value: 0, type: "f32" },
        uAspect: { value: W / H, type: "f32" },
        uBloomAmt: { value: 0.45, type: "f32" },
        uRadial: { value: 0.06, type: "f32" },
      },
    });
    const bg = hexToRgb(v.background);
    const rMax = (0.62 * Math.hypot(W, H)) / H;

    const render = (frame: number) => {
      const t = loopPhase(frame);
      const cx = W * 0.515;
      const cy = H * 0.52;

      L.haze.forEach((h, i) => {
        hazeSprites[i].position.set((h.x + h.ax * Math.sin(TAU * (t + h.ph))) * W, (h.y + h.ay * Math.cos(TAU * (t + h.ph * 1.7))) * H);
      });

      // fibres: radiate outward, lengthen as they go, fade at the edge, wrap
      for (let f = 0; f < FIBRES; f++) {
        const st = L.fibres[f];
        const u = (st.off + st.cycles * t) % 1;
        const head = st.r0 + (rMax - st.r0) * Math.pow(u, 1.5);
        const len = st.len * (0.3 + 0.9 * u);
        const tail = Math.max(st.r0 * 0.7, head - len);
        const fade = smooth(0.0, 0.15, u) * (1 - smooth(0.8, 1.0, u)) * st.bright;
        const halfW = st.thick * H * 1.6;
        let px = 0;
        let py = 0;
        for (let k = 0; k <= SEG; k++) {
          const r = tail + ((head - tail) * k) / SEG;
          const ang = st.ang + st.curl * (r - st.r0) + st.wob * Math.sin(st.wobF * r + st.ph);
          const x = cx + Math.cos(ang) * r * H;
          const y = cy + Math.sin(ang) * r * H;
          // ribbon normal from the local tangent
          const r2 = r + 0.002;
          const a2 = st.ang + st.curl * (r2 - st.r0) + st.wob * Math.sin(st.wobF * r2 + st.ph);
          let tx = cx + Math.cos(a2) * r2 * H - x;
          let ty = cy + Math.sin(a2) * r2 * H - y;
          const tl = Math.hypot(tx, ty) || 1;
          tx /= tl;
          ty /= tl;
          const w = halfW * (0.35 + 0.65 * (k / SEG));
          const vi = f * VPF + k * 2;
          pos[vi * 2] = x - ty * w;
          pos[vi * 2 + 1] = y + tx * w;
          pos[vi * 2 + 2] = x + ty * w;
          pos[vi * 2 + 3] = y - tx * w;
          col[vi * 4 + 3] = fade;
          col[vi * 4 + 7] = fade;
          px = x;
          py = y;
        }
        void px;
        void py;
      }
      posBuf.update();
      colBuf.update();

      L.sparks.forEach((st, i) => {
        const s = sparkSprites[i];
        const u = (st.off + st.cycles * t) % 1;
        const r = st.r0 + (rMax - st.r0) * Math.pow(u, 1.6);
        const fade = smooth(0.0, 0.12, u) * (1 - smooth(0.82, 1.0, u));
        s.position.set(cx + Math.cos(st.ang) * r * H, cy + Math.sin(st.ang) * r * H);
        s.rotation = st.ang;
        s.scale.set((st.len * H * (0.5 + u)) / 128, (st.thick * H * 3) / 16);
        s.alpha = st.bright * fade;
      });

      // bokeh cluster: a loose ball, turning one whole turn per loop and breathing twice
      const breathe = 1 + 0.05 * Math.sin(TAU * 2 * t);
      const R = 0.24 * H * breathe;
      const rot = TAU * t;
      const ca = Math.cos(rot);
      const sa = Math.sin(rot);
      const tilt = 0.35;
      const project = (d: DiscSpec, sprite: Sprite) => {
        const x = d.x * ca + d.z * sa;
        const z0 = -d.x * sa + d.z * ca;
        const y = d.y * Math.cos(tilt) - z0 * Math.sin(tilt);
        const z = d.y * Math.sin(tilt) + z0 * Math.cos(tilt);
        const persp = 3 / (3 - z);
        sprite.position.set(cx + x * R * persp, cy + y * R * 1.15 * persp);
        sprite.width = sprite.height = d.size * H * persp;
        sprite.alpha = d.alpha * (0.6 + 0.2 * (z + 1));
      };
      L.discs.forEach((d, i) => project(d, discSprites[i]));
      L.dots.forEach((d, i) => project(d, dotSprites[i]));
      core.width = core.height = 0.6 * H * breathe;

      renderer.render({ container: stage, target: rtScene, clear: true, clearColor: [bg[0], bg[1], bg[2], 1] });
      renderer.render({ container: down, target: rtQ1, clear: true });
      renderer.render({ container: blurH, target: rtQ2, clear: true });
      renderer.render({ container: blurV, target: rtQ1, clear: true });
      (final.shader!.resources.finalU as { uniforms: { uFrame: number } }).uniforms.uFrame = grainFrame(frame);
      renderer.render({ container: final, clear: true });
    };

    return {
      render,
      destroy: () => {
        stage.destroy({ children: true });
        [rtScene, rtQ1, rtQ2, texSpark, texDisc, texGlow].forEach((t) => t.destroy(true));
      },
    };
  };

export const BokehBurst: React.FC<{ variant: BokehVariant; loopCheck?: boolean }> = ({ variant }) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const create = useCallback(makeFactory(variant), [variant.id]);
  return <PixiLook create={create} background={variant.background} />;
};

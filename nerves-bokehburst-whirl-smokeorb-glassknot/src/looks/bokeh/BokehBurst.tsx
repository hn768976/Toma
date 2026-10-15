import { Container, Renderer, Sprite } from "pixi.js";
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
  streakColors: string[];
  discColors: string[];
};

const STREAKS = 3000;
const DISCS = 60;
const DOTS = 50;

// ---------- deterministic layout (module level, seeded) ----------
type StreakSpec = { ang: number; curl: number; cycles: number; off: number; len: number; thick: number; color: string; bright: number; r0: number };
type DiscSpec = { x: number; y: number; z: number; size: number; color: string; alpha: number };
type HazeSpec = { x: number; y: number; ax: number; ay: number; ph: number; size: number; color: "a" | "b"; alpha: number; cycles: number };

const buildLayout = (v: BokehVariant) => {
  const rng = mulberry32(0xb0ce4);
  const streaks: StreakSpec[] = [];
  for (let i = 0; i < STREAKS; i++) {
    const long = rng() < 0.55;
    streaks.push({
      ang: rng() * TAU,
      curl: range(rng, -0.25, 0.25),
      // whole number of wraps per 600 frames -> exact loop
      cycles: irange(rng, 2, 6),
      off: rng(),
      len: long ? range(rng, 0.18, 0.55) : range(rng, 0.03, 0.12),
      thick: long ? range(rng, 0.0014, 0.0026) : range(rng, 0.002, 0.0038),
      color: pick(rng, v.streakColors),
      bright: long ? range(rng, 0.12, 0.4) : range(rng, 0.3, 0.8),
      r0: range(rng, 0.14, 0.3),
    });
  }
  const discs: DiscSpec[] = [];
  for (let i = 0; i < DISCS; i++) {
    // loose ball: points in a sphere, denser toward its shell
    const u = range(rng, -1, 1);
    const a = rng() * TAU;
    const s = Math.sqrt(1 - u * u);
    const rr = range(rng, 0.7, 1.0);
    discs.push({
      x: s * Math.cos(a) * rr,
      y: u * rr,
      z: s * Math.sin(a) * rr,
      size: range(rng, 0.035, 0.085),
      color: pick(rng, v.discColors),
      alpha: range(rng, 0.1, 0.32),
    });
  }
  const dots: DiscSpec[] = [];
  for (let i = 0; i < DOTS; i++) {
    const u = range(rng, -1, 1);
    const a = rng() * TAU;
    const s = Math.sqrt(1 - u * u);
    const rr = Math.pow(rng(), 0.5) * 0.9;
    dots.push({ x: s * Math.cos(a) * rr, y: u * rr, z: s * Math.sin(a) * rr, size: range(rng, 0.008, 0.018), color: pick(rng, v.discColors), alpha: range(rng, 0.5, 1) });
  }
  const haze: HazeSpec[] = [];
  for (let i = 0; i < 5; i++) {
    haze.push({
      x: range(rng, 0.15, 0.85),
      y: range(rng, 0.2, 0.8),
      ax: range(rng, 0.03, 0.08),
      ay: range(rng, 0.02, 0.06),
      ph: rng(),
      size: range(rng, 0.7, 1.2),
      color: i % 2 === 0 ? "a" : "b",
      alpha: range(rng, 0.18, 0.35),
      cycles: 1,
    });
  }
  return { streaks, discs, dots, haze };
};

// ---------- prebaked sprites ----------
const streakTex = () =>
  makeTexture(256, 16, (u, v) => {
    const along = Math.pow(u, 1.6) * (1 - smooth(0.94, 1.0, u));
    const across = Math.exp(-Math.pow((v - 0.5) / 0.18, 2));
    return [1, 1, 1, along * across];
  });
const discTex = () =>
  makeTexture(128, 128, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    const a = (1 - smooth(0.86, 1.0, d)) * (0.5 + 0.5 * smooth(0.55, 0.96, d));
    return [1, 1, 1, a];
  });
const glowTex = () =>
  makeTexture(128, 128, (u, v) => {
    const d = Math.hypot(u - 0.5, v - 0.5) * 2;
    return [1, 1, 1, Math.exp(-d * d * 4.5) * (1 - smooth(0.9, 1.0, d))];
  });
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

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
  float amt = uRadial * smoothstep(0.2, 0.95, r);
  vec3 c = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    c += texture(uScene, vUV - d * amt * float(i) / 11.0).rgb;
  }
  c /= 12.0;
  c += texture(uBloom, vUV).rgb * uBloomAmt;
  c = shoulder(c);
  finalColor = vec4(finish(c, gl_FragCoord.xy, uFrame, 0.015, 0.0), 1.0);
}
`;

const makeFactory =
  (v: BokehVariant): PixiLookFactory =>
  (renderer: Renderer, W: number, H: number) => {
    const L = buildLayout(v);
    const texStreak = streakTex();
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
      s.tint = hexToNumber(h.color === "a" ? v.hazeA : v.hazeB);
      s.alpha = h.alpha;
      s.width = s.height = h.size * H;
      hazeLayer.addChild(s);
      return s;
    });
    // central glow behind the cluster
    const core = new Sprite(texGlow);
    core.anchor.set(0.5);
    core.blendMode = "add";
    core.tint = hexToNumber(v.hazeA);
    core.alpha = 0.22;
    core.width = core.height = 0.75 * H;
    core.position.set(W / 2, H / 2);
    hazeLayer.addChild(core);

    const streakSprites = L.streaks.map((st) => {
      const s = new Sprite(texStreak);
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

    // ---------- post: HDR scene -> quarter-res blur -> final (radial blur, bloom, grain, dither) ----------
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
        uBloomAmt: { value: 0.5, type: "f32" },
        uRadial: { value: 0.07, type: "f32" },
      },
    });
    const bg = hexToRgb(v.background);

    const render = (frame: number) => {
      const t = loopPhase(frame);
      const cx = W / 2;
      const cy = H / 2;

      L.haze.forEach((h, i) => {
        const s = hazeSprites[i];
        s.position.set(
          (h.x + h.ax * Math.sin(TAU * (h.cycles * t + h.ph))) * W,
          (h.y + h.ay * Math.cos(TAU * (h.cycles * t + h.ph * 1.7))) * H,
        );
      });

      // streaks: radiate outward, lengthen as they go, fade at the edge, wrap
      const rMax = 0.62 * Math.hypot(W, H) / H;
      L.streaks.forEach((st, i) => {
        const s = streakSprites[i];
        const u = (st.off + st.cycles * t) % 1;
        const r = st.r0 + (rMax - st.r0) * Math.pow(u, 1.7);
        const ang = st.ang + st.curl * u;
        const len = st.len * (0.25 + 1.4 * u);
        const fade = smooth(0.0, 0.12, u) * (1 - smooth(0.82, 1.0, u));
        s.position.set(cx + Math.cos(ang) * r * H, cy + Math.sin(ang) * r * H);
        s.rotation = ang + st.curl * 0.5;
        s.scale.set((len * H) / 256, (st.thick * H * 3.2) / 16);
        s.alpha = st.bright * fade;
      });

      // bokeh cluster: a loose ball, turning one whole turn per loop and breathing twice
      const breathe = 1 + 0.06 * Math.sin(TAU * 2 * t);
      const R = 0.2 * H * breathe;
      const rot = TAU * t;
      const ca = Math.cos(rot);
      const sa = Math.sin(rot);
      const tilt = 0.35;
      const project = (d: DiscSpec, sprite: Sprite, sizeMul: number) => {
        const x = d.x * ca + d.z * sa;
        const z0 = -d.x * sa + d.z * ca;
        const y = d.y * Math.cos(tilt) - z0 * Math.sin(tilt);
        const z = d.y * Math.sin(tilt) + z0 * Math.cos(tilt);
        const persp = 3 / (3 - z);
        sprite.position.set(cx + x * R * persp, cy + y * R * persp);
        const size = d.size * H * persp * sizeMul;
        sprite.width = sprite.height = size;
        sprite.alpha = d.alpha * (0.6 + 0.4 * (z + 1) * 0.5);
      };
      L.discs.forEach((d, i) => project(d, discSprites[i], 1));
      L.dots.forEach((d, i) => project(d, dotSprites[i], 1));
      core.width = core.height = 0.75 * H * breathe;

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
        [rtScene, rtQ1, rtQ2, texStreak, texDisc, texGlow].forEach((t) => t.destroy(true));
      },
    };
  };

export const BokehBurst: React.FC<{ variant: BokehVariant; loopCheck?: boolean }> = ({ variant }) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const create = useCallback(makeFactory(variant), [variant.id]);
  return <PixiLook create={create} background={variant.background} />;
};

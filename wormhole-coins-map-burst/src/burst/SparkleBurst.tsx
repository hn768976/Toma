// Look 4 — Sparkle Burst (PixiJS 8, WebGL2, 12s, on pure black).
// ~150k sparkles: a glowing ball that bursts toward the camera. Each sparkle
// has a fixed seeded straight path; 3D positions are projected in JS every
// frame (pure function of the frame), then one app.render() per frame.
import { defaultFilterVert, Application, Container, Filter, GlProgram, Particle, ParticleContainer, Rectangle, Sprite, UniformGroup } from "pixi.js";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, cancelRender, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, hexToRgb, smoothstep } from "../lib/math";
import { mulberry32 } from "../lib/random";
import type { BurstPalette } from "../versions";
import { BOKEH_LEVELS, BurstTextures, makeBurstTextures } from "./textures";

export const BURST_FRAMES = 360;
const BLACK_FROM = 330; // frames 330–359 are pure black
// Fixed angles of the soft light shafts at the burst (seeded).
const SHAFT_ANGLES = (() => {
  const r = mulberry32(0x5af7);
  return Array.from({ length: 11 }, (_, k) => (k / 11) * Math.PI * 2 + (r() - 0.5) * 0.4);
})();

const COUNT = 150000;
const LINES = 24000; // radial fine lines in the ball (part of COUNT)
const R0 = 5; // ball radius (world)
const ZC = 24; // ball centre distance from camera
const FOV = (55 * Math.PI) / 180;

// ---- Seeded per-particle data, built once at module level (all tabs equal).
const D = (() => {
  const rnd = mulberry32(0xb0b5);
  const px = new Float32Array(COUNT);
  const py = new Float32Array(COUNT);
  const pz = new Float32Array(COUNT);
  const dx = new Float32Array(COUNT);
  const dy = new Float32Array(COUNT);
  const dz = new Float32Array(COUNT);
  const speed = new Float32Array(COUNT);
  const size = new Float32Array(COUNT);
  const bright = new Float32Array(COUNT);
  const phase = new Float32Array(COUNT);
  const death = new Float32Array(COUNT);
  const white = new Uint8Array(COUNT);
  const kind = new Uint8Array(COUNT); // 0 sparkle, 1 radial line, 2 star
  const len = new Float32Array(COUNT);
  // ~260 bundle directions: most sparkles travel in rope-like tendrils.
  const BUNDLES = 140;
  const bdir: number[][] = [];
  for (let b = 0; b < BUNDLES; b++) {
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    bdir.push([s * Math.cos(th), s * Math.sin(th), u]);
  }
  for (let i = 0; i < COUNT; i++) {
    let ux: number, uy: number, uz: number;
    if (i >= LINES && rnd() < 0.6) { // ball lines stay uniform; sparkles cluster into tendrils
      const b = bdir[Math.floor(rnd() * BUNDLES)];
      const jx = b[0] + (rnd() - 0.5) * 0.16;
      const jy = b[1] + (rnd() - 0.5) * 0.16;
      const jz = b[2] + (rnd() - 0.5) * 0.16;
      const l = Math.hypot(jx, jy, jz) || 1;
      ux = jx / l;
      uy = jy / l;
      uz = jz / l;
    } else {
      const u = rnd() * 2 - 1;
      const th = rnd() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      ux = s * Math.cos(th);
      uy = s * Math.sin(th);
      uz = u;
    }
    const isLine = i < LINES;
    // Radius: dense volume + a brighter shell.
    const shell = rnd() < 0.45;
    const r = isLine ? R0 * (0.15 + 0.6 * rnd()) : shell ? R0 * (0.9 + (rnd() < 0.08 ? 0.25 : 0.1) * rnd()) : R0 * Math.cbrt(rnd());
    px[i] = ux * r;
    py[i] = uy * r;
    pz[i] = uz * r;
    // Flight direction: outward from the centre with a little scatter.
    const jx = ux + (rnd() - 0.5) * 0.1;
    const jy = uy + (rnd() - 0.5) * 0.1;
    const jz = uz + (rnd() - 0.5) * 0.1;
    const jl = Math.hypot(jx, jy, jz) || 1;
    dx[i] = jx / jl;
    dy[i] = jy / jl;
    dz[i] = jz / jl;
    speed[i] = 0.35 + Math.pow(rnd(), 2.2) * 1.6;
    size[i] = 0.025 + Math.pow(rnd(), 4) * 0.12;
    bright[i] = (shell ? 0.25 : 0.1) + Math.pow(rnd(), 4) * 0.9;
    phase[i] = rnd() * Math.PI * 2;
    death[i] = 245 + rnd() * 80;
    white[i] = rnd() < 0.15 ? 1 : 0;
    kind[i] = isLine ? 1 : rnd() < 0.04 ? 2 : 0;
    // Fine lines stay inside the ball.
    len[i] = isLine ? Math.max(0.05, Math.min(R0 * (0.25 + rnd() * 0.75), R0 * 0.97 - r)) : 0;
  }
  return { px, py, pz, dx, dy, dz, speed, size, bright, phase, death, white, kind, len };
})();

// Distance travelled along the path (world units) at frame f: an explosive
// start that eases into a slow drift. Pure function of the frame.
const travel = (f: number) => {
  if (f < 45) {
    // Breathing ball, then a brief pull-in before the burst.
    return -R0 * 0.06 * smoothstep(36, 45, f);
  }
  const t = f - 45;
  return R0 * (3.2 * (1 - Math.exp(-t / 24)) + 0.016 * t);
};
// Camera dolly toward the ball after the burst.
const dolly = (f: number) => 12 * smoothstep(45, 240, f) + 2.8 * smoothstep(45, 75, f);
const ballScale = (f: number) => (f < 45 ? 1 + 0.025 * Math.sin((f / 15) * Math.PI * 2) : 1);
const spin = (f: number) => f * 0.004;

const packBGR = (hex: string) => {
  const [r, g, b] = hexToRgb(hex).map((c) => Math.round(c * 255));
  return (b << 16) | (g << 8) | r;
};

// ±1/255 dither after everything, gated so pure black stays exactly 0.
const ditherFilter = () =>
  new Filter({
    glProgram: GlProgram.from({
      vertex: defaultFilterVert,
      fragment: /* glsl */ `
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uFrame;
// Float hash of pixel position and frame ("hash without sine", D. Hoskins).
float hash(vec2 p, float f) {
  vec3 p3 = fract(vec3(p.xy, f) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
void main() {
  vec4 c = texture(uTexture, vTextureCoord);
  float m = max(c.r, max(c.g, c.b));
  float d = (hash(gl_FragCoord.xy, uFrame) - 0.5) * (2.0 / 255.0);
  // Leave pure black untouched; only dither where there is signal.
  c.rgb = m < (0.5 / 255.0) ? vec3(0.0) : clamp(c.rgb + d, 0.0, 1.0);
  finalColor = vec4(c.rgb, 1.0);
}
`,
      name: "dither-filter",
      preferredFragmentPrecision: "highp",
    }),
    resources: { ditherUniforms: new UniformGroup({ uFrame: { value: 0, type: "f32" } }) },
  });

type PixiState = {
  app: Application;
  particles: Particle[];
  tex: BurstTextures;
  core: Sprite;
  flare: Sprite;
  leaks: Sprite[];
  shafts: Sprite[];
  filter: Filter;
  world: Container;
};

const renderFrame = (st: PixiState, frame: number, W: number, H: number, palette: BurstPalette) => {
  const { particles, tex } = st;
  const focal = H / 2 / Math.tan(FOV / 2);
  const cx = W / 2;
  const cy = H / 2;
  const black = frame >= BLACK_FROM;
  st.world.visible = !black;
  st.app.stage.filters = black ? [] : [st.filter];
  (st.filter.resources.ditherUniforms as { uniforms: { uFrame: number } }).uniforms.uFrame = frame;
  if (!black) {
    const tr = travel(frame);
    const trPrev = travel(frame - 1.5);
    const cz = dolly(frame);
    const czPrev = dolly(frame - 1.5);
    const bs = ballScale(frame);
    const a = spin(frame);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const globalFade = 1 - smoothstep(240, BLACK_FROM - 2, frame);
    const ballGlow = frame < 45 ? 1 : 1 - smoothstep(45, 70, frame);
    const scatterBright = 0.55 + 0.75 * smoothstep(44, 70, frame);
    const scale = H / 2160; // composition is designed at 2160p
    const halfDiag = Math.hypot(W, H) / 2;
    const minSize = 1.2 * scale;
    const sparkTint = packBGR(palette.sparkle);
    const whiteTint = packBGR(palette.white);
    for (let i = 0; i < COUNT; i++) {
      const p = particles[i];
      // Rotate the initial position (slow spin) and scale (breathing).
      const x0 = (D.px[i] * ca + D.pz[i] * sa) * bs;
      const z0 = (-D.px[i] * sa + D.pz[i] * ca) * bs;
      const y0 = D.py[i] * bs;
      const dxr = D.dx[i] * ca + D.dz[i] * sa;
      const dzr = -D.dx[i] * sa + D.dz[i] * ca;
      const sp = D.speed[i];
      const X = x0 + dxr * tr * sp;
      const Y = y0 + D.dy[i] * tr * sp;
      const Z = ZC + z0 + dzr * tr * sp - cz;
      let alpha = D.bright[i] * globalFade;
      // Per-sparkle thinning out: each one dies at its own seeded time.
      alpha *= 1 - smoothstep(D.death[i] - 30, D.death[i], frame);
      if (frame < 45) alpha *= (D.kind[i] === 1 ? 0.6 : D.kind[i] === 2 ? 1.2 : 0.3) * (0.6 + 0.4 * Math.sin(frame * 0.35 + D.phase[i]));
      else alpha *= scatterBright;
      if (Z < 0.25 || alpha <= 0.002) {
        p.color = 0;
        p.scaleX = 0;
        p.scaleY = 0;
        continue;
      }
      const sx = cx + (X / Z) * focal;
      const sy = cy + (Y / Z) * focal;
      const tint = D.white[i] ? whiteTint : sparkTint;
      if (D.kind[i] === 1) {
        // Radial fine line from inside the ball outward (only around the ball phase).
        const vis = ballGlow;
        if (vis <= 0.001) {
          p.color = 0;
          p.scaleX = 0;
          continue;
        }
        const ex = (x0 / Math.hypot(x0, y0, z0)) * D.len[i];
        const ey = (y0 / Math.hypot(x0, y0, z0)) * D.len[i];
        const lx = (ex / Z) * focal;
        const ly = (ey / Z) * focal;
        const L = Math.hypot(lx, ly);
        p.texture = tex.streak;
        p.x = sx + lx;
        p.y = sy + ly;
        p.rotation = Math.atan2(ly, lx);
        p.anchorX = 0.97;
        p.anchorY = 0.5;
        p.scaleX = L / 128;
        p.scaleY = (4 * scale) / 16;
        const al = Math.min(1, alpha * vis * (1.4 - D.len[i] / R0));
        p.color = (tint + (((al * 255) | 0) << 24)) >>> 0;
        continue;
      }
      let px = Math.max(minSize, (D.size[i] / Z) * focal * (D.kind[i] === 2 ? 2.2 : 1));
      // Screen-space velocity for motion streaks.
      const Xp = x0 + dxr * trPrev * sp;
      const Yp = y0 + D.dy[i] * trPrev * sp;
      const Zp = ZC + z0 + dzr * trPrev * sp - czPrev;
      const vx = Zp > 0.25 ? sx - (cx + (Xp / Zp) * focal) : 0;
      const vy = Zp > 0.25 ? sy - (cy + (Yp / Zp) * focal) : 0;
      const v = Math.hypot(vx, vy);
      p.x = sx;
      p.y = sy;
      if (px > 10 * scale) {
        // Near the lens: soft bokeh disc; texture chosen by size, alpha falls as it grows.
        const lvl = clamp(Math.floor(Math.log2(px / (10 * scale)) * 1.6), 0, BOKEH_LEVELS - 1);
        p.texture = tex.bokeh[lvl];
        p.rotation = 0;
        p.anchorX = 0.5;
        p.anchorY = 0.5;
        const d = px * 1.4;
        p.scaleX = d / 128;
        p.scaleY = d / 128;
        alpha *= clamp(Math.pow((10 * scale) / px, 1.1), 0.05, 1) * 1.6;
      } else if (v > px * 2.5 && frame >= 45) {
        // Fast: short motion streak oriented along the motion.
        p.texture = tex.streak;
        p.rotation = Math.atan2(vy, vx);
        p.anchorX = 0.97;
        p.anchorY = 0.5;
        p.scaleX = Math.min(v * 2.6, 1400 * scale) / 128;
        p.scaleY = (px * 2.2) / 16;
        alpha *= clamp((px * 6) / v, 0.6, 1);
      } else {
        p.texture = D.kind[i] === 2 ? tex.star : tex.spark;
        p.rotation = 0;
        p.anchorX = 0.5;
        p.anchorY = 0.5;
        px *= D.kind[i] === 2 ? 5 : 3.8; // halo around the core
        p.scaleX = px / 128;
        p.scaleY = px / 128;
      }
      if (frame >= 45) {
        // Dark hole at the centre of the burst and a soft vignette at the edges.
        const k = smoothstep(45, 56, frame);
        const dc = Math.hypot(sx - cx, sy - cy);
        alpha *= 1 - k * (1 - smoothstep(0.05 * H, 0.2 * H, dc));
        alpha *= 1 - k * 0.85 * smoothstep(0.45, 0.95, dc / halfDiag);
      }
      const al = Math.min(1, alpha);
      p.color = (tint + (((al * 255) | 0) << 24)) >>> 0;
    }
    // Core glow and the burst flash.
    const ballR = (R0 / ZC) * focal;
    const coreA = frame < 45 ? 1 : 1 - 0.8 * smoothstep(45, 58, frame) - 0.2 * smoothstep(150, 280, frame);
    st.core.alpha = coreA;
    st.core.width = st.core.height = ballR * 4 * (frame < 45 ? 1 + 0.04 * Math.sin((frame / 15) * Math.PI * 2) : 1 + 2.6 * smoothstep(45, 75, frame));
    const flash = smoothstep(42, 48, frame) * (1 - smoothstep(48, 60, frame));
    st.flare.alpha = frame < 45 ? 0.85 : Math.max(flash * 0.9, 0.6 * (1 - smoothstep(45, 60, frame)));
    st.flare.width = st.flare.height = frame < 45 ? ballR * 0.45 : ballR * (0.4 + 2.4 * smoothstep(42, 50, frame));
    // Broad soft light shafts fanning out at the burst.
    st.shafts.forEach((sh, k) => {
      const env = smoothstep(46, 58, frame) * (1 - smoothstep(85 + (k % 4) * 8, 130 + (k % 4) * 8, frame));
      sh.alpha = env * (0.7 + 0.25 * ((k * 7) % 3));
      sh.x = cx;
      sh.y = cy;
      sh.rotation = SHAFT_ANGLES[k] + (frame - 45) * 0.0008;
      sh.width = W * (0.55 + 0.1 * ((k * 5) % 3)) * (0.7 + 0.3 * smoothstep(45, 80, frame));
      sh.height = H * 0.45;
    });
    st.leaks.forEach((l, k) => {
      const env = smoothstep(46 + k * 3, 60 + k * 3, frame) * (1 - smoothstep(80 + k * 6, 125 + k * 6, frame));
      l.alpha = env * 0.3;
      const drift = (frame - 45) * 0.8 * scale;
      const side = k % 2 === 0 ? -1 : 1;
      l.x = cx + side * (W * (0.3 + 0.06 * k) + drift);
      l.y = cy + (k < 2 ? -1 : 1) * H * 0.12;
      l.width = W * 0.42;
      l.height = H * 0.9;
      l.rotation = side * (0.35 + 0.1 * k);
    });
  }
  st.app.render();
};

export const SparkleBurst: React.FC<{ palette: BurstPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stRef = useRef<PixiState | null>(null);
  const [ready, setReady] = useState(false);
  const [initHandle] = useState(() => delayRender("PixiJS init + textures", { timeoutInMilliseconds: 120000 }));

  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    const dpr = window.devicePixelRatio || 1;
    app
      .init({
        canvas: canvasRef.current!,
        width,
        height,
        resolution: dpr,
        autoDensity: true,
        preference: "webgl",
        autoStart: false,
        sharedTicker: false,
        preserveDrawingBuffer: true,
        antialias: false,
        background: 0x000000,
        backgroundAlpha: 1,
      })
      .then(() => {
        if (cancelled) return;
        app.ticker.stop();
        app.stop();
        const tex = makeBurstTextures(palette.leaks);
        const world = new Container();
        const leaksLayer = new Container();
        const leaks = tex.leaks.map((t) => {
          const s = new Sprite(t);
          s.anchor.set(0.5);
          s.blendMode = "add";
          s.alpha = 0;
          leaksLayer.addChild(s);
          return s;
        });
        const core = new Sprite(tex.glow);
        core.anchor.set(0.5);
        core.position.set(width / 2, height / 2);
        core.tint = palette.glow;
        core.blendMode = "add";
        const flare = new Sprite(tex.glow);
        flare.anchor.set(0.5);
        flare.position.set(width / 2, height / 2);
        flare.tint = palette.white;
        flare.blendMode = "add";
        const pc = new ParticleContainer({
          dynamicProperties: { position: true, vertex: true, rotation: true, uvs: true, color: true },
          texture: tex.spark,
        });
        pc.blendMode = "add";
        const particles: Particle[] = new Array(COUNT);
        for (let i = 0; i < COUNT; i++) {
          particles[i] = new Particle({ texture: tex.spark, anchorX: 0.5, anchorY: 0.5 });
        }
        pc.addParticle(...particles.slice(0, 1));
        for (let i = 1; i < COUNT; i++) pc.particleChildren.push(particles[i]);
        pc.update();
        const shafts = SHAFT_ANGLES.map((_, k) => {
          const s = new Sprite(tex.shaft);
          s.anchor.set(0, 0.5);
          s.blendMode = "add";
          s.alpha = 0;
          s.tint = k % 2 === 0 ? palette.white : k % 4 === 1 ? palette.leaks[1] : palette.leaks[3];
          return s;
        });
        world.addChild(leaksLayer, core, ...shafts, pc, flare);
        app.stage.addChild(world);
        app.stage.filterArea = new Rectangle(0, 0, width, height);
        const filter = ditherFilter();
        stRef.current = { app, particles, tex, core, flare, leaks, shafts, filter, world };
        setReady(true);
      })
      .catch((e) => cancelRender(e));
    return () => {
      cancelled = true;
      stRef.current = null;
      try {
        app.destroy(false, { children: true, texture: true });
      } catch {
        // app may not have finished init
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One app.render() per Remotion frame.
  useLayoutEffect(() => {
    if (!ready || !stRef.current) return;
    try {
      renderFrame(stRef.current, frame, width, height, palette);
    } catch (e) {
      cancelRender(e);
    }
  }, [frame, ready, width, height, palette]);

  useEffect(() => {
    if (ready) continueRender(initHandle);
  }, [ready, initHandle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <canvas ref={canvasRef} style={{ width, height }} />
    </AbsoluteFill>
  );
};

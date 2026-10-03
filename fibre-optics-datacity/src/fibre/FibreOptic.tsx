// Look 1 — Fibre Optic Macro (PixiJS 8, WebGL2).
//
// Fibres are 3D quadratic curves fanning out of a bundle below frame. Every
// frame, tips and strand segments are projected from 3D in JS; each tip is a
// bokeh disc whose size and texture level come from its distance to a shallow
// focus plane. All motion (sway, twinkle, focus breathing, hue drift) is a
// function of the frame with whole-number cycles over 600 frames.
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  getRemotionEnvironment,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  Application,
  Container,
  Particle,
  ParticleContainer,
  Rectangle,
  RenderTexture,
  Sprite,
  Texture,
} from "pixi.js";
import { FIBRE_OPTIC_PALETTES } from "../palettes";
import { hexToRgb, TAU } from "../lib/random";
import { BASE, FIBRE_COUNT, FIBRES, LOOP_FRAMES } from "./data";
import {
  BOKEH_LEVELS,
  BOKEH_R,
  makeBokehAtlas,
  makeStreakTexture,
  STREAK_H,
  STREAK_W,
} from "./textures";
import { FibrePostFilter } from "./postFilter";

// Composition space (stage units) — always 4K; the renderer resolution maps
// it onto the actual output size.
const W = 3840;
const H = 2160;

// Camera
const CAM = { x: 0.0, y: 0.12, z: 5.2 };
const FOV = (26 * Math.PI) / 180;
const FOCAL = H / 2 / Math.tan(FOV / 2);

// Bokeh
const COC_K = 160;
// Tilted focal plane: the lower in frame, the nearer the lens (macro shot
// looking along the bundle), so blur grows towards the bottom.
const TILT = 120; // extra CoC px at 4K at the bottom of frame // px at 4K per unit of |zc - zf| / zc
const R_MIN = 7; // smallest tip radius (near-sharp), px at 4K
const R_MAX = 150;
const LEVEL_BASE = 8;
const LEVEL_STEP = Math.log(1.5);

// Intensities are scaled by GAIN in the sprites and 1/GAIN in the post
// pass, leaving headroom so sharp tips can be HOT x brighter than the
// (individually capped) defocused discs.
const GAIN = 0.1;
const HOT = 18;
const LEAN = 0.3;

const SEGMENTS: [number, number, number][] = [
  // [s0, s1, brightness]
  [0.0, 0.42, 0.55],
  [0.42, 0.76, 0.8],
  [0.76, 0.97, 1.0],
];

type Pixi = {
  app: Application;
  scene: Container;
  rt: RenderTexture;
  post: Container;
  filter: FibrePostFilter;
  tips: Particle[];
  streaks: Particle[];
  levels: Texture[];
};

// Encode an intensity 0..1 with ~16-bit precision across tint (8 bit) and
// alpha (8 bit): alpha carries the coarse step, tint the remainder.
const setColor = (
  p: Particle,
  r: number,
  g: number,
  b: number,
  intensity: number,
) => {
  const I = Math.min(1, Math.max(0, intensity));
  const aq = Math.max(1, Math.ceil(I * 255)) / 255;
  const k = I / aq; // <= 1
  const R = Math.round(Math.min(1, r * k) * 255);
  const G = Math.round(Math.min(1, g * k) * 255);
  const B = Math.round(Math.min(1, b * k) * 255);
  // Particle.color is ABGR packed (alpha in the top byte)
  p.color = ((B << 16) | (G << 8) | R) + ((Math.round(aq * 255) & 255) << 24);
};

const lin = (c: [number, number, number]): [number, number, number] => [
  Math.pow(c[0], 1.8),
  Math.pow(c[1], 1.8),
  Math.pow(c[2], 1.8),
];

const mixHex = (cols: [number, number, number][], u: number) => {
  const n = cols.length;
  const x = (((u % 1) + 1) % 1) * n;
  const i = Math.floor(x);
  const f = x - i;
  const s = f * f * (3 - 2 * f);
  const a = cols[i % n];
  const b = cols[(i + 1) % n];
  return [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s, a[2] + (b[2] - a[2]) * s];
};

const updateScene = (
  px: Pixi,
  frame: number,
  paletteId: string,
  resolution: number,
  wrap: boolean,
) => {
  const pal = FIBRE_OPTIC_PALETTES[paletteId];
  // Palette colours are display-space hex; the scene is lit in linear light
  // and the per-channel tone curve in the post filter brings the hottest
  // overlaps back up to the palette colour and on to white.
  const tipC = lin(hexToRgb(pal.tip));
  const strandC = lin(hexToRgb(pal.strand));
  const cyc = pal.cycle.map((c) => lin(hexToRgb(c)));
  const multi = pal.mode === "multi";
  // Loop phase in [0, 1). Every periodic term below has a whole number of
  // cycles per loop; reducing the phase modulo the loop in float64 means
  // frame 600 receives bit-identical inputs to frame 0. (noWrap is a
  // diagnostic that skips the reduction to test the cycles themselves.)
  const t = wrap ? (frame % LOOP_FRAMES) / LOOP_FRAMES : frame / LOOP_FRAMES;
  const ph = t * TAU;

  // whole-bundle sway (rotation about the bundle base) and focus breathing
  // constant lean to the right (bundle enters lower-left) + slow sway
  const rz = LEAN + 0.024 * Math.sin(ph) + 0.007 * Math.sin(3 * ph + 1.3);
  const rx = 0.018 * Math.sin(2 * ph + 0.4);
  const crz = Math.cos(rz);
  const srz = Math.sin(rz);
  const crx = Math.cos(rx);
  const srx = Math.sin(rx);
  const zFocus = 6.35 + 0.32 * Math.sin(ph + 0.6) + 0.08 * Math.sin(2 * ph + 2.1);

  const proj = { x: 0, y: 0, zc: 1 };
  const project = (x: number, y: number, z: number) => {
    // rotate about BASE: z-axis then x-axis
    const lx = x - BASE.x;
    const ly = y - BASE.y;
    const lz = z - BASE.z;
    const x1 = lx * crz - ly * srz;
    const y1 = lx * srz + ly * crz;
    const y2 = y1 * crx - lz * srx;
    const z2 = y1 * srx + lz * crx;
    const wx = x1 + BASE.x - CAM.x;
    const wy = y2 + BASE.y - CAM.y;
    const zc = CAM.z - (z2 + BASE.z);
    proj.x = W / 2 + (FOCAL * wx) / zc;
    proj.y = H / 2 - (FOCAL * wy) / zc;
    proj.zc = zc;
  };
  const coc = (zc: number, sy: number) => {
    const k = Math.min(1, Math.max(0, (sy - 0.1 * H) / (0.85 * H)));
    return Math.min(R_MAX, R_MIN + (COC_K * Math.abs(zc - zFocus)) / zc + TILT * k * k * (3 - 2 * k));
  };

  // a floor for strand width so they stay >= ~1.3 output px at any scale
  const minStreak = Math.max(5, 2.6 / resolution);
  const F = FIBRES;

  for (let i = 0; i < FIBRE_COUNT; i++) {
    const p0x = BASE.x + F.bx[i];
    const p0y = BASE.y;
    const p0z = BASE.z + F.bz[i];
    const L = F.len[i];
    // individual sway of the free end
    const sw = Math.sin(F.swCycles[i] * ph + F.swPhase[i]);
    const sw2 = Math.cos(F.swCycles[i] * ph + F.swPhase[i] * 1.7);
    const p2x = p0x + F.dx[i] * L + 0.016 * sw;
    const p2y = p0y + F.dy[i] * L;
    const p2z = p0z + F.dz[i] * L + 0.012 * sw2;
    const p1x = p0x + 0.04 * F.dx[i] + 0.006 * sw;
    const p1y = p0y + F.stiff[i] * L * 0.78;
    const p1z = p0z + 0.04 * F.dz[i];

    const twinkle =
      1 +
      F.twAmp[i] *
        (0.6 * Math.sin(F.twCycles[i] * ph + F.twPhase[i]) +
          0.4 * Math.sin((F.twCycles[i] + 2) * ph + F.twPhase[i] * 2.3));

    // colour
    let cr: number;
    let cg: number;
    let cb: number;
    if (multi) {
      const u = F.hue[i] * pal.hueSpread + (p2x - BASE.x) * 0.1 + t * 1;
      const c = mixHex(cyc as [number, number, number][], u);
      cr = c[0];
      cg = c[1];
      cb = c[2];
    } else {
      cr = tipC[0];
      cg = tipC[1];
      cb = tipC[2];
    }

    // --- tip
    project(p2x, p2y, p2z);
    const r = coc(proj.zc, proj.y);
    const level = Math.min(
      BOKEH_LEVELS - 1,
      Math.max(0, Math.floor(Math.log(r / LEVEL_BASE) / LEVEL_STEP)),
    );
    const tip = px.tips[i];
    tip.texture = px.levels[level];
    tip.x = proj.x;
    tip.y = proj.y;
    const sc = r / BOKEH_R;
    tip.scaleX = sc;
    tip.scaleY = sc;
    const sharp = 1 - level / (BOKEH_LEVELS - 1);
    const whiten = 0.7 * Math.pow(sharp, 3) * Math.min(1, twinkle);
    const energy = Math.pow(R_MIN / r, 1.05);
    // in-focus tips get up to HOT x the energy of the defocused field
    const hot = 1 + (HOT - 1) * Math.pow(sharp, 4) * F.bright[i];
    const I = GAIN * F.bright[i] * twinkle * (0.12 + 0.88 * energy) * 1.15 * hot;
    setColor(
      tip,
      cr + (1 - cr) * whiten,
      cg + (1 - cg) * whiten,
      cb + (1 - cb) * whiten,
      I,
    );

    // --- strand segments (straight soft streaks along the curve)
    const sr = multi ? strandC[0] * 0.2 + cr * 0.8 : strandC[0];
    const sg = multi ? strandC[1] * 0.2 + cg * 0.8 : strandC[1];
    const sb = multi ? strandC[2] * 0.2 + cb * 0.8 : strandC[2];
    for (let s = 0; s < SEGMENTS.length; s++) {
      const [s0, s1, sBright] = SEGMENTS[s];
      const bez = (u: number) => {
        const a = (1 - u) * (1 - u);
        const b = 2 * (1 - u) * u;
        const c = u * u;
        project(
          a * p0x + b * p1x + c * p2x,
          a * p0y + b * p1y + c * p2y,
          a * p0z + b * p1z + c * p2z,
        );
      };
      bez(s0);
      const ax = proj.x;
      const ay = proj.y;
      bez(s1);
      const bx = proj.x;
      const by = proj.y;
      bez((s0 + s1) / 2);
      const wdt = Math.max(minStreak, coc(proj.zc, proj.y) * 0.55);
      const dxs = bx - ax;
      const dys = by - ay;
      const len = Math.hypot(dxs, dys) + 1e-3;
      const st = px.streaks[i * SEGMENTS.length + s];
      st.x = (ax + bx) / 2;
      st.y = (ay + by) / 2;
      st.rotation = Math.atan2(dys, dxs) - Math.PI / 2;
      st.scaleX = (wdt * 2.2) / STREAK_W;
      st.scaleY = (len * 1.18) / STREAK_H;
      const si = GAIN * 2.0 * pal.strandGain * (0.08 + F.bright[i] * F.bright[i] * 1.6) * sBright * (minStreak / wdt) * 0.75 * (0.75 + 0.25 * twinkle);
      setColor(st, sr, sg, sb, si);
    }
  }

  // grain/dither pattern also repeats with the loop
  px.filter.uniformsGroup.uniforms.uFrame = frame % LOOP_FRAMES;
};

export const FibreOptic: React.FC<{
  palette: string;
  loopCheck?: boolean;
  noWrap?: boolean;
}> = ({ palette, noWrap }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const hostRef = useRef<HTMLDivElement>(null);
  const pixiRef = useRef<Pixi | null>(null);
  const [ready, setReady] = useState(false);
  const [initHandle] = useState(() => delayRender("Initialising PixiJS"));

  // Output pixels per composition pixel. During render this is the --scale
  // (Remotion sets it as devicePixelRatio). In the Studio preview cap it.
  const resolution = getRemotionEnvironment().isRendering
    ? window.devicePixelRatio
    : Math.min(window.devicePixelRatio, 0.5);

  useEffect(() => {
    let cancelled = false;
    const app = new Application();
    (async () => {
      await app.init({
        width: W,
        height: H,
        resolution,
        autoDensity: false,
        preference: "webgl",
        antialias: false,
        background: 0x000000,
        backgroundAlpha: 1,
        preserveDrawingBuffer: true,
        autoStart: false,
        sharedTicker: false,
        powerPreference: "high-performance",
      });
      if (cancelled) {
        app.destroy(true);
        return;
      }
      app.ticker.stop();
      const canvas = app.canvas as HTMLCanvasElement;
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.style.display = "block";
      hostRef.current?.appendChild(canvas);

      const { levels } = makeBokehAtlas();
      const streakTex = makeStreakTexture();
      const scene = new Container();
      const streakLayer = new ParticleContainer({
        texture: streakTex,
        dynamicProperties: {
          position: true,
          rotation: true,
          vertex: true,
          color: true,
          uvs: false,
        },
      });
      streakLayer.blendMode = "add";
      const tipLayer = new ParticleContainer({
        texture: levels[0],
        dynamicProperties: {
          position: true,
          rotation: false,
          vertex: true,
          color: true,
          uvs: true,
        },
      });
      tipLayer.blendMode = "add";
      const tips: Particle[] = [];
      const streaks: Particle[] = [];
      for (let i = 0; i < FIBRE_COUNT; i++) {
        for (let s = 0; s < SEGMENTS.length; s++) {
          const st = new Particle({ texture: streakTex, anchorX: 0.5, anchorY: 0.5 });
          streaks.push(st);
          streakLayer.addParticle(st);
        }
        const tp = new Particle({ texture: levels[0], anchorX: 0.5, anchorY: 0.5 });
        tips.push(tp);
        tipLayer.addParticle(tp);
      }
      streakLayer.boundsArea = new Rectangle(0, 0, W, H);
      tipLayer.boundsArea = new Rectangle(0, 0, W, H);
      scene.addChild(streakLayer, tipLayer);

      const rt = RenderTexture.create({
        width: W,
        height: H,
        resolution,
        format: "rgba16float",
        scaleMode: "linear",
      });
      const filter = new FibrePostFilter();
      filter.source = rt;
      const pal = FIBRE_OPTIC_PALETTES[palette];
      const u = filter.uniformsGroup.uniforms;
      (u.uBgTop as Float32Array).set(hexToRgb(pal.bgTop));
      (u.uBgBottom as Float32Array).set(hexToRgb(pal.bgBottom));
      const g = lin(hexToRgb(pal.glow));
      (u.uGlow as Float32Array).set([g[0] * 0.08, g[1] * 0.08, g[2] * 0.08]);
      u.uExposure = pal.exposure / GAIN;
      u.uGrain = 0.02;
      const post = new Container();
      const host = new Sprite(rt);
      host.width = W;
      host.height = H;
      post.addChild(host);
      post.filterArea = new Rectangle(0, 0, W, H);
      post.filters = [filter];

      pixiRef.current = { app, scene, rt, post, filter, tips, streaks, levels };
      setReady(true);
    })();
    return () => {
      cancelled = true;
      const px = pixiRef.current;
      pixiRef.current = null;
      if (px) px.app.destroy(true, { children: true, texture: true });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One app.render() per Remotion frame, synchronously, before paint.
  useLayoutEffect(() => {
    const px = pixiRef.current;
    if (!ready || !px) return;
    updateScene(px, frame, palette, resolution, !noWrap);
    px.app.renderer.render({
      container: px.scene,
      target: px.rt,
      clear: true,
      clearColor: [0, 0, 0, 0],
    });
    px.app.renderer.render({ container: px.post });
    continueRender(initHandle);
  }, [frame, ready, palette, resolution, initHandle, noWrap]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <div ref={hostRef} style={{ width, height }} />
    </AbsoluteFill>
  );
};

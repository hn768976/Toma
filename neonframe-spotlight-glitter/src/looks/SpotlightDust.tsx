import React, { useEffect, useRef, useState } from "react";
import {
  Application,
  Container,
  Filter,
  GlProgram,
  Particle,
  ParticleContainer,
  Rectangle,
  Sprite,
  Texture,
  UniformGroup,
} from "pixi.js";
import { useCurrentFrame, useDelayRender, useVideoConfig } from "remotion";
import {
  GLSL_GRAIN,
  loopFrame,
  LOOP_FRAMES,
  mulberry32,
  useBackingScale,
} from "../common";
import type { SpotlightColorway } from "../colorways";

/* ------------------------------------------------------------------ *
 * Layout. Everything is authored in "frame units" on the 3840x2160
 * canvas and scaled by Pixi's resolution (so --scale=1/3 renders at
 * 1280x720 with no extra work).
 * ------------------------------------------------------------------ */
const W = 3840;
const H = 2160;
const PARTICLES = 25000;
const TAU = Math.PI * 2;

type Beam = {
  x: number; // origin x, fraction of W
  y: number; // origin y, fraction of H (just above the top edge)
  deg: number; // + = leans towards -x as it falls (screen-space clockwise)
  topHalf: number; // half width at the origin (px)
  bottomHalf: number; // half width at length L (px)
  gain: number; // brightness
  breathe: number; // whole cycles per loop
  phase: number;
  weight: number; // share of the particles
};
// Three beams: wide centre one + two narrower side ones, fanning from the top centre.
const BEAMS: Beam[] = [
  { x: 0.5, y: -0.03, deg: 0, topHalf: 150, bottomHalf: 780, gain: 1.15, breathe: 2, phase: 0.1, weight: 0.4 },
  { x: 0.415, y: -0.03, deg: 14, topHalf: 120, bottomHalf: 520, gain: 0.85, breathe: 3, phase: 0.45, weight: 0.22 },
  { x: 0.615, y: -0.03, deg: -14, topHalf: 120, bottomHalf: 520, gain: 0.75, breathe: 3, phase: 0.8, weight: 0.18 },
  // two faint, wide companion shafts: the reference reads as more than three overlapping rays
  { x: 0.455, y: -0.03, deg: 5, topHalf: 160, bottomHalf: 600, gain: 0.32, breathe: 1, phase: 0.6, weight: 0.1 },
  { x: 0.565, y: -0.03, deg: -24, topHalf: 160, bottomHalf: 560, gain: 0.28, breathe: 2, phase: 0.25, weight: 0.1 },
];
const BEAM_LEN = 2500;
const STRAY = 0.22; // fraction of dust outside the beams

/* ---------------- colour helpers ---------------- */
const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix3 = (a: number[], b: number[], t: number) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const pack = (c: number[]) =>
  (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/* ---------------- procedural textures (seeded, module level) ---------------- */
const texRng = mulberry32(0x5eed0001);
const noiseByte = () => (texRng() + texRng() - 1) * 0.9; // ~ +-0.9 LSB triangular dither

const canvasOf = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

/** A single beam wedge, opaque greyscale-colour (for additive blending). */
const makeBeamTexture = (top: number[], body: number[]) => {
  const w = 256;
  const h = 1024;
  const c = canvasOf(w, h);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const s = y / (h - 1);
    // width of the wedge relative to the full texture width (starts narrow)
    const half = 0.12 + 0.88 * s;
    const fade = (0.26 * Math.exp(-s * 2.2) + 0.27 * Math.exp(-s * 0.6)) * (1 - smooth(0.88, 1, s));
    const topGlow = Math.exp(-s * 14); // very bright, whiter near the apex
    const col = mix3(body, top, Math.min(1, topGlow * 1.2 + Math.exp(-s * 4) * 0.35));
    for (let x = 0; x < w; x++) {
      const u = ((x + 0.5) / w) * 2 - 1;
      const r = Math.abs(u) / half;
      let prof = 0;
      if (r < 1) {
        const t = 1 - r * r;
        prof = Math.pow(t, 1.1); // very soft edges
      }
      const i = (prof * (fade * (0.5 + 0.5 * smooth(0, 0.14, s)) + topGlow * 0.1)) / Math.sqrt(0.35 + s);
      const o = (y * w + x) * 4;
      img.data[o] = col[0] * i + noiseByte();
      img.data[o + 1] = col[1] * i + noiseByte();
      img.data[o + 2] = col[2] * i + noiseByte();
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

/** Soft radial glow: value = gain * exp-ish falloff, tinted, opaque. */
const makeGlowTexture = (color: number[], gain: number, size = 512) => {
  const c = canvasOf(size, size);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1;
      const v = ((y + 0.5) / size) * 2 - 1;
      const r2 = u * u + v * v;
      const f = r2 >= 1 ? 0 : Math.pow(1 - r2, 2.2) * gain;
      const o = (y * size + x) * 4;
      img.data[o] = color[0] * f + noiseByte();
      img.data[o + 1] = color[1] * f + noiseByte();
      img.data[o + 2] = color[2] * f + noiseByte();
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

/** Background: faint teal glow around the top, otherwise navy-black. */
const makeBackgroundTexture = (outer: number[], inner: number[]) => {
  const w = 128;
  const h = 256;
  const c = canvasOf(w, h);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = (x + 0.5) / w - 0.5;
      const v = (y + 0.5) / h;
      const d = Math.sqrt((u * 1.3) ** 2 + (v * 0.9) ** 2);
      const t = Math.exp(-d * d * 4.5);
      const col = mix3(outer, inner, t);
      const o = (y * w + x) * 4;
      img.data[o] = col[0] + noiseByte();
      img.data[o + 1] = col[1] + noiseByte();
      img.data[o + 2] = col[2] + noiseByte();
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

/** Sprite atlas: [tiny dot][soft dot][bokeh disc][four-point glint], 128px cells. */
const ATLAS_CELL = 128;
const makeAtlas = () => {
  const n = 4;
  const c = canvasOf(ATLAS_CELL * n, ATLAS_CELL);
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(ATLAS_CELL * n, ATLAS_CELL);
  for (let cell = 0; cell < n; cell++) {
    for (let y = 0; y < ATLAS_CELL; y++) {
      for (let x = 0; x < ATLAS_CELL; x++) {
        const u = ((x + 0.5) / ATLAS_CELL) * 2 - 1;
        const v = ((y + 0.5) / ATLAS_CELL) * 2 - 1;
        const r = Math.sqrt(u * u + v * v);
        let f = 0;
        if (cell === 0) f = r < 1 ? Math.exp(-r * r * 9) * (1 - r * r) : 0; // sharp small dot
        else if (cell === 1) f = r < 1 ? Math.pow(1 - r * r, 2) : 0; // soft dot
        else if (cell === 2) {
          // bokeh: flat disc with soft edge and a faint brighter rim
          f = r < 1 ? (1 - smooth(0.55, 1.0, r)) * (0.7 + 0.12 * smooth(0.4, 0.8, r)) : 0;
        } else {
          // four-point glint
          const au = Math.abs(u);
          const av = Math.abs(v);
          const core = Math.exp(-r * r * 40);
          const arms = Math.exp(-au * 38) * Math.exp(-av * av * 600) + Math.exp(-av * 38) * Math.exp(-au * au * 600);
          f = Math.min(1, core + arms * 0.9) * (r < 1 ? 1 - smooth(0.7, 1, r) : 0);
        }
        const o = (y * ATLAS_CELL * n + cell * ATLAS_CELL + x) * 4;
        const val = f * 255;
        img.data[o] = val;
        img.data[o + 1] = val;
        img.data[o + 2] = val;
        img.data[o + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
};

/* ---------------- final dither + grain filter ---------------- */
const filterVertex = `
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition( void ) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
vec2 filterTextureCoord( void ) { return aPosition * (uOutputFrame.zw * uInputSize.zw); }
void main(void) { gl_Position = filterVertexPosition(); vTextureCoord = filterTextureCoord(); }
`;
const filterFragment = `
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform float uLoopFrame;
uniform float uGrain;
${GLSL_GRAIN}
void main(void) {
  vec4 c = texture(uTexture, vTextureCoord);
  finalColor = vec4(ditherGrain(c.rgb, gl_FragCoord.xy, uLoopFrame, uGrain), 1.0);
}
`;

/* ---------------- particles (seeded at module level) ---------------- */
type Dust = {
  x: number;
  y: number;
  ax: number;
  ay: number;
  kx: number;
  ky: number;
  px: number;
  py: number;
  tk: number; // twinkle whole cycles per loop
  tp: number; // twinkle phase
  tsharp: number;
  base: number; // base brightness
  beam: number; // -1 = stray
  cell: number;
  size: number; // px at 3840 wide
  heightT: number; // 0 top .. 1 bottom (drives colour)
  accent: number; // 0..1 accent mix
  jitter: number;
};

const buildDust = (): Dust[] => {
  const rnd = mulberry32(0xd057d057);
  const out: Dust[] = [];
  const totalW = BEAMS.reduce((a, b) => a + b.weight, 0);
  for (let i = 0; i < PARTICLES; i++) {
    let beamIdx = -1;
    let x: number;
    let y: number;
    let bright = 1;
    if (rnd() < STRAY) {
      x = W * (0.5 + (rnd() + rnd() + rnd() - 1.5) * 0.32);
      y = (0.05 + 0.95 * Math.pow(rnd(), 0.7)) * H;
      bright = 0.4;
    } else {
      let r = rnd() * totalW;
      beamIdx = 0;
      for (let b = 0; b < BEAMS.length; b++) {
        if (r < BEAMS[b].weight) {
          beamIdx = b;
          break;
        }
        r -= BEAMS[b].weight;
      }
      const bm = BEAMS[beamIdx];
      // distance along the beam: density rises towards the bottom
      const s = Math.pow(rnd(), 0.62) * 0.95;
      const half = bm.topHalf + (bm.bottomHalf - bm.topHalf) * s;
      // across the beam: concentrated near the centre (sum of uniforms), seeded
      const u = (rnd() + rnd() + rnd() - 1.5) / 1.0;
      const a = (bm.deg * Math.PI) / 180;
      const dx = -Math.sin(a);
      const dy = Math.cos(a);
      const ox = bm.x * W;
      const oy = bm.y * H;
      x = ox + dx * s * BEAM_LEN + Math.cos(a) * u * half;
      y = oy + dy * s * BEAM_LEN + Math.sin(a) * u * half;
      bright = (1 - 0.5 * Math.min(1, Math.abs(u)) ** 2) * bm.gain * (Math.abs(u) > 1 ? 0.5 : 1);
    }
    const heightT = Math.min(1, Math.max(0, y / H));
    // sizes: mostly fine specks, some bokeh discs, a few glints
    const kind = rnd();
    const bokehP = 0.005 + 0.009 * smooth(0.25, 0.8, heightT);
    let cell: number;
    let size: number;
    if (kind < 0.9) {
      cell = 0; // fine dust: dim, tiny
      size = 4 + rnd() * 5;
      bright *= 2.6;
    } else if (kind < 0.992 - bokehP) {
      cell = 1;
      size = 7 + rnd() * 9;
    } else if (kind < 0.992) {
      cell = 2; // out-of-focus bokeh discs: few, large, distinct
      size = 14 + Math.pow(rnd(), 1.6) * (12 + 14 * heightT);
      bright *= 1.5;
    } else {
      cell = 3;
      size = 18 + rnd() * 26;
    }
    // sparse stray / larger discs more likely lower down (as in the reference)
    out.push({
      x,
      y,
      ax: 20 + rnd() * 90,
      ay: 30 + rnd() * 110,
      kx: 1 + Math.floor(rnd() * 2),
      ky: 1 + Math.floor(rnd() * 2),
      px: rnd(),
      py: rnd(),
      tk: 3 + Math.floor(rnd() * 14),
      tp: rnd(),
      tsharp: 1 + rnd() * 3,
      base: bright * (0.5 + 0.5 * rnd()),
      beam: beamIdx,
      cell,
      size,
      heightT,
      accent: rnd(),
      jitter: rnd(),
    });
  }
  return out;
};
const DUST = buildDust();

/* ------------------------------------------------------------------ *
 * Scene construction
 * ------------------------------------------------------------------ */
type SceneHandle = {
  draw: (lf: number) => void;
  destroy: () => void;
};

const createScene = async (
  canvas: HTMLCanvasElement,
  scale: number,
  cw: SpotlightColorway,
  grain: number,
): Promise<SceneHandle> => {
  const app = new Application();
  await app.init({
    canvas,
    width: W,
    height: H,
    resolution: scale,
    autoDensity: false,
    antialias: false,
    preference: "webgl",
    autoStart: false,
    sharedTicker: false,
    preserveDrawingBuffer: true,
    backgroundColor: 0x000000,
    clearBeforeRender: true,
  });
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;

  const bg = rgb(cw.background[0]);
  const bgTop = rgb(cw.background[1]);
  const stage = app.stage;

  // background
  const bgTex = Texture.from(makeBackgroundTexture(bg, bgTop));
  const bgSprite = new Sprite(bgTex);
  bgSprite.width = W;
  bgSprite.height = H;
  stage.addChild(bgSprite);

  // faint teal glow around the upper part of the beams + bottom haze (additive)
  const glowLayer = new Container();
  glowLayer.blendMode = "add";
  const tealTex = Texture.from(makeGlowTexture(rgb(cw.tealGlow), 0.45));
  const teal = new Sprite(tealTex);
  teal.anchor.set(0.5, 0.5);
  teal.position.set(W * 0.5, H * 0.18);
  teal.width = W * 0.7;
  teal.height = H * 1.2;
  glowLayer.addChild(teal);
  const hazeTex = Texture.from(makeGlowTexture(rgb(cw.haze), 1.0));
  const haze = new Sprite(hazeTex);
  haze.anchor.set(0.5, 0.5);
  haze.position.set(W * 0.5, H * 1.0);
  haze.width = W * 0.62;
  haze.height = H * 0.78;
  glowLayer.addChild(haze);
  stage.addChild(glowLayer);

  // beams
  const beamLayer = new Container();
  beamLayer.blendMode = "add";
  const beamTex = Texture.from(makeBeamTexture(rgb(cw.beamTop), rgb(cw.beamBody)));
  const beamSprites = BEAMS.map((b) => {
    const s = new Sprite(beamTex);
    s.anchor.set(0.5, 0);
    s.position.set(b.x * W, b.y * H);
    s.rotation = (b.deg * Math.PI) / 180;
    s.width = b.bottomHalf * 2;
    s.height = BEAM_LEN;
    beamLayer.addChild(s);
    return s;
  });
  stage.addChild(beamLayer);

  // dust
  const atlasTexSrc = Texture.from(makeAtlas());
  const cells = [0, 1, 2, 3].map(
    (i) =>
      new Texture({
        source: atlasTexSrc.source,
        frame: new Rectangle(i * ATLAS_CELL, 0, ATLAS_CELL, ATLAS_CELL),
      }),
  );
  const dustContainer = new ParticleContainer({
    dynamicProperties: { position: true, color: true, vertex: false, rotation: false, uvs: false },
    boundsArea: new Rectangle(0, 0, W, H),
  });
  dustContainer.blendMode = "add";
  const cTop = rgb(cw.dustTop);
  const cMid = rgb(cw.dustMid);
  const cBot = rgb(cw.dustBottom);
  const cAcc = rgb(cw.dustAccent);
  const particles: Particle[] = DUST.map((d) => {
    // colour by height: pale blue-white -> teal -> crimson/pink
    const hT = d.heightT;
    let col: number[];
    if (hT < 0.38) col = mix3(cTop, cMid, smooth(0.05, 0.38, hT));
    else col = mix3(cMid, cBot, smooth(0.38, 0.8, hT));
    if (d.accent < cw.accentAmount * smooth(0.25, 0.7, hT)) col = mix3(col, cAcc, 0.85);
    col = mix3(col, [255, 255, 255], d.cell === 3 ? 0.35 : 0.1 * d.jitter);
    const p = new Particle({
      texture: cells[d.cell],
      x: d.x,
      y: d.y,
      anchorX: 0.5,
      anchorY: 0.5,
      scaleX: d.size / ATLAS_CELL,
      scaleY: d.size / ATLAS_CELL,
      tint: pack(col),
      alpha: 1,
    });
    return p;
  });
  for (const p of particles) dustContainer.addParticle(p);
  stage.addChild(dustContainer);

  // final dither + grain filter
  const grainFilter = new Filter({
    glProgram: GlProgram.from({ vertex: filterVertex, fragment: filterFragment, name: "dither-grain" }),
    resources: {
      grainUniforms: new UniformGroup({
        uLoopFrame: { value: 0, type: "f32" },
        uGrain: { value: grain, type: "f32" },
      }),
    },
  });
  stage.filters = [grainFilter];

  const draw = (lf: number) => {
    const ph = lf / LOOP_FRAMES;
    // beam breathing: whole cycles, gentle
    BEAMS.forEach((b, i) => {
      beamSprites[i].alpha = b.gain * (1 + 0.1 * Math.sin(TAU * (b.breathe * ph + b.phase)));
    });
    haze.alpha = 0.8 + 0.06 * Math.sin(TAU * (2 * ph + 0.3));
    const breathe = BEAMS.map((b) => 1 + 0.08 * Math.sin(TAU * (b.breathe * ph + b.phase)));
    for (let i = 0; i < particles.length; i++) {
      const d = DUST[i];
      const p = particles[i];
      p.x = d.x + d.ax * Math.sin(TAU * (d.kx * ph + d.px));
      p.y = d.y + d.ay * Math.cos(TAU * (d.ky * ph + d.py));
      // twinkle: own whole-cycle phase; sharpened so it glints rather than pulses
      const w = 0.5 + 0.5 * Math.cos(TAU * (d.tk * ph + d.tp));
      const tw = 0.3 + 0.7 * Math.pow(w, d.tsharp * 1.5);
      const br = d.beam >= 0 ? breathe[d.beam] : 1;
      p.alpha = Math.min(1, d.base * tw * br);
    }
    (grainFilter.resources.grainUniforms as UniformGroup).uniforms.uLoopFrame = lf;
    app.render();
  };

  return {
    draw,
    destroy: () => {
      app.destroy(false, { children: true, texture: true });
    },
  };
};

/* ------------------------------------------------------------------ *
 * Remotion component
 * ------------------------------------------------------------------ */
export const SpotlightDust: React.FC<{
  colorway: SpotlightColorway;
  grain?: number;
}> = ({ colorway, grain = 0.015 }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const scale = useBackingScale();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const lfRef = useRef(0);
  const { delayRender, continueRender } = useDelayRender();
  const [handle] = useState(() => delayRender("Waiting for PixiJS scene"));
  const lf = loopFrame(frame);
  lfRef.current = lf;

  useEffect(() => {
    let cancelled = false;
    createScene(canvasRef.current!, scale, colorway, grain).then((scene) => {
      if (cancelled) {
        scene.destroy();
        return;
      }
      sceneRef.current = scene;
      scene.draw(lfRef.current);
      continueRender(handle);
    });
    return () => {
      cancelled = true;
      sceneRef.current?.destroy();
      sceneRef.current = null;
    };
  }, [colorway, grain, scale, continueRender, handle]);

  useEffect(() => {
    sceneRef.current?.draw(lf);
  }, [lf]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height, display: "block", background: "#000" }}
    />
  );
};

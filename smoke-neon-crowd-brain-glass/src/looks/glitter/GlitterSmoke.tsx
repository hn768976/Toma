import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import {
  Application,
  Filter,
  Geometry,
  GlProgram,
  Mesh,
  ParticleContainer,
  RenderTexture,
  Shader,
  Texture,
  type IParticle,
} from "pixi.js";
import { mulberry32, TAU } from "../../lib/rng";
import type { GlitterSmokeColors } from "../../versions";
import { GRAIN_FRAG, GRAIN_VERT, SMOKE_FRAG, SMOKE_VERT } from "./smokeShader";

const LOOP = 600;
const M = 2; // flow symmetry: one half turn per loop
const SECTOR = TAU / M;
const CENTER = { x: 0.18, y: 0.1 }; // flow centre (the dark void), screen-height units, y up, origin = frame centre
const N = 80000;
const LEVELS = 8; // bokeh disc textures
const DENS_W = 192;
const DENS_H = 108;
const TWINKLE_K = [6, 8, 10, 12, 15, 20, 24, 25, 30]; // whole cycles per 600 frames

// ------------------------------------------------------------------ particle data (built once, module level)
type Data = {
  r: Float32Array; // radius from flow centre
  phi: Float32Array; // base angle in [0, SECTOR)
  z: Float32Array; // depth (1 = focus plane)
  size: Float32Array;
  col: Uint8Array; // palette index
  tk: Uint8Array; // twinkle cycles per loop
  tph: Float32Array;
  bright: Float32Array;
  wob: Float32Array; // wobble amplitude
  wk: Uint8Array; // wobble cycles per loop
  wph: Float32Array;
  win: Uint8Array; // visible half-plane: 0 = left (smoke), 1 = right (void)
};
const buildData = (weights: number[]): Data => {
  const rand = mulberry32(0x61177e5);
  const d: Data = {
    r: new Float32Array(N),
    phi: new Float32Array(N),
    z: new Float32Array(N),
    size: new Float32Array(N),
    col: new Uint8Array(N),
    tk: new Uint8Array(N),
    tph: new Float32Array(N),
    bright: new Float32Array(N),
    wob: new Float32Array(N),
    wk: new Uint8Array(N),
    wph: new Float32Array(N),
    win: new Uint8Array(N),
  };
  const wsum = weights.reduce((a, b) => a + b, 0);
  const gauss = () => {
    const u = Math.max(1e-6, rand());
    const v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  };
  for (let i = 0; i < N; i++) {
    const u = rand();
    // 85% packed in the smoke crescent (left half-plane around the void), the rest are sparse stars
    const inSmoke = u < 0.93;
    d.win[i] = inSmoke ? 0 : 1;
    d.r[i] = inSmoke ? 0.5 + Math.pow(rand(), 0.8) * 1.4 + gauss() * 0.05 : 0.25 + rand() * 1.9;
    d.phi[i] = rand() * SECTOR;
    const zr = rand();
    // mostly mid/far (sharp specks); a few near the lens → soft bokeh
    d.z[i] = zr < 0.012 ? 0.4 + rand() * 0.3 : zr < 0.08 ? 0.72 + rand() * 0.22 : 0.94 + rand() * 1.0;
    d.size[i] = 0.5 + Math.pow(rand(), 2.5) * 2.4;
    let c = rand() * wsum;
    let k = 0;
    while (k < weights.length - 1 && c > weights[k]) c -= weights[k++];
    d.col[i] = k;
    d.tk[i] = TWINKLE_K[Math.floor(rand() * TWINKLE_K.length)];
    d.tph[i] = rand() * TAU;
    d.bright[i] = inSmoke ? (rand() < 0.12 ? 1.0 + rand() * 0.8 : 0.07 + rand() * 0.22) : 0.5 + rand() * 0.6;
    d.wob[i] = 0.003 + rand() * 0.01;
    d.wk[i] = 1 + Math.floor(rand() * 3);
    d.wph[i] = rand() * TAU;
  }
  return d;
};

const hexToRgb = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

/** Disc textures: level 0 = tiny hot speck, higher = larger, softer bokeh disc with a faint rim. */
const makeDiscTexture = (level: number) => {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const R = S / 2;
  const grd = g.createRadialGradient(R, R, 0, R, R, R);
  if (level === 0) {
    grd.addColorStop(0, "rgba(255,255,255,1)");
    grd.addColorStop(0.18, "rgba(255,255,255,0.85)");
    grd.addColorStop(0.45, "rgba(255,255,255,0.18)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
  } else {
    const soft = Math.max(0.04, 0.22 - level * 0.02);
    grd.addColorStop(0, "rgba(255,255,255,0.55)");
    grd.addColorStop(0.75 - soft, "rgba(255,255,255,0.62)");
    grd.addColorStop(0.9 - soft * 0.5, "rgba(255,255,255,0.9)");
    grd.addColorStop(0.97, "rgba(255,255,255,0.25)");
    grd.addColorStop(1, "rgba(255,255,255,0)");
  }
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  return Texture.from(c);
};

type Engine = { render: (frame: number) => void; destroy: () => void };

const createEngine = async (host: HTMLDivElement, width: number, height: number, resolution: number, colors: GlitterSmokeColors): Promise<Engine> => {
  const app = new Application();
  await app.init({
    width,
    height,
    resolution,
    autoDensity: false,
    preference: "webgl",
    autoStart: false,
    sharedTicker: false,
    preserveDrawingBuffer: true,
    antialias: false,
    background: colors.bgDeep,
  });
  app.ticker.stop();
  const canvas = app.canvas as HTMLCanvasElement;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  host.appendChild(canvas);
  const aspect = width / height;

  // ---------------- smoke mesh (full screen quad, custom shader)
  const geometry = new Geometry({
    attributes: {
      aPosition: [0, 0, width, 0, width, height, 0, height],
      aUV: [0, 0, 1, 0, 1, 1, 0, 1],
    },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });
  const smokeUniforms = {
    uT: { value: 0, type: "f32" as const },
    uAspect: { value: aspect, type: "f32" as const },
    uMode: { value: 0, type: "f32" as const },
    uSmoke: { value: new Float32Array(hexToRgb(colors.smoke)), type: "vec3<f32>" as const },
    uSmokeEdge: { value: new Float32Array(hexToRgb(colors.smokeEdge)), type: "vec3<f32>" as const },
    uBgDeep: { value: new Float32Array(hexToRgb(colors.bgDeep)), type: "vec3<f32>" as const },
    uCenter: { value: new Float32Array([CENTER.x, CENTER.y]), type: "vec2<f32>" as const },
  };
  const shader = Shader.from({ gl: { vertex: SMOKE_VERT, fragment: SMOKE_FRAG }, resources: { smokeUniforms } });
  const smoke = new Mesh({ geometry, shader });
  app.stage.addChild(smoke);

  // density read-back target
  const densRT = RenderTexture.create({ width: DENS_W, height: DENS_H, resolution: 1 });

  // ---------------- glitter
  const data = buildData(colors.glitter.map((g) => g.weight));
  const palette = colors.glitter.map((g) => hexToRgb(g.color));
  const textures = Array.from({ length: LEVELS }, (_, l) => makeDiscTexture(l));
  const containers = textures.map((texture) => {
    const pc = new ParticleContainer({
      texture,
      dynamicProperties: { position: true, vertex: true, color: true, rotation: false, uvs: false },
    });
    pc.blendMode = "add";
    pc.boundsArea = { x: 0, y: 0, width, height } as never;
    app.stage.addChild(pc);
    return pc;
  });
  // one reusable particle object per speck
  const parts: IParticle[] = Array.from({ length: N }, () => ({
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    anchorX: 0.5,
    anchorY: 0.5,
    rotation: 0,
    color: 0xffffffff,
    texture: textures[0],
  }));
  const buckets: IParticle[][] = textures.map(() => []);

  // ---------------- grain + dither filter on the whole stage
  const grain = new Filter({
    glProgram: new GlProgram({ vertex: GRAIN_VERT, fragment: GRAIN_FRAG }),
    resources: { grainUniforms: { uFrame: { value: 0, type: "f32" }, uGrain: { value: 0.02, type: "f32" } } },
  });
  app.stage.filters = [grain];
  app.stage.filterArea = app.screen;

  const H = height; // logical px per screen-height unit
  const FOCUS = 1.0;
  const pxScale = width / 3840; // texture scale is relative to a 4K layout

  const render = (frame: number) => {
    const lf = ((frame % LOOP) + LOOP) % LOOP;
    const t = lf / LOOP;
    smokeUniforms.uT.value = t;

    // 1) smoke density at low res → CPU (same shader, density mode)
    smokeUniforms.uMode.value = 1;
    smoke.scale.set(DENS_W / width, DENS_H / height);
    app.renderer.render({ container: smoke, target: densRT, clear: true });
    const { pixels } = app.renderer.extract.pixels(densRT);
    smoke.scale.set(1, 1);
    smokeUniforms.uMode.value = 0;

    // 2) glitter: rotate with the flow (one sector per loop), project, size by depth
    for (const b of buckets) b.length = 0;
    const rot = SECTOR * t;
    const tw = TAU * t;
    for (let i = 0; i < N; i++) {
      const z = data.z[i];
      // Each speck has two copies 180° apart; only the one inside its half-plane window
      // (left: 90°..270°, right: 270°..450°) is drawn, faded at the window ends so the
      // hand-over at the top/bottom of the void is invisible.
      let u = data.phi[i] + rot;
      if (u >= SECTOR) u -= SECTOR;
      const ang = u + (data.win[i] === 0 ? Math.PI / 2 : -Math.PI / 2);
      const env = Math.sin((Math.PI * u) / SECTOR);
      const fade = Math.sqrt(env);
      const wob = data.wob[i] * Math.sin(tw * data.wk[i] + data.wph[i]);
      const rr = data.r[i] + wob;
      // 2.5D: world point on the flow plane, small depth parallax around the frame centre
      const wx = CENTER.x + rr * Math.cos(ang);
      const wy = CENTER.y + rr * Math.sin(ang) + wob * 0.6;
      const persp = 1 + (1 - z) * 0.35; // nearer specks spread out slightly
      const sx = wx * persp;
      const sy = wy * persp;
      const px = (sx + aspect / 2) * H;
      const py = (0.5 - sy) * H;
      if (px < -60 * pxScale || px > width + 60 * pxScale || py < -60 * pxScale || py > height + 60 * pxScale) continue;
      // smoke density at the speck
      const dx = Math.min(DENS_W - 1, Math.max(0, Math.floor((px / width) * DENS_W)));
      const dy = Math.min(DENS_H - 1, Math.max(0, Math.floor((py / height) * DENS_H)));
      const dens = pixels[(dy * DENS_W + dx) * 4] / 255;
      // twinkle (cycles divide 600)
      const s = 0.5 + 0.5 * Math.sin(tw * data.tk[i] + data.tph[i]);
      const twk = 0.25 + 0.75 * s * s * s;
      // circle of confusion → bokeh level
      // near side blurs strongly, far side only a little (background specks stay crisp)
      const coc = z < FOCUS ? (1 / z - 1 / FOCUS) * 2.6 : (1 - FOCUS / z) * 1.0;
      const level = Math.min(LEVELS - 1, Math.floor(coc));
      const sizePx = (7 + data.size[i] * 6) * (data.bright[i] > 0.9 ? 1.5 : 1) * (1 / z) * (1 + coc * 1.8);
      let a = fade * data.bright[i] * twk * (data.win[i] === 0 ? 0.15 + 1.9 * dens : 0.55);
      if (level > 0) a *= 0.4 / (1 + coc * 1.2); // alpha lowered as discs grow
      a = Math.min(1, a * (level === 0 ? 1 : 1.0));
      const p = parts[i];
      p.x = px;
      p.y = py;
      const sc = (sizePx * pxScale) / 128;
      p.scaleX = sc;
      p.scaleY = sc;
      const c = palette[data.col[i]];
      const ai = Math.round(a * 255);
      p.color = (((ai & 255) << 24) | (Math.round(c[2] * 255) << 16) | (Math.round(c[1] * 255) << 8) | Math.round(c[0] * 255)) >>> 0;
      p.texture = textures[level];
      buckets[level].push(p);
    }
    containers.forEach((pc, l) => {
      pc.particleChildren = buckets[l];
      pc.update();
    });

    // 3) grain/dither, then draw
    grain.resources.grainUniforms.uniforms.uFrame = lf;
    app.render();
  };

  return {
    render,
    destroy: () => {
      app.destroy(true, { children: true, texture: true });
    },
  };
};

export const GlitterSmoke: React.FC<{ colors: GlitterSmokeColors }> = ({ colors }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [initHandle] = useState(() => delayRender("PixiJS init"));
  const [ready, setReady] = useState(false);
  const env = getRemotionEnvironment();
  const resolution = env.isRendering ? window.devicePixelRatio : Math.min(window.devicePixelRatio, 0.5);

  useEffect(() => {
    let alive = true;
    let eng: Engine | null = null;
    createEngine(hostRef.current!, width, height, resolution, colors)
      .then((e) => {
        if (!alive) {
          e.destroy();
          return;
        }
        eng = e;
        engineRef.current = e;
        setReady(true);
      })
      .catch((err) => {
        console.error(err);
        throw err;
      });
    return () => {
      alive = false;
      eng?.destroy();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useLayoutEffect(() => {
    if (!ready || !engineRef.current) return;
    engineRef.current.render(frame);
    continueRender(initHandle);
  }, [frame, ready, initHandle]);

  return (
    <AbsoluteFill style={{ background: colors.bgDeep }}>
      <div ref={hostRef} style={{ width, height, position: "absolute", inset: 0 }} />
    </AbsoluteFill>
  );
};

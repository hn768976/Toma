import {
  BLEND_MODES,
  Container,
  Geometry,
  Mesh,
  RenderTexture,
  Shader,
  Sprite,
  Texture,
  UniformGroup,
  WebGLRenderer,
} from "pixi.js";
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import type { SunLeavesRow } from "../data";
import { blueNoise64 } from "../lib/bluenoise";
import { renderDpr } from "../lib/dpr";
import { hexToRgb, RGB } from "../lib/color";
import {
  LAYERS,
  LEAF_TEX,
  makeBokeh,
  makeLayout,
  makeLeafCanvases,
  makeRadial,
  makeRay,
} from "./textures";
import { mulberry32 } from "../lib/random";

const TAU = Math.PI * 2;
const SUN = { x: 0.73, y: 0.57 }; // fraction of width / height

const FINISH_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;
in vec2 aUV;
out vec2 vUV;
void main() {
  vUV = aUV;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const FINISH_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform sampler2D uBlue;
uniform float uFrame;
uniform float uGrain;
uniform vec2 uRes;

uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
float blueAt(vec2 fc, float frame, float ch) {
  vec2 off = floor(fract(vec2(0.7548776662, 0.5698402910) * (frame + ch * 17.0)) * 64.0);
  return texelFetch(uBlue, ivec2(mod(floor(fc) + off, 64.0)), 0).r;
}

void main() {
  vec3 c = texture(uTexture, vUV).rgb;
  // Bright, airy grade: soft shoulder for the additive light, lifted shadows.
  vec3 over = max(c - 0.8, 0.0);
  c = min(c, 0.8) + over / (1.0 + over * 2.5);
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  c = mix(vec3(l), c, 1.08);           // rich greens
  c = c * 0.97 + vec3(0.03, 0.03, 0.02); // slight lift
  c = clamp(c, 0.0, 1.0);
  vec2 fc = gl_FragCoord.xy;
  vec3 h = vec3(pcg3d(uvec3(uvec2(fc), uint(uFrame) + 7919u))) * (1.0 / 4294967296.0);
  float n = (h.x + h.y) - 1.0;
  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c += n * uGrain * smoothstep(0.0, 0.03, lum);
  vec3 d = vec3(blueAt(fc, uFrame, 0.0), blueAt(fc, uFrame, 1.0), blueAt(fc, uFrame, 2.0));
  c += (d - 0.5) * (2.0 / 255.0);
  finalColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

const toInt = (c: RGB) =>
  (Math.round(Math.min(1, Math.max(0, c[0])) * 255) << 16) |
  (Math.round(Math.min(1, Math.max(0, c[1])) * 255) << 8) |
  Math.round(Math.min(1, Math.max(0, c[2])) * 255);
const mixc = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const scale = (a: RGB, k: number): RGB => [a[0] * k, a[1] * k, a[2] * k];

type Built = {
  renderer: WebGLRenderer;
  stage: Container;
  finish: Mesh<Geometry, Shader>;
  uniforms: UniformGroup;
  rt: RenderTexture;
  W: number;
  H: number;
  update: (frame: number) => void;
};

const build = async (canvas: HTMLCanvasElement, row: SunLeavesRow, W: number, H: number) => {
  const renderer = new WebGLRenderer();
  await renderer.init({
    canvas,
    width: W,
    height: H,
    resolution: 1,
    antialias: false,
    preserveDrawingBuffer: true,
    background: "#000000",
    autoDensity: false,
    preference: "webgl",
  } as never);

  const aspect = W / H;
  const sun = { x: SUN.x * aspect, y: SUN.y }; // in frame heights
  const leafCanvases = makeLeafCanvases();
  const leafTex = leafCanvases.map((row2) => row2.map((c) => Texture.from(c)));
  const radialTex = Texture.from(makeRadial(256, 2.2));
  const softTex = Texture.from(makeRadial(256, 1.3));
  const bokehTex = Texture.from(makeBokeh(128, 0.35));
  const rayTex = Texture.from(makeRay(512, 64));

  const palette = row.leaves.map(hexToRgb);
  const sunC = hexToRgb(row.sun);
  const shadow = hexToRgb(row.shadow);
  const back = hexToRgb(row.backdrop);
  const hi = palette[palette.length - 1];

  const stage = new Container();

  // Backdrop: soft vertical/radial gradient of out-of-focus canopy.
  const bg = document.createElement("canvas");
  bg.width = 320;
  bg.height = 180;
  const g = bg.getContext("2d")!;
  const grad = g.createRadialGradient(SUN.x * 320, SUN.y * 180, 6, SUN.x * 320, SUN.y * 180, 260);
  const css = (c: RGB) =>
    `rgb(${Math.round(c[0] * 255)},${Math.round(c[1] * 255)},${Math.round(c[2] * 255)})`;
  grad.addColorStop(0, css(mixc(back, sunC, 0.5)));
  grad.addColorStop(0.3, css(back));
  grad.addColorStop(0.7, css(mixc(back, shadow, 0.35)));
  grad.addColorStop(1, css(mixc(back, shadow, 0.6)));
  g.fillStyle = grad;
  g.fillRect(0, 0, 320, 180);
  const bgSprite = new Sprite(Texture.from(bg));
  bgSprite.width = W;
  bgSprite.height = H;
  stage.addChild(bgSprite);

  const additive = (tex: Texture, tint: number) => {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.blendMode = "add" as BLEND_MODES;
    s.tint = tint;
    return s;
  };

  // Sun behind the leaves.
  const sunHalo = additive(softTex, toInt(sunC));
  const sunCore = additive(radialTex, 0xffffff);
  stage.addChild(sunHalo, sunCore);

  const leaves = makeLayout(row.seed, aspect, palette.length);
  const layerContainers = LAYERS.map(() => new Container());
  const glowContainers = LAYERS.map(() => new Container());
  const leafSprites: Sprite[] = [];
  const glowSprites: (Sprite | null)[] = [];
  for (const L of leaves) {
    const tex = leafTex[L.shape][LAYERS[L.layer].blur];
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    const px = L.size * H * 1.45;
    s.width = px;
    s.height = px;
    const d = Math.hypot(L.x - sun.x, L.y - sun.y);
    const lit = 0.35 + 0.65 * Math.exp(-(d * d) / (2 * 0.85 * 0.85));
    const base = palette[L.colorIndex];
    // Backlit leaves near the sun turn yellow and bright; away from it they
    // stay a deeper green.
    // Each leaf is either backlit (bright, yellowing toward the sun) or in
    // shade (dark green); far layers hold more shaded leaves.
    const darkShare = [0.3, 0.22, 0.16, 0.5][L.layer] * (1 - Math.exp(-(d * d) / (2 * 0.3 * 0.3)));
    let col: RGB;
    if (L.colorJitter < darkShare) {
      const k = L.colorJitter / darkShare;
      col = mixc(shadow, scale(base, 0.75), 0.25 + 0.45 * k + 0.3 * lit);
    } else {
      const k = (L.colorJitter - darkShare) / (1 - darkShare);
      // Backlit leaves use the lighter half of the palette.
      const lightBase = palette[Math.min(palette.length - 1, Math.floor(palette.length / 2) + (L.colorIndex % Math.ceil(palette.length / 2)))];
      col = scale(mixc(lightBase, hi, 0.35 + 0.4 * lit + 0.25 * k), 1.2 + 0.2 * lit);
    }
    s.tint = toInt(col);
    s.alpha = L.alpha;
    layerContainers[L.layer].addChild(s);
    leafSprites.push(s);
    // Backlit halo behind leaves close to the sun.
    if (L.layer >= 1 && d < 0.5) {
      const gs = new Sprite(leafTex[L.shape][3]);
      gs.anchor.set(0.5);
      gs.width = px * 1.25;
      gs.height = px * 1.25;
      gs.blendMode = "add" as BLEND_MODES;
      gs.tint = toInt(mixc(sunC, hi, 0.3));
      gs.alpha = 0.3 * Math.pow(1 - d / 0.5, 1.5);
      glowContainers[L.layer].addChild(gs);
      glowSprites.push(gs);
    } else {
      glowSprites.push(null);
    }
  }

  // Bokeh highlights where light leaks through, biased toward the sun.
  const rng = mulberry32(row.seed ^ 0x5eed);
  const bokeh = Array.from({ length: 60 }, (_, i) => {
    const big = i < 6;
    const r = big ? 0.16 + rng() * 0.18 : Math.pow(rng(), 0.7) * 0.75;
    const a = big ? 0.35 + rng() * 0.9 : rng() * TAU;
    return {
      x: sun.x + Math.cos(a) * r * 1.4,
      y: sun.y + Math.sin(a) * r,
      size: big ? 0.08 + rng() * 0.05 : 0.04 + rng() * 0.05,
      base: big ? 0.6 + rng() * 0.3 : 0.15 + rng() * 0.35,
      phase: rng() * TAU,
      sprite: additive(bokehTex, toInt(mixc(sunC, hi, rng() * 0.6))),
    };
  });
  const bokehLayer = new Container();
  bokeh.forEach((b) => bokehLayer.addChild(b.sprite));

  // Lens light on top: glow, rays, flare ghost.
  const lens = new Container();
  const glow = additive(softTex, toInt(sunC));
  // Rays: a long soft fan toward the lower left, shorter ones up and right.
  const rays = Array.from({ length: 11 }, (_, i) => {
    const s = new Sprite(rayTex);
    s.anchor.set(0, 0.5);
    s.blendMode = "add" as BLEND_MODES;
    s.tint = toInt(sunC);
    const down = i < 7;
    const angle = down ? 1.85 + (i / 6) * 1.0 + (rng() - 0.5) * 0.12 : -1.3 + ((i - 7) / 3) * 1.0 + (rng() - 0.5) * 0.15;
    return {
      s,
      angle,
      len: down ? 1.0 + rng() * 0.6 : 0.5 + rng() * 0.3,
      w: down ? 0.08 + rng() * 0.08 : 0.05 + rng() * 0.05,
      base: down ? 0.16 + rng() * 0.1 : 0.07 + rng() * 0.06,
      k: 1 + Math.floor(rng() * 3),
      ph: rng() * TAU,
    };
  });
  const ghost = additive(softTex, 0xe090e8);
  const ghost2 = additive(softTex, 0x60e8c8);
  lens.addChild(glow, ...rays.map((r) => r.s), ghost, ghost2);

  stage.addChild(
    glowContainers[0],
    layerContainers[0],
    glowContainers[1],
    layerContainers[1],
    bokehLayer,
    glowContainers[2],
    layerContainers[2],
    glowContainers[3],
    layerContainers[3],
    lens,
  );

  // Half-float scene target and the finishing pass.
  const rt = RenderTexture.create({ width: W, height: H, format: "rgba16float" } as never);
  const blue = blueNoise64();
  const bc = document.createElement("canvas");
  bc.width = 64;
  bc.height = 64;
  const bctx = bc.getContext("2d")!;
  const bimg = bctx.createImageData(64, 64);
  for (let i = 0; i < blue.length; i++) {
    bimg.data[i * 4] = bimg.data[i * 4 + 1] = bimg.data[i * 4 + 2] = blue[i];
    bimg.data[i * 4 + 3] = 255;
  }
  bctx.putImageData(bimg, 0, 0);
  const blueTex = Texture.from(bc);
  blueTex.source.scaleMode = "nearest";

  const uniforms = new UniformGroup({
    uFrame: { value: 0, type: "f32" },
    uGrain: { value: 0.01, type: "f32" },
    uRes: { value: new Float32Array([W, H]), type: "vec2<f32>" },
  });
  const geometry = new Geometry({
    attributes: {
      aPosition: new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]),
      // Pixi render textures are stored top-down.
      aUV: new Float32Array([0, 1, 1, 1, 1, 0, 0, 0]),
    },
    indexBuffer: new Uint32Array([0, 1, 2, 0, 2, 3]),
  });
  const shader = Shader.from({
    gl: { vertex: FINISH_VERT, fragment: FINISH_FRAG },
    resources: { uTexture: rt.source, uBlue: blueTex.source, finishUniforms: uniforms },
  });
  const finish = new Mesh({ geometry, shader });

  // Coverage of a point by the leaves (product of transmittances).
  const leafMask = (L: (typeof leaves)[number], x: number, y: number, ox: number, oy: number, rot: number) => {
    const dx = x - (L.x + ox);
    const dy = y - (L.y + oy);
    const c = Math.cos(-rot);
    const s = Math.sin(-rot);
    const lx = (dx * c - dy * s) / (L.size * 0.36);
    const ly = (dx * s + dy * c) / (L.size * 0.5);
    const r = Math.sqrt(lx * lx + ly * ly);
    if (r >= 1.25) return 0;
    const t = Math.min(1, Math.max(0, (r - 0.6) / 0.65));
    return 1 - t * t * (3 - 2 * t);
  };

  const update = (frame: number) => {
    const t = (frame % row.durationInFrames) / row.durationInFrames;
    const offs = leaves.map((L) => {
      // Whole cycles per loop: 1, 2 and 3.
      const gust = 0.6 + 0.4 * Math.cos(TAU * t + 0.8);
      const ox =
        L.amp * gust * (Math.cos(TAU * t + L.phase) + 0.45 * Math.cos(TAU * 3 * t + L.phase2));
      const oy = L.amp * 0.55 * (Math.sin(TAU * 2 * t + L.phase) + 0.3 * Math.sin(TAU * t + L.phase2));
      const rot = L.rot + (L.amp / 0.01) * 0.06 * Math.sin(TAU * 2 * t + L.phase2);
      return { ox, oy, rot };
    });
    leaves.forEach((L, i) => {
      const s = leafSprites[i];
      const o = offs[i];
      s.position.set((L.x + o.ox) * H, (L.y + o.oy) * H);
      s.rotation = o.rot;
      const gsp = glowSprites[i];
      if (gsp) {
        gsp.position.set(s.position.x, s.position.y);
        gsp.rotation = o.rot;
      }
    });
    const coverage = (x: number, y: number, minLayer: number) => {
      let tr = 1;
      leaves.forEach((L, i) => {
        if (L.layer < minLayer) return;
        const m = leafMask(L, x, y, offs[i].ox, offs[i].oy, offs[i].rot);
        if (m > 0) tr *= 1 - m * L.alpha * 0.85;
      });
      return 1 - tr;
    };
    const vis = 1 - coverage(sun.x, sun.y, 0) * 0.75;
    const sx = sun.x * H;
    const sy = sun.y * H;
    sunCore.position.set(sx, sy);
    sunCore.width = sunCore.height = 0.25 * H;
    sunCore.alpha = 1;
    sunHalo.position.set(sx, sy);
    sunHalo.width = sunHalo.height = 1.1 * H;
    sunHalo.alpha = 0.8;
    glow.position.set(sx, sy);
    glow.width = glow.height = (0.55 + 0.2 * vis) * H;
    glow.alpha = 0.3 + 0.5 * vis;
    rays.forEach((r) => {
      r.s.position.set(sx, sy);
      r.s.rotation = r.angle + 0.03 * Math.sin(TAU * r.k * t + r.ph);
      r.s.width = r.len * H;
      r.s.height = r.w * H;
      r.s.alpha = r.base * (0.25 + 0.75 * vis) * (0.85 + 0.15 * Math.sin(TAU * r.k * t + r.ph));
    });
    bokeh.forEach((b) => {
      const cov = coverage(b.x, b.y, 2);
      b.sprite.position.set(b.x * H, b.y * H);
      b.sprite.width = b.sprite.height = b.size * H;
      b.sprite.alpha = b.base * (1 - cov) * (0.7 + 0.3 * Math.sin(TAU * 2 * t + b.phase));
    });
    // Flare ghost on the line through the frame centre, drifting with the sway.
    const cx = aspect / 2;
    const cy = 0.5;
    const gx = cx + (cx - sun.x) * 0.95 + 0.03 * Math.cos(TAU * t);
    const gy = cy + (cy - sun.y) * 0.95 - 0.08 + 0.02 * Math.sin(TAU * 2 * t);
    ghost.position.set(gx * H, gy * H);
    ghost.width = ghost.height = 0.07 * H;
    ghost.alpha = 0.45 + 0.4 * vis;
    ghost2.position.set((gx - 0.1) * H, (gy - 0.015) * H);
    ghost2.width = ghost2.height = 0.05 * H;
    ghost2.alpha = 0.25 + 0.25 * vis;
    uniforms.uniforms.uFrame = frame % row.durationInFrames;
  };

  return { renderer, stage, finish, uniforms, rt, W, H, update } satisfies Built;
};

export const SunLeaves: React.FC<{ row: SunLeavesRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const builtRef = useRef<Built | null>(null);
  const [initHandle] = useState(() => delayRender("Building leaves scene"));
  const [ready, setReady] = useState(false);
  const firstDone = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const dpr = renderDpr(0.5);
    const W = Math.round(width * dpr);
    const H = Math.round(height * dpr);
    build(canvasRef.current!, row, W, H).then((b) => {
      if (cancelled) return;
      builtRef.current = b;
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [row, width, height]);

  useLayoutEffect(() => {
    const b = builtRef.current;
    if (!ready || !b) return;
    b.update(frame);
    b.renderer.render({ container: b.stage, target: b.rt, clear: true });
    b.renderer.render({ container: b.finish, clear: true });
    if (!firstDone.current) {
      firstDone.current = true;
      continueRender(initHandle);
    }
  }, [frame, ready, initHandle]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
};

export const __leafTexSize = LEAF_TEX;

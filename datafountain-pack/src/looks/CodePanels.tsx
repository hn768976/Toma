import React, { useMemo } from "react";
import * as THREE from "three";
import { fontsReady, MONO } from "../lib/fonts";
import { DOF_SAMPLE, frag } from "../lib/glsl";
import { Post } from "../lib/post";
import { mulberry32, range } from "../lib/random";
import { Stage, useAsset, useDrive } from "../lib/Stage";
import { codeBlock, type CodeLine } from "./codeText";

/**
 * Look 2 — Code Panels. ~60 cards of made-up assembly-style code on a
 * periodic depth layout: card i sits at distance NEAR + ((d_i − L·f/600) mod L),
 * so over one loop every card moves exactly one period L toward the camera
 * and frame 600 is frame 0. Cards fade in at the far end and out at the near
 * end. Depth of field is per card (CoC from distance → disk blur from a
 * matched mip). A warm lens flare sits on the left edge (final pass).
 */
export type CodePanelsParams = {
  white: string;
  green: string;
  orange: string;
  flare: string;
};

const LOOP = 600;
const N_PANELS = 60;
const N_VARIANTS = 20;
const N_DECOR = 48;
const N_DECOR_VARIANTS = 6;
const NEAR = 1.6;
const L = 34;
const FOCUS = 11.5;
const FOV = 44;

const FONT_PX = 34;
const LINE_PX = 54;
const PAD = 84;

type Variant = { tex: THREE.CanvasTexture; w: number; h: number };

/** Small HUD decoration card: thin horizontal light dashes and "+" markers. */
const drawDecor = (seed: number, colors: Record<string, string>): Variant => {
  const rng = mulberry32(seed);
  const w = 900;
  const h = 360;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const cols = [colors.white, colors.white, colors.green, colors.orange, "#7FE6F0"];
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = cols[Math.floor(rng() * cols.length)];
    ctx.globalAlpha = range(rng, 0.8, 1);
    ctx.fillRect(PAD + rng() * (w - 2 * PAD - 300), PAD + rng() * (h - 2 * PAD), range(rng, 40, 300), range(rng, 2, 4));
  }
  ctx.globalAlpha = 0.8;
  ctx.strokeStyle = colors.white;
  ctx.lineWidth = 2;
  for (let i = 0; i < 2; i++) {
    const x = PAD + rng() * (w - 2 * PAD);
    const y = PAD + rng() * (h - 2 * PAD);
    ctx.beginPath();
    ctx.moveTo(x - 12, y); ctx.lineTo(x + 12, y);
    ctx.moveTo(x, y - 12); ctx.lineTo(x, y + 12);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.needsUpdate = true;
  return { tex, w, h };
};

const drawVariant = (lines: CodeLine[], colors: Record<string, string>): Variant => {
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = `400 ${FONT_PX}px "${MONO}"`;
  let maxW = 0;
  for (const ln of lines) maxW = Math.max(maxW, probe.measureText(ln.map((t) => t.text).join("")).width);
  const w = Math.ceil(maxW + PAD * 2);
  const h = Math.ceil(lines.length * LINE_PX + PAD * 2);
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.font = probe.font;
  ctx.textBaseline = "middle";
  lines.forEach((ln, i) => {
    let x = PAD;
    const y = PAD + (i + 0.5) * LINE_PX;
    for (const t of ln) {
      ctx.fillStyle = colors[t.color];
      ctx.fillText(t.text, x, y);
      x += ctx.measureText(t.text).width;
    }
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return { tex, w, h };
};

const cache = new Map<string, Promise<Variant[]>>();
const variants = (p: CodePanelsParams) => {
  const key = JSON.stringify(p);
  if (!cache.has(key)) {
    cache.set(
      key,
      fontsReady().then(() => {
        const colors = { white: p.white, green: p.green, orange: p.orange, dim: "#9AA89E" };
        const out: Variant[] = [];
        for (let v = 0; v < N_VARIANTS; v++) out.push(drawVariant(codeBlock(1000 + v * 77, 5, 15), colors));
        for (let v = 0; v < N_DECOR_VARIANTS; v++) out.push(drawDecor(4000 + v * 13, colors));
        return out;
      }),
    );
  }
  return cache.get(key)!;
};

// Layout — generated once from a fixed seed.
type Card = { variant: number; x: number; y: number; d: number; scale: number; gain: number };
const LAYOUT: Card[] = (() => {
  const rng = mulberry32(0xc0de);
  const cards: Card[] = [];
  for (let i = 0; i < N_PANELS + N_DECOR; i++) {
    const decor = i >= N_PANELS;
    cards.push({
      variant: decor ? N_VARIANTS + (i % N_DECOR_VARIANTS) : i % N_VARIANTS,
      x: range(rng, -13, 9.5),
      y: range(rng, -7.2, 7.2),
      d: decor ? rng() * L : ((i + range(rng, 0.1, 0.9)) / N_PANELS) * L,
      scale: range(rng, 0.75, 1.25),
      gain: range(rng, 0.75, 1.25),
    });
  }
  return cards;
})();

const CARD_VERT = /* glsl */ `
out vec2 vUv;
out float vDist;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const CARD_FRAG = /* glsl */ `
in vec2 vUv;
in float vDist;
uniform sampler2D map;
uniform vec2 texPx;
uniform float uAlpha;
uniform float uGain;
uniform float uCocPx;  // CoC scale in output pixels
uniform float uFocus;
${DOF_SAMPLE}
void main() {
  float coc = min(uCocPx * abs(1.0 - uFocus / vDist), uCocPx * 1.6);
  vec2 uvPerPx = vec2(abs(dFdx(vUv.x)) + abs(dFdy(vUv.x)), abs(dFdx(vUv.y)) + abs(dFdy(vUv.y)));
  vec4 t = dofSample(map, vUv, coc * uvPerPx, texPx);
  // defocused / distant layers go dimmer and teal
  float k = coc / max(uCocPx, 1e-3);
  vec3 c = mix(t.rgb, vec3(dot(t.rgb, vec3(0.3, 0.5, 0.2))) * vec3(0.25, 0.85, 1.0), clamp(k * 1.4, 0.0, 0.85));
  float dim = 1.0 / (1.0 + 30.0 * k * k + 4.0 * k) * exp(-max(vDist - 12.0, 0.0) / 6.0);
  gl_FragColor = vec4(c * uGain * uAlpha * dim, 1.0);
}
`;

class CodeLook {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 100);
  post: Post;
  cards: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; card: Card }[] = [];
  constructor(p: CodePanelsParams, vars: Variant[]) {
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(0, 0, -1);
    const worldPerPx = 0.33 / LINE_PX;
    for (const card of LAYOUT) {
      const v = vars[card.variant];
      const geo = new THREE.PlaneGeometry(v.w * worldPerPx * card.scale, v.h * worldPerPx * card.scale);
      const mat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: CARD_VERT,
        fragmentShader: frag(CARD_FRAG),
        uniforms: {
          map: { value: v.tex },
          texPx: { value: new THREE.Vector2(v.w, v.h) },
          uAlpha: { value: 1 },
          uGain: { value: card.gain * 1.1 },
          uCocPx: { value: 24 },
          uFocus: { value: FOCUS },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      this.scene.add(mesh);
      this.cards.push({ mesh, mat, card });
    }
    const flare = new THREE.Color(p.flare);
    this.post = new Post({
      loopLength: LOOP,
      msaa: 0,
      bloom: { threshold: 0.22, knee: 0.2, levels: 6, radius: 1.0 },
      grain: 0.015,
      grainDarkFade: true,
      blueNoise: false,
      uniforms: { uFlareCol: { value: flare }, uFlicker: { value: 1 } },
      grade: /* glsl */ `
uniform vec3 uFlareCol;
uniform float uFlicker;
vec3 grade(vec3 hdr, vec3 bl, vec2 uv) {
  vec3 c = hdr + bl * 0.42;
  // faint cyan haze, upper centre/right, and a vignette to black
  vec2 h = (uv - vec2(0.62, 0.62)) * vec2(uAspect, 1.0);
  c += vec3(0.0, 0.006, 0.010) * exp(-dot(h, h) / 0.35) + vec3(0.0006, 0.0022, 0.0035);
  vec2 vg = (uv - 0.5) * vec2(uAspect, 1.0);
  c *= 1.0 - 0.45 * dot(vg, vg);
  // lens flare at the left edge (x 0, y 45% from the top)
  vec2 q = (uv - vec2(0.0, 0.55)) * vec2(uAspect, 1.0);
  float r = length(q);
  float core = exp(-r * r / (2.0 * 0.022 * 0.022));
  float glow = exp(-r * r / (2.0 * 0.07 * 0.07)) * 0.55 + exp(-r / 0.18) * 0.14;
  float streak = exp(-q.y * q.y / (2.0 * 0.0035 * 0.0035)) * exp(-abs(q.x) / 0.22);
  float streak2 = exp(-q.y * q.y / (2.0 * 0.016 * 0.016)) * exp(-abs(q.x) / 0.10) * 0.30;
  vec3 f = vec3(1.0, 0.96, 0.90) * (core * 3.0 + streak * 0.6) + uFlareCol * (glow + streak * 1.2 + streak2);
  c += f * uFlicker;
  return c / (1.0 + max(c - 1.0, 0.0) * 0.5);
}`,
    });
  }
  update = (frame: number) => {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const shift = (L * f) / LOOP;
    for (const { mesh, mat, card } of this.cards) {
      const dist = NEAR + ((((card.d - shift) % L) + L) % L);
      mesh.position.set(card.x, card.y, -dist);
      const fadeIn = 1 - THREE.MathUtils.smoothstep(dist, NEAR + L - 9, NEAR + L);
      const fadeOut = THREE.MathUtils.smoothstep(dist, NEAR + 0.4, NEAR + 4.5);
      mat.uniforms.uAlpha.value = fadeIn * fadeOut;
    }
    const th = (2 * Math.PI * f) / LOOP;
    this.post.uniforms.uFlicker.value = 1 + 0.06 * Math.sin(th * 7) + 0.04 * Math.sin(th * 19 + 1.3) + 0.03 * Math.sin(th * 31 + 0.4);
  };
  render = (gl: THREE.WebGLRenderer, frame: number) => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    const cocPx = 16 * (size.y / 720);
    for (const { mat } of this.cards) mat.uniforms.uCocPx.value = cocPx;
    this.camera.aspect = size.x / size.y;
    this.camera.updateProjectionMatrix();
    this.post.render(gl, this.scene, this.camera, frame);
  };
}

const Inner: React.FC<CodePanelsParams> = (p) => {
  const vars = useAsset(variants(p));
  const key = JSON.stringify(p);
  const look = useMemo(() => new CodeLook(p, vars), [key, vars]); // eslint-disable-line react-hooks/exhaustive-deps
  useDrive(look);
  return null;
};

export const CodePanels: React.FC<CodePanelsParams> = (p) => (
  <Stage>
    <Inner {...p} />
  </Stage>
);

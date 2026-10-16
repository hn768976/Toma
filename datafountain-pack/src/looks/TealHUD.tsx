import React, { useMemo } from "react";
import * as THREE from "three";
import { fontsReady } from "../lib/fonts";
import { DOF_SAMPLE, SIMPLEX, frag } from "../lib/glsl";
import { Post, makeFullscreenMesh } from "../lib/post";
import { mulberry32, range } from "../lib/random";
import { Stage, useAsset, useDrive } from "../lib/Stage";
import { drawWidget, KINDS, type HudColors, type WidgetKind } from "./hudWidgets";

/**
 * Look 4 — Teal HUD. A large tilted dashboard plane (grid + connector
 * curves) carrying ~60 widget cards drawn with Canvas 2D. Each widget's
 * values tick every P frames with P | 600, so its texture is a pure function
 * of floor(f/P) mod (600/P). Per-pixel depth of field (narrow sharp band),
 * bloom, a drifting mist layer, and a closed camera drift.
 */
export type TealHudParams = {
  ink: string; // widget lines/text
  accent: string; // yellow-green accents & connectors
  bgDark: string;
  bgLight: string;
  mist: string;
};

const LOOP = 600;
const COLS = 12;
const ROWS = 7;
const PLANE_W = 40;
const PLANE_H = 22;
const W_PX = 512;
const H_PX = 384;
const W_PAD = 44; // transparent margin so blur can spill
const TILT = -0.1; // plane pitched back (radians)
const PERIODS = [15, 20, 24, 30, 40, 50, 60];

type WidgetDef = {
  kind: WidgetKind;
  seed: number;
  x: number;
  y: number;
  z: number;
  size: number;
  period: number;
  fadeK: number;
  fadePhase: number;
  fadeDepth: number;
};

const GRID_KINDS = KINDS.filter((k) => k !== "wave" && k !== "bell");

const LAYOUT: WidgetDef[] = (() => {
  const rng = mulberry32(0x7ea1);
  const out: WidgetDef[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      out.push({
        kind: GRID_KINDS[Math.floor(rng() * GRID_KINDS.length)],
        seed: 500 + r * COLS + c,
        x: ((c + 0.5) / COLS - 0.5) * PLANE_W + range(rng, -0.7, 0.7),
        y: ((r + 0.5) / ROWS - 0.5) * PLANE_H + range(rng, -0.5, 0.5),
        z: range(rng, 0.05, 1.4),
        size: rng() < 0.14 ? range(rng, 3.4, 5.0) : range(rng, 1.1, 2.2),
        period: PERIODS[Math.floor(rng() * PERIODS.length)],
        fadeK: rng() < 0.6 ? 1 : 2,
        fadePhase: rng() * Math.PI * 2,
        fadeDepth: rng() < 0.25 ? 0 : range(rng, 0.6, 0.95),
      });
    }
  // hero widgets: big pale column charts, gauge clusters and tile rows,
  // spread so the drifting camera always has one in view
  const HERO: [WidgetKind, number, number, number][] = [
    ["columns", 4.5, 1.6, 6.5], ["columns", -7.0, -2.2, 5.5], ["columns", -13.0, 3.0, 5.5], ["columns", 13.5, -2.5, 6.0],
    ["gauges", -4.0, 3.2, 3.0], ["gauges", 9.0, 3.6, 3.0], ["bars", -2.0, -3.6, 3.4], ["bars", 9.5, -4.0, 3.0],
  ];
  HERO.forEach(([kind, x, y, size], i) =>
    out.push({ kind, seed: 900 + i, x, y, z: 1.7, size, period: 30, fadeK: 1, fadePhase: i * 1.3, fadeDepth: 0.3 }),
  );
  // draw far (low z) first: fixed order → deterministic blending
  return out.sort((a, b) => a.z - b.z);
})();

const makeCanvasTex = (c: HTMLCanvasElement) => {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.premultiplyAlpha = true;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  return tex;
};

/** Base plane: fine grid + connector curves between widget anchors (static). */
const drawBase = (col: HudColors) => {
  const W = 4096;
  const H = Math.round((W * PLANE_H) / PLANE_W);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const rgba = (hex: string, a: number) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const cell = W / 32;
  ctx.lineWidth = 2;
  for (let x = 0; x <= W; x += cell) {
    ctx.strokeStyle = rgba(col.ink, 0.3);
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += cell) {
    ctx.strokeStyle = rgba(col.ink, 0.3);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  const toPx = (x: number, y: number): [number, number] => [((x / PLANE_W) + 0.5) * W, (0.5 - y / PLANE_H) * H];
  const rng = mulberry32(0x11ac);
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 18; i++) {
    const a = LAYOUT[Math.floor(rng() * LAYOUT.length)];
    const b = LAYOUT[Math.floor(rng() * LAYOUT.length)];
    if (a === b) continue;
    const [ax, ay] = toPx(a.x, a.y);
    const [bx, by] = toPx(b.x, b.y);
    ctx.strokeStyle = rgba(col.accent, range(rng, 0.18, 0.4));
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    const mx = (ax + bx) / 2;
    ctx.bezierCurveTo(mx + range(rng, -400, 400), ay, mx + range(rng, -400, 400), by, bx, by);
    ctx.stroke();
    ctx.fillStyle = rgba(col.accent, 0.95);
    for (const [px, py] of [[ax, ay], [bx, by]]) {
      ctx.beginPath(); ctx.arc(px, py, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  // long straight light rails across the whole board
  ctx.lineWidth = 4;
  for (let i = 0; i < 7; i++) {
    const y = Math.round((0.08 + 0.84 * rng()) * H);
    ctx.strokeStyle = rgba(col.ink, range(rng, 0.45, 0.8));
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  for (let i = 0; i < 9; i++) {
    const x = Math.round((0.04 + 0.92 * rng()) * W);
    ctx.strokeStyle = rgba(col.ink, range(rng, 0.35, 0.7));
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  // fine white specks
  ctx.fillStyle = rgba(col.ink, 0.9);
  for (let i = 0; i < 260; i++) {
    ctx.beginPath(); ctx.arc(rng() * W, rng() * H, range(rng, 1.5, 3.5), 0, Math.PI * 2); ctx.fill();
  }
  // thin straight leader lines
  ctx.lineWidth = 2;
  for (let i = 0; i < 40; i++) {
    const a = LAYOUT[Math.floor(rng() * LAYOUT.length)];
    const [ax, ay] = toPx(a.x, a.y);
    ctx.strokeStyle = rgba(col.ink, 0.35);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + range(rng, -700, 700), ay + range(rng, -60, 60)); ctx.stroke();
  }
  return makeCanvasTex(c);
};

const DOF_VERT = /* glsl */ `
out vec2 vUv;
out float vDist;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDist = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const DOF_FRAG = /* glsl */ `
in vec2 vUv;
in float vDist;
uniform sampler2D map;
uniform vec2 texPx;
uniform float uAlpha;
uniform float uCocPx;
uniform float uFocus;
${DOF_SAMPLE}
void main() {
  float coc = 0.04 * uCocPx + min(uCocPx * abs(1.0 - uFocus / vDist) * 0.9, uCocPx * 0.6);
  vec2 uvPerPx = vec2(abs(dFdx(vUv.x)) + abs(dFdy(vUv.x)), abs(dFdx(vUv.y)) + abs(dFdy(vUv.y)));
  vec4 t = dofSample(map, vUv, coc * uvPerPx, texPx);
  gl_FragColor = vec4(t.rgb * vec3(0.86, 0.97, 1.0), t.a) * uAlpha * 0.78;  // premultiplied, cyan-tinted
}
`;

const BG_FRAG = /* glsl */ `
uniform vec2 uRes;
uniform vec3 uDark;
uniform vec3 uLight;
uniform vec2 uGlow;
void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  vec2 d = (uv - uGlow) * vec2(uRes.x / uRes.y, 1.0);
  float g = exp(-dot(d, d) / 0.7);
  // strong diagonal: deep steel-blue bottom-left → pale haze top-right
  float diag = clamp(dot(uv - vec2(0.0, 0.0), normalize(vec2(1.0, 0.9))) / 1.35, 0.0, 1.0);
  vec3 deep = uDark * vec3(0.42, 0.56, 0.68);
  vec3 c = mix(deep, uDark, smoothstep(0.0, 0.45, diag));
  c = mix(c, uLight, smoothstep(0.3, 1.0, diag) * 0.5 + 0.25 * g);
  c = mix(c, vec3(dot(c, vec3(0.3, 0.55, 0.15))), 0.0);
  gl_FragColor = vec4(c, 1.0);
}
`;

type Assets = { base: THREE.CanvasTexture; widgets: { canvas: HTMLCanvasElement; tex: THREE.CanvasTexture }[] };

const cache = new Map<string, Promise<Assets>>();
const assets = (p: TealHudParams) => {
  const key = JSON.stringify(p);
  if (!cache.has(key)) {
    cache.set(
      key,
      fontsReady().then(() => {
        const col = { ink: p.ink, accent: p.accent };
        const widgets = LAYOUT.map(() => {
          const canvas = document.createElement("canvas");
          canvas.width = W_PX;
          canvas.height = H_PX;
          return { canvas, tex: makeCanvasTex(canvas) };
        });
        return { base: drawBase(col), widgets };
      }),
    );
  }
  return cache.get(key)!;
};

class HudLook {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.1, 200);
  post: Post;
  board = new THREE.Group();
  bg: THREE.ShaderMaterial;
  baseMat: THREE.ShaderMaterial;
  items: { def: WidgetDef; mat: THREE.ShaderMaterial; canvas: HTMLCanvasElement; tex: THREE.CanvasTexture; drawnTick: number }[] = [];
  constructor(private p: TealHudParams, a: Assets) {
    this.bg = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `void main() { gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
      fragmentShader: frag(BG_FRAG),
      uniforms: {
        uRes: { value: new THREE.Vector2(1, 1) },
        uDark: { value: new THREE.Color(p.bgDark) },
        uLight: { value: new THREE.Color(p.bgLight) },
        uGlow: { value: new THREE.Vector2(0.6, 0.6) },
      },
      depthTest: false,
      depthWrite: false,
    });
    const bgMesh = makeFullscreenMesh(this.bg);
    bgMesh.renderOrder = -10;
    this.scene.add(bgMesh);

    const mkMat = (tex: THREE.Texture, w: number, h: number) =>
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: DOF_VERT,
        fragmentShader: frag(DOF_FRAG),
        uniforms: {
          map: { value: tex },
          texPx: { value: new THREE.Vector2(w, h) },
          uAlpha: { value: 1 },
          uCocPx: { value: 30 },
          uFocus: { value: 14 },
        },
        transparent: true,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        depthTest: false,
        depthWrite: false,
      });
    this.baseMat = mkMat(a.base, a.base.image.width, a.base.image.height);
    this.baseMat.uniforms.uAlpha.value = 0.85;
    const baseMesh = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_W, PLANE_H), this.baseMat);
    baseMesh.renderOrder = 0;
    this.board.add(baseMesh);
    LAYOUT.forEach((def, i) => {
      const { canvas, tex } = a.widgets[i];
      const mat = mkMat(tex, W_PX, H_PX);
      const h = def.size * (H_PX / W_PX);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(def.size, h), mat);
      mesh.position.set(def.x, def.y, def.z);
      mesh.renderOrder = 1 + i;
      mesh.frustumCulled = false;
      this.board.add(mesh);
      this.items.push({ def, mat, canvas, tex, drawnTick: -1 });
    });
    this.board.rotation.x = TILT;
    this.scene.add(this.board);

    this.post = new Post({
      loopLength: LOOP,
      msaa: 0,
      bloom: { threshold: 0.38, knee: 0.35, levels: 6, radius: 1.3 },
      grain: 0.015,
      blueNoise: true,
      uniforms: {
        uMist: { value: new THREE.Color(p.mist) },
        uCT: { value: new THREE.Vector2(1, 0) },
        uLightPos: { value: new THREE.Vector2(0.7, 0.75) },
      },
      grade: /* glsl */ `
uniform vec3 uMist;
uniform vec2 uCT;
uniform vec2 uLightPos;
${SIMPLEX}
vec3 grade(vec3 hdr, vec3 bl, vec2 uv) {
  vec3 c = hdr + bl * 0.75;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);
  // drifting mist (4D noise on the loop circle)
  float m1 = snoise4(vec4(p * 1.1, uCT * 0.45));
  float m2 = snoise4(vec4(p * 2.3 + 4.0, uCT * 0.6 + 2.0));
  float mist = clamp(0.38 + 0.30 * m1 + 0.12 * m2, 0.0, 1.0);
  float upper = smoothstep(0.1, 1.2, uv.x * 0.6 + uv.y * 0.7);
  c = mix(c, uMist, mist * 0.22 * upper);
  // light blooming through the mist
  vec2 dl = (uv - uLightPos) * vec2(uAspect, 1.0);
  c += uMist * exp(-dot(dl, dl) / 0.22) * 0.16 * (0.6 + 0.4 * mist);
  // deep corner at the bottom left
  c *= mix(0.42, 1.0, smoothstep(0.0, 1.0, uv.x * 0.55 + uv.y * 0.85));
  return c / (1.0 + max(c - 0.7, 0.0) * 1.4);
}`,
    });
  }
  update = (frame: number) => {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const th = (2 * Math.PI * f) / LOOP;
    // closed drift across the board (figure-eight), slight roll
    const cx = 8.5 * Math.sin(th);
    const cy = 2.6 * Math.sin(2 * th);
    this.camera.position.set(cx, cy - 1.5, 14.0);
    this.camera.up.set(Math.sin(0.05 * Math.sin(th + 0.7)), Math.cos(0.05 * Math.sin(th + 0.7)), 0);
    this.camera.lookAt(cx + 1.2 * Math.sin(th + 1.1), cy + 0.6, 0);
    this.camera.updateMatrixWorld();
    // focus: distance to the board at the screen centre
    const ray = new THREE.Ray(this.camera.position.clone(), new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion));
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(1, 0, 0), TILT), 0);
    const hit = ray.intersectPlane(plane, new THREE.Vector3());
    const focus = hit ? hit.distanceTo(this.camera.position) * 0.97 : 14;
    this.baseMat.uniforms.uFocus.value = focus;
    for (const it of this.items) {
      const { def } = it;
      const tick = Math.floor(f / def.period) % (LOOP / def.period);
      if (tick !== it.drawnTick) {
        const ctx = it.canvas.getContext("2d")!;
        ctx.clearRect(0, 0, W_PX, H_PX);
        ctx.save();
        ctx.translate(W_PAD, W_PAD);
        drawWidget(ctx, def.kind, W_PX - 2 * W_PAD, H_PX - 2 * W_PAD, def.seed, tick, { ink: this.p.ink, accent: this.p.accent });
        ctx.restore();
        it.tex.needsUpdate = true;
        it.drawnTick = tick;
      }
      const wave = 0.5 + 0.5 * Math.sin(def.fadeK * th + def.fadePhase);
      const vis = THREE.MathUtils.smoothstep(wave, 0.25, 0.7);
      it.mat.uniforms.uAlpha.value = 1 - def.fadeDepth * (1 - vis);
      it.mat.uniforms.uFocus.value = focus;
    }
    (this.bg.uniforms.uGlow.value as THREE.Vector2).set(0.85 - 0.06 * Math.sin(th), 0.85 + 0.04 * Math.sin(2 * th));
    (this.post.uniforms.uCT.value as THREE.Vector2).set(Math.cos(th), Math.sin(th));
    (this.post.uniforms.uLightPos.value as THREE.Vector2).set(0.86 - 0.08 * Math.sin(th), 0.9 - 0.05 * Math.cos(th));
  };
  render = (gl: THREE.WebGLRenderer, frame: number) => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    const cocPx = 30 * (size.y / 720);
    this.baseMat.uniforms.uCocPx.value = cocPx;
    for (const it of this.items) it.mat.uniforms.uCocPx.value = cocPx;
    (this.bg.uniforms.uRes.value as THREE.Vector2).copy(size);
    this.camera.aspect = size.x / size.y;
    this.camera.updateProjectionMatrix();
    this.post.render(gl, this.scene, this.camera, frame);
  };
}

const Inner: React.FC<TealHudParams> = (p) => {
  const a = useAsset(assets(p));
  const key = JSON.stringify(p);
  const look = useMemo(() => new HudLook(p, a), [key, a]); // eslint-disable-line react-hooks/exhaustive-deps
  useDrive(look);
  return null;
};

export const TealHUD: React.FC<TealHudParams> = (p) => (
  <Stage>
    <Inner {...p} />
  </Stage>
);

import * as THREE from "three";
import { FONT_INTER } from "../../lib/assets";
import { GlyphAtlas, SpriteLayer, RGBA } from "../../lib/glyphs";
import { GlowLine, planeNormalsXY } from "../../lib/lines";
import { mod, mulberry32, TAU } from "../../lib/random";
import type { LookFactory } from "../../lib/Stage";

export type TickerVersion = {
  id: string;
  bg: string;
  tileDark: string;
  tileBright: string;
  line: string;
  lineAlt: string;
  haze: string; // horizon haze / fog colour
  hazeGain: number; // brightness of the horizon glow
  beam: string; // light beam colour
  label: string; // floating chart labels
  bar: string; // faint bars behind the lines
  gap: string; // floor colour between tiles
  pUp: number; // share of ▲ cells (kind < pUp)
  pSigned: number; // share of ▲ + ▼ cells (the rest show a plain value)
  markerUp: string; // ▲ marker colour on the floor
  markerDown: string; // ▼ marker colour on the floor
  waveAmp: number; // scale of the wave shapes (1 = default)
  trend: number; // downward drift of the chart lines across the frame (world units, 0 = flat)
  seed: number;
};

const LOOP = 600;
const ROWS = 16; // rows in the floor texture (texture repeats in v)
const ROWS_PER_LOOP = 4; // whole rows scrolled per loop
const ROW_DEPTH = 1.5; // world units per row
const TEX_W_WORLD = 30; // world width of one texture repeat

const UP = "", DOWN = "";

function triUp(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(w * 0.5, h * 0.22);
  ctx.lineTo(w * 0.9, h * 0.78);
  ctx.lineTo(w * 0.1, h * 0.78);
  ctx.closePath();
  ctx.fill();
}
function triDown(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(w * 0.1, h * 0.22);
  ctx.lineTo(w * 0.9, h * 0.22);
  ctx.lineTo(w * 0.5, h * 0.78);
  ctx.closePath();
  ctx.fill();
}

const VALUES = ["28.90", "95.31", "13.59", "49.65", "97.58", "22.38", "67.08", "37.17", "81.24", "56.42", "12.77", "73.06"];

function buildFloorTexture(v: TickerVersion, rng: () => number) {
  const W = 4096, H = 4096, RH = H / ROWS;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  const dark = new THREE.Color(v.tileDark), bright = new THREE.Color(v.tileBright);
  g.fillStyle = v.gap;
  g.fillRect(0, 0, W, H);
  const font = `700 ${Math.round(RH * 0.3)}px ${FONT_INTER}`;
  for (let r = 0; r < ROWS; r++) {
    const y = r * RH;
    const rowBoost = rng() < 0.25 ? 1.35 : 1;
    // cells across the row, exactly filling W so the texture wraps seamlessly
    const widths: number[] = [];
    let total = 0;
    while (total < W - 300) {
      const w = [430, 520, 610, 700][Math.floor(rng() * 4)];
      widths.push(w);
      total += w;
    }
    const scale = W / total;
    let x = -Math.floor(rng() * 400);
    for (const w0 of widths) {
      const w = w0 * scale;
      const t = Math.pow(rng(), 1.6) * rowBoost;
      const col = dark.clone().lerp(bright, Math.min(1, t));
      const kind = rng();
      const val = VALUES[Math.floor(rng() * VALUES.length)];
      for (const shift of [0, W]) {
      g.save();
      g.translate(shift, 0);
      const css = (cc: THREE.Color, m = 1) => `rgb(${Math.round(Math.min(1, cc.r * m) * 255)},${Math.round(Math.min(1, cc.g * m) * 255)},${Math.round(Math.min(1, cc.b * m) * 255)})`;
      // tile with soft vertical gradient (colour stays in sRGB canvas space)
      const grd = g.createLinearGradient(0, y, 0, y + RH);
      grd.addColorStop(0, css(col.clone().convertLinearToSRGB(), 1.12));
      grd.addColorStop(1, css(col.clone().convertLinearToSRGB(), 0.82));
      g.fillStyle = grd;
      g.fillRect(x + 6, y + 8, w - 12, RH - 16);
      // text: ▲ + 28.90 %  /  97.58 %  /  ▼ − 13.59 %
      g.save();
      g.translate(0, y + RH * 0.5);
      g.scale(1, 1.9); // pre-stretch: the floor is seen at a grazing angle
      // shrink the text if it would not fit the tile
      const str = kind < v.pSigned ? `${kind < v.pUp ? "+" : "\u2212"} ${val} %` : `${val} %`;
      g.font = font;
      const need = g.measureText(str).width + (kind < v.pSigned ? RH * 0.3 : 0);
      const fit = Math.min(1, (w * 0.82) / need);
      const fs = RH * 0.3 * fit;
      g.font = `700 ${Math.round(fs)}px ${FONT_INTER}`;
      g.fillStyle = "rgba(255,255,255,0.96)";
      g.textBaseline = "middle";
      let tx = x + w * 0.1;
      if (kind < v.pSigned) {
        const up = kind < v.pUp;
        g.fillStyle = up ? v.markerUp : v.markerDown;
        g.beginPath();
        if (up) {
          g.moveTo(tx, fs * 0.32);
          g.lineTo(tx + fs * 0.7, fs * 0.32);
          g.lineTo(tx + fs * 0.35, -fs * 0.3);
        } else {
          g.moveTo(tx, -fs * 0.3);
          g.lineTo(tx + fs * 0.7, -fs * 0.3);
          g.lineTo(tx + fs * 0.35, fs * 0.32);
        }
        g.closePath();
        g.fill();
        g.fillStyle = "rgba(255,255,255,0.96)";
        tx += fs * 1.0;
        g.fillText(str, tx, 0);
      } else {
        g.fillText(str, tx + w * 0.08, 0);
      }
      g.restore();
      g.restore();
      }
      x += w;
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 16;
  t.needsUpdate = true;
  return t;
}

export const makeTickerLook = (v: TickerVersion): LookFactory => (ctx) => {
  const rng = mulberry32(v.seed);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, ctx.width / ctx.height, 0.1, 500);
  const haze = new THREE.Color(v.haze);
  const bgc = new THREE.Color(v.bg);

  // ---- background: dark top, blue haze glow at the horizon
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(900, 300),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: /* glsl */ `
      precision highp float; uniform vec3 uBg; uniform vec3 uHaze; uniform float uHorizonV; uniform float uHazeGain;
      in vec2 vUv; out vec4 o;
      void main(){
        float dv = vUv.y - uHorizonV;
        float g = exp(-max(dv, 0.0) * 9.0) * (0.55 + 0.45 * exp(-pow((vUv.x - 0.5) * 7.0, 2.0)));
        o = vec4(uBg + uHaze * g * uHazeGain, 1.0);
      }`,
      uniforms: { uBg: { value: bgc }, uHaze: { value: haze }, uHorizonV: { value: 0.5 }, uHazeGain: { value: v.hazeGain } },
    }),
  );
  bg.position.set(0, 0, -300);
  scene.add(bg);

  // ---- floor of ticker rows
  const floorTex = buildFloorTexture(v, rng);
  const floorMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: /* glsl */ `
    out vec2 vW; out float vDist;
    void main(){ vec4 wp = modelMatrix*vec4(position,1.0); vW = wp.xz; vec4 mv = viewMatrix*wp; vDist = -mv.z; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tMap; uniform float uScroll; uniform vec3 uHaze; uniform float uFogNear; uniform float uFogFar;
    in vec2 vW; in float vDist; out vec4 o;
    void main(){
      vec2 uv = vec2(vW.x / ${TEX_W_WORLD.toFixed(1)}, (-vW.y) / ${(ROW_DEPTH * ROWS).toFixed(2)} + uScroll);
      // texture v grows into the distance; rows scroll toward the camera
      vec3 c = texture(tMap, uv).rgb;
      // central light from the beams reflected on the floor
      float centre = exp(-pow(vW.x / 9.0, 2.0));
      c *= 0.75 + 0.9 * centre * smoothstep(5.0, 40.0, vDist);
      float fog = smoothstep(uFogNear, uFogFar, vDist);
      c = mix(c, uHaze * 0.55, fog);
      o = vec4(c, 1.0);
    }`,
    uniforms: { tMap: { value: floorTex }, uScroll: { value: 0 }, uHaze: { value: haze }, uFogNear: { value: 18 }, uFogFar: { value: 120 } },
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -195);
  scene.add(floor);

  // ---- glowing wavy lines
  const N = 1400;
  type Wave = { amp: number; k: number; m: number; ph: number };
  type Line = { z: number; y0: number; waves: Wave[]; color: THREE.Color; gl: GlowLine; hw: number };
  const lineCols = [v.line, v.lineAlt, v.line, v.lineAlt];
  const lines: Line[] = [];
  const XR = 46;
  for (let i = 0; i < 4; i++) {
    const waves: Wave[] = [];
    const base = [
      [2.2, 2],
      [1.3, 5],
      [0.6, 11],
      [0.3, 23],
      [0.12, 47],
    ];
    for (const [a, k] of base) waves.push({ amp: a * (0.7 + rng() * 0.6), k: k + Math.floor(rng() * 2), m: (rng() < 0.5 ? -1 : 1) * (1 + Math.floor(rng() * 2)), ph: rng() * TAU });
    const gl = new GlowLine(N, { core: 0.07, glow: 0.35, glowAmt: 0.05 });
    scene.add(gl.mesh);
    lines.push({ z: -22 - i * 3.5, y0: 7.0 + (rng() - 0.5) * 1.4, waves, color: new THREE.Color(lineCols[i]), gl, hw: 0.4 });
  }
  const pts = new Float32Array(N * 3), nrm = new Float32Array(N * 3), cols = new Float32Array(N * 3);

  // ---- labels + faint bars behind the lines
  const atlas = new GlyphAtlas({ font: `700 96px ${FONT_INTER}`, fontPx: 96, chars: "0123456789.%+− ", cellW: 96, cellH: 128, icons: { [UP]: triUp, [DOWN]: triDown } });
  const sprites = new SpriteLayer(atlas, 20000, { billboard: false, depthWrite: true, right: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0) });
  scene.add(sprites.mesh);
  type Label = { x: number; y: number; z: number; s: number; kind: number; val: string; a: number; m: number; ph: number };
  const labels: Label[] = [];
  for (let i = 0; i < 46; i++) {
    labels.push({ x: (rng() - 0.5) * 70, y: 3.6 + rng() * 8.5, z: -18 - rng() * 22, s: 0.4 + rng() * 0.55, kind: rng(), val: VALUES[Math.floor(rng() * VALUES.length)], a: 0.35 + rng() * 0.65, m: 1 + Math.floor(rng() * 2), ph: rng() });
  }
  type Bar = { x: number; z: number; h: number; m: number; ph: number };
  const bars: Bar[] = [];
  for (let i = 0; i < 160; i++) bars.push({ x: (rng() - 0.5) * 110, z: -40 - rng() * 25, h: 1 + rng() * 6, m: 1 + Math.floor(rng() * 3), ph: rng() });

  // ---- light beams at the horizon
  const beamMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
    precision highp float; uniform vec3 uC; uniform float uA;
    in vec2 vUv; out vec4 o;
    void main(){
      float x = (vUv.x - 0.5) * 2.0;
      float prof = exp(-x * x * 5.0) * 0.6 + exp(-x * x * 40.0) * 0.6;
      float vert = smoothstep(0.0, 0.08, vUv.y) * pow(1.0 - vUv.y, 1.4);
      o = vec4(uC * prof * vert * uA, 1.0);
    }`,
    uniforms: { uC: { value: new THREE.Color(v.beam) }, uA: { value: 1 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  type Beam = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; a: number; m: number; ph: number };
  const beams: Beam[] = [];
  const beamXs = [0, -24, 19, -46, 40, -9];
  beamXs.forEach((bx, i) => {
    const mat = beamMat.clone();
    const w = i === 0 ? 12 : 5 + rng() * 5;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, 40), mat);
    mesh.position.set(bx, 19.5, -60 - rng() * 20);
    scene.add(mesh);
    beams.push({ mesh, mat, a: i === 0 ? 0.55 : 0.18 + rng() * 0.2, m: 1 + Math.floor(rng() * 2), ph: rng() });
  });

  const labelCol = new THREE.Color(v.label);
  const barCol = new THREE.Color(v.bar);

  return {
    scene,
    camera,
    grainFrame: (f) => f % LOOP,
    update(frame) {
      const f = mod(frame, LOOP);
      const ph = f / LOOP;

      camera.position.set(Math.sin(TAU * ph) * 0.6, 3.4 + Math.sin(TAU * ph * 2) * 0.08, 6);
      camera.rotation.set(-0.05, Math.sin(TAU * ph) * 0.012, 0);
      camera.updateMatrixWorld();

      floorMat.uniforms.uScroll.value = (ROWS_PER_LOOP / ROWS) * ph;

      // lines
      for (const L of lines) {
        for (let i = 0; i < N; i++) {
          const u = i / (N - 1);
          const x = -XR + 2 * XR * u;
          let y = L.y0 - v.trend * (x / XR); // gentle downward trend (static in time, so it loops)
          for (const w of L.waves) y += v.waveAmp * w.amp * Math.sin(TAU * (w.k * u) + w.ph + TAU * w.m * ph);
          pts[i * 3] = x;
          pts[i * 3 + 1] = y;
          pts[i * 3 + 2] = L.z;
          const b = 1.6;
          cols[i * 3] = L.color.r * b;
          cols[i * 3 + 1] = L.color.g * b;
          cols[i * 3 + 2] = L.color.b * b;
        }
        planeNormalsXY(pts, N, nrm);
        L.gl.set(pts, nrm, L.hw, cols);
      }

      sprites.begin();
      for (const b of bars) {
        const h = b.h * (0.75 + 0.25 * Math.sin(TAU * (b.m * ph + b.ph)));
        const k = 0.22;
        sprites.rect(b.x, 1.5, b.z, 1, [barCol.r * k, barCol.g * k, barCol.b * k, 1], -0.07, 0, 0.14, h + 2);
      }
      for (const l of labels) {
        const yy = l.y + 0.25 * Math.sin(TAU * (l.m * ph + l.ph));
        const k = 1.2 * l.a;
        const c: RGBA = [labelCol.r * k, labelCol.g * k, labelCol.b * k, 1];
        let ox = 0;
        if (l.kind < v.pSigned) {
          sprites.icon(l.kind < v.pUp ? UP : DOWN, l.x, yy, l.z, l.s, c, 0, -0.05, 0.65, 0.85);
          ox = 0.85;
          const sign = l.kind < v.pUp ? "+" : "−";
          sprites.text(`${sign} ${l.val} %`, l.x, yy, l.z, l.s, c, "left", ox, 0);
        } else sprites.text(`${l.val} %`, l.x, yy, l.z, l.s, c, "left", 0, 0);
      }
      sprites.end();

      for (const b of beams) b.mat.uniforms.uA.value = b.a * (0.75 + 0.25 * Math.sin(TAU * (b.m * ph + b.ph)));

      return {
        focusNear: 10,
        focusFar: 48,
        nearBlurAt: 5,
        farBlurAt: 120,
        nearCoc: 0.006,
        farCoc: 0.006,
        bloom: 0.38,
        bloomRadius: 0.6,
        exposure: 1.05,
        vignette: 0.5,
        grain: 0.015,
      };
    },
  };
};

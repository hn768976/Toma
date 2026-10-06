import {
  BufferAttribute,
  BufferGeometry,
  Color,
  CustomBlending,
  DoubleSide,
  Group,
  Mesh,
  OneFactor,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Vector3,
  Vector4,
  WebGLRenderer,
} from "three";
import { FONT } from "../lib/assets";
import { canvasTexture, makeCanvas } from "../lib/canvas";
import { candlesFrom, drawCandles, periodicSeries } from "../lib/charts";
import { easeInOutCubic, easeOutCubic, prog, smoothstep } from "../lib/ease";
import { makeGlobe } from "../lib/globe";
import { LabelSpec, makeAtlas, makeLabels } from "../lib/labels";
import { LookFactory } from "../lib/LookCanvas";
import { attr, makeBackground, makeDots, makeSegments, makeTexPlane } from "../lib/materials";
import { defaultPost } from "../lib/postfx";
import { mulberry32, Rng, SEEDS } from "../lib/rand";
import { GLSL_COMMON } from "../lib/shared";

export interface DollarParams {
  tint: string; // main hue
  bg: string; // background
  highlight: string; // hot core colour (near white, tinted)
  direction: "down" | "up";
}

const DOLLAR_H = 8.6; // world height of the "$"

/** Rasterise "$" (Inter Bold) to a mask; return a sampler in [-0.5,0.5]² glyph space. */
const dollarMask = () => {
  const W = 400;
  const H = 560;
  const { ctx } = makeCanvas(W, H);
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.font = `700 ${H * 0.86}px "${FONT.inter}"`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("$", W / 2, H * 0.5);
  const d = ctx.getImageData(0, 0, W, H).data;
  // bounding box of the glyph
  let x0 = W, x1 = 0, y0 = H, y1 = 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (d[(y * W + x) * 4] > 127) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
  const bw = x1 - x0;
  const bh = y1 - y0;
  const at = (u: number, v: number) => {
    // u,v in glyph-normalised coords: u ∈ [0,1] left→right, v ∈ [0,1] top→bottom
    const x = Math.round(x0 + u * bw);
    const y = Math.round(y0 + v * bh);
    if (x < 0 || y < 0 || x >= W || y >= H) return false;
    return d[(y * W + x) * 4] > 127;
  };
  return { at, aspect: bw / bh };
};

const glowTexture = (gl: WebGLRenderer) => {
  const S = 256;
  const { c, ctx } = makeCanvas(S, S);
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.15, "rgba(255,255,255,0.55)");
  g.addColorStop(0.45, "rgba(255,255,255,0.12)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return canvasTexture(c, gl);
};

const streakTexture = (gl: WebGLRenderer) => {
  const W = 512;
  const H = 64;
  const { c, ctx } = makeCanvas(W, H);
  const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.25)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.save();
  ctx.scale(1, H / W);
  ctx.fillRect(0, 0, W, W);
  ctx.restore();
  return canvasTexture(c, gl);
};

const candleBand = (gl: WebGLRenderer, r: Rng, n: number, tint: string, hi: string, dir: "down" | "up") => {
  const W = 4096;
  const H = 1024;
  const { c, ctx } = makeCanvas(W, H);
  const s = periodicSeries(r, n, { harmonics: 4, noise: 2.0 });
  // add a trend so the band reads as falling / rising
  const tr = s.map((v, i) => v + (dir === "down" ? -1 : 1) * Math.sin((i / n) * Math.PI) * 0.0);
  const cs = candlesFrom(r, tr, 0.35);
  drawCandles(ctx, cs, 0, H * 0.08, W, H * 0.84, {
    up: hi,
    down: tint,
    wick: 3,
    body: 0.55,
    glow: 8,
    color: (i, up) => (up && r() < 0.3 ? hi : tint),
  });
  return canvasTexture(c, gl, { repeat: true });
};

/** Big soft vertical bars for the far background. */
const barsBackdrop = (gl: WebGLRenderer, r: Rng) => {
  const W = 1024;
  const H = 512;
  const { c, ctx } = makeCanvas(W, H);
  ctx.filter = "blur(6px)";
  for (let i = 0; i < 46; i++) {
    const x = (i / 46) * W + r() * 6;
    const h = H * (0.25 + r() * 0.65);
    const y = H * 0.12 + r() * (H * 0.9 - h);
    ctx.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.5})`;
    ctx.fillRect(x, y, W / 46 * 0.55, h);
  }
  return canvasTexture(c, gl);
};

export const dollarGlobe: LookFactory<DollarParams> = ({ gl, assets, shared, params, width, height }) => {
  const opaque = new Scene();
  const overlay = new Scene();
  const camera = new PerspectiveCamera(36, width / height, 0.3, 300);
  const rng = mulberry32(SEEDS.dollarGlobe);
  const tint = new Color(params.tint);
  const hot = new Color(params.highlight);
  const up = params.direction === "up";

  opaque.add(
    makeBackground(
      /* glsl */ `
      col = uBg * (0.7 + 0.8 * smoothstep(0.0, 0.6, vUv.y) * (1.0 - 0.4 * vUv.y));
      col += uTint * 0.05 * exp(-pow(length((vUv - vec2(0.5, 0.25)) * vec2(1.4, 2.2)), 2.0) * 2.0);
      `,
      { uBg: { value: new Color(params.bg) }, uTint: { value: tint } },
      shared,
    ),
  );

  // Fade-in group control
  const fadeables: ShaderMaterial[] = [];
  const reg = (m: Mesh) => {
    fadeables.push(m.material as ShaderMaterial);
    return m;
  };

  // ── Far backdrop: soft vertical bars ─────────────────────────────────────
  const backdrop = makeTexPlane({ map: barsBackdrop(gl, rng), shared, width: 110, height: 50, color: tint.clone().multiplyScalar(0.22) });
  backdrop.position.set(0, 4, -45);
  backdrop.name = "backdrop";
  overlay.add(backdrop);

  // ── Globe ──────────────────────────────────────────────────────────────
  const globe = makeGlobe(assets, shared, {
    radius: 7.0,
    color: tint.clone().lerp(hot, 0.25),
    oceanColor: tint,
    rowStepDeg: 1.4,
    dotStepDeg: 0.9,
    dotSize: 0.065,
    landGain: 1.0,
    oceanGain: 0.07,
    coastGain: 1.1,
    backFace: 0.22,
    rim: tint,
    rimGain: 0.45,
    bodyGain: 0.035,
  });
  globe.group.position.set(0, 0.2, -1.2);
  globe.group.rotation.set(0.35, 0, 0.12);
  globe.group.name = "globe";
  overlay.add(globe.group);

  // ── Dollar sign: dot-filled front + back faces, bright edges ─────────────
  const mask = dollarMask();
  const dH = DOLLAR_H;
  const dW = DOLLAR_H * mask.aspect;
  const step = 0.105;
  const fillPos: number[] = [];
  const fillK: number[] = [];
  const edgePos: number[] = [];
  const edgeK: number[] = [];
  const nu = Math.round(dW / step);
  const nv = Math.round(dH / step);
  const inside = (i: number, j: number) => i >= 0 && j >= 0 && i < nu && j < nv && mask.at(i / nu, j / nv);
  const DEPTH = 0.55;
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      if (!inside(i, j)) continue;
      const x = (i / nu - 0.5) * dW;
      const y = (0.5 - j / nv) * dH;
      const edge = !inside(i - 1, j) || !inside(i + 1, j) || !inside(i, j - 1) || !inside(i, j + 1);
      if (edge) {
        // edge columns: several layers through the thickness → a lit rim
        for (let k = 0; k <= 4; k++) {
          edgePos.push(x, y, DEPTH / 2 - (k / 4) * DEPTH);
          edgeK.push(k === 0 ? 1 : k === 4 ? 0.55 : 0.35, rng());
        }
      } else {
        fillPos.push(x, y, DEPTH / 2);
        fillK.push(1, rng());
        if ((i + j) % 2 === 0) {
          fillPos.push(x, y, -DEPTH / 2);
          fillK.push(0.35, rng());
        }
      }
    }
  const dollar = new Group();
  const dollarHook = (size: string, gain: string) => /* glsl */ `
    float tw = step(0.72, hash11(floor(uTime * 3.0) * 1.3 + iK.y * 91.7));
    float sp = 0.6 + 0.4 * hash11(iK.y * 17.0);
    col = mix(uTint, uHot, 0.12 + 0.3 * sp) * iK.x * ${gain} * (1.0 + tw * 0.8);
    alpha = uAlpha;
    sizeW = ${size};
  `;
  const fill = makeDots({
    count: fillPos.length / 3,
    attrs: { iPos: attr(3, fillPos), iK: attr(2, fillK) },
    shared,
    square: true,
    uniforms: { uTint: { value: tint }, uHot: { value: hot }, uAlpha: { value: 0 } },
    hook: dollarHook((step * 0.5).toFixed(4), "1.1"),
  });
  const edges = makeDots({
    count: edgePos.length / 3,
    attrs: { iPos: attr(3, edgePos), iK: attr(2, edgeK) },
    shared,
    square: true,
    uniforms: { uTint: { value: tint }, uHot: { value: hot }, uAlpha: { value: 0 } },
    hook: dollarHook((step * 0.75).toFixed(4), "2.4"),
  });
  fill.name = "dollar";
  edges.name = "dollar";
  dollar.add(fill, edges);
  dollar.position.set(0, 0.25, 0.6);
  overlay.add(dollar);

  // ── Candle band in front of the globe ────────────────────────────────────
  const band = makeTexPlane({
    map: candleBand(gl, rng, 56, params.tint, params.highlight, params.direction),
    shared,
    width: 20,
    height: 6.4,
    color: new Color(1, 1, 1).multiplyScalar(1.1),
    opacity: 0,
  });
  band.position.set(1.0, 0.0, 2.4);
  band.name = "candles";
  overlay.add(band);
  const band2 = makeTexPlane({
    map: candleBand(gl, rng, 70, params.tint, params.highlight, params.direction),
    shared,
    width: 30,
    height: 9,
    color: tint.clone().multiplyScalar(0.55),
    opacity: 0,
  });
  band2.position.set(-2, 2.0, -9);
  band2.name = "candles";
  overlay.add(band2);

  // ── Zig-zag arrow (thick glowing ribbon, draws on) ──────────────────────
  // Points in the arrow's plane (x right, y up); crash goes down-right, rally up-right.
  const zz: [number, number][] = [
    [-13, 0.0],
    [-8.4, -2.2],
    [-4.6, 0.8],
    [-1.4, -0.8],
    [2.2, -1.6],
    [7.0, -4.6],
  ].map(([x, y]) => [x, up ? -y - 2.8 : y] as [number, number]);
  const ribbon = (() => {
    const W = 0.55;
    const pos: number[] = [];
    const sv: number[] = [];
    const idx: number[] = [];
    let S = 0;
    const lens: number[] = [0];
    for (let i = 1; i < zz.length; i++) {
      S += Math.hypot(zz[i][0] - zz[i - 1][0], zz[i][1] - zz[i - 1][1]);
      lens.push(S);
    }
    // body: miter-joined strip
    for (let i = 0; i < zz.length; i++) {
      const p = zz[i];
      const a = zz[Math.max(0, i - 1)];
      const b = zz[Math.min(zz.length - 1, i + 1)];
      const d1 = [p[0] - a[0], p[1] - a[1]];
      const d2 = [b[0] - p[0], b[1] - p[1]];
      const n1 = Math.hypot(d1[0], d1[1]) || 1;
      const n2 = Math.hypot(d2[0], d2[1]) || 1;
      let tx = d1[0] / n1 + d2[0] / n2;
      let ty = d1[1] / n1 + d2[1] / n2;
      const tl = Math.hypot(tx, ty) || 1;
      tx /= tl;
      ty /= tl;
      const nx = -ty;
      const ny = tx;
      const ref = i === 0 ? [d2[0] / n2, d2[1] / n2] : [d1[0] / n1, d1[1] / n1];
      const miter = 1 / Math.max(0.35, Math.abs(nx * -ref[1] + ny * ref[0]));
      const end = i === zz.length - 1 ? 0.0 : 1; // last point: body ends under the head
      for (const side of [-1, 1]) {
        pos.push(p[0] + nx * W * miter * side * (end ? 1 : 1), p[1] + ny * W * miter * side, 0);
        sv.push(lens[i], side);
      }
    }
    for (let i = 0; i < zz.length - 1; i++) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
    // head: triangle at the end
    const pe = zz[zz.length - 1];
    const pb = zz[zz.length - 2];
    const dx = pe[0] - pb[0];
    const dy = pe[1] - pb[1];
    const dl = Math.hypot(dx, dy);
    const ux = dx / dl;
    const uy = dy / dl;
    const base = pos.length / 3;
    const HL = 2.4;
    const HW = 1.6;
    pos.push(pe[0] - ux * 0.2 + -uy * HW, pe[1] - uy * 0.2 + ux * HW, 0);
    sv.push(S, 1);
    pos.push(pe[0] - ux * 0.2 + uy * HW, pe[1] - uy * 0.2 - ux * HW, 0);
    sv.push(S, -1);
    pos.push(pe[0] + ux * HL, pe[1] + uy * HL, 0);
    sv.push(S + HL, 0);
    idx.push(base, base + 1, base + 2);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute("aSV", new BufferAttribute(new Float32Array(sv), 2));
    g.setIndex(idx);
    const m = new ShaderMaterial({
      uniforms: { ...shared, uC: { value: tint }, uHot: { value: hot }, uDraw: { value: 0 }, uTotal: { value: S + HL } },
      vertexShader: /* glsl */ `
        attribute vec2 aSV;
        varying vec2 vSV;
        void main() {
          vSV = aSV;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        ${GLSL_COMMON}
        uniform vec3 uC;
        uniform vec3 uHot;
        uniform float uDraw;
        uniform float uTotal;
        varying vec2 vSV;
        void main() {
          float g = uDraw * uTotal;
          float vis = 1.0 - smoothstep(g - 0.3, g, vSV.x);
          float across = abs(vSV.y);
          float aa = fwidth(vSV.y) * 1.5;
          // bright edges, translucent body (like the reference's glassy arrow)
          float edge = smoothstep(0.62, 0.98 - aa, across);
          float body = 0.5 + 0.25 * (1.0 - across);
          float shine = 0.5 + 0.5 * sin(vSV.x * 0.8 - uTime * 2.5);
          vec3 c = uC * (body + edge * 1.3) + uHot * edge * 0.35 * shine;
          gl_FragColor = vec4(c * vis, 0.0);
        }`,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
      blending: CustomBlending,
      blendSrc: OneFactor,
      blendDst: OneFactor,
    });
    const mesh = new Mesh(g, m);
    return mesh;
  })();
  ribbon.position.set(0.5, up ? -0.4 : -0.6, 4.2);
  ribbon.rotation.set(-0.12, up ? -0.18 : 0.18, 0);
  ribbon.name = "arrow";
  overlay.add(ribbon);

  // ── Base glow burst + streak ─────────────────────────────────────────────
  const gTex = glowTexture(gl);
  const burst = reg(makeTexPlane({ map: gTex, shared, width: 7, height: 7, color: tint.clone().lerp(hot, 0.35).multiplyScalar(2.6), opacity: 0 }));
  burst.position.set(0, -4.4, 1.2);
  const core = reg(makeTexPlane({ map: gTex, shared, width: 1.6, height: 1.6, color: hot.clone().multiplyScalar(4.0), opacity: 0 }));
  core.position.set(0, -4.35, 1.3);
  const streak = reg(makeTexPlane({ map: streakTexture(gl), shared, width: 16, height: 1.0, color: tint.clone().lerp(hot, 0.4).multiplyScalar(2.2), opacity: 0 }));
  streak.position.set(0, -4.35, 1.25);
  for (const m of [burst, core, streak]) {
    m.name = "burst";
    overlay.add(m);
  }

  // ── Plexus floor ─────────────────────────────────────────────────────────
  const pts: [number, number, number][] = [];
  for (let i = 0; i < 260; i++) {
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * 26;
    pts.push([Math.cos(a) * r * 1.4, -5.0 + (rng() - 0.5) * 0.8, Math.sin(a) * r * 0.7 - 6]);
  }
  const pa: number[] = [];
  const pb: number[] = [];
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][2] - pts[j][2]);
      if (d < 4.2 && rng() < 0.55) {
        pa.push(...pts[i]);
        pb.push(...pts[j]);
      }
    }
  const plexusLines = makeSegments({
    count: pa.length / 3,
    attrs: { iA: attr(3, pa), iB: attr(3, pb) },
    shared,
    uniforms: { uC: { value: tint }, uAlpha: { value: 0 } },
    hook: /* glsl */ `
      widthW = 0.022;
      float dc = length(a.xz - vec2(0.0, 1.0));
      col = uC * 0.9 * exp(-dc * 0.07);
      alpha = uAlpha * (0.5 + 0.5 * sin(uTime * 1.3 + a.x * 0.7 + b.z));
    `,
  });
  const plexusDots = makeDots({
    count: pts.length,
    attrs: { iPos: attr(3, pts.flat()) },
    shared,
    uniforms: { uC: { value: tint.clone().lerp(hot, 0.3) }, uAlpha: { value: 0 } },
    hook: /* glsl */ `
      sizeW = 0.09;
      col = uC * 2.2 * exp(-length(pos.xz) * 0.05);
      alpha = uAlpha;
    `,
  });
  plexusLines.name = "plexus";
  plexusDots.name = "plexus";
  overlay.add(plexusLines, plexusDots);

  // ── Floating numbers ─────────────────────────────────────────────────────
  const texts: string[] = [];
  for (let i = 0; i < 256; i++) texts.push((10 + rng() * 980).toFixed(2));
  const atlas = makeAtlas(gl, texts, { cellW: 256, cellH: 96, font: `600 36px "${FONT.mono}"`, color: "#ffffff", align: "center" });
  const labels: LabelSpec[] = [];
  const lc = tint.clone().lerp(hot, 0.45).multiplyScalar(1.4);
  for (let i = 0; i < 70; i++) {
    const z = 7 - rng() * 22;
    labels.push({
      pos: [-14 + rng() * 28, -4 + rng() * 9.5, z],
      cell: (i * 3) % 252,
      variants: 3,
      period: 4 + Math.floor(rng() * 6), // flicker
      phase: Math.floor(rng() * 30),
      height: 0.42 + rng() * 0.2,
      color: [lc.r, lc.g, lc.b],
    });
  }
  const labelMesh = makeLabels(atlas, labels, shared);
  labelMesh.name = "labels";
  overlay.add(labelMesh);

  // ── Post ──────────────────────────────────────────────────────────────
  const post = defaultPost();
  post.bloomStrength = 0.8;
  post.bloomThreshold = 0.7;
  post.bloomRadius = 0.7;
  post.vignette = 0.4;
  post.saturation = 1.05;
  shared.uFocusRange.value = 1.2;
  shared.uAperture.value = 0.05;
  shared.uNearMul.value = 1.2;
  shared.uMaxCoc.value = 0.02;

  const U = (m: Mesh) => (m.material as ShaderMaterial).uniforms;
  const target = new Vector3(0, -0.2, 0);
  const update = (frame: number) => {
    const t = frame / 30;
    // camera: slow sway
    camera.position.set(Math.sin(t * 0.21) * 1.4, -0.6 + Math.sin(t * 0.13) * 0.3, 21 - smoothstep(0, 20, t) * 1.5);
    camera.lookAt(target);
    camera.updateMatrixWorld();
    shared.uFocus.value = camera.position.distanceTo(dollar.position);

    const fade = easeInOutCubic(prog(t, 1.5, 4.0));
    globe.setAlpha(fade);
    globe.spin.rotation.y = t * 0.16;
    dollar.rotation.y = Math.sin(t * 0.35) * 0.22;
    dollar.scale.setScalar(0.92 + 0.08 * easeOutCubic(prog(t, 1.5, 4.0)));
    U(fill).uAlpha.value = fade;
    U(edges).uAlpha.value = fade;
    U(ribbon).uDraw.value = easeInOutCubic(prog(t, 1.9, 4.0));
    const pulse = 1 + 0.25 * Math.sin(t * 2.4) * prog(t, 4, 5);
    U(burst).uOpacity.value = fade * pulse;
    U(core).uOpacity.value = fade * (0.85 + 0.3 * Math.sin(t * 3.1 + 1));
    U(streak).uOpacity.value = fade * pulse;
    U(plexusLines).uAlpha.value = fade;
    U(plexusDots).uAlpha.value = fade;
    (labelMesh.material as ShaderMaterial).uniforms.uAlpha.value = fade;
    for (const b of [band, band2]) {
      U(b).uOpacity.value = fade;
      (U(b).uUvRect.value as Vector4).set(0.5, 1, t * 0.012 * (b === band ? 1 : 0.5), 0);
    }
    U(backdrop).uOpacity.value = fade;
    void fadeables;
  };

  return { opaque, overlay, camera, post, update };
};

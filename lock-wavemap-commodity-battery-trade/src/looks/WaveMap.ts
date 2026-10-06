import * as THREE from "three";
import type { LookFactory } from "../core/Stage";
import { canvasTexture, font, landPath, makeCanvas, rgba, hexVec } from "../core/canvas";
import { getLand } from "../core/assets";
import { mulberry32, range, TAU } from "../core/random";

// Look 2 — Wave Map. Flat (orthographic) finance background: Natural Earth
// map, a scrolling band of candlesticks, braided glow lines and a bright
// horizontal streak. 600-frame seamless loop: candles scroll exactly one
// data period (CANDLES spacings) and every oscillator runs whole cycles.

export type WaveMapProps = {
  land: string;
  base: string;
  baseGlow: string;
  lines: string;
  candles: string;
  streak: string;
  labels: string;
};

const LOOP = 600;
const CANDLES = 50; // visible across the width == one data period
const W = 3840;
const H = 2160;
const BAND_Y = 0.48; // band centre (fraction of height from top)

const rng = mulberry32(20260402);
// One period of candle data (periodic, so the scroll wraps seamlessly).
const CANDLE_DATA = Array.from({ length: CANDLES }, (_, i) => {
  const u = i / CANDLES;
  const wave = Math.sin(u * TAU * 3 + 0.6) * 0.55 + Math.sin(u * TAU * 7 + 2.1) * 0.25 + Math.sin(u * TAU * 2 + 4) * 0.2;
  return {
    mid: wave * 0.17 + range(rng, -0.05, 0.05),
    body: range(rng, 0.05, 0.22),
    wickUp: range(rng, 0.008, 0.05),
    wickDn: range(rng, 0.008, 0.05),
    phase: rng() * TAU,
    amp: range(rng, 0.008, 0.03),
    alpha: range(rng, 0.8, 1),
    k: 1 + Math.floor(rng() * 3),
  };
});

const LABEL_ROWS = [0.06, 0.18, 0.27, 0.42, 0.55, 0.7, 0.8, 0.9];
const LABELS = Array.from({ length: 40 }, (_, i) => ({
  x: ((i % 5) + range(rng, 0.05, 0.75)) / 5,
  y: LABEL_ROWS[Math.floor(rng() * LABEL_ROWS.length)] + range(rng, -0.008, 0.008),
  v: range(rng, 10, 990).toFixed(2),
  up: rng() > 0.08,
  a: range(rng, 0.25, 0.75),
  ph: Math.floor(rng() * 4),
}));

// Background chart columns (out of focus).
const COLUMNS = Array.from({ length: 16 }, () => ({
  x: rng(),
  w: range(rng, 0.012, 0.035),
  top: range(rng, 0.08, 0.4),
  bottom: range(rng, 0.55, 0.85),
  a: range(rng, 0.05, 0.11),
  ph: rng() * TAU,
}));

const quad = (w: number, h: number, mat: THREE.Material, x: number, y: number, z: number) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(x, y, z);
  m.frustumCulled = false;
  return m;
};

export const waveMapLook: LookFactory<WaveMapProps> = (env, p) => {
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, -10, 10);
  camera.position.z = 5;
  const ts = env.texScale;

  // --- Background gradient ---------------------------------------------
  const bg = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: { base: { value: hexVec(p.base) }, glow: { value: hexVec(p.baseGlow) } },
    vertexShader: `out vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `precision highp float; in vec2 vUv; out vec4 o; uniform vec3 base, glow;
      void main(){ vec2 q=vUv-vec2(0.5,0.52); q.x*=1.6; float r=length(q);
        vec3 c=mix(glow, base, smoothstep(0.0,1.0,r)); c*=mix(1.0,0.75,smoothstep(0.6,1.2,r));
        c += glow * 0.15 * smoothstep(0.3, 1.0, vUv.x) * smoothstep(0.6, 0.0, vUv.y);
        c *= mix(0.55, 1.0, smoothstep(0.0, 0.22, vUv.y) * smoothstep(1.0, 0.8, vUv.y)); o=vec4(c,1.0);} `,
    depthWrite: false,
  });
  scene.add(quad(W, H, bg, 0, 0, -5));

  // --- Map (static canvas) ---------------------------------------------
  const mapC = makeCanvas(W * ts, H * ts);
  {
    const { ctx, canvas } = mapC;
    const s = canvas.width / W;
    ctx.scale(s, s);
    const rect = { x: W * 0.13, y: H * 0.1, w: W * 0.72, h: H * 0.8, latTop: 82, latBottom: -58 };
    landPath(ctx, getLand(), rect);
    ctx.fillStyle = rgba(p.land, 0.78);
    ctx.fill();
    ctx.strokeStyle = rgba(p.land, 0.9);
    ctx.lineWidth = 2.2;
    ctx.stroke();
    // faint grid
    ctx.strokeStyle = rgba(p.labels, 0.17);
    ctx.lineWidth = 2;
    for (let x = 0; x <= W; x += 96) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y += 96) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }
  const mapTex = canvasTexture(mapC.canvas, env.gl);
  const mapMat = new THREE.MeshBasicMaterial({ map: mapTex, transparent: true, depthWrite: false, opacity: 0.85 });
  scene.add(quad(W, H, mapMat, 0, 0, -4));

  // --- Out-of-focus columns + faint area chart (shader) ------------------
  const colData = new Float32Array(COLUMNS.length * 4);
  COLUMNS.forEach((c, i) => colData.set([c.x, c.w, c.top, c.bottom], i * 4));
  const backMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      t: { value: 0 },
      cols: { value: COLUMNS.map((c) => new THREE.Vector4(c.x, c.w, c.top, c.bottom)) },
      colA: { value: COLUMNS.map((c) => new THREE.Vector2(c.a, c.ph)) },
      tint: { value: hexVec(p.lines) },
    },
    vertexShader: `out vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `precision highp float; in vec2 vUv; out vec4 o;
      uniform float t; uniform vec4 cols[${COLUMNS.length}]; uniform vec2 colA[${COLUMNS.length}]; uniform vec3 tint;
      void main(){
        float y = 1.0 - vUv.y; float a = 0.0;
        for (int i=0;i<${COLUMNS.length};i++){
          vec4 c = cols[i];
          float cx = fract(c.x - t);           // drifts left one full width per loop
          float dx = abs(fract(vUv.x - cx + 0.5) - 0.5);
          float soft = 0.004 + c.y * 0.35;
          float inX = 1.0 - smoothstep(c.y*0.5 - soft, c.y*0.5 + soft, dx);
          float top = c.z + 0.04*sin(6.2831853*t*2.0 + colA[i].y);
          float inY = smoothstep(top-0.03, top+0.03, y) * (1.0 - smoothstep(c.w-0.05, c.w+0.05, y));
          a += inX * inY * colA[i].x;
        }
        // faint mountain/area chart behind the band
        // jagged polyline ridge: linear interpolation between hashed nodes (periodic in x+t)
        float ax = fract(vUv.x + t) * 64.0;
        float i0 = floor(ax); float fx = ax - i0;
        float h0 = fract(sin(mod(i0, 64.0) * 91.7) * 4375.85);
        float h1 = fract(sin(mod(i0 + 1.0, 64.0) * 91.7) * 4375.85);
        float env = 0.5 + 0.5 * sin(6.2831853 * (vUv.x + t) * 2.0 + 1.0);
        float ridge = 0.43 - env * 0.10 - mix(h0, h1, fx) * 0.07;
        float area = smoothstep(ridge-0.002, ridge+0.002, y) * (1.0 - smoothstep(0.5, 0.62, y)) * 0.11;
        float edge = exp(-pow((y-ridge)/0.002,2.0))*0.10;
        o = vec4(tint*(a + area + edge), 1.0);
      }`,
  });
  scene.add(quad(W, H, backMat, 0, 0, -3));

  // --- Labels (static positions; values swap on whole-loop cycles) -------
  const labC = makeCanvas(W * ts, H * ts);
  const labTex = canvasTexture(labC.canvas, env.gl);
  const labMat = new THREE.MeshBasicMaterial({ map: labTex, transparent: true, depthWrite: false });
  scene.add(quad(W, H, labMat, 0, 0, -2.5));
  let labState = -1;
  const drawLabels = (phase: number) => {
    if (phase === labState) return;
    labState = phase;
    const { ctx, canvas } = labC;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const s = canvas.width / W;
    ctx.scale(s, s);
    ctx.font = font(500, 42, "Inter");
    ctx.textBaseline = "middle";
    LABELS.forEach((l, i) => {
      const vis = 0.5 + 0.5 * Math.cos(((phase + l.ph) % 4) * (TAU / 4));
      const a = l.a * 0.75 * (0.6 + 0.4 * vis);
      ctx.fillStyle = rgba(l.up ? p.labels : "#FF6A7A", a);
      const x = l.x * W;
      const y = l.y * H;
      ctx.beginPath();
      if (l.up) {
        ctx.moveTo(x, y - 11);
        ctx.lineTo(x + 11, y + 9);
        ctx.lineTo(x - 11, y + 9);
      } else {
        ctx.moveTo(x, y + 11);
        ctx.lineTo(x + 11, y - 9);
        ctx.lineTo(x - 11, y - 9);
      }
      ctx.fill();
      ctx.fillStyle = rgba(p.labels, a);
      const v = (parseFloat(l.v) * (1 + 0.013 * (((phase + i) % 4) - 1.5))).toFixed(2);
      ctx.fillText(v, x + 20, y);
    });
    labTex.needsUpdate = true;
  };

  // --- Candles (instanced) -------------------------------------------------
  const COPIES = CANDLES;
  const cGeo = new THREE.InstancedBufferGeometry();
  const base = new THREE.PlaneGeometry(1, 1);
  cGeo.index = base.index;
  cGeo.setAttribute("position", base.getAttribute("position"));
  cGeo.setAttribute("uv", base.getAttribute("uv"));
  const iIdx = new Float32Array(COPIES * 2 * 2); // per instance: candle slot, part (0 body, 1 wick)
  const iDat = new Float32Array(COPIES * 2 * 4);
  const iDat2 = new Float32Array(COPIES * 2 * 4);
  let n = 0;
  for (let slot = 0; slot < COPIES; slot++) {
    const d = CANDLE_DATA[slot % CANDLES];
    for (let part = 0; part < 2; part++) {
      iIdx[n * 2] = slot;
      iIdx[n * 2 + 1] = part;
      iDat.set([d.mid, d.body, d.wickUp, d.wickDn], n * 4);
      iDat2.set([d.phase, d.amp, d.alpha, d.k], n * 4);
      n++;
    }
  }
  cGeo.setAttribute("aIdx", new THREE.InstancedBufferAttribute(iIdx, 2));
  cGeo.setAttribute("aDat", new THREE.InstancedBufferAttribute(iDat, 4));
  cGeo.setAttribute("aDat2", new THREE.InstancedBufferAttribute(iDat2, 4));
  cGeo.instanceCount = COPIES * 2;
  const candleMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: { scroll: { value: 0 }, t: { value: 0 }, color: { value: hexVec(p.candles) }, W: { value: W }, H: { value: H }, bandY: { value: BAND_Y } },
    vertexShader: `
      in vec2 aIdx; in vec4 aDat; in vec4 aDat2;
      uniform float scroll, t, W, H, bandY;
      out vec2 vUv; out float vA; out float vPart; out vec2 vSize; out float vSoftPx;
      void main(){
        float spacing = W / ${CANDLES}.0;
        // wrap: a candle leaving on the left re-enters off-screen right
        float x = mod(aIdx.x - scroll, ${CANDLES}.0) * spacing - W*0.5 + spacing*0.5;
        float mid = aDat.x + aDat2.y * sin(6.2831853*t*aDat2.w + aDat2.x);
        float body = aDat.y * (0.85 + 0.15*sin(6.2831853*t*aDat2.w*2.0 + aDat2.x*1.7));
        float w, h, cy;
        if (aIdx.y < 0.5) { w = spacing*0.55; h = body*H; cy = mid*H; }
        else { w = max(3.0, spacing*0.045); h = (body + aDat.z + aDat.w)*H; cy = (mid + (aDat.z - aDat.w)*0.5)*H; }
        vec2 pos = vec2(x, (0.5 - bandY)*H - cy) + position.xy * vec2(w, h);
        vUv = uv; vA = aDat2.z; vPart = aIdx.y; vSize = vec2(w, h);
        vSoftPx = 2.5 + 22.0 * smoothstep(0.2, 0.5, abs(x) / W);   // softer toward the frame edges
        // fade at the left/right edges of the frame
        vA *= smoothstep(-W*0.5, -W*0.47, x) * (1.0 - smoothstep(W*0.47, W*0.5, x));
        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 0.0, 1.0);
      }`,
    fragmentShader: `precision highp float; in vec2 vUv; in float vA; in float vPart; in vec2 vSize; in float vSoftPx; out vec4 o; uniform vec3 color;
      void main(){
        // 1px-ish soft edge so candles don't shimmer while scrolling
        vec2 px = vUv * vSize; vec2 d = min(px, vSize - px);
        float edge = clamp(min(d.x, d.y) / vSoftPx + 0.25, 0.0, 1.0);
        float a = vA * edge * (vPart > 0.5 ? 0.6 : 0.8) * (0.88 + 0.12 * vUv.y);
        // body brighter at the core of the band
        o = vec4(color * a * 0.95, 1.0);
      }`,
  });
  const candles = new THREE.Mesh(cGeo, candleMat);
  candles.frustumCulled = false;
  candles.position.z = -1;
  scene.add(candles);

  // --- Braided wave lines + streak (analytic distance glow) -----------------
  const waveMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      t: { value: 0 },
      lineCol: { value: hexVec(p.lines) },
      streakCol: { value: hexVec(p.streak) },
      pulse: { value: 1 },
      H: { value: H },
      aspect: { value: W / H },
    },
    vertexShader: `out vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
    fragmentShader: `precision highp float; in vec2 vUv; out vec4 o;
      uniform float t, pulse, H, aspect; uniform vec3 lineCol, streakCol;
      const float TAU = 6.2831853;
      // y offset (fraction of height) of strand i at x, time t (t in loops)
      float strand(float i, float x) {
        float p = i * 1.37;
        float cmn = 0.030 * sin(TAU*(x*2.2 - t*2.0) + 0.4) + 0.012 * sin(TAU*(x*4.3 + t*3.0) + 1.9);
        return cmn
             + 0.011 * sin(TAU*(x*3.3 + t*3.0) + p*2.1)
             + 0.006 * sin(TAU*(x*6.1 - t*5.0) + p*0.7);
      }
      void main(){
        float x = vUv.x;
        float y = (0.5 - vUv.y) * 0.5;   // band quad spans bandY ± 0.25 of the height
        float env = 0.25 + 0.75 * smoothstep(0.05, 0.3, x) * (1.0 - smoothstep(0.75, 1.0, x));
        vec3 c = vec3(0.0);
        float px = 1.0 / H;
        for (int k = 0; k < 14; k++) {
          float i = float(k);
          float fy = strand(i, x);
          float dfx = (strand(i, x + 0.0005) - fy) / 0.0005;
          float d = abs(y - fy) / sqrt(1.0 + pow(dfx / aspect, 2.0));
          float w = (k < 5 ? 1.5 : 0.9) * px;
          float core = exp(-pow(d / w, 2.0));
          float glow = exp(-d / (10.0 * px)) * 0.08;
          float wgt = k < 5 ? 0.95 : 0.5;
          c += lineCol * (core * 1.1 + glow) * wgt;
        }
        c *= env;
        // horizontal streak
        float dy = abs(y + 0.004);
        dy = abs(y - 0.012);
        float s = exp(-pow(dy / (1.8*px), 2.0)) * 1.3 + exp(-dy / (10.0*px)) * 0.4 + exp(-dy / (60.0*px)) * 0.14;
        float sx = 0.2 + 2.0 * (1.0 - smoothstep(0.0, 0.32, x)) + 0.4 * smoothstep(0.75, 1.0, x);
        c += streakCol * s * sx * pulse;
        o = vec4(c, 1.0);
      }`,
  });
  scene.add(quad(W, H * 0.5, waveMat, 0, (0.5 - BAND_Y) * H, 0));

  return {
    scene,
    camera,
    post: { bloomStrength: 0.7, bloomThreshold: 0.8, bloomKnee: 0.3, bloomRadius: 0.8, vignette: 0.5, loop: LOOP, exposure: 1.0 },
    update: (frame) => {
      const f = ((frame % LOOP) + LOOP) % LOOP;
      const t = f / LOOP;
      candleMat.uniforms.scroll.value = t * CANDLES;
      candleMat.uniforms.t.value = t;
      backMat.uniforms.t.value = t;
      waveMat.uniforms.t.value = t;
      waveMat.uniforms.pulse.value = 0.85 + 0.15 * Math.cos(TAU * t * 4);
      drawLabels(Math.floor(t * 4) % 4);
    },
  };
};

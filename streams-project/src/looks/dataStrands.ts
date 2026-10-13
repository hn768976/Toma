import * as THREE from "three";
import { DEFOCUS_GLSL, RIBBON_FRAG_GLSL, RIBBON_GLSL } from "../lib/lines";
import { defaultPost } from "../lib/post";
import { mulberry32, pick, range, TAU } from "../lib/random";
import { ThreeLook } from "../lib/ThreeStage";

// Look 5 — Data Strands. ~600 thin lines in 8 bundles that pinch to tight
// knots and fan out between them, over columns of JetBrains Mono data text,
// light dots and a deep blue haze. All motion is a closed function of t.

export type DataStrandsProps = {
  colors: [string, number][]; // colour, share
  haze: string;
  text: string;
};

const LOOP = 600;
const LINES = 600;
const BUNDLES = 8;
const PTS = 160;
const X_SPAN = 13;

const STRAND_VERT = /* glsl */ `
attribute vec4 aB1;     // y0, z0, spread, twist
attribute vec4 aB2;     // pinch x 1..3, pinch count
attribute vec4 aB3;     // wave amp, wave k, wave phase, pinch drift phase
attribute vec4 aL;      // ox, oy, phase, alpha
attribute float aTilt;
attribute vec3 aColor;
uniform float uT;
uniform float uLineGain;
${DEFOCUS_GLSL}
${RIBBON_GLSL}
varying vec3 vColor;
float gPinch;
vec3 linePos(float t) {
  float x = mix(-${X_SPAN.toFixed(1)}, ${X_SPAN.toFixed(1)}, t);
  float sp = 1.0;
  float xp1 = aB2.x + 0.9 * sin(6.2831853 * (uT + aB3.w));
  float xp2 = aB2.y + 0.9 * sin(6.2831853 * (uT + aB3.w + 0.37));
  float xp3 = aB2.z + 0.9 * sin(6.2831853 * (uT + aB3.w + 0.74));
  sp *= 1.0 - exp(-abs(x - xp1) / 1.25);
  sp *= 1.0 - exp(-abs(x - xp2) / 1.25);
  if (aB2.w > 2.5) sp *= 1.0 - exp(-abs(x - xp3) / 1.25);
  gPinch = sp;
  sp = aB1.z * (0.015 + pow(sp, 0.85));
  float phi = aB1.w * x + aL.z;
  vec2 o = vec2(aL.x * cos(phi) - aL.y * sin(phi), aL.x * sin(phi) + aL.y * cos(phi)) * sp;
  float wave = aB3.x * sin(aB3.y * x + aB3.z + 6.2831853 * uT);
  vec2 xy = vec2(x, aB1.x + wave + o.x);
  float ct = cos(aTilt), st = sin(aTilt);
  xy = vec2(ct * xy.x - st * (xy.y - aB1.x), aB1.x + st * xy.x + ct * (xy.y - aB1.x));
  return vec3(xy, aB1.y + o.y);
}
void main() {
  // strip vertex → (t, side) from the vertex id (2 vertices per point)
  float t = float(gl_VertexID / 2) / ${(PTS - 1).toFixed(1)};
  float side = (gl_VertexID % 2 == 0) ? -1.0 : 1.0;
  vec3 p0 = linePos(t);
  vec3 p1 = linePos(t + 0.004);
  float hw = 0.42 * uRes.y / 720.0;
  gl_Position = ribbon(p0, p1, side, hw);
  float edgeFade = smoothstep(0.0, 0.08, t) * smoothstep(1.0, 0.92, t);
  // converging lines would sum to white at the knot: let them thin out
  float knot = mix(0.3, 1.0, smoothstep(0.0, 0.35, gPinch));
  vColor = aColor * aL.w * edgeFade * uLineGain * knot;
  // warm, bright tips where a bundle pinches
  float tip = 1.0 - smoothstep(0.0, 0.45, gPinch);
  vColor = mix(vColor, vec3(1.0, 0.42, 0.12) * uLineGain * 1.8, tip * 0.75);
}`;

const STRAND_FRAG = /* glsl */ `
${RIBBON_FRAG_GLSL}
varying vec3 vColor;
void main() {
  gl_FragColor = vec4(vColor * ribbonCoverage(), 1.0);
}`;

// light dots (bokeh) and the data-text planes
const DOT_VERT = /* glsl */ `
attribute vec2 aCorner;
attribute vec4 aD;   // x, y, z, size
attribute vec4 aD2;  // r, g, b, twinkle phase
attribute float aRate;
uniform float uT;
${DEFOCUS_GLSL}
varying vec2 vC;
varying float vR;
varying vec3 vColor;
void main() {
  vec4 v = modelViewMatrix * vec4(aD.xyz, 1.0);
  vec4 c = projectionMatrix * v;
  float base = aD.w * uRes.y / 720.0;
  float coc = cocPx(-v.z);
  float r = max(base + 0.5 * coc, 0.6);
  float rq = r + 1.0;
  c.xy += aCorner * rq / (0.5 * uRes) * c.w;
  gl_Position = c;
  vC = aCorner * rq;
  vR = r;
  float tw = 0.55 + 0.45 * sin(6.2831853 * (uT * aRate + aD2.w));
  vColor = aD2.rgb * tw * (base * base) / (r * r);
}`;

const DOT_FRAG = /* glsl */ `
varying vec2 vC;
varying float vR;
varying vec3 vColor;
void main() {
  float d = length(vC);
  float a = clamp(vR + 0.5 - d, 0.0, 1.0);
  // slightly brighter rim like a lens bokeh disc
  float rim = 1.0 + 0.25 * smoothstep(vR * 0.5, vR, d) * step(2.0, vR);
  gl_FragColor = vec4(vColor * a * rim, 1.0);
}`;

const TEXT_VERT = /* glsl */ `
uniform float uT;
uniform float uScroll;
uniform float uV0;
uniform float uVh;
uniform float uU0;
uniform float uUw;
${DEFOCUS_GLSL}
varying vec2 vUv;
varying float vLod;
void main() {
  vec4 v = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * v;
  vUv = vec2(uU0 + uv.x * uUw, uV0 + uv.y * uVh + uScroll);
  // texel footprint → mip bias to blur with the CoC
  vLod = log2(max(1.0, cocPx(-v.z) * 0.22));
}`;

const TEXT_FRAG = /* glsl */ `
uniform sampler2D tText;
uniform vec3 uColor;
uniform float uAlpha;
varying vec2 vUv;
varying float vLod;
void main() {
  float a = texture2D(tText, vUv, vLod).r;
  gl_FragColor = vec4(uColor * a * uAlpha, 1.0);
}`;

const HAZE_FRAG = /* glsl */ `
uniform vec3 uHaze;
uniform vec3 uGlow;
varying vec2 vUv;
void main() {
  vec2 q = vUv - vec2(0.5, 0.52);
  q.x *= 1.6;
  float g = exp(-dot(q, q) * 3.2);
  float band = exp(-pow((vUv.y - 0.55) * 3.0, 2.0));
  gl_FragColor = vec4(uHaze + uGlow * (0.65 * g + 0.35 * band * g), 1.0);
}`;

const CHARS = "0123456789ABCDEF";
const buildTextCanvas = (rng: () => number) => {
  const W = 2048,
    H = 2048;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#fff";
  ctx.font = "22px 'JetBrains Mono'";
  ctx.textBaseline = "top";
  // 8 column strips, each 256 px wide; rows of short tokens
  for (let col = 0; col < 8; col++) {
    const x0 = col * 256 + 10;
    for (let row = 0; row < H / 30; row++) {
      const y = row * 30 + 4;
      if (rng() < 0.12) continue; // gaps
      let x = x0;
      const tokens = 1 + Math.floor(rng() * 4);
      for (let k = 0; k < tokens; k++) {
        const len = 2 + Math.floor(rng() * 7);
        let s = "";
        for (let i = 0; i < len; i++) s += CHARS[Math.floor(rng() * CHARS.length)];
        if (x + len * 13.2 > x0 + 236) break;
        ctx.globalAlpha = 0.5 + 0.5 * rng();
        ctx.fillText(s, x, y);
        x += len * 13.2 + 14 + rng() * 24;
      }
      if (rng() < 0.25) {
        // small squares and bars, like the indicator glyphs in data tables
        ctx.globalAlpha = 0.8;
        const n = 1 + Math.floor(rng() * 5);
        for (let i = 0; i < n; i++) ctx.fillRect(x0 + 160 + i * 14, y + 6, 8, 8);
      }
    }
  }
  ctx.globalAlpha = 1;
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
};

export const createDataStrands =
  (props: DataStrandsProps) =>
  (): ThreeLook => {
    const rng = mulberry32(3847714);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 200);
    const shared = {
      uRes: { value: new THREE.Vector2(1280, 720) },
      uFocus: { value: 10 },
      uAperture: { value: 0.03 },
      uMaxCoc: { value: 0.045 },
      uT: { value: 0 },
      uLineGain: { value: 0.22 },
    };

    // ---- haze background (screen-aligned, far) ----
    const hazeColor = new THREE.Color(props.haze);
    const hazeMat = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
      fragmentShader: HAZE_FRAG,
      uniforms: {
        uHaze: { value: hazeColor },
        uGlow: { value: new THREE.Color("#1E46B4").multiplyScalar(0.2) },
      },
      depthWrite: false,
      depthTest: false,
    });
    const haze = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), hazeMat);
    haze.frustumCulled = false;
    haze.renderOrder = -10;
    scene.add(haze);

    // ---- data text columns ----
    const textTex = buildTextCanvas(rng);
    const textColor = new THREE.Color(props.text);
    const columns: { mat: THREE.ShaderMaterial; speed: number }[] = [];
    for (let i = 0; i < 40; i++) {
      const layer = i % 4; // a few depths
      const z = [-9, -13, -18, -24][layer];
      const width = [1.5, 2.0, 2.6, 3.3][layer];
      const height = [5.5, 8, 10.5, 14][layer];
      const mat = new THREE.ShaderMaterial({
        vertexShader: TEXT_VERT,
        fragmentShader: TEXT_FRAG,
        uniforms: {
          ...shared,
          uScroll: { value: 0 },
          uV0: { value: rng() },
          uVh: { value: height / (width * 8) },
          uU0: { value: Math.floor(rng() * 8) / 8 + 0.002 },
          uUw: { value: 1 / 8 - 0.004 },
          tText: { value: textTex },
          uColor: { value: textColor },
          uAlpha: { value: 0.3 * [1.6, 1.35, 1.1, 0.9][layer] },
        },
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mat);
      const spanX = [9, 13, 18, 24][layer];
      m.position.set(range(rng, -spanX, spanX), range(rng, -1.2, 1.2) * (height * 0.15), z);
      m.rotation.y = -Math.sign(m.position.x) * Math.min(1.0, (Math.abs(m.position.x) / spanX) * 1.3) * 0.9;
      scene.add(m);
      columns.push({ mat, speed: 1 + Math.floor(rng() * 2) });
    }

    // ---- light dots ----
    const DOTS = 500;
    const dotGeo = new THREE.InstancedBufferGeometry();
    dotGeo.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
    dotGeo.setAttribute("aCorner", new THREE.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
    dotGeo.setIndex([0, 1, 2, 0, 2, 3]);
    const dD = new Float32Array(DOTS * 4),
      dD2 = new Float32Array(DOTS * 4),
      dRate = new Float32Array(DOTS);
    const cyan = new THREE.Color("#3AE8E8"),
      orange = new THREE.Color("#FF8A4A"),
      blue = new THREE.Color("#4A8AFF");
    // dotted rows at a few depths (like indicator rows in the data)
    let di = 0;
    for (let k = 0; k < 9; k++, di++) {
      dD.set([-3.3 + k * 0.36, -1.25 + k * 0.01, 4.2, 2.2], di * 4);
      const c = k % 3 === 2 ? blue : cyan;
      dD2.set([c.r * 6, c.g * 6, c.b * 6, rng()], di * 4);
      dRate[di] = 1 + (k % 3);
    }
    while (di < DOTS) {
      const z = pick(rng, [
        [-3, 1],
        [-8, 1.5],
        [-13, 2],
        [-18, 1.5],
        [2.5, 0.6],
      ]) + range(rng, -1, 1);
      const y = range(rng, -0.5, 0.5) * (4 + Math.abs(z) * 0.75);
      const x0 = range(rng, -1, 1) * (6 + Math.abs(z) * 0.8);
      const n = 3 + Math.floor(rng() * 9);
      const step = range(rng, 0.25, 0.5) * (1 + Math.abs(z) * 0.05);
      const col = pick(rng, [
        [cyan, 4],
        [blue, 4],
        [orange, 2],
      ]);
      for (let k = 0; k < n && di < DOTS; k++, di++) {
        dD.set([x0 + k * step, y, z, range(rng, 0.8, 1.7)], di * 4);
        const b = range(rng, 0.6, 2.2);
        dD2.set([col.r * b, col.g * b, col.b * b, rng()], di * 4);
        dRate[di] = 1 + Math.floor(rng() * 4);
      }
    }
    dotGeo.setAttribute("aD", new THREE.InstancedBufferAttribute(dD, 4));
    dotGeo.setAttribute("aD2", new THREE.InstancedBufferAttribute(dD2, 4));
    dotGeo.setAttribute("aRate", new THREE.InstancedBufferAttribute(dRate, 1));
    dotGeo.instanceCount = DOTS;
    const dotMat = new THREE.ShaderMaterial({
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
      uniforms: shared,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const dots = new THREE.Mesh(dotGeo, dotMat);
    dots.frustumCulled = false;
    scene.add(dots);

    // ---- strands ----
    const colorTable = props.colors.map(([c, w]) => [new THREE.Color(c), w] as [THREE.Color, number]);
    // one shared ribbon strip (t, side), instanced per line
    const aT = new Float32Array(PTS * 2 * 2);
    const index: number[] = [];
    for (let p = 0; p < PTS; p++) {
      const t = p / (PTS - 1);
      aT.set([t, -1, t, 1], p * 4);
      if (p < PTS - 1) {
        const i0 = p * 2;
        index.push(i0, i0 + 1, i0 + 2, i0 + 1, i0 + 3, i0 + 2);
      }
    }
    const aB1 = new Float32Array(LINES * 4),
      aB2 = new Float32Array(LINES * 4),
      aB3 = new Float32Array(LINES * 4),
      aL = new Float32Array(LINES * 4),
      aC = new Float32Array(LINES * 3),
      aTilt = new Float32Array(LINES);
    const bundles = Array.from({ length: BUNDLES }, (_, b) => {
      const nP = 2 + (rng() < 0.5 ? 1 : 0);
      const xs: number[] = [];
      for (let i = 0; i < nP; i++) xs.push(-6.5 + (13 * (i + 0.5 + range(rng, -0.3, 0.3))) / nP);
      return {
        y0: [-2.4, -1.3, -0.3, 0.6, 1.5, 2.5, -3.4, 3.3][b] + range(rng, -0.2, 0.2),
        z0: [3.6, -2.5, -1, 0.3, -4.5, -0.4, 5.0, -6.5][b],
        spread: range(rng, 0.45, 0.85),
        twist: range(rng, -0.6, 0.6),
        xs: [xs[0], xs[1], xs[2] ?? 0, nP],
        tilt: range(rng, -0.42, 0.42),
        wave: [range(rng, 0.1, 0.35), range(rng, 0.12, 0.3), rng() * TAU, rng()],
      };
    });
    for (let l = 0; l < LINES; l++) {
      const B = bundles[l % BUNDLES];
      // gaussian-ish disc offset
      const r = Math.sqrt(-2 * Math.log(1 - rng() * 0.95)) * 0.55;
      const a = rng() * TAU;
      const phase = rng() * TAU;
      const col = pick(rng, colorTable);
      // warm lines carry more energy so the orange survives additive mixing
      const alpha = range(rng, 0.4, 0.7) * (col.r > col.b * 2 ? 1.6 : 1);
      aB1.set([B.y0, B.z0, B.spread, B.twist], l * 4);
      aB2.set(B.xs, l * 4);
      aB3.set(B.wave, l * 4);
      aL.set([Math.cos(a) * r, Math.sin(a) * r, phase, alpha], l * 4);
      aC.set([col.r, col.g, col.b], l * 3);
      aTilt[l] = B.tilt;
    }
    const sGeo = new THREE.InstancedBufferGeometry();
    sGeo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(PTS * 2 * 3), 3));
    sGeo.setAttribute("aB1", new THREE.InstancedBufferAttribute(aB1, 4));
    sGeo.setAttribute("aB2", new THREE.InstancedBufferAttribute(aB2, 4));
    sGeo.setAttribute("aB3", new THREE.InstancedBufferAttribute(aB3, 4));
    sGeo.setAttribute("aL", new THREE.InstancedBufferAttribute(aL, 4));
    sGeo.setAttribute("aColor", new THREE.InstancedBufferAttribute(aC, 3));
    sGeo.setAttribute("aTilt", new THREE.InstancedBufferAttribute(aTilt, 1));
    sGeo.setIndex(index);
    sGeo.instanceCount = LINES;
    const sMat = new THREE.ShaderMaterial({
      vertexShader: STRAND_VERT,
      fragmentShader: STRAND_FRAG,
      uniforms: shared,
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const strands = new THREE.Mesh(sGeo, sMat);
    strands.frustumCulled = false;
    scene.add(strands);

    const post = defaultPost();
    post.tonemap = 1;
    post.exposure = 0.9;
    post.saturation = 1.08;
    post.vignette = 0.55;
    post.bloom = { strength: 0.18, threshold: 0.9, knee: 0.4, radius: 0.8 };
    post.dof = null;

    return {
      scene,
      camera,
      post,
      msaa: 0,
      update(frame, size) {
        const t = (((frame % LOOP) + LOOP) % LOOP) / LOOP;
        camera.aspect = size.w / size.h;
        shared.uRes.value.set(size.w, size.h);
        shared.uT.value = t;
        const push = 0.5 - 0.5 * Math.cos(TAU * t);
        camera.position.set(Math.sin(TAU * t) * 0.6, Math.sin(TAU * t * 2 + 0.5) * 0.15, 9.5 - push * 1.4);
        camera.lookAt(Math.sin(TAU * t + 0.6) * 0.3, 0, -2);
        camera.updateMatrixWorld();
        shared.uFocus.value = camera.position.z + 0.6; // the middle strands (z ≈ -0.6)
        for (const c of columns) c.mat.uniforms.uScroll.value = -t * c.speed;
      },
      dispose() {
        textTex.dispose();
      },
    };
  };

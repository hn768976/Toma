import * as THREE from "three";
import type { StageFactory } from "../lib/ThreeStage";
import {
  clamp,
  envelope,
  mulberry32,
  sampleKeys,
  smoothstep,
} from "../lib/math";
import {
  Ribbon,
  SpriteLayer,
  SpriteMode,
  additive,
  makeNoiseTexture,
} from "./layers";
import type { EmberPalette, RGB } from "./palette";
import { BURST_T, COMETS, MERGE_T } from "./timeline";

/** Stateless hash -> [0,1) so particles can be evaluated at any frame. */
const hash = (a: number, b: number) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};

const fullscreenVert = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
  }
`;

const backgroundFrag = /* glsl */ `
  uniform float uAspect;
  uniform vec3 uFloor;
  uniform vec3 uCenterCol;
  uniform vec3 uTopCol;
  uniform float uCenterAmt;
  uniform float uTopAmt;
  uniform vec2 uCenterPos;
  uniform vec2 uCenterR;
  uniform float uSeed;
  uniform float uVig;
  varying vec2 vUv;
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  void main() {
    vec2 p = vec2(vUv.x * uAspect, vUv.y);
    vec2 d = (p - uCenterPos) / uCenterR;
    float cg = exp(-dot(d, d) * 1.6);
    float tx = (p.x - 0.5 * uAspect) / (0.6 * uAspect);
    float tg = exp(-p.y * p.y / 0.09) * exp(-tx * tx);
    vec3 col = uFloor + uCenterCol * cg * uCenterAmt + uTopCol * tg * uTopAmt;
    float side = abs(vUv.x - 0.5) * 2.0;
    col *= 1.0 - uVig * pow(side, 2.2);
    col *= 1.0 - 0.35 * pow(abs(vUv.y - 0.45) * 1.8, 2.0);
    // Ordered noise dithering prevents banding in the dark gradients.
    col += (hash12(gl_FragCoord.xy + uSeed) - 0.5) * (2.5 / 255.0);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const ringFrag = /* glsl */ `
  uniform float uAspect;
  uniform vec2 uCenter;
  uniform float uRadius;
  uniform float uIntensity;
  uniform float uOuter;
  uniform float uSpin;
  uniform vec3 uHot;
  uniform vec3 uMid;
  uniform vec3 uCore;
  varying vec2 vUv;
  float lobe(float a, float c, float w) {
    float d = atan(sin(a - c), cos(a - c));
    return exp(-d * d / (w * w));
  }
  void main() {
    vec2 p = vec2(vUv.x * uAspect, vUv.y) - uCenter;
    float d = length(p);
    float a = atan(p.y, p.x);
    float R = uRadius;
    float w = 0.010 + 0.022 * R;
    float band = exp(-pow((d - R) / w, 2.0));
    float limb = smoothstep(R * 0.35, R, d) * (1.0 - smoothstep(R, R + w, d));
    float halo = exp(-max(d - R, 0.0) / (0.04 + 0.08 * R)) * step(R * 0.9, d);
    float cres = lobe(a, -0.75 + uSpin, 0.42) * 1.0
               + lobe(a, 2.45 + uSpin, 0.38) * 0.9
               + lobe(a, 0.55 + uSpin * 1.3, 0.22) * 0.55
               + lobe(a, 3.6 - uSpin * 0.7, 0.3) * 0.35;
    vec3 col = uMid * (band * (0.12 + 1.35 * cres) + limb * 0.16 + halo * 0.14);
    col += uCore * band * cres * cres * 0.9;
    col += uHot * band * cres * 0.6;
    // Faint secondary shock front.
    float R2 = R * 1.55 + 0.08;
    float band2 = exp(-pow((d - R2) / (0.05 + 0.03 * R), 2.0));
    col += uMid * band2 * uOuter * (0.25 + 0.6 * lobe(a, 3.1 - uSpin, 0.7));
    gl_FragColor = vec4(col * uIntensity, 1.0);
  }
`;

type Speck = {
  x: number;
  y: number;
  size: number;
  alpha: number;
  freq: number;
  phase: number;
  vx: number;
  vy: number;
  bokeh: boolean;
  warm: number;
};

const toColor = (c: RGB) => new THREE.Color(c[0], c[1], c[2]);

export const createEmberStage =
  (palette: EmberPalette): StageFactory =>
  ({ renderer, width, height }) => {
    const A = width / height;
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(0, A, 0, 1, 0.1, 100);
    camera.position.set(0, 0, 10);

    // --- background -------------------------------------------------------
    const quad = new THREE.PlaneGeometry(A, 1);
    const bgUniforms = {
      uAspect: { value: A },
      uFloor: { value: toColor(palette.bgFloor) },
      uCenterCol: { value: toColor(palette.bgCenter) },
      uTopCol: { value: toColor(palette.bgTop) },
      uCenterAmt: { value: 0 },
      uTopAmt: { value: 0 },
      uCenterPos: { value: new THREE.Vector2(A * 0.5, 0.55) },
      uCenterR: { value: new THREE.Vector2(0.62, 0.48) },
      uSeed: { value: 0 },
      uVig: { value: 0.75 },
    };
    const bg = new THREE.Mesh(
      quad,
      new THREE.ShaderMaterial({
        vertexShader: fullscreenVert,
        fragmentShader: backgroundFrag,
        uniforms: bgUniforms,
        depthTest: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    bg.position.set(A / 2, 0.5, 0);
    bg.renderOrder = 0;
    scene.add(bg);

    // --- layers -----------------------------------------------------------
    const smokeTex = makeNoiseTexture(256, 7);
    const specks = new SpriteLayer(400, SpriteMode.Gauss);
    const bokeh = new SpriteLayer(200, SpriteMode.Bokeh);
    const smoke = new SpriteLayer(900, SpriteMode.Smoke, smokeTex);
    const sparks = new SpriteLayer(5000, SpriteMode.Gauss);
    const halos = new SpriteLayer(96, SpriteMode.Gauss);
    const cores = new SpriteLayer(32, SpriteMode.Core);
    const burst = new SpriteLayer(12000, SpriteMode.Gauss);
    const shell = new SpriteLayer(14000, SpriteMode.Gauss);
    const SAMPLES = 120;
    const glowRibbons = COMETS.map(() => new Ribbon(SAMPLES, 0));
    const tubeRibbons = COMETS.map(() => new Ribbon(SAMPLES, 1));
    for (const r of glowRibbons) r.uniforms.uGlow.value = toColor(palette.deep);
    for (const r of tubeRibbons) {
      r.uniforms.uCore.value = toColor(palette.core);
      r.uniforms.uRim.value = toColor(palette.hot);
    }

    const ringUniforms = {
      uAspect: { value: A },
      uCenter: { value: new THREE.Vector2(A / 2, 0.5) },
      uRadius: { value: 0 },
      uIntensity: { value: 0 },
      uOuter: { value: 0 },
      uSpin: { value: 0 },
      uHot: { value: toColor(palette.hot) },
      uMid: { value: toColor(palette.mid) },
      uCore: { value: toColor(palette.core) },
    };
    const ring = new THREE.Mesh(
      quad,
      new THREE.ShaderMaterial({
        vertexShader: fullscreenVert,
        fragmentShader: ringFrag,
        uniforms: ringUniforms,
        ...additive,
      }),
    );
    ring.position.set(A / 2, 0.5, 0);

    const ordered: THREE.Object3D[] = [
      bokeh.mesh,
      specks.mesh,
      smoke.mesh,
      ...glowRibbons.map((r) => r.mesh),
      ...tubeRibbons.map((r) => r.mesh),
      sparks.mesh,
      ring,
      shell.mesh,
      burst.mesh,
      halos.mesh,
      cores.mesh,
    ];
    ordered.forEach((o, i) => {
      o.renderOrder = i + 1;
      scene.add(o);
    });

    // --- static random sets --------------------------------------------------
    const rnd = mulberry32(1234);
    const specksData: Speck[] = Array.from({ length: 260 }, () => {
      const isBokeh = rnd() < 0.28;
      return {
        x: rnd() * A,
        y: rnd(),
        size: isBokeh ? 0.005 + rnd() * 0.01 : 0.0022 + rnd() * 0.0045,
        alpha: isBokeh ? 0.12 + rnd() * 0.25 : 0.35 + rnd() * 0.65,
        freq: 0.6 + rnd() * 2.2,
        phase: rnd() * Math.PI * 2,
        vx: (rnd() - 0.5) * 0.012,
        vy: -0.004 - rnd() * 0.012,
        bokeh: isBokeh,
        warm: rnd(),
      };
    });

    const unitSphere = (r: () => number) => {
      const z = r() * 2 - 1;
      const t = r() * Math.PI * 2;
      const s = Math.sqrt(1 - z * z);
      return [s * Math.cos(t), s * Math.sin(t), z] as const;
    };
    const burstData = Array.from({ length: 8000 }, () => {
      const [dx, dy] = unitSphere(rnd);
      // Lopsided blast: debris flies further to the left / lower-left.
      const bias = 1 + 0.45 * Math.max(0, -dx) + 0.2 * Math.max(0, dy) - 0.25 * Math.max(0, dx);
      return {
        dx,
        dy,
        rmax: (0.06 + 0.5 * Math.pow(rnd(), 0.8)) * bias,
        size: 0.0018 + rnd() * 0.0028,
        bright: 0.35 + rnd() * 0.65,
        hot: rnd(),
        delay: rnd() * 0.12,
      };
    });
    // Dust cloud thrown towards the left / lower-left (the reference blast is
    // strongly one-sided): slower, dimmer, reaching the left frame edge.
    for (let i = 0; i < 3500; i++) {
      const ang = Math.PI - 0.35 + (rnd() - 0.5) * 1.7;
      burstData.push({
        dx: Math.cos(ang),
        dy: Math.sin(ang),
        rmax: 0.3 + 0.8 * Math.pow(rnd(), 0.6),
        size: 0.0016 + rnd() * 0.0022,
        bright: 0.18 + rnd() * 0.4,
        hot: rnd() * 0.6,
        delay: 0.05 + rnd() * 0.25,
      });
    }
    const shellData = Array.from({ length: 12000 }, () => {
      const [dx, dy] = unitSphere(rnd);
      // Debris spray is lopsided towards the left / lower-left, as in the
      // reference, with a light scattering everywhere else.
      const wake = (dx < -0.1 && dy > -0.5 && rnd() < 0.6) || rnd() < 0.07;
      return {
        dx,
        dy,
        rr: wake ? 1.0 + Math.pow(rnd(), 1.4) * 0.85 : 0.9 + rnd() * 0.12,
        size: 0.0012 + rnd() * 0.0024,
        bright: 0.25 + rnd() * 0.75,
        phase: rnd() * Math.PI * 2,
        swirl: (rnd() - 0.5) * 0.6,
        wake,
      };
    });

    // Re-usable trail buffers.
    const pts = new Float32Array(SAMPLES * 2);
    const widths = new Float32Array(SAMPLES);
    const alphas = new Float32Array(SAMPLES);

    const persp = (y: number) => 0.72 + 0.62 * clamp(y, -0.2, 1.25);

    const render = (t: number, frame: number) => {
      // ----- background ----------------------------------------------------
      bgUniforms.uSeed.value = (frame % 64) * 17.0;
      // Sides open up while the comets light the scene, then close back in.
      bgUniforms.uVig.value = envelope([[0, 0.7], [0.8, 0.4], [3.0, 0.4], [4.4, 0.55], [5.6, 0.8], [9, 0.8]], t);
      bgUniforms.uCenterAmt.value = envelope(
        [
          [0, 0.08],
          [0.7, 0.9],
          [1.6, 1.05],
          [2.6, 1.0],
          [3.05, 0.55],
          [3.35, 1.45],
          [3.9, 1.65],
          [4.5, 1.0],
          [5.3, 1.0],
          [9, 0.95],
        ],
        t,
      );
      bgUniforms.uTopAmt.value = envelope(
        [
          [0, 0.7],
          [0.6, 0.6],
          [2.5, 0.75],
          [3.9, 1.4],
          [5.0, 0.95],
          [9, 0.95],
        ],
        t,
      );
      const cx = envelope(
        [
          [0, 0.5],
          [1.5, 0.56],
          [2.8, 0.58],
          [3.3, 0.5],
          [9, 0.5],
        ],
        t,
      );
      bgUniforms.uCenterPos.value.set(cx * A, envelope([[0, 0.5], [4.5, 0.5], [6, 0.56]], t));

      // ----- ambient specks & bokeh ---------------------------------------
      specks.begin();
      bokeh.begin();
      const speckVis = envelope(
        [
          [0, 0.85],
          [3.1, 0.85],
          [3.45, 0.25],
          [4.6, 0.45],
          [5.4, 1.0],
          [9, 1.0],
        ],
        t,
      );
      for (const s of specksData) {
        let x = s.x + s.vx * t;
        let y = s.y + s.vy * t;
        x = ((x % A) + A) % A;
        y = ((y % 1.05) + 1.05) % 1.05;
        const tw = 0.55 + 0.45 * Math.sin(t * s.freq * Math.PI * 2 * 0.5 + s.phase);
        const c = s.warm > 0.5 ? palette.ember : palette.hot;
        const a = s.alpha * tw * speckVis;
        if (s.bokeh) {
          bokeh.push(x, y, s.size, s.size, 0, c[0] * 0.5, c[1] * 0.5, c[2] * 0.5, a);
        } else {
          specks.push(x, y, s.size, s.size, 0, c[0], c[1], c[2], a);
        }
      }
      specks.end();
      bokeh.end();

      // ----- comets ----------------------------------------------------------
      smoke.begin();
      sparks.begin();
      halos.begin();
      cores.begin();
      const L = 0.8;
      COMETS.forEach((comet, ci) => {
        const key0 = comet.keys[0][0];
        const glow = glowRibbons[ci];
        const tube = tubeRibbons[ci];
        const alive =
          smoothstep(key0, key0 + 0.12, t) *
          (1 - smoothstep(MERGE_T - 0.06, MERGE_T + 0.12, t));
        if (t < key0 || alive <= 0) {
          glow.mesh.visible = false;
          tube.mesh.visible = false;
        } else {
          glow.mesh.visible = true;
          tube.mesh.visible = true;
          for (let j = 0; j < SAMPLES; j++) {
            const s = j / (SAMPLES - 1);
            let tj = t - L * s;
            const valid = tj >= key0 ? 1 : 0;
            tj = Math.min(Math.max(tj, key0), MERGE_T);
            const [x, y] = sampleKeys(comet.keys, tj);
            pts[j * 2] = x * A;
            pts[j * 2 + 1] = y;
            // Rounded, softly fading nose so the head blends into its glow.
            const nose = smoothstep(0, 0.035, s);
            widths[j] = comet.width * persp(y) * (1 - 0.62 * s) * (0.45 + 0.55 * nose);
            alphas[j] = valid * Math.pow(1 - s, 1.25) * (0.3 + 0.7 * nose);
          }
          tube.update(pts, widths, alphas, 0.028);
          glow.update(pts, widths, alphas, 0.085);
          tube.uniforms.uIntensity.value = alive * 1.25;
          glow.uniforms.uIntensity.value = alive * 1.0;

          // Head.
          const hx = pts[0];
          const hy = pts[1];
          const p = persp(hy);
          const fl = 1 + 0.1 * Math.sin(t * 41 + comet.seed) + 0.06 * Math.sin(t * 73 + comet.seed * 2);
          const k = alive * fl;
          const { hot, mid, core } = palette;
          halos.push(hx, hy, 0.3 * p, 0.3 * p, 0, mid[0], mid[1], mid[2], 0.5 * k);
          halos.push(hx, hy, 0.11 * p, 0.11 * p, 0, hot[0], hot[1], hot[2], 1.0 * k);
          halos.push(hx, hy, 0.3 * p, 0.0065 * p, 0, hot[0], hot[1], hot[2], 0.95 * k);
          halos.push(hx, hy, 0.13 * p, 0.016 * p, 0, mid[0], mid[1], mid[2], 0.5 * k);
          cores.push(hx, hy, 0.045 * p, 0.045 * p, 0, core[0], core[1], core[2], 1.5 * k);

          // Smoke puffs shed along the path.
          const SM = 0.045;
          const life = 1.9;
          for (let kb = Math.ceil((t - life) / SM); kb <= Math.floor(t / SM); kb++) {
            const tb = kb * SM;
            if (tb < key0 + 0.05 || tb > MERGE_T) continue;
            const age = t - tb;
            const h1 = hash(comet.seed, kb);
            const h2 = hash(comet.seed + 1, kb);
            const h3 = hash(comet.seed + 2, kb);
            const [bx, by] = sampleKeys(comet.keys, tb);
            const px = bx * A + (h1 - 0.5) * 0.05 + (h2 - 0.5) * 0.07 * age;
            const py = by + (h3 - 0.5) * 0.05 - 0.012 * age;
            const size = (0.06 + 0.14 * age + 0.05 * h2) * persp(by);
            const a = 0.9 * (1 - 0.5 * smoothstep(2.6, 3.1, t)) * Math.pow(Math.sin(Math.PI * clamp(age / life)), 1.3) * (1 - smoothstep(MERGE_T, MERGE_T + 0.6, t));
            const sm = palette.smoke;
            smoke.push(px, py, size, size, h1 * 6.283 + (h3 - 0.5) * age * 0.8, sm[0], sm[1], sm[2], a);
          }

          // Sparks / fine particle filaments.
          const SP = 0.005;
          const slife = 1.5;
          for (let kb = Math.ceil((t - slife) / SP); kb <= Math.floor(t / SP); kb++) {
            const tb = kb * SP;
            if (tb < key0 || tb > MERGE_T) continue;
            const age = t - tb;
            const h1 = hash(comet.seed + 10, kb);
            const h2 = hash(comet.seed + 11, kb);
            const h3 = hash(comet.seed + 12, kb);
            const [bx, by] = sampleKeys(comet.keys, tb);
            const sw = Math.sin(age * 3 + h1 * 6.28) * 0.012 * age;
            const px = bx * A + (h1 - 0.5) * 0.03 + (h2 - 0.5) * 0.08 * age + sw;
            const py = by + (h2 - 0.5) * 0.03 + (h3 - 0.5) * 0.06 * age + 0.015 * age;
            const a = (0.25 + 0.75 * h3) * Math.pow(1 - age / slife, 1.6) * (1 - smoothstep(MERGE_T, MERGE_T + 0.5, t));
            const c = h1 > 0.75 ? palette.core : palette.hot;
            const sz = (0.0012 + 0.0022 * h2) * persp(by);
            sparks.push(px, py, sz, sz, 0, c[0], c[1], c[2], a);
          }
        }
      });

      // ----- fusion sun ----------------------------------------------------
      const sunI = envelope(
        [
          [3.05, 0],
          [3.17, 0.45],
          [3.27, 1.0],
          [3.6, 1.15],
          [3.85, 0.95],
          [4.05, 0.42],
          [4.4, 0.14],
          [4.85, 0],
        ],
        t,
      );
      const sx = A * 0.5;
      const sy = 0.5;
      if (sunI > 0) {
        const { hot, mid, core } = palette;
        const pulse = 1 + 0.05 * Math.sin(t * 50);
        const shrink = 1 - 0.65 * smoothstep(3.85, 4.3, t);
        halos.push(sx, sy, 1.7, 1.7, 0, mid[0], mid[1], mid[2], 0.42 * sunI);
        halos.push(sx, sy, 0.75 * shrink, 0.75 * shrink, 0, mid[0], mid[1], mid[2], 0.55 * sunI);
        halos.push(sx, sy, 0.32 * shrink, 0.32 * shrink, 0, hot[0], hot[1], hot[2], 1.0 * sunI * pulse);
        // Large soft fireball: additive orange saturates to yellow in the middle.
        halos.push(sx, sy, 0.48 * shrink, 0.48 * shrink, 0, hot[0], hot[1], hot[2], 1.25 * sunI * pulse);
        halos.push(sx, sy, 0.9, 0.018, 0, hot[0], hot[1], hot[2], 0.35 * sunI);
        halos.push(sx, sy, 0.6, 0.06, 0, mid[0], mid[1], mid[2], 0.45 * sunI);
        cores.push(sx, sy, 0.24 * shrink, 0.24 * shrink, 0, core[0], core[1], core[2], 2.2 * sunI * pulse);
      }
      halos.end();
      cores.end();
      smoke.end();
      sparks.end();

      // ----- shockwave ring --------------------------------------------------
      const ringAge = t - BURST_T;
      const ringI = envelope(
        [
          [BURST_T - 0.05, 0],
          [BURST_T + 0.12, 0.85],
          [3.95, 0.68],
          [4.3, 0.55],
          [4.6, 0.28],
          [4.85, 0.1],
          [5.1, 0],
        ],
        t,
      );
      const R = ringAge > 0 ? 0.72 * (1 - Math.exp(-ringAge * 2.4)) + 0.06 * ringAge : 0;
      const rcx = A * envelope([[4.3, 0.5], [5.1, 0.4]], t);
      const rcy = envelope([[4.3, 0.5], [5.1, 0.58]], t);
      ring.visible = ringI > 0;
      ringUniforms.uCenter.value.set(rcx, rcy);
      ringUniforms.uRadius.value = R;
      ringUniforms.uIntensity.value = ringI;
      ringUniforms.uOuter.value = envelope([[BURST_T, 0], [3.75, 0.6], [4.1, 0.35], [4.5, 0]], t);
      ringUniforms.uSpin.value = Math.max(0, ringAge) * 0.55;

      shell.begin();
      const shellI = envelope(
        [
          [3.7, 0],
          [3.95, 0.9],
          [4.4, 0.6],
          [4.85, 0.18],
          [5.15, 0],
        ],
        t,
      );
      if (shellI > 0) {
        const { hot, ember, core } = palette;
        for (let i = 0; i < shellData.length; i++) {
          const s = shellData[i];
          const spread = s.wake ? 1 + (s.rr - 1) * smoothstep(3.7, 4.6, t) : s.rr;
          const ang = s.swirl * Math.max(0, ringAge);
          const ca = Math.cos(ang);
          const sa = Math.sin(ang);
          const dx = s.dx * ca - s.dy * sa;
          const dy = s.dx * sa + s.dy * ca;
          const px = rcx + dx * R * spread;
          const py = rcy + dy * R * spread;
          const tw = 0.6 + 0.4 * Math.sin(t * 9 + s.phase);
          const c = s.bright > 0.92 ? core : s.bright > 0.5 ? hot : ember;
          const a = shellI * s.bright * tw * (s.wake ? 0.7 : 0.6);
          shell.push(px, py, s.size, s.size, 0, c[0], c[1], c[2], a);
        }
      }
      shell.end();

      // ----- explosion burst -------------------------------------------------
      burst.begin();
      const bAge0 = t - (BURST_T - 0.12);
      if (bAge0 > 0 && bAge0 < 2.4) {
        const { hot, core, mid } = palette;
        for (let i = 0; i < burstData.length; i++) {
          const b = burstData[i];
          const age = bAge0 - b.delay;
          if (age <= 0) continue;
          const e = Math.exp(-age * 2.6);
          const r = b.rmax * (1 - e);
          const speed = b.rmax * 2.6 * e;
          const stretch = 1 + Math.min(5, speed * 9);
          const px = sx + b.dx * r;
          const py = sy + b.dy * r;
          const a =
            b.bright *
            smoothstep(0, 0.06, age) *
            (1 - smoothstep(0.45, 1.4, age));
          const c = b.hot > 0.7 ? core : b.hot > 0.25 ? hot : mid;
          burst.push(
            px,
            py,
            b.size * stretch,
            b.size,
            Math.atan2(b.dy, b.dx),
            c[0],
            c[1],
            c[2],
            a,
          );
        }
      }
      burst.end();

      renderer.render(scene, camera);
    };

    return {
      render,
      dispose: () => {
        smokeTex.dispose();
        quad.dispose();
        [specks, bokeh, smoke, sparks, halos, cores, burst, shell].forEach((l) => l.dispose());
        [...glowRibbons, ...tubeRibbons].forEach((r) => r.dispose());
        (bg.material as THREE.Material).dispose();
        (ring.material as THREE.Material).dispose();
      },
    };
  };

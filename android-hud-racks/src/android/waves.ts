import * as THREE from "three";
import { mulberry32 } from "../lib/random";

// About 24 glowing red / green / yellow strands weaving across the frame
// at chin height, drawn as screen-space ribbons after the DoF pass (they
// sit on the focus plane). Each strand's height is a sum of three sines
// whose phases advance by whole turns per loop, so frame 600 = frame 0.

const STRANDS = 24;
const SEGS = 420;

type Strand = {
  freq: [number, number, number];
  phase: [number, number, number];
  amp: [number, number, number];
  turns: [number, number, number];
  offset: number;
  c0: THREE.Color;
  c1: THREE.Color;
  gain: number;
};

const makeStrands = (): Strand[] => {
  const rnd = mulberry32(240617);
  const out: Strand[] = [];
  // Three bundles: green, red and a few yellow-orange strands. Strands in a
  // bundle share a base wave with small differences, so they braid.
  const bundles = [
    { n: 11, c0: "#3AF06A", c1: "#B8FF8A", f: 2.1, p: 0.1, t: 1 },
    { n: 10, c0: "#FF3A2A", c1: "#FF8A5A", f: 2.6, p: 0.55, t: -1 },
    { n: 3, c0: "#FFC83A", c1: "#FF8A3A", f: 1.7, p: 0.3, t: 1 },
  ];
  for (const b of bundles) {
    for (let i = 0; i < b.n; i++) {
      out.push({
        freq: [b.f + (rnd() - 0.5) * 0.3, 4.3 + rnd() * 2.2, 8 + rnd() * 5],
        phase: [b.p + (rnd() - 0.5) * 0.12, rnd(), rnd()],
        amp: [0.55 + rnd() * 0.15, 0.18 + rnd() * 0.12, 0.05 + rnd() * 0.06],
        turns: [b.t, b.t * (1 + Math.floor(rnd() * 2)), -b.t * (1 + Math.floor(rnd() * 3))],
        offset: (rnd() - 0.5) * 0.18,
        c0: new THREE.Color(b.c0),
        c1: new THREE.Color(b.c1),
        gain: 0.6 + rnd() * 0.6,
      });
    }
  }
  return out.slice(0, STRANDS);
};

const WAVE_GLSL = /* glsl */ `
attribute vec3 aFreq;
attribute vec3 aPhase;
attribute vec3 aAmp;
attribute vec3 aTurns;
attribute float aOffset;
uniform float uLoop;
uniform vec2 res;
uniform float baseY;
uniform float ampPx;
uniform float faceX;
float envelope(float t) {
  // Wild near the face, calmer away from it.
  float d = abs(t - faceX);
  return mix(1.0, 0.42, smoothstep(0.02, 0.75, d));
}
float waveY(float t) {
  float y = aAmp.x * sin(6.2831853 * (aFreq.x * t + aPhase.x + aTurns.x * uLoop));
  y += aAmp.y * sin(6.2831853 * (aFreq.y * t + aPhase.y + aTurns.y * uLoop));
  y += aAmp.z * sin(6.2831853 * (aFreq.z * t + aPhase.z + aTurns.z * uLoop));
  return baseY + (y * envelope(t) + aOffset * mix(1.0, 0.6, abs(t - faceX))) * ampPx;
}
`;

const RIBBON_VERT = /* glsl */ `
${WAVE_GLSL}
attribute float aT;
attribute float aSide;
attribute vec3 aC0;
attribute vec3 aC1;
attribute float aGain;
uniform float halfW;
varying float vSide;
varying float vT;
varying vec3 vCol;
varying float vGain;
void main() {
  float t = aT;
  float x = t * res.x;
  float y = waveY(t);
  float dt = 0.0015;
  float y2 = waveY(t + dt);
  vec2 tang = normalize(vec2(dt * res.x, y2 - y));
  vec2 nrm = vec2(-tang.y, tang.x);
  float ext = halfW + 1.0;
  vec2 p = vec2(x, y) + nrm * aSide * ext;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  vSide = aSide * ext;
  vT = t;
  float k = 0.5 + 0.5 * sin(6.2831853 * (t * 1.3 + aPhase.y));
  vCol = mix(aC0, aC1, k);
  vGain = aGain;
}
`;

const RIBBON_FRAG = /* glsl */ `
uniform float halfW;
uniform float faceX;
uniform float glow; // 0 = core, 1 = soft glow pass
uniform float bright;
varying float vSide;
varying float vT;
varying vec3 vCol;
varying float vGain;
void main() {
  float a;
  if (glow > 0.5) {
    float r = abs(vSide) / halfW;
    a = exp(-r * r * 3.0) * 0.07;
  } else {
    a = clamp(halfW + 0.5 - abs(vSide), 0.0, 1.0) * min(halfW * 2.0, 1.0);
  }
  // Brighter and flared near the face.
  float near = 1.0 - smoothstep(0.0, 0.45, abs(vT - faceX));
  float edge = smoothstep(0.0, 0.04, vT) * smoothstep(1.0, 0.96, vT);
  float k = bright * vGain * (1.0 + 1.1 * near * near) * edge;
  gl_FragColor = vec4(vCol * a * k, 1.0);
}
`;

const BEAD_VERT = /* glsl */ `
${WAVE_GLSL}
attribute vec2 aCorner;
attribute vec3 aBead; // x: start offset, y: whole trips per loop, z: trail index
attribute vec3 aC0;
uniform float beadPx;
varying vec2 vC;
varying vec3 vCol;
varying float vTrail;
varying float vT;
void main() {
  float t = fract(aBead.x + aBead.y * uLoop) * 1.1 - 0.05 - aBead.z * 0.0045 * sign(aBead.y);
  float x = t * res.x;
  float y = waveY(t);
  float s = beadPx * (1.0 - aBead.z * 0.06);
  vec2 p = vec2(x, y) + aCorner * s * 3.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);
  vC = aCorner * 3.0;
  vCol = mix(aC0, vec3(1.0), 0.55);
  vTrail = aBead.z;
  vT = t;
}
`;

const BEAD_FRAG = /* glsl */ `
uniform float beadGain;
varying vec2 vC;
varying vec3 vCol;
varying float vTrail;
varying float vT;
void main() {
  float r = length(vC);
  float core = clamp(1.5 - r * 1.5, 0.0, 1.0);
  float halo = exp(-r * r * 0.9) * 0.35;
  float fade = (1.0 - vTrail / 14.0);
  float edge = smoothstep(0.0, 0.05, vT) * smoothstep(1.0, 0.95, vT);
  gl_FragColor = vec4(vCol * (core + halo) * fade * fade * beadGain * edge, 1.0);
}
`;

export class Waves {
  scene = new THREE.Scene();
  camera: THREE.OrthographicCamera;
  private uniforms: Record<string, THREE.IUniform>;

  constructor(width: number, height: number, faceX: number, px: number) {
    this.camera = new THREE.OrthographicCamera(0, width, height, 0, -1, 1);
    const strands = makeStrands();
    this.uniforms = {
      uLoop: { value: 0 },
      res: { value: new THREE.Vector2(width, height) },
      baseY: { value: height * (1 - 0.54) },
      ampPx: { value: height * 0.09 },
      faceX: { value: faceX },
      halfW: { value: 1.5 * px },
      glow: { value: 0 },
      bright: { value: 1.35 },
      beadPx: { value: 3.2 * px },
      beadGain: { value: 2.2 },
    };
    const strandAttrs = (count: number, per: (s: Strand, i: number) => void) => {
      void count;
      strands.forEach(per);
    };
    // Ribbon geometry: all strands in one mesh.
    const vPerStrand = (SEGS + 1) * 2;
    const nV = strands.length * vPerStrand;
    const A = {
      aT: new Float32Array(nV),
      aSide: new Float32Array(nV),
      aFreq: new Float32Array(nV * 3),
      aPhase: new Float32Array(nV * 3),
      aAmp: new Float32Array(nV * 3),
      aTurns: new Float32Array(nV * 3),
      aOffset: new Float32Array(nV),
      aC0: new Float32Array(nV * 3),
      aC1: new Float32Array(nV * 3),
      aGain: new Float32Array(nV),
    };
    const idx: number[] = [];
    strandAttrs(strands.length, (s, si) => {
      for (let i = 0; i <= SEGS; i++) {
        for (let side = 0; side < 2; side++) {
          const v = si * vPerStrand + i * 2 + side;
          A.aT[v] = i / SEGS;
          A.aSide[v] = side ? 1 : -1;
          A.aFreq.set(s.freq, v * 3);
          A.aPhase.set(s.phase, v * 3);
          A.aAmp.set(s.amp, v * 3);
          A.aTurns.set(s.turns, v * 3);
          A.aOffset[v] = s.offset;
          A.aC0.set([s.c0.r, s.c0.g, s.c0.b], v * 3);
          A.aC1.set([s.c1.r, s.c1.g, s.c1.b], v * 3);
          A.aGain[v] = s.gain;
        }
        if (i < SEGS) {
          const o = si * vPerStrand + i * 2;
          idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
        }
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nV * 3), 3));
    g.setAttribute("aT", new THREE.BufferAttribute(A.aT, 1));
    g.setAttribute("aSide", new THREE.BufferAttribute(A.aSide, 1));
    g.setAttribute("aFreq", new THREE.BufferAttribute(A.aFreq, 3));
    g.setAttribute("aPhase", new THREE.BufferAttribute(A.aPhase, 3));
    g.setAttribute("aAmp", new THREE.BufferAttribute(A.aAmp, 3));
    g.setAttribute("aTurns", new THREE.BufferAttribute(A.aTurns, 3));
    g.setAttribute("aOffset", new THREE.BufferAttribute(A.aOffset, 1));
    g.setAttribute("aC0", new THREE.BufferAttribute(A.aC0, 3));
    g.setAttribute("aC1", new THREE.BufferAttribute(A.aC1, 3));
    g.setAttribute("aGain", new THREE.BufferAttribute(A.aGain, 1));
    g.setIndex(idx);
    const mk = (glow: boolean) => {
      const u = { ...this.uniforms, glow: { value: glow ? 1 : 0 }, halfW: { value: (glow ? 11 : 1.5) * px } };
      const m = new THREE.ShaderMaterial({
        vertexShader: RIBBON_VERT,
        fragmentShader: RIBBON_FRAG,
        uniforms: u,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(g, m);
      mesh.frustumCulled = false;
      return mesh;
    };
    this.scene.add(mk(true));
    this.scene.add(mk(false));

    // Sparkle beads with short trails on 6 strands, whole trips per loop.
    const beadStrands = [0, 3, 7, 11, 15, 21];
    const TRAIL = 14;
    const beadsPer = 3;
    const nB = beadStrands.length * beadsPer * TRAIL;
    const B = {
      aCorner: new Float32Array(nB * 4 * 2),
      aBead: new Float32Array(nB * 4 * 3),
      aFreq: new Float32Array(nB * 4 * 3),
      aPhase: new Float32Array(nB * 4 * 3),
      aAmp: new Float32Array(nB * 4 * 3),
      aTurns: new Float32Array(nB * 4 * 3),
      aOffset: new Float32Array(nB * 4),
      aC0: new Float32Array(nB * 4 * 3),
    };
    const bidx: number[] = [];
    const rnd = mulberry32(99173);
    let q = 0;
    for (const si of beadStrands) {
      const s = strands[si];
      for (let b = 0; b < beadsPer; b++) {
        const start = rnd();
        const trips = (rnd() < 0.5 ? 1 : 2) * (rnd() < 0.35 ? -1 : 1);
        for (let tr = 0; tr < TRAIL; tr++) {
          const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
          for (let c = 0; c < 4; c++) {
            const v = q * 4 + c;
            B.aCorner.set(corners[c], v * 2);
            B.aBead.set([start, trips, tr], v * 3);
            B.aFreq.set(s.freq, v * 3);
            B.aPhase.set(s.phase, v * 3);
            B.aAmp.set(s.amp, v * 3);
            B.aTurns.set(s.turns, v * 3);
            B.aOffset[v] = s.offset;
            B.aC0.set([s.c0.r, s.c0.g, s.c0.b], v * 3);
          }
          const o = q * 4;
          bidx.push(o, o + 1, o + 2, o + 2, o + 1, o + 3);
          q++;
        }
      }
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute("position", new THREE.BufferAttribute(new Float32Array(nB * 4 * 3), 3));
    for (const [k, arr] of Object.entries(B)) {
      const size = k === "aCorner" ? 2 : k === "aOffset" ? 1 : 3;
      bg.setAttribute(k, new THREE.BufferAttribute(arr, size));
    }
    bg.setIndex(bidx);
    const bm = new THREE.ShaderMaterial({
      vertexShader: BEAD_VERT,
      fragmentShader: BEAD_FRAG,
      uniforms: this.uniforms,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
    });
    const beads = new THREE.Mesh(bg, bm);
    beads.frustumCulled = false;
    this.scene.add(beads);
  }

  render(renderer: THREE.WebGLRenderer, frame: number, loop: number) {
    this.uniforms.uLoop.value = (frame % loop) / loop;
    renderer.render(this.scene, this.camera);
  }
}

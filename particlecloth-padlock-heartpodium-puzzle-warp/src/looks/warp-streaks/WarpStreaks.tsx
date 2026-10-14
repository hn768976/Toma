import React, { useCallback } from "react";
import * as THREE from "three";
import { ThreeStage, WorldFactory } from "../../lib/ThreeStage";
import { PostPipeline } from "../../lib/post";
import { mulberry32 } from "../../lib/random";
import { LOOP, loopPhase, loopTheta } from "../../lib/loop";

export interface WarpStreaksProps {
  /** [hex, share] — shares sum to 1 */
  palette: [string, number][];
  bokeh: string;
  background: string;
}

// ---------- layout (module level, seeded) ----------
const STREAKS = 1500;
const BOKEH = 60;
const DEPTH = 140; // far end of the tunnel (world units)

interface StreakSeed {
  phi: number;
  r: number;
  z0: number;
  cycles: number;
  bright: number;
  width: number;
  pick: number;
  blur: number;
}
const streakSeeds: StreakSeed[] = (() => {
  const rnd = mulberry32(0x5eed0005);
  const out: StreakSeed[] = [];
  for (let i = 0; i < STREAKS; i++) {
    const u = rnd();
    // three kinds: a few heavy beams, many small sparks with short trails, faint filaments
    const k = rnd();
    const beam = k < 0.1, spark = k >= 0.1 && k < 0.65;
    out.push({
      phi: rnd() * Math.PI * 2,
      // tunnel radius: most streaks on a wide shell, some close to the axis
      r: 2.2 + Math.pow(rnd(), 0.9) * 10.0,
      z0: rnd(),
      // whole number of wraps per 600 frames
      cycles: 1 + Math.floor(Math.pow(rnd(), 1.6) * 4),
      bright: beam ? 0.8 + rnd() * 1.4 : spark ? 0.3 + rnd() * 0.4 : 0.035 + rnd() * 0.04,
      width: beam ? 3.0 + rnd() * 2.0 : spark ? 0.9 + rnd() * 0.5 : 0.45 + rnd() * 0.25,
      pick: u,
      blur: beam ? 0.6 + rnd() * 0.4 : spark ? rnd() * 0.03 : 0.5 + rnd() * 0.5,
    });
  }
  return out;
})();
const bokehSeeds = (() => {
  const rnd = mulberry32(0xb0ce0005);
  return Array.from({ length: BOKEH }, () => ({
    x: rnd() * 2 - 1,
    y: rnd() * 2 - 1,
    size: 0.012 + rnd() * 0.03,
    amp: 0.02 + rnd() * 0.05,
    ph: rnd(),
    cycles: 1 + Math.floor(rnd() * 2),
    a: 0.015 + rnd() * 0.035,
    stretch: 1.6 + rnd() * 2.0,
  }));
})();

const STREAK_VERT = /* glsl */ `
attribute vec2 corner;         // x: 0 tail .. 1 head, y: -1..1 across
attribute vec4 iA;             // phi, radius, z0, cycles
attribute vec4 iB;             // brightness, width, colour index, blur
attribute vec3 iColor;
uniform float uPhase;          // 0..1 loop phase
uniform float uDepth;
uniform float uPx;             // drawing-buffer px per 2160-line px
uniform vec2 uRes;
varying vec2 vLocal;           // px along (0 = tail, uLen = head), px across
varying float vLen;
varying float vW;
varying vec3 vColor;
varying float vFade;
void main() {
  float phi = iA.x, R = iA.y, z0 = iA.z, cyc = iA.w;
  float zEnd = R / 1.6;                       // wrap once safely outside the frame
  float span = uDepth - zEnd;
  float s = fract(z0 + cyc * uPhase);
  float zH = -uDepth + s * span;              // head moves toward the camera
  float speed = cyc * span / ${LOOP.toFixed(1)}; // world units per frame
  float trail = speed * (1.2 + 36.0 * iB.w);  // longer when faster
  float zT = zH - trail;
  vec3 dir = vec3(cos(phi), sin(phi), 0.0);
  vec4 cH = projectionMatrix * modelViewMatrix * vec4(dir * R + vec3(0.0, 0.0, zH), 1.0);
  vec4 cT = projectionMatrix * modelViewMatrix * vec4(dir * R + vec3(0.0, 0.0, zT), 1.0);
  vec2 sH = cH.xy / cH.w * 0.5 * uRes;
  vec2 sT = cT.xy / cT.w * 0.5 * uRes;
  vec2 d = sH - sT;
  float len = max(length(d), 0.5);
  vec2 ax = d / len;
  vec2 pe = vec2(-ax.y, ax.x);
  // width in px: grows as the streak comes closer
  float w = iB.y * uPx * clamp(60.0 / -zH, 0.5, 14.0);
  float pad = w * 3.5;
  vec2 p = mix(sT - ax * pad, sH + ax * pad, corner.x) + pe * corner.y * pad;
  vLocal = vec2(mix(-pad, len + pad, corner.x), corner.y * pad);
  vLen = len;
  vW = w;
  vColor = iColor;
  // fade in from the far end, brighter as it approaches
  float dist = -zH;
  vFade = smoothstep(80.0, 18.0, dist) * iB.x * (0.5 + 1.0 * smoothstep(40.0, 6.0, dist));
  // keep a dark core around the vanishing point
  vFade *= smoothstep(0.22, 0.65, length(sH) / (0.5 * uRes.y));
  gl_Position = vec4(p / (0.5 * uRes) * cH.w, cH.z, cH.w);
}
`;

const STREAK_FRAG = /* glsl */ `
varying vec2 vLocal;
varying float vLen;
varying float vW;
varying vec3 vColor;
varying float vFade;
void main() {
  float a = clamp(vLocal.x / vLen, 0.0, 1.0);
  float inside = step(0.0, vLocal.x) * step(vLocal.x, vLen);
  float across = vLocal.y / vW;
  // tail: nearly even along its length, fading out at the far end
  float tail = inside * smoothstep(0.0, 0.35, a) * (0.55 + 0.45 * a);
  // RGB-split look: the streak's colour strand beside a green strand, plus a soft halo
  float sA = exp(-pow((across + 0.45) / 0.32, 2.0));
  float sB = exp(-pow((across - 0.45) / 0.32, 2.0));
  float halo = exp(-across * across * 0.3);
  vec3 green = vec3(0.35, 1.0, 0.3);
  vec3 c = (vColor * sA * 1.1 + mix(vColor, green, 0.8) * sB * 0.9 + vColor * halo * 0.18) * tail;
  float dh = length(vec2(vLocal.x - vLen, vLocal.y)) / vW;
  c += mix(vColor, vec3(0.85, 1.0, 1.0), 0.6) * (exp(-dh * dh * 1.6) * 1.5 + exp(-dh * dh * 0.35) * 0.25);
  gl_FragColor = vec4(c * vFade, 1.0);
}
`;

const BOKEH_VERT = /* glsl */ `
attribute vec2 corner;
attribute vec4 iA; // x, y, size, alpha
attribute float iStretch;
varying vec2 vC;
varying float vA;
uniform float uAspect;
void main() {
  vC = corner;
  vA = iA.w;
  vec2 p = iA.xy + corner * vec2(iA.z * iStretch / uAspect, iA.z);
  gl_Position = vec4(p, 0.0, 1.0);
}
`;
const BOKEH_FRAG = /* glsl */ `
varying vec2 vC;
varying float vA;
uniform vec3 uColor;
void main() {
  float d = length(vC);
  float disc = smoothstep(1.0, 0.75, d);
  gl_FragColor = vec4(uColor * disc * vA, 1.0);
}
`;

const createWorld = (props: WarpStreaksProps): WorldFactory => (renderer, w, h) => {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(props.background);
  const camera = new THREE.PerspectiveCamera(62, w / h, 0.05, 400);
  camera.position.set(0, 0, 0);

  // palette lookup by share
  const cols = props.palette.map(([hex]) => new THREE.Color(hex));
  const cum: number[] = [];
  props.palette.reduce((acc, [, s]) => {
    cum.push(acc + s);
    return acc + s;
  }, 0);
  const colorFor = (u: number) => {
    const i = cum.findIndex((c) => u <= c);
    return cols[i < 0 ? cols.length - 1 : i];
  };

  // ---- streaks ----
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setAttribute("corner", new THREE.Float32BufferAttribute([0, -1, 1, -1, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const iA = new Float32Array(STREAKS * 4);
  const iB = new Float32Array(STREAKS * 4);
  const iC = new Float32Array(STREAKS * 3);
  streakSeeds.forEach((s, i) => {
    iA.set([s.phi, s.r, s.z0, s.cycles], i * 4);
    iB.set([s.bright, s.width, 0, s.blur], i * 4);
    const c = colorFor(s.pick);
    iC.set([c.r, c.g, c.b], i * 3);
  });
  g.setAttribute("iA", new THREE.InstancedBufferAttribute(iA, 4));
  g.setAttribute("iB", new THREE.InstancedBufferAttribute(iB, 4));
  g.setAttribute("iColor", new THREE.InstancedBufferAttribute(iC, 3));
  g.instanceCount = STREAKS;
  const px = h / 2160;
  const streakMat = new THREE.ShaderMaterial({
    vertexShader: STREAK_VERT,
    fragmentShader: STREAK_FRAG,
    uniforms: {
      uPhase: { value: 0 },
      uDepth: { value: DEPTH },
      uPx: { value: px },
      uRes: { value: new THREE.Vector2(w, h) },
    },
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const streaks = new THREE.Mesh(g, streakMat);
  streaks.frustumCulled = false;
  scene.add(streaks);

  // ---- bokeh (screen space, behind) ----
  const bg = new THREE.InstancedBufferGeometry();
  bg.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  bg.setAttribute("corner", new THREE.Float32BufferAttribute([-1, -1, 1, -1, 1, 1, -1, 1], 2));
  bg.setIndex([0, 1, 2, 0, 2, 3]);
  const bA = new THREE.InstancedBufferAttribute(new Float32Array(BOKEH * 4), 4);
  const bS = new THREE.InstancedBufferAttribute(new Float32Array(bokehSeeds.map((b) => b.stretch)), 1);
  bg.setAttribute("iA", bA);
  bg.setAttribute("iStretch", bS);
  bg.instanceCount = BOKEH;
  const bokehMat = new THREE.ShaderMaterial({
    vertexShader: BOKEH_VERT,
    fragmentShader: BOKEH_FRAG,
    uniforms: { uAspect: { value: w / h }, uColor: { value: new THREE.Color(props.bokeh) } },
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const bokeh = new THREE.Mesh(bg, bokehMat);
  bokeh.frustumCulled = false;
  bokeh.renderOrder = -1;
  scene.add(bokeh);

  const post = new PostPipeline(w, h, {
    samples: 4,
    bloom: { strength: 0.85, radius: 1.2, levels: 6 },
    final: { exposure: 1.0, tone: "aces", grain: 0.015, grainFloor: 0.03, blackGate: true, ca: 0.004, saturation: 1.15 },
  });

  return {
    update: (frame) => {
      const p = loopPhase(frame);
      const th = loopTheta(frame);
      streakMat.uniforms.uPhase.value = p;
      camera.rotation.set(0, 0, (3 * Math.PI) / 180 * Math.sin(th));
      camera.updateMatrixWorld();
      bokehSeeds.forEach((b, i) => {
        const a = th * b.cycles + b.ph * Math.PI * 2;
        bA.setXYZW(i, b.x + Math.cos(a) * b.amp, b.y + Math.sin(a) * b.amp * 0.6, b.size, b.a);
      });
      bA.needsUpdate = true;
    },
    render: (r, lf) => post.render(r, scene, camera, lf),
    dispose: () => {
      post.dispose();
      g.dispose();
      bg.dispose();
      streakMat.dispose();
      bokehMat.dispose();
    },
  };
};

export const WarpStreaks: React.FC<WarpStreaksProps> = (props) => {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const factory = useCallback(createWorld(props), [JSON.stringify(props)]);
  return <ThreeStage factory={factory} />;
};

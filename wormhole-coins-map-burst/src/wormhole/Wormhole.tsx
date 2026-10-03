// Look 1 — Hyperspace Wormhole (three.js, 20s loop).
// ~3,000 instanced streak ribbons on a twisting, curving tunnel. Streak depth
// lives in a repeating segment of length L; over the loop the camera travels
// exactly N·L, the twist turns a whole number of times, and the flashes sit at
// fixed frames, so frame 600 == frame 0.
import { ThreeCanvas } from "@remotion/three";
import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { PostRender } from "../lib/post";
import { hexToLinear } from "../lib/math";
import { mulberry32 } from "../lib/random";
import { WORMHOLE_VERSIONS, type WormholePalette } from "../versions";

// Colourways differ only in hue: each colour is scaled to the luminance of the
// same slot in the first (reference) colourway, so a bright hue like cyan
// does not blow out where violet sits comfortably.
const lum = (c: [number, number, number]) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const matched = (palette: WormholePalette, key: "streakA" | "streakB" | "accent" | "glow") => {
  const c = hexToLinear(palette[key]);
  const target = lum(hexToLinear(WORMHOLE_VERSIONS[0][key]));
  const k = target / Math.max(1e-4, lum(c));
  return new THREE.Vector3(c[0] * k, c[1] * k, c[2] * k);
};

export const WORMHOLE_FRAMES = 600;
const L = 140; // repeating segment length (world units)
const N = 4; // segments travelled per loop
const TWIST_TURNS = 1; // whole turns of tunnel rotation per loop
const SEG = 12; // ribbon segments along each streak
const MAIN = 1400;
const BANDS = 160; // thick soft ribbons (first BANDS of MAIN)
const GLYPHS = 30;
const FLASH_PER = 450;
const FLASHES = [104, 296, 486]; // fixed frames

// Envelope of a flash started at frame f0 (fast attack, ~0.6s decay).
const flashEnv = (frame: number, f0: number) => {
  const dt = frame - f0;
  if (dt < -3 || dt > 60) return 0;
  if (dt < 0) return (dt + 3) / 3;
  return Math.exp(-dt / 11) * (1 - Math.max(0, dt - 45) / 15);
};

// Module-level seeded data: identical in every tab.
const buildData = (seed: number) => {
  const rnd = mulberry32(seed);
  const total = MAIN + GLYPHS + FLASH_PER * 3;
  const a = {
    theta: new Float32Array(total),
    radius: new Float32Array(total),
    z0: new Float32Array(total),
    len: new Float32Array(total),
    width: new Float32Array(total),
    speed: new Float32Array(total),
    colorIdx: new Float32Array(total),
    bright: new Float32Array(total),
    kind: new Float32Array(total),
    group: new Float32Array(total),
  };
  for (let i = 0; i < total; i++) {
    const isGlyph = i >= MAIN && i < MAIN + GLYPHS;
    const isFlash = i >= MAIN + GLYPHS;
    const isBand = i < BANDS;
    const group = isFlash ? 1 + Math.floor((i - MAIN - GLYPHS) / FLASH_PER) : 0;
    // Most streaks travel in bundles (similar angle) so they read as thick glowing ribbons.
    const bundle = Math.floor(rnd() * 14);
    a.theta[i] = rnd() < 0.65 && !isGlyph ? (bundle / 14) * Math.PI * 2 + (rnd() - 0.5) * 0.22 : rnd() * Math.PI * 2;
    // Tunnel wall: most streaks at r≈2.2–6, a thin inner population.
    const r0 = rnd();
    a.radius[i] = isFlash ? 0.5 + rnd() * 2.8 : r0 < 0.15 ? 0.9 + rnd() * 1.3 : 2.0 + Math.pow(rnd(), 0.8) * 5.5;
    a.z0[i] = rnd() * L;
    a.len[i] = isBand ? 14 + rnd() * 30 : isGlyph ? 0.4 + rnd() * 0.5 : isFlash ? 4 + rnd() * 10 : 2.5 + Math.pow(rnd(), 1.5) * 14;
    a.width[i] = isBand ? 0.1 + rnd() * 0.2 : isGlyph ? 0.05 + rnd() * 0.05 : isFlash ? 0.04 + rnd() * 0.05 : 0.025 + Math.pow(rnd(), 2) * 0.09;
    a.speed[i] = rnd() < 0.25 ? 2 : 1; // integer multipliers keep the loop exact
    const c = rnd();
    // 0 streakA, 1 streakB, 2 accent, 3 white
    a.colorIdx[i] = isBand ? (c < 0.6 ? 4 : c < 0.85 ? 0 : c < 0.93 ? 3 : 1) : isGlyph ? 2 : isFlash ? (c < 0.55 ? 3 : c < 0.8 ? 0 : 2) : c < 0.35 ? 0 : c < 0.62 ? 4 : c < 0.82 ? 1 : c < 0.92 ? 2 : 3;
    a.bright[i] = isBand ? 2.0 + rnd() * 3.5 : isGlyph ? 0.12 + rnd() * 0.15 : isFlash ? 0.6 + rnd() * 0.9 : 0.06 + Math.pow(rnd(), 3) * 1.0;
    a.kind[i] = isGlyph ? 1 : isBand ? 2 : 0;
    a.group[i] = group;
  }
  return { a, total };
};
const DATA = buildData(0x5eed01);

const vertexShader = /* glsl */ `
  attribute float aS;
  attribute float aSide;
  attribute float aTheta, aRadius, aZ0, aLen, aWidth, aSpeed, aColorIdx, aBright, aKind, aGroup;
  uniform float uTravel, uL, uTwist, uPhase;
  uniform vec3 uFlash;
  uniform vec3 uColA, uColB, uColAcc, uColW, uColG;
  varying vec3 vColor;
  varying float vSeed;
  varying float vAlpha;
  varying vec2 vUv;
  varying float vKind;

  vec2 center(float d) {
    // Gentle curve of the tunnel path; amplitude grows with depth so the
    // vanishing point wanders while the near field stays around the camera.
    float k = smoothstep(0.0, 70.0, d);
    return vec2(sin(d * 0.021 + uPhase) * 9.0 + sin(d * 0.047 - uPhase * 2.0) * 3.0,
                cos(d * 0.018 + uPhase + 1.3) * 6.0) * k;
  }
  vec3 tunnel(float d, float theta, float r) {
    float a = theta + d * 0.05 + uTwist;
    return vec3(center(d) + r * vec2(cos(a), sin(a)), -d);
  }
  void main() {
    float u = fract((aZ0 + uTravel * aSpeed) / uL);
    float depth = -3.0 + uL * (1.0 - u);             // passes behind the camera, wraps far away
    float near = 1.0 - smoothstep(4.0, 45.0, depth);
    float len = aLen * (1.0 + 2.2 * near * (1.0 - aKind));
    float d = depth + aS * len;
    vec3 p = tunnel(d, aTheta, aRadius);
    vec3 p2 = tunnel(d + 0.05, aTheta, aRadius);
    vec3 t = normalize(p2 - p);
    vec3 side = normalize(cross(t, normalize(p)));
    // Ribbons widen toward the frame edges (perspective + motion smear); fine streaks stay thin.
    float w = aWidth * (aKind > 1.5 ? mix(1.0, 1.0, near) : mix(1.0, 0.7, near));
    p += side * aSide * w;

    float flash = aGroup < 0.5 ? 1.0 : (aGroup < 1.5 ? uFlash.x : (aGroup < 2.5 ? uFlash.y : uFlash.z));
    float farFade = 1.0 - (aKind > 1.5 ? smoothstep(30.0, 95.0, depth) : smoothstep(10.0, 58.0, depth));
    float nearFade = aKind > 1.5 ? smoothstep(1.0, 6.0, depth) : smoothstep(-2.5, 0.8, depth);
    vAlpha = farFade * nearFade * flash * aBright;
    vec3 c = aColorIdx < 0.5 ? uColA : (aColorIdx < 1.5 ? uColB : (aColorIdx < 2.5 ? uColAcc : (aColorIdx < 3.5 ? uColW : uColG)));
    vSeed = aZ0 * 13.17 + aTheta * 7.3;
    vColor = c;
    vUv = vec2(aS, aSide);
    vKind = aKind;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying vec2 vUv;
  varying float vKind;
  varying float vSeed;
  float h1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  void main() {
    float a;
    if (vKind > 0.5 && vKind < 1.5) {
      // Small hollow data-block glyph: rectangle outline + a couple of bars.
      vec2 q = vec2(vUv.x, vUv.y * 0.5 + 0.5);
      float edge = max(step(q.x, 0.06) + step(0.94, q.x), step(q.y, 0.12) + step(0.88, q.y));
      float bars = step(0.3, q.x) * step(q.x, 0.36) + step(0.62, q.x) * step(q.x, 0.7);
      a = clamp(edge + bars * 0.6, 0.0, 1.0) * 1.4;
    } else if (vKind > 1.5) {
      // Thick soft ribbon with a glittery, grainy core.
      float across = exp(-vUv.y * vUv.y * 4.5) * (1.0 - vUv.y * vUv.y);
      float along = smoothstep(0.0, 0.25, vUv.x) * pow(1.0 - vUv.x, 1.6);
      float g = h1(floor(gl_FragCoord.xy * 0.5) + fract(vSeed) * 97.0); // fine screen-space glitter
      a = across * along * (0.85 + 0.3 * g * g);
    } else {
      float across = exp(-vUv.y * vUv.y * 3.0) * (1.0 - vUv.y * vUv.y);
      float along = smoothstep(0.0, 0.1, vUv.x) * pow(1.0 - vUv.x, 1.6);
      // Bright comet head at the near end.
      a = across * along * (1.0 + 2.0 * exp(-vUv.x * 25.0));
    }
    gl_FragColor = vec4(vColor * a * vAlpha, 1.0);
  }
`;

const Streaks: React.FC<{ palette: WormholePalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { geometry, material } = useMemo(() => {
    const base = new THREE.PlaneGeometry(1, 1, SEG, 1);
    const g = new THREE.InstancedBufferGeometry();
    const n = (SEG + 1) * 2;
    const aS = new Float32Array(n);
    const aSide = new Float32Array(n);
    const pos = base.attributes.position;
    for (let i = 0; i < n; i++) {
      aS[i] = pos.getX(i) + 0.5;
      aSide[i] = pos.getY(i) * 2;
    }
    g.index = base.index;
    g.setAttribute("position", base.attributes.position);
    g.setAttribute("aS", new THREE.BufferAttribute(aS, 1));
    g.setAttribute("aSide", new THREE.BufferAttribute(aSide, 1));
    const A = DATA.a;
    const inst = (name: string, arr: Float32Array) => g.setAttribute(name, new THREE.InstancedBufferAttribute(arr, 1));
    inst("aTheta", A.theta);
    inst("aRadius", A.radius);
    inst("aZ0", A.z0);
    inst("aLen", A.len);
    inst("aWidth", A.width);
    inst("aSpeed", A.speed);
    inst("aColorIdx", A.colorIdx);
    inst("aBright", A.bright);
    inst("aKind", A.kind);
    inst("aGroup", A.group);
    g.instanceCount = DATA.total;
    const m = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uTravel: { value: 0 },
        uL: { value: L },
        uTwist: { value: 0 },
        uPhase: { value: 0 },
        uFlash: { value: new THREE.Vector3() },
        uColA: { value: matched(palette, "streakA") },
        uColB: { value: matched(palette, "streakB") },
        uColAcc: { value: matched(palette, "accent") },
        uColW: { value: new THREE.Vector3(...hexToLinear(palette.white)) },
        uColG: { value: matched(palette, "glow") },
      },
    });
    return { geometry: g, material: m };
  }, [palette]);

  const t = (frame % WORMHOLE_FRAMES) / WORMHOLE_FRAMES;
  const u = material.uniforms;
  u.uTravel.value = N * L * t;
  u.uTwist.value = Math.PI * 2 * TWIST_TURNS * t;
  u.uPhase.value = Math.PI * 2 * t;
  u.uFlash.value.set(flashEnv(frame % WORMHOLE_FRAMES, FLASHES[0]), flashEnv(frame % WORMHOLE_FRAMES, FLASHES[1]), flashEnv(frame % WORMHOLE_FRAMES, FLASHES[2]));
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
};

// Vanishing-point glow + background haze, drawn as one full-screen quad behind the streaks.
const glowShader = {
  vertexShader: /* glsl */ `
    varying vec2 vNdc;
    void main() { vNdc = position.xy; gl_Position = vec4(position.xy, 0.999, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform vec2 uCenter;
    uniform float uAspect, uFlash;
    uniform vec3 uHaze, uCore, uWhite;
    uniform vec2 uHazePos;
    varying vec2 vNdc;
    void main() {
      vec2 p = (vNdc - uCenter) * vec2(uAspect, 1.0);
      float r = length(p);
      vec3 col = uCore * (0.25 * exp(-r * 16.0) + 0.03 * exp(-r * 3.0));
      vec2 hp = (vNdc - uHazePos) * vec2(uAspect, 1.0);
      col += uHaze * 0.0 * exp(-dot(hp, hp) * 0.9);
      col += uWhite * uFlash * (1.1 * exp(-r * 5.0) + 0.12 * exp(-r * 1.4));
      gl_FragColor = vec4(col, 1.0);
    }
  `,
};

const Backdrop: React.FC<{ palette: WormholePalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        ...glowShader,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uCenter: { value: new THREE.Vector2() },
          uAspect: { value: width / height },
          uFlash: { value: 0 },
          uHaze: { value: new THREE.Vector3(...hexToLinear(palette.haze)) },
          uCore: { value: matched(palette, "streakB").multiplyScalar(1.6) },
          uWhite: { value: new THREE.Vector3(...hexToLinear(palette.white)) },
          uHazePos: { value: new THREE.Vector2() },
        },
      }),
    [palette, width, height],
  );
  const f = frame % WORMHOLE_FRAMES;
  const t = f / WORMHOLE_FRAMES;
  const ph = Math.PI * 2 * t;
  // Project the tunnel centre at depth ~110 (same path function as the shader).
  const d = 110;
  const cx = Math.sin(d * 0.021 + ph) * 9 + Math.sin(d * 0.047 - ph * 2) * 3;
  const cy = Math.cos(d * 0.018 + ph + 1.3) * 6;
  const fov = (62 * Math.PI) / 180;
  const sy = 1 / Math.tan(fov / 2);
  // Camera is pitched up by 0.05 rad (vanishing point sits a little low).
  mat.uniforms.uCenter.value.set((cx / d) * sy / (width / height), (cy / d - Math.tan(0.05)) * sy);
  mat.uniforms.uHazePos.value.set(0.6 * Math.cos(ph), 0.7 + 0.2 * Math.sin(ph));
  mat.uniforms.uFlash.value = Math.max(...FLASHES.map((x) => flashEnv(f, x)));
  return (
    <mesh frustumCulled={false} renderOrder={-1} material={mat}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};

export const Wormhole: React.FC<{ palette: WormholePalette }> = ({ palette }) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={typeof window !== "undefined" ? window.devicePixelRatio : 1}
        gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        camera={{ fov: 62, near: 0.05, far: 400, position: [0, 0, 0], rotation: [0.05, 0, 0] }}
      >
        <color attach="background" args={["#000000"]} />
        <Backdrop palette={palette} />
        <Streaks palette={palette} />
        <PostRender bloomStrength={1.5} bloomRadius={0.8} bloomThreshold={0.45} exposure={1.25} chroma={0} vignette={0.35} grain={0.02} loopFrames={WORMHOLE_FRAMES} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

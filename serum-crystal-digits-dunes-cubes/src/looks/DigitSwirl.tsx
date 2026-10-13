import { useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";
import * as THREE from "three";
import { BG_DITHER_GLSL } from "../common/glsl";
import { bgDitherOffset, Pipeline, sharedBlueNoise } from "../common/Pipeline";
import { mulberry32 } from "../common/random";
import { SceneCanvas, TAU, useFrameRender } from "../common/SceneCanvas";

// Look 3 — Digit Swirl (20 s loop, 600 frames)

export type DigitSwirlProps = {
  digit: string; // base digit colour (mixed toward white)
  streak: string;
  ring: string;
  bg: string;
  haze: string;
};

const LOOP = 600;
const DIGITS = 7000;
const STREAKS = 400;
const TAGS = 20;
const FONT_FAMILY = "JetBrains Mono Digits";

// ---------------------------------------------------------------------------
// Tunnel path: quadratic Bézier from deep left (F) bending round toward the
// camera (N, passing to the right of it). Same maths in TS and GLSL.
const F = new THREE.Vector3(-1.5, 10.0, -30);
const K = new THREE.Vector3(-3.0, 0.5, -9.0);
const N = new THREE.Vector3(7.5, -4.5, 1.0);
const TUNNEL_R = 4.6;
const TWIST = 1.2; // radians of swirl along the path

const pathPoint = (s: number, out = new THREE.Vector3()) => {
  const a = (1 - s) * (1 - s);
  const b = 2 * (1 - s) * s;
  const c = s * s;
  return out.set(a * F.x + b * K.x + c * N.x, a * F.y + b * K.y + c * N.y, a * F.z + b * K.z + c * N.z);
};
const pathTangent = (s: number) =>
  new THREE.Vector3()
    .copy(K)
    .sub(F)
    .multiplyScalar(2 * (1 - s))
    .add(new THREE.Vector3().copy(N).sub(K).multiplyScalar(2 * s))
    .normalize();
const pathFrame = (s: number) => {
  const t = pathTangent(s);
  const n1 = new THREE.Vector3().crossVectors(t, new THREE.Vector3(0, 1, 0)).normalize();
  const n2 = new THREE.Vector3().crossVectors(n1, t).normalize();
  return { t, n1, n2 };
};

const PATH_GLSL = /* glsl */ `
const vec3 PF = vec3(${F.x.toFixed(4)}, ${F.y.toFixed(4)}, ${F.z.toFixed(4)});
const vec3 PK = vec3(${K.x.toFixed(4)}, ${K.y.toFixed(4)}, ${K.z.toFixed(4)});
const vec3 PN = vec3(${N.x.toFixed(4)}, ${N.y.toFixed(4)}, ${N.z.toFixed(4)});
vec3 pathPoint(float s) {
  return (1.0 - s) * (1.0 - s) * PF + 2.0 * (1.0 - s) * s * PK + s * s * PN;
}
vec3 pathTangent(float s) {
  return normalize(2.0 * (1.0 - s) * (PK - PF) + 2.0 * s * (PN - PK));
}
// position at path parameter s with a cross-section offset (radius r, angle a)
vec3 tunnelPoint(float s, float r, float a) {
  vec3 t = pathTangent(s);
  vec3 n1 = normalize(cross(t, vec3(0.0, 1.0, 0.0)));
  vec3 n2 = normalize(cross(n1, t));
  float ang = a + ${TWIST.toFixed(3)} * s;
  return pathPoint(s) + r * (cos(ang) * n1 + sin(ang) * n2);
}
`;

// ---------------------------------------------------------------------------
// Seeded particle tables (built once).
const DIGIT_DATA = (() => {
  const rng = mulberry32(0xd161);
  const u0 = new Float32Array(DIGITS);
  const laps = new Float32Array(DIGITS);
  const off = new Float32Array(DIGITS * 2);
  const size = new Float32Array(DIGITS);
  const digit = new Float32Array(DIGITS);
  const flick = new Float32Array(DIGITS * 3);
  for (let i = 0; i < DIGITS; i++) {
    u0[i] = rng();
    laps[i] = 1 + Math.floor(rng() * 3); // whole laps per loop
    // denser toward the outer (left) wall, with a filled core
    // mostly on the tunnel wall (reads as a curved band), a few in the core
    const wall = rng() < 0.85;
    const r = wall ? 0.82 + 0.22 * rng() : Math.sqrt(rng()) * 0.8;
    const a = wall ? (rng() - 0.5) * 3.6 : rng() * TAU;
    off[i * 2] = r * TUNNEL_R;
    off[i * 2 + 1] = a;
    const big = rng() < 0.03;
    // size multiplier 1–8× of the base digit height
    size[i] = big ? 2.5 + rng() * 2.5 : 1 + Math.pow(rng(), 3.0) * 1.5;
    digit[i] = Math.floor(rng() * 10);
    flick[i * 3] = 4 + Math.floor(rng() * 40); // whole flicker cycles per loop
    flick[i * 3 + 1] = rng() * TAU;
    flick[i * 3 + 2] = rng(); // whiteness
  }
  return { u0, laps, off, size, digit, flick };
})();

const STREAK_DATA = (() => {
  const rng = mulberry32(0x57ea);
  const u0 = new Float32Array(STREAKS);
  const laps = new Float32Array(STREAKS);
  const off = new Float32Array(STREAKS * 2);
  const len = new Float32Array(STREAKS);
  for (let i = 0; i < STREAKS; i++) {
    u0[i] = rng();
    laps[i] = 2 + Math.floor(rng() * 3);
    off[i * 2] = (0.82 + 0.22 * rng()) * TUNNEL_R;
    off[i * 2 + 1] = (rng() - 0.5) * 3.6;
    len[i] = 0.02 + rng() * 0.05;
  }
  return { u0, laps, off, len };
})();

const TAG_DATA = (() => {
  const rng = mulberry32(0x7a65);
  const u0 = new Float32Array(TAGS);
  const off = new Float32Array(TAGS * 2);
  const seed = new Float32Array(TAGS);
  for (let i = 0; i < TAGS; i++) {
    u0[i] = rng();
    off[i * 2] = (0.85 + 0.15 * rng()) * TUNNEL_R;
    off[i * 2 + 1] = (rng() - 0.5) * 3.2;
    seed[i] = Math.floor(rng() * 1000);
  }
  return { u0, off, seed };
})();

// ---------------------------------------------------------------------------
const makeAtlas = (blur: number) => {
  const cell = 128;
  const c = document.createElement("canvas");
  c.width = cell * 10;
  c.height = cell;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${blur > 0 ? 84 : 96}px "${FONT_FAMILY}"`;
  if (blur > 0) ctx.filter = `blur(${blur}px)`;
  for (let d = 0; d < 10; d++) ctx.fillText(String(d), cell * d + cell / 2, cell / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
};

const makeQuad = () => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return g;
};

const Scene: React.FC<DigitSwirlProps> = (p) => {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);

  const built = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, 16 / 9, 0.1, 80);

    const bgMat = new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uBg: { value: new THREE.Color(p.bg) },
        uHaze: { value: new THREE.Color(p.haze) },
        uHazePos: { value: new THREE.Vector2(0.36, 0.56) },
        uAspect: { value: 16 / 9 },
        uBlueNoise: { value: sharedBlueNoise },
        uBnOffset: { value: new THREE.Vector3() },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
      fragmentShader: /* glsl */ `
        ${BG_DITHER_GLSL}
        uniform vec3 uBg; uniform vec3 uHaze; uniform vec2 uHazePos; uniform float uAspect;
        varying vec2 vUv;
        void main() {
          vec2 d = (vUv - uHazePos) * vec2(uAspect, 1.0);
          d.x *= 0.7;
          float h = exp(-dot(d, d) * 3.2);
          vec3 c = uBg + uHaze * h;
          // soft light rays fanning out from the tunnel wall at the left
          vec2 o = (vUv - vec2(-0.05, 0.42)) * vec2(uAspect, 1.0);
          float ang = atan(o.y, o.x);
          float rays = pow(0.5 + 0.5 * sin(ang * 26.0 + 1.3), 6.0) * 0.6 + pow(0.5 + 0.5 * sin(ang * 11.0 + 0.4), 4.0) * 0.4;
          float fall = exp(-length(o) * 2.6) * smoothstep(0.02, 0.25, length(o));
          c += uHaze * rays * fall * 6.0;
          c += bgDither(gl_FragCoord.xy) * (1.0 / 1024.0);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    bg.frustumCulled = false;
    bg.renderOrder = -10;
    scene.add(bg);

    // ---- arc rings: thin emissive tubes, left (outer) wall of the bend ----
    const ringMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(p.ring) }, uK: { value: 1 } },
      vertexShader: `varying vec2 vUv; varying float vFade; attribute float aFade;
        void main(){ vUv = uv; vFade = aFade; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform vec3 uColor; varying vec2 vUv; varying float vFade;
        void main(){
          float ends = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
          gl_FragColor = vec4(uColor * ends * vFade * 0.5, 1.0);
        }`,
    });
    // Arcs: partial cross-section rings of the tunnel wall on the outer (left)
    // side of the bend; they read as concentric "(" arcs at the left.
    const RING_S = [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6];
    RING_S.forEach((sv, k) => {
      const { n1, n2 } = pathFrame(sv);
      const c = pathPoint(sv);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = -1.6 + (3.2 * i) / 64;
        const r = TUNNEL_R * 1.12;
        pts.push(c.clone().addScaledVector(n1, r * Math.cos(a)).addScaledVector(n2, r * Math.sin(a)));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.TubeGeometry(curve, 128, 0.008 + 0.003 * k, 6, false);
      const fade = new Float32Array(tube.attributes.position.count).fill(0.4 + 0.6 * (k / (RING_S.length - 1)));
      tube.setAttribute("aFade", new THREE.BufferAttribute(fade, 1));
      const m = new THREE.Mesh(tube, ringMat);
      m.frustumCulled = false;
      scene.add(m);
    });

    // ---- digits ----
    const atlasSharp = makeAtlas(0);
    const atlasBlur = makeAtlas(4);
    const dGeo = makeQuad();
    const D = DIGIT_DATA;
    dGeo.setAttribute("aU0", new THREE.InstancedBufferAttribute(D.u0, 1));
    dGeo.setAttribute("aLaps", new THREE.InstancedBufferAttribute(D.laps, 1));
    dGeo.setAttribute("aOff", new THREE.InstancedBufferAttribute(D.off, 2));
    dGeo.setAttribute("aSize", new THREE.InstancedBufferAttribute(D.size, 1));
    dGeo.setAttribute("aDigit", new THREE.InstancedBufferAttribute(D.digit, 1));
    dGeo.setAttribute("aFlick", new THREE.InstancedBufferAttribute(D.flick, 3));
    dGeo.instanceCount = DIGITS;
    const digitMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uT: { value: 0 },
        uSharp: { value: atlasSharp },
        uBlur: { value: atlasBlur },
        uColor: { value: new THREE.Color(p.digit) },
        uFocus: { value: 9 },
        uBaseSize: { value: 0.072 },
      },
      vertexShader: /* glsl */ `
        ${PATH_GLSL}
        attribute float aU0; attribute float aLaps; attribute vec2 aOff; attribute float aSize;
        attribute float aDigit; attribute vec3 aFlick;
        uniform float uT; uniform float uFocus; uniform float uBaseSize;
        varying vec2 vUv; varying float vDigit; varying float vAlpha; varying float vBlur; varying float vWhite;
        void main() {
          float s = fract(aU0 + aLaps * uT);
          vec3 wp = tunnelPoint(s, aOff.x, aOff.y);
          vec4 mv = modelViewMatrix * vec4(wp, 1.0);
          float dist = -mv.z;
          float coc = clamp(abs(dist - uFocus) / 7.0, 0.0, 1.0);
          coc = max(coc, step(3.5, aSize) * 0.45);
          float sz = uBaseSize * aSize * (1.0 + 0.35 * coc);
          mv.xy += position.xy * sz * vec2(0.62, 1.0) * 1.15;
          gl_Position = projectionMatrix * mv;
          float fadeIn = smoothstep(0.05, 0.35, s) * (1.0 - smoothstep(0.93, 1.0, s));
          float nearFade = smoothstep(0.25, 1.2, dist);
          float fl = 0.62 + 0.38 * sin(aFlick.x * 6.2831853 * uT + aFlick.y);
          vAlpha = fadeIn * nearFade * fl * mix(1.0, 0.35, coc) * clamp(12.0 / dist, 0.4, 1.0);
          vBlur = coc;
          vUv = uv;
          vDigit = aDigit;
          vWhite = aFlick.z;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform sampler2D uSharp; uniform sampler2D uBlur; uniform vec3 uColor;
        varying vec2 vUv; varying float vDigit; varying float vAlpha; varying float vBlur; varying float vWhite;
        void main() {
          vec2 auv = vec2((vDigit + vUv.x) / 10.0, vUv.y);
          float a = mix(texture2D(uSharp, auv).a, texture2D(uBlur, auv).a, smoothstep(0.15, 0.7, vBlur));
          vec3 col = mix(uColor, vec3(1.0), vWhite * vWhite * vWhite * 0.6 * (1.0 - vBlur));
          gl_FragColor = vec4(col * a * vAlpha * 2.3, 1.0);
        }
      `,
    });
    const digits = new THREE.Mesh(dGeo, digitMat);
    digits.frustumCulled = false;
    scene.add(digits);

    // ---- streaks: camera-facing ribbons between two points on the flow ----
    const sGeo = makeQuad();
    const S = STREAK_DATA;
    sGeo.setAttribute("aU0", new THREE.InstancedBufferAttribute(S.u0, 1));
    sGeo.setAttribute("aLaps", new THREE.InstancedBufferAttribute(S.laps, 1));
    sGeo.setAttribute("aOff", new THREE.InstancedBufferAttribute(S.off, 2));
    sGeo.setAttribute("aLen", new THREE.InstancedBufferAttribute(S.len, 1));
    sGeo.instanceCount = STREAKS;
    const ribbonVert = (widthExpr: string) => /* glsl */ `
      ${PATH_GLSL}
      attribute float aU0; attribute float aLaps; attribute vec2 aOff; attribute float aLen;
      uniform float uT;
      varying vec2 vUv; varying float vAlpha;
      void main() {
        float s = fract(aU0 + aLaps * uT);
        float s0 = max(s - aLen, 0.0);
        float sv = mix(s0, s, uv.x);
        vec3 wp = tunnelPoint(sv, aOff.x, aOff.y);
        vec3 wq = tunnelPoint(min(sv + 0.002, 1.0), aOff.x, aOff.y);
        vec4 a = modelViewMatrix * vec4(wp, 1.0);
        vec4 b = modelViewMatrix * vec4(wq, 1.0);
        vec3 dir = normalize(b.xyz - a.xyz);
        vec3 side = normalize(cross(dir, normalize(a.xyz)));
        a.xyz += side * (uv.y - 0.5) * ${widthExpr};
        gl_Position = projectionMatrix * a;
        float dist = -a.z;
        vAlpha = smoothstep(0.05, 0.35, s) * (1.0 - smoothstep(0.92, 1.0, s)) * smoothstep(0.3, 1.5, dist);
        vUv = uv;
      }
    `;
    const streakMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uColor: { value: new THREE.Color(p.streak) } },
      vertexShader: ribbonVert("0.08"),
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying vec2 vUv; varying float vAlpha;
        void main() {
          float across = exp(-pow((vUv.y - 0.5) * 4.0, 2.0));
          float along = pow(vUv.x, 1.6);
          gl_FragColor = vec4(uColor * across * along * vAlpha * 0.32, 1.0);
        }
      `,
    });
    const streaks = new THREE.Mesh(sGeo, streakMat);
    streaks.frustumCulled = false;
    scene.add(streaks);

    // ---- barcode tags ----
    const tGeo = makeQuad();
    const T = TAG_DATA;
    tGeo.setAttribute("aU0", new THREE.InstancedBufferAttribute(T.u0, 1));
    tGeo.setAttribute("aLaps", new THREE.InstancedBufferAttribute(new Float32Array(TAGS).fill(1), 1));
    tGeo.setAttribute("aOff", new THREE.InstancedBufferAttribute(T.off, 2));
    tGeo.setAttribute("aLen", new THREE.InstancedBufferAttribute(new Float32Array(TAGS).fill(0.03), 1));
    tGeo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(T.seed, 1));
    tGeo.instanceCount = TAGS;
    const tagMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uT: { value: 0 }, uColor: { value: new THREE.Color(p.digit) } },
      vertexShader: ribbonVert("0.05").replace("varying float vAlpha;", "varying float vAlpha; attribute float aSeed; varying float vSeed;").replace("vUv = uv;", "vUv = uv; vSeed = aSeed;"),
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying vec2 vUv; varying float vAlpha; varying float vSeed;
        float h(float n) { return fract(sin(n * 12.9898 + vSeed * 78.233) * 43758.5453); }
        void main() {
          float bars = 22.0;
          float x = vUv.x * bars;
          float i = floor(x);
          float f = fract(x);
          float w = fwidth(x) + 1e-3;
          float on = step(0.45, h(i)) * smoothstep(0.0, w, f) * smoothstep(0.0, w, 0.8 - f);
          float edge = smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
          gl_FragColor = vec4(uColor * on * edge * vAlpha * 0.3, 1.0);
        }
      `,
    });
    const tags = new THREE.Mesh(tGeo, tagMat);
    tags.frustumCulled = false;
    scene.add(tags);

    const pipeline = new Pipeline({
      period: LOOP,
      samples: 4,
      bloom: { threshold: 0.25, strength: 1.25, knee: 0.3 },
      vignette: 0.5,
      vignetteColor: new THREE.Color(0x000000),
      grain: 0.015,
    });
    return { scene, camera, bgMat, digitMat, streakMat, tagMat, pipeline, atlasSharp, atlasBlur };
  }, [gl, p]);

  useEffect(
    () => () => {
      built.pipeline.dispose();
      built.atlasSharp.dispose();
      built.atlasBlur.dispose();
    },
    [built],
  );

  useFrameRender((frame) => {
    const { scene, camera, bgMat, digitMat, streakMat, tagMat, pipeline } = built;
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const u = f / LOOP;
    const ph = u * TAU;
    camera.aspect = size.width / size.height;
    camera.position.set(0.12 * Math.sin(ph), 0.08 * Math.sin(2 * ph), 0);
    camera.lookAt(2.4 + 0.1 * Math.cos(ph), 0.4, -10);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    bgMat.uniforms.uAspect.value = camera.aspect;
    bgMat.uniforms.uBnOffset.value.copy(bgDitherOffset(frame, LOOP));
    digitMat.uniforms.uT.value = u;
    streakMat.uniforms.uT.value = u;
    tagMat.uniforms.uT.value = u;
    pipeline.render(gl, scene, camera, frame);
  });
  return null;
};

// Loads the OFL font before the canvas mounts; the atlas is built once.
export const DigitSwirl: React.FC<DigitSwirlProps> = (props) => {
  const [handle] = useState(() => delayRender("Loading JetBrains Mono"));
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const face = new FontFace(FONT_FAMILY, `url(${staticFile("fonts/JetBrainsMono-Medium.woff2")})`, { weight: "500" });
    face
      .load()
      .then((f) => {
        (document.fonts as unknown as { add: (f: FontFace) => void }).add(f);
        setReady(true);
      })
      .catch((e) => {
        throw e;
      });
  }, []);
  useEffect(() => {
    // the ThreeCanvas has registered its own delayRender by now
    if (ready) continueRender(handle);
  }, [ready, handle]);
  if (!ready) return null;
  return (
    <SceneCanvas>
      <Scene {...props} />
    </SceneCanvas>
  );
};

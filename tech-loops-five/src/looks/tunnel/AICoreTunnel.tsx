import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { LOOP, TAU, loopT } from "../../lib/loop";
import { mulberry32 } from "../../lib/random";
import { canvasScale } from "../../lib/useFrameCanvas";
import type { TunnelVersion } from "../../versions";
import { loadTunnelTextures, type TunnelTextures } from "./textures";

/**
 * Look 5 — AI Core Tunnel (3D, @remotion/three, WebGL2).
 *
 * Spatial periodicity: streaks, panels and tokens are generated inside ONE
 * block of length L along the tunnel axis; the field repeats with period L.
 * The camera flies forward exactly N·L over 600 frames, so frame 600 shows
 * the same field as frame 0. (Implemented by wrapping each instance's
 * camera-relative depth modulo L in the vertex shader — identical to an
 * infinitely tiled field.) Emblem pulse and burst rotation are whole cycles.
 * No clocks: every uniform is computed from useCurrentFrame().
 */
const L = 360; // block length (world units)
const N = 1; // blocks travelled per loop (whole number)
const VISIBLE = 150; // instances further than this are faded out
const NEAR = 4; // how far past the camera an instance lives before wrapping
const FOV = 55;
const EMBLEM_Z = -80;

/* ───────────────────────── shaders ───────────────────────── */

const WRAP = /* glsl */ `
  uniform float uTravel;
  uniform float uPeriod;
  uniform float uNear;
  float wrapZ(float z0) { return mod(z0 + uTravel, uPeriod) - uPeriod + uNear; }
  float depthFade(float z) {
    // fade in with distance, so instances wrapping to the far end never pop
    return smoothstep(-${VISIBLE.toFixed(1)}, -${(VISIBLE - 50).toFixed(1)}, z);
  }
`;

const streakVert = /* glsl */ `
  ${WRAP}
  uniform float uPxScale;
  attribute vec2 corner;
  attribute vec3 iPos;
  attribute float iLen;
  attribute float iWidth;
  attribute vec3 iColor;
  attribute float iAlpha;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vV;
  void main() {
    float z = wrapZ(iPos.z);
    vec3 p = vec3(iPos.xy, z + corner.y * iLen);
    vec2 t2 = vec2(iPos.y, -iPos.x);
    vec3 tang = vec3(t2 / max(length(t2), 1e-4), 0.0);
    float dist = max(0.2, -p.z);
    float w = max(iWidth, 1.25 * uPxScale * dist); // never thinner than ~1.25 px
    p += tang * corner.x * w;
    vAlpha = iAlpha * (iWidth / w) * depthFade(z);
    vColor = iColor;
    vV = corner.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const streakFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vV;
  void main() {
    float a = vAlpha * pow(vV, 1.6);
    gl_FragColor = vec4(vColor * a, a);
  }
`;

const panelVert = /* glsl */ `
  ${WRAP}
  attribute vec2 corner;
  attribute vec3 iPos;
  attribute vec2 iSize;
  attribute float iAxis;   // 0 = side wall (y/z plane), 1 = floor/ceiling (x/z plane)
  attribute vec2 iCell;    // atlas cell
  attribute float iAlpha;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    float z = wrapZ(iPos.z);
    vec3 p = iAxis < 0.5
      ? vec3(iPos.x, iPos.y + corner.y * iSize.y, z + corner.x * iSize.x)
      : vec3(iPos.x + corner.y * iSize.y, iPos.y, z + corner.x * iSize.x);
    vUv = (iCell + (corner + 0.5)) / 4.0;
    vAlpha = iAlpha * depthFade(z) * smoothstep(2.0, -6.0, z);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const panelFrag = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec3 uColor;
  varying vec2 vUv;
  varying float vAlpha;
  void main() {
    float m = texture2D(uTex, vUv).a;
    float a = m * vAlpha;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const tokenVert = /* glsl */ `
  ${WRAP}
  uniform float uSpin;
  attribute vec2 corner;
  attribute vec3 iPos;
  attribute float iSize;
  attribute float iKind;   // 0 hex, 1 rounded square
  attribute float iRot;
  attribute float iSpin;   // whole wobble cycles per loop
  attribute float iAlpha;
  varying vec2 vUvSharp;
  varying vec2 vUvBlur;
  varying float vBlur;
  varying float vAlpha;
  void main() {
    float z = wrapZ(iPos.z);
    float a = iRot + 0.35 * sin(iSpin * uSpin + iPos.z);
    vec2 c = mat2(cos(a), sin(a), -sin(a), cos(a)) * corner;
    vec3 p = vec3(iPos.xy + c * iSize, z);
    vec2 uv = corner + 0.5;
    vUvSharp = vec2((iKind * 2.0 + uv.x) / 4.0, uv.y);
    vUvBlur = vec2((iKind * 2.0 + 1.0 + uv.x) / 4.0, uv.y);
    float dist = -z;
    // mild depth of field: soft when very near, slightly soft far away
    vBlur = clamp(smoothstep(12.0, 3.0, dist) + 0.6 * smoothstep(60.0, 100.0, dist), 0.0, 1.0);
    vAlpha = iAlpha * depthFade(z) * smoothstep(0.5, 2.5, dist);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;
const tokenFrag = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec3 uColor;
  varying vec2 vUvSharp;
  varying vec2 vUvBlur;
  varying float vBlur;
  varying float vAlpha;
  void main() {
    float m = mix(texture2D(uTex, vUvSharp).a, texture2D(uTex, vUvBlur).a, vBlur);
    float a = m * vAlpha;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const spriteVert = /* glsl */ `
  uniform float uRot;
  varying vec2 vUv;
  void main() {
    vec2 c = position.xy;
    vec2 r = mat2(cos(uRot), sin(uRot), -sin(uRot), cos(uRot)) * c;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(r, position.z, 1.0);
  }
`;
const spriteFrag = /* glsl */ `
  uniform sampler2D uTex;
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float m = texture2D(uTex, vUv).a;
    gl_FragColor = vec4(uColor * m * uIntensity, m);
  }
`;

const horizonFrag = /* glsl */ `
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    float fx = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 1.4);
    float fy = 1.0 - abs(vUv.y - 0.5) * 2.0;
    float a = fx * fy * fy;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

/** ±1/255 triangular dither in display space, after bloom + tone mapping. */
const DitherShader = {
  uniforms: { tDiffuse: { value: null }, uFrame: { value: 0 } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uFrame;
    varying vec2 vUv;
    float hash(vec3 p) {
      p = fract(p * vec3(0.1031, 0.1030, 0.0973));
      p += dot(p, p.yxz + 33.33);
      return fract((p.x + p.y) * p.z);
    }
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 fc = floor(gl_FragCoord.xy);
      float n = hash(vec3(fc, uFrame)) + hash(vec3(fc.yx + 71.0, uFrame + 13.0)) - 1.0;
      gl_FragColor = vec4(c.rgb + n / 255.0, 1.0);
    }
  `,
};

/* ───────────────────────── geometry builders (seeded) ───────────────────────── */

const quadCorners = (v0: number) => {
  // corner.x ∈ [-0.5, 0.5]; corner.y ∈ [v0, v0+1]
  return new Float32Array([-0.5, v0, 0.5, v0, 0.5, v0 + 1, -0.5, v0 + 1]);
};

const baseQuad = (geo: THREE.InstancedBufferGeometry, v0: number) => {
  geo.setAttribute("corner", new THREE.BufferAttribute(quadCorners(v0), 2));
  // dummy position attribute for three's bounds checks
  geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(12), 3));
  geo.setIndex([0, 1, 2, 0, 2, 3]);
};

const lin = (hex: string) => new THREE.Color(hex); // sRGB hex → linear working colour

const buildStreaks = (v: TunnelVersion) => {
  const rnd = mulberry32(v.seed * 31 + 1);
  const COUNT = 15600; // 5200 per 120 units of tunnel
  const geo = new THREE.InstancedBufferGeometry();
  baseQuad(geo, 0);
  const pos = new Float32Array(COUNT * 3);
  const len = new Float32Array(COUNT);
  const wid = new Float32Array(COUNT);
  const col = new Float32Array(COUNT * 3);
  const alp = new Float32Array(COUNT);
  const accent = lin(v.accent);
  const hi = lin(v.highlight);
  const white = new THREE.Color(1, 1, 1);
  const red = lin("#FF4A5A");
  const green = lin("#4CFF8A");
  for (let i = 0; i < COUNT; i++) {
    let x: number;
    let y: number;
    if (rnd() < 0.16) {
      // horizon band: wide and flat, converging on the centre line
      x = (rnd() < 0.5 ? -1 : 1) * (1.5 + rnd() * 28);
      y = (rnd() - 0.5) * 0.9;
    } else {
      const a = rnd() * TAU;
      const r = 2.2 + Math.pow(rnd(), 0.8) * 16;
      x = Math.cos(a) * r * 1.5;
      y = Math.sin(a) * r;
    }
    pos.set([x, y, -rnd() * L], i * 3);
    len[i] = 1.5 + Math.pow(rnd(), 1.5) * 9;
    wid[i] = 0.008 + rnd() * 0.022;
    const k = rnd();
    const c = k < 0.66 ? accent : k < 0.86 ? white : k < 0.95 ? hi : k < 0.975 ? red : green;
    const boost = 0.35 + Math.pow(rnd(), 2) * 1.6;
    col.set([c.r * boost, c.g * boost, c.b * boost], i * 3);
    alp[i] = 0.25 + rnd() * 0.6;
  }
  geo.setAttribute("iPos", new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute("iLen", new THREE.InstancedBufferAttribute(len, 1));
  geo.setAttribute("iWidth", new THREE.InstancedBufferAttribute(wid, 1));
  geo.setAttribute("iColor", new THREE.InstancedBufferAttribute(col, 3));
  geo.setAttribute("iAlpha", new THREE.InstancedBufferAttribute(alp, 1));
  geo.instanceCount = COUNT;
  return geo;
};

const buildPanels = (v: TunnelVersion) => {
  const rnd = mulberry32(v.seed * 31 + 2);
  const COUNT = 900;
  const geo = new THREE.InstancedBufferGeometry();
  baseQuad(geo, -0.5);
  const pos = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT * 2);
  const axis = new Float32Array(COUNT);
  const cell = new Float32Array(COUNT * 2);
  const alp = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const side = Math.floor(rnd() * 4);
    const z = -rnd() * L;
    const w = 3 + rnd() * 6;
    const h = 1.2 + rnd() * 2.8;
    if (side < 2) {
      pos.set([(side ? 1 : -1) * (13 + rnd() * 6), (rnd() - 0.5) * 18, z], i * 3);
      axis[i] = 0;
    } else {
      pos.set([(rnd() - 0.5) * 30, (side === 2 ? 1 : -1) * (8 + rnd() * 4), z], i * 3);
      axis[i] = 1;
    }
    size.set([w, h], i * 2);
    cell.set([Math.floor(rnd() * 4), Math.floor(rnd() * 4)], i * 2);
    alp[i] = 0.07 + rnd() * 0.2;
  }
  geo.setAttribute("iPos", new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute("iSize", new THREE.InstancedBufferAttribute(size, 2));
  geo.setAttribute("iAxis", new THREE.InstancedBufferAttribute(axis, 1));
  geo.setAttribute("iCell", new THREE.InstancedBufferAttribute(cell, 2));
  geo.setAttribute("iAlpha", new THREE.InstancedBufferAttribute(alp, 1));
  geo.instanceCount = COUNT;
  return geo;
};

const buildTokens = (v: TunnelVersion) => {
  const rnd = mulberry32(v.seed * 31 + 3);
  const COUNT = 450;
  const geo = new THREE.InstancedBufferGeometry();
  baseQuad(geo, -0.5);
  const pos = new Float32Array(COUNT * 3);
  const size = new Float32Array(COUNT);
  const kind = new Float32Array(COUNT);
  const rot = new Float32Array(COUNT);
  const spin = new Float32Array(COUNT);
  const alp = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const a = rnd() * TAU;
    const r = 2.5 + rnd() * 9;
    pos.set([Math.cos(a) * r * 1.4, Math.sin(a) * r, -rnd() * L], i * 3);
    size[i] = 0.5 + rnd() * 1.1;
    kind[i] = rnd() < 0.5 ? 0 : 1;
    rot[i] = (rnd() - 0.5) * 0.6;
    spin[i] = 1 + Math.floor(rnd() * 3); // whole wobble cycles per loop
    alp[i] = 0.25 + rnd() * 0.45;
  }
  geo.setAttribute("iPos", new THREE.InstancedBufferAttribute(pos, 3));
  geo.setAttribute("iSize", new THREE.InstancedBufferAttribute(size, 1));
  geo.setAttribute("iKind", new THREE.InstancedBufferAttribute(kind, 1));
  geo.setAttribute("iRot", new THREE.InstancedBufferAttribute(rot, 1));
  geo.setAttribute("iSpin", new THREE.InstancedBufferAttribute(spin, 1));
  geo.setAttribute("iAlpha", new THREE.InstancedBufferAttribute(alp, 1));
  geo.instanceCount = COUNT;
  return geo;
};

/* ───────────────────────── scene ───────────────────────── */

const additive = (opts: THREE.ShaderMaterialParameters) =>
  new THREE.ShaderMaterial({
    ...opts,
    transparent: true,
    side: THREE.DoubleSide, // wall panels on the left/ceiling face away from the camera
    depthWrite: false,
    depthTest: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor, // shaders output premultiplied colour
    blendDst: THREE.OneFactor,
  });

const Scene: React.FC<{ v: TunnelVersion; tex: TunnelTextures }> = ({ v, tex }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame; // set during render, read in the render callback below
  const { gl, scene, camera, size } = useThree();

  const built = useMemo(() => {
    const accent = lin(v.accent);
    const hi = lin(v.highlight);
    const shared = { uTravel: { value: 0 }, uPeriod: { value: L }, uNear: { value: NEAR } };
    const streakMat = additive({ vertexShader: streakVert, fragmentShader: streakFrag, uniforms: { ...shared, uPxScale: { value: 0.001 } } });
    const panelMat = additive({ vertexShader: panelVert, fragmentShader: panelFrag, uniforms: { ...shared, uTex: { value: tex.panels }, uColor: { value: accent.clone().multiplyScalar(0.9) } } });
    const tokenMat = additive({ vertexShader: tokenVert, fragmentShader: tokenFrag, uniforms: { ...shared, uSpin: { value: 0 }, uTex: { value: tex.tokens }, uColor: { value: accent.clone().lerp(hi, 0.25).multiplyScalar(1.1) } } });
    const mk = (geo: THREE.BufferGeometry, mat: THREE.Material, order: number) => {
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      m.renderOrder = order;
      return m;
    };
    const group = new THREE.Group();
    group.add(mk(buildPanels(v), panelMat, 1));
    group.add(mk(buildStreaks(v), streakMat, 2));
    group.add(mk(buildTokens(v), tokenMat, 3));

    // emblem (fixed ahead of the camera: we never reach it)
    const sprite = (t: THREE.Texture, w: number, color: THREE.Color, intensity: number, z: number, order: number) => {
      const mat = additive({ vertexShader: spriteVert, fragmentShader: spriteFrag, uniforms: { uTex: { value: t }, uColor: { value: color }, uIntensity: { value: intensity }, uRot: { value: 0 } } });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w * (t.image.height / t.image.width)), mat);
      m.position.set(0, 0, z);
      m.frustumCulled = false;
      m.renderOrder = order;
      return m;
    };
    const halo = sprite(tex.burstLines, 96, accent.clone().multiplyScalar(0.05), 1, EMBLEM_Z - 2, 4);
    const lines = sprite(tex.burstLines, 54, accent.clone().lerp(new THREE.Color(1, 1, 1), 0.2), 0.75, EMBLEM_Z, 5);
    const digits = sprite(tex.burstDigits, 52, accent.clone().lerp(hi, 0.35), 0.9, EMBLEM_Z + 0.1, 6);
    const glow = sprite(tex.aiGlow, 34, accent, 0.4, EMBLEM_Z + 0.2, 7);
    const text = sprite(tex.aiText, 32, new THREE.Color(1, 1, 1), 1.0, EMBLEM_Z + 0.3, 8);
    // crisp letters are composited after bloom (see composer), only their blurred copy blooms
    const textScene = new THREE.Scene();
    textScene.add(text);
    const horizonMat = additive({
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);}`,
      fragmentShader: horizonFrag,
      uniforms: { uColor: { value: accent.clone().lerp(new THREE.Color(1, 1, 1), 0.4).multiplyScalar(0.9) } },
    });
    const horizon = new THREE.Mesh(new THREE.PlaneGeometry(260, 0.5), horizonMat);
    horizon.position.set(0, 0, -100);
    horizon.renderOrder = 0;
    group.add(horizon, halo, lines, digits, glow);

    return { group, textScene, streakMat, panelMat, tokenMat, halo, lines, digits, glow, text };
  }, [v, tex]);

  // background is set synchronously so the very first render already has it
  useMemo(() => {
    scene.background = lin(v.background);
  }, [scene, v.background]);

  const composer = useMemo(() => {
    const pr = gl.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(size.width * pr, size.height * pr, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(gl, rt);
    c.setPixelRatio(pr);
    c.setSize(size.width, size.height);
    c.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1920, 1080), 0.8, 0.45, 0.82);
    // UnrealBloom's blur kernels are fixed in pixels, so its look would change with output
    // resolution. Always run it on a 1920×1080 mip chain (upsampled into the full-res frame)
    // so 1080p previews, 4K renders and 6000-px stills all bloom the same way.
    const bloomSetSize = bloom.setSize.bind(bloom);
    bloom.setSize = () => bloomSetSize(1920, 1080);
    c.addPass(bloom);
    const letters = new RenderPass(built.textScene, camera);
    letters.clear = false;
    c.addPass(letters);
    c.addPass(new OutputPass());
    const dither = new ShaderPass(DitherShader);
    c.addPass(dither);
    return { c, dither };
  }, [gl, scene, camera, size.width, size.height, built.textScene]);

  useFrame(() => {
    const f = frameRef.current;
    const t = loopT(f);
    const travel = N * L * t; // exactly N·L per loop → frame 600 ≡ frame 0
    for (const m of [built.streakMat, built.panelMat, built.tokenMat]) m.uniforms.uTravel.value = travel;
    built.tokenMat.uniforms.uSpin.value = TAU * t;
    const pr = gl.getPixelRatio();
    built.streakMat.uniforms.uPxScale.value = (2 * Math.tan((FOV * Math.PI) / 360)) / (size.height * pr);
    // emblem: gentle pulse (5 per loop) + counter-rotating burst layers (1 turn each)
    const pulse = 0.5 + 0.5 * Math.sin(TAU * 5 * t);
    const s = 1 + 0.035 * pulse;
    built.text.scale.setScalar(s);
    built.glow.scale.setScalar(s * 1.02);
    (built.glow.material as THREE.ShaderMaterial).uniforms.uIntensity.value = 0.8 + 0.4 * pulse; // capped so the letters never wash out
    built.lines.scale.setScalar(1 + 0.05 * pulse);
    (built.lines.material as THREE.ShaderMaterial).uniforms.uRot.value = TAU * t;
    (built.digits.material as THREE.ShaderMaterial).uniforms.uRot.value = -TAU * t;
    (built.halo.material as THREE.ShaderMaterial).uniforms.uRot.value = -TAU * t * 0.5 * 2; // 1 turn
    composer.dither.uniforms.uFrame.value = ((f % LOOP) + LOOP) % LOOP;
    composer.c.render();
  }, 1);

  // attached during React's commit, i.e. before Remotion's frame advance runs
  return <primitive object={built.group} />;
};

export const AICoreTunnel: React.FC<{ v: TunnelVersion }> = ({ v }) => {
  const { width, height } = useVideoConfig();
  const [tex, setTex] = useState<TunnelTextures | null>(null);
  // texture loading gate (fonts + canvas drawing), not a visual state
  const [handle] = useState(() => delayRender("Building tunnel textures"));
  useEffect(() => {
    loadTunnelTextures().then((t) => {
      setTex(t);
      continueRender(handle);
    });
  }, [handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: v.background }}>
      {tex ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={canvasScale()}
          linear={false}
          flat
          gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
          camera={{ fov: FOV, near: 0.1, far: 500, position: [0, 0, 0] }}
        >
          <Scene v={v} tex={tex} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};

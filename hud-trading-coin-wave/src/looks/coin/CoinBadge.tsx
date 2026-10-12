import React, { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { cyc, loopFrame, LOOP, mulberry32, TAU } from "../../lib/random";
import { SYMBOLS, SymbolKey } from "./symbols";
import { periodicNoise } from "../../lib/noise";
import { FINAL_PASS } from "../../lib/finalPass";

export type CoinBadgeProps = {
  symbol: SymbolKey;
  ring: string; // emissive ring core
  rays: string; // circuit rays + accents
  rays2: string; // warm tint of the rays next to the ring
  nebula: string; // background nebula
  nebula2: string; // secondary nebula tint
  face: string; // glossy face
  metal: string; // symbol
};

// ------------------------------------------------------------ geometry --
const RB = 1; // ring radius (world units)
const TILT = (44 * Math.PI) / 180;

type RayData = { geo: THREE.BufferGeometry };

/** ~90 circuit traces: radial, 1–2 right-angle-style bends, end dot. Ribbons with along-distance for pulses. */
const buildRays = (): RayData => {
  const r = mulberry32(0x3642360);
  const pos: number[] = [];
  const along: number[] = [];
  const meta: number[] = []; // [cycles, phase, base alpha, type]
  const len: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const N = 90;
  const hw = 0.0046;
  const quad = (ax: number, ay: number, bx: number, by: number, s0: number, s1: number, m: number[], L: number) => {
    const dx = bx - ax, dy = by - ay;
    const l = Math.hypot(dx, dy) || 1;
    const nx = (-dy / l) * hw * 2.2, ny = (dx / l) * hw * 2.2; // ribbon is wider than the line; edge fades in shader
    const v0 = pos.length / 3;
    const ext = hw; // small overlap at joints
    const ex = (dx / l) * ext, ey = (dy / l) * ext;
    for (const [x, y, s, a] of [
      [ax - nx - ex, ay - ny - ey, -1, s0 - ext],
      [ax + nx - ex, ay + ny - ey, 1, s0 - ext],
      [bx + nx + ex, by + ny + ey, 1, s1 + ext],
      [bx - nx + ex, by - ny + ey, -1, s1 + ext],
    ]) {
      pos.push(x, y, 0);
      uv.push(s, 0);
      along.push(a);
      meta.push(...m);
      len.push(L);
    }
    idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
  };
  const dot = (x: number, y: number, rad: number, m: number[], s: number, L: number) => {
    const v0 = pos.length / 3;
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      pos.push(x + dx * rad, y + dy * rad, 0.001);
      uv.push(dx, dy);
      along.push(s);
      meta.push(m[0], m[1], m[2], 1);
      len.push(L);
    }
    idx.push(v0, v0 + 1, v0 + 2, v0, v0 + 2, v0 + 3);
  };
  for (let i = 0; i < N; i++) {
    const th = (TAU * (i + 0.5)) / N + (r() - 0.5) * 0.012;
    const c = Math.cos(th), s = Math.sin(th);
    const r0 = RB * 1.1;
    const r1 = RB * (1.55 + 0.25 * Math.sin(th * 3 + 0.4) + r() * 0.12);
    const pts: [number, number][] = [[c * r0, s * r0], [c * r1, s * r1]];
    // first bend: snap to the nearer axis, keep the outward sense
    const horiz = Math.abs(c) > Math.abs(s) * (0.75 + r() * 0.5);
    const d1: [number, number] = horiz ? [Math.sign(c), 0] : [0, Math.sign(s)];
    const L1 = 0.25 + r() * 1.1;
    const p2: [number, number] = [pts[1][0] + d1[0] * L1, pts[1][1] + d1[1] * L1];
    pts.push(p2);
    if (r() < 0.55) {
      // second bend: diagonal outward
      const d2: [number, number] = [Math.SQRT1_2 * Math.sign(c), Math.SQRT1_2 * Math.sign(s)];
      const L2 = 0.2 + r() * 0.9;
      pts.push([p2[0] + d2[0] * L2, p2[1] + d2[1] * L2]);
    }
    let total = 0;
    for (let k = 1; k < pts.length; k++) total += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    // pulses: whole cycles per loop → period divides 600
    const m = [[1, 2, 3, 4, 5][Math.floor(r() * 5)], r(), 0.4 + r() * 0.4, 0];
    let acc = 0;
    for (let k = 1; k < pts.length; k++) {
      const l = Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      quad(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1], acc, acc + l, m, total);
      acc += l;
    }
    dot(pts[pts.length - 1][0], pts[pts.length - 1][1], 0.022, [m[0], m[1], m[2] * 0.5], total, total);
    dot(pts[0][0], pts[0][1], 0.02, m, 0, total);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("aAlong", new THREE.Float32BufferAttribute(along, 1));
  geo.setAttribute("aMeta", new THREE.Float32BufferAttribute(meta, 4));
  geo.setAttribute("aLen", new THREE.Float32BufferAttribute(len, 1));
  geo.setAttribute("aUv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  return { geo };
};

const RAY_VS = /* glsl */ `
attribute float aAlong; attribute vec2 aUv; attribute vec4 aMeta; attribute float aLen;
varying float vAlong; varying vec2 vUv2; varying vec4 vMeta; varying float vLen;
void main(){ vAlong=aAlong; vUv2=aUv; vMeta=aMeta; vLen=aLen;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const RAY_FS = /* glsl */ `
uniform vec3 uColor; uniform vec3 uColor2; uniform float uT;
varying float vAlong; varying vec2 vUv2; varying vec4 vMeta; varying float vLen;
void main(){
  float sp = fract(uT * vMeta.x + vMeta.y) * (vLen + 0.8) - 0.4;   // pulse position, outward
  float d = (vAlong - sp) / 0.16;
  float pulse = exp(-d*d) * step(vAlong, sp + 0.5);
  float a;
  if (vMeta.w > 0.5) {
    float r = length(vUv2);
    a = smoothstep(1.0, 0.55, r);
  } else {
    float e = abs(vUv2.x);
    a = smoothstep(1.0, 0.25, e) * 0.6 + smoothstep(0.42, 0.1, e) * 0.9;
  }
  float fade = exp(-vAlong / 1.15);                // traces fade with distance from the ring
  float b = vMeta.z * (0.1 + 1.25 * fade + 2.2 * pulse * (0.35 + fade));
  vec3 col = mix(uColor2, uColor, smoothstep(0.1, 1.5, vAlong));   // warm near the ring
  gl_FragColor = vec4(col * b * a, 1.0);
}`;

// Nebula: 2-fold-symmetric polar noise, so half a turn per loop is exact.
const buildNebulaTexture = (c1: string, c2: string) => {
  const S = 512;
  // octave o: 4·2^o cells around (angle/π, wraps) × 3·2^o cells out
  const oct = [0, 1, 2, 3, 4].map((o) => periodicNoise(0x7a2a9a + o, 4 << o, 3 << o));
  const noise = (o: number, a: number, rr: number) => oct[o](a * (4 << o), rr * (3 << o));
  const data = new Uint8Array(S * S * 4);
  const A = new THREE.Color(c1), B = new THREE.Color(c2);
  for (let j = 0; j < S; j++)
    for (let i = 0; i < S; i++) {
      const x = (i / S) * 2 - 1, y = (j / S) * 2 - 1;
      const rr = Math.hypot(x, y);
      const ang = (Math.atan2(y, x) / Math.PI + 1) % 1; // period π → 2-fold
      let n = 0, amp = 1, norm = 0;
      for (let o = 0; o < 5; o++) {
        n += noise(o, (ang + o * 0.137) % 1, rr * 0.9) * amp;
        norm += amp;
        amp *= 0.55;
      }
      n /= norm;
      // band along one diagonal (2-fold), fading with radius
      const band = 0.5 + 0.5 * Math.cos(2 * (Math.atan2(y, x) - 0.6));
      const streak = noise(4, (ang * 3) % 1, rr * 0.25);
      const dens = Math.max(0, n - 0.33) * 7 * (0.08 + 0.92 * band ** 3) * Math.exp(-((rr / 0.85) ** 2)) * 1.3 * (0.85 + 0.3 * streak);
      const mix = Math.min(1, Math.max(0, noise(2, (ang + 0.5) % 1, rr)));
      const k = (j * S + i) * 4;
      data[k] = Math.min(255, 255 * dens * (A.r * (1 - mix) + B.r * mix));
      data[k + 1] = Math.min(255, 255 * dens * (A.g * (1 - mix) + B.g * mix));
      data[k + 2] = Math.min(255, 255 * dens * (A.b * (1 - mix) + B.b * mix));
      data[k + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
};

const BOKEH_VS = /* glsl */ `
attribute vec4 aSeed; uniform float uT; uniform float uScale; uniform float uFocus;
varying float vAlpha; varying vec3 vCol; attribute vec3 aCol;
void main(){
  vec3 p = position;
  float ph = 6.2831853 * (uT * aSeed.x + aSeed.y);
  p.x += aSeed.z * sin(ph); p.y += aSeed.z * 0.6 * cos(ph); p.z += aSeed.w * sin(ph * 2.0 + 1.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = -mv.z;
  float coc = abs(depth - uFocus) * 0.9;
  gl_PointSize = uScale * (0.02 + coc * 0.05) / depth;
  vAlpha = 0.9 / (1.0 + coc * coc * 2.0);
  vCol = aCol;
}`;
const BOKEH_FS = /* glsl */ `
varying float vAlpha; varying vec3 vCol;
void main(){ vec2 c = gl_PointCoord * 2.0 - 1.0; float r = length(c);
  float a = smoothstep(1.0, 0.7, r) * (0.65 + 0.35 * smoothstep(0.5, 0.95, r));
  gl_FragColor = vec4(vCol * a * vAlpha, 1.0); }`;

const Scene: React.FC<CoinBadgeProps> = (p) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const { gl, scene, camera, size } = useThree();

  const objs = useMemo(() => {
    const root = new THREE.Group();
    // lights
    root.add(new THREE.AmbientLight(0xffffff, 0.25));
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(-3, 4, 6);
    root.add(key);
    const rim = new THREE.PointLight(new THREE.Color(p.rays), 3, 12, 2);
    rim.position.set(2.5, -1.5, 2);
    root.add(rim);

    // nebula backdrop
    const nebTex = buildNebulaTexture(p.nebula, p.nebula2);
    const neb = new THREE.Mesh(
      new THREE.PlaneGeometry(26, 26),
      new THREE.MeshBasicMaterial({ map: nebTex, toneMapped: false, depthWrite: false }),
    );
    neb.position.set(0, 0, -7);
    root.add(neb);

    // badge (tilted back)
    const badge = new THREE.Group();
    badge.rotation.set(-TILT, 0.12, 0.1);
    badge.position.set(-0.12, 0.18, 0);
    root.add(badge);
    const face = new THREE.Mesh(
      new THREE.CylinderGeometry(RB * 0.985, RB * 0.985, 0.06, 160),
      new THREE.MeshStandardMaterial({ color: p.face, roughness: 0.55, metalness: 0.0, transparent: true, opacity: 0.55 }),
    );
    face.rotation.x = Math.PI / 2;
    face.position.z = -0.03;
    badge.add(face);
    const bezel = new THREE.Mesh(
      new THREE.TorusGeometry(RB, 0.03, 32, 256),
      new THREE.MeshStandardMaterial({ color: p.face, roughness: 0.45, metalness: 0.6 }),
    );
    badge.add(bezel);
    const coreCol = new THREE.Color(p.ring).multiplyScalar(1.7);
    const core = new THREE.Mesh(new THREE.TorusGeometry(RB, 0.028, 24, 256), new THREE.MeshBasicMaterial({ color: coreCol, toneMapped: false }));
    core.position.z = 0.025;
    badge.add(core);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(RB * 1.045, 0.008, 12, 256),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(p.rays).multiplyScalar(1.6), toneMapped: false }),
    );
    badge.add(halo);

    const shapes = SYMBOLS[p.symbol]();
    const symGeo = new THREE.ExtrudeGeometry(shapes, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.045, bevelSize: 0.03, bevelSegments: 4, curveSegments: 48 });
    symGeo.scale(0.66, 0.66, 1);
    const sym = new THREE.Mesh(
      symGeo,
      new THREE.MeshStandardMaterial({ color: p.metal, roughness: 0.38, metalness: 0.15, emissive: new THREE.Color(p.metal), emissiveIntensity: 0.22 }),
    );
    sym.position.z = 0.02;
    badge.add(sym);

    // rays
    const rays = buildRays();
    const rayMat = new THREE.ShaderMaterial({
      vertexShader: RAY_VS,
      fragmentShader: RAY_FS,
      uniforms: { uColor: { value: new THREE.Color(p.rays) }, uColor2: { value: new THREE.Color(p.rays2) }, uT: { value: 0 } },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const rayMesh = new THREE.Mesh(rays.geo, rayMat);
    rayMesh.position.z = -0.08;
    badge.add(rayMesh);

    // bokeh particles
    const r = mulberry32(0x400);
    const NB = 420;
    const bp = new Float32Array(NB * 3), bs = new Float32Array(NB * 4), bc = new Float32Array(NB * 3);
    const cols = [new THREE.Color(p.rays), new THREE.Color(p.nebula2), new THREE.Color("#ffffff"), new THREE.Color(p.nebula)];
    for (let i = 0; i < NB; i++) {
      const u = (r() - 0.5) * 2.2, v = (r() - 0.5) * 0.9; // spread along the nebula diagonal
      bp.set([u * 6 - v * 3.5, u * 3.4 + v * 6, -4.5 + r() * 7], i * 3);
      bs.set([1 + Math.floor(r() * 2), r(), 0.05 + r() * 0.25, r() * 0.2], i * 4);
      const cc = cols[Math.floor(r() * 4)].clone().multiplyScalar(0.35 + r() * 0.65);
      bc.set([cc.r, cc.g, cc.b], i * 3);
    }
    const bgeo = new THREE.BufferGeometry();
    bgeo.setAttribute("position", new THREE.BufferAttribute(bp, 3));
    bgeo.setAttribute("aSeed", new THREE.BufferAttribute(bs, 4));
    bgeo.setAttribute("aCol", new THREE.BufferAttribute(bc, 3));
    const bmat = new THREE.ShaderMaterial({
      vertexShader: BOKEH_VS,
      fragmentShader: BOKEH_FS,
      uniforms: { uT: { value: 0 }, uScale: { value: 1000 }, uFocus: { value: 6.4 } },
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
    });
    root.add(new THREE.Points(bgeo, bmat));

    return { root, neb, rayMat, bmat };
  }, [p.symbol, p.ring, p.rays, p.rays2, p.nebula, p.nebula2, p.face, p.metal]);

  const composer = useMemo(() => {
    const w = Math.round(size.width * gl.getPixelRatio());
    const h = Math.round(size.height * gl.getPixelRatio());
    const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(gl, rt);
    c.setPixelRatio(1);
    c.setSize(w, h);
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.55, 0.08, 0.92));
    c.addPass(new OutputPass());
    c.addPass(new ShaderPass(FINAL_PASS));
    return c;
  }, [gl, scene, camera, size.width, size.height]);

  // All state is set from the Remotion frame, then the composer draws once.
  useFrame(() => {
    const f = loopFrame(frameRef.current);
    const t = f / LOOP;
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = 30;
    cam.near = 0.1;
    cam.far = 60;
    const D = 6.4;
    const yaw = ((8 * Math.PI) / 180) * Math.sin(TAU * t);
    const pitch = ((4 * Math.PI) / 180) * Math.sin(TAU * t + Math.PI / 2);
    cam.position.set(D * Math.sin(yaw) * Math.cos(pitch), D * Math.sin(pitch) + 0.15, D * Math.cos(yaw) * Math.cos(pitch));
    cam.lookAt(0, 0.05, 0);
    cam.updateProjectionMatrix();
    objs.neb.rotation.z = Math.PI * cyc(f, 1); // half a turn: texture is 2-fold symmetric
    objs.rayMat.uniforms.uT.value = t;
    objs.bmat.uniforms.uT.value = t;
    objs.bmat.uniforms.uScale.value = composer.renderTarget1.height * 1.2;
    const fp = (composer.passes[3] as ShaderPass).uniforms;
    fp.uFrame.value = f;
    fp.uGrain.value = 0.015;
    fp.uVignette.value = 0.85;
    composer.render();
  }, 1);

  return <primitive object={objs.root} />;
};

export const CoinBadge: React.FC<CoinBadgeProps> = (props) => {
  const { width, height } = useVideoConfig();
  const dpr = typeof window === "undefined" ? 1 : Math.min(1, window.devicePixelRatio || 1);
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={dpr}
        gl={{ antialias: false, preserveDrawingBuffer: true, powerPreference: "high-performance" }}
        linear={false}
        flat
      >
        <color attach="background" args={["#040106"]} />
        <Scene {...props} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

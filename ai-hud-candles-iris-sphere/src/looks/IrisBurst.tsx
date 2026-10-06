import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useAssets } from "../lib/assets";
import { easeInOutSine, progress, smooth } from "../lib/ease";
import { DOF_UNIFORMS, HASH } from "../lib/glsl";
import { addBlend, STD_VERT } from "../lib/mesh";
import { PostParams } from "../lib/post";
import { hash, mulberry32 } from "../lib/random";
import { makeShared, Shared, Stage } from "../lib/Stage";

// Look 4 — Iris Burst. A thin ring; ~3,000 curved light strands burst out of
// it into an iris-like corona with ~40,000 specks, in front of a planet whose
// cyan rim curves along the right. 15 s: ring → burst → live hold.
// All motion is evaluated in the vertex shaders from uTime (= frame / fps).

export type IrisPalette = {
  ring: string;
  blue: string;
  cyan: string;
  purple: string;
  gold: string;
  rimOuter: string;
  rimInner: string;
  bg: string;
};

const lin = (hex: string) => new THREE.Color(hex);
const STRANDS = 3000;
const SEGS = 28;
const SPECKS = 40000;
const BURST = 1.5;

// Picks a colour index by sector (as in the reference: gold low-right,
// purple upper-left, cyan everywhere), with random mixing.
// Colours come in clumps: strands in the same narrow angular band mostly
// share a colour (0 cyan, 1 purple, 2 gold, 3 deep blue).
const pickColour = (theta: number, r: number) => {
  const a = ((theta % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const band = Math.floor((a / (Math.PI * 2)) * 70);
  const x = r < 0.7 ? hash(band, 17) : r;
  const gold = 0.14 + 0.3 * Math.max(0, Math.cos(a - THREE.MathUtils.degToRad(-45)));
  const purple = 0.07 + 0.1 * Math.max(0, Math.cos(a - THREE.MathUtils.degToRad(160)));
  const cyan = 0.28;
  const blue = 0.5;
  const sum = gold + purple + cyan + blue;
  const v = x * sum;
  return v < blue ? 3 : v < blue + cyan ? 0 : v < blue + cyan + purple ? 1 : 2;
};

const strandGeometry = () => {
  const rnd = mulberry32(5150);
  // base strip: (s, side)
  const base: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= SEGS; i++) {
    base.push(i / SEGS, -1, 0, i / SEGS, 1, 0);
    if (i < SEGS) {
      const k = i * 2;
      idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(base, 3));
  g.setIndex(idx);
  const a = new Float32Array(STRANDS * 4); // theta, lift, length, curvature
  const b = new Float32Array(STRANDS * 4); // width, delay, phase, colour index
  const c = new Float32Array(STRANDS * 4); // twist, brightness, duration, spare
  for (let i = 0; i < STRANDS; i++) {
    const theta = (i / STRANDS) * Math.PI * 2 + (rnd() - 0.5) * 0.02;
    // a few strands fall back into the pupil: dim warm streaks inside the hole
    const inward = rnd() < 0.0;
    const lift = inward ? -(1.0 + rnd() * 0.35) : Math.pow(rnd(), 2.0) * 0.6; // radians toward the viewer
    const long = rnd() < 0.12;
    const len = inward ? 0.6 + rnd() * 0.8 : long ? 2.6 + rnd() * 2.2 : 0.9 + Math.pow(rnd(), 1.3) * 2.0;
    const curv = 0.5 + (rnd() - 0.5) * 0.3; // mostly one way: combed, swept curves
    a.set([theta, lift, len, curv], i * 4);
    b.set([0.004 + rnd() * 0.006, rnd() * 0.9, rnd() * 100, inward ? 2 : pickColour(theta, rnd())], i * 4);
    c.set([(rnd() - 0.5) * 0.08, (inward ? 0.04 : 1) * (0.16 + rnd() * 0.34), 1.6 + rnd() * 1.4, 0], i * 4);
  }
  g.setAttribute("aA", new THREE.InstancedBufferAttribute(a, 4));
  g.setAttribute("aB", new THREE.InstancedBufferAttribute(b, 4));
  g.setAttribute("aC", new THREE.InstancedBufferAttribute(c, 4));
  g.instanceCount = STRANDS;
  return g;
};

const COMMON = /* glsl */ `
uniform float uTime; uniform vec3 uCyan, uPurple, uGold, uBlue;
uniform float uEdgeBlur;
vec3 palette(float k) { return k < 0.5 ? uCyan : (k < 1.5 ? uPurple : (k < 2.5 ? uGold : uBlue)); }
float easeOutBack(float x) {
  float c1 = 1.70158 * 0.6, c3 = c1 + 1.0;
  float y = x - 1.0;
  return 1.0 + c3 * y * y * y + c1 * y * y;
}
// circular-arc strand: start at root, initial direction d, bending toward p
vec3 arcPoint(vec3 root, vec3 d, vec3 p, float k, float u) {
  if (abs(k) < 1e-3) return root + d * u + p * (0.5 * k * u * u);
  return root + d * (sin(k * u) / k) + p * ((1.0 - cos(k * u)) / k);
}
// extra blur toward the frame edges (screen-space), in px
float edgeCoc(vec4 clip) {
  vec2 ndc = clip.xy / clip.w;
  ndc.x *= 1.7778;
  return smoothstep(0.55, 1.9, length(ndc)) * uEdgeBlur * uRes.y;
}
`;

const strandMaterial = (shared: Shared, pal: IrisPalette) =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uCyan: { value: lin(pal.cyan) },
      uPurple: { value: lin(pal.purple) },
      uGold: { value: lin(pal.gold) },
      uBlue: { value: lin(pal.blue) },
      uEdgeBlur: { value: 0.003 },
      uPxScale: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aA; attribute vec4 aB; attribute vec4 aC;
      uniform float uPxScale;
      varying vec3 vCol; varying float vA; varying float vSide; varying float vS;
      ${DOF_UNIFORMS}
      ${COMMON}
      void main() {
        float s = position.x;
        float side = position.y;
        float theta = aA.x;
        vec3 radial = vec3(cos(theta), sin(theta), 0.0);
        vec3 nrm = vec3(0.0, 0.0, 1.0);
        float sway = sin(uTime * (0.35 + fract(aB.z) * 0.3) + aB.z) * 0.06;
        float lift = aA.y + sway * 0.5;
        vec3 d = normalize(radial * cos(lift) + nrm * sin(lift));
        // twist around the ring normal
        float tw = aC.x + sin(uTime * 0.25 + aB.z * 1.7) * 0.03;
        d = normalize(d + cross(nrm, radial) * tw);
        // bend sideways (a gentle swirl around the ring)
        vec3 p = normalize(cross(nrm, d));
        float k = aA.w * 0.45 + sway * 0.4;
        float g = clamp((uTime - ${BURST.toFixed(2)} - aB.y) / aC.z, 0.0, 1.0);
        float grow = aA.z * easeOutBack(g);
        float u = s * grow;
        vec3 root = radial * 1.0;
        vec3 P = arcPoint(root, d, p, k, u);
        vec3 P2 = arcPoint(root, d, p, k, u + 0.02);
        vec4 c0 = projectionMatrix * modelViewMatrix * vec4(P, 1.0);
        vec4 c1 = projectionMatrix * modelViewMatrix * vec4(P2, 1.0);
        vec2 s0 = c0.xy / c0.w * uRes * 0.5;
        vec2 s1 = c1.xy / c1.w * uRes * 0.5;
        vec2 dir = normalize(s1 - s0 + vec2(1e-5));
        vec2 nn = vec2(-dir.y, dir.x);
        float depth = c0.w;
        float px = aB.x * uRes.y * uPxScale / depth * (1.0 - 0.55 * s);
        float coc = cocFrac(depth) * uRes.y + edgeCoc(c0);
        float hw = max(px, 0.9) + coc * 0.5;
        vec2 off = nn * side * hw;
        gl_Position = c0 + vec4(off / uRes * 2.0 * c0.w, 0.0, 0.0);
        // brightness: energy spread over the blurred width
        float energy = max(px, 0.9) / hw;
        float tip = exp(-(1.0 - s) * 22.0) * (0.9 + 2.0 * (1.0 - g));
        float rootGlow = exp(-s * 30.0) * 0.25;
        vec3 col = palette(aB.w) * (aB.w > 1.5 && aB.w < 2.5 ? 1.2 : (aB.w > 2.5 ? 1.5 : 1.0));
        col = mix(col, vec3(1.0, 0.95, 0.7), rootGlow * 0.5 + tip * 0.2);
        float fadeOut = 1.0 - smoothstep(0.75, 1.0, s) * 0.4;
        vA = aC.y * energy * (0.75 + rootGlow + tip) * fadeOut * step(1e-4, grow);
        vA *= 0.85 + 0.15 * sin(uTime * 3.0 + aB.z * 13.0 + s * 6.0);
        // thousands of roots overlap at the ring: keep that zone from burning to white
        vA *= mix(0.22, 1.0, smoothstep(0.0, 0.3, s));
        vCol = col;
        vSide = side;
        vS = s;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA; varying float vSide; varying float vS;
      void main() {
        float x = 1.0 - abs(vSide);
        float prof = smoothstep(0.0, 0.6, x);
        gl_FragColor = vec4(vCol * vA * prof * 1.25, 1.0);
      }`,
    ...addBlend,
    side: THREE.DoubleSide,
  });

const speckGeometry = () => {
  const rnd = mulberry32(6262);
  const pos = new Float32Array(SPECKS * 3);
  const a = new Float32Array(SPECKS * 4);
  for (let i = 0; i < SPECKS; i++) {
    const theta = rnd() * Math.PI * 2;
    pos.set([theta, Math.pow(rnd(), 1.5) * 0.55, (rnd() - 0.5) * 0.2], i * 3);
    // r0, speed, phase, colour
    a.set([rnd(), 0.08 + rnd() * 0.35, rnd() * 100, Math.floor(rnd() * 3.999)], i * 4);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aA", new THREE.BufferAttribute(a, 4));
  return g;
};

const speckMaterial = (shared: Shared, pal: IrisPalette) =>
  new THREE.ShaderMaterial({
    uniforms: {
      ...shared,
      uCyan: { value: lin(pal.cyan) },
      uPurple: { value: lin(pal.purple) },
      uGold: { value: lin(pal.gold) },
      uBlue: { value: lin(pal.blue) },
      uEdgeBlur: { value: 0.004 },
      uPxScale: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute vec4 aA;
      uniform float uPxScale;
      varying vec3 vCol; varying float vA; varying float vSoft;
      ${DOF_UNIFORMS}
      ${COMMON}
      void main() {
        float theta = position.x, lift = position.y;
        vec3 radial = vec3(cos(theta), sin(theta), 0.0);
        vec3 d = normalize(radial * cos(lift) + vec3(0.0, 0.0, sin(lift)));
        float since = max(uTime - ${BURST.toFixed(2)} - 0.1, 0.0);
        float range = 3.4;
        // spray: an eased burst, then a steady outward drift that wraps
        float burst = (1.0 - exp(-since * 1.6)) * (0.3 + aA.x * 2.6);
        float r = mod(burst + aA.y * since * 0.55 + aA.x * 0.2, range);
        vec3 P = radial + d * r + vec3(0.0, 0.0, position.z * r * 0.3);
        vec4 mv = modelViewMatrix * vec4(P, 1.0);
        vec4 clip = projectionMatrix * mv;
        float depth = -mv.z;
        float px = (0.7 + fract(aA.z * 7.13) * 1.9) * uPxScale * uRes.y / 1080.0 * 6.0 / depth;
        float coc = min(cocFrac(depth) * uRes.y + edgeCoc(clip), 0.012 * uRes.y);
        float sz = max(px, 1.0) + coc;
        gl_PointSize = sz;
        gl_Position = clip;
        float tw = pow(0.5 + 0.5 * sin(uTime * (2.0 + fract(aA.z) * 5.0) + aA.z * 9.0), 3.0);
        float life = smoothstep(0.0, 0.4, r) * (1.0 - smoothstep(range * 0.7, range, r)) * step(0.001, since);
        float energy = (px * px) / (sz * sz);
        vec3 col = aA.w < 2.5 ? palette(aA.w) : vec3(0.55, 1.0, 0.6);
        vCol = col * 1.3;
        vA = (0.35 + 1.6 * tw) * life * energy * (px < 1.0 ? px : 1.0);
        vSoft = coc / sz;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCol; varying float vA; varying float vSoft;
      void main() {
        float r = length(gl_PointCoord * 2.0 - 1.0);
        float hard = 1.0 - smoothstep(0.55, 1.0, r);
        float bokeh = (1.0 - smoothstep(0.82, 1.0, r)) * (0.8 + 0.2 * smoothstep(0.4, 0.95, r));
        float sh = mix(hard, bokeh, clamp(vSoft * 1.4, 0.0, 1.0));
        gl_FragColor = vec4(vCol * vA * sh, 1.0);
      }`,
    ...addBlend,
  });

const ringMaterial = (shared: Shared, pal: IrisPalette) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, uColor: { value: lin(pal.ring) }, uAmp: { value: 0 }, uHot: { value: 0 } },
    vertexShader: STD_VERT,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAmp, uHot, uTime;
      varying vec2 vUv; varying vec3 vWorld;
      ${HASH}
      void main() {
        vec2 p = (vUv - 0.5) * 2.0 * 1.25;
        float r = length(p);
        float px = fwidth(r);
        float w = max(0.006, px * 0.8);
        float core = exp(-pow((r - 1.0) / w, 2.0));
        float glow = exp(-abs(r - 1.0) / 0.05) * 0.35;
        float ang = atan(p.y, p.x);
        float sparkle = pow(vnoise(vec2(ang * 40.0, uTime * 2.0)), 6.0) * 3.0;
        // after the burst the rim turns into a thin golden lip
        vec3 rc = mix(uColor, vec3(1.0, 0.72, 0.2), uHot * 0.85);
        vec3 col = rc * (core * (1.5 + uHot * 0.6) + glow * (1.0 - 0.6 * uHot)) + mix(uColor, vec3(1.0, 0.95, 0.6), 0.6) * core * sparkle * uHot;
        gl_FragColor = vec4(col * uAmp, 1.0);
      }`,
    ...addBlend,
    side: THREE.DoubleSide,
  });

const planetMaterial = (shared: Shared, pal: IrisPalette) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, uOuter: { value: lin(pal.rimOuter) }, uInner: { value: lin(pal.rimInner) }, uSide: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uOuter, uInner; uniform float uSide; // which limb is lit (+1 right, -1 left)
      varying vec3 vN; varying vec3 vV;
      void main() {
        float ndv = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        float f = 1.0 - ndv;
        float rim = pow(f, 4.5);
        float side = smoothstep(-0.15, 0.75, uSide * normalize(vN).x);
        vec3 col = mix(uInner, uOuter, smoothstep(0.6, 0.95, f)) * (rim * 3.6 + pow(f, 10.0) * 3.0) * side;
        col += vec3(0.0008, 0.002, 0.004);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

const haloMaterial = (pal: IrisPalette) =>
  new THREE.ShaderMaterial({
    uniforms: { uOuter: { value: lin(pal.rimOuter) }, uInner: { value: lin(pal.rimInner) }, uSide: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vV;
      void main() {
        vN = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uOuter, uInner; uniform float uSide; // which limb is lit (+1 right, -1 left)
      varying vec3 vN; varying vec3 vV;
      void main() {
        // back faces of a slightly larger shell: glow fading outward
        float ndv = abs(dot(normalize(vN), normalize(vV)));
        float g = pow(smoothstep(0.0, 0.42, ndv), 2.5);
        float side = smoothstep(-0.1, 0.8, uSide * normalize(vN).x);
        gl_FragColor = vec4(mix(uInner, uOuter, 0.75) * pow(g, 2.0) * 1.2 * side, 1.0);
      }`,
    ...addBlend,
    side: THREE.BackSide,
  });

// side = 1: ring left of centre, planet arc on the right (as the reference).
// side = -1: the scene layout is mirrored — ring, planet and camera path all
// reflect across x = 0. Strand data, colours, seeds and timing are unchanged.
export type IrisLayout = { side: 1 | -1 };

const build = (pal: IrisPalette, layout: IrisLayout) => {
  const shared = makeShared();
  const group = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 200);

  // planet behind and to the right of the ring
  const PR = 6.6;
  const planet = new THREE.Mesh(new THREE.SphereGeometry(PR, 128, 96), planetMaterial(shared, pal));
  planet.position.set(0.5, -0.1, -11.2);
  planet.renderOrder = -5;
  const world = new THREE.Group();
  world.scale.x = layout.side; // mirrors every position in the scene
  group.add(world);
  world.add(planet);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(PR * 1.075, 128, 96), haloMaterial(pal));
  halo.position.copy(planet.position);
  halo.renderOrder = -4;
  world.add(halo);
  for (const m of [planet.material, halo.material] as THREE.ShaderMaterial[]) m.uniforms.uSide.value = layout.side;

  // the iris, tilted ~35° off-axis
  const iris = new THREE.Group();
  iris.rotation.set(THREE.MathUtils.degToRad(10), THREE.MathUtils.degToRad(60), THREE.MathUtils.degToRad(12));
  world.add(iris);
  const ringMat = ringMaterial(shared, pal);
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 2.5), ringMat);
  ring.renderOrder = 1;
  iris.add(ring);
  const sm = strandMaterial(shared, pal);
  const strands = new THREE.Mesh(strandGeometry(), sm);
  strands.frustumCulled = false;
  strands.renderOrder = 2;
  iris.add(strands);
  const pm = speckMaterial(shared, pal);
  const specks = new THREE.Points(speckGeometry(), pm);
  specks.frustumCulled = false;
  specks.renderOrder = 3;
  iris.add(specks);

  const pxScale = 1 / (2 * Math.tan(THREE.MathUtils.degToRad(20)));
  sm.uniforms.uPxScale.value = pxScale;
  pm.uniforms.uPxScale.value = pxScale;

  const update = (frame: number, fps: number) => {
    const t = frame / fps;
    shared.uTime.value = t;
    // the ring is alone at first, then hands over to the strand roots
    ringMat.uniforms.uAmp.value = (0.25 + 0.45 * smooth(progress(t, 0, 1.4)) + 0.3 * smooth(progress(t, 1.4, 2.2))) * (1 - 0.55 * smooth(progress(t, 2.2, 4.5)));
    ringMat.uniforms.uHot.value = smooth(progress(t, 1.5, 2.6));
    // camera pushes in through the whole piece, the ring drifts toward centre
    const k = easeInOutSine(progress(t, 0, 15));
    const dist = 9.2 - 3.9 * k;
    const tx = 1.25 - 1.15 * k;
    camera.position.set(layout.side * (tx - 0.35), 0.05, dist);
    camera.lookAt(layout.side * tx, 0.0, 0);
    camera.updateMatrixWorld();
    shared.uDof.value.set(dist, 0.02, 0.025);
  };
  return { group, camera, shared, update };
};

const post: PostParams = {
  exposure: 1.0,
  bloomStrength: 0.75,
  bloomThreshold: 0.9,
  saturation: 1.2,
  bloomKnee: 0.4,
  vignette: 0.3,
  grain: 0.015,
};

const Scene: React.FC<{ palette: IrisPalette; layout: IrisLayout }> = ({ palette, layout }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const built = useMemo(() => build(palette, layout), [palette, layout]);
  built.update(frame, fps);
  return (
    <Stage camera={built.camera} post={post} clear={palette.bg} shared={built.shared}>
      <primitive object={built.group} />
    </Stage>
  );
};

export const IrisBurst: React.FC<{ palette: IrisPalette; layout?: IrisLayout }> = ({ palette, layout = { side: 1 } }) => {
  const assets = useAssets(false);
  return <AbsoluteFill style={{ backgroundColor: "#000" }}>{assets ? <Scene palette={palette} layout={layout} /> : null}</AbsoluteFill>;
};

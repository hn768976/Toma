import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { useAssets } from "../lib/assets";
import { makeCanvasTex, redraw } from "../lib/canvasTex";
import { easeInOutCubic, easeInOutSine, lerp, progress, smooth } from "../lib/ease";
import { DOF_UNIFORMS, HASH } from "../lib/glsl";
import { addBlend, premulBlend } from "../lib/mesh";
import { PostParams } from "../lib/post";
import { gaussian, mulberry32 } from "../lib/random";
import { makeShared, Shared, Stage } from "../lib/Stage";

// Look 5 — Data Sphere. 0–8s fly through a cloud of amber number tags and
// white plexus triangles; 8–13s pull back through the wall of a sphere made
// of stacked latitude rings; 13–20s hold with a slow rotation.

export type SpherePalette = {
  bg: string;
  amber: string;
  white: string;
};

const lin = (hex: string) => new THREE.Color(hex);
const R = 7; // sphere radius
const TAGS = 600;
const TRIS = 150;
const RINGS = 24;

// ---------- data cloud points ----------
const clusterPoint = (rnd: () => number, sigma: number) => {
  if (rnd() < 0.18) {
    // sparse points through the whole sphere
    const u = rnd() * 2 - 1;
    const a = rnd() * Math.PI * 2;
    const r = Math.cbrt(rnd()) * R * 0.92;
    const s = Math.sqrt(1 - u * u);
    return new THREE.Vector3(Math.cos(a) * s * r, u * r, Math.sin(a) * s * r);
  }
  return new THREE.Vector3(gaussian(rnd) * sigma, gaussian(rnd) * sigma * 1.1, gaussian(rnd) * sigma);
};
// built once at module level from fixed seeds
const cloudRnd = mulberry32(9090);
const TAG_POS = Array.from({ length: TAGS }, () => clusterPoint(cloudRnd, 2.0));
const NODE_POS = Array.from({ length: 260 }, () => clusterPoint(cloudRnd, 1.8));

// ---------- tag atlas: 8 x 16 cells of 128 x 64 ----------
const ATLAS_C = 8;
const ATLAS_R = 16;
const drawAtlas = (pal: SpherePalette) => {
  const ct = makeCanvasTex(ATLAS_C * 128, ATLAS_R * 64, true);
  const r2 = mulberry32(4242);
  redraw(ct, "static", (ctx) => {
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let r = 0; r < ATLAS_R; r++) {
      for (let c = 0; c < ATLAS_C; c++) {
        const x = c * 128;
        const y = r * 64;
        const num = `${Math.floor(r2() * 90 + 10)}.${Math.floor(r2() * 90 + 10)}`;
        const style = (r * ATLAS_C + c) % 5;
        if (style === 4) {
          // white outlined tag with white digits
          ctx.strokeStyle = pal.white;
          ctx.lineWidth = 4;
          ctx.strokeRect(x + 8, y + 10, 112, 44);
          ctx.fillStyle = "rgba(20,20,20,0.6)";
          ctx.fillRect(x + 10, y + 12, 108, 40);
          ctx.fillStyle = pal.white;
          ctx.font = "600 30px 'JetBrains Mono'";
          ctx.fillText(num, x + 64, y + 33);
        } else {
          // amber block with dark digits
          ctx.fillStyle = pal.amber;
          ctx.fillRect(x + 8, y + 12, 112, 40);
          ctx.fillStyle = "rgba(40,20,0,0.85)";
          ctx.font = "600 28px 'JetBrains Mono'";
          ctx.fillText(num, x + 64, y + 33);
        }
      }
    }
  });
  return ct;
};

// ---------- materials ----------

// Camera-facing tag quads. Blur = the tag's box convolved with the CoC box,
// plus the atlas sampled with widened gradients.
const tagMaterial = (shared: Shared, atlas: THREE.Texture) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, tAtlas: { value: atlas }, uOpacity: { value: 1 }, uFrameStep: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute vec3 aPos; attribute vec4 aInfo; // size, cell, phase, white
      uniform float uFrameStep, uTime;
      varying vec2 vL; varying vec2 vH; varying float vB; varying vec2 vUv; varying float vA; varying float vGrad;
      ${DOF_UNIFORMS}
      ${HASH}
      void main() {
        vec4 mv = modelViewMatrix * vec4(aPos, 1.0);
        float depth = -mv.z;
        float pxPerUnit = uRes.y * projectionMatrix[1][1] * 0.5 / max(depth, 0.05);
        float coc = cocFrac(depth) * uRes.y;
        float b = max(coc * 0.5, 0.6) / pxPerUnit;
        vec2 h = vec2(aInfo.x * 1.0, aInfo.x * 0.42);
        vec2 ext = h + b;
        vec2 off = position.xy * ext;
        mv.xy += off;
        gl_Position = projectionMatrix * mv;
        vL = off; vH = h; vB = b;
        float cell = aInfo.y;
        vec2 cellXY = vec2(mod(cell, ${ATLAS_C}.0), floor(cell / ${ATLAS_C}.0));
        vec2 local = off / (2.0 * h) + 0.5;
        vUv = (cellXY + vec2(local.x, 1.0 - local.y)) / vec2(${ATLAS_C}.0, ${ATLAS_R}.0);
        vUv.y = 1.0 - vUv.y;
        vGrad = 1.0 + coc * 0.5;
        // flicker
        float fl = hash33u(uvec3(uint(aInfo.z * 1000.0), uint(uFrameStep), 5u)).x;
        float flick = fl > 0.92 ? 0.35 : 1.0;
        float pulse = 0.8 + 0.2 * sin(uTime * (1.0 + aInfo.z) + aInfo.z * 30.0);
        vA = flick * pulse * (depth < 0.15 ? 0.0 : smoothstep(0.15, 0.6, depth));
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tAtlas; uniform float uOpacity;
      varying vec2 vL; varying vec2 vH; varying float vB; varying vec2 vUv; varying float vA; varying float vGrad;
      float cov(float x, float h, float b) { return (clamp(x + h, -b, b) - clamp(x - h, -b, b)) / (2.0 * b); }
      void main() {
        float a = cov(vL.x, vH.x, vB) * cov(vL.y, vH.y, vB);
        vec2 dx = dFdx(vUv) * vGrad, dy = dFdy(vUv) * vGrad;
        vec4 t = textureGrad(tAtlas, vUv, dx, dy);
        // the tag body is ~85% of the cell; keep its colour where blurred
        vec3 col = t.a > 0.02 ? t.rgb / t.a : vec3(0.0);
        float inside = step(abs(vL.x), vH.x) * step(abs(vL.y), vH.y);
        float alpha = mix(a * 0.75, t.a, inside * clamp(1.0 / vGrad, 0.0, 1.0));
        alpha = max(alpha, a * 0.6) * vA * uOpacity;
        vec3 c = col * 1.9;
        if (dot(c, c) < 0.01) c = vec3(1.7, 1.0, 0.35);
        gl_FragColor = vec4(c * alpha, alpha);
      }`,
    ...premulBlend,
    side: THREE.DoubleSide,
  });

// Fat line segments in screen space, clipped at the near plane, with DoF.
const lineMaterial = (shared: Shared, color: THREE.Color, widthFrac: number) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, uColor: { value: color }, uWidth: { value: widthFrac }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aA; attribute vec3 aB; attribute vec2 aInfo; // alpha, brightness
      uniform float uWidth;
      varying float vAlpha; varying float vSide;
      ${DOF_UNIFORMS}
      void main() {
        vec4 va = modelViewMatrix * vec4(aA, 1.0);
        vec4 vb = modelViewMatrix * vec4(aB, 1.0);
        float nearZ = -0.06;
        if (va.z > nearZ && vb.z > nearZ) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vAlpha = 0.0; vSide = 0.0; return; }
        if (va.z > nearZ) va = mix(va, vb, (va.z - nearZ) / (va.z - vb.z));
        if (vb.z > nearZ) vb = mix(vb, va, (vb.z - nearZ) / (vb.z - va.z));
        vec4 v = position.x < 0.5 ? va : vb;
        vec4 ca = projectionMatrix * va;
        vec4 cb = projectionMatrix * vb;
        vec4 c = projectionMatrix * v;
        vec2 sa = ca.xy / ca.w * uRes * 0.5;
        vec2 sb = cb.xy / cb.w * uRes * 0.5;
        vec2 dir = normalize(sb - sa + vec2(1e-5, 0.0));
        vec2 n = vec2(-dir.y, dir.x);
        float depth = -v.z;
        float px = uWidth * uRes.y;
        float coc = cocFrac(depth) * uRes.y;
        float hw = max(px, 0.7) + coc * 0.5;
        gl_Position = c + vec4(n * position.y * hw / uRes * 2.0 * c.w, 0.0, 0.0);
        vAlpha = aInfo.x * aInfo.y * max(px, 0.7) / hw;
        vSide = position.y;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity;
      varying float vAlpha; varying float vSide;
      void main() {
        float prof = 1.0 - smoothstep(0.4, 1.0, abs(vSide));
        gl_FragColor = vec4(uColor * vAlpha * prof * uOpacity, 1.0);
      }`,
    ...addBlend,
    side: THREE.DoubleSide,
  });

const lineMesh = (shared: Shared, segs: { a: THREE.Vector3; b: THREE.Vector3; alpha: number; bright: number }[], color: THREE.Color, w: number) => {
  const g = new THREE.InstancedBufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const A = new Float32Array(segs.length * 3);
  const B = new Float32Array(segs.length * 3);
  const I = new Float32Array(segs.length * 2);
  segs.forEach((s, i) => {
    A.set([s.a.x, s.a.y, s.a.z], i * 3);
    B.set([s.b.x, s.b.y, s.b.z], i * 3);
    I.set([s.alpha, s.bright], i * 2);
  });
  g.setAttribute("aA", new THREE.InstancedBufferAttribute(A, 3));
  g.setAttribute("aB", new THREE.InstancedBufferAttribute(B, 3));
  g.setAttribute("aInfo", new THREE.InstancedBufferAttribute(I, 2));
  g.instanceCount = segs.length;
  const m = new THREE.Mesh(g, lineMaterial(shared, color, w));
  m.frustumCulled = false;
  return m;
};

const triMaterial = (shared: Shared, color: THREE.Color) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, uColor: { value: color }, uOpacity: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec3 aBary; attribute float aAlpha; attribute float aPhase;
      uniform float uTime;
      varying vec3 vBary; varying float vA; varying float vCoc;
      ${DOF_UNIFORMS}
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float depth = -mv.z;
        vCoc = cocFrac(max(depth, 0.05)) * uRes.y;
        vBary = aBary;
        float pulse = 0.65 + 0.35 * sin(uTime * 1.3 + aPhase);
        vA = aAlpha * pulse / (1.0 + vCoc * 0.03) * smoothstep(0.1, 0.5, depth);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uOpacity;
      varying vec3 vBary; varying float vA; varying float vCoc;
      void main() {
        vec3 fw = fwidth(vBary) * (1.0 + vCoc * 0.5);
        vec3 e = smoothstep(vec3(0.0), fw * 1.5, vBary);
        float edge = 1.0 - min(e.x, min(e.y, e.z));
        float inside = smoothstep(vec3(0.0), fw * 0.8, vBary).x * smoothstep(0.0, fw.y * 0.8, vBary.y) * smoothstep(0.0, fw.z * 0.8, vBary.z);
        // brighter toward one corner, like lit plexus panes
        float grad = 0.35 + 0.65 * vBary.x;
        float a = (inside * grad * 0.55 + edge * 0.6) * vA * uOpacity;
        gl_FragColor = vec4(uColor * a * 1.3, a * 0.6);
      }`,
    ...premulBlend,
    side: THREE.DoubleSide,
  });

const dotMaterial = (shared: Shared, amber: THREE.Color, white: THREE.Color) =>
  new THREE.ShaderMaterial({
    uniforms: { ...shared, uAmber: { value: amber }, uWhite: { value: white }, uOpacity: { value: 1 }, uPxScale: { value: 1 } },
    vertexShader: /* glsl */ `
      attribute vec2 aInfo; // size, warm
      uniform float uTime, uPxScale;
      varying float vA; varying float vWarm; varying float vSoft;
      ${DOF_UNIFORMS}
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float depth = max(-mv.z, 0.05);
        float px = aInfo.x * uRes.y * uPxScale / depth;
        float coc = cocFrac(depth) * uRes.y;
        float sz = max(px, 1.0) + coc;
        gl_PointSize = min(sz, 200.0);
        vA = (px * px) / (sz * sz) * min(px, 1.0) * smoothstep(0.1, 0.4, depth);
        vWarm = aInfo.y;
        vSoft = coc / sz;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uAmber, uWhite; uniform float uOpacity;
      varying float vA; varying float vWarm; varying float vSoft;
      void main() {
        float r = length(gl_PointCoord * 2.0 - 1.0);
        float s = 1.0 - smoothstep(mix(0.5, 0.85, vSoft), 1.0, r);
        vec3 c = mix(uWhite, uAmber, vWarm) * 1.8;
        gl_FragColor = vec4(c * s * vA * uOpacity, 1.0);
      }`,
    ...addBlend,
  });

const shaftMaterial = (color: THREE.Color) =>
  new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uAmp: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAmp; varying vec2 vUv;
      void main() {
        float x = (vUv.x - 0.5) * 2.0;
        float w = mix(0.35, 1.0, 1.0 - vUv.y);
        float beam = exp(-pow(x / w, 2.0) * 2.5) * pow(vUv.y, 0.8);
        float rays = 0.8 + 0.2 * sin(x * 40.0) * sin(x * 13.0 + 1.0);
        gl_FragColor = vec4(uColor * beam * rays * uAmp, 1.0);
      }`,
    ...addBlend,
    side: THREE.DoubleSide,
  });

// ---------- scene ----------

const build = (pal: SpherePalette) => {
  const shared = makeShared();
  const group = new THREE.Group();
  const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.02, 200);
  const amber = lin(pal.amber);
  const white = lin(pal.white);
  const r = mulberry32(31337);

  const world = new THREE.Group(); // rotates during the hold
  group.add(world);

  // sphere of latitude rings + a few meridian arcs + orbit rings
  const ringSegs: { a: THREE.Vector3; b: THREE.Vector3; alpha: number; bright: number }[] = [];
  const N = 160;
  for (let i = 0; i < RINGS; i++) {
    const phi = ((i + 0.5) / RINGS) * Math.PI;
    const y = Math.cos(phi) * R;
    const rr = Math.sin(phi) * R;
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2;
      const a1 = ((k + 1) / N) * Math.PI * 2;
      ringSegs.push({
        a: new THREE.Vector3(Math.cos(a0) * rr, y, Math.sin(a0) * rr),
        b: new THREE.Vector3(Math.cos(a1) * rr, y, Math.sin(a1) * rr),
        alpha: 0.55,
        bright: 1.0,
      });
    }
  }
  // orbit rings outside the sphere near the equator
  for (const [y, rr] of [[0.6, R * 1.32], [-1.3, R * 1.22], [2.4, R * 1.12], [-3.2, R * 1.05]] as const) {
    for (let k = 0; k < N; k++) {
      const a0 = (k / N) * Math.PI * 2;
      const a1 = ((k + 1) / N) * Math.PI * 2;
      const on = (k % 40) < 30 ? 1 : 0;
      ringSegs.push({
        a: new THREE.Vector3(Math.cos(a0) * rr, y, Math.sin(a0) * rr),
        b: new THREE.Vector3(Math.cos(a1) * rr, y, Math.sin(a1) * rr),
        alpha: 0.28 * on,
        bright: 1.0,
      });
    }
  }
  // faint meridian arcs
  for (let m = 0; m < 6; m++) {
    const th = (m / 6) * Math.PI;
    for (let k = 0; k < 80; k++) {
      const p0 = (k / 80) * Math.PI;
      const p1 = ((k + 1) / 80) * Math.PI;
      const P = (p: number) => new THREE.Vector3(Math.sin(p) * R * Math.cos(th), Math.cos(p) * R, Math.sin(p) * R * Math.sin(th));
      ringSegs.push({ a: P(p0), b: P(p1), alpha: 0.05, bright: 1 });
      const Q = (p: number) => new THREE.Vector3(-Math.sin(p) * R * Math.cos(th), Math.cos(p) * R, -Math.sin(p) * R * Math.sin(th));
      ringSegs.push({ a: Q(p0), b: Q(p1), alpha: 0.05, bright: 1 });
    }
  }
  const rings = lineMesh(shared, ringSegs, white.clone().multiplyScalar(1.1), 0.0006);
  rings.renderOrder = 1;
  world.add(rings);

  // plexus lines between nearby nodes
  const plex: { a: THREE.Vector3; b: THREE.Vector3; alpha: number; bright: number }[] = [];
  for (let i = 0; i < NODE_POS.length; i++) {
    for (let j = i + 1; j < NODE_POS.length; j++) {
      const d = NODE_POS[i].distanceTo(NODE_POS[j]);
      if (d < 1.0 && plex.length < 520) plex.push({ a: NODE_POS[i], b: NODE_POS[j], alpha: 0.35 * (1 - d), bright: 1 });
    }
  }
  // long thin lines through the cloud (seen in the fly-through)
  for (let i = 0; i < 26; i++) {
    const a = clusterPoint(r, 3.0);
    const dir = new THREE.Vector3(gaussian(r), gaussian(r) * 0.4, gaussian(r)).normalize();
    plex.push({ a: a.clone().addScaledVector(dir, -6), b: a.clone().addScaledVector(dir, 6), alpha: 0.12, bright: 1 });
  }
  const plexus = lineMesh(shared, plex, white.clone(), 0.00045);
  plexus.renderOrder = 2;
  world.add(plexus);

  // plexus triangles
  const triPos: number[] = [];
  const triBary: number[] = [];
  const triAlpha: number[] = [];
  const triPhase: number[] = [];
  for (let i = 0; i < TRIS; i++) {
    const a = NODE_POS[Math.floor(r() * NODE_POS.length)];
    const s = 0.2 + Math.pow(r(), 2.5) * 0.75;
    const b = a.clone().add(new THREE.Vector3(gaussian(r), gaussian(r), gaussian(r)).normalize().multiplyScalar(s));
    const c = a.clone().add(new THREE.Vector3(gaussian(r), gaussian(r), gaussian(r)).normalize().multiplyScalar(s * (0.6 + r() * 0.6)));
    triPos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    triBary.push(1, 0, 0, 0, 1, 0, 0, 0, 1);
    const al = 0.15 + r() * 0.35;
    const ph = r() * 30;
    triAlpha.push(al, al, al);
    triPhase.push(ph, ph, ph);
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute("position", new THREE.Float32BufferAttribute(triPos, 3));
  tg.setAttribute("aBary", new THREE.Float32BufferAttribute(triBary, 3));
  tg.setAttribute("aAlpha", new THREE.Float32BufferAttribute(triAlpha, 1));
  tg.setAttribute("aPhase", new THREE.Float32BufferAttribute(triPhase, 1));
  const tris = new THREE.Mesh(tg, triMaterial(shared, white));
  tris.frustumCulled = false;
  tris.renderOrder = 3;
  world.add(tris);

  // tiny dots: data nodes, plus amber points sitting on the rings
  const dPos: number[] = [];
  const dInfo: number[] = [];
  for (let i = 0; i < 2600; i++) {
    const p = clusterPoint(r, 2.4);
    dPos.push(p.x, p.y, p.z);
    dInfo.push(0.008 + r() * 0.012, r() < 0.55 ? 1 : 0);
  }
  for (let i = 0; i < 160; i++) {
    const ri = Math.floor(r() * RINGS);
    const phi = ((ri + 0.5) / RINGS) * Math.PI;
    const a = r() * Math.PI * 2;
    dPos.push(Math.cos(a) * Math.sin(phi) * R, Math.cos(phi) * R, Math.sin(a) * Math.sin(phi) * R);
    dInfo.push(0.03 + r() * 0.03, 1);
  }
  const dg = new THREE.BufferGeometry();
  dg.setAttribute("position", new THREE.Float32BufferAttribute(dPos, 3));
  dg.setAttribute("aInfo", new THREE.Float32BufferAttribute(dInfo, 2));
  const dm = dotMaterial(shared, amber, white);
  dm.uniforms.uPxScale.value = 1 / (2 * Math.tan(THREE.MathUtils.degToRad(20)));
  const dots = new THREE.Points(dg, dm);
  dots.frustumCulled = false;
  dots.renderOrder = 4;
  world.add(dots);

  // tags
  const atlas = drawAtlas(pal);
  const tagG = new THREE.InstancedBufferGeometry();
  tagG.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
  tagG.setIndex([0, 1, 2, 0, 2, 3]);
  const tp = new Float32Array(TAGS * 3);
  const ti = new Float32Array(TAGS * 4);
  TAG_POS.forEach((p, i) => {
    tp.set([p.x, p.y, p.z], i * 3);
    ti.set([0.035 + r() * 0.04, Math.floor(r() * ATLAS_C * ATLAS_R), r() * 50, 0], i * 4);
  });
  tagG.setAttribute("aPos", new THREE.InstancedBufferAttribute(tp, 3));
  tagG.setAttribute("aInfo", new THREE.InstancedBufferAttribute(ti, 4));
  tagG.instanceCount = TAGS;
  const tagMat = tagMaterial(shared, atlas.tex);
  const tags = new THREE.Mesh(tagG, tagMat);
  tags.frustumCulled = false;
  tags.renderOrder = 5;
  world.add(tags);

  // soft top-down light shaft for the end
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(14, 26), shaftMaterial(white.clone().multiplyScalar(0.07)));
  shaft.position.set(0, 3, -2);
  shaft.renderOrder = 0;
  group.add(shaft);

  // camera path
  const flyA = new THREE.Vector3(2.6, 1.2, 3.2);
  const flyB = new THREE.Vector3(-0.6, -0.4, 2.2);
  const elev = THREE.MathUtils.degToRad(13);
  const D = 23.5;
  const endPos = new THREE.Vector3(0, Math.sin(elev) * D, Math.cos(elev) * D);
  const camPos = (t: number) => {
    const f = easeInOutSine(progress(t, 0, 8));
    const p = new THREE.Vector3().lerpVectors(flyA, flyB, f);
    p.x += Math.sin(t * 0.7) * 0.25;
    p.y += Math.sin(t * 0.5) * 0.15;
    return p;
  };
  const camLook = (t: number) => {
    const f = easeInOutSine(progress(t, 0, 8));
    return new THREE.Vector3(lerp(-1.5, 0.4, f), lerp(-0.4, 0.1, f), lerp(-2.0, -1.0, f));
  };

  const update = (frame: number, fps: number) => {
    const t = frame / fps;
    shared.uTime.value = t;
    tagMat.uniforms.uFrameStep.value = Math.floor(frame / 3);
    const pb = easeInOutCubic(progress(t, 8, 13));
    const p0 = camPos(Math.min(t, 8));
    const pos = new THREE.Vector3().lerpVectors(p0, endPos, pb);
    // keep a curved path out: swing upward as we pull back
    pos.y += Math.sin(pb * Math.PI) * 1.2;
    const look = new THREE.Vector3().lerpVectors(camLook(Math.min(t, 8)), new THREE.Vector3(0, 0, 0), smooth(progress(t, 8, 12)));
    camera.position.copy(pos);
    camera.lookAt(look);
    camera.updateMatrixWorld();
    // focus: near data during the fly-through, the sphere on the reveal
    const focus = lerp(2.6, D, pb);
    const strength = lerp(0.03, 0.006, pb);
    shared.uDof.value.set(focus, strength, lerp(0.05, 0.012, pb));
    // rotation: slow throughout, a bit more visible in the hold
    world.rotation.y = t * 0.035 + easeInOutSine(progress(t, 12, 20)) * 0.35;
    const fadeIn = smooth(progress(t, 0, 0.8));
    for (const m of [tagMat, rings.material, plexus.material, tris.material, dm] as THREE.ShaderMaterial[]) m.uniforms.uOpacity.value = fadeIn;
    (shaft.material as THREE.ShaderMaterial).uniforms.uAmp.value = smooth(progress(t, 12, 16));
  };
  return { group, camera, shared, update };
};

const post: PostParams = {
  exposure: 1.0,
  bloomStrength: 1.0,
  bloomThreshold: 0.7,
  bloomKnee: 0.4,
  vignette: 0.45,
  grain: 0.015,
  saturation: 1.0,
};

const Scene: React.FC<{ palette: SpherePalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const built = useMemo(() => build(palette), [palette]);
  built.update(frame, fps);
  return (
    <Stage camera={built.camera} post={post} clear={palette.bg} shared={built.shared}>
      <primitive object={built.group} />
    </Stage>
  );
};

export const DataSphere: React.FC<{ palette: SpherePalette }> = ({ palette }) => {
  const assets = useAssets(false);
  return <AbsoluteFill style={{ backgroundColor: "#000" }}>{assets ? <Scene palette={palette} /> : null}</AbsoluteFill>;
};

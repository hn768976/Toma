import * as THREE from "three";
import { DOF_GLSL } from "../gl/glsl";
import type { Look } from "../gl/Stage";
import { additive, dofUniforms, projScale, vec3Of } from "../gl/util";
import { mulberry32 } from "../lib/random";
import { loopPhase } from "../lib/timing";
import { BADGE_H, BADGE_W, BadgeKind, drawBadge } from "./cyberBadges";

export type CyberColors = { bgTop: string; bgBottom: string; node: string; link: string; badge: string };

/**
 * Repeating block of depth BLOCK_L along the travel axis. Nodes, links and
 * badges live in block coordinates and are wrapped around the camera; the
 * camera travels exactly N_BLOCKS * BLOCK_L over the 600-frame loop.
 */
export const CYBER_NODES = 760;
export const CYBER_BADGES = 40;
const BLOCK_L = 64;
const N_BLOCKS = 1;
const MARGIN = 7; // wrap point behind the camera (> half the longest link's z extent)
const HALF_W = 30;
const HALF_H = 17;
const FOV = 40;
const FOCUS = 13;
const APERTURE = 30;
const MAX_COC = 620;

type Node = { x: number; y: number; z: number; size: number; bright: number };
type Link = { a: number; dx: number; dy: number; dz: number; width: number; bright: number };

const periodicDz = (dz: number) => dz - BLOCK_L * Math.round(dz / BLOCK_L);

// ---- module-level, fixed seeds ---------------------------------------------
const buildNetwork = () => {
  const rnd = mulberry32(0xc0be);
  const nodes: Node[] = [];
  for (let i = 0; i < CYBER_NODES; i++) {
    // denser towards the travel axis so the frustum is well filled at all depths
    const r = Math.pow(rnd(), 0.8);
    const th = rnd() * Math.PI * 2;
    nodes.push({
      x: Math.cos(th) * r * HALF_W,
      y: Math.sin(th) * r * HALF_H,
      z: rnd() * BLOCK_L,
      size: 3.5 + Math.pow(rnd(), 3) * 6,
      bright: 0.45 + rnd() * 0.8 + (rnd() < 0.08 ? 1.2 : 0),
    });
  }
  // a handful of nodes close to the camera path: they sweep past large and blurred
  const nearPath: [number, number][] = [
    [0.9, 0.5],
    [-1.2, -0.7],
    [1.6, -1.1],
    [-0.6, 1.3],
    [2.2, 0.9],
  ];
  nearPath.forEach(([x, y], k) => {
    nodes[k * 37].x = x;
    nodes[k * 37].y = y;
  });

  const links: Link[] = [];
  const maxD2 = 6.5 * 6.5;
  for (let i = 0; i < nodes.length; i++) {
    const cand: { j: number; d2: number; dz: number }[] = [];
    for (let j = 0; j < nodes.length; j++) {
      if (j <= i) continue;
      const dx = nodes[j].x - nodes[i].x;
      const dy = nodes[j].y - nodes[i].y;
      const dz = periodicDz(nodes[j].z - nodes[i].z);
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < maxD2) cand.push({ j, d2, dz });
    }
    cand.sort((p, q) => p.d2 - q.d2);
    const take = Math.min(cand.length, rnd() < 0.3 ? 0 : 1 + Math.floor(rnd() * 1.6));
    for (let c = 0; c < take; c++) {
      const { j, dz } = cand[c];
      links.push({
        a: i,
        dx: nodes[j].x - nodes[i].x,
        dy: nodes[j].y - nodes[i].y,
        dz,
        width: 1.8 + rnd() * 1.0,
        bright: 0.16 + rnd() * 0.26,
      });
    }
  }
  // a few long bright lines cutting through the frame (mostly across, little depth)
  for (let k = 0; k < 9; k++) {
    const a = Math.floor(rnd() * nodes.length);
    const ang = rnd() * Math.PI * 2;
    const len = 30 + rnd() * 40;
    links.push({
      a,
      dx: Math.cos(ang) * len,
      dy: Math.sin(ang) * len * 0.6,
      dz: (rnd() * 2 - 1) * 9,
      width: 2.6 + rnd() * 2,
      bright: 0.75 + rnd() * 0.5,
    });
  }
  // badges on well-spread nodes
  const kinds: BadgeKind[] = ["lock", "bars", "percent", "text"];
  const badgeNodes: { node: number; kind: BadgeKind; seed: number }[] = [];
  const used = new Set<number>();
  let k = 0;
  while (badgeNodes.length < CYBER_BADGES) {
    const n = Math.floor(rnd() * nodes.length);
    k++;
    if (used.has(n)) continue;
    const nd = nodes[n];
    if (Math.abs(nd.x) > HALF_W * 0.6 || Math.abs(nd.y) > HALF_H * 0.6) continue;
    used.add(n);
    badgeNodes.push({ node: n, kind: kinds[badgeNodes.length % 4], seed: 1000 + k });
  }
  return { nodes, links, badgeNodes };
};

const NET = buildNetwork();
export const CYBER_LINKS = NET.links.length;

const nodeGeometry = () => {
  const n = NET.nodes.length;
  const pos = new Float32Array(n * 3);
  const data = new Float32Array(n * 4);
  NET.nodes.forEach((nd, i) => {
    pos.set([nd.x, nd.y, nd.z], i * 3);
    data.set([nd.size, nd.bright, i % 97, 0], i * 4);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("aData", new THREE.BufferAttribute(data, 4));
  return g;
};

const linkGeometry = () => {
  const g = new THREE.InstancedBufferGeometry();
  // quad corners: (t along the segment, side)
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([0, -1, 0, 1, -1, 0, 1, 1, 0, 0, 1, 0]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  const n = NET.links.length;
  const a = new Float32Array(n * 3);
  const d = new Float32Array(n * 3);
  const data = new Float32Array(n * 2);
  NET.links.forEach((l, i) => {
    const nd = NET.nodes[l.a];
    a.set([nd.x, nd.y, nd.z], i * 3);
    d.set([l.dx, l.dy, l.dz], i * 3);
    data.set([l.width, l.bright], i * 2);
  });
  g.setAttribute("aA", new THREE.InstancedBufferAttribute(a, 3));
  g.setAttribute("aD", new THREE.InstancedBufferAttribute(d, 3));
  g.setAttribute("aData", new THREE.InstancedBufferAttribute(data, 2));
  g.instanceCount = n;
  return g;
};

const WRAP_GLSL = /* glsl */ `
uniform float uCamZ;
const float BLOCK_L = ${BLOCK_L.toFixed(3)};
const float MARGIN = ${MARGIN.toFixed(3)};
// block z -> distance ahead of the camera (wrapped)
float ahead(float z) { return mod(z - uCamZ + MARGIN, BLOCK_L) - MARGIN; }
float depthFade(float a) { return smoothstep(BLOCK_L - MARGIN, BLOCK_L - MARGIN - 22.0, a); }
`;

const NODE_VS = /* glsl */ `
precision highp float;
${DOF_GLSL}
${WRAP_GLSL}
uniform vec3 uColor;
uniform float uPhase;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
in vec4 aData;
out vec3 vColor;
out float vPx;
const float TAU = 6.28318530718;
void main() {
  float a = ahead(position.z);
  vec4 mv = modelViewMatrix * vec4(position.x, position.y, -a, 1.0);
  float depth = -mv.z;
  vec2 sp = dofSprite(aData.x + 0.07 * uProj / max(depth, 0.1), depth);
  gl_PointSize = depth > 0.1 ? sp.x : 0.0;
  vPx = sp.x;
  float pulse = 0.8 + 0.2 * sin(TAU * (3.0 * uPhase + aData.z / 97.0));
  vColor = uColor * aData.y * pulse * depthFade(a) * sp.y;
  gl_Position = projectionMatrix * mv;
}`;

const NODE_FS = /* glsl */ `
precision highp float;
in vec3 vColor;
in float vPx;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  // small: glowing square; large (defocused): soft round bokeh
  float sq = max(abs(q.x), abs(q.y));
  float edge = clamp(1.5 / vPx, 0.05, 0.6);
  float square = 1.0 - smoothstep(0.55 - edge, 0.55 + edge, sq);
  float glow = exp(-dot(q, q) * 5.0) * 0.5;
  float r = length(q);
  float disc = 1.0 - smoothstep(1.0 - max(1.2 / vPx, 0.25), 1.0, r);
  float t = smoothstep(6.0, 20.0, vPx);
  float m = mix(square * 1.4 + glow, disc * 0.45, t);
  if (m <= 0.001) discard;
  outColor = vec4(vColor * m, 1.0);
}`;

const LINK_VS = /* glsl */ `
precision highp float;
${DOF_GLSL}
${WRAP_GLSL}
uniform vec3 uColor;
uniform vec2 uRes;
uniform float uNear;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;  // x: t (0/1), y: side (-1/1)
in vec3 aA;
in vec3 aD;
in vec2 aData;
out vec3 vColor;
out float vSide;
out float vAlpha;
void main() {
  // wrap by the midpoint so a link never splits across the wrap seam
  vec3 mid = aA + 0.5 * aD;
  float am = ahead(mid.z);
  vec3 m = vec3(mid.xy, -am);
  vec3 pa = m - 0.5 * vec3(aD.xy, -aD.z);
  vec3 pb = m + 0.5 * vec3(aD.xy, -aD.z);
  vec4 va = modelViewMatrix * vec4(pa, 1.0);
  vec4 vb = modelViewMatrix * vec4(pb, 1.0);
  // clip against the near plane in view space
  float n = -uNear;
  if (va.z > n && vb.z > n) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vAlpha = 0.0; vColor = vec3(0.0); vSide = 0.0; return; }
  if (va.z > n) va = mix(va, vb, (va.z - n) / (va.z - vb.z));
  if (vb.z > n) vb = mix(vb, va, (vb.z - n) / (vb.z - va.z));
  vec4 ca = projectionMatrix * va;
  vec4 cb = projectionMatrix * vb;
  vec2 sa = ca.xy / ca.w * 0.5 * uRes;
  vec2 sb = cb.xy / cb.w * 0.5 * uRes;
  vec2 dir = normalize(sb - sa + vec2(1e-5, 0.0));
  vec2 perp = vec2(-dir.y, dir.x);
  float t = position.x;
  vec4 vp = mix(va, vb, t);
  vec4 cp = t < 0.5 ? ca : cb;
  float depth = -vp.z;
  float w4k = aData.x;
  float coc = cocAt(depth);
  float wid = sqrt(w4k * w4k + coc * coc);
  float alpha = w4k / wid;
  float px = wid * uPxScale;
  if (px < 1.3) { alpha *= px / 1.3; px = 1.3; }
  vec2 s = (t < 0.5 ? sa : sb) + perp * position.y * px * 0.5 * 1.6 - dir * (t < 0.5 ? 1.0 : -1.0) * px * 0.4;
  gl_Position = vec4(s / (0.5 * uRes) * cp.w, cp.z, cp.w);
  vSide = position.y * 1.6;
  vAlpha = alpha * depthFade(-vp.z) ;
  vColor = uColor * aData.y;
}`;

const LINK_FS = /* glsl */ `
precision highp float;
in vec3 vColor;
in float vSide;
in float vAlpha;
out vec4 outColor;
void main() {
  float prof = exp(-vSide * vSide * 2.2);
  outColor = vec4(vColor * vAlpha * prof, 1.0);
}`;

const BADGE_VS = /* glsl */ `
precision highp float;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform vec2 uGrow;    // quad grown by the blur margin (x, y)
in vec3 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = (uv - 0.5) * uGrow + 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BADGE_FS = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
uniform vec2 uBlur;     // blur radius in uv units (x, y)
uniform float uLod;
uniform float uAlpha;
uniform vec3 uTint;
in vec2 vUv;
out vec4 outColor;
vec4 tap(vec2 uv) {
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  vec4 c = textureLod(tMap, uv, uLod);
  return vec4(c.rgb * c.a, c.a);
}
void main() {
  vec4 acc = vec4(0.0);
  // 24-tap Vogel disc: defocus blur of the badge (same CoC model as the particles)
  const int N = 24;
  for (int i = 0; i < N; i++) {
    float r = sqrt((float(i) + 0.5) / float(N));
    float th = float(i) * 2.39996323;
    acc += tap(vUv + vec2(cos(th), sin(th)) * r * uBlur);
  }
  acc /= float(N);
  outColor = vec4(acc.rgb * uTint * uAlpha, 1.0);
}`;

export const createCyberNetwork = (colors: CyberColors, padlock: HTMLImageElement) => (): Look => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.05, 200);
  const near = 0.12;
  const nodeMat = new THREE.RawShaderMaterial({
    ...additive,
    vertexShader: NODE_VS,
    fragmentShader: NODE_FS,
    uniforms: { ...dofUniforms(FOV, FOCUS, APERTURE, MAX_COC), uCamZ: { value: 0 }, uColor: { value: vec3Of(colors.node) } },
  });
  const linkMat = new THREE.RawShaderMaterial({
    ...additive,
    side: THREE.DoubleSide,
    vertexShader: LINK_VS,
    fragmentShader: LINK_FS,
    uniforms: {
      ...dofUniforms(FOV, FOCUS, APERTURE, MAX_COC),
      uCamZ: { value: 0 },
      uColor: { value: vec3Of(colors.link) },
      uRes: { value: new THREE.Vector2(1280, 720) },
      uNear: { value: near },
    },
  });
  const nodes = new THREE.Points(nodeGeometry(), nodeMat);
  const links = new THREE.Mesh(linkGeometry(), linkMat);
  nodes.frustumCulled = false;
  links.frustumCulled = false;
  scene.add(links, nodes);

  // Badges: one canvas texture each, redrawn from the frame number.
  const BADGE_WORLD_H = 1.0;
  const BADGE_WORLD_W = BADGE_WORLD_H * (BADGE_W / BADGE_H);
  const tint = vec3Of("#ffffff");
  const badges = NET.badgeNodes.map((b) => {
    const canvas = document.createElement("canvas");
    canvas.width = BADGE_W;
    canvas.height = BADGE_H;
    const ctx = canvas.getContext("2d")!;
    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.colorSpace = THREE.NoColorSpace;
    const mat = new THREE.RawShaderMaterial({
      ...additive,
      vertexShader: BADGE_VS,
      fragmentShader: BADGE_FS,
      uniforms: {
        tMap: { value: tex },
        uBlur: { value: new THREE.Vector2() },
        uLod: { value: 0 },
        uAlpha: { value: 1 },
        uGrow: { value: new THREE.Vector2(1, 1) },
        uTint: { value: tint },
      },
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { ...b, canvas, ctx, tex, mat, mesh };
  });

  const bgUniforms = {
    uTop: { value: vec3Of(colors.bgTop) },
    uBottom: { value: vec3Of(colors.bgBottom) },
    uAspect: { value: 16 / 9 },
  };
  const proj = projScale(FOV);
  const tmp = new THREE.Vector3();

  return {
    scene,
    camera,
    post: {
      bloomStrength: 0.7,
      bloomRadius: 0.75,
      grain: 0.02,
      backgroundUniformsGLSL: `uniform vec3 uTop; uniform vec3 uBottom; uniform float uAspect;`,
      backgroundUniforms: bgUniforms,
      backgroundGLSL: /* glsl */ `
vec3 background(vec2 uv) {
  vec3 col = mix(uBottom, uTop, smoothstep(0.0, 1.0, uv.y));
  // soft light from the top
  vec2 p = (uv - vec2(0.5, 1.12)) * vec2(uAspect, 1.0);
  float d2 = dot(p, p);
  col += uTop * (0.8 * exp(-d2 / 0.2) + 0.35 * exp(-d2 / 1.0));
  col *= 0.85 + 0.15 * smoothstep(0.0, 0.3, uv.y);
  return col;
}`,
    },
    update: ({ frame, width, height }) => {
      const ph = loopPhase(frame);
      const camZ = N_BLOCKS * BLOCK_L * ph; // exactly N*L per loop
      const a = Math.PI * 2 * ph;
      camera.position.set(0.5 * Math.sin(a), 0.35 * Math.sin(2 * a + 0.5), 0);
      camera.rotation.set(0.035 * Math.sin(a + 1.1), 0.05 * Math.sin(a), 0.03 * Math.sin(a + 2.2), "YXZ");
      camera.updateMatrixWorld();
      for (const m of [nodeMat, linkMat]) {
        m.uniforms.uCamZ.value = camZ;
        m.uniforms.uPxScale.value = height / 2160;
        m.uniforms.uPhase.value = ph;
      }
      linkMat.uniforms.uRes.value.set(width, height);
      bgUniforms.uAspect.value = width / height;

      for (const b of badges) {
        const nd = NET.nodes[b.node];
        const ahead = (((nd.z - camZ + MARGIN) % BLOCK_L) + BLOCK_L) % BLOCK_L - MARGIN;
        // world position of the node, then the badge offset so the node sits in its left square
        tmp.set(nd.x, nd.y, -ahead);
        const viewZ = tmp.clone().applyMatrix4(camera.matrixWorldInverse).z;
        const depth = -viewZ;
        const visible = depth > 0.4 && ahead < BLOCK_L - MARGIN;
        b.mesh.visible = visible;
        if (!visible) continue;
        const coc = Math.min(APERTURE * Math.abs(1 - FOCUS / depth), MAX_COC);
        const hPx = (BADGE_WORLD_H * proj) / depth; // badge height in 4K px
        const blurY = coc / 2 / hPx; // radius, in badge-height units
        const grow = 1 + 2 * blurY;
        b.mesh.quaternion.copy(camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        b.mesh.position.copy(tmp).addScaledVector(right, BADGE_WORLD_W * (0.5 - 64 / BADGE_W));
        const growX = 1 + (2 * blurY * BADGE_WORLD_H) / BADGE_WORLD_W;
        b.mesh.scale.set(BADGE_WORLD_W * growX, BADGE_WORLD_H * grow, 1);
        const u = b.mat.uniforms;
        u.uGrow.value.set(growX, grow);
        u.uBlur.value.set((blurY * BADGE_WORLD_H) / BADGE_WORLD_W, blurY);
        // mip level: pre-filter for minification and for wide blurs (taps stay smooth)
        const outPx = (hPx * height) / 2160;
        const texelPerPx = BADGE_H / Math.max(outPx, 1e-3);
        const blurTexels = blurY * BADGE_H;
        u.uLod.value = Math.max(0, Math.log2(Math.max(texelPerPx, blurTexels / 3)));
        const fade = Math.min(1, Math.max(0, (BLOCK_L - MARGIN - ahead) / 22));
        u.uAlpha.value = 1.15 * fade;
        // content is a pure function of (badge seed, frame)
        drawBadge(b.ctx, b.kind, b.seed, frame, colors.badge, padlock);
        b.tex.needsUpdate = true;
      }
    },
    dispose: () => {
      nodeMat.dispose();
      linkMat.dispose();
      badges.forEach((b) => {
        b.tex.dispose();
        b.mat.dispose();
      });
    },
  };
};

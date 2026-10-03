/**
 * Look 5 — AI Cube. three.js via @remotion/three. 360 frames, not a loop.
 *
 * Blocks fly in on seeded quadratic-Bézier paths (no physics) and lock
 * into slots of a 5x5x5 lattice, lower and inner slots first. The word
 * (a data row prop) drops onto the top face; floor circuit traces then
 * light up from the cube outward with dots running along them.
 */
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { useMontserratExtraBold } from "../lib/assets";
import { clamp, easeInCubic, easeInOutSine, easeOutCubic, lerp, smoothstep, win } from "../lib/ease";
import { hash01, makeRng } from "../lib/random";
import { canvasTexture } from "../lib/three/canvasTexture";
import { extrudedText } from "../lib/three/glyphs";
import { PostFX } from "../lib/three/PostFX";
import { Scene3D, useEnvTexture } from "../lib/three/Scene3D";
import type { AiCubeProps } from "../versions";

const N = 5;
const HALF = (N - 1) / 2;

// ------------------------------------------------------------- blocks
type Kind = "glass" | "frost" | "wire" | "glow";
type Block = {
  kind: Kind;
  target: THREE.Vector3;
  size: number;
  start: THREE.Vector3;
  ctrl: THREE.Vector3;
  rot0: THREE.Quaternion;
  t0: number;
  dur: number;
  accent: number;
  tint: number;
};

const BLOCKS: Block[] = (() => {
  const rng = makeRng(0xa1c0be);
  const slots: Array<{ p: THREE.Vector3; size: number }> = [];
  for (let y = 0; y < N; y++)
    for (let z = 0; z < N; z++)
      for (let x = 0; x < N; x++) {
        const outer = x === 0 || x === N - 1 || z === 0 || z === N - 1 || y === N - 1;
        // a few gaps on the surface (never on the top face, the word sits there)
        if (outer && y < N - 1 && rng.chance(0.08)) continue;
        const p = new THREE.Vector3(x - HALF, y + 0.5, z - HALF);
        if (rng.chance(0.35) && y < N - 1) {
          // split into small sub-cubes for detail
          for (let k = 0; k < 4; k++) {
            const o = new THREE.Vector3(k & 1 ? 0.24 : -0.24, (k & 2 ? 0.24 : -0.24), rng.chance(0.5) ? 0.24 : -0.24);
            slots.push({ p: p.clone().add(o), size: 0.44 });
          }
        } else slots.push({ p, size: rng.chance(0.15) ? 0.8 : 0.94 });
      }
  // a few blocks sticking out of the faces
  for (let k = 0; k < 16; k++) {
    const face = rng.int(0, 3);
    const a = rng.int(0, N - 1) - HALF;
    const y = rng.int(0, N - 1) + 0.5;
    const out = HALF + rng.range(0.55, 0.95);
    const p =
      face === 0 ? new THREE.Vector3(out, y, a) :
      face === 1 ? new THREE.Vector3(-out, y, a) :
      face === 2 ? new THREE.Vector3(a, y, out) :
      new THREE.Vector3(a, y, -out);
    slots.push({ p, size: rng.range(0.5, 0.8) });
  }
  // landing order: lower first, then inner (distance from the vertical axis)
  const order = slots
    .map((s, i) => ({ i, key: s.p.y * 10 + Math.hypot(s.p.x, s.p.z) * 2.2 + rng.range(0, 2.5) }))
    .sort((a, b) => a.key - b.key)
    .map((o) => o.i);
  const blocks: Block[] = [];
  order.forEach((si, rank) => {
    const s = slots[si];
    const r = rng.next();
    const surface = Math.max(Math.abs(s.p.x), Math.abs(s.p.z)) >= HALF - 0.01 || s.p.y > N - 1;
    const hero = rank === Math.round(order.length * 0.62);
    const kind: Kind = hero || r < 0.08 ? "glow" : r < 0.18 ? "wire" : r < (surface ? 0.48 : 0.4) ? "frost" : "glass";
    const dur = rng.range(36, 54);
    const arrive = lerp(48, 178, rank / (order.length - 1)) + rng.range(-4, 4);
    const dir = new THREE.Vector3(rng.range(-1, 1), rng.range(0.05, 0.55), rng.range(-1, 1)).normalize();
    // never fly in from between the camera and the cube
    if (dir.x * 0.6 + dir.z * 0.75 > 0.25) {
      dir.x = -dir.x;
      dir.z = -dir.z;
    }
    const start = s.p.clone().addScaledVector(dir, rng.range(8, 14));
    const mid = s.p.clone().lerp(start, 0.5);
    const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
    const ctrl = mid.addScaledVector(side, rng.range(-4, 4)).add(new THREE.Vector3(0, rng.range(-1, 2.5), 0));
    const rot0 = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng.range(-3, 3), rng.range(-3, 3), rng.range(-3, 3)));
    blocks.push({
      kind,
      target: s.p,
      size: kind === "glow" ? (hero ? 0.82 : s.size * 0.45) : s.size,
      start,
      ctrl,
      rot0,
      t0: Math.max(4, arrive - dur),
      dur: Math.min(dur, arrive - 4),
      accent: hero ? 3 : rng.int(0, 2),
      tint: rng.int(0, 3),
    });
  });
  return blocks;
})();

const KINDS: Kind[] = ["glass", "frost", "wire", "glow"];
const BY_KIND = Object.fromEntries(KINDS.map((k) => [k, BLOCKS.filter((b) => b.kind === k)])) as Record<Kind, Block[]>;

const bez = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, t: number, out: THREE.Vector3) => {
  const u = 1 - t;
  return out.set(
    u * u * a.x + 2 * u * t * b.x + t * t * c.x,
    u * u * a.y + 2 * u * t * b.y + t * t * c.y,
    u * u * a.z + 2 * u * t * b.z + t * t * c.z,
  );
};

/** Block state at a frame: position, rotation, scale, landing flash. */
const blockState = (b: Block, f: number, pos: THREE.Vector3, q: THREE.Quaternion) => {
  const u = clamp((f - b.t0) / b.dur);
  const e = easeOutCubic(u);
  bez(b.start, b.ctrl, b.target, e, pos);
  q.copy(b.rot0).slerp(IDENT, easeOutCubic(clamp(u * 1.15)));
  const appear = smoothstep(b.t0, b.t0 + 10, f);
  const land = b.t0 + b.dur;
  const flash = f >= land ? Math.exp(-(f - land) / 5) : 0;
  return { scale: b.size * appear * (1 + 0.12 * flash), flash, visible: f >= b.t0 };
};
const IDENT = new THREE.Quaternion();

// ---------------------------------------------------------- geometry
const wireCubeGeometry = (t: number) => {
  const parts: THREE.BufferGeometry[] = [];
  const h = 0.5;
  for (const axis of [0, 1, 2])
    for (const s1 of [-1, 1])
      for (const s2 of [-1, 1]) {
        const g = new THREE.BoxGeometry(axis === 0 ? 1 + t : t, axis === 1 ? 1 + t : t, axis === 2 ? 1 + t : t);
        const p = [0, 0, 0];
        const others = [0, 1, 2].filter((a) => a !== axis);
        p[others[0]] = s1 * h;
        p[others[1]] = s2 * h;
        g.translate(p[0], p[1], p[2]);
        parts.push(g);
      }
  return mergeGeometries(parts);
};

// glass: fresnel + bright edges, additive. Edge lines from box-local coords.
const glassVertex = /* glsl */ `
attribute float aFlash;
attribute vec3 aTint;
varying vec3 vTint;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vV;
varying float vFlash;
#include <fog_pars_vertex>
void main() {
  vLocal = position;
  vFlash = aFlash;
  vTint = aTint;
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vV = normalize(cameraPosition - wp.xyz);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;
const glassFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uBody;
uniform float uEdge;
varying vec3 vTint;
varying vec3 vLocal;
varying vec3 vN;
varying vec3 vV;
varying float vFlash;
#include <fog_pars_fragment>
void main() {
  vec3 a = abs(vLocal) * 2.0;           // 0..1, 1 on the faces
  // second-largest coordinate -> distance to the nearest edge on this face
  float mx = max(a.x, max(a.y, a.z));
  float mn = min(a.x, min(a.y, a.z));
  float mid = a.x + a.y + a.z - mx - mn;
  float edge = smoothstep(0.9, 0.99, mid);
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
  float top = max(vN.y, 0.0);
  vec3 base = uColor * vTint;
  vec3 deep = base * base;
  vec3 col = mix(deep * (0.7 + 0.8 * top), base * 1.2, fres) * uBody * 4.0 + deep * edge * uEdge * 2.2;
  col += vec3(0.8, 0.95, 1.0) * vFlash * 0.8;
  float alpha = clamp(0.45 + 0.4 * fres + 0.5 * edge + vFlash, 0.0, 1.0);
  gl_FragColor = vec4(col, alpha);
  #include <fog_fragment>
}
`;

// ------------------------------------------------------------ circuit
type Trace = { pts: THREE.Vector2[]; len: number; cum: number[]; startDist: number; width: number; bright: number };

const TRACES: Trace[] = (() => {
  const rng = makeRng(0x7aace);
  const out: Trace[] = [];
  const dirs = [
    [1, 0], [0, 1], [-1, 0], [0, -1], [0.7071, 0.7071], [-0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, -0.7071],
  ];
  for (let t = 0; t < 64; t++) {
    // start on the cube's footprint edge
    const side = t % 4;
    const a = rng.range(-2.3, 2.3);
    let p = side === 0 ? new THREE.Vector2(2.6, a) : side === 1 ? new THREE.Vector2(a, 2.6) : side === 2 ? new THREE.Vector2(-2.6, a) : new THREE.Vector2(a, -2.6);
    const base = side; // main outward direction index
    const pts = [p.clone()];
    let d = base;
    let total = 0;
    const target = rng.range(16, 46);
    while (total < target) {
      const segLen = rng.range(1.2, 4.5);
      const v = dirs[d];
      p = p.clone().add(new THREE.Vector2(v[0] * segLen, v[1] * segLen));
      pts.push(p.clone());
      total += segLen;
      // turn: 45 degrees off the main direction, or back to it
      const diag = [
        [4, 7], [4, 5], [5, 6], [6, 7],
      ][base];
      d = d === base ? (rng.chance(0.5) ? diag[0] : diag[1]) : base;
    }
    const cum = [0];
    for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + pts[k].distanceTo(pts[k - 1]));
    out.push({ pts, len: cum[cum.length - 1], cum, startDist: 0, width: rng.chance(0.2) ? 0.03 : 0.016, bright: rng.range(0.6, 1.2) });
  }
  return out;
})();

const traceGeometry = () => {
  const positions: number[] = [];
  const dists: number[] = [];
  const brights: number[] = [];
  const index: number[] = [];
  let base = 0;
  for (const tr of TRACES) {
    for (let k = 0; k < tr.pts.length - 1; k++) {
      const a = tr.pts[k];
      const b = tr.pts[k + 1];
      const dir = b.clone().sub(a).normalize();
      const n = new THREE.Vector2(-dir.y, dir.x).multiplyScalar(tr.width / 2);
      // extend slightly to hide joints
      const a2 = a.clone().addScaledVector(dir, -tr.width / 2);
      const b2 = b.clone().addScaledVector(dir, tr.width / 2);
      const quad = [a2.clone().add(n), a2.clone().sub(n), b2.clone().add(n), b2.clone().sub(n)];
      const dd = [tr.cum[k], tr.cum[k], tr.cum[k + 1], tr.cum[k + 1]];
      quad.forEach((q, i) => {
        positions.push(q.x, 0.012, q.y);
        dists.push(dd[i]);
        brights.push(tr.bright);
      });
      index.push(base, base + 1, base + 2, base + 1, base + 3, base + 2);
      base += 4;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("aDist", new THREE.Float32BufferAttribute(dists, 1));
  g.setAttribute("aBright", new THREE.Float32BufferAttribute(brights, 1));
  g.setIndex(index);
  return g;
};

const traceVertex = /* glsl */ `
attribute float aDist;
attribute float aBright;
varying float vDist;
varying float vBright;
#include <fog_pars_vertex>
void main() {
  vDist = aDist;
  vBright = aBright;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;
const traceFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uReveal;
uniform float uBase;
varying float vDist;
varying float vBright;
#include <fog_pars_fragment>
void main() {
  float lit = smoothstep(uReveal, uReveal - 0.6, vDist);
  float front = exp(-max(uReveal - vDist, 0.0) * 0.9) * lit;
  vec3 col = uColor * vBright * (uBase + lit * 0.55 + front * 1.6);
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}
`;

const samplePath = (tr: Trace, d: number, out: THREE.Vector3) => {
  const dd = clamp(d, 0, tr.len);
  let k = 1;
  while (k < tr.cum.length - 1 && tr.cum[k] < dd) k++;
  const t = (dd - tr.cum[k - 1]) / Math.max(1e-6, tr.cum[k] - tr.cum[k - 1]);
  const a = tr.pts[k - 1];
  const b = tr.pts[k];
  return out.set(lerp(a.x, b.x, t), 0.05, lerp(a.y, b.y, t));
};

// ------------------------------------------------------------ textures
const floorTexture = (bg: string, line: string) =>
  canvasTexture(
    1024,
    1024,
    (ctx, w, h) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = line;
      ctx.globalAlpha = 0.38;
      ctx.lineWidth = 5;
      ctx.strokeRect(0, 0, w, h);
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = 2;
      for (let k = 1; k < 4; k++) {
        ctx.beginPath();
        ctx.moveTo((k * w) / 4, 0);
        ctx.lineTo((k * w) / 4, h);
        ctx.moveTo(0, (k * h) / 4);
        ctx.lineTo(w, (k * h) / 4);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    },
    { repeat: true, anisotropy: 16 },
  );

const glowTexture = () =>
  canvasTexture(512, 512, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.25, "rgba(255,255,255,0.45)");
    g.addColorStop(0.6, "rgba(255,255,255,0.1)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });

type Speck = { p: THREE.Vector3; s: number; tw: number };
const SPECKS: Speck[] = (() => {
  const rng = makeRng(0xb0ce);
  return Array.from({ length: 150 }, () => ({
    p: new THREE.Vector3(rng.range(-30, 30), rng.range(0.1, 10), rng.range(-34, 16)),
    s: rng.range(0.04, 0.13),
    tw: rng.next(),
  }));
})();

/** Neon strips along some outer edges of the lattice (L-shapes and uprights). */
type Strip = { a: THREE.Vector3; b: THREE.Vector3; t0: number };
const STRIPS: Strip[] = (() => {
  const rng = makeRng(0x57e1b);
  const e = HALF + 0.5;
  const out: Strip[] = [];
  const corners = [[e, e], [e, -e], [-e, e], [-e, -e]];
  // L-shaped brackets: an upright on a corner edge plus a horizontal run from its top
  for (let k = 0; k < 8; k++) {
    const [cx0, cz0] = rng.pick(corners);
    const cx = cx0 * 0.985;
    const cz = cz0 * 0.985;
    const y0 = rng.int(0, N - 2);
    const y1 = Math.min(N, y0 + rng.int(1, 3));
    const t0 = rng.range(170, 225);
    out.push({ a: new THREE.Vector3(cx, y0, cz), b: new THREE.Vector3(cx, y1, cz), t0 });
    const len = rng.int(1, 2);
    const b = rng.chance(0.5) ? new THREE.Vector3(cx - Math.sign(cx) * len, y1, cz) : new THREE.Vector3(cx, y1, cz - Math.sign(cz) * len);
    out.push({ a: new THREE.Vector3(cx, y1, cz), b, t0: t0 + 10 });
  }
  return out;
})();

/** Small loose cubelets drifting around the cluster while it assembles. */
type Debris = { p: THREE.Vector3; s: number; spin: THREE.Vector3; tint: number; out: number };
const DEBRIS: Debris[] = (() => {
  const rng = makeRng(0xdeb1);
  return Array.from({ length: 46 }, () => {
    const a = rng.range(0, Math.PI * 2);
    const r = rng.range(3.8, 9);
    return {
      p: new THREE.Vector3(Math.cos(a) * r, rng.range(0.15, 4.5), Math.sin(a) * r),
      s: rng.range(0.12, 0.38),
      spin: new THREE.Vector3(rng.range(-0.03, 0.03), rng.range(-0.03, 0.03), rng.range(-0.03, 0.03)),
      tint: rng.int(0, 3),
      out: rng.range(195, 260),
    };
  });
})();

/** Small warm/white point lights inside the lattice. */
type Spark = { p: THREE.Vector3; accent: number; t0: number };
const SPARKS: Spark[] = (() => {
  const rng = makeRng(0x5a4c);
  return Array.from({ length: 22 }, () => {
    const p = new THREE.Vector3(rng.int(-2, 2) + 0.5 * (rng.chance(0.5) ? 1 : -1), rng.int(1, N - 1), rng.int(-2, 2) + 0.5);
    return { p, accent: rng.chance(0.6) ? 0 : 1, t0: 40 + p.y * 30 + rng.range(0, 20) };
  });
})();

// ------------------------------------------------------------ scene
const tmpM = new THREE.Matrix4();
const tmpP = new THREE.Vector3();
const tmpQ = new THREE.Quaternion();
const tmpS = new THREE.Vector3();
const tmpC = new THREE.Color();

const CubeScene: React.FC<AiCubeProps & { frame: number }> = (p) => {
  const { frame: f } = p;
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const env = useEnvTexture();
  const font = useMontserratExtraBold();

  const glassColor = useMemo(() => new THREE.Color(p.glass), [p.glass]);
  const traceColor = useMemo(() => new THREE.Color(p.trace), [p.trace]);
  // accent 3 = the warm 'hero' cube
  const accents = useMemo(() => [...p.glowAccents.map((c) => new THREE.Color(c)), new THREE.Color("#ffe6b0")], [p.glowAccents]);

  const boxGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const wireGeo = useMemo(() => wireCubeGeometry(0.022), []);
  const textGeo = useMemo(
    () => (font ? extrudedText(font, p.word, { size: 3.1, depth: 0.5, bevel: 0.045 }) : null),
    [font, p.word],
  );
  const textWidth = useMemo(() => {
    if (!textGeo) return 1;
    textGeo.computeBoundingBox();
    return textGeo.boundingBox!.max.x - textGeo.boundingBox!.min.x;
  }, [textGeo]);
  const trGeo = useMemo(traceGeometry, []);
  const floorTex = useMemo(() => floorTexture(p.background, p.trace), [p.background, p.trace]);
  const glowTex = useMemo(glowTexture, []);

  const glassMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: glassVertex,
        fragmentShader: glassFragment,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          { uColor: { value: new THREE.Color() }, uBody: { value: 0.22 }, uEdge: { value: 0.75 } },
        ]),
        transparent: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        fog: true,
      }),
    [],
  );
  const traceMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: traceVertex,
        fragmentShader: traceFragment,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          { uColor: { value: new THREE.Color() }, uReveal: { value: 0 }, uBase: { value: 0.08 } },
        ]),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        fog: true,
      }),
    [],
  );
  const flashAttr = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(BY_KIND.glass.length), 1), []);
  // per-block tint palette: base, deeper, toward the trace colour, paler
  const tints = useMemo(() => {
    const g = new THREE.Color(p.glass);
    return [
      g.clone(),
      g.clone().multiplyScalar(0.62),
      g.clone().lerp(new THREE.Color(p.trace), 0.55),
      g.clone().lerp(new THREE.Color("#ffffff"), 0.2),
    ];
  }, [p.glass, p.trace]);
  const glassGeo = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    g.setAttribute("aFlash", flashAttr);
    const t = new Float32Array(BY_KIND.glass.length * 3);
    BY_KIND.glass.forEach((b, i) => {
      // tint relative to the base colour (shader multiplies uColor by it)
      const rel = [1, 0.62, 1, 1][b.tint];
      const c = tints[b.tint];
      const base = new THREE.Color(p.glass);
      t[i * 3] = b.tint === 1 ? rel : c.r / Math.max(base.r, 1e-3);
      t[i * 3 + 1] = b.tint === 1 ? rel : c.g / Math.max(base.g, 1e-3);
      t[i * 3 + 2] = b.tint === 1 ? rel : c.b / Math.max(base.b, 1e-3);
    });
    g.setAttribute("aTint", new THREE.InstancedBufferAttribute(t, 3));
    return g;
  }, [flashAttr, tints, p.glass]);

  const refs = {
    glass: useRef<THREE.InstancedMesh>(null),
    frost: useRef<THREE.InstancedMesh>(null),
    wire: useRef<THREE.InstancedMesh>(null),
    glow: useRef<THREE.InstancedMesh>(null),
  };
  const textRef = useRef<THREE.Group>(null);
  const dotsRef = useRef<THREE.InstancedMesh>(null);
  const specksRef = useRef<THREE.InstancedMesh>(null);
  const floorGlowRef = useRef<THREE.Mesh>(null);
  const backGlowRef = useRef<THREE.Mesh>(null);
  const stripRef = useRef<THREE.InstancedMesh>(null);
  const sparkRef = useRef<THREE.InstancedMesh>(null);
  const debrisRef = useRef<THREE.InstancedMesh>(null);
  const backGlowMat = useRef<THREE.MeshBasicMaterial>(null);

  // ---- per-frame state
  const pulse = 1 + 0.08 * Math.sin(((f - 300) / 30) * Math.PI * 1.4) * smoothstep(296, 320, f);
  const reveal = Math.max(0, (f - 200) * 0.32);

  useLayoutEffect(() => {
    // camera: ~35 degrees above, 20 degree orbit, slow push in
    const t = easeInOutSine(f / 359);
    const az = THREE.MathUtils.degToRad(lerp(26, 46, t));
    const el = THREE.MathUtils.degToRad(lerp(48, 40, t));
    const r = lerp(30, 23, t);
    const target = new THREE.Vector3(0, lerp(1.2, 2.4, t), 0);
    camera.position.set(
      target.x + Math.sin(az) * Math.cos(el) * r,
      target.y + Math.sin(el) * r,
      target.z + Math.cos(az) * Math.cos(el) * r,
    );
    camera.lookAt(target);

    for (const kind of KINDS) {
      const mesh = refs[kind].current!;
      BY_KIND[kind].forEach((b, i) => {
        const st = blockState(b, f, tmpP, tmpQ);
        const s = st.visible ? st.scale : 0;
        tmpS.setScalar(s);
        tmpM.compose(tmpP, tmpQ, tmpS);
        mesh.setMatrixAt(i, tmpM);
        if (kind === "glass") flashAttr.setX(i, st.flash);
        else if (kind === "frost") {
          tmpC.copy(tints[b.tint]).multiply(tints[b.tint]).multiplyScalar(0.55 + st.flash * 1.2);
          mesh.setColorAt(i, tmpC);
        } else if (kind === "wire") {
          tmpC.copy(glassColor).multiplyScalar(0.75 + st.flash * 2);
          mesh.setColorAt(i, tmpC);
        } else {
          const tw = 0.8 + 0.2 * Math.sin(f * 0.21 + i * 1.7);
          tmpC.copy(accents[b.accent]).multiplyScalar((4 + st.flash * 2) * tw * pulse);
          mesh.setColorAt(i, tmpC);
        }
      });
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    flashAttr.needsUpdate = true;
    (glassMat.uniforms.uColor.value as THREE.Color).copy(glassColor).multiplyScalar(pulse);

    // the word: falls, lands, small settle bounce
    if (textRef.current) {
      const top = N + 0.02;
      const fall = easeInCubic(win(f, 160, 194));
      const settle = win(f, 194, 222);
      const bounce = Math.sin(settle * Math.PI) * 0.35 * (1 - settle);
      const y = lerp(top + 9, top, fall) + (f >= 194 ? bounce : 0);
      textRef.current.position.set(0, y, 0);
      textRef.current.visible = f >= 160;
      const s = Math.min(1.2, (N * 0.95) / textWidth);
      textRef.current.scale.setScalar(s);
    }

    // traces and running dots
    traceMat.uniforms.uReveal.value = reveal;
    (traceMat.uniforms.uColor.value as THREE.Color).copy(traceColor);
    traceMat.uniforms.uBase.value = 0.07 * smoothstep(200, 300, f);
    TRACES.forEach((tr, i) => {
      for (let k = 0; k < 2; k++) {
        if (k === 1 && hash01(i, 99) < 0.6) {
          tmpS.setScalar(0);
          tmpM.compose(tmpP, tmpQ, tmpS);
          dotsRef.current!.setMatrixAt(i * 2 + k, tmpM);
          continue;
        }
        const speed = 0.22 + hash01(i, k) * 0.2;
        const d = ((f - 200) * speed + hash01(i, k, 3) * tr.len * 0.8) % Math.max(tr.len, 1);
        const vis = f > 205 && d < reveal ? 1 : 0;
        samplePath(tr, d, tmpP);
        tmpQ.identity();
        tmpS.setScalar(vis * 0.022);
        tmpM.compose(tmpP, tmpQ, tmpS);
        dotsRef.current!.setMatrixAt(i * 2 + k, tmpM);
      }
    });
    dotsRef.current!.instanceMatrix.needsUpdate = true;

    // bokeh specks face the camera
    SPECKS.forEach((sp, i) => {
      tmpQ.copy(camera.quaternion);
      const tw = 0.6 + 0.4 * Math.sin(f * 0.07 + sp.tw * 6.28);
      tmpS.setScalar(sp.s * tw);
      tmpM.compose(sp.p, tmpQ, tmpS);
      specksRef.current!.setMatrixAt(i, tmpM);
    });
    specksRef.current!.instanceMatrix.needsUpdate = true;

    floorGlowRef.current!.scale.setScalar(lerp(10, 16, smoothstep(0, 200, f)) * pulse);
    backGlowRef.current!.quaternion.copy(camera.quaternion);
    backGlowMat.current!.opacity = 0.12 + 0.2 * smoothstep(40, 200, f) * pulse;

    STRIPS.forEach((st, i) => {
      const g = easeOutCubic(win(f, st.t0, st.t0 + 18));
      tmpP.copy(st.a).lerp(st.b, 0.5 * g);
      const len = st.a.distanceTo(st.b) * g;
      const d = new THREE.Vector3().subVectors(st.b, st.a).normalize();
      tmpQ.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
      tmpS.set(g > 0 ? 1 : 0, Math.max(len, 1e-4), g > 0 ? 1 : 0);
      tmpM.compose(tmpP, tmpQ, tmpS);
      stripRef.current!.setMatrixAt(i, tmpM);
    });
    stripRef.current!.instanceMatrix.needsUpdate = true;
    SPARKS.forEach((sp, i) => {
      const a = smoothstep(sp.t0, sp.t0 + 12, f);
      tmpQ.identity();
      tmpS.setScalar(0.07 * a * (0.85 + 0.15 * Math.sin(f * 0.3 + i)));
      tmpM.compose(sp.p, tmpQ, tmpS);
      sparkRef.current!.setMatrixAt(i, tmpM);
      tmpC.copy(accents[sp.accent]).multiplyScalar(6);
      sparkRef.current!.setColorAt(i, tmpC);
    });
    sparkRef.current!.instanceMatrix.needsUpdate = true;
    DEBRIS.forEach((d, i) => {
      const a = smoothstep(4, 30, f) * (1 - smoothstep(d.out - 25, d.out, f));
      tmpP.copy(d.p).multiplyScalar(1 + 0.12 * Math.sin(f * 0.01 + i));
      tmpP.y = d.p.y + 0.3 * Math.sin(f * 0.02 + i * 1.3);
      tmpQ.setFromEuler(new THREE.Euler(d.spin.x * f, d.spin.y * f, d.spin.z * f));
      tmpS.setScalar(d.s * a);
      tmpM.compose(tmpP, tmpQ, tmpS);
      debrisRef.current!.setMatrixAt(i, tmpM);
      tmpC.copy(tints[d.tint]).multiply(tints[d.tint]).multiplyScalar(0.8);
      debrisRef.current!.setColorAt(i, tmpC);
    });
    debrisRef.current!.instanceMatrix.needsUpdate = true;
    if (debrisRef.current!.instanceColor) debrisRef.current!.instanceColor.needsUpdate = true;
    if (sparkRef.current!.instanceColor) sparkRef.current!.instanceColor.needsUpdate = true;
  }, [f, camera, glassMat, traceMat, glassColor, traceColor, accents, flashAttr, textWidth, pulse, reveal, tints]);

  const glowColor = useMemo(() => new THREE.Color(p.glass).multiply(new THREE.Color(p.glass)).multiplyScalar(0.8), [p.glass]);
  const specColor = useMemo(() => new THREE.Color(p.trace).multiplyScalar(1.4), [p.trace]);
  const stripColor = useMemo(() => new THREE.Color(p.trace).multiplyScalar(3), [p.trace]);

  return (
    <>
      <fog attach="fog" args={[p.background, 26, 70]} />
      <hemisphereLight args={["#3fa8ff", "#0b3a8f", 0.35]} />
      <directionalLight position={[4, 16, 6]} intensity={0.75} color="#7fd0ff" />

      {/* floor: dark grid + circuit traces */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[160, 160]} />
        <meshBasicMaterial map={floorTex} map-repeat={[160, 160]} color="#ffffff" />
      </mesh>
      <mesh geometry={trGeo} material={traceMat} />
      <instancedMesh ref={dotsRef} args={[undefined, undefined, TRACES.length * 2]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshBasicMaterial color={new THREE.Color("#bff4ff").multiplyScalar(3)} />
      </instancedMesh>
      <mesh ref={floorGlowRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={glowTex} color={glowColor} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      {/* soft glow wrapped around the cube (drawn over everything, additive) */}
      <mesh ref={backGlowRef} position={[0, 2.6, 0]} scale={[17, 17, 1]} renderOrder={10}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial ref={backGlowMat} map={glowTex} color={glowColor} transparent opacity={0.3} blending={THREE.AdditiveBlending} depthWrite={false} depthTest={false} fog={false} />
      </mesh>
      <instancedMesh ref={specksRef} args={[undefined, undefined, SPECKS.length]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color={specColor} transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={stripRef} args={[undefined, undefined, STRIPS.length]} frustumCulled={false}>
        <boxGeometry args={[0.05, 1, 0.05]} />
        <meshBasicMaterial color={stripColor} />
      </instancedMesh>
      <instancedMesh ref={debrisRef} args={[boxGeo, undefined, DEBRIS.length]} frustumCulled={false}>
        <meshStandardMaterial color="#ffffff" roughness={0.3} metalness={0.1} emissive={p.glass} emissiveIntensity={0.3} envMap={env} envMapIntensity={0.1} transparent opacity={0.85} />
      </instancedMesh>
      <instancedMesh ref={sparkRef} args={[undefined, undefined, SPARKS.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 6]} />
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>

      {/* blocks */}
      <instancedMesh ref={refs.frost} args={[boxGeo, undefined, BY_KIND.frost.length]} frustumCulled={false}>
        <meshStandardMaterial
          color="#ffffff"
          roughness={0.35}
          metalness={0.1}
          emissive={p.glass}
          emissiveIntensity={0.28}
          envMap={env}
          envMapIntensity={0.08}
          transparent
          opacity={0.9}
        />
      </instancedMesh>
      <instancedMesh ref={refs.wire} args={[wireGeo, undefined, BY_KIND.wire.length]} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
      <instancedMesh ref={refs.glow} args={[boxGeo, undefined, BY_KIND.glow.length]} frustumCulled={false}>
        <meshBasicMaterial color="#ffffff" />
      </instancedMesh>
      <instancedMesh ref={refs.glass} args={[glassGeo, glassMat, BY_KIND.glass.length]} frustumCulled={false} renderOrder={2} />

      {/* the word, lying on the top face, extruded upward */}
      {textGeo ? (
        <group ref={textRef} rotation={[0, THREE.MathUtils.degToRad(24), 0]}>
          <mesh geometry={textGeo} rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
            {/* group 0: letter faces (white), group 1: extruded sides (dark) */}
            <meshStandardMaterial attach="material-0" color="#ffffff" emissive="#dfeaff" emissiveIntensity={0.5} metalness={0.2} roughness={0.4} envMap={env} envMapIntensity={0.08} />
            <meshStandardMaterial attach="material-1" color="#2a3a5c" metalness={0.8} roughness={0.35} envMap={env} envMapIntensity={0.12} />
          </mesh>
        </group>
      ) : null}

      <PostFX
        grainFrame={f}
        bloom={{ intensity: 0.8, threshold: 1.0, smoothing: 0.3, radius: 0.75 }}
        dof={{ focusDistance: lerp(30, 23, easeInOutSine(f / 359)), focusRange: 9, bokehScale: 3.5 }}
      />
    </>
  );
};

export const AICube: React.FC<AiCubeProps> = (props) => {
  const frame = useCurrentFrame();
  const font = useMontserratExtraBold();
  return (
    <Scene3D background={props.background} fov={26} near={0.5} far={140}>
      {font ? <CubeScene {...props} frame={frame} /> : null}
    </Scene3D>
  );
};

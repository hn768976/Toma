import React, { useLayoutEffect, useMemo } from "react";
import { staticFile, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { LookCanvas, StudioEnvironment, useShippedFont } from "../lib/LookCanvas";
import { ASPECT, LOOP_FRAMES, TAU, loopPhase } from "../lib/constants";
import { PostConfig } from "../lib/post";
import { mulberry32, range } from "../lib/random";
import { GoldMarketRow } from "../versions";

/**
 * Look 1 — Gold Market.
 *
 * Loop: everything lives on a strip of length S = 6·L that repeats every L
 * (L = wave period). Over 600 frames the world slides by exactly N·L (N = 2)
 * past a static camera, and the rising/falling trend is followed by sliding
 * along y as well, so frame 600 == frame 0 exactly.
 */

const L = 14; // wave period (world units)
const S = 6 * L; // strip length, wraps off-screen
const TRAVEL = 2 * L; // N·L per loop
const BAR_COUNT = 60;
const CANDLE_COUNT = 300;
const TAG_COUNT = 30;
const SLOPE = 0.08;
const CAM_Z = 40;

const wave = (x: number) =>
  3.0 * Math.sin((TAU * x) / L) + 0.75 * Math.sin((2 * TAU * x) / L + 1.3) + 0.35 * Math.sin((3 * TAU * x) / L + 0.4);

const wrap = (x: number) => ((((x + S / 2) % S) + S) % S) - S / 2;

// ---------------------------------------------------------------- layout --
// Generated once at module level from fixed seeds.

const rngBars = mulberry32(0x60_1d);
const BARS = Array.from({ length: BAR_COUNT }, (_, i) => ({
  x: i * (S / BAR_COUNT),
  dy: range(rngBars, -0.18, 0.18),
  z: 0.7 * Math.sin((2 * TAU * i) / BAR_COUNT * 3 + 1) + range(rngBars, -0.35, 0.35),
  ry: range(rngBars, -0.08, 0.08),
  rz: range(rngBars, -0.03, 0.03),
}));

type Candle = { x: number; y: number; z: number; h: number; w: number; wickUp: number; wickDown: number; r: number };
const rngCandles = mulberry32(0xca_d1e);
const CANDLES: Candle[] = Array.from({ length: CANDLE_COUNT }, (_, i) => {
  // depth layers: far / behind bars / just in front / near (big, very blurred)
  const layer = i % 10 < 4 ? 0 : i % 10 < 7 ? 1 : i % 10 < 9 ? 2 : 3;
  const z = [range(rngCandles, -40, -18), range(rngCandles, -16, -7), range(rngCandles, 7, 14), range(rngCandles, 16, 26)][layer];
  const h = range(rngCandles, 0.25, 1.5) * (rngCandles() < 0.15 ? 1.6 : 1);
  return {
    x: rngCandles() * S,
    y: range(rngCandles, -6.0, 3.0),
    z,
    h,
    w: 0.34,
    wickUp: range(rngCandles, 0.1, 0.7),
    wickDown: range(rngCandles, 0.1, 0.6),
    r: rngCandles(),
  };
});

const rngTags = mulberry32(0x7a_95);
const TAG_VALUES = Array.from({ length: 40 }, () => range(rngTags, 0.4, 9.6).toFixed(2));
const TAGS = Array.from({ length: TAG_COUNT }, (_, i) => {
  const bar = Math.floor((i / TAG_COUNT) * BAR_COUNT + range(rngTags, 0, 2));
  return {
    bar,
    dx: range(rngTags, -0.9, 0.2),
    dy: range(rngTags, 0.6, 2.0),
    z: range(rngTags, -0.5, 2.5),
    seq: Math.floor(range(rngTags, 0, 40)),
    step: [1, 3, 7][i % 3],
    size: range(rngTags, 0.85, 1.15),
  };
});
const TAG_PERIOD = 30; // frames per value change; divides 600

// -------------------------------------------------------------- geometry --

/** Upright ingot: a bevelled frustum whose small face points at the camera. */
const ingotGeometry = () => {
  type Ring = { z: number; hw: number; top: number; bot: number; cr: number };
  const rings: Ring[] = [
    { z: -0.18, hw: 0.5, top: 1.05, bot: -1.42, cr: 0.07 },
    { z: 0.12, hw: 0.42, top: 0.96, bot: -0.96, cr: 0.05 },
    { z: 0.18, hw: 0.39, top: 0.93, bot: -0.93, cr: 0.04 },
  ];
  const ringPts = (r: Ring) => {
    const pts: THREE.Vector3[] = [];
    const corners = [
      [r.hw - r.cr, r.top - r.cr, 0],
      [-(r.hw - r.cr), r.top - r.cr, Math.PI / 2],
      [-(r.hw - r.cr), r.bot + r.cr, Math.PI],
      [r.hw - r.cr, r.bot + r.cr, (3 * Math.PI) / 2],
    ];
    for (const [cx, cy, a0] of corners)
      for (let k = 0; k <= 3; k++) {
        const a = a0 + (k / 3) * (Math.PI / 2);
        pts.push(new THREE.Vector3(cx + Math.cos(a) * r.cr, cy + Math.sin(a) * r.cr, r.z));
      }
    return pts;
  };
  const P = rings.map(ringPts);
  const n = P[0].length;
  // sides (shared vertices -> soft bevels)
  const pos: number[] = [];
  const idx: number[] = [];
  for (const ring of P) for (const p of ring) pos.push(p.x, p.y, p.z);
  for (let r = 0; r < P.length - 1; r++)
    for (let i = 0; i < n; i++) {
      const a = r * n + i;
      const b = r * n + ((i + 1) % n);
      const c = (r + 1) * n + i;
      const d = (r + 1) * n + ((i + 1) % n);
      idx.push(a, b, c, b, d, c);
    }
  const sides = new THREE.BufferGeometry();
  sides.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  sides.setIndex(idx);
  sides.computeVertexNormals();
  const cap = (ring: THREE.Vector3[], front: boolean) => {
    const cpos: number[] = [];
    const cidx: number[] = [];
    const c = ring.reduce((acc, p) => acc.add(p), new THREE.Vector3()).multiplyScalar(1 / ring.length);
    cpos.push(c.x, c.y, c.z);
    for (const p of ring) cpos.push(p.x, p.y, p.z);
    for (let i = 0; i < ring.length; i++) {
      const a = 1 + i;
      const b = 1 + ((i + 1) % ring.length);
      if (front) cidx.push(0, a, b);
      else cidx.push(0, b, a);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(cpos, 3));
    g.setIndex(cidx);
    g.computeVertexNormals();
    return g;
  };
  const geo = mergeGeometries([sides, cap(P[2], true), cap(P[0], false)]);
  return geo;
};

const makeTagAtlas = (values: string[], arrow: "▲" | "▼") => {
  const cw = 256;
  const ch = 64;
  const cols = 8;
  const rows = Math.ceil(values.length / cols);
  const canvas = document.createElement("canvas");
  canvas.width = cw * cols;
  canvas.height = ch * rows;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#fff";
  ctx.font = '500 40px "Inter"';
  ctx.textBaseline = "middle";
  values.forEach((v, i) => {
    const x0 = (i % cols) * cw;
    const y0 = Math.floor(i / cols) * ch;
    const cy = y0 + ch / 2;
    ctx.beginPath();
    if (arrow === "▲") {
      ctx.moveTo(x0 + 14, cy + 11);
      ctx.lineTo(x0 + 40, cy + 11);
      ctx.lineTo(x0 + 27, cy - 11);
    } else {
      ctx.moveTo(x0 + 14, cy - 11);
      ctx.lineTo(x0 + 40, cy - 11);
      ctx.lineTo(x0 + 27, cy + 11);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillText(v, x0 + 58, cy + 1);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return { tex, cols, rows };
};

const TAG_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const TAG_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec4 rect;
uniform vec3 color;
varying vec2 vUv;
void main() {
  float a = texture2D(map, rect.xy + vUv * rect.zw).a;
  gl_FragColor = vec4(color * a, a);
}`;

const POST: PostConfig = {
  exposure: 1.0,
  bloom: { strength: 0.42, threshold: 0.8, knee: 0.7, spread: 0.92 },
  dof: { focus: CAM_Z, farBlur: 16, nearBlur: 1.1, maxCoc: 30 },
  vignette: 0.3,
  grain: 0.02,
  msaa: 4,
};

// ------------------------------------------------------------------ scene --

const Scene: React.FC<{ row: GoldMarketRow; camera: THREE.PerspectiveCamera }> = ({ row }) => {
  const frame = useCurrentFrame();
  const slope = SLOPE * row.trend;

  const objs = useMemo(() => {
    const group = new THREE.Group();
    const gold = new THREE.MeshStandardMaterial({
      color: new THREE.Color(row.gold),
      metalness: 1,
      roughness: 0.55,
      emissive: new THREE.Color(row.gold).multiplyScalar(0.12),
      envMapIntensity: 1,
    });
    const bars = new THREE.InstancedMesh(ingotGeometry(), gold, BAR_COUNT);
    bars.frustumCulled = false;
    group.add(bars);

    const body = new THREE.BoxGeometry(1, 1, 0.12);
    const candleMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const bodies = new THREE.InstancedMesh(body, candleMat, CANDLE_COUNT);
    const wicks = new THREE.InstancedMesh(body, candleMat, CANDLE_COUNT);
    bodies.frustumCulled = false;
    wicks.frustumCulled = false;
    const up = new THREE.Color(row.upColor);
    const down = new THREE.Color(row.downColor);
    CANDLES.forEach((c, i) => {
      const isUp = c.r < row.upShare;
      const col = (isUp ? up : down).clone().multiplyScalar(isUp ? 0.75 : 1.1);
      bodies.setColorAt(i, col);
      wicks.setColorAt(i, col.clone().multiplyScalar(0.8));
    });
    group.add(bodies, wicks);

    const atlas = makeTagAtlas(TAG_VALUES, row.tagArrow);
    const tagGeo = new THREE.PlaneGeometry(4, 1);
    const tagColor = new THREE.Color(row.tagColor).multiplyScalar(2.4);
    const tags = TAGS.map(() => {
      const mat = new THREE.ShaderMaterial({
        vertexShader: TAG_VERT,
        fragmentShader: TAG_FRAG,
        uniforms: { map: { value: atlas.tex }, rect: { value: new THREE.Vector4() }, color: { value: tagColor } },
        alphaToCoverage: true,
      });
      const m = new THREE.Mesh(tagGeo, mat);
      group.add(m);
      return m;
    });

    // warm key lights for bright highlights on the gold
    const k1 = new THREE.PointLight(0xffd9a0, 22, 0, 2);
    k1.position.set(-6, 7, 10);
    const k2 = new THREE.PointLight(0xffc070, 14, 0, 2);
    k2.position.set(7, -4, 8);
    group.add(k1, k2);
    return { group, bars, bodies, wicks, tags, atlas };
  }, [row]);

  useLayoutEffect(() => {
    const t = loopPhase(frame);
    const off = t * TRAVEL;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const p = new THREE.Vector3();
    const s = new THREE.Vector3(1, 1, 1);
    const baseY = 0.9;

    BARS.forEach((b, i) => {
      const xr = wrap(b.x - off);
      p.set(xr, baseY + slope * xr + wave(b.x) + b.dy, b.z);
      e.set(0, b.ry, b.rz);
      q.setFromEuler(e);
      s.set(1, 1, 1);
      objs.bars.setMatrixAt(i, m.compose(p, q, s));
    });
    objs.bars.instanceMatrix.needsUpdate = true;

    q.identity();
    CANDLES.forEach((c, i) => {
      const xr = wrap(c.x - off);
      const y = baseY - 1.0 + slope * xr + 0.5 * wave(c.x) + c.y;
      p.set(xr, y, c.z);
      s.set(c.w, c.h, 1);
      objs.bodies.setMatrixAt(i, m.compose(p, q, s));
      const wickLen = c.h + c.wickUp + c.wickDown;
      p.set(xr, y + (c.wickUp - c.wickDown) / 2, c.z - 0.01);
      s.set(0.045, wickLen, 0.6);
      objs.wicks.setMatrixAt(i, m.compose(p, q, s));
    });
    objs.bodies.instanceMatrix.needsUpdate = true;
    objs.wicks.instanceMatrix.needsUpdate = true;

    const f = ((frame % LOOP_FRAMES) + LOOP_FRAMES) % LOOP_FRAMES;
    const step = Math.floor(f / TAG_PERIOD);
    TAGS.forEach((tg, i) => {
      const b = BARS[tg.bar % BAR_COUNT];
      const xr = wrap(b.x + tg.dx - off);
      const mesh = objs.tags[i];
      mesh.position.set(xr + 1.6, baseY + slope * xr + wave(b.x) + tg.dy, b.z + tg.z);
      mesh.scale.setScalar(0.46 * tg.size);
      const vi = (tg.seq + step * tg.step) % TAG_VALUES.length;
      const { cols, rows } = objs.atlas;
      const rect = (mesh.material as THREE.ShaderMaterial).uniforms.rect.value as THREE.Vector4;
      rect.set((vi % cols) / cols, 1 - (Math.floor(vi / cols) + 1) / rows, 1 / cols, 1 / rows);
    });
  }, [frame, objs, slope]);

  return <primitive object={objs.group} />;
};

export const GoldMarket: React.FC<{ row: GoldMarketRow }> = ({ row }) => {
  const fontReady = useShippedFont("Inter", staticFile("fonts/Inter-Medium.woff2"), "500");
  const camera = useMemo(() => {
    const c = new THREE.PerspectiveCamera(19.6, ASPECT, 1, 250);
    c.position.set(0, -2.0, CAM_Z);
    c.lookAt(0, 0.8, 0);
    c.updateMatrixWorld();
    return c;
  }, []);
  const envRot = useMemo(() => new THREE.Euler(0, Math.PI, 0), []);
  if (!fontReady) return null;
  return (
    <LookCanvas post={POST} camera={camera}>
      <StudioEnvironment url={staticFile("hdri/studio.exr")} intensity={0.34} rotation={envRot} />
      <Scene row={row} camera={camera} />
    </LookCanvas>
  );
};

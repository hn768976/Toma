import React, { useLayoutEffect, useRef } from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import * as THREE from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { useBacking } from "../lib/backing";
import { useFont } from "../lib/useFont";
import { mulberry32, smoothstep, TAU } from "../lib/random";
import { GLOBE_COLOR, GLOBE_LABEL_COUNT, GLOBE_LABELS } from "./labels";

const LOOP = 600;
const N_NODES = 900;
const FONT = "Rajdhani";

// ---------------------------------------------------------------------------
// Node layout: dense clusters in patches, sparse between; generated once.
// ---------------------------------------------------------------------------
const rand = mulberry32(0x61085);
const randUnit = () => {
  const z = rand() * 2 - 1;
  const a = rand() * TAU;
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(r * Math.cos(a), z, r * Math.sin(a));
};
const CLUSTERS = Array.from({ length: 16 }, () => ({ c: randUnit(), sigma: 0.12 + rand() * 0.22 }));
const NODES: THREE.Vector3[] = Array.from({ length: N_NODES }, () => {
  if (rand() < 0.62) {
    const cl = CLUSTERS[Math.floor(rand() * CLUSTERS.length)];
    // gaussian-ish offset in the tangent plane
    const g = () => (rand() + rand() + rand() - 1.5) * 1.15;
    const v = cl.c.clone().add(new THREE.Vector3(g(), g(), g()).multiplyScalar(cl.sigma));
    return v.normalize();
  }
  return randUnit();
});

// Edges: each node to its 3 nearest neighbours (within reach), plus long chords.
const EDGES: { a: number; b: number; alpha: number }[] = (() => {
  const seen = new Set<string>();
  const out: { a: number; b: number; alpha: number }[] = [];
  const add = (a: number, b: number, alpha: number) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (a === b || seen.has(key)) return;
    seen.add(key);
    out.push({ a, b, alpha });
  };
  for (let i = 0; i < N_NODES; i++) {
    const d = NODES.map((p, j) => ({ j, d: p.distanceToSquared(NODES[i]) })).sort((x, y) => x.d - y.d);
    const kN = 2 + Math.floor(rand() * 3);
    for (let n = 1; n <= kN; n++) if (d[n].d < 0.16) add(i, d[n].j, 0.4 + rand() * 0.5);
  }
  for (let n = 0; n < 12; n++) {
    const a = Math.floor(rand() * N_NODES);
    let b = Math.floor(rand() * N_NODES);
    for (let t = 0; t < 20 && NODES[a].distanceTo(NODES[b]) < 0.9; t++) b = Math.floor(rand() * N_NODES);
    add(a, b, 0.18 + rand() * 0.14);
  }
  return out;
})();

// Labels attached to nodes, preferring clustered ones.
const LABELS = Array.from({ length: GLOBE_LABEL_COUNT }, (_, i) => GLOBE_LABELS[i % GLOBE_LABELS.length]).map((text, i) => ({
  text,
  node: Math.floor(rand() * N_NODES),
  size: /^\d+$/.test(text) ? 0.024 : 0.017 + rand() * 0.014, // world-space cap height
  lift: 1.02 + Math.pow(rand(), 2) * 0.18, // most hug the surface, some float out

  dx: 0.01 + rand() * 0.02,
  bold: i % 7 === 0,
}));
// Loose dust drifting round the sphere (no links).
const N_DUST = 110;
const DUST: THREE.Vector3[] = Array.from({ length: N_DUST }, () => randUnit().multiplyScalar(1.02 + Math.pow(rand(), 1.5) * 0.18));
const DUST_SIZE = DUST.map(() => 0.6 + rand() * 0.6);
const NODE_SIZE = NODES.map(() => (rand() < 0.08 ? 2.2 : 1) * (0.8 + rand() * 0.5));

// ---------------------------------------------------------------------------
type GlobeScene = {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  globe: THREE.Group;
  lineGeo: LineSegmentsGeometry;
  lineColors: Float32Array;
  points: THREE.Points;
  pointAlpha: THREE.BufferAttribute;
  labels: THREE.InstancedMesh;
  labelAlpha: THREE.InstancedBufferAttribute;
  rim: THREE.ShaderMaterial;
};

const buildAtlas = () => {
  const cell = 64;
  const cols = 4;
  const rows = Math.ceil(LABELS.length / cols);
  const cw = 512; // 140 labels -> 2048 x 2240 atlas
  const c = document.createElement("canvas");
  c.width = cw * cols;
  c.height = cell * rows;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.textBaseline = "alphabetic";
  const rects: { u: number; v: number; w: number; h: number; aspect: number }[] = [];
  LABELS.forEach((l, i) => {
    const x = (i % cols) * cw;
    const y = Math.floor(i / cols) * cell;
    ctx.font = `600 52px "${FONT}"`;
    (ctx as unknown as { letterSpacing: string }).letterSpacing = "5px";
    ctx.fillText(l.text, x + 4, y + 50);
    const w = Math.min(cw - 8, ctx.measureText(l.text).width + 10);
    rects.push({ u: x / c.width, v: 1 - (y + cell) / c.height, w: w / c.width, h: cell / c.height, aspect: w / cell });
  });
  return { canvas: c, rects };
};

const build = (canvas: HTMLCanvasElement, bw: number, bh: number): GlobeScene => {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
  renderer.setPixelRatio(1);
  renderer.setSize(bw, bh, false);
  renderer.setClearColor(0x000000, 1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, bw / bh, 0.1, 50);
  const globe = new THREE.Group();
  scene.add(globe);
  const px = bw / 1280; // line/point sizes are authored at 720p

  // lines
  const pos = new Float32Array(EDGES.length * 6);
  EDGES.forEach((e, i) => {
    NODES[e.a].toArray(pos, i * 6);
    NODES[e.b].toArray(pos, i * 6 + 3);
  });
  const lineGeo = new LineSegmentsGeometry();
  lineGeo.setPositions(pos);
  const lineColors = new Float32Array(EDGES.length * 6);
  lineGeo.setColors(lineColors);
  const lineMat = new LineMaterial({
    linewidth: 1.05 * px,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
  lineMat.resolution.set(bw, bh);
  globe.add(new LineSegments2(lineGeo, lineMat));

  // nodes
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array([...NODES, ...DUST].flatMap((n) => n.toArray())), 3));
  pGeo.setAttribute("aSize", new THREE.BufferAttribute(new Float32Array([...NODE_SIZE, ...DUST_SIZE].map((s) => s * 2.1 * px)), 1));
  const pointAlpha = new THREE.BufferAttribute(new Float32Array(N_NODES + N_DUST), 1);
  pGeo.setAttribute("aAlpha", pointAlpha);
  const pMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Vector3(...GLOBE_COLOR) } },
    vertexShader: `attribute float aSize; attribute float aAlpha; varying float vA;
      void main(){ vA = aAlpha; gl_PointSize = aSize; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5) * 2.0; float a = (1.0 - smoothstep(0.55, 1.0, d)) * vA;
        if (a < 0.003) discard; gl_FragColor = vec4(uColor * a, 1.0); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
  const points = new THREE.Points(pGeo, pMat);
  globe.add(points);

  // rim arc: thin bright silhouette where the edge faces the camera
  const rim = new THREE.ShaderMaterial({
    uniforms: { uDir: { value: new THREE.Vector2(-0.6, 0.8) }, uReveal: { value: new THREE.Vector4(0, 0, 1, -1) }, uColor: { value: new THREE.Vector3(...GLOBE_COLOR) } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec2 uDir; uniform vec4 uReveal; uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
      void main(){
        float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
        float rimI = pow(f, 12.0) * 3.4 + pow(f, 4.0) * 0.22;   // bright line + soft bloom
        float arcM = smoothstep(0.25, 0.9, dot(normalize(vN.xy + 1e-5), normalize(uDir)));
        float rev = 0.35 + 0.65 * smoothstep(uReveal.w - 0.25, uReveal.w + 0.25, dot(normalize(vN), normalize(uReveal.xyz)));
        float a = max(0.0, rimI * arcM * rev - 0.006);
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    side: THREE.FrontSide,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.005, 160, 120), rim));

  // labels: instanced billboards sampling a canvas atlas
  const atlas = buildAtlas();
  const tex = new THREE.CanvasTexture(atlas.canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.anisotropy = 4;
  const lGeo = new THREE.PlaneGeometry(1, 1);
  lGeo.translate(0.5, 0, 0); // left-anchored
  const rects = new Float32Array(LABELS.length * 4);
  const sizes = new Float32Array(LABELS.length * 2);
  LABELS.forEach((l, i) => {
    const r = atlas.rects[i];
    rects.set([r.u, r.v, r.w, r.h], i * 4);
    const h = l.size * 1.6; // cell height vs cap height
    sizes.set([h * r.aspect, h], i * 2);
  });
  lGeo.setAttribute("aRect", new THREE.InstancedBufferAttribute(rects, 4));
  lGeo.setAttribute("aSize", new THREE.InstancedBufferAttribute(sizes, 2));
  const labelAlpha = new THREE.InstancedBufferAttribute(new Float32Array(LABELS.length), 1);
  lGeo.setAttribute("aAlpha", labelAlpha);
  const lMat = new THREE.ShaderMaterial({
    uniforms: { uMap: { value: tex }, uColor: { value: new THREE.Vector3(...GLOBE_COLOR) } },
    vertexShader: `attribute vec4 aRect; attribute vec2 aSize; attribute float aAlpha; varying vec2 vUv; varying float vA;
      void main(){
        vec4 anchor = viewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        anchor.xy += position.xy * aSize;
        vUv = aRect.xy + uv * aRect.zw; vA = aAlpha;
        gl_Position = projectionMatrix * anchor;
      }`,
    fragmentShader: `uniform sampler2D uMap; uniform vec3 uColor; varying vec2 vUv; varying float vA;
      void main(){ float a = texture2D(uMap, vUv).a * vA; if (a < 0.003) discard; gl_FragColor = vec4(uColor * a, 1.0); }`,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
  });
  const labels = new THREE.InstancedMesh(lGeo, lMat, LABELS.length);
  labels.frustumCulled = false;
  scene.add(labels);

  return { renderer, scene, camera, globe, lineGeo, lineColors, points, pointAlpha, labels, labelAlpha, rim };
};

/** Reveal band (view space): direction + threshold, whole cycles in the loop. */
const revealAt = (phase: number) => {
  const a = TAU * phase + 0.6;
  const dir = new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.8 + 0.25, 0.45).normalize();
  const th = -0.5 + 0.8 * Math.cos(TAU * 2 * phase); // -1.3 (whole sphere) .. 0.3 (an arc)
  return { dir, th };
};

export const NeuralGlobe_Labels: React.FC = () => {
  const frame = useCurrentFrame();
  const { bw, bh } = useBacking();
  const ready = useFont(FONT, "fonts/Rajdhani-SemiBold.woff2");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<GlobeScene | null>(null);

  useLayoutEffect(() => {
    if (!ready) return;
    if (!sceneRef.current) sceneRef.current = build(canvasRef.current!, bw, bh);
    const S = sceneRef.current;
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const phase = f / LOOP;

    // camera orbits once, tilt breathes; the globe turns twice the other way round
    const orbit = TAU * phase;
    const tilt = 0.28 + 0.18 * Math.sin(TAU * phase + 0.8);
    const dist = 3.9;
    S.camera.position.set(dist * Math.sin(orbit) * Math.cos(tilt), dist * Math.sin(tilt), dist * Math.cos(orbit) * Math.cos(tilt));
    S.camera.lookAt(0, 0, 0);
    S.camera.translateY(-0.22); // sit the globe a little high in frame
    S.camera.updateMatrixWorld();
    S.globe.rotation.set(0.25 * Math.sin(TAU * phase), TAU * 2 * phase, 0);
    S.globe.updateMatrixWorld();

    const { dir, th } = revealAt(phase);
    const view = S.camera.matrixWorldInverse;
    const nodeVis = new Float32Array(N_NODES);
    const facing = new Float32Array(N_NODES);
    const tmp = new THREE.Vector3();
    const nView = new THREE.Vector3();
    const camDir = new THREE.Vector3();
    for (let i = 0; i < N_NODES; i++) {
      tmp.copy(NODES[i]).applyMatrix4(S.globe.matrixWorld);
      camDir.copy(S.camera.position).sub(tmp).normalize();
      facing[i] = tmp.dot(camDir); // >0 front hemisphere
      nView.copy(tmp).transformDirection(view);
      const rev = smoothstep(th - 0.25, th + 0.25, nView.dot(dir));
      nodeVis[i] = rev;
      S.pointAlpha.array[i] = rev * (0.35 + 0.65 * smoothstep(-0.5, 0.4, facing[i]));
    }
    for (let i = 0; i < N_DUST; i++) {
      tmp.copy(DUST[i]).applyMatrix4(S.globe.matrixWorld);
      nView.copy(tmp).normalize().transformDirection(view);
      S.pointAlpha.array[N_NODES + i] = 0.75 * smoothstep(th - 0.25, th + 0.25, nView.dot(dir));
    }
    S.pointAlpha.needsUpdate = true;

    EDGES.forEach((e, i) => {
      const va = nodeVis[e.a] * e.alpha * (0.4 + 0.6 * smoothstep(-0.5, 0.4, facing[e.a]));
      const vb = nodeVis[e.b] * e.alpha * (0.4 + 0.6 * smoothstep(-0.5, 0.4, facing[e.b]));
      S.lineColors.fill(va * GLOBE_COLOR[0], i * 6, i * 6 + 3);
      S.lineColors.fill(vb * GLOBE_COLOR[0], i * 6 + 3, i * 6 + 6);
    });
    S.lineGeo.setColors(S.lineColors);

    const m = new THREE.Matrix4();
    LABELS.forEach((l, i) => {
      tmp.copy(NODES[l.node]).multiplyScalar(l.lift).applyMatrix4(S.globe.matrixWorld);
      m.makeTranslation(tmp.x, tmp.y, tmp.z);
      S.labels.setMatrixAt(i, m);
      S.labelAlpha.array[i] = nodeVis[l.node] * smoothstep(-0.15, 0.3, facing[l.node]);
    });
    S.labels.instanceMatrix.needsUpdate = true;
    S.labelAlpha.needsUpdate = true;

    const rimDir = 1.9 + 0.5 * Math.sin(TAU * phase); // crescent swings around the upper-left
    (S.rim.uniforms.uDir.value as THREE.Vector2).set(Math.cos(rimDir), Math.sin(rimDir));
    (S.rim.uniforms.uReveal.value as THREE.Vector4).set(dir.x, dir.y, dir.z, th);

    S.renderer.render(S.scene, S.camera);
    S.renderer.getContext().finish();
  }, [frame, bw, bh, ready]);

  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <canvas ref={canvasRef} width={bw} height={bh} style={{ width: "100%", height: "100%" }} />
    </AbsoluteFill>
  );
};

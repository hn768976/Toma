import { continueRender, delayRender } from "remotion";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { LOOP } from "../../lib/loop";
import { mulberry32 } from "../../lib/random";
import { PostChain } from "../../lib/three/PostChain";
import { ThreeLook, ThreeRender } from "../../lib/three/ThreeLook";
import type { MapPalette } from "../../versions";
import { drawCandles, drawGrid, drawLineTexture, drawStreak } from "./charts";
import { Dot, loadLandDots } from "./landDots";

const hex = (h: string) => new THREE.Color().setStyle(h, THREE.LinearSRGBColorSpace);
const TAU = Math.PI * 2;

// World layout: the map is 36 x 13.8 units (0.1 unit per degree). All
// layers share the map's tilt and sit at different depths along its normal.
const DEG = 0.1;

// ---------------------------------------------------------------- shaders

const BG_VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }
`;
const BG_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform vec3 uCentre;
uniform vec3 uEdge;
void main() {
  vec2 p = (vUv - vec2(0.55, 0.62)) * vec2(1.6, 1.0);
  float d = clamp(length(p) * 1.15, 0.0, 1.0);
  outColor = vec4(mix(uCentre, uEdge, smoothstep(0.0, 1.0, d)), 1.0);
}
`;

const DOT_VERT = /* glsl */ `
in float aBright;
in float aPeriod;
in float aPhase;
uniform float uFrame;
uniform float uPx;
uniform float uSize;
out float vBright;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.0;
  if (aPeriod > 0.0) tw = pow(max(0.0, sin(6.28318530718 * (uFrame / aPeriod + aPhase))), 10.0);
  vBright = aBright * (1.0 + 2.2 * tw);
  gl_PointSize = max(1.0, 2.0 * uSize * uPx / -mv.z);
}
`;
const DOT_FRAG = /* glsl */ `
precision highp float;
in float vBright;
out vec4 outColor;
uniform vec3 uColor;
void main() {
  vec2 q = abs(gl_PointCoord - 0.5) * 2.0;
  float d = max(q.x, q.y);
  // square core plus a faint round glow tail (the reference's haze)
  float core = 1.0 - smoothstep(0.32, 0.5, d);
  float tail = 0.22 * exp(-dot(q, q) * 3.0);
  float a = core + tail;
  if (a < 0.02) discard;
  outColor = vec4(uColor * vBright * a, 1.0);
}
`;

const LAYER_VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
// Additive textured layer. Writes depth only where it has content, so the
// depth of field reads the right distance for each pixel.
const LAYER_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D tMap;
uniform vec3 uColor;
uniform float uOpacity;
uniform vec2 uOffset;
uniform float uEdgeFade;
void main() {
  vec4 t = texture(tMap, vUv + uOffset);
  float edge = uEdgeFade > 0.0 ? smoothstep(0.0, uEdgeFade, vUv.x) * smoothstep(0.0, uEdgeFade, 1.0 - vUv.x) : 1.0;
  float a = t.a * uOpacity * edge;
  if (a < 0.015) discard;
  outColor = vec4(uColor * t.rgb * uOpacity * edge, 1.0);
}
`;

// ---------------------------------------------------------------- helpers

const canvasTexture = (w: number, h: number, wrap = false) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.premultiplyAlpha = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  if (wrap) tex.wrapS = THREE.RepeatWrapping;
  return { canvas, tex, ctx: canvas.getContext("2d")! };
};

const layerMaterial = (tex: THREE.Texture, color: THREE.Color, opacity: number, edgeFade = 0) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: LAYER_VERT,
    fragmentShader: LAYER_FRAG,
    uniforms: {
      tMap: { value: tex },
      uColor: { value: color },
      uOpacity: { value: opacity },
      uOffset: { value: new THREE.Vector2() },
      uEdgeFade: { value: edgeFade },
    },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: true,
    depthTest: true,
    side: THREE.DoubleSide,
  });

// ---------------------------------------------------------------- scene

const buildWorld = (dots: Dot[], palette: MapPalette) => {
  const scene = new THREE.Scene();
  const rng = mulberry32(0x9e0d);
  const chartColor = hex(palette.charts);
  const dotColor = hex(palette.dots);

  // background gradient (float, no 8-bit steps)
  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      uniforms: { uCentre: { value: hex(palette.bgCentre) }, uEdge: { value: hex(palette.bgEdge) } },
      depthWrite: false,
      depthTest: false,
    }),
  );
  bg.frustumCulled = false;
  bg.renderOrder = -10;
  scene.add(bg);

  // everything else hangs off one tilted group
  const group = new THREE.Group();
  group.rotation.order = "YXZ";
  group.rotation.y = 0.32; // right side recedes
  group.rotation.x = -0.44; // ~25 degrees, top away
  scene.add(group);

  // grid (just behind the map)
  const grid = canvasTexture(2048, 1024);
  drawGrid(grid.ctx, 2048, 1024, palette.charts);
  grid.tex.needsUpdate = true;
  const gridMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), layerMaterial(grid.tex, chartColor, 0.8));
  gridMesh.position.set(1, 1, -0.25);
  group.add(gridMesh);

  // map dots
  const pos = new Float32Array(dots.length * 3);
  const bright = new Float32Array(dots.length);
  const period = new Float32Array(dots.length);
  const phase = new Float32Array(dots.length);
  dots.forEach((d, i) => {
    pos[i * 3] = d.lon * DEG;
    pos[i * 3 + 1] = (d.lat - 15) * DEG;
    pos[i * 3 + 2] = d.column ? 0.02 : 0;
    bright[i] = d.bright;
    period[i] = d.period;
    phase[i] = d.phase;
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("aBright", new THREE.BufferAttribute(bright, 1));
  geo.setAttribute("aPeriod", new THREE.BufferAttribute(period, 1));
  geo.setAttribute("aPhase", new THREE.BufferAttribute(phase, 1));
  const dotMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: DOT_VERT,
    fragmentShader: DOT_FRAG,
    uniforms: { uFrame: { value: 0 }, uPx: { value: 720 }, uSize: { value: 0.085 }, uColor: { value: dotColor } },
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: true,
  });
  const points = new THREE.Points(geo, dotMat);
  points.frustumCulled = false;
  group.add(points);

  // candles (redrawn per frame), slightly in front, right half
  const candles = canvasTexture(2048, 1024);
  const candleMesh = new THREE.Mesh(new THREE.PlaneGeometry(26, 14), layerMaterial(candles.tex, chartColor, 1));
  candleMesh.position.set(10.5, 3.6, 3.0);
  group.add(candleMesh);
  // a second, faint candle group lower right (same layer, mirrored)
  const candleEcho = new THREE.Mesh(new THREE.PlaneGeometry(16, 7), layerMaterial(candles.tex, chartColor, 0.32));
  candleEcho.scale.x = -1;
  candleEcho.position.set(11, -4.2, 0.8);
  group.add(candleEcho);

  // line charts on their own planes, scrolled by whole periods
  const lineDefs = [
    { y: 5.2, z: 2.8, w: 12, h: 3, op: 0.9, speed: 1, jag: 1.4, x: -10 },
    { y: -1.2, z: 0.9, w: 30, h: 3.2, op: 0.5, speed: 2, jag: 0.8, x: -2 },
    { y: 6.0, z: 4.2, w: 12, h: 4, op: 0.75, speed: 1, jag: 1.6, x: 9 },
    { y: -3.4, z: -0.6, w: 14, h: 2.6, op: 0.45, speed: 3, jag: 1.0, x: -9 },
  ];
  const lines = lineDefs.map((d, i) => {
    const t = canvasTexture(2048, 256, true);
    drawLineTexture(t.ctx, 2048, 256, 1000 + i * 77, "#ffffff", d.jag);
    t.tex.needsUpdate = true;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(d.w, d.h), layerMaterial(t.tex, chartColor, d.op, 0.2));
    m.position.set(d.x, d.y, d.z);
    group.add(m);
    return { mesh: m, def: d, tex: t.tex };
  });

  // light streaks sliding across (whole cycles per loop)
  const streak = canvasTexture(512, 32);
  drawStreak(streak.ctx, 512, 32);
  streak.tex.needsUpdate = true;
  const streaks = Array.from({ length: 11 }, () => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(12 + rng() * 10, 0.1), layerMaterial(streak.tex, chartColor, 0.5 + rng() * 0.4));
    const def = { y: -5 + rng() * 10, z: 0.5 + rng() * 4, cycles: 1 + Math.floor(rng() * 2), phase: rng() };
    m.position.set(0, def.y, def.z);
    group.add(m);
    return { mesh: m, def };
  });

  const camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.5, 200);
  const disposables: { dispose: () => void }[] = [grid.tex, candles.tex, streak.tex, geo, dotMat, ...lines.map((l) => l.tex)];
  return { scene, group, points, dotMat, candles, lines, streaks, camera, disposables };
};

// ---------------------------------------------------------------- component

export const MarketMap: React.FC<{ palette: MapPalette }> = ({ palette }) => {
  const [dots, setDots] = useState<Dot[] | null>(null);
  const handle = useRef<number | null>(null);
  useLayoutEffect(() => {
    handle.current = delayRender("Loading Natural Earth land");
    loadLandDots()
      .then(setDots)
      .catch((e) => {
        console.error(e);
        setDots([]);
      });
    return () => {
      if (handle.current !== null) continueRender(handle.current);
      handle.current = null;
    };
  }, []);
  // release only after the scene (and its own render holds) has mounted
  useLayoutEffect(() => {
    if (dots && handle.current !== null) {
      continueRender(handle.current);
      handle.current = null;
    }
  }, [dots]);
  return dots ? <MarketMapScene dots={dots} palette={palette} /> : null;
};

const MarketMapScene: React.FC<{ dots: Dot[]; palette: MapPalette }> = ({ dots, palette }) => {
  const chain = useRef<PostChain | null>(null);
  const world = useMemo(() => buildWorld(dots, palette), [dots, palette]);
  useEffect(
    () => () => {
      chain.current?.dispose();
      world.disposables.forEach((d) => d.dispose());
    },
    [world],
  );

  const render = useCallback<ThreeRender>(
    (gl, frame, size) => {
      const f = frame % LOOP;
      const ph = (TAU * f) / LOOP;
      const { scene, dotMat, candles, lines, streaks, camera, group } = world;

      // candle texture follows the output size (2x width, up to 4096)
      const cw = Math.min(4096, Math.max(1024, 2 * size.w));
      if (candles.canvas.width !== cw) {
        candles.canvas.width = cw;
        candles.canvas.height = cw / 2;
        candles.tex.dispose();
      }
      drawCandles(candles.ctx, candles.canvas.width, f, palette.charts);
      candles.tex.needsUpdate = true;
      const aniso = gl.capabilities.getMaxAnisotropy();
      candles.tex.anisotropy = aniso;

      for (const l of lines) {
        l.tex.anisotropy = aniso;
        (l.mesh.material as THREE.ShaderMaterial).uniforms.uOffset.value.set((l.def.speed * f) / LOOP, 0);
      }
      for (const s of streaks) {
        const u = (s.def.cycles * f) / LOOP + s.def.phase;
        const p = u - Math.floor(u);
        s.mesh.position.x = -26 + 52 * p;
        (s.mesh.material as THREE.ShaderMaterial).uniforms.uOpacity.value = 0.8 * Math.sin(Math.PI * p);
      }

      // camera: one cosine drift sideways and slightly forward per loop
      camera.aspect = size.w / size.h;
      camera.fov = 38;
      camera.position.set(-4.4 + 1.4 * Math.cos(ph), 0.6 + 0.2 * Math.sin(ph), 29 - 1.2 * (1 - Math.cos(ph)));
      camera.lookAt(camera.position.x * 0.6 + 1.6, 0.1, 0);
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      group.updateMatrixWorld();

      dotMat.uniforms.uFrame.value = f;
      dotMat.uniforms.uPx.value = size.h / (2 * Math.tan((camera.fov * Math.PI) / 360));

      // focus on the map plane at the centre of the frame
      const centre = new THREE.Vector3(0, 0, 0).applyMatrix4(group.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      const focus = -centre.z;

      if (!chain.current || chain.current.w !== size.w || chain.current.h !== size.h) {
        chain.current?.dispose();
        chain.current = new PostChain(size.w, size.h);
      }
      chain.current.render(gl, scene, camera, f, { focus, aperture: 8, maxCoc: 4 }, 0.01, 1);
    },
    [palette, world],
  );

  return <ThreeLook render={render} />;
};

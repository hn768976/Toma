// Look 3 — Hologram Threat Map (three.js, 20s loop).
// Natural Earth land → dense dot grid (Points shader) on a tilted plane, some
// cells raised into translucent blocks, orange pulsing hotspots, sliding dash
// streams, HUD tags. Loop: streams move whole pattern periods per 600 frames,
// pulse periods divide 600, camera drift is a closed sin/cos path.
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { drawLand, loadFonts, loadLand } from "../lib/assets";
import { makePlaneDOF } from "../lib/dof";
import { hexToLinear } from "../lib/math";
import { PostRender } from "../lib/post";
import { fbm, hash2, mulberry32 } from "../lib/random";
import { useAsset } from "../lib/useAsset";
import type { MapPalette } from "../versions";

export const MAP_FRAMES = 600;

// Map window (degrees) and scale (world units per degree).
const WIN = { lon0: -172, lon1: 75, lat0: 82, lat1: -58 };
const S = 0.25;
const LON_C = -45;
const LAT_C = 15;
const toXZ = (lon: number, lat: number): [number, number] => [(lon - LON_C) * S, -(lat - LAT_C) * S];
const STEP = 0.42; // dot grid spacing in degrees

const HOTSPOTS = [
  { lon: -112, lat: 33, r: 17, period: 120 },
  { lon: -15, lat: 14, r: 5, period: 100 },
  { lon: -40, lat: -8, r: 4.5, period: 150 },
  { lon: 6, lat: 47, r: 4, period: 60 },
];
const pulse = (frame: number, period: number, phase: number) => {
  const s = Math.sin((Math.PI * 2 * (frame % MAP_FRAMES)) / period + phase);
  return 0.55 + 0.45 * s * s;
};

type MapData = {
  dots: { pos: Float32Array; bright: Float32Array; hot: Float32Array; hotIdx: Float32Array; size: Float32Array };
  blocks: { matrices: THREE.Matrix4[]; hot: Float32Array; hotIdx: Float32Array; bright: Float32Array };
};

const buildMap = (land: HTMLCanvasElement): MapData => {
  const ctx = land.getContext("2d")!;
  const img = ctx.getImageData(0, 0, land.width, land.height).data;
  const isLand = (lon: number, lat: number) => {
    const x = Math.floor(((lon - WIN.lon0) / (WIN.lon1 - WIN.lon0)) * land.width);
    const y = Math.floor(((lat - WIN.lat0) / (WIN.lat1 - WIN.lat0)) * land.height);
    if (x < 0 || y < 0 || x >= land.width || y >= land.height) return false;
    return img[(y * land.width + x) * 4 + 3] > 127;
  };
  const hotOf = (lon: number, lat: number) => {
    let best = 0;
    let idx = 0;
    HOTSPOTS.forEach((h, i) => {
      const d2 = ((lon - h.lon) ** 2 + (lat - h.lat) ** 2) / (h.r * h.r);
      const n = fbm(lon * 0.35, lat * 0.35, 77 + i, 3);
      const w = Math.exp(-d2 * 1.6) * (0.55 + 0.9 * n);
      if (w > best) {
        best = w;
        idx = i;
      }
    });
    return [Math.min(1, Math.max(0, (best - 0.18) * 1.6)), idx];
  };
  const pos: number[] = [];
  const bright: number[] = [];
  const hot: number[] = [];
  const hotIdx: number[] = [];
  const size: number[] = [];
  let gi = 0;
  for (let lat = WIN.lat0; lat > WIN.lat1; lat -= STEP) {
    let gj = 0;
    for (let lon = WIN.lon0; lon < WIN.lon1; lon += STEP) {
      gj++;
      if (!isLand(lon, lat)) {
        // Faint grid tiles over the ocean so dark areas still read as a display.
        if (gi % 3 === 0 && gj % 3 === 0) {
          const [ox, oz] = toXZ(lon, lat);
          pos.push(ox, 0, oz);
          bright.push(0.035);
          hot.push(0);
          hotIdx.push(0);
          size.push(0.8);
        }
        continue;
      }
      const [x, z] = toXZ(lon, lat);
      pos.push(x, 0, z);
      const n = fbm(lon * 0.08, lat * 0.08, 3, 4);
      const sp = hash2(gi, gj, 9);
      bright.push(sp < 0.07 ? 0.05 : 0.25 + 0.95 * n * n);
      const [hw, hi] = hotOf(lon, lat);
      hot.push(hw);
      hotIdx.push(hi);
      size.push(0.9 + 0.15 * hash2(gi, gj, 4));
    }
    gi++;
  }
  // Raised blocks on a coarser grid.
  const BSTEP = STEP * 3;
  const matrices: THREE.Matrix4[] = [];
  const bHot: number[] = [];
  const bIdx: number[] = [];
  const bBright: number[] = [];
  let bi = 0;
  for (let lat = WIN.lat0; lat > WIN.lat1; lat -= BSTEP) {
    let bj = 0;
    for (let lon = WIN.lon0; lon < WIN.lon1; lon += BSTEP) {
      bj++;
      if (!isLand(lon, lat)) continue;
      const n = fbm(lon * 0.11 + 13, lat * 0.11, 21, 4);
      const r = hash2(bi, bj, 31);
      if (n < 0.56 || r < 0.55) continue;
      const h = 0.05 + Math.pow((n - 0.52) / 0.48, 1.5) * 1.6 * (0.4 + r);
      const [x, z] = toXZ(lon, lat);
      const side = BSTEP * S * 0.82;
      const m = new THREE.Matrix4().compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion(), new THREE.Vector3(side, h, side));
      matrices.push(m);
      const [hw, hi] = hotOf(lon, lat);
      bHot.push(hw);
      bIdx.push(hi);
      bBright.push(0.5 + 0.8 * r);
    }
    bi++;
  }
  return {
    dots: { pos: new Float32Array(pos), bright: new Float32Array(bright), hot: new Float32Array(hot), hotIdx: new Float32Array(hotIdx), size: new Float32Array(size) },
    blocks: { matrices, hot: new Float32Array(bHot), hotIdx: new Float32Array(bIdx), bright: new Float32Array(bBright) },
  };
};

const pulseGLSL = /* glsl */ `
  uniform vec4 uPulse;
  float pulseOf(float i) { return i < 0.5 ? uPulse.x : (i < 1.5 ? uPulse.y : (i < 2.5 ? uPulse.z : uPulse.w)); }
`;

const Dots: React.FC<{ data: MapData; palette: MapPalette; pulses: number[] }> = ({ data, palette, pulses }) => {
  const { gl } = useThree();
  const { geometry, material } = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(data.dots.pos, 3));
    g.setAttribute("aBright", new THREE.BufferAttribute(data.dots.bright, 1));
    g.setAttribute("aHot", new THREE.BufferAttribute(data.dots.hot, 1));
    g.setAttribute("aHotIdx", new THREE.BufferAttribute(data.dots.hotIdx, 1));
    g.setAttribute("aSize", new THREE.BufferAttribute(data.dots.size, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uPulse: { value: new THREE.Vector4() },
        uScale: { value: 1 },
        uCol: { value: new THREE.Vector3(...hexToLinear(palette.dots)) },
        uHot: { value: new THREE.Vector3(...hexToLinear(palette.hot)) },
      },
      vertexShader: /* glsl */ `
        attribute float aBright, aHot, aHotIdx, aSize;
        uniform float uScale;
        uniform vec3 uCol, uHot;
        ${pulseGLSL}
        varying vec3 vCol;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float p = pulseOf(aHotIdx);
          // Dim tiles lean deep electric blue, bright ones the palette cyan/white.
          vec3 deep = vec3(0.01, 0.16, 0.6);
          vec3 c = mix(deep, uCol, smoothstep(0.15, 1.0, aBright)) * aBright * 1.5;
          vec3 hot = mix(uHot, vec3(1.0, 0.12, 0.02), 0.4 * (1.0 - aBright)) * (1.0 + 1.8 * p) * (0.6 + 0.9 * aBright);
          hot = mix(hot, vec3(1.8, 1.3, 0.9), smoothstep(1.0, 1.4, aBright) * 0.5);
          c = mix(c, hot, aHot);
          vCol = c;
          gl_PointSize = max(1.0, aSize * uScale * 115.0 / -mv.z);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vCol;
        void main() {
          vec2 q = abs(gl_PointCoord - 0.5) * 2.0;
          float a = 1.0 - smoothstep(0.7, 0.95, max(q.x, q.y));
          gl_FragColor = vec4(vCol * a, 1.0);
        }
      `,
    });
    return { geometry: g, material: m };
  }, [data, palette]);
  material.uniforms.uPulse.value.set(pulses[0], pulses[1], pulses[2], pulses[3]);
  material.uniforms.uScale.value = gl.getDrawingBufferSize(new THREE.Vector2()).y / 720;
  return <points geometry={geometry} material={material} frustumCulled={false} />;
};

const Blocks: React.FC<{ data: MapData; palette: MapPalette; pulses: number[] }> = ({ data, palette, pulses }) => {
  const mesh = useMemo(() => {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const count = data.blocks.matrices.length;
    g.setAttribute("aHot", new THREE.InstancedBufferAttribute(data.blocks.hot, 1));
    g.setAttribute("aHotIdx", new THREE.InstancedBufferAttribute(data.blocks.hotIdx, 1));
    g.setAttribute("aBright", new THREE.InstancedBufferAttribute(data.blocks.bright, 1));
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uPulse: { value: new THREE.Vector4() },
        uCol: { value: new THREE.Vector3(...hexToLinear(palette.dots)) },
        uHot: { value: new THREE.Vector3(...hexToLinear(palette.hot)) },
      },
      vertexShader: /* glsl */ `
        attribute float aHot, aHotIdx, aBright;
        uniform vec3 uCol, uHot;
        ${pulseGLSL}
        varying vec3 vCol;
        varying vec2 vUv;
        varying float vTop;
        void main() {
          vUv = uv;
          vTop = normal.y;
          float p = pulseOf(aHotIdx);
          vCol = mix(uCol * aBright, uHot * (1.0 + 2.5 * p), aHot);
          gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vCol;
        varying vec2 vUv;
        varying float vTop;
        void main() {
          float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
          float edge = 1.0 - smoothstep(0.0, 0.14, e);
          float face = vTop > 0.5 ? 0.035 : 0.008;
          gl_FragColor = vec4(vCol * (face + edge * 0.12), 1.0);
        }
      `,
    });
    const im = new THREE.InstancedMesh(g, m, count);
    data.blocks.matrices.forEach((mat, i) => im.setMatrixAt(i, mat));
    im.frustumCulled = false;
    return im;
  }, [data, palette]);
  (mesh.material as THREE.ShaderMaterial).uniforms.uPulse.value.set(pulses[0], pulses[1], pulses[2], pulses[3]);
  return <primitive object={mesh} />;
};

// Data streams: rows of dashes sliding across the map. Each row moves a whole
// number of dash periods per loop.
const STREAMS = (() => {
  const rnd = mulberry32(0x57e4a);
  const rows = [];
  for (let i = 0; i < 32; i++) {
    const lat = -5 + rnd() * 70;
    rows.push({
      z: toXZ(0, lat)[1],
      y: 0.2 + Math.pow(rnd(), 1.4) * 3.5,
      x0: toXZ(-175 + rnd() * 60, 0)[0],
      x1: toXZ(-20 + rnd() * 95, 0)[0],
      hot: rnd() < 0.38 ? 1 : 0,
      cycles: (rnd() < 0.75 ? 1 : -1) * (60 + Math.floor(rnd() * 200)),
      dashes: 150 + Math.floor(rnd() * 250),
      duty: rnd() < 0.25 ? 0.75 + rnd() * 0.2 : 0.2 + rnd() * 0.3,
      phase: rnd(),
      width: rnd() < 0.2 ? 0.08 + rnd() * 0.08 : 0.025 + rnd() * 0.035,
      bright: 0.3 + Math.pow(rnd(), 2) * 3.2,
      bow: rnd() * 0.5,
    });
  }
  return rows;
})();

const Streams: React.FC<{ palette: MapPalette; t: number }> = ({ palette, t }) => {
  const { camera } = useThree();
  const { geometry, material } = useMemo(() => {
    const SEGS = 64;
    const base = new THREE.PlaneGeometry(1, 1, SEGS, 1);
    const g = new THREE.InstancedBufferGeometry();
    g.index = base.index;
    g.setAttribute("position", base.attributes.position);
    const n = STREAMS.length;
    const A = (k: (r: (typeof STREAMS)[number]) => number) => new THREE.InstancedBufferAttribute(new Float32Array(STREAMS.map(k)), 1);
    g.setAttribute("aZ", A((r) => r.z));
    g.setAttribute("aY", A((r) => r.y));
    g.setAttribute("aX0", A((r) => r.x0));
    g.setAttribute("aX1", A((r) => r.x1));
    g.setAttribute("aHotC", A((r) => r.hot));
    g.setAttribute("aCycles", A((r) => r.cycles));
    g.setAttribute("aDashes", A((r) => r.dashes));
    g.setAttribute("aDuty", A((r) => r.duty));
    g.setAttribute("aPhase", A((r) => r.phase));
    g.setAttribute("aWidth", A((r) => r.width));
    g.setAttribute("aBrightS", A((r) => r.bright));
    g.setAttribute("aBow", A((r) => r.bow));
    g.instanceCount = n;
    const m = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: {
        uT: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uCol: { value: new THREE.Vector3(...hexToLinear(palette.dots)) },
        uHot: { value: new THREE.Vector3(...hexToLinear(palette.hot)) },
      },
      vertexShader: /* glsl */ `
        attribute float aZ, aY, aX0, aX1, aHotC, aCycles, aDashes, aDuty, aPhase, aWidth, aBrightS, aBow;
        uniform vec3 uCam;
        varying float vU, vSide;
        varying float vDashes, vDuty, vOff, vHot, vBright, vCycles;
        vec3 P(float u) { return vec3(mix(aX0, aX1, u), aY + aBow * sin(3.14159 * u), aZ - aBow * 0.6 * sin(3.14159 * u)); }
        void main() {
          float u = position.x + 0.5;
          vec3 p = P(u);
          vec3 t = normalize(P(u + 0.01) - p);
          vec3 side = normalize(cross(t, uCam - p));
          p += side * position.y * aWidth;
          vU = u; vSide = position.y * 2.0;
          vDashes = aDashes; vDuty = aDuty; vHot = aHotC; vBright = aBrightS;
          vOff = aPhase; vCycles = aCycles;
          gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uT;
        uniform vec3 uCol, uHot;
        varying float vU, vSide;
        varying float vDashes, vDuty, vOff, vHot, vBright, vCycles;
        void main() {
          // Pattern coordinate in dash periods; sliding by an integer number
          // of periods per loop (cycles * dashes is an integer).
          float d = fract(vU * vDashes + vOff - uT * vCycles);
          float dash = smoothstep(0.0, 0.08, d) * (1.0 - smoothstep(vDuty - 0.08, vDuty, d));
          float ends = smoothstep(0.0, 0.12, vU) * smoothstep(1.0, 0.85, vU);
          float across = 1.0 - smoothstep(0.3, 1.0, abs(vSide));
          vec3 c = mix(uCol, uHot, vHot) * vBright * (vHot > 0.5 ? 0.85 : 0.6);
          gl_FragColor = vec4(c * dash * ends * across, 1.0);
        }
      `,
    });
    return { geometry: g, material: m };
  }, [palette]);
  material.uniforms.uT.value = t;
  material.uniforms.uCam.value.copy(camera.position);
  return <mesh geometry={geometry} material={material} frustumCulled={false} />;
};

// HUD: text tags, brackets and crosshairs as additive sprites (canvas textures
// drawn with the shipped JetBrains Mono).
const HUD_ITEMS = (() => {
  const rnd = mulberry32(0x40d);
  type Kind = "tag" | "label" | "cross" | "circle" | "panel" | "ticks";
  const items: { lon: number; lat: number; y: number; text: string; size: number; kind: Kind }[] = [];
  const at = (lon: number, lat: number, y: number, kind: Kind, size: number, text = "") => items.push({ lon, lat, y, kind, size, text });
  // Sparse, layered HUD: a few tags/labels, circular target markers, panel frames, tick bars.
  at(-58, 50, 2.6, "tag", 0.9, "[36/67]");
  at(-20, 2, 1.4, "tag", 0.8, "[37/15]");
  at(-92, 8, 1.0, "tag", 0.8, "[72/47]");
  at(-8, 6, 0.8, "label", 1.0, "#01 /// 510074");
  at(-62, 30, 1.2, "label", 0.9, "#01 // 5" + Math.floor(1000 + rnd() * 8999));
  at(-125, 20, 0.6, "label", 0.9, "#07 /// " + Math.floor(100000 + rnd() * 899999));
  [[-30, 45], [5, 18], [-84, 3], [-50, 12]].forEach(([lon, lat]) => at(lon, lat, 0.4, "circle", 0.6));
  for (let i = 0; i < 6; i++) at(-120 + rnd() * 140, 0 + rnd() * 55, 0.3 + rnd() * 2, "cross", 0.45);
  at(-130, 28, 1.6, "panel", 3.0);
  at(-35, 40, 2.2, "panel", 2.4);
  at(-75, 22, 0.9, "ticks", 1.0);
  at(-60, 12, 0.7, "ticks", 0.8);
  return items;
})();

const makeHudTexture = (kind: string, text: string, color: string) => {
  const c = document.createElement("canvas");
  const W = kind === "label" || kind === "panel" ? 512 : 256;
  const H = kind === "panel" ? 256 : kind === "circle" ? 256 : 64;
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 3;
  if (kind === "tag" || kind === "label") {
    ctx.font = `500 ${kind === "tag" ? 34 : 26}px "JetBrains Mono"`;
    ctx.textBaseline = "middle";
    ctx.fillText(text, 12, H / 2 + 1);
    if (kind === "label") {
      ctx.fillRect(12, H - 8, W * 0.55, 2);
      ctx.fillRect(4, 10, 3, H - 20);
    }
  } else if (kind === "cross") {
    ctx.translate(128, 32);
    ctx.beginPath();
    ctx.moveTo(-14, -14);
    ctx.lineTo(14, 14);
    ctx.moveTo(14, -14);
    ctx.lineTo(-14, 14);
    ctx.stroke();
  } else if (kind === "circle") {
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(128, 128, 90, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(128, 128, 55, 0.3, Math.PI - 0.3);
    ctx.stroke();
    ctx.fillRect(126, 20, 4, 30);
    ctx.fillRect(126, 206, 4, 30);
  } else if (kind === "panel") {
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(8, 8, W - 16, H - 16);
    ctx.globalAlpha = 1;
    ctx.fillRect(8, 8, 60, 4);
    ctx.fillRect(W - 68, H - 12, 60, 4);
  } else if (kind === "ticks") {
    for (let i = 0; i < 12; i++) ctx.fillRect(10 + i * 20, 20, 10, 24 - (i % 3) * 6);
  } else {
    const b = 16;
    ctx.beginPath();
    ctx.moveTo(30 + b, 6);
    ctx.lineTo(30, 6);
    ctx.lineTo(30, 58);
    ctx.lineTo(30 + b, 58);
    ctx.moveTo(226 - b, 6);
    ctx.lineTo(226, 6);
    ctx.lineTo(226, 58);
    ctx.lineTo(226 - b, 58);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return { tex, aspect: W / H };
};

const Hud: React.FC<{ palette: MapPalette; frame: number }> = ({ palette, frame }) => {
  const sprites = useMemo(() => {
    return HUD_ITEMS.map((it) => {
      const { tex, aspect } = makeHudTexture(it.kind, it.text, it.kind === "ticks" || (it.kind === "cross" && it.lat < 20) ? palette.hot : palette.hud);
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
      const s = new THREE.Sprite(m);
      const [x, z] = toXZ(it.lon, it.lat);
      s.position.set(x, it.y, z);
      const h = (it.kind === "circle" ? 1.0 : it.kind === "panel" ? 0.9 : 0.75) * it.size;
      s.scale.set(h * aspect, h, 1);
      return s;
    });
  }, [palette]);
  // Gentle deterministic flicker on a 600-divisible cycle.
  sprites.forEach((s, i) => {
    const ph = (i * 37) % 20;
    const on = ((frame % MAP_FRAMES) + ph * 3) % 60 < 56 ? 1 : 0.35;
    (s.material as THREE.SpriteMaterial).opacity = 0.75 * on;
  });
  return (
    <group>
      {sprites.map((s, i) => (
        <primitive key={i} object={s} />
      ))}
    </group>
  );
};

// Thin frame lines and hotspot target rings on the map plane.
const Frames: React.FC<{ palette: MapPalette; pulses: number[] }> = ({ palette, pulses }) => {
  const { lines, rings } = useMemo(() => {
    const pts: number[] = [];
    const add = (a: [number, number], b: [number, number], y = 0.02) => pts.push(a[0], y, a[1], b[0], y, b[1]);
    add(toXZ(-170, 62), toXZ(70, 62));
    add(toXZ(-170, -32), toXZ(70, -32));
    add(toXZ(-60, 80), toXZ(-60, -55));
    add(toXZ(-125, 80), toXZ(-125, -55));
    add(toXZ(-170, 22), toXZ(70, 22), 1.2);
    add(toXZ(-30, 70), toXZ(-30, -50), 0.9);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    const col = new THREE.Color(palette.hud).multiplyScalar(0.12);
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: col, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    const rings = HOTSPOTS.map((h) => {
      const m = new THREE.Mesh(
        new THREE.RingGeometry(0.92, 1, 64),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(palette.hot), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
      );
      const [x, z] = toXZ(h.lon, h.lat);
      m.position.set(x, 0.05, z);
      m.rotation.x = -Math.PI / 2;
      return m;
    });
    return { lines, rings };
  }, [palette]);
  // Rings stay hidden: the HUD uses small circular markers instead.
  rings.forEach((r, i) => {
    r.visible = false;
    const p = pulses[i];
    r.scale.setScalar(0.3 + 0.2 * p);
    (r.material as THREE.MeshBasicMaterial).color.set(palette.hot).multiplyScalar(0.15 + 0.4 * p);
  });
  return (
    <group>
      <primitive object={lines} />
      {rings.map((r, i) => (
        <primitive key={i} object={r} />
      ))}
    </group>
  );
};

// Tall vertical orange flare on the West African coast hotspot, plus a faint
// blue haze behind everything (full-screen quad).
const Flare: React.FC<{ palette: MapPalette; pulses: number[] }> = ({ palette, pulses }) => {
  const sprite = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 256;
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(32, 128, 0, 32, 128, 128);
    g.addColorStop(0, "rgba(255,255,255,1)");
    g.addColorStop(0.15, "rgba(255,255,255,0.6)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.setTransform(0.25, 0, 0, 1, 24, 0);
    ctx.fillStyle = g;
    ctx.fillRect(-200, 0, 600, 256);
    const tex = new THREE.CanvasTexture(c);
    const m = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(palette.hot), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false });
    const sp = new THREE.Sprite(m);
    const [x, z] = toXZ(HOTSPOTS[1].lon + 1.5, HOTSPOTS[1].lat);
    sp.position.set(x, 0.6, z);
    sp.scale.set(0.35, 1.5, 1);
    return sp;
  }, [palette]);
  (sprite.material as THREE.SpriteMaterial).opacity = 0.5 + 0.5 * pulses[1];
  return <primitive object={sprite} />;
};

const Haze: React.FC<{ palette: MapPalette }> = ({ palette }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        depthWrite: false,
        depthTest: false,
        uniforms: { uCol: { value: new THREE.Vector3(...hexToLinear(palette.dots)) } },
        vertexShader: `varying vec2 vP; void main(){ vP = position.xy; gl_Position = vec4(position.xy, 0.999, 1.0); }`,
        fragmentShader: `uniform vec3 uCol; varying vec2 vP; void main(){
          float h = 0.03 * exp(-dot(vP - vec2(-1.0, 0.1), vP - vec2(-1.0, 0.1)) * 1.5) + 0.012 * exp(-dot(vP - vec2(0.8, 0.9), vP - vec2(0.8, 0.9)) * 2.0);
          gl_FragColor = vec4(uCol * vec3(0.4, 0.7, 1.0) * h, 1.0); }`,
      }),
    [palette],
  );
  return (
    <mesh frustumCulled={false} renderOrder={-1} material={mat}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
};

const CameraRig: React.FC<{ t: number }> = ({ t }) => {
  const { camera } = useThree();
  const a = Math.PI * 2 * t;
  const target = new THREE.Vector3(...((): [number, number, number] => {
    const [x, z] = toXZ(-52 + 4 * Math.sin(a), 24 + 1.5 * Math.cos(a));
    return [x, 0, z];
  })());
  // Holo-wall view: camera high and to the west, ~34° off the plane normal,
  // map north up on screen with a slight roll.
  camera.position.set(target.x - 20.5 + 0.9 * Math.sin(a), 32.5, target.z + 5.4 + 0.5 * Math.cos(a));
  camera.up.set(0.22, 0, -1).normalize();
  camera.lookAt(target);
  camera.updateMatrixWorld();
  return null;
};

const Scene: React.FC<{ palette: MapPalette; data: MapData }> = ({ palette, data }) => {
  const frame = useCurrentFrame();
  const { camera, size, gl } = useThree();
  const f = frame % MAP_FRAMES;
  const t = f / MAP_FRAMES;
  const pulses = HOTSPOTS.map((h, i) => pulse(f, h.period, i * 1.3));
  const dof = useMemo(() => makePlaneDOF(), []);
  const onBeforeRender = () => {
    camera.updateMatrixWorld();
    const vp = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    dof.uniforms.uInvViewProj.value.copy(vp).invert();
    dof.uniforms.uCamPos.value.copy(camera.position);
    dof.uniforms.uFocus.value = 38.8;
    dof.uniforms.uStrength.value = 0.014;
    dof.uniforms.uMaxR.value = 0.012;
    dof.uniforms.uAspect.value = size.width / size.height;
  };
  void gl;
  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <CameraRig t={t} />
      <Dots data={data} palette={palette} pulses={pulses} />
      <Blocks data={data} palette={palette} pulses={pulses} />
      <Streams palette={palette} t={t} />
      <Frames palette={palette} pulses={pulses} />
      <Hud palette={palette} frame={frame} />
      <Flare palette={palette} pulses={pulses} />
      <Haze palette={palette} />
      <PostRender
        prePasses={[dof]}
        onBeforeRender={onBeforeRender}
        bloomStrength={0.9}
        bloomRadius={0.6}
        bloomThreshold={0.42}
        exposure={1.1}
        vignette={0.4}
        grain={0.02}
        loopFrames={MAP_FRAMES}
      />
    </>
  );
};

const loadMapAssets = async () => {
  const [polys] = await Promise.all([loadLand(), loadFonts()]);
  const w = Math.round((WIN.lon1 - WIN.lon0) / STEP) * 4;
  const h = Math.round((WIN.lat0 - WIN.lat1) / STEP) * 4;
  return buildMap(drawLand(polys, w, h, WIN));
};

export const HologramMap: React.FC<{ palette: MapPalette }> = ({ palette }) => {
  const { width, height } = useVideoConfig();
  const data = useAsset(loadMapAssets, "Natural Earth land + fonts");
  return (
    <AbsoluteFill style={{ backgroundColor: palette.bg }}>
      {data ? (
        <ThreeCanvas
          width={width}
          height={height}
          dpr={typeof window !== "undefined" ? window.devicePixelRatio : 1}
          gl={{ antialias: false, preserveDrawingBuffer: true }}
          camera={{ fov: 30, near: 0.1, far: 300 }}
        >
          <Scene palette={palette} data={data} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};

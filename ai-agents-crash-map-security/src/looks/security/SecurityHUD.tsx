import React, { useCallback } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { TAU } from "../../lib/anim";
import { loadFonts } from "../../lib/fonts";
import { GLStage, LookFactory } from "../../lib/gl/Stage";
import { canvasTexture, hexToVec3, makeCanvas, premulBlend, rgba } from "../../lib/gl/tex";
import { drawIcon, IconName } from "../../lib/icons";
import { hash, mulberry32 } from "../../lib/random";
import { useAssets } from "../../lib/useAssets";
import type { SecurityRow } from "../../versions";

const LOOP = 600;

// ---------------------------------------------------------------------------
// Static canvases (drawn once per tab; content never depends on the frame)
// ---------------------------------------------------------------------------

// Tileable circuit pattern: traces, rectangles, dots, dashes.
const circuitTile = (seed: number, size: number, density: number, blur: number, palette: string[]) => {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  const r = mulberry32(seed);
  const wrap = (fn: (ox: number, oy: number) => void) => {
    for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(ox, oy);
  };
  ctx.lineCap = "square";
  const n = Math.floor(260 * density);
  for (let i = 0; i < n; i++) {
    const col = palette[Math.floor(r() * palette.length)];
    const a = 0.25 + r() * 0.75;
    const kind = r();
    const x0 = Math.floor(r() * size);
    const y0 = Math.floor(r() * size);
    const lw = r() < 0.8 ? 2 : 4;
    if (kind < 0.55) {
      // orthogonal trace with 1–3 bends, mostly horizontal runs
      const pts: [number, number][] = [[x0, y0]];
      let x = x0;
      let y = y0;
      const segs = 1 + Math.floor(r() * 3);
      for (let s = 0; s < segs; s++) {
        if ((s + (r() < 0.5 ? 0 : 1)) % 2 === 0) x += (r() < 0.5 ? -1 : 1) * (40 + Math.pow(r(), 2) * 900);
        else y += (r() < 0.5 ? -1 : 1) * (30 + Math.pow(r(), 2) * 700);
        pts.push([x, y]);
      }
      wrap((ox, oy) => {
        ctx.strokeStyle = rgba(col, a);
        ctx.lineWidth = lw;
        ctx.beginPath();
        pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + ox, py + oy) : ctx.moveTo(px + ox, py + oy)));
        ctx.stroke();
        const [ex, ey] = pts[pts.length - 1];
        ctx.fillStyle = rgba(col, Math.min(1, a + 0.2));
        ctx.fillRect(ex + ox - 4, ey + oy - 4, 8, 8);
      });
    } else if (kind < 0.7) {
      const w = 20 + r() * 120;
      const h = 12 + r() * 60;
      wrap((ox, oy) => {
        ctx.strokeStyle = rgba(col, a * 0.8);
        ctx.lineWidth = 2;
        ctx.strokeRect(x0 + ox, y0 + oy, w, h);
      });
    } else if (kind < 0.88) {
      // dash run
      const len = 4 + Math.floor(r() * 10);
      wrap((ox, oy) => {
        ctx.fillStyle = rgba(col, a);
        for (let k = 0; k < len; k++) if (hash(i, k) < 0.7) ctx.fillRect(x0 + ox + k * 14, y0 + oy, 9, 4);
      });
    } else {
      wrap((ox, oy) => {
        ctx.fillStyle = rgba(r() < 0.25 ? "#FFFFFF" : col, a);
        const s = 4 + r() * 8;
        ctx.fillRect(x0 + ox, y0 + oy, s, s);
      });
    }
  }
  if (blur <= 0) return c;
  // Blur once, on a 3×3 tiled copy so the result stays seamless.
  const big = makeCanvas(size * 3, size * 3);
  const bctx = big.getContext("2d")!;
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) bctx.drawImage(c, i * size, j * size);
  const out = makeCanvas(size, size);
  const octx = out.getContext("2d")!;
  octx.filter = `blur(${blur}px)`;
  octx.drawImage(big, -size, -size);
  return out;
};

const ringCanvas = (size: number, draw: (ctx: CanvasRenderingContext2D, R: number) => void) => {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  ctx.translate(size / 2, size / 2);
  draw(ctx, size / 2);
  return c;
};

const padlockCanvas = (size: number) => {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  const s = size / 24;
  const body = new Path2D();
  body.roundRect(5 * s, 10.6 * s, 14 * s, 10.4 * s, 1.4 * s);
  const shackle = new Path2D();
  shackle.moveTo(7.6 * s, 10.8 * s);
  shackle.lineTo(7.6 * s, 7.6 * s);
  shackle.arc(12 * s, 7.6 * s, 4.4 * s, Math.PI, 0);
  shackle.lineTo(16.4 * s, 10.8 * s);
  const key = new Path2D();
  key.arc(12 * s, 14.6 * s, 1.35 * s, 0, TAU);
  key.rect(11.35 * s, 14.6 * s, 1.3 * s, 3.4 * s);

  // digital fill: tiny squares and short lines inside the body
  ctx.save();
  ctx.clip(body);
  const r = mulberry32(777);
  const cell = size / 120;
  for (let y = 10 * s; y < 21.5 * s; y += cell) {
    for (let x = 4.5 * s; x < 19.5 * s; x += cell) {
      const v = r();
      if (v < 0.42) continue;
      const b = 0.25 + 0.75 * Math.pow(r(), 1.6);
      ctx.fillStyle = `rgba(${150 + 105 * b},${210 + 45 * b},255,${0.25 + 0.6 * b})`;
      const w = r() < 0.15 ? cell * (2 + Math.floor(r() * 4)) : cell * 0.7;
      ctx.fillRect(x, y, w, cell * 0.7);
    }
  }
  ctx.restore();
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fill(key);
  ctx.restore();
  // dotted shackle: thick band of particles
  ctx.save();
  ctx.lineWidth = 2.1 * s;
  ctx.strokeStyle = "#fff";
  const band = makeCanvas(size, size);
  const bctx = band.getContext("2d")!;
  bctx.lineWidth = 2.1 * s;
  bctx.strokeStyle = "#fff";
  bctx.stroke(shackle);
  bctx.globalCompositeOperation = "source-in";
  for (let y = 0; y < 11 * s; y += cell) {
    for (let x = 6 * s; x < 18 * s; x += cell) {
      const b = r();
      if (b < 0.35) continue;
      bctx.fillStyle = `rgba(${160 + 95 * b},${215 + 40 * b},255,${0.3 + 0.6 * b})`;
      bctx.fillRect(x, y, cell * 0.75, cell * 0.75);
    }
  }
  ctx.drawImage(band, 0, 0);
  ctx.restore();
  // bright edges
  ctx.lineWidth = 0.32 * s;
  ctx.strokeStyle = "rgba(220,245,255,0.95)";
  ctx.stroke(body);
  ctx.lineWidth = 0.22 * s;
  ctx.strokeStyle = "rgba(200,240,255,0.85)";
  const inner = new Path2D();
  inner.moveTo(7.6 * s - 1.05 * s, 10.8 * s);
  inner.lineTo(7.6 * s - 1.05 * s, 7.6 * s);
  inner.arc(12 * s, 7.6 * s, 4.4 * s + 1.05 * s, Math.PI, 0);
  inner.lineTo(16.4 * s + 1.05 * s, 10.8 * s);
  ctx.stroke(inner);
  const inner2 = new Path2D();
  inner2.moveTo(7.6 * s + 1.05 * s, 10.8 * s);
  inner2.lineTo(7.6 * s + 1.05 * s, 7.6 * s);
  inner2.arc(12 * s, 7.6 * s, 4.4 * s - 1.05 * s, Math.PI, 0);
  inner2.lineTo(16.4 * s - 1.05 * s, 10.8 * s);
  ctx.stroke(inner2);
  ctx.strokeStyle = "rgba(220,245,255,0.9)";
  ctx.stroke(key);
  return c;
};

const iconCanvas = (name: IconName, size: number) => {
  const c = makeCanvas(size, size);
  const ctx = c.getContext("2d")!;
  const m = size * 0.1;
  const path = new Path2D();
  path.roundRect(m, m, size - 2 * m, size - 2 * m, size * 0.1);
  ctx.fillStyle = "rgba(40,110,255,0.35)";
  ctx.fill(path);
  ctx.lineWidth = size * 0.022;
  ctx.strokeStyle = "rgba(170,220,255,0.9)";
  ctx.stroke(path);
  drawIcon(ctx, name, size / 2, size / 2, size * 0.5, "#FFFFFF", 1.5);
  return c;
};

// Ring definitions: radius in world units, rotation in whole turns per loop.
type RingDef = { id: string; size: number; radius: number; turns: number; draw: (ctx: CanvasRenderingContext2D, R: number) => void; z: number; opacity: number };

const RINGS: RingDef[] = [
  {
    // thick outer partial arc of chunky segments
    id: "outer",
    size: 2048,
    radius: 3.15,
    turns: 1,
    z: -0.05,
    opacity: 0.6,
    draw: (ctx, R) => {
      const r0 = R * 0.86;
      const r1 = R * 0.97;
      for (let i = 0; i < 12; i++) {
        const a0 = (i / 15) * TAU;
        const a1 = a0 + (TAU / 15) * 0.72;
        ctx.beginPath();
        ctx.arc(0, 0, r1, a0, a1);
        ctx.arc(0, 0, r0, a1, a0, true);
        ctx.closePath();
        ctx.fillStyle = `rgba(40,110,255,${0.32 + 0.3 * hash(i, 4)})`;
        ctx.fill();
        ctx.strokeStyle = "rgba(120,180,255,0.55)";
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(120,190,255,0.35)";
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.82, 0, TAU);
      ctx.stroke();
    },
  },
  {
    // fine radial hairlines
    id: "ticks",
    size: 2048,
    radius: 1.75,
    turns: -1,
    z: 0.02,
    opacity: 0.8,
    draw: (ctx, R) => {
      for (let i = 0; i < 240; i++) {
        const a = (i / 240) * TAU;
        const len = hash(i, 9) < 0.25 ? 0.2 : 0.12;
        ctx.strokeStyle = `rgba(140,200,255,${0.35 + 0.5 * hash(i, 2)})`;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * (0.95 - len), Math.sin(a) * R * (0.95 - len));
        ctx.lineTo(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.95);
        ctx.stroke();
      }
    },
  },
  {
    // bright dashed ring right around the padlock
    id: "dashed",
    size: 2048,
    radius: 1.3,
    turns: 1,
    z: 0.05,
    opacity: 1,
    draw: (ctx, R) => {
      ctx.lineWidth = R * 0.035;
      ctx.strokeStyle = "rgba(225,245,255,0.95)";
      ctx.setLineDash([R * 0.09, R * 0.05]);
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.93, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = R * 0.012;
      ctx.strokeStyle = "rgba(180,225,255,0.85)";
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.86, 0, TAU);
      ctx.stroke();
      // gear-like teeth
      for (let i = 0; i < 72; i++) {
        const a = (i / 72) * TAU;
        ctx.strokeStyle = "rgba(170,220,255,0.7)";
        ctx.lineWidth = R * 0.012;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * R * 0.78, Math.sin(a) * R * 0.78);
        ctx.lineTo(Math.cos(a) * R * 0.84, Math.sin(a) * R * 0.84);
        ctx.stroke();
      }
    },
  },
  {
    id: "thin",
    size: 2048,
    radius: 2.15,
    turns: -1,
    z: -0.02,
    opacity: 0.75,
    draw: (ctx, R) => {
      ctx.lineWidth = 5;
      ctx.strokeStyle = "rgba(150,210,255,0.7)";
      ctx.setLineDash([60, 24, 8, 24]);
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.95, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.lineWidth = 16;
      ctx.strokeStyle = "rgba(170,225,255,0.8)";
      for (const [a0, a1] of [
        [0.2, 0.9],
        [2.4, 2.9],
        [3.9, 5.1],
      ]) {
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.9, a0, a1);
        ctx.stroke();
      }
    },
  },
  {
    // faint large circle the icons sit on
    id: "track",
    size: 2048,
    radius: 2.62,
    turns: 1,
    z: -0.03,
    opacity: 0.55,
    draw: (ctx, R) => {
      ctx.lineWidth = 4;
      ctx.strokeStyle = "rgba(120,190,255,0.6)";
      ctx.beginPath();
      ctx.arc(0, 0, R * 0.96, 0, TAU);
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a0 = (i / 6) * TAU + 0.2;
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(0, 0, R * 0.92, a0, a0 + 0.35);
        ctx.stroke();
      }
    },
  },
];

const ICON_SLOTS: { name: IconName; angle: number }[] = [
  { name: "phone", angle: 98 },
  { name: "mail", angle: 42 },
  { name: "globe", angle: -12 },
  { name: "cloud", angle: -78 },
  { name: "wifi", angle: -140 },
  { name: "document", angle: 160 },
];

// Background layers: depth, blur (px at tile scale), drift in whole tiles per loop.
const LAYERS = [
  { z: -34, blur: 5, density: 1.1, kx: 1, ky: 0, repeat: 3, alpha: 0.35, seed: 11 },
  { z: -22, blur: 3, density: 1.1, kx: -1, ky: 0, repeat: 3, alpha: 0.55, seed: 12 },
  { z: -13, blur: 1.4, density: 1.0, kx: 1, ky: 1, repeat: 3, alpha: 0.85, seed: 13 },
  { z: -6, blur: 0.5, density: 0.8, kx: -1, ky: 0, repeat: 3, alpha: 1.0, seed: 14 },
  { z: 5.5, blur: 14, density: 0.2, kx: 1, ky: 0, repeat: 2, alpha: 0.45, seed: 15 },
];

const makeLook = (row: SecurityRow): LookFactory => ({ renderer, aspect }) => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, aspect, 0.3, 200);
  const CAM_Z = 12;
  const palette = [row.deep, row.light, "#3A7AF0", "#BFE6FF", row.light, "#E8F6FF"];

  // backdrop gradient
  {
    const c = makeCanvas(1024, 576);
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(480, 260, 20, 512, 288, 700);
    g.addColorStop(0, "#08207A");
    g.addColorStop(0.5, "#041050");
    g.addColorStop(1, row.base);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 576);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: canvasTexture(c, renderer), depthWrite: false }),
    );
    const d = CAM_Z + 60;
    const vh = 2 * d * Math.tan((35 / 2) * (Math.PI / 180)) * 1.3;
    m.scale.set(vh * aspect, vh, 1);
    m.position.z = -60;
    m.renderOrder = -20;
    scene.add(m);
  }

  // circuit layers
  const layerMats: THREE.ShaderMaterial[] = [];
  LAYERS.forEach((L, li) => {
    const tex = canvasTexture(circuitTile(L.seed * 97, 2048, L.density, L.blur, palette), renderer);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const mat = premulBlend(
      new THREE.ShaderMaterial({
        uniforms: { tMap: { value: tex }, uOff: { value: new THREE.Vector2() }, uRep: { value: L.repeat }, uA: { value: L.alpha } },
        vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `in vec2 vUv; uniform sampler2D tMap; uniform vec2 uOff; uniform float uRep; uniform float uA;
          void main(){
            vec4 c = texture(tMap, vUv * uRep + uOff);
            float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x) * smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
            gl_FragColor = c * uA * edge;
          }`,
      }),
      true,
    );
    layerMats.push(mat);
    const d = CAM_Z - L.z;
    const vh = 2 * d * Math.tan((35 / 2) * (Math.PI / 180)) * 1.9;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(vh * aspect, vh), mat);
    m.position.set(0.6, 0, L.z);
    m.rotation.y = -0.62 + li * 0.04;
    m.rotation.x = 0.3;
    m.renderOrder = -10 + li;
    scene.add(m);
  });

  // HUD group: rings, padlock, icons — slightly tilted so it reads as 3D
  const hud = new THREE.Group();
  hud.position.set(-0.35, 0.1, 0);
  hud.rotation.set(0.2, 0.5, 0.04);
  scene.add(hud);

  const ringMeshes = RINGS.map((rd, i) => {
    const tex = canvasTexture(ringCanvas(rd.size, rd.draw), renderer);
    const mat = premulBlend(
      new THREE.ShaderMaterial({
        uniforms: { tMap: { value: tex }, uA: { value: rd.opacity }, uGlow: { value: hexToVec3(row.glow) } },
        vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `in vec2 vUv; uniform sampler2D tMap; uniform float uA; uniform vec3 uGlow;
          void main(){ vec4 c = texture(tMap, vUv); gl_FragColor = vec4(c.rgb * mix(vec3(1.0), uGlow, 0.45), c.a) * uA; }`,
      }),
      true,
    );
    const m = new THREE.Mesh(new THREE.PlaneGeometry(rd.radius * 2, rd.radius * 2), mat);
    m.position.z = rd.z;
    m.renderOrder = 10 + i;
    hud.add(m);
    return m;
  });

  // soft glow disc behind padlock
  {
    const c = makeCanvas(512, 512);
    const ctx = c.getContext("2d")!;
    const g = ctx.createRadialGradient(256, 256, 0, 256, 256, 256);
    g.addColorStop(0, "rgba(50,130,255,0.32)");
    g.addColorStop(0.5, "rgba(30,90,255,0.1)");
    g.addColorStop(1, "rgba(20,60,255,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 512, 512);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(4.2, 4.2),
      premulBlend(new THREE.MeshBasicMaterial({ map: canvasTexture(c, renderer) }), true),
    );
    m.position.z = -0.1;
    m.renderOrder = 9;
    hud.add(m);
  }

  const lockTex = canvasTexture(padlockCanvas(1536), renderer);
  const lockMat = premulBlend(
    new THREE.ShaderMaterial({
      uniforms: { tMap: { value: lockTex }, uPulse: { value: 1 }, uScan: { value: 0 } },
      vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
      fragmentShader: `in vec2 vUv; uniform sampler2D tMap; uniform float uPulse; uniform float uScan;
        void main(){
          vec4 c = texture(tMap, vUv);
          float scan = exp(-pow((vUv.y - uScan) * 9.0, 2.0));
          gl_FragColor = c * 0.62 * (uPulse + scan * 0.6);
        }`,
    }),
    true,
  );
  const lock = new THREE.Mesh(new THREE.PlaneGeometry(1.85, 1.85), lockMat);
  lock.position.set(0, 0.04, 0.12);
  lock.renderOrder = 30;
  hud.add(lock);

  const iconMats = ICON_SLOTS.map((slot, i) => {
    const tex = canvasTexture(iconCanvas(slot.name, 384), renderer);
    const mat = premulBlend(
      new THREE.ShaderMaterial({
        uniforms: { tMap: { value: tex }, uGlow: { value: 0 } },
        vertexShader: `out vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `in vec2 vUv; uniform sampler2D tMap; uniform float uGlow;
          void main(){ vec4 c = texture(tMap, vUv); gl_FragColor = c * (0.6 + 0.6 * uGlow); }`,
      }),
    );
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.78), mat);
    const a = (slot.angle * Math.PI) / 180;
    m.position.set(Math.cos(a) * 2.5, Math.sin(a) * 2.5, 0.08);
    m.renderOrder = 40 + i;
    hud.add(m);
    return mat;
  });

  const update = (frameIn: number) => {
    const f = frameIn % LOOP;
    const ph = f / LOOP;
    camera.position.set(0.3 * Math.sin(TAU * ph), 0.18 * Math.sin(TAU * ph * 2 + 0.5), CAM_Z + 0.25 * Math.cos(TAU * ph));
    camera.lookAt(0.2, 0, 0);
    camera.updateMatrixWorld();

    RINGS.forEach((rd, i) => {
      ringMeshes[i].rotation.z = TAU * rd.turns * ph;
    });
    LAYERS.forEach((L, i) => {
      layerMats[i].uniforms.uOff.value.set((L.kx * ph) % 1, (L.ky * ph) % 1);
    });
    // padlock pulse: 4 per loop; scan sweeps 3 times per loop
    lockMat.uniforms.uPulse.value = 0.95 + 0.15 * Math.sin(TAU * 4 * ph);
    lockMat.uniforms.uScan.value = -0.3 + 1.6 * ((3 * ph) % 1);
    // icons glow in sequence: 2 sweeps per loop
    iconMats.forEach((m, i) => {
      const p = (((2 * ph - i / ICON_SLOTS.length) % 1) + 1) % 1;
      m.uniforms.uGlow.value = Math.exp(-Math.pow(p * 6, 2) * 1.2) + Math.exp(-Math.pow((1 - p) * 6, 2) * 1.2);
    });

    return {
      frame: f,
      bloom: { strength: 0.7, threshold: 0.6, knee: 0.3, radius: 1.0 },
      exposure: 1.0,
      vignette: 0.45,
      grain: 0.015,
    };
  };

  return { scene, camera, update };
};

export const SecurityHUD: React.FC<{ row: SecurityRow }> = ({ row }) => {
  const ready = useAssets(() => loadFonts(), "security assets");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const create = useCallback(makeLook(row), [row.id]);
  return <AbsoluteFill style={{ backgroundColor: row.base }}>{ready ? <GLStage create={create} /> : null}</AbsoluteFill>;
};

import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { getLand, MONO, SANS } from "../lib/assets";
import { canvasTexture, depthOnlyMaterial, glowMaterial, makeCanvas } from "../lib/helpers";
import { readoutMaterial, setReadout } from "../lib/readout";
import { hash1, loopPhase, mulberry32, Rng, smoothstep, TAU } from "../lib/random";
import { PosedCamera, Stage } from "../lib/stage";
import { hexToLinear, MapVersion } from "../versions";

const LEN = 600;
const N_PANELS = 25;
const TW = 1024;
const TH = 768;

// ---------------------------------------------------------------- world map (Natural Earth 1:110m land)
const buildMap = (v: MapVersion) => {
  const W = 4096;
  const H = 2048;
  const { c, ctx } = makeCanvas(W, H);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = v.land;
  ctx.beginPath();
  for (const poly of getLand()) {
    for (const ring of poly) {
      ring.forEach(([lon, lat], i) => {
        const x = ((lon + 180) / 360) * W;
        const y = ((90 - lat) / 180) * H;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      ctx.closePath();
    }
  }
  ctx.fill("evenodd");
  // subtle brighter centre and darker edges, as a lit globe-like sheet
  const g = ctx.createRadialGradient(W * 0.45, H * 0.4, 0, W * 0.45, H * 0.4, W * 0.6);
  g.addColorStop(0, "rgba(0,0,0,0.0)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.globalCompositeOperation = "source-atop";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = "source-over";
  return canvasTexture(c);
};

// ---------------------------------------------------------------- panel textures
const CODES = ["USD", "EUR", "GBP", "CHF", "JPY", "CAD", "AUD", "NZD", "SEK", "MXN"];
type PanelKind = "table" | "triangles" | "dial" | "gauges" | "numbers" | "range" | "bigRing";
const KINDS: PanelKind[] = ["table", "triangles", "bigRing", "gauges", "numbers", "range", "table", "dial"];

const drawPanel = (kind: PanelKind, rng: Rng, panelCol: string) => {
  const { c, ctx } = makeCanvas(TW, TH);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, TW, TH);
  const W = "rgba(232,238,255,";
  // glass fill: faint scanlines
  ctx.strokeStyle = `${W}0.9)`;
  ctx.lineWidth = 4;
  if (kind !== "bigRing") ctx.strokeRect(6, 6, TW - 12, TH - 12);
  ctx.fillStyle = `${W}0.9)`;
  ctx.strokeStyle = `${W}0.85)`;
  const tri = (x: number, y: number, s: number) => {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s * 0.9, y + s * 0.6);
    ctx.lineTo(x - s * 0.9, y + s * 0.6);
    ctx.closePath();
    ctx.fill();
  };
  const triGrid = (x0: number, y0: number, cols: number, rows: number, dx: number, dy: number) => {
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) if (rng() < 0.92) tri(x0 + k * dx, y0 + r * dy, 7);
  };
  ctx.font = `600 34px "${SANS}"`;
  switch (kind) {
    case "table": {
      const rows = 9;
      for (let r = 0; r < rows; r++) {
        const y = 60 + r * 76;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(30, y + 30);
        ctx.lineTo(TW - 30, y + 30);
        ctx.stroke();
        ctx.fillText(CODES[(r + Math.floor(rng() * 10)) % CODES.length], 40, y + 14);
        for (let k = 0; k < 10; k++) tri(230 + k * 74, y + 2, 9);
      }
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(180, 30);
      ctx.lineTo(180, TH - 30);
      ctx.stroke();
      break;
    }
    case "triangles":
      triGrid(50, 50, 22, 16, 42, 42);
      break;
    case "bigRing": {
      // a large dashed / tick-marked ring (the panel itself has no frame)
      const cx = TW / 2;
      const cy = TH / 2;
      const R = 370;
      ctx.lineWidth = 6;
      for (let i = 0; i < 180; i++) {
        const a = (i / 180) * TAU;
        if (i % 2) continue;
        ctx.beginPath();
        ctx.arc(cx, cy, R, a, a + TAU / 260);
        ctx.stroke();
      }
      ctx.lineWidth = 3;
      for (let i = 0; i < 90; i++) {
        const a = (i / 90) * TAU;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * (R - 30), cy + Math.sin(a) * (R - 30));
        ctx.lineTo(cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12));
        ctx.stroke();
      }
      break;
    }
    case "dial": {
      const cx = TW / 2;
      const cy = TH / 2;
      const R = 330;
      ctx.lineWidth = 3;
      for (let i = 0; i < 120; i++) {
        const a = (i / 120) * TAU;
        const r0 = i % 5 === 0 ? R - 40 : R - 22;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.stroke();
      }
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, R - 70, -1.2, 2.2);
      ctx.stroke();
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R - 95, 0, TAU);
      ctx.stroke();
      break;
    }
    case "gauges": {
      const n = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < n; i++) {
        const cx = 190 + i * (TW - 360) / Math.max(1, n - 1);
        const cy = TH * (0.42 + 0.2 * rng());
        const R = 120 + rng() * 40;
        ctx.lineWidth = 16;
        ctx.beginPath();
        ctx.arc(cx, cy, R, Math.PI * 0.75, Math.PI * (0.75 + 1.5 * (0.3 + rng() * 0.7)));
        ctx.stroke();
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, R + 22, Math.PI * 0.75, Math.PI * 2.25);
        ctx.stroke();
        ctx.font = `700 48px "${MONO}"`;
        ctx.textAlign = "center";
        ctx.fillText(String(10 + Math.floor(rng() * 180)), cx, cy + 24);
        ctx.textAlign = "left";
      }
      break;
    }
    case "numbers": {
      ctx.font = `400 30px "${MONO}"`;
      for (let r = 0; r < 16; r++)
        for (let k = 0; k < 5; k++) {
          ctx.fillStyle = `${W}${0.4 + rng() * 0.55})`;
          ctx.fillText((rng() * 999).toFixed(2), 40 + k * 196, 64 + r * 44);
        }
      break;
    }
    case "range": {
      ctx.lineWidth = 3;
      ctx.strokeRect(40, 40, 300, 70);
      ctx.strokeRect(370, 40, 300, 70);
      ctx.fillText("RANGE", 70, 88);
      ctx.fillText("CHANGE", 400, 88);
      ctx.font = `700 96px "${MONO}"`;
      ctx.fillText(String(10 + Math.floor(rng() * 89)), 60, 300);
      triGrid(420, 200, 8, 7, 70, 70);
      for (let r = 0; r < 5; r++) {
        ctx.font = `600 32px "${SANS}"`;
        ctx.fillText(CODES[Math.floor(rng() * CODES.length)], 60, 400 + r * 70);
      }
      break;
    }
  }
  void panelCol;
  return canvasTexture(c);
};

const panelMaterial = (tex: THREE.Texture, panelLin: [number, number, number]) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: {
      uFill: { value: 1 },
      map: { value: tex },
      uCol: { value: new THREE.Vector3(...panelLin) },
      uAmt: { value: 1 },
      uLight: { value: new THREE.Vector3(0.5, 0.6, 0.6).normalize() },
      uGlintPos: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vUv = uv;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform vec3 uCol, uLight; uniform float uAmt, uGlintPos, uFill;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vec3 tex = texture2D(map, vUv).rgb;
        vec3 v = normalize(cameraPosition - vW);
        vec3 n = normalize(vN);
        if (dot(n, v) < 0.0) n = -n;
        // glint when the panel turns towards the light
        vec3 r = reflect(-v, n);
        float spec = pow(max(dot(r, uLight), 0.0), 18.0);
        // edge mask (the panel frame) and a glint that runs along the edge
        vec2 e = min(vUv, 1.0 - vUv);
        float edge = smoothstep(0.02, 0.0, min(e.x, e.y * 0.75));
        float along = vUv.x + vUv.y;
        float run = exp(-pow((along - uGlintPos) * 5.0, 2.0));
        // smoky grey glass with fine vertical stripes; dims what is behind it
        float stripes = 0.6 + 0.4 * smoothstep(0.3, 0.7, abs(fract(vUv.x * 160.0) - 0.5) * 2.0);
        float fillA = 0.22 * uFill * stripes;
        vec3 c = tex * uCol * 0.85 + vec3(0.03, 0.035, 0.06) * fillA;
        c += vec3(1.0) * edge * spec * (0.6 + 2.5 * run);
        c += vec3(0.8, 0.85, 1.0) * spec * 0.12 * exp(-pow((along - uGlintPos) * 2.0, 2.0));
        gl_FragColor = vec4(c * uAmt, fillA * uAmt);
      }`,
  });

// ---------------------------------------------------------------- layout
type Panel = {
  kind: PanelKind;
  w: number;
  h: number;
  base: THREE.Vector3;
  k: number; // whole cycles per loop along the sweep
  ph: number;
  yaw: number;
  pitch: number;
  roll: number;
  wob: number;
  readout?: { u: number; v: number; size: number; slots: number; seed: number; fmt: number };
};
const SWEEP = new THREE.Vector3(1, 0.32, 0.18).normalize();
const SPAN = 25;

const makeLayout = (seed: number): Panel[] => {
  const rng = mulberry32(seed * 131 + 17);
  return Array.from({ length: N_PANELS }, (_, i) => {
    const kind = KINDS[i % KINDS.length];
    const s = kind === "bigRing" ? 6.5 + rng() * 2 : 4.2 + rng() * 3.6;
    const p: Panel = {
      kind,
      w: kind === "bigRing" ? s : s * 0.72,
      h: kind === "bigRing" ? s * 0.75 : s * 1.15,
      base: new THREE.Vector3((rng() - 0.5) * 3, (rng() - 0.5) * 5.5, 1.5 - rng() * 7),
      k: 1,
      ph: i / N_PANELS + rng() * 0.03,
      yaw: -1.22 - rng() * 0.16,
      pitch: (rng() - 0.5) * 0.3,
      roll: (rng() - 0.5) * 0.25,
      wob: rng(),
    };
    if (rng() < 0.6) p.readout = { u: 0.1 + rng() * 0.5, v: 0.1 + rng() * 0.75, size: 0.22 + rng() * 0.12, slots: 7, seed: Math.floor(rng() * 1e6), fmt: Math.floor(rng() * 3) };
    return p;
  });
};

const panelPose = (p: Panel, t: number) => {
  const u = ((p.ph + p.k * t) % 1) - 0.5; // -0.5..0.5 along the sweep
  const pos = p.base.clone().addScaledVector(SWEEP, u * SPAN);
  const fade = smoothstep(0.5, 0.36, Math.abs(u));
  const turn = 0.22 * Math.sin(TAU * (t + p.wob)); // slow turn: glints sweep past
  return { pos, fade, u, rot: new THREE.Euler(p.pitch, p.yaw + turn, p.roll, "YXZ") };
};

const fmtValue = (seed: number, fmt: number, f: number) => {
  // values tick every 3 frames; periodic in the loop because f is wrapped
  const step = Math.floor(f / 3);
  const base = 10 + hash1(seed) * 89;
  const val = base + (hash1(seed, step) - 0.5) * 0.08 * base;
  if (fmt === 0) return val.toFixed(4);
  if (fmt === 1) return (val * 10).toFixed(2);
  return (val / 100).toFixed(4);
};

const MapScene: React.FC<{ v: MapVersion; frame: number }> = ({ v, frame }) => {
  const t = loopPhase(frame, LEN);
  const res = useMemo(() => {
    const mapTex = buildMap(v);
    const layout = makeLayout(v.seed);
    const rng = mulberry32(v.seed * 7 + 1);
    const panelLin = hexToLinear(v.panel);
    const texCache = new Map<string, THREE.Texture>();
    const panels = layout.map((p, i) => {
      const key = `${p.kind}-${i % 2}`;
      if (!texCache.has(key)) texCache.set(key, drawPanel(p.kind, rng, v.panel));
      const mat = panelMaterial(texCache.get(key)!, panelLin);
      if (p.kind === "bigRing") mat.uniforms.uFill.value = 0;
      const ro = p.readout ? readoutMaterial(hexToLinear(v.readout).map((x) => x * 3.2) as [number, number, number], p.readout.slots) : null;
      return { p, mat, ro };
    });
    const planeGeo = new THREE.PlaneGeometry(1, 1);
    const mapMat = new THREE.MeshBasicMaterial({ map: mapTex, toneMapped: false, color: new THREE.Color(0.72, 0.72, 0.8) });
    // small floating green readouts not attached to panels
    const free = Array.from({ length: 10 }, (_, i) => ({
      mat: readoutMaterial(hexToLinear(v.readout).map((x) => x * 1.8) as [number, number, number], 7),
      base: new THREE.Vector3((rng() - 0.5) * 6, (rng() - 0.5) * 7, -4 - rng() * 8),
      ph: rng(),
      seed: i * 977 + 13,
      size: 0.18 + rng() * 0.1,
    }));
    // sparse tiny cyan dust over the map
    const dust = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glowMaterial({ core: 5, soft: 0.0 }), 70);
    const dm = new THREE.Matrix4();
    const ro = hexToLinear(v.readout);
    for (let i = 0; i < 70; i++) {
      const sz = 0.04 + rng() * 0.06;
      dm.makeScale(sz, sz, 1);
      dm.setPosition((rng() - 0.5) * 22, (rng() - 0.5) * 12, -6 - rng() * 10);
      dust.setMatrixAt(i, dm);
      const a = 0.6 + rng() * 1.2;
      dust.setColorAt(i, new THREE.Color(ro[0] * 0.5 * a, ro[1] * a, ro[2] * 1.2 * a));
    }
    dust.frustumCulled = false;
    return { panels, planeGeo, mapMat, free, dust, depthMat: depthOnlyMaterial() };
  }, [v]);

  // slow closed camera drift, looking up and across with a roll (as in the reference)
  const a = TAU * t;
  const camPos: [number, number, number] = [-1.5 + 0.8 * Math.sin(a), -2.4 + 0.4 * Math.sin(2 * a), 6.5 + 0.5 * Math.cos(a)];
  const target: [number, number, number] = [1.2 + 0.6 * Math.sin(a + 1), 0.6, -6];

  useLayoutEffect(() => {
    res.panels.forEach(({ p, mat, ro }) => {
      const pose = panelPose(p, t);
      mat.uniforms.uAmt.value = pose.fade;
      mat.uniforms.uGlintPos.value = ((t * 2 + p.wob) % 1) * 3 - 0.5;
      if (ro && p.readout) {
        ro.uniforms.uAmt.value = pose.fade;
        setReadout(ro, fmtValue(p.readout.seed, p.readout.fmt, frame));
      }
    });
    res.free.forEach((r) => {
      r.mat.uniforms.uAmt.value = 1;
      setReadout(r.mat, fmtValue(r.seed, 0, frame));
    });
  }, [t, frame, res]);

  return (
    <>
      <PosedCamera position={camPos} target={target} fov={42} near={0.1} far={80} roll={-0.18} />
      <primitive object={res.dust} />
      {/* the map: large, tilted, far behind */}
      <mesh material={res.mapMat} position={[2, 1, -17]} rotation={[0.35, -0.55, 0.1]} renderOrder={0}>
        <planeGeometry args={[56, 28]} />
      </mesh>
      {res.panels.map(({ p, mat, ro }, i) => {
        const pose = panelPose(p, t);
        return (
          <group key={i} position={pose.pos} rotation={pose.rot}>
            <mesh geometry={res.planeGeo} material={mat} scale={[p.w, p.h, 1]} renderOrder={10 + i} />
            <mesh geometry={res.planeGeo} material={res.depthMat} scale={[p.w, p.h, 1]} renderOrder={200} />
            {ro && p.readout ? (
              <mesh
                geometry={res.planeGeo}
                material={ro}
                position={[(p.readout.u - 0.5) * p.w + p.readout.size * 2, (p.readout.v - 0.5) * p.h, 0.03]}
                scale={[p.readout.size * p.readout.slots * 0.62, p.readout.size, 1]}
                renderOrder={40 + i}
              />
            ) : null}
          </group>
        );
      })}
      {res.free.map((r, i) => {
        const u = ((r.ph + t) % 1) - 0.5;
        const pos = r.base.clone().addScaledVector(SWEEP, u * SPAN * 0.8);
        return (
          <mesh key={`f${i}`} geometry={res.planeGeo} material={r.mat} position={pos} rotation={[0, -1.0, 0]} scale={[r.size * 7 * 0.62, r.size, 1]} renderOrder={70 + i} />
        );
      })}
    </>
  );
};

export const MapPanels: React.FC<{ v: MapVersion }> = ({ v }) => {
  const raw = useCurrentFrame();
  const frame = ((raw % LEN) + LEN) % LEN;
  return (
    <Stage
      post={{
        frame,
        exposure: 1.1,
        bloomStrength: 0.35,
        bloomThreshold: 0.6,
        bloomRadius: 1.0,
        focusDistance: 6.5,
        focusBand: 2.0,
        focusRange: 7,
        maxBlur: 0.011,
        blackLift: [0.0012, 0.0018, 0.007],
        vignette: 0.6,
        clearColor: hexToLinear(v.bg),
      }}
    >
      <MapScene v={v} frame={frame} />
    </Stage>
  );
};

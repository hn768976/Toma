import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { canvasTexture, depthOnlyMaterial, glowMaterial, makeCanvas } from "../lib/helpers";
import { readoutMaterial, setReadout } from "../lib/readout";
import { hash1, loopPhase, mulberry32, smoothstep, TAU } from "../lib/random";
import { PosedCamera, Stage } from "../lib/stage";
import { HudVersion, hexToLinear } from "../versions";
import { CELL, drawWidget, GRID, WIDGETS } from "./widgets";

const LEN = 600;
const N_WIDGETS = 120;
const N_STREAKS = 40;
const PERIOD = 36; // layout period along the camera path (world units); camera covers exactly one per loop
const NEAR = 1.2;

const buildAtlas = () => {
  const { c, ctx } = makeCanvas(CELL * GRID, CELL * GRID);
  ctx.fillStyle = "black";
  ctx.fillRect(0, 0, c.width, c.height);
  const rng = mulberry32(4242);
  WIDGETS.forEach((kind, i) => {
    ctx.save();
    ctx.translate((i % GRID) * CELL, Math.floor(i / GRID) * CELL);
    ctx.beginPath();
    ctx.rect(0, 0, CELL, CELL);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    drawWidget(ctx, kind, rng);
    ctx.restore();
  });
  return canvasTexture(c, false);
};

const widgetMaterial = (atlas: THREE.Texture, v: HudVersion) =>
  new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    uniforms: {
      map: { value: atlas },
      uMain: { value: new THREE.Vector3(...hexToLinear(v.widget)) },
      uAcc: { value: new THREE.Vector3(...hexToLinear(v.accent)) },
    },
    vertexShader: /* glsl */ `
      attribute vec2 cell;
      attribute float bright;
      varying vec2 vUv;
      varying float vB;
      void main() {
        vUv.y = 1.0 - ((1.0 - uv.y) + cell.y) / ${GRID.toFixed(1)};
        vUv.x = (uv.x + cell.x) / ${GRID.toFixed(1)};
        vB = bright;
        gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform vec3 uMain, uAcc;
      varying vec2 vUv; varying float vB;
      void main() {
        vec3 m = texture2D(map, vUv).rgb;
        vec3 c = uMain * m.r + uAcc * m.g * 1.3 + uMain * m.b * 0.06;
        gl_FragColor = vec4(c * vB, 1.0);
      }`,
  });

type Widget = { kind: number; x: number; y: number; z: number; size: number; rot: number; tilt: number; bright: number; readout: boolean; seed: number };

const makeLayout = (seed: number) => {
  const rng = mulberry32(seed * 313 + 7);
  const ws: Widget[] = [];
  for (let i = 0; i < N_WIDGETS; i++) {
    // a few coins and large code panels guaranteed; the rest random
    const big = i % 20 === 5;
    const r = Math.floor(rng() * (WIDGETS.length - 1));
    const kind = i < 3 ? 7 : big ? 4 : r >= 7 ? r + 1 : r; // coins only where placed on purpose
    // keep a loose corridor around the camera path so widgets stream past at the sides
    let x = (rng() - 0.5) * 15;
    let y = (rng() - 0.5) * 8;
    if (Math.abs(x) < 1.2 && Math.abs(y) < 0.8) x += Math.sign(x || 1) * 1.5;
    if (i % 20 === 5) {
      // hero code panels: big, tilted, mostly centre-right and above the eye line
      x = (i % 60 === 5 ? -1 : 1) * (2.2 + rng() * 2);
      y = 0.8 + rng() * 1.6;
    }
    y *= 0.9;
    ws.push({
      kind,
      x,
      y,
      z: (i / N_WIDGETS) * PERIOD + rng() * (PERIOD / N_WIDGETS),
      size: big ? 5 + rng() * 2 : kind === 11 ? 3 + rng() * 2 : 0.9 + rng() * 1.6,
      rot: (rng() - 0.5) * 0.2,
      tilt: big ? (x > 0 ? -1 : 1) * (0.35 + rng() * 0.2) : (rng() - 0.5) * 0.5,
      bright: big ? 0.6 : kind === 11 ? 0.25 : 0.45 + rng() * 0.5,
      readout: kind === 1 || (kind === 14 && rng() < 0.7),
      seed: Math.floor(rng() * 1e6),
    });
  }
  return ws;
};

// distance ahead of the camera for a layout depth z at loop phase t (periodic in t)
const ahead = (z: number, t: number) => NEAR + ((((z - PERIOD * t) % PERIOD) + PERIOD) % PERIOD);

const HudScene: React.FC<{ v: HudVersion; frame: number }> = ({ v, frame }) => {
  const t = loopPhase(frame, LEN);
  const res = useMemo(() => {
    const atlas = buildAtlas();
    const layout = makeLayout(v.seed);
    const geo = new THREE.PlaneGeometry(1, 1);
    const cells = new Float32Array(N_WIDGETS * 2);
    const bright = new Float32Array(N_WIDGETS);
    layout.forEach((w, i) => {
      cells[i * 2] = w.kind % GRID;
      cells[i * 2 + 1] = Math.floor(w.kind / GRID);
    });
    const igeo = geo.clone();
    igeo.setAttribute("cell", new THREE.InstancedBufferAttribute(cells, 2));
    const brightAttr = new THREE.InstancedBufferAttribute(bright, 1);
    igeo.setAttribute("bright", brightAttr);
    const widgets = new THREE.InstancedMesh(igeo, widgetMaterial(atlas, v), N_WIDGETS);
    widgets.frustumCulled = false;
    widgets.renderOrder = 10;
    const proxy = new THREE.InstancedMesh(geo, depthOnlyMaterial(), N_WIDGETS);
    proxy.frustumCulled = false;
    proxy.renderOrder = 100;

    const readouts = layout
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => w.readout)
      .map(({ w, i }) => ({ i, w, mat: readoutMaterial(hexToLinear(v.widget).map((x) => x * 1.4) as [number, number, number], 3) }));

    // streaks
    const srng = mulberry32(v.seed * 77 + 3);
    const sa = hexToLinear(v.streak_a);
    const sb = hexToLinear(v.streak_b);
    const streakData = Array.from({ length: N_STREAKS }, (_, i) => ({
      y: (srng() - 0.5) * 9,
      z: srng() * PERIOD,
      len: 6 + srng() * 16,
      th: 0.015 + srng() * 0.05,
      k: (srng() < 0.5 ? -1 : 1) * (1 + Math.floor(srng() * 3)),
      ph: srng(),
      col: i % 3 === 0 ? [0.75, 0.9, 1.1] : i % 5 === 0 ? sa : sb,
      amp: 0.3 + srng() * 0.9,
    }));
    const streaks = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glowMaterial({ core: 3.2, soft: 0.25 }), N_STREAKS);
    streakData.forEach((s, i) => streaks.setColorAt(i, new THREE.Color(s.col[0] * s.amp, s.col[1] * s.amp, s.col[2] * s.amp)));
    streaks.frustumCulled = false;
    streaks.renderOrder = 20;

    // background haze blobs (big, soft) far behind
    const hrng = mulberry32(v.seed * 5 + 1);
    const haze = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glowMaterial({ core: 1.2, soft: 0.0, depthTest: false }), 10);
    const m = new THREE.Matrix4();
    for (let i = 0; i < 10; i++) {
      const s = 22 + hrng() * 24;
      m.makeScale(s * 2.0, s * 0.7, 1);
      m.setPosition((hrng() - 0.5) * 70, (hrng() - 0.5) * 26, -48);
      haze.setMatrixAt(i, m);
      const c = i % 5 === 0 ? sa : sb;
      const a = 0.02 + hrng() * 0.03;
      haze.setColorAt(i, new THREE.Color(c[0] * a, c[1] * a, c[2] * a));
    }
    haze.renderOrder = 1;
    haze.frustumCulled = false;
    const drng = mulberry32(v.seed * 11 + 2);
    const dustData = Array.from({ length: 140 }, () => ({ x: (drng() - 0.5) * 16, y: (drng() - 0.5) * 9, z: drng() * PERIOD, s: 0.02 + drng() * 0.03 }));
    const dust = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), glowMaterial({ core: 5, soft: 0 }), dustData.length);
    const wc = hexToLinear(v.widget);
    dustData.forEach((_, i) => dust.setColorAt(i, new THREE.Color(wc[0] * 1.5, wc[1] * 1.5, wc[2] * 1.5)));
    dust.frustumCulled = false;
    dust.renderOrder = 25;
    return { layout, widgets, proxy, brightAttr, readouts, streakData, streaks, haze, dust, dustData };
  }, [v]);

  const a = TAU * t;
  const camX = 0.7 * Math.sin(a);
  const camY = 0.25 * Math.sin(2 * a);
  const camPos: [number, number, number] = [camX, camY, 0];
  const target: [number, number, number] = [camX * 0.6 + 0.4 * Math.sin(a + 0.8), camY * 0.5, -10];

  const poses = res.layout.map((w) => {
    const d = ahead(w.z, t);
    // fade in at the far end, fade out just before passing the camera
    const fade = smoothstep(PERIOD + NEAR, PERIOD * 0.7, d) * smoothstep(NEAR, NEAR + 1.2, d);
    return { pos: new THREE.Vector3(w.x, w.y, -d), fade, d };
  });

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    res.layout.forEach((w, i) => {
      const p = poses[i];
      e.set(0, w.tilt, w.rot);
      q.setFromEuler(e);
      m.compose(p.pos, q, new THREE.Vector3(w.size, w.size, 1));
      res.widgets.setMatrixAt(i, m);
      res.proxy.setMatrixAt(i, m);
      res.brightAttr.setX(i, w.bright * p.fade * (0.85 + 0.15 * Math.sin(TAU * (t * 3 + w.seed * 1e-3))));
    });
    res.widgets.instanceMatrix.needsUpdate = true;
    res.proxy.instanceMatrix.needsUpdate = true;
    res.brightAttr.needsUpdate = true;
    res.readouts.forEach((r) => {
      const step = Math.floor(frame / 4);
      const base = 20 + hash1(r.w.seed) * 75;
      const val = Math.round(base + (hash1(r.w.seed, Math.floor(step / 3)) - 0.5) * 6);
      setReadout(r.mat, r.w.kind === 1 ? `${val}%` : `${val}`);
      r.mat.uniforms.uAmt.value = r.w.bright * poses[r.i].fade;
    });
    res.streakData.forEach((s, i) => {
      const d = ahead(s.z, t);
      const fade = smoothstep(PERIOD + NEAR, PERIOD * 0.6, d) * smoothstep(NEAR, NEAR + 2, d);
      const span = 40;
      const x = ((((s.ph + s.k * t) % 1) + 1) % 1) * span - span / 2;
      m.compose(new THREE.Vector3(x, s.y, -d), q.identity(), new THREE.Vector3(s.len, s.th * (1 + d * 0.04), 1));
      res.streaks.setMatrixAt(i, m);
      const c = s.col;
      res.streaks.setColorAt(i, new THREE.Color(c[0] * s.amp * fade, c[1] * s.amp * fade, c[2] * s.amp * fade));
    });
    res.streaks.instanceMatrix.needsUpdate = true;
    res.dustData.forEach((p, i) => {
      const d = ahead(p.z, t);
      const fade = smoothstep(PERIOD + NEAR, PERIOD * 0.6, d) * smoothstep(NEAR, NEAR + 1, d);
      const sz = p.s * fade + 1e-4;
      m.compose(new THREE.Vector3(p.x, p.y, -d), q.identity(), new THREE.Vector3(sz, sz, 1));
      res.dust.setMatrixAt(i, m);
    });
    res.dust.instanceMatrix.needsUpdate = true;
    if (res.streaks.instanceColor) res.streaks.instanceColor.needsUpdate = true;
  });

  return (
    <>
      <PosedCamera position={camPos} target={target} fov={50} near={0.1} far={80} roll={0.03 * Math.sin(a)} />
      <primitive object={res.haze} />
      <primitive object={res.widgets} />
      <primitive object={res.proxy} />
      <primitive object={res.streaks} />
      <primitive object={res.dust} />
      {res.readouts.map((r) => {
        const p = poses[r.i];
        const s = r.w.size;
        return (
          <mesh key={r.i} material={r.mat} position={[p.pos.x, p.pos.y, p.pos.z + 0.01]} rotation={[0, r.w.tilt, r.w.rot]} scale={[s * 0.62 * 0.62, s * 0.3, 1]} renderOrder={30}>
            <planeGeometry args={[1, 1]} />
          </mesh>
        );
      })}
    </>
  );
};

export const HUDFlythrough: React.FC<{ v: HudVersion }> = ({ v }) => {
  const raw = useCurrentFrame();
  const frame = ((raw % LEN) + LEN) % LEN;
  return (
    <Stage
      post={{
        frame,
        exposure: 0.82,
        blackLift: [0.006, 0.009, 0.018],
        bloomStrength: 0.42,
        bloomThreshold: 0.5,
        bloomRadius: 1.0,
        focusDistance: 8,
        focusBand: 1.6,
        focusRange: 6,
        maxBlur: 0.012,
        nearBlurScale: 1.3,
        vignette: 0.45,
        clearColor: hexToLinear(v.bg),
      }}
    >
      <HudScene v={v} frame={frame} />
    </Stage>
  );
};

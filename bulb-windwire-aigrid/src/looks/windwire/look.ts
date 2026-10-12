import { Group, Object3D, PerspectiveCamera, Scene, Vector2 } from "three";
import { hexToSrgb, lin } from "../../engine/color";
import { FONT_HUD } from "../../engine/fonts";
import { LineBatch, PointBatch, SegList } from "../../engine/lines";
import { Pipeline } from "../../engine/pipeline";
import { canvasTexture, texturedPlane } from "../../engine/sprites";
import { hash01, mulberry32, range, TAU } from "../../engine/rng";
import type { LookFactory } from "../../engine/Stage";
import { buildTurbine, TURBINE } from "../../shared/turbine";

// Look 2 — Wireframe Wind Farm. Everything that moves is periodic in the loop:
// the world scrolls exactly one layout period P toward the camera, rotors turn
// whole multiples of 120°, HUD flicker and camera sway are whole cycles.

export type WindwirePalette = {
  line: string;
  terrain: string;
  horizon: string;
  bgTop: string;
  bgBottom: string;
};

export const LOOP = 600;
const P = 44; // layout period along depth (world units)
const L = 2 * P; // wrapped extent of the world strip
const Z_MIN = -L + 8; // far end of the strip (camera at z=0 looking -Z)
const ROWS = 88; // terrain rows over L (spacing 1.0, 44 rows per period)
const DX = 1.0;
const X_HALF = 62;

// --- static layout (module level, seeded) ----------------------------------

/** Terrain height: periodic in z with period P, flatter along the flight corridor. */
const terrainH = (x: number, z: number) => {
  const k = TAU / P;
  const ax = Math.abs(x);
  const corridor = 0.25 + 0.75 * Math.min(1, Math.max(0, (ax - 3) / 22));
  const hills =
    1.6 * Math.cos(0.11 * x + 2 * k * z + 0.7) +
    1.1 * Math.cos(-0.07 * x + 3 * k * z + 2.1) +
    0.7 * Math.cos(0.23 * x - 5 * k * z + 4.0) +
    0.35 * Math.cos(0.41 * x + 9 * k * z + 1.3) +
    0.2 * Math.cos(-0.67 * x + 14 * k * z + 5.1);
  // Ridges rising toward the sides, for hills that cross the horizon line.
  const ridge = Math.max(0, ax - 12) * 0.16 * (1 + 0.7 * Math.cos(0.09 * x + 4 * k * z)) + 1.4 * Math.max(0, Math.cos(0.13 * x + 3 * k * z + 1.0)) * Math.min(1, ax / 10);
  return corridor * hills + ridge - 0.6;
};

const buildTerrain = () => {
  const cols = Math.round((2 * X_HALF) / DX) + 1;
  const vx = new Float32Array(cols * ROWS * 3);
  const idx = (i: number, j: number) => j * cols + i;
  for (let j = 0; j < ROWS; j++) {
    for (let i = 0; i < cols; i++) {
      // Jitter repeats every period (j mod 40) so the wrapped strip is periodic.
      const jp = j % (ROWS / 2);
      const jx = (hash01(i * 7919 + jp * 104729) - 0.5) * DX * 0.55;
      const jz = (hash01(i * 15485863 + jp * 32452843 + 1) - 0.5) * DX * 0.55;
      const x = -X_HALF + i * DX + jx;
      const z = Z_MIN + j * (L / ROWS) + jz;
      const k = idx(i, j) * 3;
      vx[k] = x;
      vx[k + 1] = terrainH(x, z);
      vx[k + 2] = z;
    }
  }
  const segs = new SegList();
  const v = (n: number) => [vx[n * 3], vx[n * 3 + 1], vx[n * 3 + 2]];
  for (let j = 0; j < ROWS; j++) {
    const jn = (j + 1) % ROWS; // wraps: the shader hides the seam segment
    for (let i = 0; i < cols; i++) {
      if (i + 1 < cols) segs.add(v(idx(i, j)), v(idx(i + 1, j)), 1);
      // the row-to-row link across the wrap: store the far vertex unwrapped
      const b = v(idx(i, jn));
      if (jn === 0) b[2] += L;
      segs.add(v(idx(i, j)), b, 1);
      if (i + 1 < cols) {
        const diagFlip = hash01(i * 31 + (j % (ROWS / 2)) * 977) > 0.5;
        const c = v(idx(diagFlip ? i + 1 : i, jn));
        if (jn === 0) c[2] += L;
        segs.add(v(idx(diagFlip ? i : i + 1, j)), c, 0.8);
      }
    }
  }
  const si = new Float32Array(cols * ROWS * 2);
  for (let n = 0; n < cols * ROWS; n++) {
    si[n * 2] = 0.8 + 0.6 * hash01(n * 13 + 5);
    si[n * 2 + 1] = 0.7 + 0.6 * hash01(n * 17 + 3);
  }
  return { segs: segs.toArray(), verts: vx, si };
};

const TERRAIN = buildTerrain();
const TURB = buildTurbine("full");

type TurbineSpot = { x: number; z: number; yaw: number; k: number; phase: number; scale: number };
const TURBINES: TurbineSpot[] = (() => {
  const r = mulberry32(0x5eed2a);
  // One period's layout (7), repeated twice along the wrapped strip -> 14.
  const base: Omit<TurbineSpot, "k" | "phase">[] = [
    // Near turbines staggered half a period apart, so a big one is close by most of the loop.
    { x: -6.8, z: -9, yaw: 0.2, scale: 1.3 }, // hero, passes on the left of the camera
    { x: -7.6, z: -31, yaw: 0.15, scale: 1.3 },
    { x: 11.5, z: -20, yaw: -0.25, scale: 1.3 },
    { x: 10.5, z: -42, yaw: -0.2, scale: 1.25 },
    // Mid and far ones, spread wide.
    { x: -26, z: -15, yaw: 0.3, scale: 1.1 },
    { x: 24, z: -27, yaw: -0.35, scale: 1.1 },
    { x: -15, z: -37, yaw: 0.25, scale: 1.05 },
  ];
  // Speed and phase belong to the base layout, so the copy one period further
  // away is identical: when it takes the near copy's place at the loop seam the
  // rotor angle carries on without a jump.
  const spin = base.map(() => ({ k: 3 + Math.floor(r() * 4), phase: r() * TAU })); // 3..6 thirds of a turn per loop
  const out: TurbineSpot[] = [];
  for (let rep = 0; rep < 2; rep++) base.forEach((b, i) => out.push({ ...b, z: b.z - rep * P, ...spin[i] }));
  return out;
})();

// --- shader chunk: wrap the strip by the scroll offset ----------------------

const WRAP_UNIFORMS = () => ({ uOffset: { value: 0 }, uZmin: { value: Z_MIN }, uL: { value: L } });
const WRAP_GLSL = /* glsl */ `
uniform float uOffset, uZmin, uL;
float wrapZ(float z) { return uZmin + mod(z - uZmin + uOffset, uL); }
`;
const LINE_WRAP_CHUNK = `${WRAP_GLSL}
vec3 xform(vec3 p) { return vec3(p.x, p.y, wrapZ(p.z)); }
float segVisible(vec3 a0, vec3 b0, vec3 a, vec3 b) { return abs(a.z - b.z) < uL * 0.5 ? 1.0 : 0.0; }
`;
const POINT_WRAP_CHUNK = `${WRAP_GLSL}
vec3 xform(vec3 p) { return vec3(p.x, p.y, wrapZ(p.z)); }
float pointVisible(vec3 p0, vec3 p) { return 1.0; }
`;

// --- HUD textures ------------------------------------------------------------

const drawHud = (seed: number, density: number) => (ctx: CanvasRenderingContext2D, w: number, h: number) => {
  const r = mulberry32(seed);
  const s = h / 1800;
  ctx.strokeStyle = "rgba(255,255,255,1)";
  ctx.fillStyle = "rgba(255,255,255,1)";
  // Large thin circles with tick marks.
  for (let i = 0; i < 2 + density; i++) {
    const cx = range(r, 0.05, 0.95) * w,
      cy = range(r, 0.05, 0.55) * h,
      rad = range(r, 180, 420) * s;
    ctx.globalAlpha = range(r, 0.45, 0.8);
    ctx.lineWidth = 2.2 * s;
    const a0 = r() * TAU;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, a0, a0 + range(r, 2.2, TAU));
    ctx.stroke();
    ctx.lineWidth = 1.6 * s;
    const ticks = 36;
    for (let t = 0; t < ticks; t++) {
      if (r() < 0.35) continue;
      const a = (t / ticks) * TAU;
      const l = (t % 3 === 0 ? 18 : 9) * s;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (rad + 6 * s), cy + Math.sin(a) * (rad + 6 * s));
      ctx.lineTo(cx + Math.cos(a) * (rad + 6 * s + l), cy + Math.sin(a) * (rad + 6 * s + l));
      ctx.stroke();
    }
  }
  // Long thin vertical and horizontal guide lines.
  ctx.lineWidth = 1.6 * s;
  for (let i = 0; i < 4 + density * 2; i++) {
    ctx.globalAlpha = range(r, 0.3, 0.7);
    ctx.beginPath();
    if (r() < 0.6) {
      const x = r() * w;
      const y0 = range(r, 0, 0.2) * h;
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + range(r, 0.15, 0.55) * h);
    } else {
      const y = range(r, 0.05, 0.6) * h;
      const x0 = r() * w;
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + range(r, 0.1, 0.35) * w, y);
    }
    ctx.stroke();
  }
  // Rectangular panel frames.
  ctx.lineWidth = 1.6 * s;
  for (let i = 0; i < 3 + density; i++) {
    ctx.globalAlpha = range(r, 0.35, 0.7);
    const x = r() * w * 0.9,
      y = range(r, 0.02, 0.45) * h;
    ctx.strokeRect(x, y, range(r, 120, 380) * s, range(r, 60, 240) * s);
  }
  // Ruler marks.
  for (let i = 0; i < 3 + density; i++) {
    const x0 = r() * w * 0.85,
      y0 = range(r, 0.05, 0.75) * h;
    ctx.globalAlpha = range(r, 0.5, 0.9);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x0 + 220 * s, y0);
    for (let t = 0; t <= 10; t++) {
      ctx.moveTo(x0 + t * 22 * s, y0);
      ctx.lineTo(x0 + t * 22 * s, y0 - (t % 5 === 0 ? 16 : 8) * s);
    }
    ctx.stroke();
  }
  // Short diagonal streaks.
  ctx.lineWidth = 2 * s;
  for (let i = 0; i < 6 + density * 4; i++) {
    const x = r() * w,
      y = range(r, 0, 0.6) * h,
      l = range(r, 30, 110) * s;
    ctx.globalAlpha = range(r, 0.3, 0.8);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + l * 0.6, y - l);
    ctx.stroke();
  }
  // Invented readouts.
  ctx.textBaseline = "middle";
  for (let i = 0; i < 18 + density * 10; i++) {
    const v = (range(r, 8, 99)).toFixed(2);
    const size = range(r, 18, 28) * s;
    ctx.font = `500 ${size}px "${FONT_HUD}"`;
    ctx.globalAlpha = range(r, 0.55, 1);
    const y = (r() < 0.75 ? range(r, 0.03, 0.55) : range(r, 0.55, 0.9)) * h;
    const x = r() * w;
    ctx.fillText(r() < 0.12 ? `${v}.${Math.floor(r() * 90 + 10)}` : v, x, y);
    if (r() < 0.25) {
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      ctx.moveTo(x, y + size * 0.8);
      ctx.lineTo(x + size * 3.2, y + size * 0.8);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
};

// --- the look ----------------------------------------------------------------

export const createWindwire =
  (pal: WindwirePalette): LookFactory =>
  (gl) => {
    const lineC = lin(pal.line);
    const terrC = lin(pal.terrain);
    const horC = lin(pal.horizon);
    const scene = new Scene();
    const camera = new PerspectiveCamera(52, 16 / 9, 0.1, 400);
    const resTargets: { setRes: (w: number, h: number) => void }[] = [];

    // Terrain: triangle edges + vertex dots.
    const terrainLines = new LineBatch(TERRAIN.segs, {
      color: terrC,
      width: 0.85,
      opacity: 0.3,
      fog: [40, 100],
      chunk: LINE_WRAP_CHUNK,
      uniforms: WRAP_UNIFORMS(),
      depth: true,
    });
    const terrainDots = new PointBatch(TERRAIN.verts, TERRAIN.si, {
      color: terrC,
      size: 3.6,
      opacity: 2.2,
      fog: [30, 85],
      persp: 0.6,
      perspRef: 12,
      core: 0.5,
      chunk: POINT_WRAP_CHUNK,
      uniforms: { ...WRAP_UNIFORMS() },
      depth: true,
    });
    scene.add(terrainLines.mesh, terrainDots.points);
    resTargets.push(terrainLines, terrainDots);

    // Turbines.
    const towerBatch = new LineBatch(TURB.tower.toArray(), { color: lineC, width: 1.3, opacity: 0.8, fog: [60, 108], persp: 0.35, perspRef: 15, depth: true });
    const rotorBatch = new LineBatch(TURB.rotor.toArray(), { color: lineC, width: 1.2, opacity: 0.85, fog: [60, 108], persp: 0.35, perspRef: 15, depth: true });
    resTargets.push(towerBatch, rotorBatch);
    const turbines = TURBINES.map((t) => {
      const g = new Group();
      const tower = towerBatch.instance();
      const hub = new Object3D();
      hub.position.copy(TURBINE.hub);
      const rotor = rotorBatch.instance();
      hub.add(rotor);
      g.add(tower, hub);
      g.rotation.y = t.yaw;
      g.scale.setScalar(t.scale);
      scene.add(g);
      return { spot: t, g, hub, foot: terrainH(t.x, t.z) };
    });

    // Horizon: a long bright line at the far edge, at eye level.
    const hz = new SegList();
    hz.add([-400, 0, -104], [400, 0, -104], 1);
    const horizon = new LineBatch(hz.toArray(), { color: lineC, width: 3.2, opacity: 2.0, depth: true });
    const horizonWide = new LineBatch(hz.toArray(), { color: horC, width: 6, opacity: 0.06 });
    scene.add(horizon.mesh, horizonWide.mesh);
    resTargets.push(horizon, horizonWide);

    // HUD planes, attached to the camera at three depths.
    const hudDefs = [
      { d: 24, seed: 0x41, density: 1, opacity: 0.4 },
      { d: 42, seed: 0x42, density: 2, opacity: 0.32 },
      { d: 70, seed: 0x43, density: 3, opacity: 0.25 },
    ];
    const huds = hudDefs.map((h) => {
      const tex = canvasTexture(3200, 1800, drawHud(h.seed, h.density));
      const hh = 2 * h.d * Math.tan((52 / 2) * (Math.PI / 180)) * 1.08;
      const p = texturedPlane(tex, hh * (16 / 9), hh, lineC, h.opacity, true);
      p.mesh.position.set(0, 0, -h.d);
      camera.add(p.mesh);
      return { ...h, p, tex };
    });
    scene.add(camera);

    // Diagonal data streaks flying from upper right toward lower left (camera space).
    const STREAKS = 140;
    const sr = mulberry32(0x57e4);
    const streakDefs = Array.from({ length: STREAKS }, () => ({
      x: range(sr, -26, 26),
      y: range(sr, -6, 14),
      d: range(sr, 14, 45),
      len: range(sr, 0.8, 2.6),
      n: 1 + Math.floor(sr() * 3), // passes per loop
      ph: sr(),
      i: range(sr, 0.3, 1),
    }));
    const streakData = new Float32Array(STREAKS * 8);
    const streaks = new LineBatch(new Float32Array(0), { color: lineC, width: 1.2, opacity: 1.0, maxSegments: STREAKS });
    camera.add(streaks.mesh);
    resTargets.push(streaks);

    const pipeline = new Pipeline(gl, {
      msaa: 0,
      dof: true,
      bloomStrength: 0.24,
      bloomLevelWeights: [0.6, 0.8, 1, 1, 0.9, 0.7],
      exposure: 1.0,
      vignette: 0.45,
      grain: 0.015,
      composite: {
        background: /* glsl */ `
uniform vec3 uBgTop, uBgBottom, uHorizonGlow; uniform float uHorizonY;
vec3 background(vec2 uv) {
  vec3 c = mix(uBgBottom, uBgTop, smoothstep(0.05, 0.85, uv.y));
  float d = uv.y - uHorizonY;
  // Soft glow hugging the horizon, a little stronger above it.
  c += uHorizonGlow * (exp(-d * d / 0.0006) * 0.14 + exp(-d * d / 0.008) * 0.04);
  c *= mix(0.55, 1.0, smoothstep(0.0, 0.5, uv.y)); // floor falls toward black
  return c;
}`,
        extraUniforms: {
          uBgTop: { value: hexToSrgb(pal.bgTop) },
          uBgBottom: { value: hexToSrgb(pal.bgBottom) },
          uHorizonGlow: { value: hexToSrgb(pal.horizon) },
          uHorizonY: { value: 0.57 },
        },
      },
    });

    const size = new Vector2();
    const render = (frame: number) => {
      gl.getDrawingBufferSize(size);
      resTargets.forEach((t) => t.setRes(size.x, size.y));
      const f = ((frame % LOOP) + LOOP) % LOOP;
      const t = f / LOOP;

      // Forward glide: the world strip scrolls toward the camera by exactly P per loop.
      const offset = P * t;
      for (const b of [terrainLines, terrainDots]) b.u.uOffset.value = offset;
      for (const tb of turbines) {
        const z = Z_MIN + ((((tb.spot.z - Z_MIN + offset) % L) + L) % L);
        tb.g.position.set(tb.spot.x, tb.foot, z);
        tb.hub.rotation.z = tb.spot.phase + (TAU / 3) * tb.spot.k * t;
        // Fade turbines in at the far end of the strip, out as they pass behind.
        tb.g.visible = z < 6;
      }

      // Camera: eye height ~2 above the corridor, a slight sway (whole cycles).
      const eyeY = 2.1 + 0.12 * Math.sin(TAU * 2 * t + 0.4);
      camera.position.set(0.35 * Math.sin(TAU * t), eyeY, 0);
      camera.rotation.set(-0.065 + 0.008 * Math.sin(TAU * t + 1.2), 0.025 * Math.sin(TAU * t + 0.5), 0.006 * Math.sin(TAU * 2 * t));
      camera.aspect = size.x / size.y;
      camera.updateProjectionMatrix();
      horizon.mesh.position.set(camera.position.x, eyeY + 1.0, 0);
      horizonWide.mesh.position.copy(horizon.mesh.position);
      camera.updateMatrixWorld(true);

      // Horizon screen height drives the background glow band.
      const hp = horizon.mesh.position.clone().setZ(-104).project(camera);
      pipeline.uniforms.uHorizonY.value = hp.y * 0.5 + 0.5;

      // Streaks: each travels a fixed diagonal path n times per loop.
      const dir = [-0.62, -0.78];
      streakDefs.forEach((s, k) => {
        const u = (((s.ph + s.n * t) % 1) + 1) % 1; // 0..1 along its path
        const span = 34;
        const cx = s.x + dir[0] * (u - 0.5) * span,
          cy = s.y + dir[1] * (u - 0.5) * span;
        const fade = Math.sin(Math.PI * u) * s.i;
        streakData.set([cx, cy, -s.d, cx - dir[0] * s.len, cy - dir[1] * s.len, -s.d, fade, fade * 0.15], k * 8);
      });
      streaks.setSegments(streakData, STREAKS);

      // HUD flicker: gentle, whole cycles per loop.
      huds.forEach((h, i) => {
        const fl = 1 + 0.12 * Math.sin(TAU * (3 + i * 2) * t + i) + 0.06 * Math.sin(TAU * (11 + i) * t + 2 * i);
        h.p.uniforms.uOpacity.value = h.opacity * fl;
      });

      pipeline.render({
        scene,
        camera,
        frame,
        grainPeriod: LOOP,
        dof: { focus: 22, aperture: 0.0016, maxCoc: 0.003, far: 400 },
        flare: {
          pos: [0.5 + 0.32 * Math.sin(TAU * t + 0.3), hp.y * 0.5 + 0.5],
          intensity: 0.08 + 0.03 * Math.sin(TAU * 2 * t),
          color: horC,
          streak: 1.6,
        },
      });
    };

    return {
      render,
      dispose: () => {
        pipeline.dispose();
        [terrainLines, terrainDots, towerBatch, rotorBatch, horizon, horizonWide].forEach((b) => b.dispose());
        huds.forEach((h) => h.tex.dispose());
      },
    };
  };

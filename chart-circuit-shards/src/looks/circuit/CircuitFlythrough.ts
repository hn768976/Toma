import * as THREE from 'three';
import { LookFactory } from '../../lib/ThreeStage';
import { CircuitVersion } from '../../versions';
import { Rng } from '../../lib/rng';
import { hexToLinear, mod, TAU } from '../../lib/math';
import { displayToScene } from '../../lib/tone';
import { buildTraceGeometry, DIRS, GrowOpts, Occupancy, PathSampler, Router, SquareDot, Trace, V2 } from '../../lib/pcb';
import { makeTraceMaterial, SpriteField } from '../../lib/sprites';

export const CIRCUIT_FRAMES = 600;

// Board tile: TILE x TILE world units, toroidal. The camera travels exactly
// N_TILES * TILE along +y (world -z) over the 600 frames.
const TILE = 12;
const N_TILES = 2;
const S = 0.12; // track spacing
const EXPOSURE = 1.0;
const FOG_NEAR = 14;
const FOG_FAR = 55;

type Board = { traces: Trace[]; loops: Trace[]; squares: SquareDot[] };

/** Seeded routing pass. Runs once, at module level. */
const routeBoard = (seed: number): Board => {
  const rng = new Rng(seed);
  const occ = new Occupancy(0, 0, TILE, TILE, S / 4, true);
  const router = new Router(occ, rng);
  const baseOpts: GrowOpts = {
    spacing: S,
    minRun: 3,
    maxRun: 16,
    turnProb: 0.4,
    splitProb: 0.16,
    peelProb: 0.08,
    maxSegments: 18,
    dirWeight: (d) => [0.3, 0.9, 1.0, 0.9, 0.3, 0.1, 0.05, 0.1][d],
    traceWidth: () => S * rng.range(0.17, 0.24),
    bright: () => (rng.chance(0.32) ? rng.range(0.6, 1.0) : rng.range(0.07, 0.28)),
    tone: () => rng.f() * rng.f(),
    endPad: () => (rng.chance(0.75) ? 1 : 2),
    padRadius: S * 0.42,
  };

  // 1) Periodic trunk bundles running toward the horizon: N / NE / NW runs
  //    whose net sideways shift is zero and total forward travel is exactly
  //    one tile, so they continue seamlessly across tile copies.
  const loops: Trace[] = [];
  const nTrunks = 5;
  for (let b = 0; b < nTrunks; b++) {
    const k = b === 0 ? 7 : rng.int(3, 6);
    const x0 = ((b + rng.range(0.15, 0.85)) / nTrunks) * TILE;
    const jogs: number[] = [];
    const nPairs = b === 0 ? 1 : rng.int(1, 2); // trunk 0 is the central spine
    for (let j = 0; j < nPairs; j++) {
      const len = rng.int(4, 12) * S;
      const sgn = rng.sign();
      jogs.push(sgn * len, -sgn * len);
    }
    // shuffle jogs (seeded)
    for (let i = jogs.length - 1; i > 0; i--) {
      const r = rng.int(0, i);
      [jogs[i], jogs[r]] = [jogs[r], jogs[i]];
    }
    const jogDy = jogs.reduce((s, j) => s + Math.abs(j), 0);
    const straight = TILE - jogDy;
    const nRuns = jogs.length + 1;
    const wts = Array.from({ length: nRuns }, () => rng.range(0.6, 1.4));
    const wsum = wts.reduce((a, b) => a + b, 0);
    const runs = wts.map((w) => (straight * w) / wsum);
    // centre path as (dir, length) segments
    const segs: { d: number; len: number }[] = [];
    for (let i = 0; i < nRuns; i++) {
      segs.push({ d: 2, len: runs[i] });
      if (i < jogs.length) segs.push({ d: jogs[i] > 0 ? 1 : 3, len: Math.abs(jogs[i]) * Math.SQRT2 });
    }
    const traces: Trace[] = [];
    const ids: number[] = [];
    for (let i = 0; i < k; i++) {
      const off = (i - (k - 1) / 2) * S;
      const t: Trace = {
        pts: [],
        width: S * 0.18,
        bright: rng.range(0.6, 1.0),
        tone: rng.f(),
        padStart: 0,
        padEnd: 0,
        loop: true,
        group: -1 - b,
        seed: rng.f(),
      };
      ids.push(router.traces.length);
      router.traces.push(t);
      traces.push(t);
      // build mitred offset polyline
      let c: V2 = [x0, 0];
      const pv = (d: number): V2 => [-DIRS[d][1], DIRS[d][0]];
      t.pts.push([c[0] + pv(2)[0] * off, c[1]]);
      for (let si = 0; si < segs.length; si++) {
        const sg = segs[si];
        c = [c[0] + DIRS[sg.d][0] * sg.len, c[1] + DIRS[sg.d][1] * sg.len];
        const nd = si + 1 < segs.length ? segs[si + 1].d : 2;
        const p1 = pv(sg.d);
        const p2 = pv(nd);
        let mx = p1[0] + p2[0];
        let my = p1[1] + p2[1];
        const ml = Math.hypot(mx, my);
        mx /= ml;
        my /= ml;
        const kk = 1 / (mx * p2[0] + my * p2[1]);
        t.pts.push([c[0] + mx * kk * off, c[1] + my * kk * off]);
      }
      // close exactly
      t.pts[t.pts.length - 1] = [t.pts[0][0], t.pts[0][1] + TILE];
      loops.push(t);
    }
    traces.forEach((t, i) => {
      for (let j = 1; j < t.pts.length; j++) occ.markSeg(t.pts[j - 1], t.pts[j], S * 0.3, ids[i]);
    });
  }

  // 2) Bundles grown from random free points until they hit something.
  for (let attempt = 0; attempt < 900; attempt++) {
    const c: V2 = [rng.range(0, TILE), rng.range(0, TILE)];
    const r = rng.f();
    const d = r < 0.5 ? 2 : r < 0.68 ? 1 : r < 0.86 ? 3 : r < 0.93 ? 0 : 4;
    const k = rng.chance(0.3) ? 1 : rng.int(2, 7);
    router.growBundle(c, d, k, baseOpts, rng.chance(0.7) ? 1 : 2);
  }
  router.prune(S * 6);
  // 2x2 / 3x3 clusters of small square pads in free spots
  const squares: SquareDot[] = [];
  for (let a = 0; a < 600 && squares.length < 160; a++) {
    const n = rng.chance(0.6) ? 2 : 3;
    const pitch = S * 0.7;
    const c: V2 = [rng.range(0, TILE), rng.range(0, TILE)];
    if (!occ.free(c[0], c[1], pitch * n * 0.75, -9)) continue;
    occ.mark(c[0], c[1], pitch * n * 0.75, -4);
    const br = rng.range(0.4, 1.0);
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        squares.push({ p: [c[0] + (i - (n - 1) / 2) * pitch, c[1] + (j - (n - 1) / 2) * pitch], r: S * 0.2, bright: br, tone: rng.f() * 0.5 });
  }
  return { traces: router.traces, loops, squares };
};

const BOARD = routeBoard(20260402);
// centre the camera on the first trunk bundle so it forms a central spine
const SPINE_X = BOARD.loops[0].pts[0][0];

// Lights (twinkling + travelling), generated once from a fixed seed.
type Twinkle = { x: number; y: number; size: number; amp: number; k: number; ph: number; tone: number };
type Mover = { path: PathSampler; loop: boolean; s0: number; m: number; size: number; amp: number; tone: number };
const makeLights = (seed: number) => {
  const rng = new Rng(seed);
  const samplers = BOARD.traces.map((t) => new PathSampler(t.pts));
  const totalLen = samplers.reduce((s, p) => s + p.length, 0);
  const pickTrace = () => {
    let r = rng.f() * totalLen;
    for (let i = 0; i < samplers.length; i++) {
      r -= samplers[i].length;
      if (r <= 0) return i;
    }
    return samplers.length - 1;
  };
  const tw: Twinkle[] = [];
  const tmp: V2 = [0, 0];
  for (let i = 0; i < 480; i++) {
    const ti = pickTrace();
    const p: V2 = samplers[ti].at(rng.f() * samplers[ti].length, tmp);
    tw.push({
      x: mod(p[0], TILE),
      y: mod(p[1], TILE),
      size: rng.range(0.015, 0.04),
      amp: rng.range(0.5, 2.6) * (rng.chance(0.15) ? 2.5 : 1),
      k: rng.int(1, 5),
      ph: rng.f(),
      tone: rng.f(),
    });
  }
  const mv: Mover[] = [];
  const loopIdx = BOARD.traces.map((t, i) => (t.loop ? i : -1)).filter((i) => i >= 0);
  for (let i = 0; i < 160; i++) {
    const onLoop = i < 50;
    const ti = onLoop ? rng.pick(loopIdx) : pickTrace();
    const sp = samplers[ti];
    if (!onLoop && sp.length < S * 8) continue;
    mv.push({
      path: sp,
      loop: onLoop,
      s0: rng.f(),
      // whole number of trips per loop (sign = direction)
      m: rng.sign() * (onLoop ? rng.int(1, 2) : rng.int(1, 4)),
      size: rng.range(0.025, 0.04),
      amp: rng.range(3.0, 6.0),
      tone: rng.range(0.4, 1.0),
    });
  }
  return { tw, mv };
};
const LIGHTS = makeLights(777);

const BOARD_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uBoard, uHaze;
uniform float uFogNear, uFogFar;
in vec3 vWorld;
out vec4 outColor;
float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  float dist = length(vWorld - cameraPosition);
  float n = vnoise(vWorld.xz * 0.35) * 0.6 + vnoise(vWorld.xz * 1.3) * 0.4;
  vec3 col = uBoard * (0.8 + 0.45 * n);
  col = mix(col, uHaze, smoothstep(uFogNear * 0.6, uFogFar, dist));
  outColor = vec4(col, 1.0);
}`;

const SKY_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uHaze, uTop;
in vec3 vWorld;
out vec4 outColor;
void main() {
  vec3 d = normalize(vWorld - cameraPosition);
  outColor = vec4(mix(uHaze, uTop, smoothstep(0.0, 0.25, d.y)), 1.0);
}`;

const WORLD_VERT = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

export const makeCircuitFactory =
  (v: CircuitVersion): LookFactory =>
  () => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 400);
    const haze = displayToScene(v.haze, EXPOSURE);
    const board = displayToScene(v.board, EXPOSURE);

    const boardMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 240, 120, 120),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: WORLD_VERT,
        fragmentShader: BOARD_FRAG,
        uniforms: {
          uBoard: { value: new THREE.Vector3(...board) },
          uHaze: { value: new THREE.Vector3(...haze) },
          uFogNear: { value: FOG_NEAR },
          uFogFar: { value: FOG_FAR },
        },
      }),
    );
    boardMesh.rotation.x = -Math.PI / 2;
    scene.add(boardMesh);
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(300, 32, 16),
      new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: WORLD_VERT,
        fragmentShader: SKY_FRAG,
        side: THREE.BackSide,
        uniforms: {
          uHaze: { value: new THREE.Vector3(...haze) },
          uTop: { value: new THREE.Vector3(...haze).multiplyScalar(0.25) },
        },
      }),
    );
    scene.add(sky);

    const traceGeo = buildTraceGeometry(BOARD.traces, { ring: S * 0.42, inner: 0.55, via: S * 0.24, viaInner: 0.45 }, 0.004, BOARD.squares);
    const traceMat = makeTraceMaterial({
      colA: new THREE.Vector3(...hexToLinear(v.traceA)),
      colB: new THREE.Vector3(...hexToLinear(v.traceB)),
      gain: 0.7,
      fogNear: FOG_NEAR,
      fogFar: FOG_FAR,
    });

    const nLights = LIGHTS.tw.length + LIGHTS.mv.length;
    const lightCol = new THREE.Vector3(...hexToLinear(v.light));
    const sprites = new SpriteField(nLights, new THREE.Vector3(...hexToLinear(v.traceA)), lightCol, {
      fogNear: FOG_NEAR,
      fogFar: FOG_FAR,
      minPx: 1.4,
    });

    // Tile copies around the camera. The camera's offset inside one tile is
    // (travel mod TILE), so frame 600 sits exactly where frame 0 does.
    const tiles = new THREE.Group();
    const XS = 4;
    for (let ty = -1; ty <= 5; ty++) {
      for (let tx = -XS; tx < XS; tx++) {
        const m = new THREE.Mesh(traceGeo, traceMat);
        m.position.set(tx * TILE, 0, -ty * TILE);
        m.renderOrder = 5;
        tiles.add(m);
        const sm = sprites.mesh();
        sm.position.copy(m.position);
        tiles.add(sm);
      }
    }
    scene.add(tiles);

    const tmp: V2 = [0, 0];
    const H0 = 2.5;
    const PITCH = THREE.MathUtils.degToRad(31);

    return {
      scene,
      camera,
      update: (frame, aspect, viewH) => {
        const t = frame / CIRCUIT_FRAMES; // 0..1, frame 600 == frame 0
        // lights
        let i = 0;
        for (const L of LIGHTS.tw) {
          const w = 0.5 + 0.5 * Math.sin(TAU * (L.k * t + L.ph));
          const amp = L.amp * (0.25 + 0.75 * Math.pow(w, 3));
          sprites.set(i++, L.x, L.size * 0.7, -L.y, L.size, amp, L.tone);
        }
        for (const M of LIGHTS.mv) {
          const u = mod(M.s0 + M.m * t, 1);
          const p = M.path.at(u * M.path.length, tmp);
          const fade = M.loop ? 1 : Math.pow(Math.sin(Math.PI * u), 0.6);
          sprites.set(i++, mod(p[0], TILE), M.size * 0.7, -mod(p[1], TILE), M.size, M.amp * fade, M.tone);
        }

        // camera glide (+ whole-cycle sway)
        const travel = mod(N_TILES * TILE * t, TILE);
        const sway = 0.22 * Math.sin(TAU * t) + 0.06 * Math.sin(TAU * 3 * t + 1.1);
        const x = SPINE_X + sway;
        const y = H0 + 0.08 * Math.sin(TAU * 2 * t);
        camera.position.set(x, y, -travel);
        camera.rotation.set(0, 0, 0);
        camera.rotation.order = 'YXZ';
        camera.rotation.y = 0.035 * Math.sin(TAU * t + 0.6);
        camera.rotation.x = -PITCH;
        camera.rotation.z = 0.012 * Math.sin(TAU * 2 * t + 0.3);
        camera.aspect = aspect;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld();
        sky.position.copy(camera.position);
        boardMesh.position.set(camera.position.x, 0, camera.position.z);
        sprites.commit(viewH);
      },
      post: () => ({
        loopFrames: CIRCUIT_FRAMES,
        exposure: EXPOSURE,
        bloomStrength: 1.15,
        bloomRadius: 0.72,
        bloomThreshold: 0.25,
        bloomKnee: 0.4,
        dof: { enabled: true, focusDistance: 4.9, farBlur: 0.018, nearBlur: 0.012, nearScale: 0.8, sharpZone: 0.12 },
        grain: 0.02,
        vignette: 0.55,
      }),
    };
  };

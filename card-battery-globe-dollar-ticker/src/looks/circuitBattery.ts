import {
  BoxGeometry,
  Color,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Vector3,
} from "three";
import { easeInOutSine, lerp, prog } from "../lib/ease";
import { LookFactory } from "../lib/LookCanvas";
import { attr, makeBackground, makeDots, makeSegments } from "../lib/materials";
import { defaultPost } from "../lib/postfx";
import { mulberry32, SEEDS } from "../lib/rand";
import { GLSL_COMMON } from "../lib/shared";

export interface BatteryParams {
  edge: string; // battery neon edge (outer)
  edgeCore: string; // battery neon core
  board: string; // block colour
  blue: string;
  orange: string;
}

const CELL = 0.5; // board grid cell
const N = 150; // cells per side (≈ 20k blocks after gaps)
const BAT_L = 6.4; // battery body length (board-local X)
const BAT_W = 3.0;
const BOARD_YAW = -0.62;

export const circuitBattery: LookFactory<BatteryParams> = ({ shared, params, width, height }) => {
  const opaque = new Scene();
  const overlay = new Scene();
  const camera = new PerspectiveCamera(32, width / height, 0.5, 300);
  const rng = mulberry32(SEEDS.battery);

  opaque.add(
    makeBackground(
      /* glsl */ `
      col = mix(vec3(0.0008, 0.0016, 0.006), vec3(0.002, 0.005, 0.02), smoothstep(0.2, 1.0, vUv.y));
      `,
      {},
      shared,
    ),
  );

  // Everything on the board lives in `board` (rotated by BOARD_YAW).
  const boardOpaque = new Group();
  const boardOverlay = new Group();
  boardOpaque.rotation.y = BOARD_YAW;
  boardOverlay.rotation.y = BOARD_YAW;
  opaque.add(boardOpaque);
  overlay.add(boardOverlay);

  // Battery footprint (board-local), blocks are kept clear of it.
  const inBattery = (x: number, z: number, m = 0.5) =>
    Math.abs(x) < BAT_L / 2 + 0.6 + m && Math.abs(z) < BAT_W / 2 + m;

  // ── Blocks ────────────────────────────────────────────────────────────────
  const blocks: { x: number; z: number; w: number; d: number; h: number }[] = [];
  const occupied = new Uint8Array(N * N);
  // irregular street spacing (3–11 cells)
  const streetCol = new Uint8Array(N);
  const streetRow = new Uint8Array(N);
  const colIdx: number[] = [];
  const rowIdx: number[] = [];
  for (let i = 0; i < N; i += 3 + Math.floor(rng() * 9)) {
    streetCol[i] = 1;
    colIdx.push(i);
  }
  for (let i = 0; i < N; i += 3 + Math.floor(rng() * 9)) {
    streetRow[i] = 1;
    rowIdx.push(i);
  }
  for (let gz = 0; gz < N; gz++) {
    for (let gx = 0; gx < N; gx++) {
      if (occupied[gz * N + gx]) continue;
      const x0 = (gx - N / 2) * CELL;
      const z0 = (gz - N / 2) * CELL;
      if (inBattery(x0, z0)) continue;
      // streets every few cells keep room for traces
      if (streetCol[gx] || streetRow[gz]) continue;
      if (rng() < 0.12) continue;
      // merge 1–3 cells
      const sx = rng() < 0.3 ? 2 : 1;
      const sz = rng() < 0.25 ? 2 : 1;
      let ok = true;
      for (let j = 0; j < sz && ok; j++)
        for (let i = 0; i < sx && ok; i++) {
          const ix = gx + i;
          const iz = gz + j;
          if (ix >= N || iz >= N || occupied[iz * N + ix] || streetCol[ix] || streetRow[iz]) ok = false;
        }
      const bx = ok ? sx : 1;
      const bz = ok ? sz : 1;
      for (let j = 0; j < bz; j++) for (let i = 0; i < bx; i++) occupied[(gz + j) * N + gx + i] = 1;
      const h = 0.04 + Math.pow(rng(), 3) * 0.32;
      blocks.push({
        x: x0 + (bx * CELL) / 2,
        z: z0 + (bz * CELL) / 2,
        w: bx * CELL - 0.08 - rng() * 0.06,
        d: bz * CELL - 0.08 - rng() * 0.06,
        h,
      });
    }
  }
  const boxGeo = new BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const blockMat = new ShaderMaterial({
    uniforms: { ...shared, uBoard: { value: new Color(params.board) }, uReveal: { value: 0 }, uRim: { value: new Color(params.blue) } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      varying vec3 vN;
      varying vec3 vLocal;
      varying vec3 vWorld;
      varying float vSeed;
      void main() {
        vLocal = position;
        vN = normal;
        vSeed = aSeed;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      ${GLSL_COMMON}
      uniform vec3 uBoard;
      uniform vec3 uRim;
      uniform float uReveal;
      varying vec3 vN;
      varying vec3 vLocal;
      varying vec3 vWorld;
      varying float vSeed;
      void main() {
        float top = step(0.5, vN.y);
        float side = 1.0 - top;
        vec3 c = uBoard * (0.35 + 0.45 * top + 0.15 * max(vN.x, 0.0));
        // faint lit top edge
        vec2 e = abs(vLocal.xz) * 2.0;
        float edge = top * smoothstep(0.86, 0.99, max(e.x, e.y));
        float rev = smoothstep(uReveal, uReveal - 3.0, length(vWorld.xz));
        c += uRim * edge * (0.004 + 0.02 * vSeed * vSeed) * rev;
        // side faces pick up a little blue from the lit streets
        c += uRim * side * 0.003 * (1.0 - vLocal.y) * rev;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const inst = new InstancedMesh(boxGeo, blockMat, blocks.length);
  const m4 = new Matrix4();
  const seeds = new Float32Array(blocks.length);
  blocks.forEach((b, i) => {
    m4.makeScale(b.w, b.h, b.d).setPosition(b.x, 0, b.z);
    inst.setMatrixAt(i, m4);
    seeds[i] = rng();
  });
  boxGeo.setAttribute("aSeed", new InstancedBufferAttribute(seeds, 1));
  inst.frustumCulled = false;
  boardOpaque.add(inst);
  // ground
  const ground = new InstancedMesh(boxGeo, blockMat, 1);
  ground.setMatrixAt(0, m4.makeScale(N * CELL * 1.2, 0.001, N * CELL * 1.2).setPosition(0, -0.002, 0));
  ground.frustumCulled = false;
  boardOpaque.add(ground);

  // ── Traces: Manhattan walks along the streets, running toward the battery ─
  const segA: number[] = [];
  const segB: number[] = [];
  const segS: number[] = [];
  const segP: number[] = []; // pathLen, colourKind, phase, speed
  const streetX = (i: number) => (colIdx[i] - N / 2) * CELL + CELL / 2;
  const streetZ = (j: number) => (rowIdx[j] - N / 2) * CELL + CELL / 2;
  const nSx = colIdx.length - 1;
  const nSz = rowIdx.length - 1;
  const kindOf = () => {
    const r = rng();
    return r < 0.66 ? 0 : r < 0.9 ? 1 : 2; // blue, orange, white
  };
  // Long street traces
  for (let p = 0; p < 900; p++) {
    let ix = Math.floor(rng() * (nSx + 1));
    let jz = Math.floor(rng() * (nSz + 1));
    let x = streetX(ix);
    let z = streetZ(jz);
    const pts: [number, number][] = [[x, z]];
    const steps = 2 + Math.floor(rng() * 5);
    for (let s = 0; s < steps; s++) {
      // step toward the battery with some randomness
      const towardX = Math.sign(-x) || 1;
      const towardZ = Math.sign(-z) || 1;
      if (rng() < 0.5) {
        ix += rng() < 0.75 ? towardX : -towardX;
        ix = Math.max(0, Math.min(nSx, ix));
        x = streetX(ix);
      } else {
        jz += rng() < 0.75 ? towardZ : -towardZ;
        jz = Math.max(0, Math.min(nSz, jz));
        z = streetZ(jz);
      }
      pts.push([x, z]);
    }
    // offset inside the street so parallel traces don't overlap
    const off = (rng() - 0.5) * CELL * 0.7;
    const kind = kindOf();
    const phase = rng() * 50;
    const speed = 2.5 + rng() * 4;
    let L = 0;
    const startIdx = segP.length;
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, az] = pts[i];
      const [bx, bz] = pts[i + 1];
      const l = Math.hypot(bx - ax, bz - az);
      if (l < 1e-3) continue;
      const horiz = Math.abs(bz - az) < 1e-3;
      const ox = horiz ? 0 : off;
      const oz = horiz ? off : 0;
      segA.push(ax + ox, 0.015, az + oz);
      segB.push(bx + ox, 0.015, bz + oz);
      segS.push(L, L + l);
      L += l;
      segP.push(0, kind, phase, speed);
    }
    for (let i = startIdx; i < segP.length; i += 4) segP[i] = L;
  }
  // Short traces across block tops (pins / stubs) — dense small detail that blinks
  for (let p = 0; p < 5200; p++) {
    const blk = blocks[Math.floor(rng() * blocks.length)];
    if (blk.w < 0.3 && blk.d < 0.3) continue;
    const horiz = blk.w >= blk.d ? rng() < 0.8 : rng() < 0.2;
    const y = blk.h + 0.006;
    const t0 = (rng() - 0.5) * 0.7;
    if (horiz) {
      const z = blk.z + t0 * blk.d;
      const l = blk.w * (0.3 + rng() * 0.6);
      const x0 = blk.x - blk.w * 0.45 + rng() * (blk.w * 0.9 - l);
      segA.push(x0, y, z);
      segB.push(x0 + l, y, z);
      segS.push(0, l);
    } else {
      const x = blk.x + t0 * blk.w;
      const l = blk.d * (0.3 + rng() * 0.6);
      const z0 = blk.z - blk.d * 0.45 + rng() * (blk.d * 0.9 - l);
      segA.push(x, y, z0);
      segB.push(x, y, z0 + l);
      segS.push(0, l);
    }
    segP.push(0, kindOf(), rng() * 50, -(0.5 + rng() * 1.5));
  }
  const traces = makeSegments({
    count: segA.length / 3,
    attrs: { iA: attr(3, segA), iB: attr(3, segB), iS: attr(2, segS), iP: attr(4, segP) },
    shared,
    uniforms: {
      uBlue: { value: new Color(params.blue) },
      uOrange: { value: new Color(params.orange) },
      uReveal: { value: 0 },
    },
    hook: /* glsl */ `
      widthW = 0.035;
      minPx = 0.9;
      vec3 c = iP.y < 0.5 ? uBlue : (iP.y < 1.5 ? uOrange : vec3(0.9, 0.95, 1.0));
      vec3 wa = (modelMatrix * vec4(a, 1.0)).xyz;
      float rev = smoothstep(uReveal, uReveal - 4.0, length(wa.xz));
      col = c;
      alpha = rev;
      data = iP;
    `,
    fragHook: /* glsl */ `
      float L = vData.x;
      float spd = vData.w;
      float base, lit;
      if (spd > 0.0) {
        // long trace: moving light packets running toward the battery (end of path)
        float head = mod(uTime * spd + vData.z * 7.0, L + 6.0) - 3.0;
        float dd = head - vS;
        lit = exp(-max(dd, 0.0) * 1.1) * step(-0.05, dd);
        base = 0.018;
      } else {
        // stub: blinks on/off in steps
        float k = floor(uTime * (-spd) + vData.z);
        lit = step(0.62, hash11(k * 1.37 + vData.z * 13.1));
        base = 0.02;
      }
      inten *= base + lit * 2.2;
    `,
  });
  boardOverlay.add(traces);

  // ── Point lights on block tops (blink) ──────────────────────────────────
  const lp: number[] = [];
  const lk: number[] = [];
  for (let i = 0; i < 9000; i++) {
    const b = blocks[Math.floor(rng() * blocks.length)];
    lp.push(b.x + (rng() - 0.5) * b.w * 0.9, b.h + 0.01, b.z + (rng() - 0.5) * b.d * 0.9);
    lk.push(kindOf(), rng() * 100, 0.4 + rng() * 2.4, rng());
  }
  const lights = makeDots({
    count: lp.length / 3,
    attrs: { iPos: attr(3, lp), iK: attr(4, lk) },
    shared,
    uniforms: {
      uBlue: { value: new Color(params.blue) },
      uOrange: { value: new Color(params.orange) },
      uReveal: { value: 0 },
    },
    hook: /* glsl */ `
      vec3 c = iK.x < 0.5 ? uBlue : (iK.x < 1.5 ? uOrange : vec3(0.85, 0.92, 1.0));
      float k = floor(uTime * iK.z + iK.y);
      float on = step(0.62, hash11(k * 0.731 + iK.y));
      vec3 wp = (modelMatrix * vec4(pos, 1.0)).xyz;
      float rev = smoothstep(uReveal, uReveal - 4.0, length(wp.xz));
      sizeW = 0.045 + iK.w * 0.045;
      col = c * (0.06 + on * 3.2);
      alpha = rev;
    `,
    depthBias: 0.12,
  });
  boardOverlay.add(lights);

  // ── Battery ──────────────────────────────────────────────────────────────
  // Outline polyline (board-local XZ): rounded body + terminal at +X.
  const outline: [number, number][] = [];
  const R = 0.42;
  const hx = BAT_L / 2;
  const hz = BAT_W / 2;
  const arc = (cx: number, cz: number, a0: number, a1: number) => {
    for (let k = 0; k <= 8; k++) {
      const a = a0 + ((a1 - a0) * k) / 8;
      outline.push([cx + Math.cos(a) * R, cz + Math.sin(a) * R]);
    }
  };
  // start at terminal side, go around
  const th = 0.62; // terminal half-height
  const tl = 0.42; // terminal length
  outline.push([hx, -th]);
  outline.push([hx + tl, -th]);
  outline.push([hx + tl, th]);
  outline.push([hx, th]);
  outline.push([hx, hz - R]);
  arc(hx - R, hz - R, 0, Math.PI / 2);
  outline.push([-hx + R, hz]);
  arc(-hx + R, hz - R, Math.PI / 2, Math.PI);
  outline.push([-hx, -hz + R]);
  arc(-hx + R, -hz + R, Math.PI, Math.PI * 1.5);
  outline.push([hx - R, -hz]);
  arc(hx - R, -hz + R, Math.PI * 1.5, Math.PI * 2);
  outline.push([hx, -th]);
  // Bolt (board-local), pointing along X like the battery
  // classic bolt in icon coords (u right, v up), upright inside the horizontal battery
  const boltIcon: [number, number][] = [
    [0.18, 1.0],
    [-0.5, -0.12],
    [-0.04, -0.12],
    [-0.2, -1.0],
    [0.5, 0.14],
    [0.04, 0.14],
    [0.18, 1.0],
  ];
  const boltPts = boltIcon.map(([u, v]) => [u * 1.25, -v * 1.2] as [number, number]);
  const poly = (pts: [number, number][], y: number) => {
    const a: number[] = [];
    const b: number[] = [];
    const s: number[] = [];
    let L = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      a.push(pts[i][0], y, pts[i][1]);
      b.push(pts[i + 1][0], y, pts[i + 1][1]);
      s.push(L, L + l);
      L += l;
    }
    return { a, b, s, L };
  };
  const ol = poly(outline, 0.05);
  const bl = poly(boltPts, 0.06);
  const mkOutline = (width: number, color: Color, k: number, total: number, p: typeof ol, name: string) => {
    const seg = makeSegments({
      count: p.a.length / 3,
      attrs: { iA: attr(3, p.a), iB: attr(3, p.b), iS: attr(2, p.s) },
      shared,
      capB: true,
      uniforms: { uDraw: { value: 0 }, uC: { value: color }, uK: { value: k }, uTotal: { value: total }, uPulse: { value: 1 } },
      hook: `widthW = ${width.toFixed(3)}; col = uC * uK * uPulse; minPx = 1.2;`,
      fragHook: /* glsl */ `
        float g = uDraw * uTotal;
        if (vS > g) inten = 0.0;
        inten *= 1.0 + 2.5 * exp(-max(g - vS, 0.0) * 1.5) * step(uDraw, 0.999);
      `,
    });
    seg.name = name;
    boardOverlay.add(seg);
    return seg;
  };
  const edge = new Color(params.edge);
  const core = new Color(params.edgeCore);
  const outGlow = mkOutline(0.34, edge, 0.55, ol.L, ol, "battery");
  const outEdge = mkOutline(0.13, edge, 2.2, ol.L, ol, "battery");
  const outCore = mkOutline(0.045, core, 3.2, ol.L, ol, "battery");
  const boltGlow = mkOutline(0.24, edge, 0.8, bl.L, bl, "battery");
  const boltCore = mkOutline(0.06, core, 3.6, bl.L, bl, "battery");
  // fill pattern: faint dot grid inside the body
  const fp: number[] = [];
  const fk: number[] = [];
  for (let x = -hx + 0.35; x <= hx - 0.3; x += 0.16)
    for (let z = -hz + 0.3; z <= hz - 0.28; z += 0.16) {
      fp.push(x, 0.04, z);
      fk.push(rng(), rng());
    }
  const fill = makeDots({
    count: fp.length / 3,
    attrs: { iPos: attr(3, fp), iK: attr(2, fk) },
    shared,
    square: true,
    uniforms: { uC: { value: edge }, uFill: { value: 0 } },
    hook: /* glsl */ `
      sizeW = 0.055;
      float tw = 0.5 + 0.5 * sin(uTime * (1.0 + iK.y * 2.0) + iK.x * 40.0);
      col = uC * (0.18 + 0.32 * tw * step(0.35, iK.x));
      alpha = smoothstep(pos.x - 0.6, pos.x + 0.6, mix(-4.2, 4.2, uFill));
    `,
  });
  fill.name = "battery";
  boardOverlay.add(fill);

  // ── Post / DoF ───────────────────────────────────────────────────────────
  const post = defaultPost();
  post.opaqueDof = true;
  post.bloomStrength = 0.95;
  post.bloomThreshold = 0.5;
  post.bloomRadius = 0.7;
  post.exposure = 1.0;
  post.vignette = 0.35;
  shared.uAperture.value = 0.16;
  shared.uMaxCoc.value = 0.03;
  shared.uNearMul.value = 1.3;
  shared.uFocusRange.value = 0.4;

  const target = new Vector3(0, 0, 0);
  const U = (m: { material: unknown }) => (m.material as ShaderMaterial).uniforms;
  const outlines = [outGlow, outEdge, outCore];
  const bolts = [boltGlow, boltCore];

  const update = (frame: number) => {
    const t = frame / 30;
    // camera: ~40° above, slow diagonal drift
    const drift = t / 20;
    const el = (40 * Math.PI) / 180 + Math.sin(drift * Math.PI) * 0.03;
    const az = 0.42 - drift * 0.12;
    const dist = 19 - drift * 1.4;
    // battery sits right of / above centre, as in the reference framing
    target.set(-3.6 + drift * 1.2, 0, 2.6 - drift * 0.6);
    camera.position.set(
      target.x + dist * Math.cos(el) * Math.sin(az),
      dist * Math.sin(el),
      target.z + dist * Math.cos(el) * Math.cos(az),
    );
    camera.lookAt(target);
    camera.updateMatrixWorld();
    shared.uFocus.value = camera.position.length();

    // build-in: 0–1.5 s black; 1.5–4 s lights come on outward, outline draws on
    const rev = lerp(0, 60, Math.pow(prog(t, 1.5, 4.0), 1.6));
    U(traces).uReveal.value = rev;
    U(lights).uReveal.value = rev;
    U(inst).uReveal.value = rev;
    const draw = easeInOutSine(prog(t, 1.5, 3.6));
    const pulse = 1 + 0.12 * Math.sin(t * 3.1) * prog(t, 4, 5);
    outlines.forEach((o) => {
      U(o).uDraw.value = draw;
    });
    const boltDraw = easeInOutSine(prog(t, 2.6, 3.9));
    const boltPulse = 1 + 0.35 * Math.pow(0.5 + 0.5 * Math.sin(t * 4.2), 3) * prog(t, 4, 4.5);
    bolts.forEach((o) => {
      U(o).uDraw.value = boltDraw;
      U(o).uPulse.value = boltPulse;
    });
    outlines.forEach((o) => {
      U(o).uPulse.value = pulse;
    });
    U(fill).uFill.value = prog(t, 2.8, 4.0);
  };

  return { opaque, overlay, camera, post, update };
};

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { Look, LookOptions } from "../lib/LookCanvas";
import { Post } from "../lib/post";
import { buildRibbonGeometry, ribbonMaterial, RibbonLine } from "../lib/ribbon";
import { Dots, worldPointScale } from "../lib/points";
import { chargeField, flat, PathSampler, resample, traceLine, V3 } from "../lib/fieldlines";
import { mulberry32 } from "../lib/rng";
import { loopPhase, TAU } from "../lib/loop";
import { glyphTexture } from "../lib/glyph";

export interface MagnetParams {
  /** true: magnet 1 S faces magnet 2 N (attract). false: N faces N (repel). */
  attract: boolean;
}

const LEN = 2.0, SIZE = 0.4;
const CENTER = 1.85; // magnet centres at x = -CENTER, +CENTER (gap 1.7)
const H = SIZE / 2; // field plane: mid-height of the magnets
const LINE_Y = 0.004; // lines are drawn lying on the table, like iron filings
const SEEDS = 16;
const RED = new THREE.Color("#E8202A"), BLUE = new THREE.Color("#2A3AE8");
const YAW = 0.72; // magnets lie diagonally in frame

interface Magnet { cx: number; nDir: 1 | -1 } // nDir: +1 if N is at the +x end

const magnetsFor = (p: MagnetParams): Magnet[] =>
  p.attract
    ? [{ cx: -CENTER, nDir: -1 }, { cx: CENTER, nDir: -1 }] // m1: N left, S right; m2: N left (faces m1's S)
    : [{ cx: -CENTER, nDir: 1 }, { cx: CENTER, nDir: -1 }]; // m1 flipped: N right, faces m2's N

/**
 * Each magnet = two magnetic charges at its pole faces (+ at N, - at S).
 * Each face charge is spread across the face width (FACE_N sub-charges), so
 * facing poles give the near-parallel gap field of flat faces, not a point fan.
 */
const FACE_N = 7;
const polesFor = (ms: Magnet[]) =>
  ms.flatMap((m) => [1, -1].flatMap((q) =>
    Array.from({ length: FACE_N }, (_, k) => ({
      p: [m.cx + (q * m.nDir * LEN) / 2, H, ((k / (FACE_N - 1)) * 2 - 1) * (SIZE / 2) * 0.85] as V3,
      q: q / FACE_N,
    }))));
/** pole face centres, for seeding and stopping */
const facesFor = (ms: Magnet[]) =>
  ms.flatMap((m) => [1, -1].map((q) => ({ p: [m.cx + (q * m.nDir * LEN) / 2, H, 0] as V3, q })));

const insideMagnet = (ms: Magnet[], x: number, z: number, pad = 0) =>
  ms.some((m) => Math.abs(x - m.cx) < LEN / 2 + pad && Math.abs(z) < SIZE / 2 + pad);

export const createMagnets = (p: MagnetParams) => (gl: THREE.WebGLRenderer, w: number, h: number, opts: LookOptions = {}): Look => {
  const res = new THREE.Vector2(w, h);
  const pxScale = h / 2160;
  gl.shadowMap.enabled = true;
  gl.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#F2F2F2");
  const pmrem = new THREE.PMREMGenerator(gl);
  const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.35;

  const FOV = 34;
  const cam = new THREE.PerspectiveCamera(FOV, w / h, 0.1, 100);
  const elev = (40 * Math.PI) / 180, dist = 11.6;
  const placeCam = (az: number, el: number) => {
    if (opts.topDown) {
      cam.position.set(0, 17, 0.0001);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      return;
    }
    cam.position.set(Math.sin(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.cos(az) * Math.cos(el) * dist);
    cam.lookAt(0, 0.1, 0);
    cam.updateMatrixWorld();
  };
  placeCam(0, elev);

  const world = new THREE.Group();
  world.rotation.y = opts.topDown ? 0 : YAW;
  scene.add(world);
  world.updateMatrixWorld();

  // --- field lines (static; computed once) ---
  const ms = magnetsFor(p);
  const poles = polesFor(ms);
  const field = chargeField(poles);
  const ndc = new THREE.Vector3();
  const offFrame = (q: V3) => {
    ndc.set(q[0], LINE_Y, q[2]).applyMatrix4(world.matrixWorld).project(cam);
    return Math.abs(ndc.x) > 1.12 || Math.abs(ndc.y) > 1.15;
  };
  // The diagram is bounded to an oval around the magnets (as in a textbook
  // figure); lines that leave it end there and fade out, rather than running
  // off every edge of the frame.
  const RX = 6.6, RZ = 3.9;
  const outside = (q: V3) => (q[0] / RX) ** 2 + (q[2] / RZ) ** 2 > 1 || offFrame(q);
  const faces = facesFor(ms);
  const step = (q: V3) => {
    const d = Math.min(...poles.map((c) => Math.hypot(q[0] - c.p[0], q[2] - c.p[2])));
    return Math.min(0.03, Math.max(0.003, d * 0.06));
  };
  // reached a pole face: within a thin slab in front of / inside the face
  const nearPole = (q: V3, sign: number) =>
    faces.some((c) => c.q === sign && Math.abs(q[0] - c.p[0]) < 0.03 && Math.abs(q[2]) < SIZE / 2 + 0.02);
  const lines: V3[][] = [];
  const RS = 0.06;
  // In the table plane through the poles, the field of the four charges has
  // no vertical component, so 2D tracing in that plane is exact.
  // Seeds on a thin ellipse around each face, placed at equal steps of
  // magnetic flux through the ellipse (Gauss): each line carries the same
  // flux, so line density follows field strength, as in a textbook diagram.
  const ell = (c: V3, th: number): V3 => [c[0] + Math.cos(th) * RS, H, Math.sin(th) * (SIZE / 2 + RS)];
  const seedCache = new Map<V3, V3[]>();
  const seedsFor = (c: V3, sign: number) => {
    const M = 1440;
    const w = new Float64Array(M);
    for (let k = 0; k < M; k++) {
      const th = (TAU * (k + 0.5)) / M;
      const p = ell(c, th);
      // outward normal of the ellipse (a = RS, b = SIZE/2 + RS) times arc length
      const a = RS, b = SIZE / 2 + RS;
      const nx = Math.cos(th) / a, nz = Math.sin(th) / b, nl = Math.hypot(nx, nz);
      const ds = Math.hypot(a * Math.sin(th), b * Math.cos(th)) * (TAU / M);
      const B = field(p);
      w[k] = Math.max(0, sign * (B[0] * nx + B[2] * nz) / nl) * ds;
    }
    const total = w.reduce((x, y) => x + y, 0);
    const out: V3[] = [];
    let acc = 0, k = 0;
    for (let i = 0; i < SEEDS; i++) {
      const target = ((i + 0.5) / SEEDS) * total;
      while (k < M - 1 && acc + w[k] < target) { acc += w[k]; k++; }
      const frac = w[k] > 0 ? (target - acc) / w[k] : 0.5;
      out.push(ell(c, (TAU * (k + frac)) / M));
    }
    return out;
  };
  const seed = (c: V3, i: number, sign = 1): V3 => {
    if (!seedCache.has(c)) seedCache.set(c, seedsFor(c, sign));
    return seedCache.get(c)![i];
  };
  for (const pole of faces.filter((c) => c.q > 0)) {
    for (let i = 0; i < SEEDS; i++) {
      const s = seed(pole.p, i);
      const pts = traceLine(field, s, { dir: 1, step, stop: (q) => nearPole(q, -1) || outside(q), maxSteps: 8000 });
      lines.push(pts);
    }
  }
  // lines that come in from infinity and end on S poles
  for (const pole of faces.filter((c) => c.q < 0)) {
    for (let i = 0; i < SEEDS; i++) {
      const s = seed(pole.p, i, -1);
      let reachedN = false;
      const pts = traceLine(field, s, {
        dir: -1, step, maxSteps: 8000,
        stop: (q) => { if (nearPole(q, 1)) { reachedN = true; return true; } return outside(q); },
      });
      if (!reachedN) lines.push(pts.reverse()); // stored in N->S (field) direction
    }
  }
  const drawn = lines.map((l) => resample(l.map(([x, , z]) => [x, LINE_Y, z] as V3), 0.01));
  // open ends (not on a pole) fade out over FADE_LEN
  const FADE_LEN = 0.35;
  const onPole = (q: V3) => faces.some((c) => Math.abs(q[0] - c.p[0]) < 0.08 && Math.abs(q[2]) < SIZE / 2 + 0.1);
  const ends = drawn.map((l) => {
    const smp = new PathSampler(l);
    const openA = !onPole(l[0]), openB = !onPole(l[l.length - 1]);
    const fadeAt = (s: number) =>
      Math.min(openA ? Math.min(1, s / FADE_LEN) : 1, openB ? Math.min(1, (smp.length - s) / FADE_LEN) : 1);
    return { smp, fadeAt };
  });

  const lineCol = new THREE.Color("#2A2A2A");
  const geo = buildRibbonGeometry(drawn.map((l, i) => ({
    p: flat(l), color: [lineCol.r, lineCol.g, lineCol.b],
    alpha: Float32Array.from(ends[i].smp.cum, (s) => ends[i].fadeAt(s)),
  }) as RibbonLine));
  const lineMesh = new THREE.Mesh(geo, ribbonMaterial({ width4k: 6, pxScale, res, mode: "solid", opacity: 1 }));
  lineMesh.frustumCulled = false;
  lineMesh.renderOrder = 2;
  world.add(lineMesh);

  // arrowheads every so often, pointing along B (N -> S), outside the magnets
  const arrowPos: number[] = [];
  const A = 0.075;
  drawn.forEach((l) => {
    const smp = new PathSampler(l);
    for (let s = 0.55; s < smp.length - 0.3; s += 1.1) {
      const a = smp.at(s), b = smp.at(s + 0.02);
      if (insideMagnet(ms, a[0], a[2], 0.15) || offFrame(a) || smp.length - s < FADE_LEN) continue;
      const dx = b[0] - a[0], dz = b[2] - a[2], m = Math.hypot(dx, dz) || 1;
      const ux = dx / m, uz = dz / m, nx = -uz, nz = ux;
      const tip = [a[0] + ux * A, LINE_Y + 0.001, a[2] + uz * A];
      const l1 = [a[0] - ux * A * 0.6 + nx * A * 0.6, LINE_Y + 0.001, a[2] - uz * A * 0.6 + nz * A * 0.6];
      const r1 = [a[0] - ux * A * 0.6 - nx * A * 0.6, LINE_Y + 0.001, a[2] - uz * A * 0.6 - nz * A * 0.6];
      arrowPos.push(...tip, ...l1, ...r1);
    }
  });
  const arrowGeo = new THREE.BufferGeometry();
  arrowGeo.setAttribute("position", new THREE.Float32BufferAttribute(arrowPos, 3));
  const arrows = new THREE.Mesh(arrowGeo, new THREE.MeshBasicMaterial({ color: lineCol, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  arrows.renderOrder = 3;
  world.add(arrows);

  // --- magnets ---
  const boxGeo = new RoundedBoxGeometry(LEN, SIZE, SIZE, 4, 0.025);
  // Hard paint split at the middle of the bar (+x half red N, -x half blue S).
  const paint = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.0 });
  paint.onBeforeCompile = (sh) => {
    sh.uniforms.cN = { value: RED };
    sh.uniforms.cS = { value: BLUE };
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nvarying float vLocalX;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvLocalX = position.x;");
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vLocalX;\nuniform vec3 cN;\nuniform vec3 cS;")
      .replace("#include <color_fragment>",
        "float aaX = max(fwidth(vLocalX), 1e-4);\ndiffuseColor.rgb = mix(cS, cN, smoothstep(-aaX, aaX, vLocalX));");
  };
  const glyphN = glyphTexture("N"), glyphS = glyphTexture("S");
  const letterMat = (tex: THREE.Texture, base: THREE.Color) =>
    new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.55), map: tex, transparent: true, roughness: 0.5,
      bumpMap: tex, bumpScale: 2, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const matN = letterMat(glyphN, RED), matS = letterMat(glyphS, BLUE);
  const letterGeo = new THREE.PlaneGeometry(0.36, 0.36);
  for (const m of ms) {
    const g = new THREE.Group();
    g.position.set(m.cx, H, 0);
    g.rotation.y = m.nDir === 1 ? 0 : Math.PI;
    const box = new THREE.Mesh(boxGeo, paint);
    box.castShadow = true;
    g.add(box);
    for (const [x, mat] of [[0.68, matN], [-0.68, matS]] as const) {
      const top = new THREE.Mesh(letterGeo, mat);
      top.position.set(x, SIZE / 2 + 0.001, 0);
      top.rotation.x = -Math.PI / 2;
      top.rotation.z = Math.PI / 2 * 0; // upright when read along the bar
      g.add(top);
      for (const sz of [1, -1]) {
        const side = new THREE.Mesh(letterGeo, mat);
        side.position.set(x, 0, sz * (SIZE / 2 + 0.001));
        side.rotation.y = sz > 0 ? 0 : Math.PI;
        g.add(side);
      }
    }
    world.add(g);
  }

  // --- table, light, shadows ---
  const shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.5 }));
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.receiveShadow = true;
  scene.add(shadowPlane);
  // contact shadow (soft occlusion right under each bar)
  const cc = document.createElement("canvas");
  cc.width = 256; cc.height = 128;
  const cg = cc.getContext("2d")!;
  cg.filter = "blur(14px)";
  cg.fillStyle = "rgba(0,0,0,1)";
  cg.fillRect(40, 38, 176, 52);
  const contactTex = new THREE.CanvasTexture(cc);
  for (const m of ms) {
    const cs = new THREE.Mesh(new THREE.PlaneGeometry(LEN * 1.45, SIZE * 2.4),
      new THREE.MeshBasicMaterial({ map: contactTex, transparent: true, opacity: 0.6, depthWrite: false, color: 0x000000 }));
    cs.rotation.x = -Math.PI / 2;
    cs.position.set(m.cx, 0.001, 0);
    cs.renderOrder = 1;
    world.add(cs);
  }
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-3, 9, 4);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -5; sun.shadow.camera.right = 5; sun.shadow.camera.top = 5; sun.shadow.camera.bottom = -5;
  sun.shadow.radius = 16;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xffffff, 0xbbbbbb, 0.55));

  // --- dots flowing N -> S, speed ~ sqrt(|B|), whole trips per loop ---
  const flow = drawn.map((l, li) => {
    const smp = new PathSampler(l);
    // travel-time table: dt = ds / v(s)
    const n = 200;
    const tau = new Float64Array(n + 1);
    for (let i = 1; i <= n; i++) {
      const s = (smp.length * (i - 0.5)) / n;
      const q = smp.at(s);
      const b = field([q[0], H, q[2]]);
      const v = Math.min(3, Math.max(0.35, Math.sqrt(Math.hypot(b[0], b[2])) * 0.9));
      tau[i] = tau[i - 1] + smp.length / n / v;
    }
    // visible (outside magnets) length decides how many dots it gets
    let vis = 0;
    for (let i = 0; i < n; i++) { const q = smp.at((smp.length * (i + 0.5)) / n); if (!insideMagnet(ms, q[0], q[2])) vis += smp.length / n; }
    return { smp, tau, vis, li };
  });
  const N_DOTS = 120;
  const totalVis = flow.reduce((a, f) => a + f.vis, 0);
  const rnd = mulberry32(2435);
  const dotsSpec: { f: (typeof flow)[number]; phase: number; trips: number }[] = [];
  flow.forEach((f) => {
    const k = Math.round((f.vis / totalVis) * N_DOTS);
    for (let j = 0; j < k; j++) dotsSpec.push({ f, phase: (j + rnd() * 0.3) / Math.max(k, 1), trips: 1 });
  });
  const DOT_R = 0.042;
  const dots = new Dots({ count: dotsSpec.length, pxScale, mode: 2, worldSize: DOT_R * 2, depthWrite: true });
  (dots.points.material as THREE.ShaderMaterial).uniforms.worldScale.value = DOT_R * 2 * worldPointScale(h, FOV) / (DOT_R * 2);
  dotsSpec.forEach((_, i) => { dots.rgba.set([0.02, 0.02, 0.02, 1], i * 4); dots.size[i] = DOT_R * 2; });
  dots.points.renderOrder = 4;
  world.add(dots.points);

  const post = new Post(gl, w, h, {
    bloom: { strength: 0.0, threshold: 2, knee: 0.1, levels: 3 },
    grain: 0.01, shoulder: 0.97,
    vignette: { amount: 0.12, start: 0.55, end: 1.5 },
  });

  const tmp: V3 = [0, 0, 0];
  return {
    render(frame) {
      const t = loopPhase(frame);
      dotsSpec.forEach((d, i) => {
        const { tau, smp } = d.f;
        const n = tau.length - 1;
        const target = ((t * d.trips + d.phase) % 1) * tau[n];
        let lo = 0, hi = n;
        while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tau[mid] <= target) lo = mid; else hi = mid; }
        const u = (lo + (target - tau[lo]) / Math.max(tau[hi] - tau[lo], 1e-9)) / n;
        smp.at(u * smp.length, tmp);
        dots.pos.set([tmp[0], DOT_R, tmp[2]], i * 3);
        // hidden while passing under a magnet (avoids sprites poking through the bar)
        dots.rgba[i * 4 + 3] = insideMagnet(ms, tmp[0], tmp[2], DOT_R) ? 0 : ends[d.f.li].fadeAt(u * smp.length);
      });
      dots.update();
      // very slight closed drift
      placeCam(0.012 * Math.sin(TAU * t), elev + 0.006 * Math.sin(TAU * t * 2 + 1));
      post.render(scene, cam, frame);
    },
    dispose() {
      post.dispose();
      geo.dispose();
      dots.dispose();
      envRT.dispose();
      pmrem.dispose();
    },
  };
};

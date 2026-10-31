import * as THREE from "three";
import { Billboard, Line } from "../engine/layers";
import { clamp, createRng, lerp, Rng } from "../engine/random";
import { NetworkPalette, RGB } from "./palette";
import { KIND } from "./shapes";

export const FPS = 30;
export const DURATION_FRAMES = 650; // 21.6667 s – identical to the reference
const DURATION = DURATION_FRAMES / FPS;

type V3 = [number, number, number];

const v = (x: THREE.Vector3): V3 => [x.x, x.y, x.z];
const col = (c: RGB, i: number): [number, number, number, number] => [
  c[0],
  c[1],
  c[2],
  i,
];
const sq = (s: number): [number, number] => [s, s];
const mix3 = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

export type CameraFrame = {
  pos: THREE.Vector3;
  quat: THREE.Quaternion;
  focus: number;
};

export type NetworkScene = {
  billboards: Billboard[];
  lines: Line[];
  camera: CameraFrame[];
  fov: number;
};

const HUB_COUNT = 15;
// Time (s) at which the camera passes each hub. First close pass ~2 s like the
// reference, last one ~20.4 s, after which the camera drifts into empty space.
const FIRST_PASS = 2.35;
const LAST_PASS = 20.72;

const gaussianSmooth = (arr: number[], sigma: number) => {
  const r = Math.ceil(sigma * 3);
  const out: number[] = [];
  for (let i = 0; i < arr.length; i++) {
    let s = 0;
    let w = 0;
    for (let k = -r; k <= r; k++) {
      const j = clamp(i + k, 0, arr.length - 1);
      const g = Math.exp(-(k * k) / (2 * sigma * sigma));
      s += arr[j] * g;
      w += g;
    }
    out.push(s / w);
  }
  return out;
};

const smoothVecs = (vs: THREE.Vector3[], sigma: number) => {
  const xs = gaussianSmooth(
    vs.map((p) => p.x),
    sigma,
  );
  const ys = gaussianSmooth(
    vs.map((p) => p.y),
    sigma,
  );
  const zs = gaussianSmooth(
    vs.map((p) => p.z),
    sigma,
  );
  return vs.map((_, i) => new THREE.Vector3(xs[i], ys[i], zs[i]));
};

const perpBasis = (dir: THREE.Vector3) => {
  const up =
    Math.abs(dir.y) > 0.9
      ? new THREE.Vector3(1, 0, 0)
      : new THREE.Vector3(0, 1, 0);
  const n1 = new THREE.Vector3().crossVectors(dir, up).normalize();
  const n2 = new THREE.Vector3().crossVectors(dir, n1).normalize();
  return [n1, n2] as const;
};

const randomInBall = (rng: Rng, radius: number) => {
  const u = rng.unitVec();
  const r = radius * Math.cbrt(rng.next());
  return new THREE.Vector3(u[0] * r, u[1] * r, u[2] * r);
};

export const buildNetworkScene = (
  palette: NetworkPalette,
  seed = 7,
): NetworkScene => {
  const rng = createRng(seed);
  const billboards: Billboard[] = [];
  const lines: Line[] = [];

  /* -------------------------------- hubs -------------------------------- */
  const hubs: THREE.Vector3[] = [];
  const dirs: THREE.Vector3[] = [];
  let p = new THREE.Vector3(0, 0, 0);
  let dir = new THREE.Vector3(0.15, 0.05, -1).normalize();
  for (let i = 0; i < HUB_COUNT; i++) {
    hubs.push(p.clone());
    dirs.push(dir.clone());
    const yaw = rng.range(-0.75, 0.75);
    const pitch = rng.range(-0.35, 0.35);
    dir = dir
      .clone()
      .applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw)
      .applyAxisAngle(perpBasis(dir)[0], pitch)
      .normalize();
    dir.y *= 0.7;
    dir.normalize();
    p = p.clone().add(dir.clone().multiplyScalar(rng.range(16, 20)));
  }

  const passTimes = hubs.map(
    (_, i) => FIRST_PASS + ((LAST_PASS - FIRST_PASS) * i) / (HUB_COUNT - 1),
  );
  const appearOf = (i: number) => passTimes[i] - 2.4;

  /* ------------------------------ camera -------------------------------- */
  const camPts: THREE.Vector3[] = [];
  const camTimes: number[] = [];
  const startDir = dirs[0];
  const start = hubs[0]
    .clone()
    .sub(startDir.clone().multiplyScalar(58))
    .add(new THREE.Vector3(1.5, 1.0, 0));
  camPts.push(start);
  camTimes.push(0);
  const camOffsets: THREE.Vector3[] = [];
  hubs.forEach((h, i) => {
    const d = (
      i < HUB_COUNT - 1 ? hubs[i + 1].clone().sub(h) : dirs[i].clone()
    ).normalize();
    const [n1, n2] = perpBasis(d);
    const ang = rng.range(0, Math.PI * 2);
    // alternate close and wider passes, like the reference
    const mag = i % 3 === 0 ? rng.range(2.2, 3.0) : rng.range(3.4, 5.6);
    const off = n1
      .clone()
      .multiplyScalar(Math.cos(ang) * mag)
      .add(n2.clone().multiplyScalar(Math.sin(ang) * mag * 0.7));
    camOffsets.push(off);
    camPts.push(h.clone().add(off));
    camTimes.push(passTimes[i]);
  });
  const lastDir = dirs[HUB_COUNT - 1];
  const endP = hubs[HUB_COUNT - 1]
    .clone()
    .add(lastDir.clone().multiplyScalar(18))
    .add(perpBasis(lastDir)[0].clone().multiplyScalar(6));
  camPts.push(endP);
  camTimes.push(DURATION + 0.4);

  const camCurve = new THREE.CatmullRomCurve3(camPts, false, "centripetal");
  const hubCurvePts = [
    hubs[0].clone().sub(startDir.clone().multiplyScalar(20)),
    ...hubs,
    hubs[HUB_COUNT - 1].clone().add(lastDir.clone().multiplyScalar(30)),
    hubs[HUB_COUNT - 1].clone().add(lastDir.clone().multiplyScalar(60)),
  ];
  const hubCurve = new THREE.CatmullRomCurve3(
    hubCurvePts,
    false,
    "centripetal",
  );
  // index-space helpers
  const camAtIndex = (s: number) =>
    camCurve.getPoint(clamp(s / (camPts.length - 1), 0, 1));
  // hubCurve index 1 == hub 0
  const hubAtIndex = (s: number) =>
    hubCurve.getPoint(clamp((s + 1) / (hubCurvePts.length - 1), 0, 1));

  const timeToIndex = (t: number) => {
    for (let i = 0; i < camTimes.length - 1; i++) {
      if (t <= camTimes[i + 1]) {
        const f = (t - camTimes[i]) / (camTimes[i + 1] - camTimes[i]);
        return i + f;
      }
    }
    return camTimes.length - 1;
  };

  const rawPos: THREE.Vector3[] = [];
  const rawTarget: THREE.Vector3[] = [];
  for (let f = 0; f < DURATION_FRAMES; f++) {
    const t = f / FPS;
    // ease-in rush at the start (camera index 0 -> 1 is the long approach)
    let s = timeToIndex(t);
    if (s < 1) s = 1 - Math.pow(1 - s, 1.15);
    const pos = camAtIndex(s);
    // camera index k corresponds to hub k-1; look ~0.7 hub ahead
    // look slightly past the next hub and off to the side so hubs sit
    // off-centre and drift across frame (often two hubs in view)
    const target = hubAtIndex(s - 1 + 0.9).add(
      new THREE.Vector3(
        Math.sin(t * 0.45 + 0.8) * 3.2,
        Math.cos(t * 0.37) * 1.8,
        Math.sin(t * 0.29 + 2.0) * 2.4,
      ),
    );
    rawPos.push(pos);
    rawTarget.push(target);
  }
  const pos = smoothVecs(rawPos, 2.5);
  const target = smoothVecs(rawTarget, 7);

  const fov = 52;
  const camera: CameraFrame[] = [];
  const focusRaw: number[] = [];
  const tmpCam = new THREE.PerspectiveCamera(fov, 16 / 9, 0.1, 1000);
  for (let f = 0; f < DURATION_FRAMES; f++) {
    const t = f / FPS;
    tmpCam.position.copy(pos[f]);
    tmpCam.up.set(0, 1, 0);
    tmpCam.lookAt(target[f]);
    const roll =
      0.32 * Math.sin(t * 0.33 + 0.6) + 0.12 * Math.sin(t * 0.91 + 2.0) - 0.1;
    tmpCam.rotateZ(roll);
    tmpCam.updateMatrixWorld();
    // focus: depth of the hub nearest the optical axis (weighted)
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(tmpCam.quaternion);
    let best = 0;
    let bestScore = -1;
    hubs.forEach((h) => {
      const rel = h.clone().sub(pos[f]);
      const depth = rel.dot(fwd);
      if (depth < 1.2) return;
      const lat =
        Math.sqrt(Math.max(rel.lengthSq() - depth * depth, 0)) / depth;
      const score = Math.exp(-lat * lat * 6) / (1 + depth * 0.03);
      if (score > bestScore) {
        bestScore = score;
        best = depth;
      }
    });
    focusRaw.push(bestScore > 0.05 ? best : 30);
    camera.push({
      pos: pos[f].clone(),
      quat: tmpCam.quaternion.clone(),
      focus: 0,
    });
  }
  const focus = gaussianSmooth(
    focusRaw.map((x) => Math.log(x)),
    6,
  ).map(Math.exp);
  camera.forEach((c, i) => (c.focus = focus[i]));

  /* -------------------------- hub decorations --------------------------- */
  const P = palette;
  hubs.forEach((h, i) => {
    const ap = appearOf(i);
    // hub flare
    billboards.push({
      pos: v(h),
      size: sq(rng.range(4.6, 5.6)),
      color: col(P.nodeCore, 1.0),
      kind: KIND.flare,
      params: [rng.range(2, 4), rng.range(0, 6), rng.range(0, 6), 0],
      timing: [ap - 0.4, 0.6, 0, 0],
      minPx: 6,
    });
    // sparkle cluster
    const nSpark = rng.int(170, 230);
    for (let k = 0; k < nSpark; k++) {
      const o = new THREE.Vector3(
        rng.gauss(),
        rng.gauss(),
        rng.gauss(),
      ).multiplyScalar(rng.range(0.35, 0.95));
      billboards.push({
        pos: v(h.clone().add(o)),
        size: sq(rng.range(0.035, 0.08)),
        color: col(
          mix3(P.sparkle, P.nodeCore, rng.next() * 0.5),
          rng.range(1.0, 2.2),
        ),
        kind: KIND.sparkle,
        params: [rng.range(3, 9), rng.range(0, 6.28), 0, 0],
        timing: [ap + rng.range(0, 0.8), 0.3, 0, 0],
        minPx: 3,
      });
    }
    // satellites + spokes
    const sats: THREE.Vector3[] = [];
    const nSat = rng.int(14, 22);
    for (let k = 0; k < nSat; k++) {
      const u = rng.unitVec();
      const r = rng.range(1.0, 5.2);
      const sp = h
        .clone()
        .add(new THREE.Vector3(u[0] * r, u[1] * r * 0.8, u[2] * r));
      sats.push(sp);
      const orange = rng.chance(0.32);
      const c = orange ? P.dotB : P.dotA;
      const tA = ap + 0.1 + rng.range(0, 0.6);
      billboards.push({
        pos: v(sp),
        size: sq(rng.range(0.13, 0.21)),
        color: col(c, rng.range(1.6, 2.6)),
        kind: KIND.dot,
        timing: [tA + 0.35, 0.2, 0, 0],
        minPx: 4,
      });
      lines.push({
        a: v(h),
        b: v(sp),
        colorA: col(orange ? P.lineAccent : P.lineAlt, 0.9),
        colorB: col(orange ? P.lineAccent : P.lineMain, 0.75),
        widthPx: rng.range(2.0, 3.0),
        timing: [
          tA,
          0.4,
          rng.chance(0.3) ? rng.range(0.6, 1.4) : 0,
          rng.next(),
        ],
      });
    }
    // web between satellites
    sats.forEach((s, k) => {
      const others = sats
        .map((o, j) => ({ j, d: o.distanceTo(s) }))
        .filter((o) => o.j !== k)
        .sort((x, y) => x.d - y.d)
        .slice(0, rng.int(1, 3));
      others.forEach((o) => {
        if (o.j < k) return;
        const orange = rng.chance(0.4);
        lines.push({
          a: v(s),
          b: v(sats[o.j]),
          colorA: col(orange ? P.lineAccent : P.lineMain, 0.45),
          colorB: col(orange ? P.lineAccent : P.lineAlt, 0.45),
          widthPx: rng.range(1.4, 2.0),
          timing: [ap + 0.5 + rng.range(0, 0.6), 0.5, 0, 0],
        });
      });
    });
    // micro plexus: tiny nodes bridging the satellites
    const nMicro = rng.int(18, 30);
    for (let k = 0; k < nMicro; k++) {
      const mp = h.clone().add(randomInBall(rng, 3.2));
      if (mp.distanceTo(h) < 0.6) continue;
      billboards.push({
        pos: v(mp),
        size: sq(rng.range(0.05, 0.09)),
        color: col(
          rng.chance(0.3) ? P.dotB : mix3(P.dotA, P.sparkle, rng.next()),
          rng.range(1.0, 1.8),
        ),
        kind: KIND.dot,
        timing: [ap + 0.6 + rng.range(0, 0.6), 0.3, 0, 0],
        minPx: 3,
      });
      const nearest = sats
        .map((o, j) => ({ j, d: o.distanceTo(mp) }))
        .sort((x, y) => x.d - y.d)[0];
      if (nearest) {
        lines.push({
          a: v(mp),
          b: v(sats[nearest.j]),
          colorA: col(rng.chance(0.35) ? P.lineAccent : P.lineMain, 0.4),
          colorB: col(P.lineAlt, 0.4),
          widthPx: 1.3,
          timing: [ap + 0.6 + rng.range(0, 0.6), 0.4, 0, 0],
        });
      }
    }
    // HUD ring
    if (i === 0 || rng.chance(0.85)) {
      const sz = rng.range(3.7, 4.7);
      billboards.push({
        pos: v(h),
        size: [sz, sz],
        color: col(P.ring, 1.0),
        kind: KIND.ring,
        params: [
          rng.range(0.25, 0.6) * (rng.chance(0.5) ? 1 : -1),
          rng.next(),
          rng.next(),
          rng.next(),
        ],
        timing: [ap + 0.3, 1.0, 0, 0],
        minPx: 8,
      });
    }
    // data panels
    const nPanels = rng.int(0, 3) + (i % 3 === 0 ? 1 : 0);
    for (let k = 0; k < nPanels; k++) {
      const u = rng.unitVec();
      const off = new THREE.Vector3(u[0], u[1] * 0.6, u[2])
        .normalize()
        .multiplyScalar(rng.range(2.5, 4.4));
      const big = rng.chance(0.62);
      const w = big ? rng.range(2.6, 3.6) : rng.range(1.2, 1.8);
      const hh = big ? rng.range(0.9, 1.3) : rng.range(0.28, 0.45);
      billboards.push({
        pos: v(h.clone().add(off)),
        size: [w, hh],
        color: col(P.panel, big ? 1.35 : 1.5),
        kind: KIND.panel,
        params: [big ? rng.int(3, 6) : rng.int(1, 3), rng.range(0, 50), 0, 0],
        timing: [ap + 0.6 + rng.range(0, 0.5), 0.5, 0, 0],
        minPx: 10,
      });
    }
    // mini bar chart
    if (rng.chance(0.4)) {
      const u = rng.unitVec();
      const off = new THREE.Vector3(u[0], -Math.abs(u[1]) * 0.7, u[2])
        .normalize()
        .multiplyScalar(rng.range(1.6, 2.6));
      billboards.push({
        pos: v(h.clone().add(off)),
        size: [0.95, 0.6],
        color: col(mix3(P.panel, [1, 1, 1], 0.4), 1.2),
        kind: KIND.bars,
        params: [0, rng.range(0, 40), 0, 0],
        timing: [ap + 0.8, 0.6, 0, 0],
        minPx: 8,
      });
    }
    // particle trail toward the next hub
    if (i < HUB_COUNT - 1) {
      const nxt = hubs[i + 1];
      const nTrail = rng.int(40, 70);
      for (let k = 0; k < nTrail; k++) {
        const tt = Math.pow(rng.next(), 2.2) * 0.45;
        const tp = h
          .clone()
          .lerp(nxt, tt)
          .add(
            new THREE.Vector3(
              rng.gauss(),
              rng.gauss(),
              rng.gauss(),
            ).multiplyScalar(0.12 + tt * 0.5),
          );
        billboards.push({
          pos: v(tp),
          size: sq(rng.range(0.03, 0.06)),
          color: col(mix3(P.sparkle, P.dotA, rng.next()), rng.range(0.6, 1.3)),
          kind: KIND.sparkle,
          params: [rng.range(2, 7), rng.range(0, 6.28), 0, 0],
          timing: [ap + 0.3 + tt * 2, 0.3, 0, 0],
          minPx: 3,
        });
      }
    }
  });

  /* --------------------------- inter-hub links -------------------------- */
  hubs.forEach((h, i) => {
    const ap = appearOf(i);
    if (i < HUB_COUNT - 1) {
      lines.push({
        a: v(h),
        b: v(hubs[i + 1]),
        colorA: col(P.lineMain, 1.0),
        colorB: col(P.lineAlt, 0.9),
        widthPx: 3.2,
        timing: [ap - 1.0, 1.4, 0.35, rng.next()],
      });
    }
    if (i < HUB_COUNT - 2 && rng.chance(0.45)) {
      lines.push({
        a: v(h),
        b: v(hubs[i + 2]),
        colorA: col(P.lineAlt, 0.55),
        colorB: col(P.lineMain, 0.5),
        widthPx: 2.4,
        timing: [ap - 1.5, 2.0, 0, 0],
      });
    }
    // long beams to distant nodes (become blurry foreground beams on close passes)
    const nLong = rng.int(3, 5);
    for (let k = 0; k < nLong; k++) {
      const u = rng.unitVec();
      const far = h
        .clone()
        .add(
          new THREE.Vector3(u[0], u[1] * 0.6, u[2]).multiplyScalar(
            rng.range(14, 42),
          ),
        );
      const orange = rng.chance(0.18);
      lines.push({
        a: v(h),
        b: v(far),
        colorA: col(orange ? P.lineAccent : P.lineMain, rng.range(0.6, 1.0)),
        colorB: col(orange ? P.lineAccent : P.lineAlt, 0.35),
        widthPx: rng.range(2.2, 3.6),
        timing: [
          ap - 2.0 + rng.range(0, 0.8),
          1.6,
          rng.chance(0.4) ? rng.range(0.3, 0.8) : 0,
          rng.next(),
        ],
      });
      billboards.push({
        pos: v(far),
        size: [0.22, 0.22],
        color: col(rng.chance(0.5) ? P.nodeHalo : P.dotA, 1.4),
        kind: KIND.dot,
        timing: [ap - 0.4, 0.4, 0, 0],
        minPx: 4,
      });
    }
  });

  /* ------------------------ ambient plexus nodes ------------------------ */
  const minor: THREE.Vector3[] = [];
  const nMinor = 420;
  for (let k = 0; k < nMinor; k++) {
    const u = rng.range(-0.05, 1.0);
    const base = hubCurve.getPoint(clamp(u, 0, 1));
    const o = new THREE.Vector3(
      rng.gauss(),
      rng.gauss() * 0.7,
      rng.gauss(),
    ).multiplyScalar(rng.range(6, 18));
    minor.push(base.add(o));
  }
  minor.forEach((m, k) => {
    billboards.push({
      pos: v(m),
      size: [0.1, 0.1],
      color: col(rng.chance(0.7) ? P.dotA : P.nodeHalo, rng.range(0.6, 1.2)),
      kind: KIND.dot,
      minPx: 3,
    });
    const near = minor
      .map((o, j) => ({ j, d: o.distanceTo(m) }))
      .filter((o) => o.j > k && o.d < 11)
      .sort((a, b) => a.d - b.d)
      .slice(0, rng.int(1, 3));
    near.forEach((o) => {
      lines.push({
        a: v(m),
        b: v(minor[o.j]),
        colorA: col(P.lineMain, 0.32),
        colorB: col(P.lineAlt, 0.28),
        widthPx: 1.6,
      });
    });
  });

  /* -------------------------------- dust -------------------------------- */
  for (let k = 0; k < 5200; k++) {
    const u = rng.range(-0.1, 1.0);
    const base = hubCurve.getPoint(clamp(u, 0, 1));
    const o = new THREE.Vector3(
      rng.gauss(),
      rng.gauss() * 0.8,
      rng.gauss(),
    ).multiplyScalar(rng.range(3, 30));
    billboards.push({
      pos: v(base.add(o)),
      size: sq(rng.range(0.04, 0.09)),
      color: col(rng.chance(0.15) ? P.sparkle : P.dust, rng.range(0.25, 0.65)),
      kind: KIND.dot,
      minPx: 2.5,
    });
  }
  // a few big, out-of-focus floating motes close to the camera path
  for (let k = 0; k < 160; k++) {
    const f = rng.int(0, DURATION_FRAMES);
    const cp = camera[f].pos;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera[f].quat);
    const pp = cp
      .clone()
      .add(fwd.multiplyScalar(rng.range(2, 6)))
      .add(randomInBall(rng, 3));
    billboards.push({
      pos: v(pp),
      size: [0.05, 0.05],
      color: col(P.dust, rng.range(0.4, 0.8)),
      kind: KIND.dot,
      minPx: 3,
    });
  }

  return { billboards, lines, camera, fov };
};

export const BG_SEED = 11;

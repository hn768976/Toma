import * as THREE from "three";
import {
  BB_BARS,
  BB_PANEL,
  BB_RING,
  BB_TEXT,
  Billboard,
  Line,
  SPRITE_DOT,
  SPRITE_GLOW,
  SPRITE_STAR,
  Sprite,
} from "../engine/batches";
import { gauss, mulberry32, range } from "../engine/random";
import { smoothstep } from "../engine/spline";
import { CameraRig, CameraState } from "./camera";
import { Palette } from "./palette";

export type Hub = {
  pos: THREE.Vector3;
  onTour: boolean;
  birth: number;
};

export type NetworkLayout = {
  tour: THREE.Vector3[];
  extra: THREE.Vector3[];
  center: THREE.Vector3;
  radius: number;
};

const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

const randomUnit = (rng: () => number) => {
  const u = rng() * 2 - 1;
  const t = rng() * Math.PI * 2;
  const s = Math.sqrt(1 - u * u);
  return v3(s * Math.cos(t), u, s * Math.sin(t));
};

/**
 * The network is a loose loop of "hub" nodes (the tour the camera flies
 * through) plus a handful of off-path hubs that fill the background.
 */
export const createLayout = (seed: number): NetworkLayout => {
  const rng = mulberry32(seed);
  const tour: THREE.Vector3[] = [];
  const pos = v3(0, 0, 0);
  let yaw = 0;
  let pitch = 0;
  for (let i = 0; i < 11; i++) {
    tour.push(pos.clone());
    yaw += range(rng, 0.4, 0.8) * (i % 4 === 3 ? -0.6 : 1);
    pitch = Math.max(-0.4, Math.min(0.4, pitch + range(rng, -0.35, 0.35)));
    const step = range(rng, 12.5, 15.5);
    pos.add(
      v3(
        Math.sin(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        -Math.cos(yaw) * Math.cos(pitch),
      ).multiplyScalar(step),
    );
  }
  const center = tour
    .reduce((acc, p) => acc.add(p), v3(0, 0, 0))
    .multiplyScalar(1 / tour.length);
  const radius = Math.max(...tour.map((p) => p.distanceTo(center)));

  const extra: THREE.Vector3[] = [];
  let guard = 0;
  while (extra.length < 8 && guard++ < 500) {
    const p = center
      .clone()
      .add(randomUnit(rng).multiplyScalar(range(rng, 0.4, 1.45) * radius));
    p.y = center.y + (p.y - center.y) * 0.6;
    const all = [...tour, ...extra];
    if (all.every((q) => q.distanceTo(p) > 10)) extra.push(p);
  }
  return { tour, extra, center, radius };
};

export type SceneData = {
  sprites: Sprite[];
  lines: Line[];
  billboards: Billboard[];
  pulses: { a: THREE.Vector3; b: THREE.Vector3; phase: number; speed: number; birth: number }[];
};

/** First time the camera gets within `dist` of p (or `fallback`). */
const firstApproach = (
  states: CameraState[],
  fps: number,
  p: THREE.Vector3,
  dist: number,
  fallback: number,
) => {
  for (let f = 0; f < states.length; f++) {
    if (states[f].pos.distanceTo(p) < dist) return f / fps;
  }
  return fallback;
};

export const buildScene = (
  layout: NetworkLayout,
  rig: CameraRig,
  states: CameraState[],
  fps: number,
  palette: Palette,
  seed: number,
): SceneData => {
  const rng = mulberry32(seed);
  const sprites: Sprite[] = [];
  const lines: Line[] = [];
  const billboards: Billboard[] = [];
  const pulses: SceneData["pulses"] = [];

  const hubs: Hub[] = [
    ...layout.tour.map((pos) => ({ pos, onTour: true, birth: 0 })),
    ...layout.extra.map((pos) => ({ pos, onTour: false, birth: 0 })),
  ];
  hubs.forEach((h, i) => {
    if (rig.staggeredReveal) {
      // Wide shot: the network switches on hub by hub.
      h.birth = h.onTour
        ? rig.firstHubBirth + i * 0.38
        : rig.firstHubBirth + 0.9 + (i - layout.tour.length) * 0.5;
      return;
    }
    const t = firstApproach(states, fps, h.pos, rig.revealDistance, -10);
    h.birth = i === 0 ? rig.firstHubBirth : t <= 0.05 ? -10 : t;
  });

  /* ---- hubs ---- */
  hubs.forEach((hub, hi) => {
    const b = hub.birth;
    const sc = hub.onTour ? 1 : 0.85;
    // bright core + soft halo + lens star
    sprites.push({
      pos: hub.pos,
      color: palette.core,
      alpha: 1,
      size: 0.75 * sc,
      minPx: 5,
      kind: SPRITE_GLOW,
    });
    sprites.push({
      pos: hub.pos,
      color: palette.halo,
      alpha: 0.26,
      size: 4.2 * sc,
      minPx: 10,
      kind: SPRITE_GLOW,
      birth: b,
    });
    sprites.push({
      pos: hub.pos,
      color: palette.star,
      alpha: 0.55,
      size: 9 * sc,
      minPx: 70,
      kind: SPRITE_STAR,
      birth: b - 0.2,
    });
    // target ring
    billboards.push({
      pos: hub.pos,
      color: palette.ring,
      alpha: 1,
      w: 1.75 * sc,
      h: 1.75 * sc,
      kind: BB_RING,
      seed: rng(),
      birth: b + 0.15,
      rot: rng() * Math.PI * 2,
      rotSpeed: (rng() < 0.5 ? -1 : 1) * range(rng, 0.15, 0.4),
    });
    billboards.push({
      ...billboards[billboards.length - 1],
      alpha: 0.16,
      extraBlur: 14,
    });
    // sparkle cloud
    for (let i = 0; i < 340; i++) {
      sprites.push({
        pos: hub.pos
          .clone()
          .add(v3(gauss(rng), gauss(rng), gauss(rng)).multiplyScalar(0.7 * sc)),
        color: rng() < 0.55 ? palette.sparkle : rng() < 0.8 ? palette.sparkleB : palette.satB,
        alpha: range(rng, 0.6, 1),
        size: range(rng, 0.035, 0.07),
        minPx: 2.6,
        birth: b + range(rng, 0, 0.8),
        twinklePhase: rng(),
        twinkleAmt: 0.7,
        driftAmp: 0.08,
        driftSpeed: range(rng, 0.3, 0.9),
      });
    }
    // satellites + local mesh
    const sats: THREE.Vector3[] = [];
    const nSat = 14 + Math.floor(rng() * 7);
    for (let i = 0; i < nSat; i++) {
      const p = hub.pos
        .clone()
        .add(randomUnit(rng).multiplyScalar(range(rng, 1.3, 3.8) * sc));
      sats.push(p);
      const col = rng() < 0.6 ? palette.satA : palette.satB;
      const sb = b + 0.2 + range(rng, 0, 0.7);
      sprites.push({
        pos: p,
        color: col,
        alpha: 0.95,
        size: 0.1,
        minPx: 2.6,
        birth: sb + 0.3,
        twinklePhase: rng(),
        twinkleAmt: 0.25,
      });
      lines.push({
        a: hub.pos,
        b: p,
        colorA: palette.line,
        colorB: col,
        alphaA: 0.85,
        alphaB: 0.7,
        width: 1.5,
        birth: sb,
        grow: 0.45,
      });
      if (rng() < 0.45) {
        const q = p.clone().add(randomUnit(rng).multiplyScalar(range(rng, 1, 3)));
        lines.push({
          a: p,
          b: q,
          colorA: col,
          colorB: col,
          alphaA: 0.45,
          alphaB: 0.0,
          width: 1.1,
          birth: sb + 0.3,
          grow: 0.5,
        });
      }
    }
    sats.forEach((p, i) => {
      let best = -1;
      let bd = Infinity;
      sats.forEach((q, j) => {
        if (j === i) return;
        const d = p.distanceTo(q);
        if (d < bd) {
          bd = d;
          best = j;
        }
      });
      if (best > i || rng() < 0.3) {
        lines.push({
          a: p,
          b: sats[best],
          colorA: palette.satA,
          colorB: palette.satB,
          alphaA: 0.35,
          alphaB: 0.35,
          width: 1.0,
          birth: b + 0.7,
          grow: 0.5,
        });
      }
    });
    // HUD widgets around the hub
    const nW = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < nW; i++) {
      const kind = i === 1 ? BB_BARS : BB_TEXT;
      const off = randomUnit(rng);
      off.y *= 0.6;
      off.normalize().multiplyScalar(range(rng, 1.6, 2.6) * sc);
      billboards.push({
        pos: hub.pos.clone().add(off),
        color: palette.widget,
        alpha: 0.9,
        w: kind === BB_BARS ? 0.75 : range(rng, 0.7, 1.1),
        h: kind === BB_BARS ? 0.5 : 0.36,
        kind,
        seed: rng(),
        birth: b + 0.5 + i * 0.15,
      });
      billboards.push({
        ...billboards[billboards.length - 1],
        alpha: 0.4,
        extraBlur: 10,
      });
    }
    // long rays out into space
    const nRay = hub.onTour ? 3 : 2;
    for (let i = 0; i < nRay; i++) {
      const orange = rng() < 0.25;
      const c = orange ? palette.lineWarm : palette.line;
      lines.push({
        a: hub.pos,
        b: hub.pos
          .clone()
          .add(randomUnit(rng).multiplyScalar(range(rng, 25, 70))),
        colorA: c,
        colorB: c,
        alphaA: 0.45,
        alphaB: 0.0,
        width: 1.5,
        birth: b + range(rng, 0.2, 0.6),
        grow: 1.4,
      });
    }
    void hi;
  });

  /* ---- hub to hub connections ---- */
  const edgeSet = new Set<string>();
  const addEdge = (i: number, j: number) => {
    const key = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (edgeSet.has(key) || i === j) return;
    edgeSet.add(key);
    const A = hubs[i];
    const B = hubs[j];
    const birth = Math.min(A.birth, B.birth) + 0.3;
    lines.push({
      a: A.pos,
      b: B.pos,
      colorA: palette.line,
      colorB: palette.line,
      alphaA: 0.6,
      alphaB: 0.6,
      width: 1.7,
      birth,
      grow: 1.2,
    });
    for (let k = 0; k < 2; k++) {
      pulses.push({
        a: k === 0 ? A.pos : B.pos,
        b: k === 0 ? B.pos : A.pos,
        phase: rng(),
        speed: range(rng, 0.25, 0.55),
        birth: birth + 1.2,
      });
    }
  };
  for (let i = 0; i < layout.tour.length - 1; i++) addEdge(i, i + 1);
  hubs.forEach((h, i) => {
    const order = hubs
      .map((o, j) => ({ j, d: o.pos.distanceTo(h.pos) }))
      .filter((o) => o.j !== i)
      .sort((x, y) => x.d - y.d);
    addEdge(i, order[0].j);
    if (rng() < 0.6) addEdge(i, order[1].j);
  });

  /* ---- foreground streaks that cross the camera path ---- */
  for (let i = 0; i < 40; i++) {
    const f = Math.floor(rng() * states.length);
    const streakBirth = f / fps < 3 ? -10 : f / fps - 3;
    const s = states[f];
    const p = s.pos
      .clone()
      .add(randomUnit(rng).multiplyScalar(range(rng, 1.0, 5)));
    const d = randomUnit(rng).multiplyScalar(range(rng, 30, 60));
    const orange = rng() < 0.15;
    const c = orange ? palette.lineWarm : rng() < 0.5 ? palette.line : palette.beam;
    lines.push({
      a: p.clone().sub(d),
      b: p.clone().add(d),
      colorA: c,
      colorB: c,
      alphaA: 0.55,
      alphaB: 0.55,
      width: 3.4,
      birth: streakBirth,
      grow: 1.6,
    });
  }

  /* ---- floating HUD panels near the path ---- */
  for (let i = 0; i < 18; i++) {
    const f = Math.floor(((i + rng() * 0.8) / 18) * states.length);
    const s = states[Math.min(states.length - 1, f)];
    const fwd = s.target.clone().sub(s.pos).normalize();
    const side = new THREE.Vector3().crossVectors(fwd, v3(0, 1, 0)).normalize();
    const p = s.pos
      .clone()
      .add(fwd.multiplyScalar(range(rng, 6, 18)))
      .add(side.multiplyScalar((rng() < 0.5 ? -1 : 1) * range(rng, 2.5, 7)))
      .add(v3(0, range(rng, -3, 3), 0));
    const w = range(rng, 2.8, 4.6);
    billboards.push({
      pos: p,
      color: palette.panel,
      alpha: 1.0,
      w,
      h: w * range(rng, 0.42, 0.55),
      kind: BB_PANEL,
      seed: rng(),
      birth: f / fps < 3.2 ? 1.2 + rng() : f / fps - 2.5,
    });
    // soft bloom pass for the panel
    const last = billboards[billboards.length - 1];
    billboards.push({ ...last, alpha: 0.45, extraBlur: 22 });
  }

  /* ---- ringless sparkle-cluster nodes along the path ---- */
  for (let i = 0; i < 14; i++) {
    const f = Math.floor(((i + 0.5 + rng() * 0.5) / 14) * states.length);
    const s = states[Math.min(states.length - 1, f)];
    const fwd = s.target.clone().sub(s.pos).normalize();
    const side = new THREE.Vector3().crossVectors(fwd, v3(0, 1, 0)).normalize();
    const c = s.pos
      .clone()
      .add(fwd.multiplyScalar(range(rng, 9, 22)))
      .add(side.multiplyScalar((rng() < 0.5 ? -1 : 1) * range(rng, 3, 9)))
      .add(v3(0, range(rng, -4, 4), 0));
    sprites.push({ pos: c, color: palette.core, alpha: 0.9, size: 0.45, minPx: 4, kind: SPRITE_GLOW });
    sprites.push({ pos: c, color: palette.halo, alpha: 0.18, size: 2.6, minPx: 8, kind: SPRITE_GLOW });
    for (let k = 0; k < 160; k++) {
      sprites.push({
        pos: c.clone().add(v3(gauss(rng), gauss(rng), gauss(rng)).multiplyScalar(0.6)),
        color: rng() < 0.6 ? palette.sparkle : palette.sparkleB,
        alpha: range(rng, 0.4, 1),
        size: range(rng, 0.03, 0.06),
        minPx: 2.2,
        twinklePhase: rng(),
        twinkleAmt: 0.7,
        driftAmp: 0.06,
        driftSpeed: range(rng, 0.3, 0.9),
      });
    }
    for (let k = 0; k < 6; k++) {
      const p = c.clone().add(randomUnit(rng).multiplyScalar(range(rng, 1, 2.6)));
      const col = rng() < 0.6 ? palette.satA : palette.satB;
      sprites.push({ pos: p, color: col, alpha: 0.9, size: 0.08, minPx: 2.4 });
      lines.push({ a: c, b: p, colorA: palette.line, colorB: col, alphaA: 0.6, alphaB: 0.5, width: 1.2 });
    }
  }

  /* ---- faint far-away background constellation ---- */
  const far: THREE.Vector3[] = [];
  for (let i = 0; i < 46; i++) {
    far.push(
      layout.center
        .clone()
        .add(randomUnit(rng).multiplyScalar(range(rng, 75, 120))),
    );
  }
  far.forEach((p, i) => {
    sprites.push({ pos: p, color: palette.core, alpha: 0.7, size: 0.5, minPx: 2.5, kind: SPRITE_GLOW });
    const order = far
      .map((q, j) => ({ j, d: q.distanceTo(p) }))
      .filter((o) => o.j !== i)
      .sort((a, b) => a.d - b.d);
    for (let k = 0; k < 2; k++) {
      if (order[k].j < i) continue;
      lines.push({
        a: p,
        b: far[order[k].j],
        colorA: palette.line,
        colorB: palette.line,
        alphaA: 0.5,
        alphaB: 0.5,
        width: 1.2,
      });
    }
  });

  /* ---- dust ---- */
  for (let i = 0; i < 2600; i++) {
    const p = layout.center
      .clone()
      .add(randomUnit(rng).multiplyScalar(Math.cbrt(rng()) * 95));
    sprites.push({
      pos: p,
      color: rng() < 0.12 ? palette.dustWarm : palette.dust,
      alpha: range(rng, 0.12, 0.45),
      size: range(rng, 0.05, 0.12),
      minPx: 1.3,
      twinklePhase: rng(),
      twinkleAmt: 0.3,
      driftAmp: 0.3,
      driftSpeed: range(rng, 0.05, 0.2),
    });
  }
  // a few big soft "out of focus" motes
  for (let i = 0; i < 70; i++) {
    const f = Math.floor(rng() * states.length);
    const p = states[f].pos
      .clone()
      .add(randomUnit(rng).multiplyScalar(range(rng, 1.5, 5)));
    sprites.push({
      pos: p,
      color: rng() < 0.3 ? palette.dustWarm : palette.dust,
      alpha: 0.4,
      size: 0.08,
      minPx: 2,
      kind: SPRITE_DOT,
    });
  }
  void smoothstep;
  return { sprites, lines, billboards, pulses };
};

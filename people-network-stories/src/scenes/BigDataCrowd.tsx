import React, { useMemo } from "react";
import * as THREE from "three";
import title from "../../data/title.json";
import { COLORS, COUNTS, FPS, rgb } from "../lib/colors";
import { clamp01, easeInOut, keyframes, lerp, remap, smooth } from "../lib/ease";
import { gauss, mulberry32 } from "../lib/random";
import { Dots } from "../lib/three/dots";
import { Glyphs } from "../lib/three/glyphs";
import { Lines } from "../lib/three/lines";
import { People } from "../lib/three/people";
import { SceneRuntime, Stage, StageInfo } from "../lib/three/Stage";
import { useFont } from "../lib/useStaticData";

const DURATION = 18;
const MONO = "IBM Plex Mono";
const TITLE_FONT = "Archivo Black";
const FOG = { near: 130, far: 210 };

// ----- Camera path ------------------------------------------------------------------------
// 0-5s eye level moving forward past the near people; 5-12s rising and tilting down;
// 12-18s settling high over the crowd.
const camAt = (t: number) => {
  const pos = new THREE.Vector3(
    0,
    keyframes(t, [[0, 1.95], [5, 2.1], [12, 30], [16, 32]]),
    keyframes(t, [[0, 17], [5, 10], [12, 22], [16, 23]]),
  );
  const look = new THREE.Vector3(
    0,
    keyframes(t, [[0, 3.4], [5, 4.4], [12, 2], [16, 2]]),
    keyframes(t, [[0, -100], [5, -100], [12, -60], [16, -60]]),
  );
  return { pos, look };
};
const FOV = 40;

// ----- Crowd --------------------------------------------------------------------------------
const rng = mulberry32(4856303);
type Person = { x: number; z: number; h: number; rot: number; female: boolean };
const CROWD: Person[] = [];
{
  // A few large people close to the starting camera.
  const near: [number, number][] = [[-2.3, 12.4], [1.4, 10.6], [3.3, 11.8], [-4.6, 9.8], [5.6, 7.5], [-1.0, 6.2], [2.4, 3.5], [-3.6, 2.2]];
  for (const [x, z] of near) CROWD.push({ x, z, h: 1.8, rot: (rng() - 0.5) * 0.4, female: rng() < 0.3 });
  while (CROWD.length < COUNTS.bigDataCrowdPeople) {
    const z = 4 - Math.pow(rng(), 0.85) * 330;
    const x = (rng() * 2 - 1) * (70 + (4 - z) * 0.9);
    // Keep the camera's opening corridor clear, and the foreground sparser than the
    // distance, so the eye-level horizon is a thin band rather than a wall.
    if (z > -6 && Math.abs(x) < 6) continue;
    // (The ground nearer than z = -15 is out of the final high shot.)
    if (z > -15 && rng() < 0.94) continue;
    if (z > -32 && rng() < 0.5) continue;
    CROWD.push({ x, z, h: 1.8 * (0.95 + rng() * 0.1), rot: (rng() - 0.5) * 0.6, female: rng() < 0.4 });
  }
}

// ----- Sky: streaming lines, dotted lines and binary strings ------------------------------
type SkyLine = { t0: number; life: number; p: THREE.Vector3; d: THREE.Vector3; len: number; speed: number; a: number; kind: 0 | 1 | 2 };
const SKY: SkyLine[] = [];
{
  const r = mulberry32(48563);
  for (let t = -6; t < DURATION; t += 1 / 40) {
    const kind = (r() < 0.1 ? 1 : r() < 0.18 ? 2 : 0) as 0 | 1 | 2;
    // Diagonal across the sky, mostly descending towards the crowd.
    const ang = (r() < 0.5 ? 1 : -1) * (0.35 + r() * 0.6);
    const d = new THREE.Vector3(Math.cos(ang), -0.35 - r() * 0.5, (r() - 0.5) * 0.8).normalize();
    SKY.push({
      t0: t,
      life: 4 + r() * 4,
      p: new THREE.Vector3((r() - 0.5) * 160, 8 + r() * 45, -10 - r() * 130),
      d,
      len: kind === 0 ? 25 + r() * 60 : 14 + r() * 20,
      speed: 6 + r() * 10,
      a: 0.18 + r() * 0.3,
      kind,
    });
  }
}
const MAX_LINES = 600;
const DOTS_PER = 26;
const DIGITS_PER = 18;
const MAX_DOTTED = 90;
const MAX_DIGITS = 110;

// ----- Title particles ------------------------------------------------------------------------
const finalCam = camAt(DURATION);
const titleFrame = () => {
  const cam = new THREE.PerspectiveCamera(FOV, 16 / 9, 0.1, 1000);
  cam.position.copy(finalCam.pos);
  cam.lookAt(finalCam.look);
  cam.updateMatrixWorld();
  // Centre of the title: top third of the final frame, 110 units away.
  const dir = new THREE.Vector3(0, 0.64, 0.5).unproject(cam).sub(cam.position).normalize();
  const dist = 110;
  const center = cam.position.clone().addScaledVector(dir, dist);
  const viewH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(cam.quaternion);
  return { center, right, up, width: viewH * (16 / 9) * 0.74 };
};

const sampleTitle = (text: string) => {
  const W = 2000;
  const H = 420;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#000";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let size = 330;
  ctx.font = `400 ${size}px "${TITLE_FONT}"`;
  const m = ctx.measureText(text);
  // Fit long words into the width.
  if (m.width > W * 0.96) {
    size *= (W * 0.96) / m.width;
    ctx.font = `400 ${size}px "${TITLE_FONT}"`;
  }
  ctx.fillText(text, W / 2, H / 2 + size * 0.04);
  const textW = Math.min(W * 0.96, ctx.measureText(text).width);
  const data = ctx.getImageData(0, 0, W, H).data;
  const r = mulberry32(13);
  const pts: [number, number][] = [];
  const step = 6;
  for (let y = 0; y < H; y += step)
    for (let x = 0; x < W; x += step) {
      const jx = Math.min(W - 1, Math.max(0, Math.round(x + (r() - 0.5) * step)));
      const jy = Math.min(H - 1, Math.max(0, Math.round(y + (r() - 0.5) * step)));
      if (data[(jy * W + jx) * 4 + 3] > 128 && r() < 0.8) pts.push([(jx - W / 2) / textW, -(jy - H / 2) / textW]);
    }
  return pts; // in units of the text width
};

const makeCreate = (withTitle: boolean) => (info: StageInfo): SceneRuntime => {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, info.width / info.height, 0.1, 1000);
  const bg = COLORS.lightBackground;

  // Floor grid.
  const gridLines: [number, number, number, number][] = [];
  for (let z = 20; z >= -300; z -= 2.5) gridLines.push([-250, z, 250, z]);
  for (let x = -150; x <= 150; x += 2.5) gridLines.push([x, 20, x, -300]);
  const grid = new Lines(gridLines.length, info, { width: 1.1, fog: FOG });
  const gc = rgb(COLORS.floorGrid);
  gridLines.forEach(([x0, z0, x1, z1], i) => {
    grid.setEnds(i, x0, 0, z0, x1, 0, z1);
    grid.setRange(i, 0, 1);
    grid.setColor(i, gc[0], gc[1], gc[2], 1);
  });
  grid.commit();

  const people = new People(CROWD.length, (i) => CROWD[i].female, {
    front: COLORS.red,
    side: COLORS.redSide,
    fog: { color: bg, near: FOG.near, far: FOG.far },
  });
  CROWD.forEach((p, i) => people.set(i, p.x, 0, p.z, p.h, 1, p.rot));
  people.commit();

  const sky = new Lines(MAX_LINES, info, { width: 0.8, fog: { near: 90, far: 220 } });
  const dotted = new Dots(MAX_DOTTED * DOTS_PER, info, camera, { world: true, fog: { near: 90, far: 220 } });
  const digits = new Glyphs(MAX_DIGITS * DIGITS_PER, MONO, "#1A1A1A", 0.55, { near: 90, far: 220 });

  // Title (or, for the clean version, a soft web cloud).
  const tf = titleFrame();
  const r = mulberry32(777);
  let targets: THREE.Vector3[];
  if (withTitle) {
    targets = sampleTitle(title.text).map(([u, v]) =>
      tf.center
        .clone()
        .addScaledVector(tf.right, u * tf.width)
        .addScaledVector(tf.up, v * tf.width)
        .add(new THREE.Vector3(gauss(r) * 0.12, gauss(r) * 0.12, gauss(r) * 0.6)),
    );
  } else {
    targets = [];
    for (let i = 0; i < 5000; i++) {
      const u = gauss(r) * 0.22;
      const v = gauss(r) * 0.05;
      targets.push(
        tf.center
          .clone()
          .addScaledVector(tf.right, u * tf.width)
          .addScaledVector(tf.up, v * tf.width - 3)
          .add(new THREE.Vector3(0, 0, gauss(r) * 6)),
      );
    }
  }
  const NP = targets.length;
  const particles = new Dots(NP, info, camera, { world: true });
  // Each particle leaves a stream in the sky and flies to its target (8-13s).
  const src: THREE.Vector3[] = [];
  const via: THREE.Vector3[] = [];
  const start = new Float32Array(NP);
  const dur = new Float32Array(NP);
  for (let i = 0; i < NP; i++) {
    const s = new THREE.Vector3((r() - 0.5) * 140, 10 + r() * 40, -20 - r() * 110);
    const d = new THREE.Vector3(r() < 0.5 ? 1 : -1, -0.5, (r() - 0.5) * 0.6).normalize();
    src.push(s);
    via.push(s.clone().addScaledVector(d, 25 + r() * 20));
    start[i] = 8 + Math.pow(r(), 1.3) * 2.6;
    dur[i] = 1.8 + r() * 0.8;
  }
  const psize = withTitle ? 0.62 : 0.3;
  // Varied particle sizes: a rough, stippled fill.
  const pScale = Float32Array.from({ length: NP }, () => 0.7 + r() * r() * 1.4);

  // Web: lines from the title down into the crowd, and between title particles.
  const WEB = withTitle ? 800 : 800;
  const web = new Lines(WEB, info, { width: 0.75, fog: { near: 140, far: 300 } });
  const webAt = new Float32Array(WEB);
  for (let i = 0; i < WEB; i++) {
    const a = targets[Math.floor(r() * NP)];
    let b: THREE.Vector3;
    if (r() < 0.9) {
      // A person in the crowd in front of the title.
      let p = CROWD[Math.floor(r() * CROWD.length)];
      for (let k = 0; k < 10 && (p.z > -15 || p.z < -150 || Math.abs(p.x) > 70); k++) p = CROWD[Math.floor(r() * CROWD.length)];
      b = new THREE.Vector3(p.x, p.h * 0.8, p.z);
    } else {
      b = targets[Math.floor(r() * NP)].clone().add(new THREE.Vector3(gauss(r) * 8, -6 - r() * 14, gauss(r) * 8));
    }
    web.setEnds(i, a.x, a.y, a.z, b.x, b.y, b.z);
    web.setColor(i, 0.35, 0.35, 0.35, 0.3 + r() * 0.25);
    webAt[i] = 10 + r() * 4.5;
  }

  // Links between people across the floor, appearing through the first half.
  const FLOOR = 900;
  const floor = new Lines(FLOOR, info, { width: 0.8, fog: FOG });
  const floorAt = new Float32Array(FLOOR);
  for (let i = 0; i < FLOOR; i++) {
    const a = CROWD[Math.floor(r() * CROWD.length)];
    let b = CROWD[Math.floor(r() * CROWD.length)];
    for (let k = 0; k < 30 && Math.hypot(a.x - b.x, a.z - b.z) > 40; k++) b = CROWD[Math.floor(r() * CROWD.length)];
    floor.setEnds(i, a.x, a.h * 0.85, a.z, b.x, b.h * 0.85, b.z);
    floor.setColor(i, 0.45, 0.45, 0.45, 0.45 + r() * 0.3);
    floorAt[i] = 1 + r() * 11;
  }
  scene.add(grid.mesh, floor.mesh, people.group, sky.mesh, dotted.mesh, digits.mesh, web.mesh, particles.mesh);
  const tmp = new THREE.Vector3();

  return {
    scene,
    camera,
    update: (frame) => {
      const t = frame / FPS;
      const c = camAt(t);
      camera.position.copy(c.pos);
      camera.lookAt(c.look);
      camera.updateMatrixWorld();
      // Sky streams thin out as they converge into the title.
      const skyFade = lerp(1, 0.12, smooth(remap(t, 8.5, 13)));
      let nl = 0;
      let nd = 0;
      let ng = 0;
      for (const s of SKY) {
        const a = t - s.t0;
        if (a < 0 || a > s.life) continue;
        const env = Math.min(1, a / 0.6, (s.life - a) / 0.8) * s.a * skyFade;
        tmp.copy(s.p).addScaledVector(s.d, s.speed * a);
        if (s.kind === 0 && nl < MAX_LINES) {
          sky.setEnds(nl, tmp.x, tmp.y, tmp.z, tmp.x + s.d.x * s.len, tmp.y + s.d.y * s.len, tmp.z + s.d.z * s.len);
          sky.setRange(nl, 0, 1);
          sky.setColor(nl, 0.3, 0.3, 0.3, env);
          nl++;
        } else if (s.kind === 1 && nd < MAX_DOTTED) {
          for (let k = 0; k < DOTS_PER; k++) {
            const u = (k / DOTS_PER) * s.len;
            dotted.set(nd * DOTS_PER + k, tmp.x + s.d.x * u, tmp.y + s.d.y * u, tmp.z + s.d.z * u, 0.16, 0.2, 0.2, 0.2, env * 1.6);
          }
          nd++;
        } else if (s.kind === 2 && ng < MAX_DIGITS) {
          for (let k = 0; k < DIGITS_PER; k++) {
            const u = (k / DIGITS_PER) * s.len;
            const gi = ng * DIGITS_PER + k;
            digits.pos[gi * 3] = tmp.x + s.d.x * u;
            digits.pos[gi * 3 + 1] = tmp.y + s.d.y * u;
            digits.pos[gi * 3 + 2] = tmp.z + s.d.z * u;
            // Deterministic bit pattern that scrolls with the string.
            const bit = ((Math.floor(s.t0 * 977) + k * 7 + Math.floor(a * 6)) * 2654435761) >>> 0;
            digits.glyph[gi] = (bit >>> 13) & 1;
            digits.alpha[gi] = Math.min(1, env * 2.4);
          }
          ng++;
        }
      }
      sky.setDrawCount(nl);
      dotted.setDrawCount(nd * DOTS_PER);
      digits.alpha.fill(0, ng * DIGITS_PER);
      // Title particles.
      for (let i = 0; i < NP; i++) {
        const u = (t - start[i]) / dur[i];
        if (u < 0) {
          particles.hide(i);
          continue;
        }
        const e = easeInOut(clamp01(u));
        const a = src[i];
        const b = via[i];
        const g = targets[i];
        const v = 1 - e;
        const x = v * v * a.x + 2 * v * e * b.x + e * e * g.x;
        const y = v * v * a.y + 2 * v * e * b.y + e * e * g.y;
        const z = v * v * a.z + 2 * v * e * b.z + e * e * g.z;
        const shade = withTitle ? 0.04 : 0.42;
        particles.set(i, x, y, z, psize * pScale[i], shade, shade, shade, (withTitle ? 1 : 0.55) * clamp01(u * 4));
      }
      for (let i = 0; i < WEB; i++) web.setRange(i, 0, smooth(remap(t, webAt[i], webAt[i] + 1.4)));
      for (let i = 0; i < FLOOR; i++) floor.setRange(i, 0, smooth(remap(t, floorAt[i], floorAt[i] + 1.2)));
      floor.commit();
      sky.commit();
      dotted.commit();
      digits.commit();
      particles.commit();
      web.commit();
    },
  };
};

const createTitle = makeCreate(true);
const createClean = makeCreate(false);

const BigData: React.FC<{ withTitle: boolean }> = ({ withTitle }) => {
  const mono = useFont(MONO, "IBMPlexMono-Light.woff2");
  const heavy = useFont(TITLE_FONT, "ArchivoBlack.woff2");
  const create = useMemo(() => (withTitle ? createTitle : createClean), [withTitle]);
  if (!mono || !heavy) return null;
  return <Stage create={create} background={COLORS.lightBackground} />;
};

export const BigDataCrowdTitle: React.FC = () => <BigData withTitle />;
export const BigDataCrowdClean: React.FC = () => <BigData withTitle={false} />;

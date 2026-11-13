import * as THREE from "three";
import { loadFonts } from "../engine/fonts";
import { PostChain, PostSettings } from "../engine/post";
import { hash } from "../engine/random";
import type { StageFactory } from "../engine/ThreeStage";
import {
  BACK_H,
  BACK_W,
  drawBackCard,
  drawMainCard,
  drawRevenueCard,
  drawSystemList,
  drawTallCard,
  drawWall,
  LIST_H,
  LIST_W,
  MAIN_H,
  MAIN_W,
  REV_H,
  REV_W,
  TALL_H,
  TALL_W,
} from "./draw";
import type { DashPalette } from "./palette";

export const DASH_FONTS = [
  { family: "Montserrat", file: "montserrat-latin-500-normal.woff2", weight: "500" },
  { family: "Montserrat", file: "montserrat-latin-600-normal.woff2", weight: "600" },
  { family: "Montserrat", file: "montserrat-latin-700-normal.woff2", weight: "700" },
  { family: "Inter", file: "inter-latin-400-normal.woff2", weight: "400" },
  { family: "Inter", file: "inter-latin-500-normal.woff2", weight: "500" },
  { family: "Inter", file: "inter-latin-600-normal.woff2", weight: "600" },
];

// The cards are laid out along a "wall" line that recedes to the right.
const WALL_ANGLE = THREE.MathUtils.degToRad(33);
const WALL_DIR = new THREE.Vector3(Math.cos(WALL_ANGLE), 0, -Math.sin(WALL_ANGLE));
const WALL_N = new THREE.Vector3(Math.sin(WALL_ANGLE), 0, Math.cos(WALL_ANGLE)); // towards camera side
const onWall = (s: number, y: number, depth = 0) =>
  WALL_DIR.clone().multiplyScalar(s).add(new THREE.Vector3(0, y, 0)).addScaledVector(WALL_N, depth);

type Card = {
  mesh: THREE.Mesh;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  draw: (t: number) => void;
  /** redraw rate in Hz (0 = static) */
  rate: number;
  lastKey: number;
};

const makeCard = (
  cw: number,
  ch: number,
  worldW: number,
  pos: THREE.Vector3,
  yaw: number,
  draw: (c: CanvasRenderingContext2D, t: number) => void,
  rate: number,
  opacity = 1,
): Card => {
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d")!;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.premultiplyAlpha = true;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity,
    depthWrite: true,
    toneMapped: false,
    premultipliedAlpha: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, (worldW * ch) / cw), mat);
  mesh.position.copy(pos);
  mesh.rotation.y = yaw;
  return { mesh, ctx, tex, draw: (t) => draw(ctx, t), rate, lastKey: -1 };
};

type Rig = { pos: THREE.Vector3; look: THREE.Vector3; fov: number; roll: number };

/**
 * Cubic Hermite interpolation through (time, value) keys with Catmull-Rom
 * tangents: C1-smooth, no overshoot at the ends, exact at every key.
 */
const keyframes = (t: number, keys: [number, number][]) => {
  if (t <= keys[0][0]) return keys[0][1];
  const last = keys[keys.length - 1];
  if (t >= last[0]) return last[1];
  let i = 0;
  while (t > keys[i + 1][0]) i++;
  const [t0, v0] = keys[i];
  const [t1, v1] = keys[i + 1];
  const slope = (a: number) => {
    if (a <= 0 || a >= keys.length - 1) return 0; // ease in / out at the ends
    return (keys[a + 1][1] - keys[a - 1][1]) / (keys[a + 1][0] - keys[a - 1][0]);
  };
  const h = t1 - t0;
  const u = (t - t0) / h;
  const m0 = slope(i) * h;
  const m1 = slope(i + 1) * h;
  const u2 = u * u;
  const u3 = u2 * u;
  return (2 * u3 - 3 * u2 + 1) * v0 + (u3 - 2 * u2 + u) * m0 + (-2 * u3 + 3 * u2) * v1 + (u3 - u2) * m1;
};

/**
 * V1 — reference move, keyed against the reference clip: a push-in on the
 * donut card for the first ~4 s, then a truck to the right along the wall of
 * cards that decelerates into the last seconds. Eye level near card centres.
 */
const REF_KEYS = {
  s: [[0, -0.3], [1, -0.15], [2.5, 0.5], [4, 1.5], [5.5, 2.6], [7.5, 3.25], [10, 3.5]] as [number, number][],
  d: [[0, 8.9], [1, 7.7], [2.5, 6.3], [4, 5.7], [5.5, 5.3], [7.5, 4.9], [10, 4.75]] as [number, number][],
  /** camera height (eye line stays about mid-card on the KPI cards) */
  y: [[0, 0.55], [2.5, 0.55], [10, 0.5]] as [number, number][],
  /** height of the look-at point */
  ly: [[0, -0.05], [2.5, -0.05], [10, -0.2]] as [number, number][],
  look: [[0, 0.6], [1, 0.8], [2.5, 1.6], [4, 2.8], [5.5, 3.9], [7.5, 4.6], [10, 5.0]] as [number, number][],
};
const referenceRig = (t: number): Rig => {
  const s = keyframes(t, REF_KEYS.s);
  const d = keyframes(t, REF_KEYS.d);
  const ls = keyframes(t, REF_KEYS.look);
  const pos = onWall(s, keyframes(t, REF_KEYS.y), d);
  const look = onWall(ls, keyframes(t, REF_KEYS.ly), 0);
  return { pos, look, fov: 48, roll: 0 };
};

export type DashVariant = "reference" | "emerald";

export const createDashFactory =
  (palette: DashPalette, debug = false): StageFactory =>
  async ({ renderer, pixelWidth, pixelHeight, fps }) => {
    await loadFonts(DASH_FONTS);
    const p = palette;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(...p.bg);
    const camera = new THREE.PerspectiveCamera(42, pixelWidth / pixelHeight, 0.1, 200);
    const yawCard = WALL_ANGLE * 1.0;
    const yawTall = WALL_ANGLE * 1.35;

    const cards: Card[] = [];
    // background wall plane (static texture, tiled)
    {
      const canvas = document.createElement("canvas");
      canvas.width = 2048;
      canvas.height = 1024;
      drawWall(canvas.getContext("2d")!, p);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.NoColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(4, 2);
      tex.anisotropy = 8;
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(64, 16),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: true, toneMapped: false }),
      );
      wall.position.copy(onWall(8, 1, -6.5));
      wall.rotation.y = WALL_ANGLE;
      scene.add(wall);
    }
    // big violet chart card high on the back layer
    cards.push(makeCard(BACK_W, BACK_H, 14, onWall(3.0, 5.3, -3.0), WALL_ANGLE, (c, t) => drawBackCard(c, p, t), 4, 1));
    // system list far left
    cards.push(makeCard(LIST_W, LIST_H, 2.8, onWall(-4.4, 0.4, -1.5), WALL_ANGLE, (c, t) => drawSystemList(c, p, t), 3));
    // main card
    cards.push(makeCard(MAIN_W, MAIN_H, 6.2, onWall(0.3, 0.15, 0.4), yawCard, (c, t) => drawMainCard(c, p, t), 30));
    // revenue card below
    cards.push(makeCard(REV_W, REV_H, 6.0, onWall(0.6, -2.75, 0.55), yawCard, (c, t) => drawRevenueCard(c, p, t), 15));
    // tall cards fanned along the wall
    for (let i = 0; i < 7; i++) {
      const s = 4.35 + i * 1.8;
      cards.push(
        makeCard(TALL_W, TALL_H, 2.2, onWall(s, -1.0, -0.15), yawTall, (c, t) => drawTallCard(c, p, t, i), 6),
      );
    }
    cards.forEach((cd) => scene.add(cd.mesh));

    // thin HUD guide lines crossing the scene (additive)
    const lineMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(0.85, 0.88, 0.95).multiplyScalar(0.6),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const lines: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(26, 0.006 + 0.004 * hash(i)), lineMat);
      m.position.copy(onWall(4 + i * 0.7, -0.9 + i * 0.85, 0.6 - i * 0.5));
      m.rotation.y = WALL_ANGLE;
      lines.push(m);
      scene.add(m);
    }
    // little glowing nodes on the lines
    const nodeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1, 1, 1),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const nodes: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), nodeMat);
      scene.add(m);
      nodes.push(m);
    }

    const post = new PostChain(renderer, pixelWidth, pixelHeight);

    return {
      render(frame: number) {
        const t = frame / fps;
        for (const cd of cards) {
          const key = cd.rate === 0 ? 0 : Math.floor(t * cd.rate);
          if (key !== cd.lastKey) {
            cd.lastKey = key;
            cd.draw(cd.rate === 0 ? 0 : key / cd.rate);
            cd.tex.needsUpdate = true;
          }
        }
        nodes.forEach((n, i) => {
          const l = lines[i];
          const u = ((t * (0.08 + 0.05 * hash(i, 1)) + hash(i, 2)) % 1) - 0.5;
          n.position.copy(l.position).addScaledVector(WALL_DIR, u * 20);
          n.rotation.y = WALL_ANGLE;
        });

        const rig = referenceRig(t);
        camera.position.copy(rig.pos);
        camera.up.set(0, 1, 0);
        camera.lookAt(rig.look);
        camera.rotateZ(rig.roll);
        camera.fov = rig.fov;
        camera.updateProjectionMatrix();
        camera.updateMatrixWorld(true);
        const focusZ = -rig.look.clone().applyMatrix4(camera.matrixWorldInverse).z;

        const settings: PostSettings = {
          focusDistance: focusZ,
          nearBlur: 26,
          farBlur: 18,
          maxCoc: 22,
          bloomStrength: 0.35,
          bloomThreshold: 0.55,
          exposure: 1.0,
          vignette: 0.5,
          grain: 0.014,
          saturation: p.saturation,
          gain: p.gain,
          lift: p.lift,
          aberration: 0.8,
        };
        if (debug) {
          renderer.setRenderTarget(null);
          renderer.clear();
          renderer.render(scene, camera);
        } else post.render(scene, camera, settings, frame);
      },
      dispose() {
        post.dispose();
        scene.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose();
            const m = o.material as THREE.MeshBasicMaterial;
            m.map?.dispose();
            m.dispose();
          }
        });
      },
    };
  };

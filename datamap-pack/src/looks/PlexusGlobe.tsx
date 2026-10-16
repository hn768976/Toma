import React, { useMemo } from "react";
import * as THREE from "three";
import { useCurrentFrame } from "remotion";
import { hexToRgb } from "../lib/color";
import { INTER, MONO } from "../lib/fonts";
import { applyDof, DofParams, makeDots, makeLines } from "../lib/gl/primitives";
import { PostParams } from "../lib/gl/post";
import { GLStage, SceneFactory } from "../lib/gl/Stage";
import { hash01, loopFrame, mulberry32, Rng, TAU } from "../lib/random";
import type { PlexusRow } from "../versions";

const W = 3840;
const H = 2160;
// World units: the frame is 2 units tall at the sphere centre's depth.
const FOV = 12;
const CAM_D = 1 / Math.tan(((FOV / 2) * Math.PI) / 180);
const ASPECT = W / H;
const CENTER = new THREE.Vector3(-ASPECT + 0.035 * 2 * ASPECT, 0.02, 0);

const R_INNER = 0.57;
const R_MID = 1.22;
const R_OUTER = 2.1;
const N_INNER = 1200;
const N_MID = 640;
const N_OUTER = 700;
const MARKERS = 70; // small unlabelled triangles
const TAGS = 72;

type Shell = { pts: THREE.Vector3[]; links: [number, number][] };

const fibSphere = (n: number, r: number, jitter: number, radialJitter: number, rng: Rng) => {
  const pts: THREE.Vector3[] = [];
  const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i++) {
    const y = 1 - (2 * (i + 0.5)) / n;
    const rr = Math.sqrt(1 - y * y);
    const th = i * ga;
    const v = new THREE.Vector3(Math.cos(th) * rr, y, Math.sin(th) * rr);
    v.x += (rng() - 0.5) * jitter;
    v.y += (rng() - 0.5) * jitter;
    v.z += (rng() - 0.5) * jitter;
    v.normalize().multiplyScalar(r * (1 + (rng() - 0.5) * radialJitter));
    pts.push(v);
  }
  return pts;
};

// Links to the k nearest neighbours, computed once (deduplicated).
const knnLinks = (pts: THREE.Vector3[], k: number): [number, number][] => {
  const seen = new Set<number>();
  const out: [number, number][] = [];
  const n = pts.length;
  const d = new Float32Array(n);
  const idx = new Int32Array(n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      d[j] = j === i ? Infinity : pts[i].distanceToSquared(pts[j]);
      idx[j] = j;
    }
    const sorted = Array.from(idx).sort((a, b) => d[a] - d[b]);
    for (let m = 0; m < k; m++) {
      const j = sorted[m];
      const key = Math.min(i, j) * n + Math.max(i, j);
      if (!seen.has(key)) {
        seen.add(key);
        out.push([i, j]);
      }
    }
  }
  return out;
};

type Plexus = {
  inner: Shell;
  mid: Shell;
  outer: Shell;
  spokes: [number, number][]; // mid index -> outer index
  tags: { shell: "mid" | "outer"; i: number; big: boolean; num: boolean }[];
};

const cache = new Map<number, Plexus>();
const buildPlexus = (seed: number): Plexus => {
  const c = cache.get(seed);
  if (c) return c;
  const rng = mulberry32(seed);
  const innerPts = fibSphere(N_INNER, R_INNER, 0.05, 0.05, rng);
  const midPts = fibSphere(N_MID, R_MID, 0.035, 0.01, rng);
  const outerPts = fibSphere(N_OUTER, R_OUTER, 0.05, 0.035, rng);
  const spokes: [number, number][] = [];
  outerPts.forEach((p, oi) => {
    let best = 0;
    let bd = Infinity;
    midPts.forEach((m, mi) => {
      const dd = m.distanceToSquared(p);
      if (dd < bd) { bd = dd; best = mi; }
    });
    if (rng() < 0.55) spokes.push([best, oi]);
  });
  const tags: Plexus["tags"] = [];
  const used = new Set<string>();
  while (tags.length < TAGS + MARKERS) {
    const num = tags.length < TAGS;
    const shell = rng() < 0.78 ? "outer" : "mid";
    const i = Math.floor(rng() * (shell === "outer" ? N_OUTER : N_MID));
    const key = shell + i;
    // Keep tags in the band that stays inside the frame as the shell turns.
    const pt = (shell === "outer" ? outerPts : midPts)[i];
    if (used.has(key) || Math.abs(pt.y) > 0.85) continue;
    used.add(key);
    tags.push({ shell, i, big: rng() < 0.3, num });
  }
  const p: Plexus = {
    inner: { pts: innerPts, links: knnLinks(innerPts, 5) },
    mid: { pts: midPts, links: knnLinks(midPts, 4) },
    outer: { pts: outerPts, links: knnLinks(outerPts, 3) },
    spokes,
    tags,
  };
  cache.set(seed, p);
  return p;
};

// One whole turn per 600 frames for each sphere, about tilted axes.
const AXIS_INNER = new THREE.Vector3(0.25, 1, 0.18).normalize();
const AXIS_OUTER = new THREE.Vector3(-0.12, 1, 0.3).normalize();
const rotInner = (frame: number) => new THREE.Quaternion().setFromAxisAngle(AXIS_INNER, (TAU * frame) / 600);
const rotOuter = (frame: number) => new THREE.Quaternion().setFromAxisAngle(AXIS_OUTER, (TAU * frame) / 600);

const makeCamera = () => {
  const cam = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 100);
  cam.position.set(0, 0, CAM_D);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  cam.updateProjectionMatrix();
  return cam;
};

const makeFactory = (row: PlexusRow): SceneFactory => () => {
  const plex = buildPlexus(row.seed);
  const [r, g, b] = hexToRgb(row.line);
  const fill = (shell: Shell, alpha: number, width: number) => {
    const L = makeLines(shell.links.length);
    shell.links.forEach(([i, j], n) => {
      L.a.set(shell.pts[i].toArray(), n * 3);
      L.b.set(shell.pts[j].toArray(), n * 3);
      L.color.set([r, g, b, alpha], n * 4);
      L.width[n] = width;
    });
    L.touch();
    return L;
  };
  const innerLines = fill(plex.inner, 0.36, 1.5);
  const midLines = fill(plex.mid, 0.42, 1.7);
  const outerLines = fill(plex.outer, 0.4, 1.7);
  const spokeLines = makeLines(plex.spokes.length);
  plex.spokes.forEach(([mi, oi], n) => {
    spokeLines.a.set(plex.mid.pts[mi].toArray(), n * 3);
    spokeLines.b.set(plex.outer.pts[oi].toArray(), n * 3);
    spokeLines.color.set([r, g, b, 0.2], n * 4);
    spokeLines.width[n] = 1.5;
  });
  spokeLines.touch();
  const dots = (pts: THREE.Vector3[], size: number, alpha: number) => {
    const D = makeDots(pts.length);
    pts.forEach((p, n) => {
      D.p.set(p.toArray(), n * 3);
      D.color.set([r, g, b, alpha], n * 4);
      D.size[n] = size;
    });
    D.touch();
    return D;
  };
  const innerDots = dots(plex.inner.pts, 4, 0.6);
  const midDots = dots(plex.mid.pts, 6.5, 0.75);
  const outerDots = dots(plex.outer.pts, 7, 0.8);

  const innerGroup = new THREE.Group();
  innerGroup.add(innerLines.mesh, innerDots.mesh);
  const outerGroup = new THREE.Group();
  outerGroup.add(midLines.mesh, outerLines.mesh, spokeLines.mesh, midDots.mesh, outerDots.mesh);
  innerGroup.position.copy(CENTER);
  outerGroup.position.copy(CENTER);
  const scene = new THREE.Scene();
  scene.add(innerGroup, outerGroup);
  const camera = makeCamera();
  const mats = [innerLines, midLines, outerLines, spokeLines, innerDots, midDots, outerDots].map((x) => x.material);
  // Slight DoF: focused on the front half, the far side of the outer shell
  // is softer and dimmer.
  const dof: DofParams = {
    focus: CAM_D - 0.8,
    coc: 18,
    cocMax: 9,
    fade: [-1, 0, CAM_D - 0.4, CAM_D + 2.2],
    farFloor: 0.35,
    near: 0.1,
  };
  return {
    scene,
    camera,
    update: (frame, res) => {
      innerGroup.quaternion.copy(rotInner(frame));
      outerGroup.quaternion.copy(rotOuter(frame));
      scene.updateMatrixWorld(true);
      mats.forEach((m) => applyDof(m, dof, res));
    },
  };
};

// All tags share one five-digit reading that steps every 2 s (60 frames,
// divides 600), with a short scramble before each step.
const STEP = 60;
const SCRAMBLE = 6;
const tagNumber = (frame: number, seed: number, tag: number) => {
  const f = loopFrame(frame);
  const k = Math.floor(f / STEP) % (600 / STEP);
  const into = f % STEP;
  if (into >= STEP - SCRAMBLE) {
    return String(10000 + Math.floor(hash01(seed, f, tag) * 89999));
  }
  return String(10000 + Math.floor(hash01(seed, k, 3) * 89999));
};

const Hud: React.FC<{ color: string }> = ({ color }) => {
  const dots: React.ReactNode[] = [];
  for (let y = 0; y < 5; y++)
    for (let x = 0; x < 10; x++)
      dots.push(<rect key={`${x}-${y}`} x={1530 + x * 16} y={70 + y * 16} width={6} height={6} fill={color} opacity={0.55} />);
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
      {dots}
      <rect x={930} y={1110} width={460} height={8} fill={color} opacity={0.65} />
      <rect x={930} y={1126} width={460} height={4} fill={color} opacity={0.55} />
      {[0, 1, 2].map((k) => (
        <text key={`b${k}`} x={930} y={1050 + k * 0} dy={-k * 26} fontFamily={MONO} fontSize={18} fill={color} opacity={0.4}>
          {["SEQ 0417  PKT 22", "LAT 0.0193  RX 4", "NODE 07 / LINK 3"][k]}
        </text>
      ))}
      {Array.from({ length: 6 }, (_, k) => (
        <text key={`d${k}`} x={1270} y={140 + k * 26} fontFamily={MONO} fontSize={18} fill={color} opacity={0.45}>
          {["0 1 1 0 4 7 2 9 0 3", "8 2 0 0 1 5 6 3 1 1", "3 9 4 1 0 0 2 7 5 8", "1 1 0 6 3 2 9 4 0 2", "7 0 5 2 8 1 1 3 6 0", "2 4 9 0 0 7 3 1 5 5"][k]}
        </text>
      ))}
      {Array.from({ length: 4 }, (_, k) => (
        <text key={`t${k}`} x={735} y={760 + k * 22} fontFamily={MONO} fontSize={16} fill={color} opacity={0.4}>
          {["ID 2207", "CH 04", "SYNC 1", "MESH 9"][k]}
        </text>
      ))}
      <rect x={735} y={860} width={96} height={60} fill="none" stroke={color} strokeWidth={2} opacity={0.4} />
      <rect x={751} y={876} width={64} height={4} fill={color} opacity={0.4} />
      <rect x={751} y={890} width={40} height={4} fill={color} opacity={0.4} />
      <rect x={751} y={904} width={52} height={4} fill={color} opacity={0.4} />

    </svg>
  );
};

const Tags: React.FC<{ row: PlexusRow }> = ({ row }) => {
  const frame = useCurrentFrame();
  const plex = buildPlexus(row.seed);
  const cam = useMemo(makeCamera, []);
  const q = rotOuter(loopFrame(frame));
  const centerView = CENTER.clone().applyMatrix4(cam.matrixWorldInverse);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {plex.tags.map((t, n) => {
        const local = (t.shell === "outer" ? plex.outer.pts : plex.mid.pts)[t.i];
        const world = local.clone().applyQuaternion(q).add(CENTER);
        const view = world.clone().applyMatrix4(cam.matrixWorldInverse);
        // Facing: +1 at the front of the shell, -1 at the back.
        const facing = (view.z - centerView.z) / local.length();
        const alpha = Math.min(1, Math.max(0, (facing + 0.45) / 0.35));
        if (alpha <= 0.001) return null;
        const p = world.clone().project(cam);
        const x = (p.x * 0.5 + 0.5) * W;
        const y = (1 - (p.y * 0.5 + 0.5)) * H;
        if (x < -200 || x > W + 50 || y < -50 || y > H + 50) return null;
        const persp = CAM_D / -view.z;
        const size = (t.big ? 34 : 26) * persp * (t.num ? 1 : 0.8);
        return (
          <div
            key={n}
            style={{
              position: "absolute",
              left: x + size * 0.55,
              top: y,
              transform: "translateY(-50%)",
              display: "flex",
              alignItems: "center",
              gap: size * 0.45,
              opacity: alpha * 0.82,
              color: row.tag,
              fontFamily: INTER,
              fontWeight: 500,
              fontSize: size,
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            <svg width={size * 0.8} height={size * 0.7} viewBox="0 0 10 9">
              <path d="M5 0 L10 9 L0 9 Z" fill={row.tag} />
            </svg>
            {t.num ? tagNumber(frame, row.seed, n) : null}
          </div>
        );
      })}
    </div>
  );
};

export const PlexusGlobe: React.FC<{ row: PlexusRow }> = ({ row }) => {
  const build = useMemo(() => makeFactory(row), [row]);
  const post = useMemo<PostParams>(
    () => ({
      bgTop: row.bgTop,
      bgBottom: row.bgTop,
      bgCenter: row.bgBottom,
      // Very wide, centred off the right edge: a smooth left-dark ->
      // right-blue ramp rather than a visible glow spot.
      bgCenterPos: [1.05, 0.72, 0.8],
      bgCenterAmt: 1,
      vignette: 0.5,
      grain: 0.01,
      bloom: { strength: 0.15, threshold: 0.3, radius: 1 },
    }),
    [row],
  );
  return (
    <GLStage build={build} post={post}>
      <Hud color={row.line} />
      <Tags row={row} />
    </GLStage>
  );
};

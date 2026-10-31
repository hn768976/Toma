import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useEffect, useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { StudioEnvironment } from "../common/Environment";
import {
  clamp01,
  easeInOutCubic,
  easeInOutSine,
  interpolateKeys,
  Vec3,
} from "../common/math";
import { PostFX } from "../common/PostFX";

/* ------------------------------------------------------------- layout */

const SPACING = 0.9;
const BAR_W = 0.46;
const BAR_D = 0.34;
const HEIGHTS = [3.0, 2.6, 2.95, 2.0, 1.6, 0.9, 0.62];
const bx = (i: number) => i * SPACING;

/** Seconds at which each bar starts rising (measured from the reference). */
const BAR_START = [0.15, 0.75, 1.25, 2.0, 2.85, 3.6, 4.35];
const BAR_GROW = 0.68;
const barProgress = (i: number, t: number) =>
  easeInOutSine(clamp01((t - BAR_START[i]) / BAR_GROW));

/* ------------------------------------------------------------- ribbon path */

/** Zig-zag through the bar tops: (bar-index, height) control points. */
const PATH_POINTS: [number, number][] = [
  [-0.42, 3.88],
  [1.0, 2.8],
  [2.25, 3.6],
  [3.05, 2.28],
  [3.95, 3.0],
  [5.0, 1.18],
  [5.85, 1.85],
  [6.9, 0.7],
];
const RIBBON_Z = 0.3;
const RIBBON_HALF_W = 0.21; // in the chart plane (flat, wide ribbon)
const RIBBON_HALF_D = 0.08; // depth (towards camera)
const HEAD_HALF_W = 0.4;
const HEAD_LEN = 0.92;

const curve = new THREE.CatmullRomCurve3(
  PATH_POINTS.map(([i, y]) => new THREE.Vector3(i * SPACING, y, RIBBON_Z)),
  false,
  "centripetal",
);

/**
 * Head position along the path (0..1, one unit per control segment / 7).
 * Times at which the head passes each control point, from the reference.
 */
const PASS_TIMES = [0.75, 1.6, 2.2, 3.1, 3.5, 4.4, 4.8, 5.9];
const headU = (t: number) => {
  const segs = PATH_POINTS.length - 1;
  const raw = interpolateKeys(
    t,
    PASS_TIMES,
    PASS_TIMES.map((_, i) => i / segs),
  );
  // soften departure and arrival
  const first = 1 / segs;
  if (raw < first) {
    return easeInOutCubic(raw / first) * 0.6 * first + (raw / first) * 0.4 * first;
  }
  return raw;
};

/** Rounded-rectangle cross-section: (a along in-plane normal, b along z) + normals. */
const PROFILE = (() => {
  const r = 0.035;
  const seg = 6;
  const out: { a: number; b: number; na: number; nb: number }[] = [];
  const corners: [number, number, number][] = [
    [RIBBON_HALF_W - r, RIBBON_HALF_D - r, 0],
    [-(RIBBON_HALF_W - r), RIBBON_HALF_D - r, Math.PI / 2],
    [-(RIBBON_HALF_W - r), -(RIBBON_HALF_D - r), Math.PI],
    [RIBBON_HALF_W - r, -(RIBBON_HALF_D - r), (3 * Math.PI) / 2],
  ];
  for (const [ca, cb, start] of corners) {
    for (let k = 0; k <= seg; k++) {
      const ang = start + (k / seg) * (Math.PI / 2);
      const na = Math.cos(ang);
      const nb = Math.sin(ang);
      out.push({ a: ca + na * r, b: cb + nb * r, na, nb });
    }
  }
  return out;
})();

const buildRibbon = (uEnd: number): THREE.BufferGeometry => {
  const n = Math.max(2, Math.ceil(uEnd * 700));
  const pts: THREE.Vector3[] = [];
  for (let k = 0; k <= n; k++) pts.push(curve.getPoint((uEnd * k) / n));
  const tangents = pts.map((_, k) => {
    const a = pts[Math.max(0, k - 1)];
    const b = pts[Math.min(pts.length - 1, k + 1)];
    const tg = new THREE.Vector3().subVectors(b, a);
    if (tg.lengthSq() < 1e-12) tg.set(1, -1, 0);
    return tg.normalize();
  });
  const m = PROFILE.length;
  const pos: number[] = [];
  const nor: number[] = [];
  const idx: number[] = [];
  for (let k = 0; k <= n; k++) {
    const p = pts[k];
    const sx = -tangents[k].y;
    const sy = tangents[k].x;
    for (const v of PROFILE) {
      pos.push(p.x + sx * v.a, p.y + sy * v.a, p.z + v.b);
      nor.push(sx * v.na, sy * v.na, v.nb);
    }
  }
  for (let k = 0; k < n; k++) {
    for (let j = 0; j < m; j++) {
      const j2 = (j + 1) % m;
      const a = k * m + j;
      const b = k * m + j2;
      const c = (k + 1) * m + j;
      const d = (k + 1) * m + j2;
      idx.push(a, b, c, b, d, c);
    }
  }
  // tail cap (fan)
  const centre = pos.length / 3;
  const t0 = tangents[0];
  pos.push(pts[0].x, pts[0].y, pts[0].z);
  nor.push(-t0.x, -t0.y, 0);
  const capBase = pos.length / 3;
  for (let j = 0; j < m; j++) {
    pos.push(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
    nor.push(-t0.x, -t0.y, 0);
  }
  for (let j = 0; j < m; j++) {
    idx.push(centre, capBase + ((j + 1) % m), capBase + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3));
  g.setIndex(idx);
  return g;
};

const headGeometry = (() => {
  const s = new THREE.Shape();
  s.moveTo(-0.04, -HEAD_HALF_W);
  s.lineTo(HEAD_LEN, 0);
  s.lineTo(-0.04, HEAD_HALF_W);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: RIBBON_HALF_D * 2 - 0.04,
    bevelEnabled: true,
    bevelThickness: 0.03,
    bevelSize: 0.03,
    bevelSegments: 4,
  });
  g.translate(0, 0, -(RIBBON_HALF_D - 0.02));
  return g;
})();

const Ribbon: React.FC<{ t: number }> = ({ t }) => {
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: "#e00404",
        roughness: 0.16,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.08,
        envMapIntensity: 1.5,
      }),
    [],
  );
  const u = headU(t);
  const geometry = useMemo(() => (u > 0.0005 ? buildRibbon(u) : null), [u]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const uh = Math.min(1, Math.max(u, 0));
  const head = curve.getPoint(uh);
  // finite-difference tangent (robust at both ends of the curve)
  const ua = Math.max(0, Math.min(uh, 1 - 0.004));
  const tangent = curve.getPoint(ua + 0.004).sub(curve.getPoint(ua));
  const angle = Math.atan2(tangent.y, tangent.x);
  return (
    <group>
      {geometry ? (
        <mesh geometry={geometry} material={material} castShadow receiveShadow />
      ) : null}
      <mesh
        geometry={headGeometry}
        material={material}
        position={[head.x, head.y, head.z]}
        rotation={[0, 0, angle]}
        castShadow
      />
    </group>
  );
};

/* ------------------------------------------------------------- bars */

const barGeometry = new THREE.BoxGeometry(BAR_W, 1, BAR_D).translate(0, 0.5, 0);

const Bars: React.FC<{ t: number }> = ({ t }) => {
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#f4f4f2",
        roughness: 0.55,
        envMapIntensity: 0.6,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  return (
    <group>
      {HEIGHTS.map((h, i) => {
        const p = barProgress(i, t);
        if (p <= 0) return null;
        return (
          <mesh
            key={i}
            geometry={barGeometry}
            material={material}
            position={[bx(i), 0, 0]}
            scale={[1, Math.max(0.012, h * p), 1]}
            castShadow
            receiveShadow
          />
        );
      })}
    </group>
  );
};

/* ------------------------------------------------------------- studio */

/** Seamless cyclorama: floor sweeping up into a back wall. */
const cycGeometry = (() => {
  const floorFront = 80;
  const wallZ = -9;
  const r = 5;
  const height = 80;
  const profile: [number, number][] = []; // (z, y)
  profile.push([floorFront, 0]);
  profile.push([wallZ + r, 0]);
  for (let k = 1; k <= 24; k++) {
    const a = (k / 24) * (Math.PI / 2);
    profile.push([wallZ + r - Math.sin(a) * r, r - Math.cos(a) * r]);
  }
  profile.push([wallZ, height]);
  const width = 400;
  const pos: number[] = [];
  const idx: number[] = [];
  profile.forEach(([z, y]) => {
    pos.push(-width / 2, y, z, width / 2, y, z);
  });
  for (let k = 0; k < profile.length - 1; k++) {
    const a = k * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
})();

const Studio: React.FC = () => {
  const material = useMemo(
    () => new THREE.MeshStandardMaterial({ color: "#737373", roughness: 0.95 }),
    [],
  );
  return (
    <mesh geometry={cycGeometry} material={material} receiveShadow position={[2.5, 0, 0]} />
  );
};

const KeyLight: React.FC = () => {
  const light = useMemo(() => {
    const l = new THREE.DirectionalLight("#ffffff", 2.8);
    l.position.set(-3.5, 9, 7);
    l.target.position.set(2.6, 0, -0.5);
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    const c = l.shadow.camera;
    c.left = -18;
    c.right = 18;
    c.top = 18;
    c.bottom = -18;
    c.near = 1;
    c.far = 160;
    l.shadow.radius = 28;
    l.shadow.blurSamples = 24;
    l.shadow.bias = -0.0004;
    return l;
  }, []);
  return (
    <>
      <primitive object={light} />
      <primitive object={light.target} />
    </>
  );
};

/* ------------------------------------------------------------- camera */

export type RibbonCameraMode = "static" | "orbit";

const STATIC_CAM = {
  pos: [8.0, 3.3, 9.0] as Vec3,
  target: [3.45, 1.68, 0] as Vec3,
  fov: 29.5,
};

/** Version 2: a crane/arc move sweeping from low front-left to high front-right. */
const ORBIT_PATH = new THREE.CatmullRomCurve3([
  new THREE.Vector3(-4.6, 1.9, 7.6),
  new THREE.Vector3(0.6, 1.9, 10.4),
  new THREE.Vector3(6.2, 3.4, 10.2),
  new THREE.Vector3(9.2, 4.4, 9.6),
]);

const CameraRig: React.FC<{ t: number; mode: RibbonCameraMode; duration: number }> = ({
  t,
  mode,
  duration,
}) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  if (mode === "static") {
    camera.position.set(...STATIC_CAM.pos);
    camera.lookAt(...STATIC_CAM.target);
    camera.fov = STATIC_CAM.fov;
  } else {
    const e = easeInOutSine(t / duration);
    const p = ORBIT_PATH.getPoint(e);
    camera.position.copy(p);
    // follow the action: target drifts with the arrow head
    const head = curve.getPoint(Math.max(0, headU(t)));
    const tx = THREE.MathUtils.lerp(2.4, head.x * 0.35 + 1.9, 0.7);
    const ty = THREE.MathUtils.lerp(1.9, 1.5, e);
    camera.lookAt(tx, ty, 0);
    camera.fov = THREE.MathUtils.lerp(37, 31, e);
  }
  camera.near = 0.1;
  camera.far = 200;
  camera.updateProjectionMatrix();
  return null;
};

/* ------------------------------------------------------------- scene */

const Scene: React.FC<{ mode: RibbonCameraMode }> = ({ mode }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  return (
    <>
      <color attach="background" args={["#8e8e8e"]} />
      <StudioEnvironment intensity={0.1} />
      <CameraRig t={t} mode={mode} duration={durationInFrames / fps} />
      <hemisphereLight args={["#ffffff", "#7a7a7a", 0.9]} />
      <KeyLight />
      <directionalLight position={[9, 4, 6]} intensity={0.45} />
      <Studio />
      <Bars t={t} />
      <Ribbon t={t} />
      <PostFX bloomStrength={0} bloomRadius={0} bloomThreshold={1} />
    </>
  );
};

export const RibbonDecline: React.FC<{ cameraMode: RibbonCameraMode }> = ({
  cameraMode,
}) => {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: "#8e8e8e" }}>
      <ThreeCanvas
        width={width}
        height={height}
        dpr={[0.25, 2]}
        shadows="variance"
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        camera={{ fov: 30, position: [7, 3, 9] }}
      >
        <Scene mode={cameraMode} />
      </ThreeCanvas>
      {/* studio light fall-off: darker toward the left/top-left like the reference */}
      <AbsoluteFill
        style={{
          background:
            "radial-gradient(ellipse 80% 95% at 64% 60%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.26) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

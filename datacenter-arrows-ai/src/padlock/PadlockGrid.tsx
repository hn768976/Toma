/**
 * Look 3 — Padlock Grid. three.js via @remotion/three.
 *
 * Loop: the padlock field, rings, links and floor texture are periodic in x
 * with PERIOD = 2 tiles. The world slides by exactly one PERIOD over 600
 * frames (integer cyc()), so frame 600 == frame 0. Ring spins and link
 * pulses are whole turns / whole passes per loop.
 */
import { useThree } from "@react-three/fiber";
import { MeshReflectorMaterial } from "@react-three/drei";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { cyc, loopFrame } from "../lib/loop";
import { hash01, makeRng } from "../lib/random";
import { canvasTexture } from "../lib/three/canvasTexture";
import { PostFX } from "../lib/three/PostFX";
import { Scene3D, useEnvTexture } from "../lib/three/Scene3D";
import type { PadlockGridProps } from "../versions";

const LOOP = 600;
const TILE_X = 4.8;
const TILE_Z = 4.2;
const PERIOD_TILES = 2;
const PERIOD = TILE_X * PERIOD_TILES;
const COLS = 14; // columns rendered (covers the view + one period of slide)
const ROWS = [0, 1, 2, 3, 4, 5];
const rowZ = (j: number) => 3.4 - j * TILE_Z;
const rowShift = (j: number) => (((j % 2) + 2) % 2) * TILE_X * 0.5;

type Lock = { i: number; j: number; x: number; z: number; yaw: number; seed: number };

/** Padlocks in one canonical period-window, x relative to the slide origin. */
const LOCKS: Lock[] = (() => {
  const out: Lock[] = [];
  for (const j of ROWS) {
    for (let i = -COLS / 2; i < COLS / 2; i++) {
      const im = ((i % PERIOD_TILES) + PERIOD_TILES) % PERIOD_TILES; // pattern index
      const skip = hash01(im, j, 77) < 0.3 && j > 1; // a few gaps, never in the near rows
      if (skip) continue;
      out.push({
        i,
        j,
        x: i * TILE_X + rowShift(j) + (hash01(im, j, 3) - 0.5) * 0.8,
        z: rowZ(j) + (hash01(im, j, 5) - 0.5) * 0.9,
        yaw: (hash01(im, j, 9) - 0.5) * 0.35,
        seed: im * 31 + j,
      });
    }
  }
  return out;
})();

/** Links between neighbouring padlocks (periodic, so the pattern repeats). */
const LINKS: Array<{ a: Lock; b: Lock; pulse: number; k: number }> = (() => {
  const byKey = new Map<string, Lock>();
  for (const l of LOCKS) byKey.set(`${l.i},${l.j}`, l);
  const out: Array<{ a: Lock; b: Lock; pulse: number; k: number }> = [];
  for (const a of LOCKS) {
    const im = ((a.i % PERIOD_TILES) + PERIOD_TILES) % PERIOD_TILES;
    const cands: Array<[number, number]> = [[a.i + 1, a.j]];
    const odd = ((a.j % 2) + 2) % 2;
    cands.push([a.i + odd, a.j + 1]);
    if (hash01(im, a.j, 21) < 0.5) cands.push([a.i + odd - 1, a.j + 1]);
    if (hash01(im, a.j, 23) < 0.25) cands.push([a.i + 2, a.j + 1]);
    for (const [bi, bj] of cands) {
      const b = byKey.get(`${bi},${bj}`);
      if (!b) continue;
      out.push({ a, b, pulse: hash01(im, a.j, bi - a.i + 40), k: 1 + Math.floor(hash01(im, a.j, bj) * 3) });
    }
  }
  return out;
})();

// ------------------------------------------------------------ geometry
const makePadlockGeometry = () => {
  const body = new RoundedBoxGeometry(1.0, 0.86, 0.44, 5, 0.1);
  body.translate(0, 0.43, 0);
  const path = new THREE.CurvePath<THREE.Vector3>();
  const r = 0.29;
  const legTop = 1.12;
  path.add(new THREE.LineCurve3(new THREE.Vector3(-r, 0.7, 0), new THREE.Vector3(-r, legTop, 0)));
  const arcPts: THREE.Vector3[] = [];
  for (let k = 0; k <= 24; k++) {
    const a = Math.PI - (k / 24) * Math.PI;
    arcPts.push(new THREE.Vector3(Math.cos(a) * r, legTop + Math.sin(a) * r, 0));
  }
  path.add(new THREE.CatmullRomCurve3(arcPts));
  path.add(new THREE.LineCurve3(new THREE.Vector3(r, legTop, 0), new THREE.Vector3(r, 0.7, 0)));
  const shackle = new THREE.TubeGeometry(path, 64, 0.085, 14, false);
  const merged = mergeGeometries([body.toNonIndexed(), shackle.toNonIndexed()]);
  merged.computeVertexNormals();
  return merged;
};

const makeKeyholeGeometry = () => {
  const s = new THREE.Shape();
  s.absarc(0, 0.5, 0.085, 0, Math.PI * 2, false);
  const slot = new THREE.Shape();
  slot.moveTo(-0.04, 0.47);
  slot.lineTo(0.04, 0.47);
  slot.lineTo(0.065, 0.22);
  slot.lineTo(-0.065, 0.22);
  slot.closePath();
  const g = mergeGeometries([new THREE.ShapeGeometry(s, 24), new THREE.ShapeGeometry(slot)]);
  g.translate(0, 0, 0.222);
  return g;
};

// ------------------------------------------------------------ textures
const ringTexture = (kind: 0 | 1 | 2) =>
  canvasTexture(1024, 1024, (ctx, w) => {
    const c = w / 2;
    ctx.translate(c, c);
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#fff";
    const rng = makeRng(0x4196 + kind);
    if (kind === 0) {
      // outer: heavy dashed arc segments + thin full circle
      ctx.lineWidth = 34;
      let a = 0;
      while (a < Math.PI * 2 - 0.1) {
        const len = rng.range(0.15, 0.9);
        ctx.beginPath();
        ctx.arc(0, 0, 440, a, Math.min(Math.PI * 2 - 0.06, a + len));
        ctx.stroke();
        a += len + rng.range(0.08, 0.3);
      }
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(0, 0, 480, 0, Math.PI * 2);
      ctx.stroke();
    } else if (kind === 1) {
      // dotted "data" ring: rows of small dashes with gaps
      for (let k = 0; k < 160; k++) {
        if (k % 40 > 30) continue;
        const a = (k / 160) * Math.PI * 2;
        ctx.save();
        ctx.rotate(a);
        ctx.fillRect(352, -4, 18, 8);
        if (k % 3 === 0) ctx.fillRect(385, -3, 10, 6);
        ctx.restore();
      }
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, 0, 315, 0.3, Math.PI * 1.7);
      ctx.stroke();
    } else {
      // inner: thin segmented ring + dots
      ctx.lineWidth = 16;
      for (let k = 0; k < 6; k++) {
        const a0 = (k / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(0, 0, 250, a0, a0 + 0.75);
        ctx.stroke();
      }
      for (let k = 0; k < 36; k++) {
        const a = (k / 36) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 205, Math.sin(a) * 205, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

/** Floor tile: one texture tile = one PERIOD wide, two rows deep. */
const floorTexture = (base: string, line: string) =>
  canvasTexture(
    2048,
    1024,
    (ctx, w, h) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, w, h);
      const rng = makeRng(0xf100);
      // fine grid
      ctx.strokeStyle = "rgba(90,160,255,0.22)";
      ctx.lineWidth = 2;
      const cell = w / 24;
      for (let x = 0; x <= w; x += cell) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y <= h; y += cell) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      // dot lattice
      ctx.fillStyle = "rgba(120,190,255,0.35)";
      for (let x = cell / 2; x < w; x += cell / 2)
        for (let y = cell / 2; y < h; y += cell / 2) ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
      // circuit traces (wrap-safe: drawn three times offset by the tile size)
      const traces: Array<Array<[number, number]>> = [];
      for (let t = 0; t < 46; t++) {
        let x = rng.range(0, w);
        let y = rng.range(0, h);
        const pts: Array<[number, number]> = [[x, y]];
        const steps = rng.int(2, 5);
        for (let s = 0; s < steps; s++) {
          const dir = rng.int(0, 3);
          const len = rng.range(40, 260);
          if (dir === 0) x += len;
          else if (dir === 1) y += len;
          else if (dir === 2) {
            x += len * 0.7;
            y += len * 0.7;
          } else {
            x += len * 0.7;
            y -= len * 0.7;
          }
          pts.push([x, y]);
        }
        traces.push(pts);
      }
      for (const [ox, oy] of [
        [0, 0], [-w, 0], [w, 0], [0, -h], [0, h], [-w, -h], [w, h], [-w, h], [w, -h],
      ]) {
        for (let t = 0; t < traces.length; t++) {
          const pts = traces[t];
          const bright = t % 5 === 0;
          ctx.strokeStyle = bright ? line : "rgba(40,170,255,0.45)";
          ctx.lineWidth = bright ? 5 : 3;
          ctx.beginPath();
          pts.forEach(([px, py], k) => (k ? ctx.lineTo(px + ox, py + oy) : ctx.moveTo(px + ox, py + oy)));
          ctx.stroke();
          const [ex, ey] = pts[pts.length - 1];
          ctx.fillStyle = bright ? "#bfe8ff" : "rgba(110,190,255,0.8)";
          ctx.beginPath();
          ctx.arc(ex + ox, ey + oy, bright ? 8 : 5, 0, Math.PI * 2);
          ctx.fill();
        }
        // short glowing dashes
        for (let d = 0; d < 30; d++) {
          const x = (hash01(d, 1) * w + ox);
          const y = (hash01(d, 2) * h + oy);
          ctx.fillStyle = "rgba(140,210,255,0.8)";
          ctx.fillRect(x, y, 20 + hash01(d, 3) * 70, 4);
        }
      }
    },
    { repeat: true, anisotropy: 16 },
  );

// ------------------------------------------------------------ scene
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

const CAM_POS = new THREE.Vector3(TILE_X / 2, 2.55, 7.2);
const CAM_TARGET = new THREE.Vector3(TILE_X / 2, 0.15, -1.6);

const RING_SPECS = [
  { kind: 0 as const, size: 3.4, turns: 1, color: 1.6 },
  { kind: 1 as const, size: 3.05, turns: -2, color: 1.4 },
  { kind: 2 as const, size: 2.45, turns: 1, color: 1.5 },
];

/** Fresnel rim glow on the padlocks, so they read as glowing holograms. */
const rimGlow = (shader: { fragmentShader: string }) => {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <emissivemap_fragment>",
    `#include <emissivemap_fragment>
    float rimF = pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.2);
    totalEmissiveRadiance += vec3(0.1, 0.65, 1.1) * rimF * 1.0;`,
  );
};

const PadlockScene: React.FC<PadlockGridProps & { frame: number }> = (p) => {
  const { frame } = p;
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const dpr = useThree((s) => s.viewport.dpr);
  const env = useEnvTexture();
  const lockGeo = useMemo(makePadlockGeometry, []);
  const keyGeo = useMemo(makeKeyholeGeometry, []);
  const ringTex = useMemo(() => [ringTexture(0), ringTexture(1), ringTexture(2)], []);
  const floorTex = useMemo(() => floorTexture(p.floor, p.line), [p.floor, p.line]);
  const lineGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const ringGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, 1);
    g.rotateX(-Math.PI / 2);
    return g;
  }, []);
  const dotGeo = useMemo(() => new THREE.SphereGeometry(1, 12, 8), []);

  const lockRef = useRef<THREE.InstancedMesh>(null);
  const keyRef = useRef<THREE.InstancedMesh>(null);
  const ringRefs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];
  const linkRef = useRef<THREE.InstancedMesh>(null);
  const pulseRef = useRef<THREE.InstancedMesh>(null);
  const floorRef = useRef<THREE.Mesh>(null);

  const ringColor = useMemo(() => new THREE.Color(p.ring), [p.ring]);
  const lineColor = useMemo(() => new THREE.Color(p.line).multiplyScalar(3), [p.line]);

  useLayoutEffect(() => {
    // world slides left by exactly one PERIOD per loop
    const slide = cyc(frame, 1, LOOP) * PERIOD;

    camera.position.copy(CAM_POS);
    camera.lookAt(CAM_TARGET);

    LOCKS.forEach((l, n) => {
      const x = l.x - slide;
      tmpQ.setFromAxisAngle(UP, l.yaw);
      tmpP.set(x, 0.02, l.z);
      tmpS.set(1, 1, 1);
      tmpM.compose(tmpP, tmpQ, tmpS);
      lockRef.current!.setMatrixAt(n, tmpM);
      keyRef.current!.setMatrixAt(n, tmpM);
      RING_SPECS.forEach((rs, ri) => {
        const ang = 2 * Math.PI * cyc(frame, rs.turns, LOOP) + l.seed * 0.7 * (ri + 1);
        tmpQ.setFromAxisAngle(UP, ang);
        tmpP.set(x, 0.012 + ri * 0.004, l.z);
        tmpS.set(rs.size, 1, rs.size);
        tmpM.compose(tmpP, tmpQ, tmpS);
        ringRefs[ri].current!.setMatrixAt(n, tmpM);
      });
    });
    lockRef.current!.instanceMatrix.needsUpdate = true;
    keyRef.current!.instanceMatrix.needsUpdate = true;
    ringRefs.forEach((r) => (r.current!.instanceMatrix.needsUpdate = true));

    LINKS.forEach((lk, n) => {
      const ax = lk.a.x - slide;
      const bx = lk.b.x - slide;
      const dx = bx - ax;
      const dz = lk.b.z - lk.a.z;
      const len = Math.hypot(dx, dz);
      tmpQ.setFromAxisAngle(UP, -Math.atan2(dz, dx));
      tmpP.set((ax + bx) / 2, 0.008, (lk.a.z + lk.b.z) / 2);
      tmpS.set(len, 1, 0.016);
      tmpM.compose(tmpP, tmpQ, tmpS);
      linkRef.current!.setMatrixAt(n, tmpM);
      // one light pulse per link, whole passes per loop
      const t = (cyc(frame, lk.k, LOOP) + lk.pulse) % 1;
      tmpP.set(ax + dx * t, 0.03, lk.a.z + dz * t);
      tmpQ.identity();
      const vis = lk.pulse < 0.5 ? Math.sin(Math.PI * t) : 0;
      tmpS.setScalar(0.03 * vis);
      tmpM.compose(tmpP, tmpQ, tmpS);
      pulseRef.current!.setMatrixAt(n, tmpM);
    });
    linkRef.current!.instanceMatrix.needsUpdate = true;
    pulseRef.current!.instanceMatrix.needsUpdate = true;

    // floor texture slides with the world: one PERIOD = one texture tile
    floorRef.current!.position.x = -slide;
  }, [frame, camera, LOCKS, LINKS]);

  const FLOOR_W = PERIOD * 10;
  const FLOOR_D = TILE_Z * 2 * 10;
  useLayoutEffect(() => {
    floorTex.repeat.set(10, 10);
  }, [floorTex]);

  const reflRes = Math.round(1536 * Math.min(1, dpr * 1.5));

  return (
    <>
      <fog attach="fog" args={[p.background, 12, 36]} />
      <hemisphereLight args={["#1aa0ff", "#0088ff", 0.5]} />
      <directionalLight position={[-4, 8, 6]} intensity={0.45} color="#3a9cff" />
      <pointLight position={[0, 6, -6]} intensity={30} distance={30} color="#4aa8ff" />

      <instancedMesh ref={lockRef} args={[lockGeo, undefined, LOCKS.length]} frustumCulled={false}>
        <meshStandardMaterial
          color={p.padlock}
          onBeforeCompile={rimGlow}
          roughness={0.42}
          metalness={0.05}
          emissive="#0a86e8"
          emissiveIntensity={0.5}
          envMap={env}
          envMapIntensity={0.02}
        />
      </instancedMesh>
      <instancedMesh ref={keyRef} args={[keyGeo, undefined, LOCKS.length]} frustumCulled={false}>
        <meshStandardMaterial color="#1e5c9c" roughness={0.6} emissive="#1a64b8" emissiveIntensity={0.6} />
      </instancedMesh>
      {RING_SPECS.map((rs, ri) => (
        <instancedMesh key={ri} ref={ringRefs[ri]} args={[ringGeo, undefined, LOCKS.length]} frustumCulled={false}>
          <meshBasicMaterial
            map={ringTex[ri]}
            color={ringColor.clone().multiplyScalar(rs.color)}
            transparent
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </instancedMesh>
      ))}
      <instancedMesh ref={linkRef} args={[lineGeo, undefined, LINKS.length]} frustumCulled={false}>
        <meshBasicMaterial color={lineColor} transparent opacity={0.5} blending={THREE.AdditiveBlending} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={pulseRef} args={[dotGeo, undefined, LINKS.length]} frustumCulled={false}>
        <meshBasicMaterial color={new THREE.Color("#6fd8ff").multiplyScalar(4)} />
      </instancedMesh>

      <mesh ref={floorRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -8]}>
        <planeGeometry args={[FLOOR_W, FLOOR_D]} />
        <MeshReflectorMaterial
          resolution={reflRes}
          blur={[Math.round(140 * dpr * 3), Math.round(50 * dpr * 3)]}
          mixBlur={1.2}
          mixStrength={18}
          mirror={0.6}
          roughness={1}
          metalness={0}
          envMapIntensity={0}
          depthScale={0}
          map={floorTex}
          emissiveMap={floorTex}
          emissive="#ffffff"
          emissiveIntensity={0.24}
          color="#ffffff"
        />
      </mesh>

      <PostFX
        grainFrame={loopFrame(frame, LOOP)}
        bloom={{ intensity: 1.15, threshold: 0.7, smoothing: 0.3, radius: 0.8 }}
        dof={{ focusDistance: 8.9, focusRange: 2.6, bokehScale: 8 }}
      />
    </>
  );
};

export const PadlockGrid: React.FC<PadlockGridProps> = (props) => {
  const frame = useCurrentFrame();
  return (
    <Scene3D background={props.background} fov={32} near={0.5} far={80}>
      <PadlockScene {...props} frame={frame} />
    </Scene3D>
  );
};

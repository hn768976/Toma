/**
 * Look 1 — Data Center. three.js via @remotion/three. 600-frame loop.
 *
 * Loop: the room (racks, ceiling panels, overhead arcs) is periodic along
 * the row with ROOM_PERIOD = 8 racks, and slides by exactly one
 * ROOM_PERIOD over the loop (integer cyc()). Stream heads travel whole
 * wraps per loop. LED blink periods all divide 600. Grain uses frame % 600.
 */
import { MeshReflectorMaterial } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { smoothstep } from "../lib/ease";
import { cyc, loopFrame } from "../lib/loop";
import { hash01, makeRng } from "../lib/random";
import { canvasTexture } from "../lib/three/canvasTexture";
import { PostFX } from "../lib/three/PostFX";
import { Scene3D, useEnvTexture } from "../lib/three/Scene3D";
import type { DataCenterProps } from "../versions";
import { makeRackTextures, VARIANTS } from "./rackTextures";
import { rackFragment, rackVertex, streamFragment, streamVertex } from "./shaders";
import { buildStreamGeometry, type StreamLine } from "./streams";

const LOOP = 600;
const RACK_W = 0.82; // rack pitch along the row (m)
const RACK_H = 2.3;
const RACK_D = 1.1;
const PATTERN = 8; // racks per repeat of seeds / panels / arcs
const ROOM_PERIOD = RACK_W * PATTERN;
const CEIL_Y = 3.25;
/** 1B: far wall of racks, fixed relative to the camera. */
const BACK_WALL_Z = -9;
const Z_NEAR = 9;
const Z_FAR = -52;

type Mode = DataCenterProps["mode"];

/** Rows of racks: x of the front face and which way it faces (+1: +x). */
const ROWS: Record<Mode, Array<{ x: number; facing: 1 | -1 }>> = {
  sideStreaks: [
    { x: 0, facing: -1 },
    { x: -4.6, facing: 1 }, // opposite row, mostly behind the camera
  ],
  aisleFibres: [
    { x: -2.0, facing: 1 },
    { x: 2.0, facing: -1 },
  ],
};

const rackIndices = () => {
  const i0 = Math.floor((Z_FAR - ROOM_PERIOD) / RACK_W) - 1;
  const i1 = Math.ceil(Z_NEAR / RACK_W) + 1;
  const out: number[] = [];
  for (let i = i0; i <= i1; i++) out.push(i);
  return out;
};
const RACK_IDX = rackIndices();
const mod = (a: number, n: number) => ((a % n) + n) % n;

// ------------------------------------------------------------ geometry
const cabinetGeometry = () => {
  // canonical rack: front faces +z, centred on x, base at y=0, front at z=0
  const body = new THREE.BoxGeometry(RACK_W - 0.025, RACK_H, RACK_D);
  body.translate(0, RACK_H / 2, -RACK_D / 2 - 0.02);
  return body;
};
const frameGeometry = () => {
  const t = 0.045;
  const parts: THREE.BufferGeometry[] = [];
  const w = RACK_W - 0.03;
  const add = (sx: number, sy: number, x: number, y: number) => {
    const g = new THREE.BoxGeometry(sx, sy, 0.05);
    g.translate(x, y, 0.0);
    parts.push(g);
  };
  add(t, RACK_H, -w / 2 + t / 2, RACK_H / 2);
  add(t, RACK_H, w / 2 - t / 2, RACK_H / 2);
  add(w, t * 1.4, 0, RACK_H - t * 0.7);
  add(w, t * 2.2, 0, t * 1.1);
  return mergeGeometries(parts);
};
const frontGeometry = () => {
  const g = new THREE.PlaneGeometry(RACK_W - 0.12, RACK_H - 0.16);
  g.translate(0, RACK_H / 2 + 0.01, -0.015);
  return g;
};

// ------------------------------------------------------------- streams
const sideStreakLines = (): StreamLine[] => {
  const rng = makeRng(0x57ea4);
  const lines: StreamLine[] = [];
  for (let k = 0; k < 36; k++) {
    const near = rng.chance(0.75);
    const x = -(near ? rng.range(0.04, 0.22) : rng.range(0.25, 0.55));
    const y = rng.range(0.15, 2.25);
    const toward = rng.chance(0.35);
    const a = new THREE.Vector3(x, y, Z_FAR);
    const b = new THREE.Vector3(x, y, Z_NEAR);
    const wrap = rng.range(14, 30);
    lines.push({
      pts: toward ? [a, b] : [b, a],
      speed: rng.int(5, 12),
      wrap,
      phase: rng.next(),
      bright: near ? (rng.chance(0.2) ? 1.8 : rng.range(0.6, 1.1)) : rng.range(0.3, 0.8),
      trail: rng.range(2.5, 8),
    });
  }
  // short "light dots"
  for (let k = 0; k < 24; k++) {
    const x = -rng.range(0.05, 0.5);
    const y = rng.range(0.2, 2.2);
    lines.push({
      pts: [new THREE.Vector3(x, y, Z_NEAR), new THREE.Vector3(x, y, Z_FAR)],
      speed: rng.int(6, 14),
      wrap: rng.range(10, 24),
      phase: rng.next(),
      bright: rng.range(0.6, 1.2),
      trail: rng.range(0.25, 0.6),
    });
  }
  return lines;
};

const aisleFibreLines = (): StreamLine[] => {
  const rng = makeRng(0xf1b4e);
  const lines: StreamLine[] = [];
  const VP = new THREE.Vector3(0, 1.45, -9);
  /** n strands from a near anchor towards the far end, optionally sagging into an arc. */
  const bundle = (n: number, near: THREE.Vector3, far: THREE.Vector3, spread: number, sag: number, bright: number) => {
    for (let k = 0; k < n; k++) {
      const o = (k / Math.max(1, n - 1) - 0.5) * spread;
      const a = near.clone().add(new THREE.Vector3(o, o * 0.3 + rng.range(-0.03, 0.03), 0));
      const c = far.clone().add(new THREE.Vector3(o * 0.25, o * 0.08, 0));
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 20; s++) {
        const t = s / 20;
        const p = a.clone().lerp(c, t);
        p.y += sag * Math.sin(Math.PI * t);
        pts.push(p);
      }
      lines.push({
        pts,
        speed: rng.int(4, 9),
        wrap: rng.range(1.6, 3.2),
        phase: rng.next(),
        bright: bright * rng.range(0.75, 1.15),
        trail: rng.range(0.15, 0.4),
      });
    }
  };
  // bundles enter the aisle at different heights and end on the far wall
  const far = (dx: number, y: number) => new THREE.Vector3(VP.x + dx, y, BACK_WALL_Z + 0.4);
  // floor lanes
  bundle(10, new THREE.Vector3(-0.7, 0.03, 4), far(-0.45, 0.05), 0.5, 0, 1);
  bundle(8, new THREE.Vector3(0.9, 0.03, 4), far(0.35, 0.05), 0.4, 0, 0.9);
  bundle(7, new THREE.Vector3(-1.6, 0.03, 4), far(-1.2, 0.05), 0.3, 0, 0.8);
  // from the top corners, arcing overhead
  bundle(9, new THREE.Vector3(-1.75, 3.1, 1.2), far(-0.5, 1.55), 0.45, 0.6, 1);
  bundle(9, new THREE.Vector3(1.75, 3.1, 1.2), far(0.9, 1.85), 0.45, 0.6, 1);
  // hanging centre bundle
  bundle(8, new THREE.Vector3(0.05, 3.15, 0.5), far(0.05, 2.0), 0.4, 0.2, 0.9);
  // mid-height bundles crossing in front of the racks
  bundle(8, new THREE.Vector3(-1.85, 0.75, 3), far(-0.9, 1.15), 0.35, 0.25, 1);
  bundle(8, new THREE.Vector3(1.85, 0.35, 3), far(0.6, 1.0), 0.35, 0.3, 1);
  return lines;
};

const streamMaterial = (color: string, hot: string, width: number, minWidth: number) =>
  new THREE.ShaderMaterial({
    vertexShader: streamVertex,
    fragmentShader: streamFragment,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uPhase: { value: 0 },
        uGain: { value: 1 },
        uBaseGlow: { value: 0.05 },
        uColor: { value: new THREE.Color(color) },
        uHot: { value: new THREE.Color(hot) },
        uWidth: { value: width },
        uMinWidth: { value: minWidth },
      },
    ]),
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: true,
  });

// ---------------------------------------------------------------- scene
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpP = new THREE.Vector3();
const tmpS = new THREE.Vector3(1, 1, 1);
const UP = new THREE.Vector3(0, 1, 0);

const CAMERAS: Record<Mode, { pos: THREE.Vector3; target: THREE.Vector3; fov: number }> = {
  sideStreaks: { pos: new THREE.Vector3(-1.6, 1.0, 0.6), target: new THREE.Vector3(1.0, 1.2, -2.0), fov: 60 },
  aisleFibres: { pos: new THREE.Vector3(0, 1.3, 2.5), target: new THREE.Vector3(0, 1.4, -8), fov: 58 },
};

/**
 * 1B: a wall of racks facing the camera at the far end of the aisle. It is
 * fixed relative to the camera (deep in the haze), so the loop is unaffected.
 */
const BackWall: React.FC<{
  cabGeo: THREE.BufferGeometry;
  frameGeo: THREE.BufferGeometry;
  frontMat: THREE.Material;
  env: THREE.Texture | null;
}> = ({ cabGeo, frameGeo, frontMat, env }) => {
  const n = 7;
  const frontGeo = useMemo(() => {
    const g = frontGeometry();
    const v = new Float32Array(n);
    const sd = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      sd[i] = 40 + i;
      v[i] = i % VARIANTS;
    }
    g.setAttribute("aVariant", new THREE.InstancedBufferAttribute(v, 1));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(sd, 1));
    return g;
  }, []);
  const refs = [useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null), useRef<THREE.InstancedMesh>(null)];
  useLayoutEffect(() => {
    for (let i = 0; i < n; i++) {
      tmpM.makeTranslation((i - (n - 1) / 2) * RACK_W, 0, BACK_WALL_Z);
      refs.forEach((r) => r.current!.setMatrixAt(i, tmpM));
    }
    refs.forEach((r) => (r.current!.instanceMatrix.needsUpdate = true));
  });
  return (
    <>
      <instancedMesh ref={refs[0]} args={[cabGeo, undefined, n]} frustumCulled={false}>
        <meshStandardMaterial color="#14171c" metalness={0.75} roughness={0.38} envMap={env} envMapIntensity={0.15} />
      </instancedMesh>
      <instancedMesh ref={refs[1]} args={[frameGeo, undefined, n]} frustumCulled={false}>
        <meshStandardMaterial color="#2a3140" metalness={1} roughness={0.35} envMap={env} envMapIntensity={0.3} />
      </instancedMesh>
      <instancedMesh ref={refs[2]} args={[frontGeo, frontMat, n]} frustumCulled={false} />
    </>
  );
};

const Room: React.FC<DataCenterProps & { frame: number }> = (p) => {
  const { frame, mode } = p;
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const dpr = useThree((s) => s.viewport.dpr);
  const env = useEnvTexture();
  const lf = loopFrame(frame, LOOP);
  const side = mode === "sideStreaks";
  const rows = ROWS[mode];
  const rackCount = rows.length * RACK_IDX.length;

  const tex = useMemo(makeRackTextures, []);
  const cabGeo = useMemo(cabinetGeometry, []);
  const frameGeo = useMemo(frameGeometry, []);
  const frontGeo = useMemo(() => {
    const g = frontGeometry();
    const variants = new Float32Array(rackCount);
    const seeds = new Float32Array(rackCount);
    let n = 0;
    for (let r = 0; r < rows.length; r++)
      for (const i of RACK_IDX) {
        const seed = mod(i, PATTERN) + r * PATTERN;
        seeds[n] = seed;
        variants[n] = Math.floor(hash01(seed, 5) * VARIANTS);
        n++;
      }
    g.setAttribute("aVariant", new THREE.InstancedBufferAttribute(variants, 1));
    g.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 1));
    return g;
  }, [rackCount, rows.length]);

  const frontMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: rackVertex,
        fragmentShader: rackFragment,
        uniforms: THREE.UniformsUtils.merge([
          THREE.UniformsLib.fog,
          {
            uBase: { value: null },
            uMask: { value: null },
            uFrame: { value: 0 },
            uGreen: { value: new THREE.Color() },
            uBlue: { value: new THREE.Color() },
            uWhite: { value: new THREE.Color("#dff4ff") },
            uLedGain: { value: 4 },
            uBaseGain: { value: 1 },
            uWashColor: { value: new THREE.Color() },
            uWash: { value: 0 },
            uSheen: { value: new THREE.Color() },
            uEdgeColor: { value: new THREE.Color() },
            uBaseTint: { value: new THREE.Vector3(1, 1, 1) },
          },
        ]),
        fog: true,
      }),
    [],
  );
  useLayoutEffect(() => {
    frontMat.uniforms.uBase.value = tex.base;
    frontMat.uniforms.uMask.value = tex.mask;
  }, [frontMat, tex]);

  const streamLines = useMemo(() => (side ? sideStreakLines() : aisleFibreLines()), [side]);
  const streamGeo = useMemo(() => buildStreamGeometry(streamLines), [streamLines]);
  const streamMat = useMemo(
    () => streamMaterial(p.stream, p.streamHot, side ? 0.015 : 0.02, 0.0016),
    [p.stream, p.streamHot, side],
  );

  const cabRef = useRef<THREE.InstancedMesh>(null);
  const frameRef = useRef<THREE.InstancedMesh>(null);
  const frontRef = useRef<THREE.InstancedMesh>(null);
  const panelRef = useRef<THREE.InstancedMesh>(null);
  // ceiling tiles, one tile per rack pitch so the grid slides in step with the room
  const ceilTex = useMemo(
    () =>
      canvasTexture(256, 256, (ctx, w) => {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, w);
        ctx.fillStyle = "#8a96a8";
        ctx.fillRect(0, 0, w, 6);
        ctx.fillRect(0, 0, 6, w);
      }, { repeat: true }),
    [],
  );
  const CEIL_W = 14;
  const CEIL_D = Z_NEAR - Z_FAR + 10;
  useLayoutEffect(() => {
    ceilTex.repeat.set(CEIL_W / RACK_W, CEIL_D / RACK_W);
  }, [ceilTex, CEIL_D]);

  const panelSpots = useMemo(() => {
    const xs = side ? [-2.3, -0.2] : [];
    const out: Array<{ x: number; j: number }> = [];
    for (const x of xs) for (let j = -9; j <= 2; j++) out.push({ x, j });
    return out;
  }, [side]);

  // 1A: streak intensity envelope — green room at the loop start, quickly
  // flooded with blue streaks, easing back before the seam.
  const env1A = side ? 0.06 + 0.94 * smoothstep(0, 70, lf) * (1 - smoothstep(520, 600, lf)) : 1;

  useLayoutEffect(() => {
    const cam = CAMERAS[mode];
    camera.position.copy(cam.pos);
    camera.lookAt(cam.target);

    // room slides along +z by one ROOM_PERIOD per loop
    const slide = cyc(frame, 1, LOOP) * ROOM_PERIOD;

    let n = 0;
    rows.forEach((row) => {
      tmpQ.setFromAxisAngle(UP, row.facing * Math.PI / 2);
      for (const i of RACK_IDX) {
        const z = i * RACK_W + slide;
        tmpP.set(row.x, 0, z);
        tmpM.compose(tmpP, tmpQ, tmpS);
        cabRef.current!.setMatrixAt(n, tmpM);
        frameRef.current!.setMatrixAt(n, tmpM);
        frontRef.current!.setMatrixAt(n, tmpM);
        n++;
      }
    });
    cabRef.current!.instanceMatrix.needsUpdate = true;
    frameRef.current!.instanceMatrix.needsUpdate = true;
    frontRef.current!.instanceMatrix.needsUpdate = true;

    panelSpots.forEach((ps, k) => {
      tmpP.set(ps.x, CEIL_Y - 0.03, ps.j * ROOM_PERIOD + slide);
      tmpQ.identity();
      tmpM.compose(tmpP, tmpQ, tmpS);
      panelRef.current!.setMatrixAt(k, tmpM);
    });
    panelRef.current!.instanceMatrix.needsUpdate = true;
    ceilTex.offset.set(0, -slide / RACK_W);

    const u = frontMat.uniforms;
    u.uFrame.value = lf;
    (u.uGreen.value as THREE.Color).set(p.ledGreen);
    (u.uBlue.value as THREE.Color).set(p.ledBlue);
    (u.uEdgeColor.value as THREE.Color).set(p.stream).multiplyScalar(side ? 0 : 1.6);
    u.uLedGain.value = side ? 7 : 3.6;
    u.uBaseGain.value = side ? 1.3 : 2.4;
    (u.uBaseTint.value as THREE.Vector3).set(side ? 0.45 : 0.8, side ? 0.75 : 0.95, side ? 1.35 : 1.1);
    (u.uWashColor.value as THREE.Color).set(side ? "#0a50ff" : p.stream).multiplyScalar(side ? 0.16 : 0.07);
    u.uWash.value = env1A;
    (u.uSheen.value as THREE.Color).set(side ? "#0a3cb0" : "#0c3a60").multiplyScalar(side ? 0.22 + 0.15 * env1A : 0.7);

    const phase = cyc(frame, 1, LOOP);
    streamMat.uniforms.uPhase.value = phase;
    streamMat.uniforms.uGain.value = side ? 2.4 * env1A : 2.6;
    streamMat.uniforms.uBaseGlow.value = side ? 0.12 : 0.4;
  }, [frame, lf, camera, mode, rows, panelSpots, frontMat, streamMat, env1A, side, ceilTex, p.ledGreen, p.ledBlue, p.stream]);

  const fogColor = useMemo(() => {
    const c = new THREE.Color(p.fog);
    if (side) c.lerp(new THREE.Color("#0f5cc0"), 0.35 * env1A);
    return c;
  }, [p.fog, side, env1A]);
  const panelColor = useMemo(() => new THREE.Color(p.ceiling).multiplyScalar(side ? 4 : 0.12), [p.ceiling, side]);
  const ceilColor = useMemo(() => new THREE.Color(side ? "#24427a" : "#0a3050").lerp(new THREE.Color("#3a6cd0"), side ? 0.4 * env1A : 0), [side, env1A]);

  const reflRes = Math.round(2048 * Math.min(1, dpr * 1.5));

  return (
    <>
      <fogExp2 attach="fog" args={[fogColor, side ? 0.022 : 0.045]} />
      <color attach="background" args={[fogColor]} />
      <hemisphereLight args={["#a8d4ff", "#0a1a30", side ? 0.5 : 0.35]} />

      <instancedMesh ref={cabRef} args={[cabGeo, undefined, rackCount]} frustumCulled={false}>
        <meshStandardMaterial color="#14171c" metalness={0.75} roughness={0.38} envMap={env} envMapIntensity={side ? 0.45 : 0.15} />
      </instancedMesh>
      <instancedMesh ref={frameRef} args={[frameGeo, undefined, rackCount]} frustumCulled={false}>
        <meshStandardMaterial
          color={side ? "#5a78b8" : "#2a3140"}
          metalness={1}
          roughness={0.35}
          envMap={env}
          envMapIntensity={side ? 0.18 : 0.3}
        />
      </instancedMesh>
      <instancedMesh ref={frontRef} args={[frontGeo, frontMat, rackCount]} frustumCulled={false} />

      {!side ? <BackWall cabGeo={cabGeo} frameGeo={frameGeo} frontMat={frontMat} env={env} /> : null}

      {/* ceiling + light panels */}
      <mesh position={[side ? -1.5 : 0, CEIL_Y, (Z_NEAR + Z_FAR) / 2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[CEIL_W, CEIL_D]} />
        <meshBasicMaterial color={ceilColor} map={side ? ceilTex : null} />
      </mesh>
      <instancedMesh ref={panelRef} args={[undefined, undefined, panelSpots.length]} frustumCulled={false}>
        <boxGeometry args={side ? [0.32, 0.04, 3.2] : [0.5, 0.04, 1.2]} />
        <meshBasicMaterial color={panelColor} />
      </instancedMesh>

      {/* light streams / fibres */}
      <mesh geometry={streamGeo} material={streamMat} frustumCulled={false} />

      {/* glossy reflective floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[side ? -1.5 : 0, 0, (Z_NEAR + Z_FAR) / 2]}>
        <planeGeometry args={[16, Z_NEAR - Z_FAR + 10]} />
        <MeshReflectorMaterial
          resolution={reflRes}
          blur={[Math.round((side ? 120 : 300) * dpr * 3), Math.round((side ? 520 : 140) * dpr * 3)]}
          mixBlur={0.8}
          mixStrength={side ? 22 : 14}
          mirror={0.85}
          roughness={0.6}
          metalness={0}
          depthScale={0}
          envMapIntensity={0}
          color={side ? "#2f5cae" : "#2a6e8c"}
        />
      </mesh>

      <PostFX
        grainFrame={lf}
        bloom={{ intensity: side ? 1.6 : 1.7, threshold: 0.6, smoothing: 0.35, radius: 0.88 }}
        dof={{ focusDistance: side ? 6 : 8, focusRange: side ? 12 : 12, bokehScale: 1.6 }}
      />
    </>
  );
};

export const DataCenter: React.FC<DataCenterProps> = (props) => {
  const frame = useCurrentFrame();
  const fov = CAMERAS[props.mode].fov;
  return (
    <Scene3D background={props.background} fov={fov} near={0.1} far={80}>
      <Room {...props} frame={frame} />
    </Scene3D>
  );
};

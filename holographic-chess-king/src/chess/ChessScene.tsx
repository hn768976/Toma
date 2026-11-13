import { useCallback } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { Easing, interpolate } from "remotion";
import { ThreeStage, StageInfo } from "../lib/ThreeStage";
import { mulberry32 } from "../lib/random";
import {
  bishopGeometry,
  kingGeometry,
  pawnGeometry,
  queenGeometry,
  rookGeometry,
} from "./pieces";
import {
  gradeShader,
  holoRingFragment,
  holoRingVertex,
  nodeFragment,
  nodeVertex,
  rayFragment,
  rayVertex,
} from "./shaders";

export type CameraMode = "reference" | "orbit";
export type ChessSceneProps = { cameraMode: CameraMode };

const FPS = 30;
const clampOpts = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Timeline measured frame-by-frame from the reference (frames @30fps, 300 total):
// a neon-style ignition flicker (single-frame flash at f21, dark, a partial glow
// f26–28, full on at f29) and a fast power-down at f270–271.
const IGNITION_KEYS: [number, number][] = [
  [20, 0], [21, 1.05], [22, 0.06], [25, 0.08], [26, 0.32], [27, 0.55], [28, 0.42],
  [29, 1.0], [269, 1.0], [270, 0.62], [271, 0.06], [272, 0],
];

const CYAN = new THREE.Color("#35d6ff");
const HOLO = new THREE.Color("#b8f4ff");
const GREEN = new THREE.Color("#2dff96");

/** 0 → 1 king illumination following the reference's flicker keys. */
const kingLight = (frame: number) =>
  interpolate(
    frame,
    IGNITION_KEYS.map((k) => k[0]),
    IGNITION_KEYS.map((k) => k[1]),
    clampOpts,
  );

const checkerTexture = () => {
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = x < size / 2 ? 0 : 1;
      const cy = y < size / 2 ? 0 : 1;
      const light = (cx + cy) % 2 === 0;
      const lx = x % (size / 2);
      const ly = y % (size / 2);
      const seam = lx < 1 || ly < 1 || lx > size / 2 - 2 || ly > size / 2 - 2;
      const c = light ? [30, 62, 98] : [5, 12, 24];
      const k = seam ? 0.55 : 1;
      const i = (y * size + x) * 4;
      data[i] = c[0] * k;
      data[i + 1] = c[1] * k;
      data[i + 2] = c[2] * k;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
};

type HoloRing = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; speed: number; base: number };

const makeHoloRing = (
  inner: number,
  outer: number,
  y: number,
  opts: { dashes?: number; duty?: number; intensity: number; speed?: number; color?: THREE.Color; depthTest?: boolean },
): HoloRing => {
  const geo = new THREE.RingGeometry(inner, outer, 256, 1);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: (opts.color ?? HOLO).clone() },
      uIntensity: { value: opts.intensity },
      uInner: { value: inner },
      uOuter: { value: outer },
      uDashes: { value: opts.dashes ?? 0 },
      uDuty: { value: opts.duty ?? 0.5 },
      uRotation: { value: 0 },
    },
    vertexShader: holoRingVertex,
    fragmentShader: holoRingFragment,
    transparent: true,
    depthWrite: false,
    depthTest: opts.depthTest ?? true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  return { mesh, mat, speed: opts.speed ?? 0, base: opts.intensity };
};

const BG_PIECE_SCALE = 1.15;

type PieceSpec = { kind: "rook" | "pawn" | "queen" | "bishop"; x: number; z: number; rot?: number };

// Background pieces, arranged like the reference frame (king front-left,
// rook far left, pawn cluster centre, queen and pawns to the right).
const PIECES: PieceSpec[] = [
  { kind: "rook", x: -2.0, z: -2.8 },
  { kind: "pawn", x: 0.9, z: -4.3 },
  { kind: "pawn", x: 1.35, z: -4.9 },
  { kind: "pawn", x: 1.5, z: -3.6 },
  { kind: "queen", x: 2.75, z: -4.6 },
  { kind: "pawn", x: 2.8, z: -2.6 },
  { kind: "pawn", x: 3.9, z: -4.4 },
  { kind: "bishop", x: 2.0, z: -6.3 },
  { kind: "rook", x: 4.4, z: -6.8 },
  { kind: "pawn", x: -0.3, z: -5.8 },
];

type Constellation = { positions: Float32Array; segments: Float32Array; seeds: Float32Array };

const buildConstellations = (seed: number): Constellation => {
  const rand = mulberry32(seed);
  const pts: number[] = [];
  const segs: number[] = [];
  const seeds: number[] = [];
  const clusters = 7;
  for (let c = 0; c < clusters; c++) {
    const cx = -2.6 + (c / (clusters - 1)) * 8.5 + (rand() - 0.5) * 1.0;
    const cy = 0.75 + rand() * 0.75;
    const cz = -2.6 - rand() * 3.4;
    const n = 5 + Math.floor(rand() * 6);
    const nodes: THREE.Vector3[] = [];
    for (let i = 0; i < n; i++) {
      nodes.push(
        new THREE.Vector3(
          cx + (rand() - 0.5) * 1.5,
          cy + (rand() - 0.5) * 1.0,
          cz + (rand() - 0.5) * 1.2,
        ),
      );
    }
    // Chain each node to its nearest earlier node, plus a few cross links.
    nodes.forEach((p, i) => {
      pts.push(p.x, p.y, p.z);
      seeds.push(rand());
      if (i === 0) return;
      let best = 0;
      let bestD = Infinity;
      for (let j = 0; j < i; j++) {
        const d = p.distanceTo(nodes[j]);
        if (d < bestD) {
          bestD = d;
          best = j;
        }
      }
      segs.push(p.x, p.y, p.z, nodes[best].x, nodes[best].y, nodes[best].z);
      if (rand() < 0.25 && i > 2) {
        const k = Math.floor(rand() * (i - 1));
        if (k !== best) segs.push(p.x, p.y, p.z, nodes[k].x, nodes[k].y, nodes[k].z);
      }
    });
  }
  // Stray drifting dust nodes.
  for (let i = 0; i < 28; i++) {
    pts.push(-2.5 + rand() * 9, 0.4 + rand() * 1.9, -2.5 - rand() * 4.5);
    seeds.push(rand());
  }
  return {
    positions: new Float32Array(pts),
    segments: new Float32Array(segs),
    seeds: new Float32Array(seeds),
  };
};

export const ChessScene: React.FC<ChessSceneProps> = ({ cameraMode }) => {
  const create = useCallback(
    (info: StageInfo) => {
      const { renderer, width, height, bufferWidth, bufferHeight, pixelScale } = info;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 0.95;

      const scene = new THREE.Scene();
      const bg = new THREE.Color("#02060d");
      scene.background = bg;
      scene.fog = new THREE.FogExp2(bg.getHex(), 0.035);

      const camera = new THREE.PerspectiveCamera(14.5, width / height, 0.1, 140);

      // ---------- Lights ----------
      const hemi = new THREE.HemisphereLight(0x3a78c2, 0x050a14, 0.35);
      scene.add(hemi);
      const rim = new THREE.DirectionalLight(0x3f86ff, 2.2);
      rim.position.set(-1.5, 3.5, -7);
      scene.add(rim);
      const key = new THREE.DirectionalLight(0x5ab8ff, 0.7);
      key.position.set(-4, 5, 3);
      scene.add(key);
      // Soft blue front fill so the out-of-focus pieces read as navy, not black.
      const fill = new THREE.DirectionalLight(0x4f8fd8, 1.1);
      fill.position.set(1.5, 2.5, 10);
      scene.add(fill);
      const kingGlow = new THREE.PointLight(0x48d8ff, 0, 6, 1.6);
      kingGlow.position.set(-0.2, 0.9, 1.4);
      scene.add(kingGlow);

      // ---------- Board (semi-transparent over a mirrored copy = glossy reflection) ----------
      const tex = checkerTexture();
      tex.repeat.set(10, 8.5);
      tex.offset.set(0, 0);
      // Lambert (no specular) — the gloss comes from the mirrored copy below,
      // which keeps the board dark instead of washing out with grazing sheen.
      const boardMat = new THREE.MeshLambertMaterial({
        map: tex,
        transparent: true,
        opacity: 0.8,
      });
      const board = new THREE.Mesh(new THREE.PlaneGeometry(20, 17), boardMat);
      board.rotation.x = -Math.PI / 2;
      board.position.set(2.5, 0, 1); // back edge 7.5 squares behind the king; squares centred on integers
      board.renderOrder = 1;
      scene.add(board);

      const world = new THREE.Group(); // pieces + holo above the board
      const mirror = new THREE.Group(); // reflected copy below the board
      mirror.scale.y = -1;
      scene.add(world);
      scene.add(mirror);

      const darkPiece = new THREE.MeshStandardMaterial({
        color: 0x2a4d78,
        roughness: 0.42,
        metalness: 0.12,
      });
      const kingMat = new THREE.MeshStandardMaterial({
        color: 0x0c1c31,
        roughness: 0.5,
        metalness: 0.1,
        emissive: new THREE.Color(0x2fc4ff),
        emissiveIntensity: 0,
      });
      const kingMatLit = 0.24;
      const geoms = {
        king: kingGeometry(),
        queen: queenGeometry(),
        rook: rookGeometry(),
        bishop: bishopGeometry(),
        pawn: pawnGeometry(),
      };
      const addBoth = (make: () => THREE.Object3D) => {
        world.add(make());
        mirror.add(make());
      };

      addBoth(() => new THREE.Mesh(geoms.king, kingMat));

      const baseRingRadius: Record<PieceSpec["kind"], number> = {
        rook: 0.44,
        pawn: 0.4,
        queen: 0.44,
        bishop: 0.42,
      };
      const pieceRings: HoloRing[] = [];
      for (const p of PIECES) {
        addBoth(() => {
          const m = new THREE.Mesh(geoms[p.kind], darkPiece);
          m.position.set(p.x, 0, p.z);
          m.scale.setScalar(BG_PIECE_SCALE);
          return m;
        });
        // Neon base ring (and its reflection).
        for (const parent of [world, mirror]) {
          const r = baseRingRadius[p.kind] * BG_PIECE_SCALE;
          const ring = makeHoloRing(r - 0.05, r + 0.018, 0.012, { intensity: 2.8, color: CYAN });
          ring.mesh.position.x = p.x;
          ring.mesh.position.z = p.z;
          parent.add(ring.mesh);
          pieceRings.push(ring);
        }
      }

      // King holographic rings: base set on the board + two body bands.
      const kingRings: HoloRing[] = [];
      const addKingRing = (ring: HoloRing, reflect = true) => {
        world.add(ring.mesh);
        kingRings.push(ring);
        if (reflect) {
          const copy = makeHoloRing(ring.mat.uniforms.uInner.value, ring.mat.uniforms.uOuter.value, ring.mesh.position.y, {
            intensity: ring.base * 0.6,
            dashes: ring.mat.uniforms.uDashes.value,
            duty: ring.mat.uniforms.uDuty.value,
            speed: ring.speed,
            color: ring.mat.uniforms.uColor.value,
          });
          mirror.add(copy.mesh);
          kingRings.push(copy);
        }
      };
      addKingRing(makeHoloRing(0.4, 0.445, 0.013, { intensity: 2.6, color: CYAN }));
      addKingRing(makeHoloRing(0.5, 0.515, 0.014, { intensity: 1.6, dashes: 120, duty: 0.55, speed: 0.012 }));
      addKingRing(makeHoloRing(0.58, 0.6, 0.015, { intensity: 1.3, dashes: 36, duty: 0.7, speed: -0.02 }));
      addKingRing(makeHoloRing(0.66, 0.668, 0.016, { intensity: 0.9, dashes: 220, duty: 0.4, speed: 0.006 }));
      addKingRing(makeHoloRing(0.27, 0.29, 0.6, { intensity: 2.2, dashes: 64, duty: 0.55, speed: 0.03 }), false);
      addKingRing(makeHoloRing(0.245, 0.263, 0.93, { intensity: 2.0, dashes: 56, duty: 0.55, speed: -0.035 }), false);

      // Glow pool on the king's square.
      const poolMat = new THREE.ShaderMaterial({
        uniforms: { uIntensity: { value: 0 }, uColor: { value: CYAN.clone() } },
        vertexShader: rayVertex,
        fragmentShader: /* glsl */ `
          uniform float uIntensity; uniform vec3 uColor; varying vec2 vUv;
          void main(){
            vec2 d=abs(vUv-0.5)*2.0;
            float sq=smoothstep(1.0,0.82,max(d.x,d.y));
            float rad=exp(-dot(vUv-0.5,vUv-0.5)*5.0);
            float v=(sq*0.55+rad*0.6)*uIntensity;
            gl_FragColor=vec4(uColor*v,v);
          }`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.0), poolMat);
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(0, 0.006, 0);
      scene.add(pool);

      // ---------- Light shafts ----------
      const rays: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; base: number }[] = [];
      const rayRand = mulberry32(99);
      for (let i = 0; i < 6; i++) {
        const mat = new THREE.ShaderMaterial({
          uniforms: {
            uColor: { value: new THREE.Color("#1f7fc4") },
            uIntensity: { value: 0 },
            uPhase: { value: rayRand() * 6 },
          },
          vertexShader: rayVertex,
          fragmentShader: rayFragment,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
        });
        const w = 0.25 + rayRand() * 0.6;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, 14), mat);
        mesh.position.set(-2.6 + i * 0.6 + rayRand() * 0.4, 3.4, -5.5 - rayRand() * 1.5);
        mesh.rotation.z = 0.72 + (rayRand() - 0.5) * 0.14;
        scene.add(mesh);
        rays.push({ mesh, mat, base: 0.16 + rayRand() * 0.14 });
      }

      // ---------- Constellations ----------
      const con = buildConstellations(4242);
      const nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute("position", new THREE.BufferAttribute(con.positions, 3));
      nodeGeo.setAttribute("aSeed", new THREE.BufferAttribute(con.seeds, 1));
      const nodeMat = new THREE.ShaderMaterial({
        uniforms: {
          uSize: { value: 95 },
          uPixelScale: { value: pixelScale },
          uTime: { value: 0 },
          uColor: { value: GREEN.clone().multiplyScalar(2.6) },
          uIntensity: { value: 0 },
        },
        vertexShader: nodeVertex,
        fragmentShader: nodeFragment,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const nodes = new THREE.Points(nodeGeo, nodeMat);
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.BufferAttribute(con.segments, 3));
      const lineMat = new THREE.LineBasicMaterial({
        color: GREEN.clone().multiplyScalar(1.4),
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const lines = new THREE.LineSegments(lineGeo, lineMat);
      const constellation = new THREE.Group();
      constellation.add(lines, nodes);
      scene.add(constellation);

      // ---------- Post ----------
      const composer = new EffectComposer(renderer);
      composer.setPixelRatio(1);
      composer.setSize(bufferWidth, bufferHeight);
      composer.addPass(new RenderPass(scene, camera));
      const bokeh = new BokehPass(scene, camera, { focus: 11, aperture: 0.003, maxblur: 0.011 });
      composer.addPass(bokeh);
      const bloom = new UnrealBloomPass(new THREE.Vector2(bufferWidth, bufferHeight), 0.55, 0.45, 0.6);
      composer.addPass(bloom);
      const grade = new ShaderPass(gradeShader);
      grade.uniforms.uAspect.value = width / height;
      composer.addPass(grade);
      composer.addPass(new OutputPass());

      const kingTarget = new THREE.Vector3(0, 0.9, 0);
      const darkKing = new THREE.Color(0x0c1c31);
      const litKing = new THREE.Color(0x58c8f0);

      const placeCamera = (frame: number) => {
        const p = frame / 299;
        if (cameraMode === "reference") {
          // Locked-off low angle with an almost imperceptible push, as in the reference.
          camera.position.set(
            interpolate(p, [0, 1], [0.97, 0.94]),
            interpolate(p, [0, 1], [2.75, 2.71]),
            interpolate(p, [0, 1], [11.2, 11.0]),
          );
          camera.lookAt(1.02, 0.86, -1.0);
        } else {
          // Version 2: crane-down orbit around the king (≈70° arc), king held centre-frame.
          const e = Easing.inOut(Easing.sin)(p);
          const ang = interpolate(e, [0, 1], [-0.78, 0.42]);
          const radius = interpolate(e, [0, 1], [12.2, 10.9]);
          const h = interpolate(e, [0, 1], [4.4, 1.75]);
          camera.position.set(Math.sin(ang) * radius, h, Math.cos(ang) * radius);
          camera.lookAt(0.0, interpolate(e, [0, 1], [0.78, 1.02]), 0);
        }
        camera.updateMatrixWorld();
        (bokeh.uniforms as Record<string, THREE.IUniform>).focus.value = camera.position.distanceTo(kingTarget);
      };

      return {
        renderFrame: (frame: number) => {
          const t = frame / FPS;
          const lit = kingLight(frame);
          const litClamped = Math.min(1, lit);
          placeCamera(frame);

          kingMat.color.copy(darkKing).lerp(litKing, litClamped);
          kingMat.emissiveIntensity = kingMatLit * lit;
          kingGlow.intensity = 3.2 * lit;
          fill.intensity = 0.55 + 0.55 * litClamped;
          hemi.intensity = 0.2 + 0.15 * litClamped;
          poolMat.uniforms.uIntensity.value = 0.75 * lit;

          for (const r of kingRings) {
            r.mat.uniforms.uRotation.value = r.speed * t;
            r.mat.uniforms.uIntensity.value = r.base * (0.8 + 0.35 * litClamped);
          }
          for (const r of pieceRings) {
            r.mat.uniforms.uIntensity.value = r.base * (0.92 + 0.08 * Math.sin(t * 2.1 + r.mesh.position.x));
          }
          rays.forEach((r, i) => {
            r.mat.uniforms.uIntensity.value = r.base * (0.12 + 0.88 * litClamped) * (0.85 + 0.15 * Math.sin(t * 0.7 + i));
            r.mat.uniforms.uPhase.value = i * 1.7 + t * 0.6;
          });

          const conFade = interpolate(frame, [0, 36], [0.04, 1], { ...clampOpts, easing: Easing.inOut(Easing.quad) });
          nodeMat.uniforms.uTime.value = t;
          nodeMat.uniforms.uIntensity.value = 1.3 * conFade;
          lineMat.opacity = 0.42 * conFade;
          constellation.position.set(Math.sin(t * 0.25) * 0.25 - t * 0.04, Math.sin(t * 0.33) * 0.12, 0);
          constellation.rotation.z = Math.sin(t * 0.15) * 0.02;

          composer.render();
        },
        dispose: () => {
          Object.values(geoms).forEach((g) => g.dispose());
          tex.dispose();
          composer.dispose();
          scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.geometry) m.geometry.dispose();
            const mat = m.material as THREE.Material | undefined;
            mat?.dispose?.();
          });
        },
      };
    },
    [cameraMode],
  );
  return <ThreeStage create={create} />;
};

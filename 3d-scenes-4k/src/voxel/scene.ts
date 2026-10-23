import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { createPost } from "../lib/post";
import { mulberry32, fbm3, smoothstep, easeInOutSine } from "../lib/random";
import type { StageSetup } from "../lib/ThreeStage";

export type VoxelVariant = "v1" | "v2";

type Palette = {
  background: string;
  envTop: string;
  envBottom: string;
  envBox: string;
  core: string;
  // Mirror-like dark blocks, glassy mid tones, accent and glowing clusters.
  dark: string;
  mid: string[];
  accent: string;
  glow: string;
  glowIntensity: number;
  exposure: number;
  gain: [number, number, number];
};

// V1 mirrors the reference: navy void, cyan/teal glass-metal, violet accents
// and white-hot glowing clusters. V2 swaps to a molten copper/magenta palette.
const PALETTES: Record<VoxelVariant, Palette> = {
  v1: {
    background: "#0c3074",
    envTop: "#4a8cf0",
    envBottom: "#06163c",
    envBox: "#e4f2ff",
    core: "#0a2a70",
    dark: "#030818",
    mid: ["#38b8f0", "#5ad2ff", "#3490f0", "#2cb0d8"],
    accent: "#9a3ad8",
    glow: "#eef4ff",
    glowIntensity: 1.2,
    exposure: 1.6,
    gain: [0.97, 1.0, 1.06],
  },
  v2: {
    background: "#3e0e26",
    envTop: "#f0803e",
    envBottom: "#20060e",
    envBox: "#fff0dc",
    core: "#5a1418",
    dark: "#16050c",
    mid: ["#d8682a", "#ec8e36", "#c4402c", "#b4563a"],
    accent: "#c82a7c",
    glow: "#fff2d8",
    glowIntensity: 1.2,
    exposure: 1.65,
    gain: [1.06, 1.0, 0.95],
  },
};

const N = 48; // fine grid cells per cube edge
const HALF = N / 2;
const MACRO = 4; // largest tile size in cells

const makeEnv = (p: Palette) => {
  const w = 1024;
  const h = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, p.envTop);
  g.addColorStop(0.5, p.envBottom);
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // Studio softboxes: give the glossy blocks crisp, bright reflections.
  const box = (x: number, y: number, bw: number, bh: number, a: number) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = p.envBox;
    ctx.filter = "blur(6px)";
    ctx.fillRect(x, y, bw, bh);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  };
  box(w * 0.05, h * 0.1, w * 0.16, h * 0.22, 1);
  box(w * 0.3, h * 0.06, w * 0.12, h * 0.3, 0.9);
  box(w * 0.55, h * 0.14, w * 0.22, h * 0.12, 0.85);
  box(w * 0.8, h * 0.08, w * 0.1, h * 0.3, 0.8);
  box(0, h * 0.0, w, h * 0.04, 0.7);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

type Tile = {
  centre: THREE.Vector3; // centre of the tile on the cube surface
  normal: THREE.Vector3; // outward axis
  size: number; // nominal edge length in cells (1, 2 or 4)
  su: number; // lateral extent along the face's u axis
  sv: number; // lateral extent along the face's v axis
  extrude: number; // resting protrusion
  amp: number; // breathing amplitude
  phase: number;
  hue: number; // picks a mid colour
  accentBias: number;
  jitter: number; // dithers material class boundaries per tile
  orient: THREE.Quaternion; // maps box x/y/z to the face's u/v/normal
};

/**
 * Each face is an N x N grid split into 4x4 macro cells, each randomly kept
 * whole or subdivided into 2x2 and 1x1 tiles. This gives the mix of large
 * blocks, medium cubes and small tiles seen in the reference.
 */
const buildTiles = () => {
  const rand = mulberry32(2264163700);
  const tiles: Tile[] = [];
  const axes = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];
  for (const n of axes) {
    const u = Math.abs(n.x) > 0 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const v = new THREE.Vector3().crossVectors(n, u);
    const orient = new THREE.Quaternion().setFromRotationMatrix(
      new THREE.Matrix4().makeBasis(u, v, n),
    );
    const emit = (i: number, j: number, s: number, su = s, sv = s) => {
      const centre = new THREE.Vector3()
        .addScaledVector(n, HALF)
        .addScaledVector(u, i + su / 2 - HALF)
        .addScaledVector(v, j + sv / 2 - HALF);
      const r = rand();
      // Mostly shallow relief; small tiles occasionally poke out further.
      const extrude =
        s * 0.1 * Math.pow(r, 2) + (s === 1 && rand() > 0.7 ? Math.pow(rand(), 2) * 1.6 : 0);
      tiles.push({
        centre,
        normal: n.clone(),
        size: s,
        su,
        sv,
        extrude,
        amp: (0.15 + rand() * 0.35) * (s === 1 ? 1 : 0.5),
        phase: rand() * Math.PI * 2,
        hue: rand(),
        accentBias: rand(),
        jitter: rand() - 0.5,
        orient,
      });
    };
    for (let i = 0; i < N; i += MACRO) {
      for (let j = 0; j < N; j += MACRO) {
        const r = rand();
        if (r < 0.22) {
          emit(i, j, 4);
          continue;
        }
        for (let a = 0; a < 4; a += 2) {
          for (let b = 0; b < 4; b += 2) {
            const r2 = rand();
            if (r2 < 0.38) {
              emit(i + a, j + b, 2);
            } else if (r2 < 0.5) {
              // Two 2x1 slabs, horizontal or vertical.
              if (rand() < 0.5) {
                emit(i + a, j + b, 1, 2, 1);
                emit(i + a, j + b + 1, 1, 2, 1);
              } else {
                emit(i + a, j + b, 1, 1, 2);
                emit(i + a + 1, j + b, 1, 1, 2);
              }
            } else {
              for (let c = 0; c < 2; c++) {
                for (let d = 0; d < 2; d++) emit(i + a + c, j + b + d, 1);
              }
            }
          }
        }
      }
    }
  }
  return tiles;
};

const cameraPose = (t: number) => {
  // Low three-quarter view on the leading vertical edge with the top face and
  // a strip of background visible; a steady sideways orbit along the cube.
  const e = easeInOutSine(t) * 0.35 + t * 0.65; // nearly linear, soft ends
  const corner = new THREE.Vector3(HALF, HALF, HALF);
  const az = THREE.MathUtils.degToRad(42 + 14 * e);
  const el = THREE.MathUtils.degToRad(8 - 2 * e);
  const dist = HALF * 2.8;
  const dir = new THREE.Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  );
  const pos = corner.clone().addScaledVector(dir, dist);
  return { pos, target: corner, focus: dist };
};

export const createVoxelSetup =
  (variant: VoxelVariant, durationInFrames: number, fps: number): StageSetup =>
  (renderer, width, height) => {
    const pal = PALETTES[variant];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(pal.background);
    scene.fog = new THREE.Fog(pal.background, 90, 240);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envSrc = makeEnv(pal);
    const env = pmrem.fromEquirectangular(envSrc).texture;
    envSrc.dispose();
    scene.environment = env;

    const key = new THREE.DirectionalLight("#ffffff", 2.4);
    key.position.set(20, 40, 30);
    scene.add(key);
    const rim = new THREE.DirectionalLight(pal.mid[1], 1.0);
    rim.position.set(-30, 10, -10);
    scene.add(rim);

    // Inner core so gaps between tiles show depth, not void.
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(N - 0.6, N - 0.6, N - 0.6),
      new THREE.MeshStandardMaterial({
        color: pal.core,
        emissive: new THREE.Color(pal.core),
        emissiveIntensity: 0.5,
        roughness: 0.5,
        metalness: 0.3,
      }),
    );
    scene.add(core);

    const tiles = buildTiles();
    const count = tiles.length;
    // Bevelled unit box: the rounded edges catch the bright edge highlights.
    const geo = new RoundedBoxGeometry(1, 1, 1, 2, 0.08);
    const emissiveAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    geo.setAttribute("instanceEmissive", emissiveAttr);
    const mat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      metalness: 0.6,
      roughness: 0.1,
      clearcoat: 1,
      clearcoatRoughness: 0.05,
      envMapIntensity: 2.0,
    });
    const glowColor = new THREE.Color(pal.glow);
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.glowColor = { value: glowColor };
      shader.uniforms.glowIntensity = { value: pal.glowIntensity };
      shader.vertexShader = shader.vertexShader
        .replace(
          "#include <common>",
          "#include <common>\nattribute float instanceEmissive;\nvarying float vGlow;",
        )
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGlow = instanceEmissive;");
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          "#include <common>\nuniform vec3 glowColor;\nuniform float glowIntensity;\nvarying float vGlow;",
        )
        .replace(
          "#include <emissivemap_fragment>",
          "#include <emissivemap_fragment>\ntotalEmissiveRadiance += glowColor * glowIntensity * vGlow;",
        );
    };
    const mesh = new THREE.InstancedMesh(geo, mat, count);
    mesh.frustumCulled = false;
    mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3);
    scene.add(mesh);

    const darkC = new THREE.Color(pal.dark);
    const midC = pal.mid.map((c) => new THREE.Color(c));
    const accentC = new THREE.Color(pal.accent);
    const glowBase = new THREE.Color(pal.glow);
    const tmpC = new THREE.Color();
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();

    const camera = new THREE.PerspectiveCamera(16, width / height, 1, 500);
    // Shift the principal point so the leading edge sits ~40% across and the
    // cube's top corner ~31% down, leaving background above the top face.
    camera.setViewOffset(width, height, width * 0.1, height * 0.19, width, height);
    const post = createPost(renderer, scene, camera, width, height, {
      focus: 67,
      cocScale: 4500,
      nearScale: 0.6,
      maxCoc: 44,
      exposure: pal.exposure,
      bloom: { strength: 0.4, radius: 0.45, threshold: 1.0 },
      vignette: 0.3,
      gain: pal.gain,
      saturation: 1.05,
    });

    const updateTiles = (time: number) => {
      for (let i = 0; i < count; i++) {
        const tl = tiles[i];
        const p = tl.centre;
        // Flowing fields decide each tile's material class.
        const f =
          fbm3(p.x * 0.12 + time * 0.5, p.y * 0.12 - time * 0.34, p.z * 0.12 + time * 0.22) +
          tl.jitter * 0.3;
        const g =
          fbm3(p.x * 0.07 - 40 + time * 0.25, p.y * 0.07 + 12, p.z * 0.07 - time * 0.3) +
          tl.jitter * 0.35;
        const glow = smoothstep(0.26, 0.38, f);
        const dark = smoothstep(0.04, 0.22, -f) * (0.7 + 0.3 * tl.hue);
        const accent = smoothstep(0.12, 0.3, g) * (tl.accentBias > 0.35 ? 1 : 0.2);

        const mid = midC[Math.floor(tl.hue * midC.length) % midC.length];
        tmpC.copy(mid).lerp(accentC, accent).lerp(darkC, dark).lerp(glowBase, glow);
        mesh.instanceColor!.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
        emissiveAttr.setX(i, glow * (0.8 + 0.2 * tl.hue));

        // Resting relief + breathing; glowing clusters push out slightly.
        const breathe = Math.sin(time * 2.2 + tl.phase) * 0.5 + 0.5;
        const out = tl.extrude + tl.amp * breathe + glow * 0.25 * tl.size;
        const len = tl.size * 0.6 + out;
        pos.copy(p).addScaledVector(tl.normal, out - len / 2);
        q.copy(tl.orient);
        scl.set(tl.su - 0.08, tl.sv - 0.08, len);
        m4.compose(pos, q, scl);
        mesh.setMatrixAt(i, m4);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
      emissiveAttr.needsUpdate = true;
    };

    return {
      render: (frame) => {
        const time = frame / fps;
        updateTiles(time);
        const pose = cameraPose(frame / (durationInFrames - 1));
        camera.position.copy(pose.pos);
        camera.lookAt(pose.target);
        camera.updateProjectionMatrix();
        post.setFocus(pose.focus);
        post.render();
      },
      dispose: () => {
        post.dispose();
        pmrem.dispose();
        env.dispose();
        mesh.dispose();
        geo.dispose();
        mat.dispose();
        core.geometry.dispose();
        (core.material as THREE.Material).dispose();
      },
    };
  };

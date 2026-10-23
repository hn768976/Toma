import * as THREE from "three";
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
  // Base block colours, from darkest to brightest.
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
    background: "#0a2a66",
    envTop: "#3a78e0",
    envBottom: "#030a22",
    envBox: "#d8ecff",
    core: "#123a8a",
    dark: "#040a20",
    mid: ["#30b0e0", "#48c8f0", "#3088e0", "#28a0c8"],
    accent: "#9a3ad8",
    glow: "#eaf2ff",
    glowIntensity: 1.4,
    exposure: 1.05,
    gain: [0.97, 1.0, 1.06],
  },
  v2: {
    background: "#3a0c22",
    envTop: "#e0703a",
    envBottom: "#14030a",
    envBox: "#ffe6c8",
    core: "#6a1a1a",
    dark: "#1c0610",
    mid: ["#d8682a", "#e88a34", "#c0402c", "#b0503a"],
    accent: "#c22a78",
    glow: "#fff0d2",
    glowIntensity: 1.4,
    exposure: 1.2,
    gain: [1.06, 1.0, 0.95],
  },
};

const N = 30; // voxels per cube edge
const HALF = N / 2;

const makeEnv = (p: Palette) => {
  const w = 1024;
  const h = 512;
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, p.envTop);
  g.addColorStop(0.55, p.envBottom);
  g.addColorStop(1, "#000000");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // A few soft studio boxes for crisp reflections on the metallic faces.
  const box = (x: number, y: number, bw: number, bh: number, a: number) => {
    ctx.globalAlpha = a;
    ctx.fillStyle = p.envBox;
    ctx.filter = "blur(10px)";
    ctx.fillRect(x, y, bw, bh);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  };
  box(w * 0.18, h * 0.12, w * 0.14, h * 0.2, 0.95);
  box(w * 0.62, h * 0.18, w * 0.2, h * 0.12, 0.7);
  box(w * 0.42, h * 0.02, w * 0.3, h * 0.06, 0.8);
  box(w * 0.88, h * 0.3, w * 0.08, h * 0.25, 0.5);
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
};

type Voxel = {
  base: THREE.Vector3; // centre on the cube surface
  normal: THREE.Vector3; // outward axis
  size: number; // lateral scale
  depthBase: number; // resting extrusion
  depthAmp: number;
  phase: number;
  hue: number; // picks a mid colour
  accentBias: number;
  jitter: number; // dithers material class boundaries per block
};

const buildVoxels = () => {
  const rand = mulberry32(2264163700);
  const voxels: Voxel[] = [];
  const axes = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];
  for (const n of axes) {
    // Two in-plane axes for this face.
    const u = Math.abs(n.x) > 0 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const v = new THREE.Vector3().crossVectors(n, u);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = i - HALF + 0.5;
        const b = j - HALF + 0.5;
        const base = new THREE.Vector3()
          .addScaledVector(n, HALF - 0.5)
          .addScaledVector(u, a)
          .addScaledVector(v, b);
        const r = rand();
        voxels.push({
          base,
          normal: n.clone(),
          size: r > 0.82 ? 0.55 + rand() * 0.2 : 0.86 + rand() * 0.12,
          depthBase: Math.pow(r, 2.4) * 1.3,
          depthAmp: 0.1 + rand() * 0.35,
          phase: rand() * Math.PI * 2,
          hue: rand(),
          accentBias: rand(),
          jitter: rand() - 0.5,
        });
      }
    }
  }
  return voxels;
};

const cameraPose = (t: number) => {
  // Low three-quarter view on the leading corner: a slow orbit that also
  // cranes up a little and drifts back, keeping the corner near frame centre.
  const e = easeInOutSine(t);
  const corner = new THREE.Vector3(HALF, HALF, HALF);
  const az = THREE.MathUtils.degToRad(30 + 15 * e);
  const el = THREE.MathUtils.degToRad(9 + 7 * e);
  const dist = HALF * (1.9 + 0.3 * e);
  const dir = new THREE.Vector3(
    Math.cos(el) * Math.sin(az),
    Math.sin(el),
    Math.cos(el) * Math.cos(az),
  );
  const pos = corner.clone().addScaledVector(dir, dist);
  const target = corner.clone().add(new THREE.Vector3(-0.05 * HALF, -0.17 * HALF, -0.05 * HALF));
  return { pos, target, focus: dist };
};

export const createVoxelSetup =
  (variant: VoxelVariant, durationInFrames: number, fps: number): StageSetup =>
  (renderer, width, height) => {
    const pal = PALETTES[variant];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(pal.background);
    scene.fog = new THREE.Fog(pal.background, 80, 220);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envSrc = makeEnv(pal);
    const env = pmrem.fromEquirectangular(envSrc).texture;
    envSrc.dispose();
    scene.environment = env;

    const key = new THREE.DirectionalLight("#ffffff", 2.8);
    key.position.set(20, 40, 30);
    scene.add(key);
    const rim = new THREE.DirectionalLight(pal.mid[1], 0.8);
    rim.position.set(-30, 10, -10);
    scene.add(rim);

    // Inner core so gaps between retracting blocks show depth, not void.
    const core = new THREE.Mesh(
      new THREE.BoxGeometry(N - 1.2, N - 1.2, N - 1.2),
      new THREE.MeshStandardMaterial({
        color: pal.core,
        emissive: new THREE.Color(pal.core),
        emissiveIntensity: 0.6,
        roughness: 0.6,
        metalness: 0.2,
      }),
    );
    scene.add(core);

    const voxels = buildVoxels();
    const count = voxels.length;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const emissiveAttr = new THREE.InstancedBufferAttribute(new Float32Array(count), 1);
    geo.setAttribute("instanceEmissive", emissiveAttr);
    const mat = new THREE.MeshPhysicalMaterial({
      color: "#ffffff",
      metalness: 0.45,
      roughness: 0.16,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      envMapIntensity: 1.8,
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
    const zAxis = new THREE.Vector3(0, 0, 1);
    const pos = new THREE.Vector3();
    const scl = new THREE.Vector3();

    const camera = new THREE.PerspectiveCamera(23, width / height, 1, 500);
    const post = createPost(renderer, scene, camera, width, height, {
      focus: 26,
      cocScale: 900,
      nearScale: 0.9,
      maxCoc: 46,
      exposure: pal.exposure,
      bloom: { strength: 0.42, radius: 0.5, threshold: 1.1 },
      vignette: 0.35,
      gain: pal.gain,
      saturation: 1.05,
    });

    const updateVoxels = (time: number) => {
      for (let i = 0; i < count; i++) {
        const v = voxels[i];
        const p = v.base;
        // Flowing field decides the material class of each block.
        const f =
          fbm3(p.x * 0.15 + time * 0.22, p.y * 0.15 - time * 0.15, p.z * 0.15 + time * 0.1) +
          v.jitter * 0.22;
        const g =
          fbm3(p.x * 0.15 - 40 + time * 0.12, p.y * 0.15 + 12, p.z * 0.15 - time * 0.14) +
          v.jitter * 0.3;
        const glow = smoothstep(0.24, 0.4, f);
        const dark = smoothstep(0.02, 0.24, -f) * (0.6 + 0.4 * v.hue);
        const accent = smoothstep(0.1, 0.3, g) * (v.accentBias > 0.3 ? 1 : 0.2);

        const mid = midC[Math.floor(v.hue * midC.length) % midC.length];
        tmpC.copy(mid).lerp(accentC, accent).lerp(darkC, dark).lerp(glowBase, glow);
        mesh.instanceColor!.setXYZ(i, tmpC.r, tmpC.g, tmpC.b);
        emissiveAttr.setX(i, glow * (0.75 + 0.25 * v.hue));

        // Extrusion: resting depth + slow breathing; glowing clusters push out.
        const breathe = Math.sin(time * 0.9 + v.phase) * 0.5 + 0.5;
        const depth = 0.3 + v.depthBase + v.depthAmp * breathe + glow * 0.25;
        pos.copy(p).addScaledVector(v.normal, depth * 0.5 - 0.15);
        q.setFromUnitVectors(zAxis, v.normal);
        scl.set(v.size, v.size, depth + 0.3);
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
        updateVoxels(time);
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
      },
    };
  };

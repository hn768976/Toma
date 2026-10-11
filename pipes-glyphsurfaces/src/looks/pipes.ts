import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { PostPipeline, PostSettings } from "../engine/post";
import { mulberry32 } from "../engine/rng";
import type { LookFactory } from "../engine/Stage";

export type PipeVersion = {
  kind: "pipes";
  layout: "stack" | "bundle";
  metal: { color: string; roughness: number; innerRoughness: number; envIntensity: number };
  env: { panel: [number, number, number]; top: [number, number, number]; base: [number, number, number] };
  wallFrac: number; // wall thickness as a fraction of radius
  camera: {
    fov: number;
    pos: [number, number, number];
    target: [number, number, number];
    sway: [number, number, number]; // lap amplitude (x, y, z) of the closed path
    push: number; // push in/out along the view axis
    roll?: number; // degrees
  };
  envSwayDeg: number;
  bg: string;
  post: Omit<PostSettings, "depthScale">;
};

const PIPE_LEN = 30;
const DEPTH_SCALE = 200;

// ---------- layouts (seeded, deterministic) ----------
type Pipe = { x: number; y: number; z: number; r: number };

const stackLayout = (): Pipe[] => {
  const rng = mulberry32(517179160);
  const pipes: Pipe[] = [];
  const r = 1.0, gap = 0.03;
  const dx = 2 * r + gap, dy = Math.sqrt(3) * (r + gap / 2);
  for (let row = 0; row < 8; row++) {
    const dz = (rng() * 2 - 1) * 0.4;
    for (let col = 0; col < 18 + (row % 2 === 0 ? 1 : 0); col++) {
      const x = (col - 4.5) * dx + (row % 2 === 0 ? 0 : dx / 2);
      pipes.push({ x, y: row * dy, z: dz + (rng() * 2 - 1) * 0.03, r });
    }
  }
  return pipes;
};

const BUNDLE_RADII = [1.1, 0.8, 0.6, 0.4, 0.25];
const bundleLayout = (): Pipe[] => {
  const rng = mulberry32(943806984);
  const counts = [14, 22, 34, 40, 30]; // 140 pipes
  const placed: Pipe[] = [];
  const gap = 0.025;
  BUNDLE_RADII.forEach((r, si) => {
    for (let n = 0; n < counts[si]; n++) {
      let best: Pipe | null = null;
      let bestScore = Infinity;
      for (let k = 0; k < 400; k++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * 9.5;
        const x = Math.cos(a) * d * 1.25, y = Math.sin(a) * d * 0.85;
        let okp = true;
        for (const p of placed) {
          const m = p.r + r + gap;
          if ((p.x - x) ** 2 + (p.y - y) ** 2 < m * m) { okp = false; break; }
        }
        if (!okp) continue;
        const score = (x / 1.25) ** 2 + (y / 0.85) ** 2 + rng() * 1.5;
        if (score < bestScore) { bestScore = score; best = { x, y, z: 0, r }; }
      }
      if (best) placed.push(best);
    }
  });
  placed.forEach((p) => { p.z = -rng() * 6; });
  return placed;
};

export const STACK = stackLayout();
export const BUNDLE = bundleLayout();

// ---------- geometry ----------
const pipeGeometry = (R: number, wallFrac: number) => {
  const t = Math.max(0.018, R * wallFrac);
  const b = Math.min(t * 0.32, 0.03);
  const body: THREE.Vector2[] = [];
  const face: THREE.Vector2[] = [];
  const inner: THREE.Vector2[] = [];
  body.push(new THREE.Vector2(R, -PIPE_LEN));
  body.push(new THREE.Vector2(R, -PIPE_LEN * 0.5));
  body.push(new THREE.Vector2(R, -b));
  const arc = 8;
  face.push(new THREE.Vector2(R, -b));
  for (let i = 1; i <= arc; i++) {
    const a = (i / arc) * Math.PI * 0.5;
    face.push(new THREE.Vector2(R - b + b * Math.cos(a), -b + b * Math.sin(a)));
  }
  for (let i = 0; i <= arc; i++) {
    const a = Math.PI * 0.5 + (i / arc) * Math.PI * 0.5;
    face.push(new THREE.Vector2(R - t + b + b * Math.cos(a), -b + b * Math.sin(a)));
  }
  inner.push(new THREE.Vector2(R - t, -b));
  for (let i = 1; i <= 12; i++) inner.push(new THREE.Vector2(R - t, -b - (PIPE_LEN - b) * (i / 12) ** 2));
  const segs = 96;
  const g = [new THREE.LatheGeometry(body, segs), new THREE.LatheGeometry(face, segs), new THREE.LatheGeometry(inner, segs)];
  g.forEach((geo) => {
    geo.rotateX(Math.PI / 2); // lathe axis Y -> Z, open end at z = 0 facing +Z
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setY(i, pos.getZ(i) * 0.25);
  });
  return mergeGeometries(g, true)!;
};

// Stretched value noise along the length -> faint brushed lines in the normal map.
const brushedNormalMap = () => {
  const rng = mulberry32(777);
  const W = 1024, H = 64;
  const col = Array.from({ length: W }, () => rng());
  const rowShift = Array.from({ length: H }, () => rng());
  const data = new Uint8Array(W * H * 4);
  const hgt = (x: number, y: number) => {
    const xx = (((x + Math.floor(rowShift[y] * 3)) % W) + W) % W;
    return col[xx] * 0.7 + col[(xx * 7 + 13) % W] * 0.3;
  };
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = hgt(x + 1, y) - hgt(x - 1, y);
      const n = new THREE.Vector3(-dx * 0.6, 0, 1).normalize();
      const i = (y * W + x) * 4;
      data[i] = (n.x * 0.5 + 0.5) * 255;
      data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
};

// Procedural studio: dark grey sphere, long soft light strips running along
// meridians around the pipe axis (Z) -> constant streaks along every pipe body,
// plus a big soft top light. Built once in a float buffer, filtered by PMREM.
const studioEnv = (v: PipeVersion) => {
  const W = 1024, H = 512;
  const data = new Float32Array(W * H * 4);
  // strips: [azimuth around Z (deg), half-width (deg), intensity]
  const strips: [number, number, number][] = [
    [92, 11, 9.0], [55, 5, 7.0], [126, 8, 6.0], [24, 4, 4.0], [165, 3, 6.0], [232, 10, 1.0], [300, 12, 0.6], [345, 3, 2.5],
  ];
  const soft = (x: number, w: number, e: number) => {
    const d = Math.abs(x);
    return d < w - e ? 1 : d > w + e ? 0 : 0.5 - 0.5 * Math.sin(((d - w) / e) * Math.PI * 0.5);
  };
  for (let y = 0; y < H; y++) {
    const lat = ((y + 0.5) / H - 0.5) * Math.PI;
    for (let x = 0; x < W; x++) {
      const a = ((x + 0.5) / W - 0.5) * Math.PI * 2;
      const dx = Math.cos(lat) * Math.cos(a), dy = Math.sin(lat), dz = Math.cos(lat) * Math.sin(a);
      const az = (Math.atan2(dy, dx) * 180) / Math.PI; // around Z
      const pole = Math.abs(dz); // fade strips near the axis poles
      const along = 1 - Math.pow(pole, 6);
      let L = 0;
      for (const [c, hw, I] of strips) {
        let d = az - c;
        d = ((d + 540) % 360) - 180;
        L += I * soft(d, hw, Math.max(1.5, hw * 0.5)) * along;
      }
      const base = v.env.base;
      const g = 0.05 + 0.95 * Math.pow(Math.max(0, dy * 0.5 + 0.5), 3);
      const top = Math.pow(Math.max(0, dy), 8) * 1.5;
      // big soft front light behind the camera: lights the cut rims
      const fl = Math.max(0, dz * 0.82 + dy * 0.45 - dx * 0.36);
      const front = Math.pow(fl, 12) * 1.7 + Math.pow(Math.max(0, dz), 2) * 0.12;
      const i = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) data[i + k] = base[k] * g + (top + front) * v.env.top[k] + L * v.env.panel[k];
      data[i + 3] = 1;
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.FloatType);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
};

type Inject = { vert?: string; vertHeader?: string; frag?: string; fragHeader?: string; uniforms?: Record<string, THREE.IUniform> };
const injectDepth = (m: THREE.Material, extra: Inject = {}) => {
  const key = "pipe-depth|" + (extra.vertHeader ?? "") + (extra.vert ?? "") + (extra.fragHeader ?? "") + (extra.frag ?? "");
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDepthScale = { value: DEPTH_SCALE };
    Object.assign(sh.uniforms, extra.uniforms ?? {});
    const decl = "varying float vDepthZ;\nvarying vec3 vLocal;\nvarying vec3 vPipe;\n";
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\n" + decl + (extra.vertHeader ?? ""))
      .replace(
        "#include <project_vertex>",
        "#include <project_vertex>\nvDepthZ = -mvPosition.z;\nvLocal = position;\nvPipe = vec3(instanceMatrix[3].xyz);\n" + (extra.vert ?? ""),
      );
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\n" + decl + "uniform float uDepthScale;\n" + (extra.fragHeader ?? ""))
      .replace("#include <lights_fragment_end>", "#include <lights_fragment_end>\n" + (extra.frag ?? ""))
      .replace("#include <dithering_fragment>", "gl_FragColor.a = vDepthZ / uDepthScale;");
  };
};

// Contact occlusion: for every pipe and 64 directions around it, how close the
// nearest neighbour wall is (R) and where that neighbour's open end sits (G).
// Pipes are parallel, so this captures their mutual occlusion along the length.
const OCC_DIRS = 64;
const occlusionTexture = (pipes: Pipe[]) => {
  const data = new Float32Array(pipes.length * OCC_DIRS * 4);
  pipes.forEach((p, i) => {
    for (let k = 0; k < OCC_DIRS; k++) {
      const a = (k / OCC_DIRS) * Math.PI * 2;
      const sx = p.x + Math.cos(a) * p.r, sy = p.y + Math.sin(a) * p.r;
      let occ = 0, front = -1e3;
      for (const q of pipes) {
        if (q === p) continue;
        const d = Math.hypot(sx - q.x, sy - q.y) - q.r;
        if (d > 2.5 * p.r + 1.0) continue;
        // facing factor: neighbour must be on the outward side of this surface point
        const fx = q.x - sx, fy = q.y - sy, fl = Math.hypot(fx, fy) || 1;
        const facing = Math.max(0, (fx * Math.cos(a) + fy * Math.sin(a)) / fl);
        const o = facing * Math.exp(-Math.max(0, d) / (0.35 * p.r + 0.12)) * Math.min(1, q.r / p.r + 0.3);
        if (o > occ) { occ = o; front = q.z; }
      }
      const j = (i * OCC_DIRS + k) * 4;
      data[j] = Math.min(1, occ);
      data[j + 1] = front;
      data[j + 3] = 1;
    }
  });
  const tex = new THREE.DataTexture(data, OCC_DIRS, pipes.length, THREE.RGBAFormat, THREE.FloatType);
  tex.wrapS = THREE.RepeatWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
};

export const pipesFactory: LookFactory<PipeVersion> = (renderer, v) => {
  renderer.toneMapping = THREE.NoToneMapping;
  const post = new PostPipeline(renderer);
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = studioEnv(v);
  const envRT = pmrem.fromEquirectangular(envTex);
  scene.environment = envRT.texture;
  scene.environmentIntensity = v.metal.envIntensity;
  envTex.dispose();
  pmrem.dispose();

  const nmap = brushedNormalMap();
  const color = new THREE.Color(v.metal.color);
  const radii = v.layout === "stack" ? [1.0] : BUNDLE_RADII;
  const pipes = v.layout === "stack" ? STACK : BUNDLE;
  const ordered = radii.flatMap((R) => pipes.filter((p) => p.r === R));
  const occTex = occlusionTexture(ordered);
  const rng = mulberry32(4242);
  const meshes: THREE.InstancedMesh[] = [];
  const mats: THREE.Material[] = [];
  let row = 0;
  radii.forEach((R) => {
    const list = pipes.filter((p) => p.r === R);
    const occ = {
      uOcc: { value: occTex },
      uRow0: { value: row },
      uRows: { value: ordered.length },
    };
    const occHeader = `uniform sampler2D uOcc; uniform float uRow0; uniform float uRows; flat varying float vInst;
      const float uR = ${R.toFixed(4)};`;
    const occVert = "vInst = float(gl_InstanceID);";
    const outer = new THREE.MeshPhysicalMaterial({
      color, metalness: 1, roughness: v.metal.roughness, normalMap: nmap,
      normalScale: new THREE.Vector2(0.05, 0.05),
    });
    injectDepth(outer, {
      uniforms: occ, vertHeader: "flat varying float vInst;", vert: occVert, fragHeader: occHeader,
      frag: `{
        float ang = atan(vLocal.y, vLocal.x) / 6.2831853;
        vec4 o = texture(uOcc, vec2(ang, (uRow0 + vInst + 0.5) / uRows));
        float worldZ = vPipe.z + vLocal.z;
        float along = smoothstep(o.g + 0.25, o.g - 0.6, worldZ);
        float occ = 1.0 - 0.82 * o.r * along;
        reflectedLight.indirectSpecular *= occ;
        reflectedLight.indirectDiffuse *= occ;
      }`,
    });
    // cut end: same metal, a little rougher (saw/deburr finish), no brushed normal map
    const face = new THREE.MeshPhysicalMaterial({
      color: color.clone().multiplyScalar(0.95), metalness: 1, roughness: Math.min(0.5, v.metal.roughness + 0.08),
    });
    injectDepth(face, { fragHeader: "// face" });
    const inner = new THREE.MeshPhysicalMaterial({
      color: color.clone().multiplyScalar(0.25), metalness: 1, roughness: v.metal.innerRoughness,
    });
    injectDepth(inner, {
      fragHeader: `const float uR = ${R.toFixed(4)};`,
      frag: `{ float dd = max(0.0, -vLocal.z); float occ = 0.002 + 0.998 * exp(-dd / (0.08 * uR));
              reflectedLight.indirectSpecular *= occ; reflectedLight.indirectDiffuse *= occ; }`,
    });
    const mesh = new THREE.InstancedMesh(pipeGeometry(R, v.wallFrac * (v.layout === "bundle" ? 0.55 + 0.75 * (1 - R / 1.1) : 1)), [outer, face, inner], list.length);
    const m = new THREE.Matrix4();
    const tone = new THREE.Color();
    list.forEach((p, i) => {
      mesh.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
      const k = 0.9 + rng() * 0.14;
      mesh.setColorAt(i, tone.setRGB(k, k * (0.99 + rng() * 0.02), k * (0.99 + rng() * 0.02)));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    scene.add(mesh);
    meshes.push(mesh);
    mats.push(outer, face, inner);
    row += list.length;
  });

  const camera = new THREE.PerspectiveCamera(v.camera.fov, 16 / 9, 0.05, 400);
  const bg = new THREE.Color(v.bg);
  const size = new THREE.Vector2();
  const base = new THREE.Vector3(...v.camera.pos);
  const target = new THREE.Vector3(...v.camera.target);

  return {
    render(frame) {
      renderer.getDrawingBufferSize(size);
      post.setSize(size.x, size.y);
      camera.aspect = size.x / size.y;
      const a = (frame / 600) * Math.PI * 2;
      const fwd = target.clone().sub(base).normalize();
      const p = base.clone()
        .add(new THREE.Vector3(Math.sin(a) * v.camera.sway[0], (1 - Math.cos(a)) * 0.5 * v.camera.sway[1], Math.sin(a) * v.camera.sway[2]))
        .addScaledVector(fwd, Math.sin(a * 2) * 0.0 + (1 - Math.cos(a)) * 0.5 * v.camera.push);
      camera.position.copy(p);
      const fwdNow = target.clone().sub(p).normalize();
      camera.up.set(0, 1, 0).applyAxisAngle(fwdNow, THREE.MathUtils.degToRad(v.camera.roll ?? 0));
      camera.lookAt(target.clone().add(new THREE.Vector3(Math.sin(a) * v.camera.sway[0] * 0.5, 0, 0)));
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
      scene.environmentRotation.set(0, Math.sin(a) * THREE.MathUtils.degToRad(v.envSwayDeg), Math.sin(a) * THREE.MathUtils.degToRad(v.envSwayDeg) * 0.6);
      post.render(scene, camera, { ...v.post, depthScale: DEPTH_SCALE }, frame, bg);
    },
    dispose() {
      post.dispose();
      envRT.dispose();
      nmap.dispose();
      meshes.forEach((m) => m.geometry.dispose());
      mats.forEach((m) => m.dispose());
      occTex.dispose();
    },
  };
};

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { cameraAt, type CameraVariant } from "./camera";
import { mulberry32 } from "./random";
import { buildVoxels, VOXEL, voxelPose, type VoxelPose } from "./voxels";

/**
 * Three.js world for the voxel-brain shot: a high-key studio floor of
 * bevelled white tiles with recessed glowing pools, a white pedestal wired
 * into a glowing cyan circuit loop, and ~1k glassy cyan cubes that fly in
 * and assemble into a brain. Rendered through a small custom post chain
 * (depth-of-field + soft bloom + vignette) at full composition resolution.
 */

const BG = new THREE.Color("#f2fcfd");
const TILE = 1.3;
const GAP = 0.045;
const SLAB = 0.5; // tile slab thickness
const PEDESTAL = { w: 3.1, h: 0.78, d: 2.4 };
/** Horizontal offset of the tile grid so no seam lines up with the lens axis. */
const X_OFF = 0.37;
const POOL_DEPTH = -0.44;
/**
 * Recessed pools in world units [x0, x1, z0, z1], laid out from the
 * reference frame: a large pool left of the circuit and a wide one behind
 * the pedestal. Tiles whose centres fall inside are removed.
 */
const POOLS: [number, number, number, number][] = [
  [-12.2, -5.4, -4.4, 0.7],
  [-5.4, 3.8, -6.9, -3.0],
];
/** Small per-row offset so the tile seams read staggered rather than as one grid. */
const rowShift = (j: number) => (((j % 3) + 3) % 3) * 0.17 - 0.17;
/** Circuit loop corners (front-left, front-right, back-right, back-left) on the floor. */
const LOOP = { fz: 3.2, fl: -3.0, fr: 2.85, bz: -4.6, bl: -4.1, br: 5.1 };

// ---------------------------------------------------------------------------
// Textures
// ---------------------------------------------------------------------------
const makeCubeTexture = () => {
  // Clear glass cube: bright white rim, and through the glass the cube's own
  // back edges (dark navy lines converging to a smaller back face) over a
  // deep teal interior. No inset panel, so the lattice reads see-through.
  const s = 256;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const g = c.getContext("2d")!;
  const body = g.createLinearGradient(0, 0, s, s);
  body.addColorStop(0, "#a3e2ee");
  body.addColorStop(0.5, "#5ab9d2");
  body.addColorStop(1, "#80cee0");
  g.fillStyle = body;
  g.fillRect(0, 0, s, s);
  // Interior depth: darker towards the back face.
  const depth = g.createRadialGradient(s * 0.56, s * 0.56, s * 0.05, s * 0.5, s * 0.5, s * 0.62);
  depth.addColorStop(0, "rgba(22,70,96,0.32)");
  depth.addColorStop(1, "rgba(22,70,96,0.0)");
  g.fillStyle = depth;
  g.fillRect(0, 0, s, s);
  // Back face edges and the edges joining them to the front corners.
  const b0 = s * 0.3;
  const b1 = s * 0.82;
  g.strokeStyle = "rgba(24,62,86,0.62)";
  g.lineWidth = s * 0.03;
  g.strokeRect(b0, b0, b1 - b0, b1 - b0);
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(b0, b0);
  g.moveTo(s, 0);
  g.lineTo(b1, b0);
  g.moveTo(0, s);
  g.lineTo(b0, b1);
  g.moveTo(s, s);
  g.lineTo(b1, b1);
  g.stroke();
  // Faint highlight on the back edges (refraction).
  g.strokeStyle = "rgba(210,248,255,0.35)";
  g.lineWidth = s * 0.012;
  g.strokeRect(b0 + s * 0.02, b0 + s * 0.02, b1 - b0, b1 - b0);
  // Specular sheen across the front glass.
  const sheen = g.createLinearGradient(0, 0, s, s * 0.7);
  sheen.addColorStop(0, "rgba(255,255,255,0.32)");
  sheen.addColorStop(0.4, "rgba(255,255,255,0.0)");
  g.fillStyle = sheen;
  g.fillRect(0, 0, s, s);
  // Bright white rim.
  g.strokeStyle = "rgba(255,255,255,0.98)";
  g.lineWidth = s * 0.05;
  g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, s - g.lineWidth, s - g.lineWidth);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
};

// ---------------------------------------------------------------------------
// Post-processing shaders
// ---------------------------------------------------------------------------
const FULLSCREEN_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BLUR_FRAG = /* glsl */ `
  uniform sampler2D tInput;
  uniform vec2 uDir;
  varying vec2 vUv;
  void main() {
    // 9-tap gaussian (sigma ~ 2 texels), linear-sampled
    vec4 c = texture2D(tInput, vUv) * 0.2270270270;
    c += texture2D(tInput, vUv + uDir * 1.3846153846) * 0.3162162162;
    c += texture2D(tInput, vUv - uDir * 1.3846153846) * 0.3162162162;
    c += texture2D(tInput, vUv + uDir * 3.2307692308) * 0.0702702703;
    c += texture2D(tInput, vUv - uDir * 3.2307692308) * 0.0702702703;
    gl_FragColor = c;
  }
`;

const COMPOSITE_FRAG = /* glsl */ `
  uniform sampler2D tSharp;
  uniform sampler2D tBlurA;
  uniform sampler2D tBlurB;
  uniform sampler2D tDepth;
  uniform float uNear;
  uniform float uFar;
  uniform float uFocus;
  uniform float uFocusRange;
  uniform float uFarBlur;
  uniform float uNearBlur;
  uniform float uBloom;
  varying vec2 vUv;

  float linearDepth(float d) {
    float z = d * 2.0 - 1.0;
    return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
  }

  void main() {
    vec4 sharp = texture2D(tSharp, vUv);
    vec4 blurA = texture2D(tBlurA, vUv);
    vec4 blurB = texture2D(tBlurB, vUv);
    float d = linearDepth(texture2D(tDepth, vUv).x);
    float behind = clamp((d - uFocus - uFocusRange) / (uFocus * uFarBlur), 0.0, 1.0);
    float front = clamp((uFocus - uFocusRange - d) / (uFocus * uNearBlur), 0.0, 1.0);
    float coc = max(behind, front);
    vec3 col = sharp.rgb;
    col = mix(col, blurA.rgb, smoothstep(0.0, 0.5, coc));
    col = mix(col, blurB.rgb, smoothstep(0.45, 1.0, coc));
    // Soft high-key bloom from the widest blur.
    col += max(blurB.rgb - vec3(0.72), vec3(0.0)) * uBloom;
    // Gentle vignette
    vec2 q = vUv - 0.5;
    col *= 1.0 - dot(q, q) * 0.06;
    // Dither (+/- half a code value) to avoid stepped rings in the bright sky.
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    col += (n - 0.5) / 255.0;
    gl_FragColor = linearToOutputTexel(vec4(col, 1.0));
  }
`;

// ---------------------------------------------------------------------------
// World
// ---------------------------------------------------------------------------
export class BrainWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private rtScene: THREE.WebGLRenderTarget;
  private rtSmallA: THREE.WebGLRenderTarget;
  private rtSmallB: THREE.WebGLRenderTarget;
  private rtTinyA: THREE.WebGLRenderTarget;
  private rtTinyB: THREE.WebGLRenderTarget;
  private postScene = new THREE.Scene();
  private postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: THREE.Mesh;
  private blurMat: THREE.ShaderMaterial;
  private copyMat: THREE.MeshBasicMaterial;
  private compositeMat: THREE.ShaderMaterial;
  private voxels = buildVoxels();
  private cubes: THREE.InstancedMesh;
  private cubeMat: THREE.MeshStandardMaterial;
  private brainGroup = new THREE.Group();
  private pose: VoxelPose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 0, glow: 0 };
  private dummy = new THREE.Object3D();
  private nearTiles: THREE.InstancedMesh | null = null;
  private nearCells: { x: number; z: number; h: number; ph: number }[] = [];
  private tmpColor = new THREE.Color();
  private disposables: { dispose: () => void }[] = [];

  constructor(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    private variant: CameraVariant,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.camera = new THREE.PerspectiveCamera(30, width / height, 0.5, 220);

    const depthTexture = new THREE.DepthTexture(width, height);
    depthTexture.type = THREE.UnsignedIntType;
    this.rtScene = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: 4,
      depthTexture,
    });
    const sw = Math.round(width / 4);
    const sh = Math.round(height / 4);
    const tw = Math.round(width / 12);
    const th = Math.round(height / 12);
    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false };
    this.rtSmallA = new THREE.WebGLRenderTarget(sw, sh, rtOpts);
    this.rtSmallB = new THREE.WebGLRenderTarget(sw, sh, rtOpts);
    this.rtTinyA = new THREE.WebGLRenderTarget(tw, th, rtOpts);
    this.rtTinyB = new THREE.WebGLRenderTarget(tw, th, rtOpts);

    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: BLUR_FRAG,
      uniforms: { tInput: { value: null }, uDir: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    this.copyMat = new THREE.MeshBasicMaterial({ toneMapped: false, depthTest: false });
    this.compositeMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: COMPOSITE_FRAG,
      uniforms: {
        tSharp: { value: this.rtScene.texture },
        tBlurA: { value: this.rtSmallA.texture },
        tBlurB: { value: this.rtTinyA.texture },
        tDepth: { value: depthTexture },
        uNear: { value: this.camera.near },
        uFar: { value: this.camera.far },
        uFocus: { value: 17 },
        uFocusRange: { value: 2.5 },
        uFarBlur: { value: 1.6 },
        uNearBlur: { value: 0.4 },
        uBloom: { value: 0.18 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyMat);
    this.quad.frustumCulled = false;
    this.postScene.add(this.quad);

    this.scene.background = BG.clone();
    this.scene.fog = new THREE.Fog(BG.clone(), 16, 62);

    this.buildLights();
    this.buildFloor();
    this.buildPedestalAndCircuit();
    const { mesh, mat } = this.buildBrain();
    this.cubes = mesh;
    this.cubeMat = mat;

    this.disposables.push(
      this.rtScene,
      this.rtSmallA,
      this.rtSmallB,
      this.rtTinyA,
      this.rtTinyB,
      this.blurMat,
      this.copyMat,
      this.compositeMat,
    );
  }

  // ------------------------------------------------------------------ lights
  private buildLights() {
    const hemi = new THREE.HemisphereLight("#f8fdff", "#a7c3d1", 1.45);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight("#ffffff", 1.45);
    key.position.set(-7, 14, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    const sc = key.shadow.camera;
    sc.left = -16;
    sc.right = 16;
    sc.top = 16;
    sc.bottom = -16;
    sc.near = 1;
    sc.far = 50;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    this.scene.add(key);
    this.scene.add(key.target);
    const fill = new THREE.DirectionalLight("#e4f7ff", 0.55);
    fill.position.set(8, 5, 12);
    this.scene.add(fill);
  }

  // ------------------------------------------------------------------- floor
  private isPool(i: number, j: number) {
    // i: column index (x), j: row index (z); cell centre = (i + 0.5) * TILE
    const x = (i + 0.5) * TILE + X_OFF + rowShift(j);
    const z = (j + 0.5) * TILE;
    return POOLS.some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  }

  private buildFloor() {
    const rand = mulberry32(99);
    const mat = new THREE.MeshStandardMaterial({
      color: "#ffffff",
      roughness: 0.62,
      metalness: 0.0,
    });
    type Cell = { x: number; z: number; h: number; tint: number; ph: number };
    const near: Cell[] = [];
    const far: Cell[] = [];
    for (let j = -84; j < 22; j++) {
      const z = (j + 0.5) * TILE;
      const halfWidth = 42 + Math.abs(Math.min(z, 0)) * 0.95;
      for (let i = -90; i < 90; i++) {
        const x = (i + 0.5) * TILE + X_OFF + rowShift(j);
        if (Math.abs(x) > halfWidth) continue;
        if (this.isPool(i, j)) continue;
        // Keep the pedestal area flat; elsewhere tiles sit at slightly
        // uneven heights like the reference.
        const nearPed = Math.abs(x) < 4.5 && z > -2.2 && z < 2.6;
        const h = nearPed ? 0 : (rand() - 0.45) * 0.1 + (rand() < 0.06 ? 0.09 : 0);
        const cell = { x, z, h, tint: rand(), ph: nearPed ? -1 : rand() * Math.PI * 2 };
        if (Math.hypot(x + 1, z) < 26) near.push(cell);
        else far.push(cell);
      }
    }
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    const addTiles = (cells: Cell[], segments: number) => {
      const geo = new RoundedBoxGeometry(TILE - GAP, SLAB, TILE - GAP, segments, 0.09);
      const mesh = new THREE.InstancedMesh(geo, mat, cells.length);
      cells.forEach((c, idx) => {
        d.position.set(c.x, -SLAB / 2 + c.h, c.z);
        d.updateMatrix();
        mesh.setMatrixAt(idx, d.matrix);
        col.setRGB(0.88 + c.tint * 0.09, 0.93 + c.tint * 0.06, 0.96 + c.tint * 0.04, THREE.SRGBColorSpace);
        mesh.setColorAt(idx, col);
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
      this.disposables.push(geo);
      return mesh;
    };
    this.nearTiles = addTiles(near, 3);
    this.nearCells = near;
    addTiles(far, 1);

    // Dark seam underlay so the gaps between tiles read as fine dark lines.
    const under = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: "#93a9b6", roughness: 1 }),
    );
    under.rotation.x = -Math.PI / 2;
    under.position.y = -SLAB - 0.02;
    under.receiveShadow = true;
    this.scene.add(under);

    // Glowing blue pool floors.
    const poolMat = new THREE.MeshStandardMaterial({
      color: "#7fb3c7",
      emissive: "#3f8eae",
      emissiveIntensity: 0.08,
      roughness: 0.25,
    });
    // Water surface: dark along the near wall, lighter towards the far wall.
    const pc = document.createElement("canvas");
    pc.width = 4;
    pc.height = 128;
    const pg = pc.getContext("2d")!;
    const grad = pg.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, "#d9f1f8");
    grad.addColorStop(0.45, "#9fcfe0");
    grad.addColorStop(1, "#3f7f9c");
    pg.fillStyle = grad;
    pg.fillRect(0, 0, 4, 128);
    const poolTex = new THREE.CanvasTexture(pc);
    poolTex.colorSpace = THREE.SRGBColorSpace;
    poolMat.map = poolTex;
    poolMat.color.set("#ffffff");
    this.disposables.push(poolTex);
    for (const [x0, x1, z0, z1] of POOLS) {
      const w = x1 - x0 + TILE * 2;
      const dpt = z1 - z0 + TILE * 2;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, dpt), poolMat);
      p.rotation.x = -Math.PI / 2;
      p.position.set((x0 + x1) / 2, POOL_DEPTH, (z0 + z1) / 2);
      p.receiveShadow = true;
      this.scene.add(p);
    }
    this.disposables.push(mat, poolMat);
  }

  // --------------------------------------------------- pedestal and circuit
  private buildPedestalAndCircuit() {
    const white = new THREE.MeshStandardMaterial({ color: "#f6fafc", roughness: 0.5 });
    const ped = new THREE.Mesh(
      new RoundedBoxGeometry(PEDESTAL.w, PEDESTAL.h, PEDESTAL.d, 3, 0.07),
      white,
    );
    ped.position.set(0, PEDESTAL.h / 2, 0);
    ped.castShadow = true;
    ped.receiveShadow = true;
    this.scene.add(ped);

    // Recessed connector slot on the pedestal's front face.
    const slotMat = new THREE.MeshStandardMaterial({ color: "#7d93a1", roughness: 0.8 });
    const slot = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.34, 0.06), slotMat);
    slot.position.set(0, 0.17, PEDESTAL.d / 2 + 0.005);
    this.scene.add(slot);
    const prongMat = new THREE.MeshStandardMaterial({ color: "#f3f8fa", roughness: 0.5 });
    // White frame pieces split the slot into two openings.
    for (const [sx, w] of [[0, 0.16], [-0.6, 0.12], [0.6, 0.12]] as const) {
      const prong = new THREE.Mesh(new THREE.BoxGeometry(w, 0.36, 0.08), prongMat);
      prong.position.set(sx, 0.17, PEDESTAL.d / 2 + 0.01);
      this.scene.add(prong);
    }

    // Glowing circuit tubes.
    // Thin glass tubes: pale core, cyan rim (fresnel-like via low roughness).
    const tubeMat = new THREE.MeshStandardMaterial({
      color: "#e6f9fc",
      emissive: "#5bbcd6",
      emissiveIntensity: 0.3,
      roughness: 0.08,
      metalness: 0.0,
    });
    const y = 0.05;
    const tube = (pts: THREE.Vector3[], closed = false, radius = 0.052) => {
      const curve = new THREE.CatmullRomCurve3(pts, closed, "catmullrom", 0.0);
      const geo = new THREE.TubeGeometry(curve, Math.max(64, pts.length * 24), radius, 12, closed);
      const m = new THREE.Mesh(geo, tubeMat);
      m.castShadow = false;
      this.scene.add(m);
      this.disposables.push(geo);
    };
    // Rounded quadrilateral loop around the pedestal (measured from the reference).
    const quad = (c: [number, number][], r: number) => {
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k < c.length; k++) {
        const p0 = c[(k + c.length - 1) % c.length];
        const p1 = c[k];
        const p2 = c[(k + 1) % c.length];
        const d0 = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const d2 = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
        const a: [number, number] = [p1[0] + ((p0[0] - p1[0]) / d0) * r, p1[1] + ((p0[1] - p1[1]) / d0) * r];
        const b: [number, number] = [p1[0] + ((p2[0] - p1[0]) / d2) * r, p1[1] + ((p2[1] - p1[1]) / d2) * r];
        for (let q = 0; q <= 6; q++) {
          const u = q / 6;
          // quadratic bezier a -> corner -> b
          const x = (1 - u) * (1 - u) * a[0] + 2 * (1 - u) * u * p1[0] + u * u * b[0];
          const z = (1 - u) * (1 - u) * a[1] + 2 * (1 - u) * u * p1[1] + u * u * b[1];
          pts.push(new THREE.Vector3(x, y, z));
        }
      }
      return pts;
    };
    const L = LOOP;
    tube(quad([[L.fl, L.fz], [L.fr, L.fz], [L.br, L.bz], [L.bl, L.bz]], 0.7), true);
    // Side feeds from the pedestal into the loop.
    const sideX = (t: number, left: boolean) =>
      left ? L.fl + (L.bl - L.fl) * t : L.fr + (L.br - L.fr) * t;
    const feedZ = 0.1;
    const tf = (L.fz - feedZ) / (L.fz - L.bz);
    tube([new THREE.Vector3(sideX(tf, true), y, feedZ), new THREE.Vector3(-PEDESTAL.w / 2, y, feedZ)]);
    tube([new THREE.Vector3(PEDESTAL.w / 2, y, feedZ), new THREE.Vector3(sideX(tf, false), y, feedZ)]);
    // Two parallel traces from the front slot to the loop.
    for (const sx of [-0.13, 0.13]) {
      tube([new THREE.Vector3(sx, y, PEDESTAL.d / 2), new THREE.Vector3(sx, y, L.fz)], false, 0.04);
    }
    // Branch to the big left pool, which is framed by its own glass loop.
    const [px0, px1, pz0, pz1] = POOLS[0];
    const fx0 = Math.ceil((px0 - X_OFF) / TILE) * TILE + X_OFF - TILE / 2 + 0.1;
    const fx1 = Math.floor((px1 - X_OFF) / TILE) * TILE + X_OFF + TILE / 2 - 0.1;
    const fz0 = Math.ceil(pz0 / TILE) * TILE - TILE / 2 + 0.1;
    const fz1 = Math.floor(pz1 / TILE) * TILE + TILE / 2 - 0.1;
    tube([new THREE.Vector3(sideX(tf, true), y, feedZ), new THREE.Vector3(fx1, y, feedZ)]);
    tube(quad([[fx0, fz1], [fx1, fz1], [fx1, fz0], [fx0, fz0]], 0.4), true, 0.05);
    tube(
      [new THREE.Vector3(fx1 - 1.0, POOL_DEPTH + 0.04, fz0), new THREE.Vector3(fx1 - 3.6, POOL_DEPTH + 0.04, fz1)],
      false,
      0.04,
    );
    this.disposables.push(white, slotMat, prongMat, tubeMat);
  }

  // ------------------------------------------------------------------- brain
  private buildBrain() {
    const tex = makeCubeTexture();
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissiveMap: tex,
      emissive: new THREE.Color("#ffffff"),
      emissiveIntensity: 0.4,
      roughness: 0.15,
      metalness: 0.0,
    });
    const geo = new THREE.BoxGeometry(VOXEL * 0.97, VOXEL * 0.97, VOXEL * 0.97);
    const mesh = new THREE.InstancedMesh(geo, mat, this.voxels.length);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // No cast shadows: the reference shows none, and a swarm of small
    // casters only produces blotchy shadow-map artefacts.
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = false;
    this.brainGroup.position.set(0.08, PEDESTAL.h + 0.04, 0);
    this.brainGroup.add(mesh);
    this.scene.add(this.brainGroup);
    this.disposables.push(tex, mat, geo);
    return { mesh, mat };
  }

  private updateBrain(t: number) {
    const d = this.dummy;
    const p = this.pose;
    for (let i = 0; i < this.voxels.length; i++) {
      const v = this.voxels[i];
      voxelPose(v, t, p);
      d.position.set(p.x, p.y, p.z);
      d.rotation.set(p.rx, p.ry, p.rz);
      d.scale.setScalar(Math.max(p.scale, 0.0001));
      d.updateMatrix();
      this.cubes.setMatrixAt(i, d.matrix);
      const b = v.shade * (1 + p.glow * 0.35);
      this.tmpColor.setRGB(b, b, b);
      this.cubes.setColorAt(i, this.tmpColor);
    }
    this.cubes.instanceMatrix.needsUpdate = true;
    if (this.cubes.instanceColor) this.cubes.instanceColor.needsUpdate = true;
    // Subtle "alive" breathing once the brain is complete.
    this.cubeMat.emissiveIntensity = 0.4 + 0.03 * Math.sin(t * 2.1);
  }

  /** Slow, subtle rise-and-settle of the floor slabs (pedestal area stays put). */
  private updateTiles(t: number) {
    const mesh = this.nearTiles;
    if (!mesh) return;
    const d = this.dummy;
    d.rotation.set(0, 0, 0);
    d.scale.setScalar(1);
    this.nearCells.forEach((c, idx) => {
      const drift = c.ph < 0 ? 0 : 0.028 * Math.sin(t * 0.55 + c.ph) + 0.012 * Math.sin(t * 1.3 + c.ph * 2.1);
      d.position.set(c.x, -SLAB / 2 + c.h + drift, c.z);
      d.updateMatrix();
      mesh.setMatrixAt(idx, d.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  // ------------------------------------------------------------------ render
  private pass(mat: THREE.Material, target: THREE.WebGLRenderTarget | null) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.postScene, this.postCam);
  }

  private blur(src: THREE.WebGLRenderTarget, tmp: THREE.WebGLRenderTarget, iterations: number) {
    const w = src.width;
    const h = src.height;
    for (let k = 0; k < iterations; k++) {
      this.blurMat.uniforms.tInput.value = src.texture;
      this.blurMat.uniforms.uDir.value.set(1 / w, 0);
      this.pass(this.blurMat, tmp);
      this.blurMat.uniforms.tInput.value = tmp.texture;
      this.blurMat.uniforms.uDir.value.set(0, 1 / h);
      this.pass(this.blurMat, src);
    }
  }

  render(timeSec: number, durationSec: number) {
    const cam = cameraAt(this.variant, timeSec, durationSec);
    this.camera.position.copy(cam.position);
    this.camera.fov = cam.fov;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(cam.target);
    this.updateBrain(timeSec);
    this.updateTiles(timeSec);

    // 1) Scene -> MSAA HDR target with depth.
    this.renderer.setRenderTarget(this.rtScene);
    this.renderer.render(this.scene, this.camera);

    // 2) Downsample + blur: quarter-res (mild) and 1/12-res (strong).
    this.copyMat.map = this.rtScene.texture;
    this.pass(this.copyMat, this.rtSmallA);
    this.blur(this.rtSmallA, this.rtSmallB, 2);
    this.copyMat.map = this.rtSmallA.texture;
    this.pass(this.copyMat, this.rtTinyA);
    this.blur(this.rtTinyA, this.rtTinyB, 2);

    // 3) Depth-of-field composite to the canvas.
    const u = this.compositeMat.uniforms;
    u.uFocus.value = cam.focus;
    u.uNear.value = this.camera.near;
    u.uFar.value = this.camera.far;
    this.pass(this.compositeMat, null);
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
    this.renderer.dispose();
  }
}

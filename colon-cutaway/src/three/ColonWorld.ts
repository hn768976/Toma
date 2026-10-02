import * as THREE from "three";
import { buildColonGeometry, Centreline, CentrelineJson, ColonGeometry } from "./ColonModel";
import {
  BACTERIA_FRAG,
  CAP_FRAG,
  CAP_VERT,
  CLUMP_FRAG,
  LINING_FRAG,
  MAX_PATCHES,
  MOLECULE_FRAG,
  OUTER_FRAG,
  PART_VERT,
  PRECUT_FRAG,
  RING_FRAG,
  SPIKE_FRAG,
  STENCIL_FRAG,
  WALL_VERT,
} from "./shaders";
import { coccusGeometry, InstancedGroup, moleculeGeometries, rodGeometry, spikeGeometry } from "./particles";
import { ACES, Post, PostParams } from "./Post";
import { mulberry32 } from "../lib/random";

export type Assets = {
  colon: THREE.Object3D;
  clump: THREE.BufferGeometry;
  centreline: CentrelineJson;
};

const srgb = (hex: string) => new THREE.Color(hex); // three converts sRGB hex -> linear

export const PALETTE = {
  wall: srgb("#E8837C"),
  lining: srgb("#E8C497"),
  cap: srgb("#D9716B"),
  capLine: srgb("#F2DDBA"),
  inflamed: srgb("#A3161A"),
  clump: srgb("#4A3226"),
  clumpHigh: srgb("#6B4C39"),
};

export const MOLECULE_COLOURS = ["#FFE14D", "#B4F04C", "#52E6F2", "#94C8FF", "#F5F8FF"].map(srgb);
export const COOL_COLOURS = ["#F5F9FF", "#66E8F5", "#A9D4FF", "#D2ECFF"].map(srgb);
export const BACTERIA_COLOURS = ["#7FCB6A", "#3FB3A2", "#B5D65A", "#5CC38B"].map(srgb);
export const SPIKE_COLOURS = ["#FF4A26", "#FF6A2E", "#F23A2A"].map(srgb);

// thin cream line along the inner edge of the cut face, as a fraction of the wall
const LINE_FRAC = 0.24;

const BACKDROP_FRAG = /* glsl */ `
${ACES}
uniform vec3 uCentre;
uniform vec3 uEdge;
uniform float uAspect;
uniform float uExposure;
varying vec2 vUv;
void main() {
  vec2 q = (vUv - vec2(0.5, 0.54)) * vec2(uAspect, 1.0);
  float r = length(q) / length(vec2(uAspect, 1.0) * 0.5);
  float t = smoothstep(0.0, 1.05, r);
  vec3 display = mix(uCentre, uEdge, t);
  gl_FragColor = vec4(acesInverse(srgbToLinear(display), uExposure), 1.0);
}
`;

const SPECK_COUNT = 380;

export type ViewParams = {
  camPos: THREE.Vector3;
  target: THREE.Vector3;
  fov: number;
  focusPoint: THREE.Vector3;
  aperture: number;
  maxCoc: number;
  specksT: number; // drives the background specks; frame/600 keeps loops exact
  frame: number; // grain seed (comp 2 passes frame % 600)
};

export class ColonWorld {
  readonly cl: Centreline;
  readonly geo: ColonGeometry;
  readonly camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.5, 220);
  private stencilScene = new THREE.Scene();
  private capScene = new THREE.Scene();
  private mainScene = new THREE.Scene();
  private particleScene = new THREE.Scene();
  private backdropScene = new THREE.Scene();
  readonly speckScene = new THREE.Scene();
  private fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private shared: Record<string, THREE.IUniform>;
  readonly lining: THREE.ShaderMaterial;
  private backdrop: THREE.ShaderMaterial;
  private speckMat: THREE.ShaderMaterial | null = null;
  private post: Post | null = null;
  private specks: THREE.Points;

  readonly molecules: InstancedGroup[];
  readonly cool: InstancedGroup[];
  readonly rods: InstancedGroup;
  readonly cocci: InstancedGroup;
  readonly spikes: InstancedGroup;
  readonly clumps: InstancedGroup;

  constructor(assets: Assets) {
    this.cl = new Centreline(assets.centreline);
    this.geo = buildColonGeometry(assets.colon, this.cl);
    const g = this.geo;

    const L = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).normalize();
    // seeded tiling value-noise volume (smoothed a little so trilinear reads well)
    const NS = 32;
    const nrng = mulberry32(777);
    const raw = new Float32Array(NS * NS * NS).map(() => nrng());
    const vol = new Uint8Array(NS * NS * NS);
    const at = (x: number, y: number, z: number) => raw[((z + NS) % NS) * NS * NS + ((y + NS) % NS) * NS + ((x + NS) % NS)];
    for (let z = 0; z < NS; z++)
      for (let y = 0; y < NS; y++)
        for (let x = 0; x < NS; x++) {
          const v = at(x, y, z) * 0.4 + (at(x + 1, y, z) + at(x - 1, y, z) + at(x, y + 1, z) + at(x, y - 1, z) + at(x, y, z + 1) + at(x, y, z - 1)) * 0.1;
          vol[z * NS * NS + y * NS + x] = Math.round(THREE.MathUtils.clamp((v - 0.5) * 1.6 + 0.5, 0, 1) * 255);
        }
    const noise3D = new THREE.Data3DTexture(vol, NS, NS, NS);
    noise3D.format = THREE.RedFormat;
    noise3D.type = THREE.UnsignedByteType;
    noise3D.minFilter = THREE.LinearFilter;
    noise3D.magFilter = THREE.LinearFilter;
    noise3D.wrapS = noise3D.wrapT = noise3D.wrapR = THREE.RepeatWrapping;
    noise3D.unpackAlignment = 1;
    noise3D.needsUpdate = true;
    this.shared = {
      uNoise3D: { value: noise3D },
      uHF: { value: g.heightfield },
      uHFRect: { value: g.hfRect },
      uHFRes: { value: g.heightfield.image.width },
      uCamPos: { value: new THREE.Vector3() },
      uKeyDir: { value: L(-0.55, 0.75, 0.6) },
      uKeyCol: { value: new THREE.Color(1.0, 0.96, 0.9).multiplyScalar(1.12) },
      uFillDir: { value: L(0.7, -0.15, 0.55) },
      uFillCol: { value: new THREE.Color(0.55, 0.66, 0.85).multiplyScalar(0.42) },
      uRimDir: { value: L(0.25, 0.5, -0.85) },
      uRimCol: { value: new THREE.Color(0.8, 0.9, 1.0).multiplyScalar(0.5) },
      uSkyCol: { value: new THREE.Color(0.42, 0.47, 0.56).multiplyScalar(0.42) },
      uGroundCol: { value: new THREE.Color(0.36, 0.3, 0.29).multiplyScalar(0.42) },
    };
    const S = this.shared;

    const liningUniforms = () => ({
      uLiningCol: { value: PALETTE.lining },
      uInflamedCol: { value: PALETTE.inflamed },
      uLength: { value: this.cl.length },
      uHaustra: { value: 0.95 },
      uPatch: { value: Array.from({ length: MAX_PATCHES }, () => new THREE.Vector4(-10, 0, 1, 1)) },
      uPatchState: { value: Array.from({ length: MAX_PATCHES }, () => new THREE.Vector2(0, 0)) },
      uPatchCount: { value: 0 },
    });
    if (this.cl.precut) {
      // the model already has its cut + wall: shade it directly
      this.lining = new THREE.ShaderMaterial({
        vertexShader: WALL_VERT,
        fragmentShader: PRECUT_FRAG,
        uniforms: {
          ...S,
          uOffA: { value: 0 },
          uOffB: { value: 0 },
          uWallCol: { value: PALETTE.wall },
          uCapCol: { value: PALETTE.cap },
          uLineCol: { value: PALETTE.capLine },
          uLiningEdge: { value: -0.86 },
          uLineEdge: { value: -0.7 },
          ...liningUniforms(),
        },
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(g.shell, this.lining);
      mesh.frustumCulled = false;
      this.mainScene.add(mesh);
    } else {
      this.lining = this.buildCutaway(S, liningUniforms());
    }

    // ---- particles ----
    const partMat = (frag: string, extra: Record<string, THREE.IUniform> = {}) =>
      new THREE.ShaderMaterial({
        vertexShader: PART_VERT,
        fragmentShader: frag,
        uniforms: { ...S, ...extra },
        transparent: true,
        depthWrite: true,
      });
    const molMat = partMat(MOLECULE_FRAG);
    this.molecules = moleculeGeometries().map((geo) => new InstancedGroup(geo, molMat, 220));
    this.cool = moleculeGeometries().map((geo) => new InstancedGroup(geo, molMat, 140));
    const bacMat = partMat(BACTERIA_FRAG);
    this.rods = new InstancedGroup(rodGeometry(), bacMat, 170);
    this.cocci = new InstancedGroup(coccusGeometry(), bacMat, 90);
    this.spikes = new InstancedGroup(spikeGeometry(), partMat(SPIKE_FRAG), 90);
    const clumpGeo = assets.clump.clone();
    this.clumps = new InstancedGroup(
      clumpGeo,
      partMat(CLUMP_FRAG, {
        uClumpCol: { value: PALETTE.clump },
        uClumpHigh: { value: PALETTE.clumpHigh },
      }),
      60 * 6,
    );
    // clumps are opaque: draw them with the wall
    (this.clumps.mesh.material as THREE.ShaderMaterial).transparent = false;
    this.mainScene.add(this.clumps.mesh);
    // explicit, fixed draw order for the (translucent) particle groups
    this.clumps.mesh.renderOrder = 1;
    [...this.molecules, ...this.cool, this.rods, this.cocci, this.spikes].forEach((grp, i) => {
      grp.mesh.renderOrder = 10 + i;
      this.particleScene.add(grp.mesh);
    });

    // ---- backdrop ----
    this.backdrop = new THREE.ShaderMaterial({
      vertexShader: `varying vec2 vUv; void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: BACKDROP_FRAG,
      uniforms: {
        uCentre: { value: new THREE.Color(0x8fa6bc).convertLinearToSRGB() },
        uEdge: { value: new THREE.Color(0x5f7891).convertLinearToSRGB() },
        uAspect: { value: 16 / 9 },
        uExposure: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const tri = new THREE.BufferGeometry();
    tri.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    const bd = new THREE.Mesh(tri, this.backdrop);
    bd.frustumCulled = false;
    this.backdropScene.add(bd);

    // ---- background specks (seeded) ----
    const rng = mulberry32(90210);
    const pos = new Float32Array(SPECK_COUNT * 3);
    const sp = new Float32Array(SPECK_COUNT * 4);
    const mo = new Float32Array(SPECK_COUNT * 4);
    for (let i = 0; i < SPECK_COUNT; i++) {
      const front = rng() < 0.12;
      pos[i * 3] = (rng() * 2 - 1) * 24;
      pos[i * 3 + 1] = (rng() * 2 - 1) * 15;
      pos[i * 3 + 2] = front ? 2 + rng() * 6 : -3 - rng() * 22;
      sp[i * 4] = (front ? 90 : 55) + rng() * 120; // size (px at 1080p * distance)
      sp[i * 4 + 1] = (front ? 0.08 : 0.22) + rng() * 0.35; // brightness
      sp[i * 4 + 2] = rng();
      mo[i * 4] = rng();
      mo[i * 4 + 1] = rng();
      mo[i * 4 + 2] = rng();
      mo[i * 4 + 3] = 0.25 + rng() * 0.6;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    sg.setAttribute("aSpeck", new THREE.BufferAttribute(sp, 4));
    sg.setAttribute("aMotion", new THREE.BufferAttribute(mo, 4));
    this.specks = new THREE.Points(sg);
    this.specks.frustumCulled = false;
    this.speckScene.add(this.specks);
  }

  /** Closed shell -> cutaway: clip at the cut heightfield, stencil-cap the wall. */
  private buildCutaway(S: Record<string, THREE.IUniform>, liningU: Record<string, THREE.IUniform>) {
    const g = this.geo;
    // ---- stencil passes (parity: INVERT per surface crossing) ----
    const stencilMat = (offA: number, offB: number, mask: number) =>
      new THREE.ShaderMaterial({
        vertexShader: WALL_VERT,
        fragmentShader: STENCIL_FRAG,
        uniforms: { ...S, uOffA: { value: offA }, uOffB: { value: offB } },
        side: THREE.DoubleSide,
        colorWrite: false,
        depthWrite: false,
        depthTest: false,
        stencilWrite: true,
        stencilFunc: THREE.AlwaysStencilFunc,
        stencilRef: 0,
        stencilWriteMask: mask,
        stencilFuncMask: 0xff,
        stencilFail: THREE.KeepStencilOp,
        stencilZFail: THREE.InvertStencilOp,
        stencilZPass: THREE.InvertStencilOp,
      });
    const addMesh = (scene: THREE.Scene, geo: THREE.BufferGeometry, mat: THREE.Material, order = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.frustumCulled = false;
      m.renderOrder = order;
      scene.add(m);
      return m;
    };
    // bit 0: inside the wall (outer surface O and inner surface I)
    // bit 1: inside the cream-line shell (I and I' = I pushed back by the line width)
    addMesh(this.stencilScene, g.shell, stencilMat(0, 0, 1));
    addMesh(this.stencilScene, g.shell, stencilMat(1, 1, 3));
    addMesh(this.stencilScene, g.shell, stencilMat(1 - LINE_FRAC, 1 - LINE_FRAC, 2));
    if (g.ring) {
      addMesh(this.stencilScene, g.ring, stencilMat(0, 1, 1));
      addMesh(this.stencilScene, g.ring, stencilMat(1 - LINE_FRAC, 1, 2));
    }

    // ---- cap: cut face, pink where stencil == 01, cream where == 11 ----
    const capMat = (col: THREE.Color, ref: number) =>
      new THREE.ShaderMaterial({
        vertexShader: CAP_VERT,
        fragmentShader: CAP_FRAG,
        uniforms: { ...S, uCapCol: { value: col } },
        side: THREE.DoubleSide,
        stencilWrite: true,
        stencilFunc: THREE.EqualStencilFunc,
        stencilRef: ref,
        stencilFuncMask: 3,
        stencilWriteMask: 0,
      });
    addMesh(this.capScene, g.cap, capMat(PALETTE.cap, 1));
    addMesh(this.capScene, g.cap, capMat(PALETTE.capLine, 3));

    // ---- visible wall ----
    const outer = new THREE.ShaderMaterial({
      vertexShader: WALL_VERT,
      fragmentShader: OUTER_FRAG,
      uniforms: { ...S, uOffA: { value: 0 }, uOffB: { value: 0 }, uWallCol: { value: PALETTE.wall } },
      side: THREE.FrontSide,
    });
    addMesh(this.mainScene, g.shell, outer);
    const lining = new THREE.ShaderMaterial({
      vertexShader: WALL_VERT,
      fragmentShader: LINING_FRAG,
      uniforms: { ...S, uOffA: { value: 1 }, uOffB: { value: 1 }, ...liningU },
      side: THREE.BackSide,
    });
    addMesh(this.mainScene, g.shell, lining);
    if (g.ring) {
      addMesh(
        this.mainScene,
        g.ring,
        new THREE.ShaderMaterial({
          vertexShader: WALL_VERT,
          fragmentShader: RING_FRAG,
          uniforms: {
            ...S,
            uOffA: { value: 0 },
            uOffB: { value: 1 },
            uCapCol: { value: PALETTE.cap },
            uLineCol: { value: PALETTE.capLine },
            uLineFrac: { value: LINE_FRAC },
          },
          side: THREE.DoubleSide,
        }),
      );
    }
    return lining;
  }

  private debugLine: THREE.Line | null = null;
  setDebugLine(on: boolean) {
    if (on && !this.debugLine) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 600; i++) pts.push(this.cl.point(i / 600));
      const line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: new THREE.Color(0.1, 0.25, 1.6), depthTest: false }),
      );
      line.renderOrder = 100;
      line.frustumCulled = false;
      this.debugLine = line;
      this.particleScene.add(line);
    }
    if (this.debugLine) this.debugLine.visible = on;
  }

  setPatches(patches: { u: number; theta: number; halfLen: number; halfAngle: number; inflammation: number; shimmer: number }[]) {
    const U = this.lining.uniforms;
    patches.slice(0, MAX_PATCHES).forEach((p, i) => {
      (U.uPatch.value as THREE.Vector4[])[i].set(p.u, p.theta, p.halfLen, p.halfAngle);
      (U.uPatchState.value as THREE.Vector2[])[i].set(p.inflammation, p.shimmer);
    });
    U.uPatchCount.value = Math.min(MAX_PATCHES, patches.length);
  }

  private ensurePost(renderer: THREE.WebGLRenderer) {
    const size = renderer.getDrawingBufferSize(new THREE.Vector2());
    if (this.post && this.post.width === size.x && this.post.height === size.y) return this.post;
    this.post?.dispose();
    // MSAA x4 up to 4K; supersampled stills (6000 px) get x2 to save memory
    const samples = size.y > 2200 ? 2 : 4;
    this.post = new Post(renderer, size.x, size.y, samples);
    const mat = this.post.speckMaterial;
    // swap in motion: specks drift on closed paths (whole cycles per 600 frames)
    mat.vertexShader = mat.vertexShader
      .replace("attribute vec4 aSpeck;", "attribute vec4 aSpeck;\nattribute vec4 aMotion;\nuniform float uT;")
      .replace(
        "vec4 mv = modelViewMatrix * vec4(position, 1.0);",
        `float T = 6.2831853 * uT;
  vec3 p = position + aMotion.w * vec3(sin(T + 6.2831853 * aMotion.x), 0.7 * cos(T + 6.2831853 * aMotion.y), 0.4 * sin(T + 6.2831853 * aMotion.z));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);`,
      );
    mat.uniforms.uT = { value: 0 };
    mat.needsUpdate = true;
    this.speckMat = mat;
    this.specks.material = mat;
    return this.post;
  }

  render(renderer: THREE.WebGLRenderer, v: ViewParams, pp: Omit<PostParams, "near" | "far" | "focus" | "aperture" | "maxCoc" | "frame">) {
    const post = this.ensurePost(renderer);
    const cam = this.camera;
    cam.fov = v.fov;
    cam.aspect = post.width / post.height;
    cam.position.copy(v.camPos);
    cam.up.set(0, 1, 0);
    cam.lookAt(v.target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    (this.shared.uCamPos.value as THREE.Vector3).copy(cam.position);
    this.backdrop.uniforms.uAspect.value = post.width / post.height;
    this.backdrop.uniforms.uExposure.value = pp.exposure;
    if (this.speckMat) this.speckMat.uniforms.uT.value = v.specksT;

    for (const grp of [...this.molecules, ...this.cool, this.rods, this.cocci, this.spikes, this.clumps]) grp.commit();

    renderer.autoClear = false;
    renderer.setRenderTarget(post.sceneRT);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(this.backdropScene, this.fsCam);
    renderer.render(this.stencilScene, cam);
    renderer.render(this.capScene, cam);
    renderer.clearStencil();
    renderer.render(this.mainScene, cam);
    renderer.render(this.particleScene, cam);

    const focus = cam.position.distanceTo(v.focusPoint);
    post.finish(
      { ...pp, near: cam.near, far: cam.far, focus, aperture: v.aperture, maxCoc: v.maxCoc, frame: v.frame },
      this.speckScene,
      cam,
    );
  }

  dispose() {
    this.post?.dispose();
  }
}

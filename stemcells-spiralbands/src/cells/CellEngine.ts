// Renders one frame of a cell scene.
//
// Pipeline (all intermediate targets are RGBA half-float):
//  1. Backdrop quad into the main target.
//  2. Every cell is an impostor: it is rendered on its own (back glass,
//     nucleus, front glass) into a multisampled target framed tightly on its
//     screen bounds, then blurred by a DoF gather pass with its own circle of
//     confusion, then composited back to front into the main target.
//     Rendering each cell separately lets transparent cells blur correctly
//     over each other, and the blur changes continuously with depth (no
//     layer popping). The impostor grid is attached to the cell, and its
//     resolution drops as its blur grows, which keeps far and near cells
//     cheap. Particles are drawn in depth groups between the cells.
//  3. Final pass to the canvas: sRGB, blue-noise dither, grain.
import * as THREE from "three";
import { getBlueNoiseTexture } from "../lib/blueNoise";
import { FINAL_FRAG, FULLSCREEN_VERT } from "../lib/glsl";
import { getLatheGeometry, LATHE_LODS, RINGS, solveProfile, type ProfileParams } from "./lathe";
import {
  makeBackdropMaterial,
  makeCompositeMaterial,
  makeGatherMaterial,
  makeMembraneMaterials,
  makeNucleusMaterial,
  makeParticleMaterial,
  makeHaloMaterial,
  type SharedUniforms,
} from "./materials";
import { getNucleusGeometry } from "./nucleusGeometry";
import type { CellColors, CellSceneDef } from "./types";

const lin = (hex: string) => new THREE.Color(hex); // THREE.Color stores linear

const POOL_SIZES = [128, 256, 512, 1024, 2048];
const NUCLEUS_SEEDS = [101, 202, 303, 404];
const PARTICLE_GROUPS = 6;
/** Max blur radius inside an impostor, in impostor texels. */
const MAX_TEXEL_BLUR = 6;
const COC_CAP_1080 = 70;

type CellObject = {
  scene: THREE.Scene;
  membranes: THREE.Mesh[];
  group: THREE.Group;
  own: Record<string, THREE.IUniform>;
  nuclei: THREE.Mesh[];
  fragments: THREE.Mesh[];
  profileKey: string;
};

type PoolEntry = {
  msaa: THREE.WebGLRenderTarget;
  plain: THREE.WebGLRenderTarget;
  blur: THREE.WebGLRenderTarget;
};

const rtOpts = (samples: number): THREE.RenderTargetOptions => ({
  type: THREE.HalfFloatType,
  format: THREE.RGBAFormat,
  minFilter: THREE.LinearFilter,
  magFilter: THREE.LinearFilter,
  depthBuffer: true,
  stencilBuffer: false,
  samples,
  generateMipmaps: false,
});

export class CellEngine {
  private gl: THREE.WebGLRenderer;
  private def: CellSceneDef;
  private colors: CellColors;
  private loopFrames: number;
  private shared: SharedUniforms;
  private cells: CellObject[] = [];
  private camera = new THREE.PerspectiveCamera(38, 16 / 9, 0.05, 400);
  private subCam = new THREE.PerspectiveCamera(38, 16 / 9, 0.05, 400);
  private mainRT: THREE.WebGLRenderTarget | null = null;
  private pool = new Map<number, PoolEntry>();
  private size = new THREE.Vector2();
  private quadScene = new THREE.Scene();
  private quad: THREE.Mesh;
  private orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private backdropMat: THREE.ShaderMaterial;
  private gatherMat = makeGatherMaterial();
  private compositeMat = makeCompositeMaterial();
  private finalMat: THREE.RawShaderMaterial;
  private particleScenes: THREE.Scene[] = [];
  private particleDepth: number[] = [];
  private tmpV = new THREE.Vector3();
  private profileOut = Array.from({ length: RINGS }, () => new THREE.Vector4());
  private profileCache = new Map<string, THREE.Vector4[]>();
  public lastStats = { impostors: 0, texels: 0 };
  /** Debug: draw only cell 0 (used for the model check stills). */
  public isolate = false;
  /** Debug: log per-stage timings (forces GPU sync). */
  public profile = false;
  private prof: Record<string, number> = {};
  private mark(name: string, t0: number) {
    if (!this.profile) return t0;
    const ctx = this.gl.getContext() as WebGL2RenderingContext;
    const fmt = ctx.getParameter(ctx.IMPLEMENTATION_COLOR_READ_FORMAT);
    const typ = ctx.getParameter(ctx.IMPLEMENTATION_COLOR_READ_TYPE);
    const px = typ === ctx.FLOAT ? new Float32Array(4) : typ === ctx.HALF_FLOAT ? new Uint16Array(4) : new Uint8Array(4);
    ctx.readPixels(0, 0, 1, 1, fmt, typ, px);
    const t = performance.now();
    this.prof[name] = (this.prof[name] ?? 0) + (t - t0);
    return t;
  }

  constructor(gl: THREE.WebGLRenderer, def: CellSceneDef, colors: CellColors, loopFrames: number) {
    this.gl = gl;
    this.def = def;
    this.colors = colors;
    this.loopFrames = loopFrames;
    const c = colors;
    // Softbox on the same side as the backdrop glow (upper right), so the
    // highlight and the backlight agree.
    const winDir = new THREE.Vector3(0.5, 0.6, 0.62).normalize();
    this.shared = {
      uBgEdge: { value: lin(c.backdrop.edge) },
      uBgMid: { value: lin(c.backdrop.mid) },
      uBgCore: { value: lin(c.backdrop.core).multiplyScalar(c.backdrop.coreGain) },
      uGlowPos: { value: new THREE.Vector2(...c.backdrop.glowPos) },
      uGlowShape: { value: new THREE.Vector2(c.backdrop.glowWide, c.backdrop.glowCore) },
      uGlowStretch: { value: c.backdrop.stretch },
      uVignette: { value: c.backdrop.vignette },
      uCloud: { value: c.backdrop.cloud },
      uCloudPhase: { value: new THREE.Vector2() },
      uAspect: { value: 16 / 9 },
      uMainProj: { value: new THREE.Matrix4() },
      uWinDir: { value: winDir },
      uWin2Dir: { value: new THREE.Vector3(-0.6, -0.35, 0.7).normalize() },
      uMembrane: { value: c.membrane.thickness },
      uLineBright: { value: c.membrane.lineBright },
      uLineTint: { value: lin(c.membrane.lineTint) },
      uRefr: { value: c.membrane.refr },
      uRefrMix: { value: c.membrane.refrMix },
      uHaze: { value: c.membrane.haze },
      uHazeColor: { value: lin(c.membrane.hazeColor) },
      uCloudAmt: { value: c.membrane.cloudAmt },
      uRefl: { value: c.membrane.refl },
      uWindow: { value: c.membrane.window },
      uBody: { value: c.membrane.body },
      uBodyTint: { value: lin(c.membrane.bodyTint) },
      uDarkBand: { value: c.membrane.darkBand },
      uHalo: { value: c.nucleus.halo },
      uNucBase: { value: lin(c.nucleus.base) },
      uNucDeep: { value: lin(c.nucleus.deep) },
      uNucHi: { value: lin(c.nucleus.hi) },
      uNucSpec: { value: lin(c.nucleus.spec) },
      uNucGlow: { value: c.nucleus.glow },
      uNucShine: { value: c.nucleus.shine },
      uLoopPhase: { value: 0 },
      uFocus: { value: 10 },
      uAperturePx: { value: 10 },
      uPxPerUnit: { value: 1000 },
      uPartSize: { value: c.particles.size },
      uPartColor: { value: lin(c.particles.color) },
      uPartAlpha: { value: c.particles.alpha },
    };
    this.backdropMat = makeBackdropMaterial(this.shared);
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.backdropMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
    this.finalMat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: FINAL_FRAG,
      uniforms: {
        tScene: { value: null },
        tBlue: { value: getBlueNoiseTexture() },
        uFrameMod: { value: 0 },
        uGrain: { value: c.grain },
        uRes: { value: new THREE.Vector2() },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.buildCells();
    this.buildParticles();
  }

  private buildCells() {
    const lathe = getLatheGeometry();
    const nucMat = makeNucleusMaterial(this.shared);
    const haloMat = makeHaloMaterial(this.shared);
    const haloGeom = new THREE.IcosahedronGeometry(1.6, 3);
    const style = this.colors.nucleus.style;
    for (let i = 0; i < this.def.cellCount; i++) {
      const scene = new THREE.Scene();
      const group = new THREE.Group();
      scene.add(group);
      const { back, front, own } = makeMembraneMaterials(this.shared);
      const s = this.def.cellSeeds[i];
      own.uWobSeed.value.set((s * 0.731) % 17, (s * 1.379) % 13, (s * 0.457) % 19);
      own.uWobAmp.value = this.colors.membrane.wobAmp;
      own.uWobFreq.value = this.colors.membrane.wobFreq;
      const backMesh = new THREE.Mesh(lathe, back);
      backMesh.renderOrder = 0;
      const frontMesh = new THREE.Mesh(lathe, front);
      frontMesh.renderOrder = 2;
      group.add(backMesh, frontMesh);
      const detail = this.def.hiDetail[i] ? 56 : 22;
      const v = this.def.nucleusVariant[i] % NUCLEUS_SEEDS.length;
      const ng = getNucleusGeometry(NUCLEUS_SEEDS[v], detail, style);
      const nuclei = [0, 1].map(() => {
        const m = new THREE.Mesh(ng, nucMat);
        m.renderOrder = 1;
        const halo = new THREE.Mesh(haloGeom, haloMat);
        halo.renderOrder = 1.5;
        m.add(halo);
        group.add(m);
        return m;
      });
      const fragGeom = getNucleusGeometry(NUCLEUS_SEEDS[(v + 1) % 4] + 7, 6, {
        ...style,
        bumpFreq: style.bumpFreq * 0.6,
      });
      const fragments: THREE.Mesh[] = [];
      for (let f = 0; f < this.def.fragmentCount[i]; f++) {
        const m = new THREE.Mesh(fragGeom, nucMat);
        m.renderOrder = 1;
        group.add(m);
        fragments.push(m);
      }
      this.cells.push({ scene, group, membranes: [backMesh, frontMesh], own, nuclei, fragments, profileKey: "" });
    }
  }

  private buildParticles() {
    const { positions, seeds } = this.def.particles;
    const n = positions.length / 3;
    // Split into depth groups (by base z) so they interleave with the cells.
    const order = Array.from({ length: n }, (_, i) => i).sort(
      (a, b) => positions[a * 3 + 2] - positions[b * 3 + 2],
    );
    const mat = makeParticleMaterial(this.shared);
    for (let g = 0; g < PARTICLE_GROUPS; g++) {
      const idx = order.slice(Math.floor((g * n) / PARTICLE_GROUPS), Math.floor(((g + 1) * n) / PARTICLE_GROUPS));
      const pos = new Float32Array(idx.length * 3);
      const sd = new Float32Array(idx.length * 4);
      let zsum = 0;
      idx.forEach((k, j) => {
        pos.set(positions.subarray(k * 3, k * 3 + 3), j * 3);
        sd.set(seeds.subarray(k * 4, k * 4 + 4), j * 4);
        zsum += positions[k * 3 + 2];
      });
      const geom = new THREE.BufferGeometry();
      geom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      geom.setAttribute("seed", new THREE.BufferAttribute(sd, 4));
      const pts = new THREE.Points(geom, mat);
      pts.frustumCulled = false;
      const sc = new THREE.Scene();
      sc.add(pts);
      this.particleScenes.push(sc);
      this.particleDepth.push(zsum / Math.max(1, idx.length));
    }
  }

  private ensureTargets(w: number, h: number) {
    if (this.mainRT && this.mainRT.width === w && this.mainRT.height === h) return;
    this.mainRT?.dispose();
    this.mainRT = new THREE.WebGLRenderTarget(w, h, rtOpts(0));
    this.mainRT.depthBuffer = false;
  }

  private poolFor(size: number): PoolEntry {
    let e = this.pool.get(size);
    if (!e) {
      e = {
        msaa: new THREE.WebGLRenderTarget(size, size, rtOpts(4)),
        plain: new THREE.WebGLRenderTarget(size, size, rtOpts(0)),
        blur: new THREE.WebGLRenderTarget(size, size, { ...rtOpts(0), depthBuffer: false }),
      };
      this.pool.set(size, e);
    }
    return e;
  }

  private profileFor(p: ProfileParams): THREE.Vector4[] {
    const key = `${p.d.toFixed(5)}|${p.ra.toFixed(5)}|${p.k.toFixed(5)}`;
    const hit = this.profileCache.get(key);
    if (hit) return hit;
    solveProfile(p, this.profileOut);
    const copy = this.profileOut.map((v) => v.clone());
    // Only rest-shaped spheres repeat; keep the cache small.
    if (p.d === 0) this.profileCache.set(key, copy);
    return copy;
  }

  render(frame: number) {
    const gl = this.gl;
    gl.getDrawingBufferSize(this.size);
    const W = this.size.x;
    const H = this.size.y;
    this.ensureTargets(W, H);
    const st = this.def.frameState(frame);
    const sh = this.shared;
    const cam = this.camera;
    cam.fov = st.camera.fov;
    cam.aspect = W / H;
    cam.position.copy(st.camera.pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(st.camera.target);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    sh.uMainProj.value.copy(cam.projectionMatrix);
    sh.uAspect.value = W / H;
    const ang = st.phase * Math.PI * 2;
    sh.uCloudPhase.value.set(Math.cos(ang), Math.sin(ang));
    sh.uLoopPhase.value = st.phase;
    const focus = st.camera.focus;
    const aperture = this.colors.aperturePx * st.apertureScale * (H / 1080);
    const cocCap = COC_CAP_1080 * (H / 1080);
    sh.uFocus.value = focus;
    sh.uAperturePx.value = aperture;
    const pxPerUnit = H / 2 / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    sh.uPxPerUnit.value = pxPerUnit;

    gl.autoClear = false;
    this.prof = {};
    let tp = performance.now();
    // 1. backdrop
    gl.setRenderTarget(this.mainRT);
    this.quad.material = this.backdropMat;
    gl.render(this.quadScene, this.orthoCam);
    tp = this.mark("backdrop", tp);

    // 2. sort cells and particle groups back to front
    type Item = { depth: number; kind: "cell" | "part"; i: number };
    const items: Item[] = [];
    const view = cam.matrixWorldInverse;
    st.cells.forEach((c, i) => {
      if (!c.visible || (this.isolate && i !== 0)) return;
      const z = -this.tmpV.copy(c.pos).applyMatrix4(view).z;
      items.push({ depth: z, kind: "cell", i });
    });
    if (!this.isolate) this.particleDepth.forEach((zw, i) => {
      // particle groups are placed by world z; camera looks roughly down -z
      const z = cam.position.z - zw;
      items.push({ depth: z, kind: "part", i });
    });
    items.sort((a, b) => b.depth - a.depth || a.i - b.i);

    let impostors = 0;
    let texels = 0;
    const corner = new THREE.Vector3();
    for (const it of items) {
      if (it.kind === "part") {
        gl.setRenderTarget(this.mainRT);
        gl.render(this.particleScenes[it.i], cam);
        tp = this.mark("particles", tp);
        continue;
      }
      const c = st.cells[it.i];
      const obj = this.cells[it.i];
      // --- update the cell object
      obj.group.position.copy(c.pos);
      obj.group.quaternion.copy(c.quat);
      obj.group.scale.setScalar(c.radius);
      const prof = this.profileFor(c.profile);
      const target = obj.own.uProfile.value as THREE.Vector4[];
      for (let r = 0; r < RINGS; r++) target[r].copy(prof[r]);
      const wp = c.wobPhase * Math.PI * 2;
      obj.own.uWobPhase.value.set(Math.cos(wp) * 0.55, Math.sin(wp) * 0.55, Math.sin(wp) * 0.2);
      c.nuclei.forEach((n, k) => {
        const m = obj.nuclei[k];
        m.visible = n.visible;
        m.position.copy(n.offset);
        m.quaternion.copy(n.quat);
        const ns = n.scale * (this.colors.nucleus.size / 0.4);
        m.scale.set(ns * (1 + n.stretch), ns, ns);
      });
      obj.fragments.forEach((m, k) => {
        const f = c.fragments[k];
        if (!f) { m.visible = false; return; }
        m.visible = true;
        m.position.copy(f.offset);
        m.quaternion.copy(f.quat);
        m.scale.copy(f.scale);
      });
      obj.group.updateMatrixWorld(true);

      // --- screen bounds of the cell (both lobes + fragments)
      const ext = c.profile.d + c.profile.ra + c.profile.k * 0.25 + 0.08;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      let straddle = false;
      const fragExt = c.fragments.reduce((m, f) => Math.max(m, f.offset.length() + f.scale.x), 0);
      const e = Math.max(ext, fragExt);
      const ey = c.profile.ra + c.profile.k * 0.25 + 0.08;
      const ez = Math.max(ey, fragExt);
      for (let k = 0; k < 8; k++) {
        corner.set(k & 1 ? e : -e, k & 2 ? Math.max(ey, fragExt) : -Math.max(ey, fragExt), k & 4 ? ez : -ez);
        corner.applyMatrix4(obj.group.matrixWorld).applyMatrix4(view);
        if (-corner.z < cam.near * 2) { straddle = true; break; }
        corner.applyMatrix4(cam.projectionMatrix);
        const sx = (corner.x * 0.5 + 0.5) * W;
        const sy = (0.5 - corner.y * 0.5) * H;
        minX = Math.min(minX, sx); maxX = Math.max(maxX, sx);
        minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
      }
      const z = it.depth;
      const coc = Math.min(cocCap, aperture * Math.abs(1 - focus / Math.max(z, 0.05)));
      const margin = coc + 3;
      if (straddle) { minX = 0; minY = 0; maxX = W; maxY = H; }
      minX = Math.max(minX - margin, -margin);
      minY = Math.max(minY - margin, -margin);
      maxX = Math.min(maxX + margin, W + margin);
      maxY = Math.min(maxY + margin, H + margin);
      if (maxX <= 0 || maxY <= 0 || minX >= W || minY >= H) continue;
      const bw = maxX - minX;
      const bh = maxY - minY;
      const maxPool = POOL_SIZES[POOL_SIZES.length - 1];
      const ds = Math.max(1, coc / MAX_TEXEL_BLUR, bw / maxPool, bh / maxPool);
      const w = Math.min(maxPool, Math.ceil(bw / ds));
      const h = Math.min(maxPool, Math.ceil(bh / ds));
      const S = POOL_SIZES.find((p) => p >= Math.max(w, h)) ?? maxPool;
      const pe = this.poolFor(S);
      const x0 = ds === 1 ? Math.floor(minX) : minX;
      const y0 = ds === 1 ? Math.floor(minY) : minY;
      // sub-frustum camera covering exactly the impostor
      const sc = this.subCam;
      sc.copy(cam, false);
      sc.aspect = W / H;
      sc.setViewOffset(W, H, x0, y0, w * ds, h * ds);
      sc.updateProjectionMatrix();
      sc.updateMatrixWorld(true);

      // Tessellation by the cell's radius in impostor texels.
      const rTex = (0.5 * Math.min(maxX - minX - 2 * margin, maxY - minY - 2 * margin)) / ds;
      const lod = LATHE_LODS.find((l) => rTex <= l.maxRadius) ?? LATHE_LODS[LATHE_LODS.length - 1];
      const lg = getLatheGeometry(lod.rings, lod.segments);
      obj.membranes.forEach((m) => { m.geometry = lg; });
      // Multisampling only where the cell is close to sharp; a blur of a
      // texel or more hides aliasing anyway.
      const rt = coc / ds < 1.0 ? pe.msaa : pe.plain;
      rt.viewport.set(0, 0, w, h);
      rt.scissor.set(0, 0, w, h);
      rt.scissorTest = true;
      gl.setRenderTarget(rt);
      gl.setClearColor(0x000000, 0);
      gl.clear(true, true, false);
      gl.render(obj.scene, sc);
      tp = this.mark("cellRender", tp);

      // DoF gather
      pe.blur.viewport.set(0, 0, w, h);
      pe.blur.scissor.set(0, 0, w, h);
      pe.blur.scissorTest = true;
      gl.setRenderTarget(pe.blur);
      const gu = this.gatherMat.uniforms;
      gu.tSrc.value = rt.texture;
      gu.uInvSize.value.set(1 / S, 1 / S);
      gu.uMaxUv.value.set(w / S, h / S);
      gu.uRadius.value = coc / ds;
      this.quad.material = this.gatherMat;
      gl.render(this.quadScene, this.orthoCam);
      tp = this.mark("gather", tp);

      // composite into the main target
      gl.setRenderTarget(this.mainRT);
      const cu = this.compositeMat.uniforms;
      cu.tSrc.value = pe.blur.texture;
      cu.uMaxUv.value.set(w / S, h / S);
      cu.uInvSize.value.set(1 / S, 1 / S);
      const X0 = (x0 / W) * 2 - 1;
      const X1 = ((x0 + w * ds) / W) * 2 - 1;
      const Y1 = 1 - (y0 / H) * 2;
      const Y0 = 1 - ((y0 + h * ds) / H) * 2;
      cu.uRect.value.set(X0, Y0, X1, Y1);
      this.quad.material = this.compositeMat;
      gl.render(this.quadScene, this.orthoCam);
      tp = this.mark("composite", tp);
      impostors++;
      texels += w * h;
    }
    this.lastStats = { impostors, texels };
    if (this.profile) console.warn(`PROF ${JSON.stringify(this.prof)} n=${impostors} texels=${texels}`);

    // 3. final
    gl.setRenderTarget(null);
    const fu = this.finalMat.uniforms;
    fu.tScene.value = this.mainRT!.texture;
    fu.uFrameMod.value = ((frame % this.loopFrames) + this.loopFrames) % this.loopFrames;
    fu.uRes.value.set(W, H);
    this.quad.material = this.finalMat;
    gl.render(this.quadScene, this.orthoCam);
  }

  dispose() {
    this.mainRT?.dispose();
    this.pool.forEach((e) => { e.msaa.dispose(); e.plain.dispose(); e.blur.dispose(); });
  }
}

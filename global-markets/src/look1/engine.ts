import * as THREE from "three";
import { WorldData } from "../common/assets";
import { LOOP } from "../common/constants";
import { MapPalette } from "../common/palettes";
import { drawWidget } from "./drawWidget";
import { cameraAt, COC_K, FOCUS, FOV, Widget, WIDGETS } from "./layout";
import { drawMapCanvas } from "./mapTexture";
import { COMPOSITE_FRAG, DOWN_FRAG, FS_VERT, MAP_FRAG, MAP_VERT, UP_FRAG, WIDGET_FRAG, WIDGET_VERT } from "./shaders";

// Map: one world copy is MAP_W world units wide, repeated horizontally.
const MAP_W = 16;
const MAP_H = MAP_W / 2;
const MAP_ORIGIN = new THREE.Vector2(-MAP_W * 0.98, 5.6); // world pos of (lon -180, lat 0)
const BLOOM_LEVELS = 6;

type WidgetRuntime = {
  w: Widget;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  drawnKey: number; // tick currently in the canvas (-1 = none)
};

const fsMaterial = (frag: string, uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FS_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });

const flashGain = (w: Widget, f: number) => {
  let g = 1;
  for (const t of w.flashes) {
    let d = f - t;
    d = ((d % LOOP) + LOOP) % LOOP; // frames since the flash, wrapping over the loop
    if (d < 14) g = Math.max(g, 1 + 0.9 * Math.exp(-d / 4));
  }
  return g;
};

export class MarketsEngine {
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private widgets: WidgetRuntime[] = [];
  private frustum = new THREE.Frustum();
  private projView = new THREE.Matrix4();
  private sceneRT: THREE.WebGLRenderTarget;
  private mips: THREE.WebGLRenderTarget[] = [];
  private fsScene = new THREE.Scene();
  private fsCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private fsQuad: THREE.Mesh;
  private downMat: THREE.ShaderMaterial;
  private upMat: THREE.ShaderMaterial;
  private compMat: THREE.ShaderMaterial;
  private disposables: { dispose: () => void }[] = [];

  constructor(
    private gl: THREE.WebGLRenderer,
    world: WorldData,
    private palette: MapPalette,
    private pixelW: number,
    private pixelH: number,
    texScale: number, // 1 at 4K output
  ) {
    this.camera = new THREE.PerspectiveCamera(FOV, pixelW / pixelH, 0.1, 100);
    gl.autoClear = false;

    // ---- map
    const mapCanvas = drawMapCanvas(world, palette, Math.min(8192, Math.max(4096, Math.round(8192 * texScale))));
    const mapTex = new THREE.CanvasTexture(mapCanvas);
    mapTex.colorSpace = THREE.NoColorSpace;
    mapTex.wrapS = THREE.RepeatWrapping;
    mapTex.wrapT = THREE.ClampToEdgeWrapping;
    mapTex.minFilter = THREE.LinearMipmapLinearFilter;
    mapTex.anisotropy = 8;
    const oc = new THREE.Color().setStyle(palette.ocean, THREE.LinearSRGBColorSpace);
    const mapMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: MAP_VERT,
      fragmentShader: MAP_FRAG,
      uniforms: {
        map: { value: mapTex },
        mapSize: { value: new THREE.Vector2(MAP_W, MAP_H) },
        mapOrigin: { value: MAP_ORIGIN },
        texW: { value: mapCanvas.width },
        ocean: { value: new THREE.Vector3(oc.r, oc.g, oc.b) },
        gridCol: { value: new THREE.Vector3(80 / 255, 140 / 255, 220 / 255).multiplyScalar(0.34) },
        focus: { value: FOCUS },
        cocK: { value: COC_K },
      },
      depthWrite: false,
    });
    const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(70, 40), mapMat);
    mapMesh.renderOrder = -1;
    this.scene.add(mapMesh);
    this.disposables.push(mapTex, mapMat, mapMesh.geometry);

    // ---- widgets
    const geo = new THREE.PlaneGeometry(1, 1);
    this.disposables.push(geo);
    for (const w of WIDGETS) {
      const pxW = Math.min(2048, Math.max(96, Math.ceil(w.maxScreenFrac * 3840 * texScale * 1.1)));
      const canvas = document.createElement("canvas");
      canvas.width = pxW;
      canvas.height = Math.max(16, Math.round((pxW * w.lh) / w.lw));
      const ctx = canvas.getContext("2d")!;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.NoColorSpace;
      tex.premultiplyAlpha = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.anisotropy = 4;
      const mat = new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: WIDGET_VERT,
        fragmentShader: WIDGET_FRAG,
        uniforms: {
          map: { value: tex },
          texSize: { value: new THREE.Vector2(canvas.width, canvas.height) },
          planeSize: { value: new THREE.Vector2(w.w, w.h) },
          pad: { value: w.pad },
          focus: { value: FOCUS },
          cocK: { value: COC_K },
          gain: { value: 1 },
          opacity: { value: 1 },
        },
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.CustomBlending,
        blendSrc: THREE.OneFactor,
        blendDst: THREE.OneMinusSrcAlphaFactor,
        blendSrcAlpha: THREE.OneFactor,
        blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(w.x, w.y, w.z);
      mesh.scale.set(w.w + 2 * w.pad, w.h + 2 * w.pad, 1);
      // painter's order: far (low z) first. Fixed, so it never depends on sorting ties.
      mesh.renderOrder = Math.round(w.z * 1000) + w.id / 1000;
      this.scene.add(mesh);
      this.widgets.push({ w, canvas, ctx, tex, mesh, mat, drawnKey: -1 });
      this.disposables.push(tex, mat);
    }

    // ---- post
    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false, colorSpace: THREE.NoColorSpace } as const;
    this.sceneRT = new THREE.WebGLRenderTarget(pixelW, pixelH, { ...rtOpts, samples: 4 });
    this.disposables.push(this.sceneRT);
    let mw = pixelW;
    let mh = pixelH;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      mw = Math.max(1, Math.floor(mw / 2));
      mh = Math.max(1, Math.floor(mh / 2));
      const rt = new THREE.WebGLRenderTarget(mw, mh, rtOpts);
      this.mips.push(rt);
      this.disposables.push(rt);
    }
    this.downMat = fsMaterial(DOWN_FRAG, {
      src: { value: null },
      texel: { value: new THREE.Vector2() },
      threshold: { value: -1 },
    });
    this.upMat = fsMaterial(UP_FRAG, { src: { value: null }, texel: { value: new THREE.Vector2() }, weight: { value: 1 } });
    this.upMat.blending = THREE.AdditiveBlending;
    this.upMat.transparent = true;
    this.compMat = fsMaterial(COMPOSITE_FRAG, {
      scene: { value: this.sceneRT.texture },
      bloom: { value: this.mips[0].texture },
      bloomStrength: { value: 2.0 },
      haze: { value: new THREE.Vector3(...palette.haze) },
      frameMod: { value: 0 },
      resolution: { value: new THREE.Vector2(pixelW, pixelH) },
    });
    this.fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compMat);
    this.fsQuad.frustumCulled = false;
    this.fsScene.add(this.fsQuad);
    this.disposables.push(this.downMat, this.upMat, this.compMat, this.fsQuad.geometry);
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null, clear: boolean) {
    this.fsQuad.material = mat;
    this.gl.setRenderTarget(target);
    if (clear) this.gl.clear(true, false, false);
    this.gl.render(this.fsScene, this.fsCam);
  }

  /** Render one frame. Everything is computed from `frame` alone. */
  render(frame: number) {
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const cam = cameraAt(f);
    this.camera.position.set(...cam.pos);
    this.camera.up.set(...cam.up);
    this.camera.lookAt(...cam.target);
    this.camera.updateMatrixWorld();
    this.projView.multiplyMatrices(this.camera.projectionMatrix, this.camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projView);

    for (const r of this.widgets) {
      const key = Math.floor(f / r.w.period);
      r.mat.uniforms.gain.value = flashGain(r.w, f);
      r.mesh.updateMatrixWorld();
      if (!this.frustum.intersectsObject(r.mesh)) continue; // invisible: no need to redraw now
      if (r.drawnKey !== key) {
        const { ctx, canvas } = r;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(canvas.width / r.w.lw, 0, 0, canvas.height / r.w.lh, 0, 0);
        drawWidget(ctx, r.w, key, this.palette);
        r.tex.needsUpdate = true;
        r.drawnKey = key;
      }
    }

    const gl = this.gl;
    gl.setClearColor(new THREE.Color().setStyle(this.palette.ocean, THREE.LinearSRGBColorSpace), 1);
    gl.setRenderTarget(this.sceneRT);
    gl.clear(true, true, true);
    gl.render(this.scene, this.camera);

    // bloom: threshold + downsample chain, then tent upsample accumulated upward
    let src = this.sceneRT;
    let sw = this.pixelW;
    let sh = this.pixelH;
    for (let i = 0; i < BLOOM_LEVELS; i++) {
      this.downMat.uniforms.src.value = src.texture;
      this.downMat.uniforms.texel.value.set(1 / sw, 1 / sh);
      this.downMat.uniforms.threshold.value = i === 0 ? 0.42 : -1;
      this.pass(this.downMat, this.mips[i], true);
      src = this.mips[i];
      sw = src.width;
      sh = src.height;
    }
    for (let i = BLOOM_LEVELS - 1; i > 0; i--) {
      const from = this.mips[i];
      this.upMat.uniforms.src.value = from.texture;
      this.upMat.uniforms.texel.value.set(1 / from.width, 1 / from.height);
      this.upMat.uniforms.weight.value = 1;
      this.pass(this.upMat, this.mips[i - 1], false);
    }

    this.compMat.uniforms.frameMod.value = f;
    this.pass(this.compMat, null, true);
  }

  dispose() {
    for (const d of this.disposables) d.dispose();
  }
}

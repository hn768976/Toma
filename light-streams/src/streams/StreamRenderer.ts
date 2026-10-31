import * as THREE from "three";
import {
  BLUR_FRAGMENT,
  COMPOSITE_FRAGMENT,
  FS_VERTEX,
  LINE_FRAGMENT,
  LINE_VERTEX,
  POINT_FRAGMENT,
  POINT_VERTEX,
} from "./shaders";
import { Shot } from "./surfaces";
import { mulberry32 } from "./random";
import { BACKGROUND, CameraState, HOT_COLOR, LINE_SWATCHES, SPARKLE_COLOR } from "./look";

type ShotObjects = {
  shot: Shot;
  scene: THREE.Scene;
  lineGeo: THREE.BufferGeometry;
  pts: Float32Array;
  sparkleGeo: THREE.BufferGeometry;
};

const FLOW_SPEED = 0.22;

/**
 * Owns the WebGL renderer and all GPU resources for the light-stream
 * compositions. `render()` is a pure function of (shot, time, camera), so
 * frames can be rendered in any order by Remotion's parallel renderer.
 */
export class StreamRenderer {
  private renderer: THREE.WebGLRenderer;
  private camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 200);
  private shots: ShotObjects[];
  private lineMat: THREE.ShaderMaterial;
  private pointMat: THREE.ShaderMaterial;
  private rtScene: THREE.WebGLRenderTarget;
  private rtHalf: THREE.WebGLRenderTarget;
  private rtQuarter: THREE.WebGLRenderTarget;
  private rtQuarterTmp: THREE.WebGLRenderTarget;
  private rtEighth: THREE.WebGLRenderTarget;
  private rtEighthTmp: THREE.WebGLRenderTarget;
  private fsScene = new THREE.Scene();
  private fsCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private fsQuad: THREE.Mesh;
  private copyMat: THREE.ShaderMaterial;
  private blurMat: THREE.ShaderMaterial;
  private compositeMat: THREE.ShaderMaterial;

  constructor(
    canvas: HTMLCanvasElement,
    private width: number,
    private height: number,
    shots: Shot[],
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(width, height, false);
    this.renderer.autoClear = true;
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    const px = height / 1080;
    const common = {
      uRes: { value: new THREE.Vector2(width, height) },
      uPx: { value: px },
      uFocus: { value: 10 },
      uCoc: { value: 7 },
      uCocMax: { value: 26 },
      uTime: { value: 0 },
    };

    this.lineMat = new THREE.ShaderMaterial({
      vertexShader: LINE_VERTEX,
      fragmentShader: LINE_FRAGMENT,
      uniforms: {
        ...common,
        uCore: { value: 1.0 },
        uFlow: { value: FLOW_SPEED },
        uHot: { value: HOT_COLOR },
      },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      side: THREE.DoubleSide,
    });
    this.pointMat = new THREE.ShaderMaterial({
      vertexShader: POINT_VERTEX,
      fragmentShader: POINT_FRAGMENT,
      uniforms: { ...common, uColor: { value: SPARKLE_COLOR } },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    // share the camera-dependent uniforms
    this.pointMat.uniforms.uFocus = this.lineMat.uniforms.uFocus;
    this.pointMat.uniforms.uCoc = this.lineMat.uniforms.uCoc;
    this.pointMat.uniforms.uTime = this.lineMat.uniforms.uTime;

    this.shots = shots.map((shot, si) => this.buildShot(shot, si));

    const rt = (w: number, h: number) =>
      new THREE.WebGLRenderTarget(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), {
        type: THREE.HalfFloatType,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        depthBuffer: false,
        generateMipmaps: false,
      });
    this.rtScene = rt(width, height);
    this.rtHalf = rt(width / 2, height / 2);
    this.rtQuarter = rt(width / 4, height / 4);
    this.rtQuarterTmp = rt(width / 4, height / 4);
    this.rtEighth = rt(width / 8, height / 8);
    this.rtEighthTmp = rt(width / 8, height / 8);

    this.copyMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERTEX,
      fragmentShader: /* glsl */ `
        uniform sampler2D tSrc; uniform vec2 uTexel; varying vec2 vUv;
        void main() {
          // 4-tap box downsample
          vec3 c = texture2D(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb
                 + texture2D(tSrc, vUv + uTexel * vec2( 0.5, -0.5)).rgb
                 + texture2D(tSrc, vUv + uTexel * vec2(-0.5,  0.5)).rgb
                 + texture2D(tSrc, vUv + uTexel * vec2( 0.5,  0.5)).rgb;
          gl_FragColor = vec4(c * 0.25, 1.0);
        }`,
      uniforms: { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
    });
    this.blurMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERTEX,
      fragmentShader: BLUR_FRAGMENT,
      uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
      depthTest: false,
      depthWrite: false,
    });
    this.compositeMat = new THREE.ShaderMaterial({
      vertexShader: FS_VERTEX,
      fragmentShader: COMPOSITE_FRAGMENT,
      uniforms: {
        tScene: { value: this.rtScene.texture },
        tBloomA: { value: this.rtQuarter.texture },
        tBloomB: { value: this.rtEighth.texture },
        uRes: { value: new THREE.Vector2(width, height) },
        uFrame: { value: 0 },
        uBgTop: { value: BACKGROUND.top },
        uBgHorizon: { value: BACKGROUND.horizon },
        uBgBottom: { value: BACKGROUND.bottom },
        uGlowPos: { value: new THREE.Vector2(0.6, 0.8) },
        uGlowColor: { value: BACKGROUND.glowColor },
        uExposure: { value: 1.5 },
        uBloom: { value: 0.4 },
        uFadeIn: { value: 1 },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.fsQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.copyMat);
    this.fsQuad.frustumCulled = false;
    this.fsScene.add(this.fsQuad);
  }

  private buildShot(shot: Shot, index: number): ShotObjects {
    const { lines, points } = shot;
    const nv = lines * points * 2;
    const rnd = mulberry32(1000 + index * 77);

    const side = new Float32Array(nv);
    const info = new Float32Array(nv * 3);
    const color = new Float32Array(nv * 3);
    const totalW = LINE_SWATCHES.reduce((a, s) => a + s.weight, 0);
    for (let i = 0; i < lines; i++) {
      // choose a swatch
      let r = rnd() * totalW;
      let sw = LINE_SWATCHES[0];
      for (const s of LINE_SWATCHES) {
        r -= s.weight;
        if (r <= 0) {
          sw = s;
          break;
        }
      }
      const gain = sw.gain[0] + (sw.gain[1] - sw.gain[0]) * rnd();
      const seed = rnd();
      for (let j = 0; j < points; j++) {
        const u = j / (points - 1);
        for (let s = 0; s < 2; s++) {
          const v = (i * points + j) * 2 + s;
          side[v] = s === 0 ? -1 : 1;
          info[v * 3] = u;
          info[v * 3 + 1] = seed;
          info[v * 3 + 2] = gain;
          color[v * 3] = sw.color[0];
          color[v * 3 + 1] = sw.color[1];
          color[v * 3 + 2] = sw.color[2];
        }
      }
    }
    const index32 = new Uint32Array(lines * (points - 1) * 6);
    let k = 0;
    for (let i = 0; i < lines; i++) {
      for (let j = 0; j < points - 1; j++) {
        const a = (i * points + j) * 2;
        index32[k++] = a;
        index32[k++] = a + 1;
        index32[k++] = a + 2;
        index32[k++] = a + 2;
        index32[k++] = a + 1;
        index32[k++] = a + 3;
      }
    }
    const lineGeo = new THREE.BufferGeometry();
    const dyn = () => {
      const attr = new THREE.BufferAttribute(new Float32Array(nv * 3), 3);
      attr.setUsage(THREE.DynamicDrawUsage);
      return attr;
    };
    lineGeo.setAttribute("position", dyn());
    lineGeo.setAttribute("prevPos", dyn());
    lineGeo.setAttribute("nextPos", dyn());
    lineGeo.setAttribute("side", new THREE.BufferAttribute(side, 1));
    lineGeo.setAttribute("lineInfo", new THREE.BufferAttribute(info, 3));
    lineGeo.setAttribute("lineColor", new THREE.BufferAttribute(color, 3));
    lineGeo.setIndex(new THREE.BufferAttribute(index32, 1));

    const sparkleGeo = new THREE.BufferGeometry();
    const spPos = new THREE.BufferAttribute(new Float32Array(shot.sparkles * 3), 3);
    spPos.setUsage(THREE.DynamicDrawUsage);
    sparkleGeo.setAttribute("position", spPos);
    const spSeed = new Float32Array(shot.sparkles);
    for (let i = 0; i < shot.sparkles; i++) spSeed[i] = rnd();
    sparkleGeo.setAttribute("seed", new THREE.BufferAttribute(spSeed, 1));

    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(lineGeo, this.lineMat);
    mesh.frustumCulled = false;
    const sparklesObj = new THREE.Points(sparkleGeo, this.pointMat);
    sparklesObj.frustumCulled = false;
    scene.add(mesh, sparklesObj);

    return { shot, scene, lineGeo, pts: new Float32Array(lines * points * 3), sparkleGeo };
  }

  private updateGeometry(o: ShotObjects, t: number) {
    const { lines, points } = o.shot;
    o.shot.build(t, o.pts);
    const pos = o.lineGeo.getAttribute("position") as THREE.BufferAttribute;
    const prev = o.lineGeo.getAttribute("prevPos") as THREE.BufferAttribute;
    const next = o.lineGeo.getAttribute("nextPos") as THREE.BufferAttribute;
    const P = o.pts;
    const pa = pos.array as Float32Array;
    const pv = prev.array as Float32Array;
    const nx = next.array as Float32Array;
    for (let i = 0; i < lines; i++) {
      for (let j = 0; j < points; j++) {
        const c = (i * points + j) * 3;
        const p = (i * points + Math.max(0, j - 1)) * 3;
        const n = (i * points + Math.min(points - 1, j + 1)) * 3;
        for (let s = 0; s < 2; s++) {
          const v = ((i * points + j) * 2 + s) * 3;
          pa[v] = P[c];
          pa[v + 1] = P[c + 1];
          pa[v + 2] = P[c + 2];
          pv[v] = P[p];
          pv[v + 1] = P[p + 1];
          pv[v + 2] = P[p + 2];
          nx[v] = P[n];
          nx[v + 1] = P[n + 1];
          nx[v + 2] = P[n + 2];
        }
      }
    }
    pos.needsUpdate = true;
    prev.needsUpdate = true;
    next.needsUpdate = true;

    const sp = o.sparkleGeo.getAttribute("position") as THREE.BufferAttribute;
    o.shot.buildSparkles(t, sp.array as Float32Array);
    sp.needsUpdate = true;
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) {
    this.fsQuad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.fsScene, this.fsCamera);
  }

  private downsample(src: THREE.WebGLRenderTarget, dst: THREE.WebGLRenderTarget) {
    this.copyMat.uniforms.tSrc.value = src.texture;
    this.copyMat.uniforms.uTexel.value.set(1 / src.width, 1 / src.height);
    this.pass(this.copyMat, dst);
  }

  private blur(rt: THREE.WebGLRenderTarget, tmp: THREE.WebGLRenderTarget, radius: number) {
    this.blurMat.uniforms.tSrc.value = rt.texture;
    this.blurMat.uniforms.uDir.value.set(radius / rt.width, 0);
    this.pass(this.blurMat, tmp);
    this.blurMat.uniforms.tSrc.value = tmp.texture;
    this.blurMat.uniforms.uDir.value.set(0, radius / rt.height);
    this.pass(this.blurMat, rt);
  }

  render(shotIndex: number, t: number, cam: CameraState, frame: number) {
    const o = this.shots[shotIndex];
    this.updateGeometry(o, t);

    this.camera.fov = cam.fov;
    this.camera.aspect = this.width / this.height;
    this.camera.position.copy(cam.pos);
    this.camera.up.set(Math.sin(cam.roll), Math.cos(cam.roll), 0);
    this.camera.lookAt(cam.target);
    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();

    this.lineMat.uniforms.uFocus.value = cam.focus;
    this.lineMat.uniforms.uCoc.value = cam.coc;
    this.lineMat.uniforms.uTime.value = t;

    this.renderer.setClearColor(0x000000, 1);
    this.renderer.setRenderTarget(this.rtScene);
    this.renderer.clear();
    this.renderer.render(o.scene, this.camera);

    this.downsample(this.rtScene, this.rtHalf);
    this.downsample(this.rtHalf, this.rtQuarter);
    this.blur(this.rtQuarter, this.rtQuarterTmp, 1.5);
    this.downsample(this.rtQuarter, this.rtEighth);
    this.blur(this.rtEighth, this.rtEighthTmp, 2.5);
    this.blur(this.rtEighth, this.rtEighthTmp, 2.5);

    this.compositeMat.uniforms.uFrame.value = frame;
    this.compositeMat.uniforms.uGlowPos.value.set(cam.glow[0], cam.glow[1]);
    this.pass(this.compositeMat, null);
    // make sure the frame is complete before Remotion takes the screenshot
    this.renderer.getContext().finish();
  }

  dispose() {
    this.shots.forEach((o) => {
      o.lineGeo.dispose();
      o.sparkleGeo.dispose();
    });
    [this.rtScene, this.rtHalf, this.rtQuarter, this.rtQuarterTmp, this.rtEighth, this.rtEighthTmp].forEach(
      (r) => r.dispose(),
    );
    this.lineMat.dispose();
    this.pointMat.dispose();
    this.copyMat.dispose();
    this.blurMat.dispose();
    this.compositeMat.dispose();
    this.renderer.dispose();
  }
}

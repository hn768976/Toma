import * as THREE from "three";
import { ARC_FRAG, ARC_VERT, Arc, arcHead, arcPoint, buildArcGeometry, LightPoint, scheduleArcs, TRAIL_LEN } from "./arcs";
import { CAMERA_KEYS, cameraAt } from "./camera";
import { latLonToVec3, mulberry32 } from "./math";
import { Palette } from "./palettes";
import { PostFX, PostParams } from "./post";
import { FLATTEN_GLSL } from "./flatten";

export type Assets = {
  land: THREE.Texture;
  relief: THREE.Texture;
  lights: LightPoint[];
};

const col = (hex: string) => new THREE.Color(hex);

const EARTH_VERT = /* glsl */ `
${FLATTEN_GLSL}
varying vec2 vUv; varying vec3 vN; varying vec3 vW;
void main() {
  vUv = uv;
  vN = normalize(position);
  vW = flattenPos(position);
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}
`;

const EARTH_FRAG = /* glsl */ `
${FLATTEN_GLSL}
uniform sampler2D tLand, tRelief;
uniform vec3 cOceanDeep, cOcean, cLandLow, cLandHigh, cLandSpec, cFog;
uniform vec3 lightPos, camPos, focus;
uniform float fogNear, fogFar, fogAmount;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vec3 N = normalize(vN);
  vec3 E = normalize(vec3(N.z, 0.0, -N.x) + 1e-6);
  vec3 Nn = cross(N, E);

  // R = land mask, GB = baked coastline bevel gradient, A = baked coastal shadow
  vec4 lm = texture2D(tLand, vUv);
  float land = lm.r;
  vec3 rel = texture2D(tRelief, vUv).rgb;
  vec2 tn = (rel.gb * 2.0 - 1.0) * 1.6;
  // "extruded" coastline bevel
  tn -= (lm.gb * 2.0 - 1.0) * 0.9;
  // fine terrain grain so flat plains are not plastic-smooth
  float g = vnoise(vUv * vec2(3000.0, 1500.0)) * 0.6 + vnoise(vUv * vec2(9000.0, 4500.0)) * 0.4;

  vec3 P = toFlatFrame(normalize(N + E * tn.x + Nn * tn.y), N);
  vec3 Nf = toFlatFrame(N, N);
  vec3 L = normalize(lightPos - vW);
  vec3 V = normalize(camPos - vW);
  float diff = max(dot(P, L), 0.0);
  float wrap = max(dot(Nf, L) * 0.5 + 0.5, 0.0);
  float spec = pow(max(dot(P, normalize(L + V)), 0.0), 30.0);
  // a soft pool of light that travels with the camera's point of interest
  float pool = exp(-pow(distance(vW, focus) / 1.1, 2.0));

  float h = smoothstep(0.0, 0.55, rel.r);
  vec3 landCol = mix(cLandLow, cLandHigh, 0.35 + 0.65 * h);
  landCol *= (0.46 + 0.72 * diff) * (0.62 + 0.42 * pool) * (0.88 + 0.16 * g);
  landCol += cLandSpec * spec * 0.22 * pool;

  // ocean: dark, slightly lighter near the hotspot; land casts a soft shadow southwards
  vec3 oceanCol = mix(cOceanDeep, cOcean, 0.25 + 0.75 * pool * wrap);
  oceanCol *= 1.0 - 0.45 * lm.a;

  vec3 c = mix(oceanCol, landCol, land);
  float d = length(camPos - vW);
  c = mix(c, cFog, smoothstep(fogNear, fogFar, d) * fogAmount);
  gl_FragColor = vec4(c, 1.0);
}
`;

const DOT_VERT = /* glsl */ `
${FLATTEN_GLSL}
uniform float fogNear, fogFar;
attribute float aSize; attribute float aBright; attribute float aSeed;
uniform float time; uniform float pxScale; uniform vec3 camPos;
varying float vB;
void main() {
  vec3 fp = flattenPos(position);
  vec4 mv = viewMatrix * vec4(fp, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 0.78 + 0.22 * sin(time * (1.3 + aSeed * 2.7) + aSeed * 61.0);
  float fade = 1.0 - 0.8 * smoothstep(fogNear, fogFar, length(camPos - fp));
  vB = aBright * tw * fade * smoothstep(1.4, 1.0, flatAngle(position));
  gl_PointSize = clamp(aSize * pxScale / -mv.z, 2.0, 128.0);
}
`;

const DOT_FRAG = /* glsl */ `
uniform vec3 color; uniform vec3 glow;
varying float vB;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r2 = dot(q, q) * 4.0;
  float core = exp(-r2 * 22.0);
  float halo = exp(-r2 * 6.0) * 0.22;
  gl_FragColor = vec4((color * core + glow * halo) * vB, 1.0);
}
`;

export type EngineOptions = {
  /** internal (composition) resolution — every pass renders at this size */
  width: number;
  height: number;
  /** size of the final image handed back to the page (<= width/height) */
  outputWidth: number;
  outputHeight: number;
  palette: Palette;
  seed?: number;
  duration: number;
};

export class NetworkMapEngine {
  renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private earthMat: THREE.ShaderMaterial;
  private arcMat: THREE.ShaderMaterial;
  private dotMat: THREE.ShaderMaterial;
  private headMat: THREE.ShaderMaterial;
  private heads: THREE.Points;
  private headPos: Float32Array;
  private headSize: Float32Array;
  private headBright: Float32Array;
  private arcs: Arc[];
  private post: PostFX;
  private pxScale: number;
  /** uniforms shared (by reference) between every material */
  private shared = {
    uCenter: { value: new THREE.Vector3(1, 0, 0) },
    uCurv: { value: 0.11 },
    fogNear: { value: 1.6 },
    fogFar: { value: 3.6 },
  };

  private pixels: Uint8ClampedArray<ArrayBuffer>;
  private image: ImageData;

  constructor(assets: Assets, private opts: EngineOptions) {
    const { width, height, palette } = opts;
    // The WebGL canvas is never attached to the DOM. A live WebGL layer makes
    // headless Chrome's page capture very slow on software GL; instead the
    // final frame is read back and drawn into a plain 2D canvas (see blit()).
    const canvas = document.createElement("canvas");
    this.pxScale = width / 3840;
    THREE.ColorManagement.enabled = false;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(opts.outputWidth, opts.outputHeight, false);
    this.pixels = new Uint8ClampedArray(opts.outputWidth * opts.outputHeight * 4);
    this.image = new ImageData(this.pixels, opts.outputWidth, opts.outputHeight);
    this.renderer.setClearColor(col(palette.background), 1);

    this.camera = new THREE.PerspectiveCamera(26, width / height, 0.01, 10);

    for (const t of [assets.land, assets.relief]) {
      t.colorSpace = THREE.NoColorSpace;
      t.anisotropy = 2;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.wrapS = THREE.RepeatWrapping;
      t.needsUpdate = true;
    }

    // --- Earth --------------------------------------------------------------
    this.earthMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERT,
      fragmentShader: EARTH_FRAG,
      uniforms: {
        tLand: { value: assets.land },
        tRelief: { value: assets.relief },
        cOceanDeep: { value: col(palette.oceanDeep) },
        cOcean: { value: col(palette.ocean) },
        cLandLow: { value: col(palette.landLow) },
        cLandHigh: { value: col(palette.landHigh) },
        cLandSpec: { value: col(palette.landSpec) },
        cFog: { value: col(palette.fog) },
        lightPos: { value: new THREE.Vector3() },
        camPos: { value: new THREE.Vector3() },
        focus: { value: new THREE.Vector3() },
        fogAmount: { value: 0.6 },
        ...this.shared,
      },
    });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 512, 256), this.earthMat);
    this.scene.add(earth);

    // --- City-light dots ------------------------------------------------------
    const rnd = mulberry32(opts.seed ?? 7);
    const L = assets.lights;
    const dp = new Float32Array(L.length * 3);
    const ds = new Float32Array(L.length);
    const db = new Float32Array(L.length);
    const dseed = new Float32Array(L.length);
    const v = new THREE.Vector3();
    L.forEach(([la, lo, b], i) => {
      latLonToVec3(la, lo, 1.0012, v);
      dp.set([v.x, v.y, v.z], i * 3);
      // reference look: fewer, larger, brighter lights that bloom
      const keep = b > 0.5 || rnd() < 0.1;
      ds[i] = keep ? 18 + 32 * b + rnd() * 6 : 0;
      db[i] = keep ? 0.55 + 0.75 * b : 0;
      dseed[i] = rnd();
    });
    const dg = new THREE.BufferGeometry();
    dg.setAttribute("position", new THREE.BufferAttribute(dp, 3));
    dg.setAttribute("aSize", new THREE.BufferAttribute(ds, 1));
    dg.setAttribute("aBright", new THREE.BufferAttribute(db, 1));
    dg.setAttribute("aSeed", new THREE.BufferAttribute(dseed, 1));
    this.dotMat = new THREE.ShaderMaterial({
      vertexShader: DOT_VERT,
      fragmentShader: DOT_FRAG,
      uniforms: {
        time: { value: 0 },
        pxScale: { value: this.pxScale },
        camPos: { value: new THREE.Vector3() },
        color: { value: col(palette.cityDot) },
        glow: { value: col(palette.arcGlow) },
        ...this.shared,
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const dots = new THREE.Points(dg, this.dotMat);
    dots.frustumCulled = false;
    this.scene.add(dots);

    // --- Arcs -----------------------------------------------------------------
    this.arcs = scheduleArcs(CAMERA_KEYS, L, opts.seed ?? 1312338598, opts.duration);
    this.arcMat = new THREE.ShaderMaterial({
      vertexShader: ARC_VERT,
      fragmentShader: ARC_FRAG,
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(width, height) },
        width: { value: 11 },
        pxScale: { value: this.pxScale },
        coreColor: { value: col(palette.arcCore) },
        glowColor: { value: col(palette.arcGlow) },
        trail: { value: TRAIL_LEN },
        camPos: { value: new THREE.Vector3() },
        ...this.shared,
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const arcMesh = new THREE.Mesh(buildArcGeometry(this.arcs), this.arcMat);
    arcMesh.frustumCulled = false;
    this.scene.add(arcMesh);

    // --- Arc heads / arrival flashes (positions updated per frame) ----------
    const maxHeads = this.arcs.length * 2;
    this.headPos = new Float32Array(maxHeads * 3);
    this.headSize = new Float32Array(maxHeads);
    this.headBright = new Float32Array(maxHeads);
    const hg = new THREE.BufferGeometry();
    hg.setAttribute("position", new THREE.BufferAttribute(this.headPos, 3));
    hg.setAttribute("aSize", new THREE.BufferAttribute(this.headSize, 1));
    hg.setAttribute("aBright", new THREE.BufferAttribute(this.headBright, 1));
    hg.setAttribute("aSeed", new THREE.BufferAttribute(new Float32Array(maxHeads), 1));
    this.headMat = this.dotMat.clone();
    this.headMat.uniforms.color.value = col(palette.arcCore);
    this.headMat.uniforms.glow.value = col(palette.arcGlow);
    Object.assign(this.headMat.uniforms, this.shared);
    this.heads = new THREE.Points(hg, this.headMat);
    this.heads.frustumCulled = false;
    this.scene.add(this.heads);

    this.post = new PostFX(this.renderer, width, height, {
      focusY: 0.47,
      focusHalf: 0.14,
      focusSoft: 0.3,
      blurTop: 1.0,
      blurBottom: 0.75,
      dofRadius: 2.2,
      bloomThreshold: 0.7,
      bloomA: 0.7,
      bloomB: 0.8,
      vignette: 0.32,
      grain: 0.022,
      exposure: 1.0,
      saturation: 1.0,
      lift: [0, 0, 0],
      gain: [1, 1, 1],
      tint: [1, 1, 1],
      ...(palette.post as Partial<PostParams>),
    });
  }

  render(time: number) {
    const cam = cameraAt(CAMERA_KEYS, time);
    this.camera.position.copy(cam.position);
    this.camera.up.copy(cam.up);
    this.camera.lookAt(cam.target);
    this.camera.updateMatrixWorld();

    const n = cam.target.clone().normalize();
    const u = this.earthMat.uniforms;
    // light hovers above and a bit beyond the focus point
    u.lightPos.value.copy(n).multiplyScalar(2.4).addScaledVector(cam.up, 0.9);
    u.camPos.value.copy(cam.position);
    u.focus.value.copy(cam.target).addScaledVector(cam.up, 0.15);
    this.dotMat.uniforms.time.value = time;
    this.dotMat.uniforms.camPos.value.copy(cam.position);
    this.headMat.uniforms.camPos.value.copy(cam.position);
    this.headMat.uniforms.time.value = 0;
    this.arcMat.uniforms.time.value = time;
    this.arcMat.uniforms.camPos.value.copy(cam.position);
    this.shared.uCenter.value.copy(n);

    // comet heads + arrival flashes
    let k = 0;
    const p = new THREE.Vector3();
    for (const arc of this.arcs) {
      if (time < arc.start) continue;
      const head = arcHead(arc, time);
      if (head < 1) {
        arcPoint(arc, head, p);
        this.headPos.set([p.x, p.y, p.z], k * 3);
        this.headSize[k] = 50 + 16 * arc.intensity;
        this.headBright[k] = 1.35 * arc.intensity * Math.min(1, head * 12);
        k++;
      }
      const arrive = arc.start + this.arrivalTime(arc);
      const since = time - arrive;
      if (since >= 0 && since < 3.5) {
        arcPoint(arc, 1, p);
        // flash on arrival, then a glowing endpoint that slowly fades
        const f = Math.exp(-since * 3.2) * 0.75 + 0.35 * (1 - since / 3.5);
        this.headPos.set([p.x, p.y, p.z], k * 3);
        this.headSize[k] = 34 + 60 * f;
        this.headBright[k] = 0.9 * f * arc.intensity;
        k++;
      }
    }
    const g = this.heads.geometry;
    g.setDrawRange(0, k);
    (g.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aBright as THREE.BufferAttribute).needsUpdate = true;

    this.renderer.setRenderTarget(this.post.sceneRT);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.post.finish(time);
  }

  /** Copy the last rendered frame into a 2D canvas context. */
  blit(ctx: CanvasRenderingContext2D) {
    const gl = this.renderer.getContext();
    gl.readPixels(0, 0, this.opts.outputWidth, this.opts.outputHeight, gl.RGBA, gl.UNSIGNED_BYTE, this.pixels);
    ctx.putImageData(this.image, 0, 0);
  }

  /** Time at which the comet head reaches the destination (head == 1). */
  private arrivalTime(arc: Arc) {
    // head = e*(1+TRAIL) = 1  ->  e = 1/(1+TRAIL),  e = 1-(1-u)^1.6
    const e = 1 / (1 + TRAIL_LEN);
    const u = 1 - Math.pow(1 - e, 1 / 1.6);
    return u * arc.duration;
  }

  dispose() {
    this.post.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
    });
    this.earthMat.dispose();
    this.arcMat.dispose();
    this.dotMat.dispose();
    this.headMat.dispose();
    this.renderer.dispose();
  }
}

import * as THREE from "three";
import { cameraAt } from "./camera";
import { FLATTEN_GLSL } from "./flatten";
import { Key, latLonToVec3, mulberry32 } from "./math";
import { buildLinkGeometry, Link, LINK_FRAG, LINK_VERT, NetNode, scheduleNetwork } from "./network";
import { PostFX, PostParams } from "./post";

export type LightPoint = [number, number, number];
export type Assets = {
  day: THREE.Texture;
  night: THREE.Texture;
  clouds: THREE.Texture;
  land: THREE.Texture;
  lights: LightPoint[];
};

export type Look = {
  keys: Key[];
  flat: boolean; // flattened map (V1) or true sphere (V2)
  curvature: number;
  fov: number;
  post: Partial<PostParams>;
  viewRadius: (dist: number) => number;
};

export type EngineOptions = {
  width: number;
  height: number;
  outputWidth: number;
  outputHeight: number;
  duration: number;
  look: Look;
};

const col = (hex: string) => new THREE.Color(hex);

/** CPU-side land test (downsampled land mask) so network junctions sit on land. */
const landSampler = (tex: THREE.Texture) => {
  const W = 1024;
  const H = 512;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(tex.image as CanvasImageSource, 0, 0, W, H);
  const data = ctx.getImageData(0, 0, W, H).data;
  return (lat: number, lon: number) => {
    const x = Math.min(W - 1, Math.max(0, Math.floor(((lon + 180) / 360) * W)));
    const y = Math.min(H - 1, Math.max(0, Math.floor(((90 - lat) / 180) * H)));
    return data[(y * W + x) * 4] > 128;
  };
};

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
uniform sampler2D tDay, tNight, tClouds, tLand;
uniform vec3 camPos, sunDir, focus;
uniform float time, fogNear, fogFar;
uniform vec3 cOceanDeep, cOceanLight, cLand, cLandLight, cIce, cGlint, cLightWarm, cLightHot, cCloud, cCloudShade, cHaze;
varying vec2 vUv; varying vec3 vN; varying vec3 vW;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}

void main() {
  vec3 N = normalize(vN);
  vec3 Nf = toFlatFrame(N, N);
  vec3 V = normalize(camPos - vW);
  float land = texture2D(tLand, vUv).r;
  vec3 day = texture2D(tDay, vUv).rgb;
  float lights = texture2D(tNight, vUv).r;

  // clouds drift slowly eastwards; extra octave adds crisp detail when magnified
  vec2 cuv = vUv + vec2(time * 0.00018, 0.0);
  float c0 = texture2D(tClouds, cuv).r;
  float det = vnoise(cuv * vec2(5000.0, 2500.0));
  float cl = clamp(c0 * (0.85 + 0.3 * det), 0.0, 1.0);
  // thin, see-through satellite cloud plus a faint veil (opaque only where thick)
  // (values below ~0.12 in this cloud map carry ghost land/bathymetry patterns)
  float cloudA = max(smoothstep(0.11, 0.85, cl) * 0.88, smoothstep(0.11, 0.35, cl) * 0.25);
  float shadow = smoothstep(0.1, 0.8, texture2D(tClouds, cuv + vec2(0.0006, 0.0009)).r);

  float pool = exp(-pow(distance(vW, focus) / 1.4, 2.0));
  float sunL = max(dot(Nf, sunDir), 0.0);

  // Reference look: the whole planet is a blue-teal monochrome of the day
  // albedo (deserts lighter than ocean, forests dark), lit by city lights.
  float lum = dot(day, vec3(0.3, 0.59, 0.11));
  // open water stays a smooth teal (the day map's bathymetry would read as terrain)
  vec3 ocean = mix(cOceanDeep, cOceanLight, 0.35 + 0.3 * vnoise(vUv * vec2(60.0, 30.0)) + 0.25 * smoothstep(0.12, 0.3, lum));
  vec3 landCol = mix(cLand, cLandLight, smoothstep(0.1, 0.55, lum));
  landCol = mix(landCol, cIce, smoothstep(0.86, 0.98, lum));
  vec3 surf = mix(ocean, landCol, land) * (0.85 + 0.25 * sunL);
  // broad sun glint / haze towards the top-right of frame
  vec3 R = reflect(-V, Nf);
  surf += cGlint * pow(max(dot(R, sunDir), 0.0), 16.0) * (0.22 - 0.12 * land);
  surf *= 1.0 - 0.18 * shadow;

  // city lights: sodium orange, white-hot cores, sparkle so they read as points
  float sp = vnoise(vUv * vec2(26000.0, 13000.0));
  float L = pow(lights, 1.35) * (0.55 + 0.9 * sp);
  vec3 lightCol = cLightWarm * L * 3.8 + cLightHot * pow(lights, 2.6) * 1.3;
  surf += lightCol * (1.0 - 0.75 * cloudA) * land;

  // clouds lit from the sun side, bluish in their shadows
  vec3 cloudCol = mix(cCloudShade, cCloud, smoothstep(0.1, 0.7, cl)) * (0.7 + 0.4 * sunL);
  vec3 c = mix(surf, cloudCol, cloudA);
  c += lightCol * cloudA * 0.18 * land; // lights glowing through thin cloud

  // atmospheric haze with distance and at the limb (sphere mode)
  float d = length(camPos - vW);
  float haze = smoothstep(fogNear, fogFar, d) * 0.45;
  float rim = pow(1.0 - max(dot(Nf, V), 0.0), 3.0) * (1.0 - uFlat);
  c = mix(c, cHaze, clamp(haze + rim * 0.8, 0.0, 0.85));
  gl_FragColor = vec4(c, 1.0);
}
`;

const ATMO_VERT = /* glsl */ `
varying vec3 vN; varying vec3 vW;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;
const ATMO_FRAG = /* glsl */ `
uniform vec3 color; uniform vec3 camPos;
varying vec3 vN; varying vec3 vW;
void main() {
  // closest approach of the view ray to the planet centre -> thin glowing limb
  vec3 D = normalize(vW - camPos);
  float tca = dot(-camPos, D);
  float h = length(camPos + D * tca);
  float g = pow(clamp(1.0 - (h - 1.0) / 0.06, 0.0, 1.0), 2.6);
  gl_FragColor = vec4(color * g * 0.9, 1.0);
}
`;

const POINT_VERT = /* glsl */ `
${FLATTEN_GLSL}
attribute float aSize; attribute float aBright; attribute float aSeed;
uniform float pxScale; uniform vec3 camPos; uniform float time; uniform float fogNear, fogFar; uniform float maxSize;
varying float vB;
void main() {
  vec3 fp = flattenPos(position);
  vec4 mv = viewMatrix * vec4(fp, 1.0);
  gl_Position = projectionMatrix * mv;
  vec3 N = normalize(fp);
  float facing = uFlat > 0.5 ? 1.0 : smoothstep(-0.02, 0.15, dot(N, normalize(camPos - fp)));
  float tw = 0.85 + 0.15 * sin(time * (1.1 + aSeed * 2.3) + aSeed * 50.0);
  vB = aBright * tw * facing * (1.0 - 0.6 * smoothstep(fogNear, fogFar, length(camPos - fp)));
  gl_PointSize = clamp(aSize * pxScale / -mv.z, 1.5, maxSize * pxScale);
}
`;
const POINT_FRAG = /* glsl */ `
uniform vec3 color; uniform vec3 glow; uniform float spikes;
varying float vB;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float r2 = dot(q, q) * 4.0;
  float core = exp(-r2 * 30.0);
  float halo = exp(-r2 * 7.0) * 0.3;
  // subtle 4-point star on network nodes
  float st = spikes * (exp(-abs(q.x) * 90.0) + exp(-abs(q.y) * 90.0)) * exp(-r2 * 3.0) * 0.35;
  gl_FragColor = vec4((color * core + glow * (halo + st)) * vB, 1.0);
}
`;

const STAR_FRAG = /* glsl */ `
varying float vB;
void main() {
  vec2 q = gl_PointCoord - 0.5;
  float a = exp(-dot(q, q) * 4.0 * 18.0);
  gl_FragColor = vec4(vec3(0.75, 0.85, 1.0) * a * vB, 1.0);
}
`;
const STAR_VERT = /* glsl */ `
attribute float aBright; uniform float pxScale;
varying float vB;
void main() {
  vB = aBright;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = 5.0 * pxScale + aBright * 4.0 * pxScale;
}
`;

export class EarthEngine {
  renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private earthMat: THREE.ShaderMaterial;
  private linkMat: THREE.ShaderMaterial;
  private lightMat: THREE.ShaderMaterial;
  private nodeMat: THREE.ShaderMaterial;
  private atmoMat: THREE.ShaderMaterial;
  private atmo: THREE.Mesh;
  private stars: THREE.Points;
  private nodes: NetNode[];
  private links: Link[];
  private nodeBright: Float32Array;
  private nodeSize: Float32Array;
  private nodePoints: THREE.Points;
  private post: PostFX;
  private pixels: Uint8ClampedArray<ArrayBuffer>;
  private image: ImageData;
  private shared = {
    uCenter: { value: new THREE.Vector3(1, 0, 0) },
    uCurv: { value: 0.25 },
    uFlat: { value: 1 },
    fogNear: { value: 1.4 },
    fogFar: { value: 3.4 },
    camPos: { value: new THREE.Vector3() },
    time: { value: 0 },
    pxScale: { value: 1 },
  };

  constructor(assets: Assets, private opts: EngineOptions) {
    const { width, height, look } = opts;
    // Off-DOM WebGL canvas; frames are blitted into a 2D canvas (see blit()).
    const canvas = document.createElement("canvas");
    THREE.ColorManagement.enabled = false;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: false });
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(opts.outputWidth, opts.outputHeight, false);
    this.renderer.setClearColor(col(opts.look.flat ? "#3d6f86" : "#02060c"), 1);
    this.pixels = new Uint8ClampedArray(opts.outputWidth * opts.outputHeight * 4);
    this.image = new ImageData(this.pixels, opts.outputWidth, opts.outputHeight);

    this.shared.uFlat.value = look.flat ? 1 : 0;
    this.shared.uCurv.value = look.curvature;
    this.shared.pxScale.value = width / 3840;
    this.camera = new THREE.PerspectiveCamera(look.fov, width / height, 0.01, 50);

    for (const t of [assets.day, assets.night, assets.clouds, assets.land]) {
      t.colorSpace = THREE.NoColorSpace;
      t.anisotropy = 2;
      t.minFilter = THREE.LinearMipmapLinearFilter;
      t.magFilter = THREE.LinearFilter;
      t.wrapS = THREE.RepeatWrapping;
      t.needsUpdate = true;
    }

    // --- Earth ----------------------------------------------------------------
    this.earthMat = new THREE.ShaderMaterial({
      vertexShader: EARTH_VERT,
      fragmentShader: EARTH_FRAG,
      uniforms: {
        tDay: { value: assets.day },
        tNight: { value: assets.night },
        tClouds: { value: assets.clouds },
        tLand: { value: assets.land },
        sunDir: { value: new THREE.Vector3() },
        focus: { value: new THREE.Vector3() },
        cOceanDeep: { value: col("#05344a") },
        cOceanLight: { value: col("#0f5470") },
        cLand: { value: col("#122a33") },
        cLandLight: { value: col("#1d6580") },
        cIce: { value: col("#9cc4d4") },
        cGlint: { value: col("#9fd2ea") },
        cLightWarm: { value: col("#ff8a2a") },
        cLightHot: { value: col("#fff1cf") },
        cCloud: { value: col("#eef2f4") },
        cCloudShade: { value: col("#7c8d96") },
        cHaze: { value: col("#5f93ab") },
        ...this.shared,
      },
    });
    this.scene.add(new THREE.Mesh(new THREE.SphereGeometry(1, 512, 256), this.earthMat));

    // --- Atmosphere shell + stars (only visible in sphere mode) ---------------
    this.atmoMat = new THREE.ShaderMaterial({
      vertexShader: ATMO_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: { color: { value: col("#6fb6ff") }, camPos: this.shared.camPos },
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.atmo = new THREE.Mesh(new THREE.SphereGeometry(1.06, 128, 64), this.atmoMat);
    this.atmo.visible = !look.flat;
    this.scene.add(this.atmo);
    const rnd = mulberry32(99);
    const nStars = 2500;
    const sp = new Float32Array(nStars * 3);
    const sb = new Float32Array(nStars);
    for (let i = 0; i < nStars; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(30);
      sp.set([v.x, v.y, v.z], i * 3);
      sb[i] = Math.pow(rnd(), 3) * 1.2 + 0.12;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    sg.setAttribute("aBright", new THREE.BufferAttribute(sb, 1));
    this.stars = new THREE.Points(
      sg,
      new THREE.ShaderMaterial({
        vertexShader: STAR_VERT,
        fragmentShader: STAR_FRAG,
        uniforms: { pxScale: this.shared.pxScale },
        blending: THREE.AdditiveBlending,
        transparent: true,
        depthWrite: false,
      }),
    );
    this.stars.visible = !look.flat;
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);

    // --- City-light sparkle points ----------------------------------------------
    const L = assets.lights;
    const lp = new Float32Array(L.length * 3);
    const ls = new Float32Array(L.length);
    const lb = new Float32Array(L.length);
    const lseed = new Float32Array(L.length);
    const v = new THREE.Vector3();
    L.forEach(([la, lo, b], i) => {
      latLonToVec3(la, lo, 1.0015, v);
      lp.set([v.x, v.y, v.z], i * 3);
      ls[i] = 18 + 34 * b;
      lb[i] = 0.22 + 0.62 * b;
      lseed[i] = rnd();
    });
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.BufferAttribute(lp, 3));
    lg.setAttribute("aSize", new THREE.BufferAttribute(ls, 1));
    lg.setAttribute("aBright", new THREE.BufferAttribute(lb, 1));
    lg.setAttribute("aSeed", new THREE.BufferAttribute(lseed, 1));
    this.lightMat = new THREE.ShaderMaterial({
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      uniforms: { color: { value: col("#ffe2b0") }, glow: { value: col("#ff9440") }, spikes: { value: 0 }, maxSize: { value: 30 }, ...this.shared },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const lpts = new THREE.Points(lg, this.lightMat);
    lpts.frustumCulled = false;
    this.scene.add(lpts);

    // --- Network links ---------------------------------------------------------
    const net = scheduleNetwork(look.keys, 1312367089, opts.duration, look.viewRadius, landSampler(assets.land));
    this.nodes = net.nodes;
    this.links = net.links;
    this.linkMat = new THREE.ShaderMaterial({
      vertexShader: LINK_VERT,
      fragmentShader: LINK_FRAG,
      uniforms: {
        resolution: { value: new THREE.Vector2(width, height) },
        width: { value: 6.0 },
        coreColor: { value: col("#e2f7ff") },
        glowColor: { value: col("#4cc6ff") },
        intensity: { value: 1.0 },
        ...this.shared,
      },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const lm = new THREE.Mesh(buildLinkGeometry(this.links), this.linkMat);
    lm.frustumCulled = false;
    this.scene.add(lm);

    // --- Network nodes ---------------------------------------------------------
    const np = new Float32Array(this.nodes.length * 3);
    this.nodeSize = new Float32Array(this.nodes.length);
    this.nodeBright = new Float32Array(this.nodes.length);
    const nseed = new Float32Array(this.nodes.length);
    this.nodes.forEach((n, i) => {
      const p = n.p.clone().normalize().multiplyScalar(1.004);
      np.set([p.x, p.y, p.z], i * 3);
      nseed[i] = rnd();
    });
    const ng = new THREE.BufferGeometry();
    ng.setAttribute("position", new THREE.BufferAttribute(np, 3));
    ng.setAttribute("aSize", new THREE.BufferAttribute(this.nodeSize, 1));
    ng.setAttribute("aBright", new THREE.BufferAttribute(this.nodeBright, 1));
    ng.setAttribute("aSeed", new THREE.BufferAttribute(nseed, 1));
    this.nodeMat = new THREE.ShaderMaterial({
      vertexShader: POINT_VERT,
      fragmentShader: POINT_FRAG,
      uniforms: { color: { value: col("#ffffff") }, glow: { value: col("#9ad8ff") }, spikes: { value: 1 }, maxSize: { value: 160 }, ...this.shared },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    this.nodePoints = new THREE.Points(ng, this.nodeMat);
    this.nodePoints.frustumCulled = false;
    this.scene.add(this.nodePoints);

    this.post = new PostFX(this.renderer, width, height, {
      focusY: 0.42,
      focusHalf: 0.2,
      focusSoft: 0.35,
      blurTop: 0.2,
      blurBottom: 0.12,
      dofRadius: 2.0,
      bloomThreshold: 0.62,
      bloomA: 0.55,
      bloomB: 0.6,
      vignette: 0.35,
      grain: 0.016,
      exposure: 1.0,
      saturation: 1.0,
      lift: [0.0, 0.006, 0.012],
      gain: [1, 1, 1],
      tint: [1.04, 0.88, 0.86],
      ...look.post,
    });
  }

  render(time: number) {
    const cam = cameraAt(this.opts.look.keys, time);
    this.camera.position.copy(cam.position);
    this.camera.up.copy(cam.up);
    this.camera.lookAt(cam.target);
    this.camera.updateMatrixWorld();
    const n = cam.target.clone().normalize();
    this.shared.uCenter.value.copy(n);
    this.shared.camPos.value.copy(cam.position);
    this.shared.time.value = time;
    // haze distances scale with altitude so the pull-back stays clear
    this.shared.fogNear.value = 1.0 + cam.dist * 0.6;
    this.shared.fogFar.value = 2.6 + cam.dist * 1.4;
    // art-directed key light: from beyond the horizon ahead of the camera
    const u = this.earthMat.uniforms;
    const right = new THREE.Vector3().subVectors(cam.target, cam.position).normalize().cross(cam.up).normalize();
    u.sunDir.value.copy(n).multiplyScalar(0.45).addScaledVector(cam.up, 0.75).addScaledVector(right, 0.55).normalize();
    u.focus.value.copy(cam.target);

    // nodes pop on, then settle with a gentle pulse
    this.nodes.forEach((nd, i) => {
      const a = time - nd.start;
      if (a < 0) {
        this.nodeBright[i] = 0;
        this.nodeSize[i] = 0;
        return;
      }
      const pop = Math.exp(-a * 4.0);
      this.nodeBright[i] = Math.min(1, a * 6) * (1.0 + 1.0 * pop);
      this.nodeSize[i] = (95 + 150 * pop) * nd.size;
    });
    const g = this.nodePoints.geometry;
    (g.attributes.aBright as THREE.BufferAttribute).needsUpdate = true;
    (g.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;

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

  dispose() {
    this.post.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      (m.material as THREE.Material | undefined)?.dispose?.();
    });
    this.renderer.dispose();
  }
}

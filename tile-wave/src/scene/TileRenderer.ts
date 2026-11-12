import * as THREE from "three";
import { CELLS, cellPose } from "./field";

export type Look = {
  stops: { depth: number; color: string }[]; // sRGB hex, keyed on depth below surface
  upStops: { height: number; color: string }[]; // sRGB hex, keyed on height above surface
  background: string;
  shadowTint: string;
  emissiveFrom: number;
  emissiveTo: number;
  emissive: number;
  vignette: number;
};

export type CameraState = {
  position: [number, number, number];
  target: [number, number, number];
  roll: number; // radians, around the view axis
  fov: number; // vertical, degrees
  shiftX?: number; // horizontal lens shift, as a fraction of the frame width
};

const MAX_STOPS = 8;
const TILE_SIZE = 0.995; // plates butt together: the resting surface reads as one flat sheet
const TILE_THICKNESS = 0.16;
const CURL = 0.55; // bend per radian of tilt

const VERT = /* glsl */ `
attribute vec4 aCurl; // (gx, gy) local slope direction, curl amount, stretch
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;
void main() {
  // Bend the plate like curling paper along the slope direction.
  vec3 p = position;
  // Lengthen tipped plates along the slope so they overlap like scales
  // instead of opening gaps.
  p.xz += aCurl.xy * dot(p.xz, aCurl.xy) * (aCurl.w - 1.0);
  float s = dot(p.xz, aCurl.xy);
  p.y -= aCurl.z * s * s;
  vec3 nrm = normal;
  if (abs(normal.y) > 0.5) nrm = normalize(vec3(2.0 * aCurl.z * s * aCurl.x, 1.0, 2.0 * aCurl.z * s * aCurl.y) * sign(normal.y));
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vWorld = wp.xyz;
  vLocal = position;
  vNormal = normalize(mat3(modelMatrix * instanceMatrix) * nrm);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const FRAG = /* glsl */ `
uniform vec3 uStops[${MAX_STOPS}];
uniform float uStopPos[${MAX_STOPS}];
uniform int uCount;
uniform vec3 uUp[4];
uniform float uUpPos[4];
uniform vec3 uLightDir;
uniform vec3 uShadowTint;
uniform float uEmFrom;
uniform float uEmTo;
uniform float uEm;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec3 vLocal;

vec3 palette(float d) {
  vec3 c = uStops[0];
  for (int i = 1; i < ${MAX_STOPS}; i++) {
    if (i >= uCount) break;
    float a = clamp((d - uStopPos[i - 1]) / max(uStopPos[i] - uStopPos[i - 1], 1e-4), 0.0, 1.0);
    c = mix(c, uStops[i], a);
  }
  return c;
}

vec3 paletteUp(float h) {
  vec3 c = uUp[0];
  for (int i = 1; i < 4; i++) {
    float a = clamp((h - uUpPos[i - 1]) / max(uUpPos[i] - uUpPos[i - 1], 1e-4), 0.0, 1.0);
    c = mix(c, uUp[i], a);
  }
  return c;
}

void main() {
  vec3 n = normalize(vNormal);
  float depth = -vWorld.y;
  vec3 base = depth >= 0.0 ? palette(depth) : paletteUp(-depth);
  // Soft, high-key studio light: wrap diffuse + sky fill.
  float lam = dot(n, uLightDir) * 0.5 + 0.5;
  float sky = 0.5 + 0.5 * n.y;
  float light = clamp(0.22 + 0.62 * lam + 0.24 * sky, 0.0, 1.2);
  // Gentle bevel on the top face so neighbouring tiles read as separate pieces.
  float top = step(0.5, abs(n.y)) * smoothstep(0.05, 0.4, abs(vWorld.y));
  vec2 e = abs(vLocal.xz);
  float edge = smoothstep(0.38, 0.47, max(e.x, e.y));
  light *= 1.0 - top * edge * 0.10;
  // Shadows tint towards lavender instead of grey (pastel studio look).
  vec3 shade = mix(uShadowTint, vec3(1.0), clamp(light, 0.0, 1.0)) * max(light, 1.0);
  vec3 col = base * shade;
  // Deep valley floor glows.
  col += base * uEm * smoothstep(uEmFrom, uEmTo, depth);
  gl_FragColor = vec4(col, 1.0);
}`;

const ACCUM_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`;

const ACCUM_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform float uWeight;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(uTex, vUv).rgb * uWeight, 1.0);
}`;

const OUT_FRAG = /* glsl */ `
uniform sampler2D uTex;
uniform float uVignette;
uniform vec2 uRes;
varying vec2 vUv;
vec3 toSrgb(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
}
void main() {
  vec3 c = texture2D(uTex, vUv).rgb;
  // Hue-preserving soft roll-off of the brightest values.
  float m = max(max(c.r, c.g), max(c.b, 1e-5));
  float tm = m < 0.92 ? m : 0.92 + 0.08 * (1.0 - exp(-(m - 0.92) / 0.08));
  c *= tm / m;
  vec2 v = vUv - 0.5;
  v.x *= uRes.x / uRes.y;
  c *= 1.0 - uVignette * dot(v, v);
  float d = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  gl_FragColor = vec4(toSrgb(c) + d / 255.0, 1.0);
}`;

const srgbToLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

const hexLinear = (hex: string) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return new THREE.Vector3(
    srgbToLinear(((n >> 16) & 255) / 255),
    srgbToLinear(((n >> 8) & 255) / 255),
    srgbToLinear((n & 255) / 255),
  );
};

export class TileRenderer {
  readonly width: number;
  readonly height: number;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private mesh: THREE.InstancedMesh;
  private material: THREE.ShaderMaterial;
  private sceneRT: THREE.WebGLRenderTarget;
  private accumRT: THREE.WebGLRenderTarget;
  private quadScene = new THREE.Scene();
  private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private accumMat: THREE.ShaderMaterial;
  private outMat: THREE.ShaderMaterial;
  private quad: THREE.Mesh;
  private dummy = new THREE.Object3D();
  private axis = new THREE.Vector3();
  private curl: THREE.InstancedBufferAttribute;

  constructor(canvas: HTMLCanvasElement, look: Look) {
    this.width = canvas.width;
    this.height = canvas.height;
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    if (!renderer.capabilities.isWebGL2) {
      throw new Error("WebGL 2 is required.");
    }
    renderer.setPixelRatio(1);
    renderer.setSize(this.width, this.height, false);
    renderer.autoClear = false;
    this.renderer = renderer;

    const rtOpts = { type: THREE.HalfFloatType, depthBuffer: true } as const;
    this.sceneRT = new THREE.WebGLRenderTarget(this.width, this.height, rtOpts);
    this.accumRT = new THREE.WebGLRenderTarget(this.width, this.height, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
    });

    const stops = look.stops.slice(0, MAX_STOPS);
    const stopCols = Array.from({ length: MAX_STOPS }, (_, i) =>
      hexLinear(stops[Math.min(i, stops.length - 1)].color),
    );
    const stopPos = Array.from({ length: MAX_STOPS }, (_, i) => stops[Math.min(i, stops.length - 1)].depth);
    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uStops: { value: stopCols },
        uStopPos: { value: stopPos },
        uCount: { value: stops.length },
        uUp: { value: look.upStops.slice(0, 4).map((u) => hexLinear(u.color)) },
        uUpPos: { value: look.upStops.slice(0, 4).map((u) => u.height) },
        uLightDir: { value: new THREE.Vector3(-0.45, 0.8, 0.35).normalize() },
        uShadowTint: { value: hexLinear(look.shadowTint) },
        uEmFrom: { value: look.emissiveFrom },
        uEmTo: { value: look.emissiveTo },
        uEm: { value: look.emissive },
      },
    });

    // Thin square plate, top face at local y = 0 (the pivot of its tilt).
    const geo = new THREE.BoxGeometry(TILE_SIZE, TILE_THICKNESS, TILE_SIZE, 6, 1, 6);
    geo.translate(0, -TILE_THICKNESS / 2, 0);
    this.curl = new THREE.InstancedBufferAttribute(new Float32Array(CELLS.length * 4), 4);
    this.curl.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute("aCurl", this.curl);
    this.mesh = new THREE.InstancedMesh(geo, this.material, CELLS.length);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.scene.add(this.mesh);
    this.scene.background = new THREE.Color(look.background);

    this.camera = new THREE.PerspectiveCamera(30, this.width / this.height, 0.5, 400);

    this.accumMat = new THREE.ShaderMaterial({
      vertexShader: ACCUM_VERT,
      fragmentShader: ACCUM_FRAG,
      uniforms: { uTex: { value: this.sceneRT.texture }, uWeight: { value: 1 } },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    this.outMat = new THREE.ShaderMaterial({
      vertexShader: ACCUM_VERT,
      fragmentShader: OUT_FRAG,
      uniforms: {
        uTex: { value: this.accumRT.texture },
        uVignette: { value: look.vignette },
        uRes: { value: new THREE.Vector2(this.width, this.height) },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.accumMat);
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  private layout(frame: number) {
    const d = this.dummy;
    for (let k = 0; k < CELLS.length; k++) {
      const c = CELLS[k];
      const p = cellPose(c, frame);
      d.position.set(c.x, p.h, c.y);
      // Tip the plate about the horizontal axis across the slope (grid v -> world z).
      this.axis.set(-p.gy, 0, p.gx);
      d.quaternion.setFromAxisAngle(this.axis, p.tilt);
      d.updateMatrix();
      this.mesh.setMatrixAt(k, d.matrix);
      // Tiles curl as they tip: the bend follows the tilt (sign included).
      const t = Math.abs(p.tilt);
      const stretch = 1 + Math.min(0.85, (1 / Math.cos(Math.min(t, 1.2)) - 1) * 1.3 + 0.25 * Math.min(1, t / 0.15));
      this.curl.setXYZW(k, p.gx, p.gy, CURL * p.tilt, stretch);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.curl.needsUpdate = true;
  }

  private setCamera(cam: CameraState) {
    const c = this.camera;
    c.fov = cam.fov;
    c.aspect = this.width / this.height;
    c.position.set(...cam.position);
    c.up.set(0, 1, 0);
    c.lookAt(new THREE.Vector3(...cam.target));
    c.rotateZ(cam.roll);
    c.updateMatrixWorld();
  }

  /**
   * Render one output frame with motion blur: `samples` sub-frames spread
   * over `shutter` frames (centred on the frame), averaged in linear light.
   */
  render(frame: number, cameraAt: (f: number) => CameraState, samples: number, shutter: number) {
    const r = this.renderer;
    r.setRenderTarget(this.accumRT);
    r.setClearColor(0x000000, 1);
    r.clear(true, true, true);
    for (let s = 0; s < samples; s++) {
      const f = frame + (samples === 1 ? 0 : ((s + 0.5) / samples - 0.5) * shutter);
      this.layout(f);
      this.setCamera(cameraAt(f));
      // Sub-pixel jitter per sample (R2 sequence) -> accumulation anti-aliasing.
      const jx = ((0.5 + s * 0.7548776662) % 1) - 0.5;
      const jy = ((0.5 + s * 0.5698402909) % 1) - 0.5;
      const shift = (cameraAt(f).shiftX ?? 0) * this.width;
      this.camera.setViewOffset(this.width, this.height, jx + shift, jy, this.width, this.height);
      this.camera.updateProjectionMatrix();
      r.setRenderTarget(this.sceneRT);
      r.clear(true, true, true);
      r.render(this.scene, this.camera);
      r.setRenderTarget(this.accumRT);
      this.quad.material = this.accumMat;
      this.accumMat.uniforms.uWeight.value = 1 / samples;
      r.render(this.quadScene, this.quadCam);
    }
    r.setRenderTarget(null);
    r.clear(true, true, true);
    this.quad.material = this.outMat;
    r.render(this.quadScene, this.quadCam);
    const gl = r.getContext();
    gl.finish();
  }

  dispose() {
    this.sceneRT.dispose();
    this.accumRT.dispose();
    this.mesh.geometry.dispose();
    this.material.dispose();
    this.accumMat.dispose();
    this.outMat.dispose();
    this.renderer.dispose();
  }
}

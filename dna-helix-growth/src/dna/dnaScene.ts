import * as THREE from "three";
import type { GLSceneFactory } from "../gl/GLCanvas";
import { PostPipeline, type PostSettings } from "../gl/post";
import { buildHelixGeometry } from "./helixGeometry";
import type { DnaPalette } from "./palettes";
import { makeRng } from "./random";

const FAR = 80;

const VERT = /* glsl */ `
in vec3 position;
in vec3 normal;
in float aX;
in vec3 aData;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
out vec3 vN;
out vec3 vPos;
out float vX;
out vec3 vData;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vPos = mv.xyz;
  vN = normalMatrix * normal;
  vX = aX;
  vData = aData;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
precision highp float;
in vec3 vN;
in vec3 vPos;
in float vX;
in vec3 vData;
uniform vec2 uGrowWire;   // axial position of the wire tip, per strand
uniform vec2 uGrowShell;  // axial position of the shell front, per strand
uniform float uFar;
uniform float uFade;
uniform vec3 uWire;
uniform vec3 uRing;
uniform vec3 uShellA;
uniform vec3 uShellB;
uniform vec3 uRim;
uniform vec3 uSpec;
out vec4 o;

void main() {
  float kind = vData.x;
  float strand = vData.y;
  float gw = mix(uGrowWire.x, uGrowWire.y, strand);
  float gs = mix(uGrowShell.x, uGrowShell.y, strand);
  vec3 N = normalize(vN);
  vec3 V = normalize(-vPos);
  bool back = !gl_FrontFacing;
  if (back) N = -N;
  float ndv = max(dot(N, V), 0.0);
  vec3 col;

  if (kind < 0.5) {
    // ---------- segmented shell ----------
    if (vX > gs) discard;
    float tip = smoothstep(0.1, 0.0, gs - vX);
    if (back) {
      col = uWire * 1.2; // glowing inside of the open, still-growing end
    } else {
      float toneI = floor(vData.z * 0.5);
      float sfr = vData.z - toneI * 2.0;
      float tone = 0.55 + toneI / 8.0;
      float gap = smoothstep(0.0, 0.05, sfr) * smoothstep(1.0, 0.95, sfr);
      vec3 R = reflect(-V, N);
      float fr = pow(1.0 - ndv, 2.6);
      // studio-style reflections: one tight key light, two long soft boxes
      float key = pow(max(dot(R, normalize(vec3(0.35, 0.8, 0.48))), 0.0), 70.0) * 2.6;
      float box1 = smoothstep(0.72, 0.93, R.y) * 0.3;
      float box2 = smoothstep(0.72, 0.95, -R.x * 0.8 + R.z * 0.3) * 0.16;
      vec3 base = mix(uShellA, uShellB, strand) * tone * 0.5;
      vec3 rim = mix(uRim, uWire * 1.25, strand);
      col = base * (0.3 + 0.7 * ndv) + rim * (fr * fr * 1.5 + fr * 0.25)
          + uSpec * (key + box1 + box2) * mix(1.0, 0.6, strand);
      col *= mix(0.3, 1.0, gap);
      col += uWire * tip * tip * 0.9;
    }
  } else if (kind < 1.5) {
    // ---------- thin emissive wire ----------
    if (vX > gw) discard;
    float tip = smoothstep(0.35, 0.0, gw - vX);
    col = uWire * (1.15 + 0.5 * ndv + 1.3 * tip * tip);
  } else if (kind < 2.5) {
    // ---------- rung, extends towards the axis after the wire passes ----------
    float g = clamp((gw - vX) * 0.9, 0.0, 1.0);
    if (vX > gw || vData.z > g) discard;
    float fresh = smoothstep(1.6, 0.0, gw - vX);
    col = uWire * (0.4 + 0.8 * fresh);
  } else {
    // ---------- marker ring ----------
    if (vX > gs) discard;
    float fresh = smoothstep(1.2, 0.0, gs - vX);
    vec3 R = reflect(-V, N);
    float key = pow(max(dot(R, normalize(vec3(0.35, 0.8, 0.48))), 0.0), 30.0);
    col = uRing * (0.45 + 0.6 * ndv + 0.7 * fresh) + uSpec * key * 0.9;
  }
  o = vec4(col * uFade, clamp(-vPos.z / uFar, 0.0, 1.0));
}`;

type Helix = {
  mesh: THREE.Mesh;
  uniforms: Record<string, THREE.IUniform>;
  delay: number;
  startX: number;
  endA: number;
  endB: number;
  spin0: number;
  spinRate: number;
};

/** Camera path: `orbit` is used by nobody in V1/V2 by default but kept configurable. */
export type DnaCamera = {
  from: [number, number, number];
  to: [number, number, number];
  lookFrom: [number, number, number];
  lookTo: [number, number, number];
  rollFrom: number;
  rollTo: number;
  fov: number;
};

export const DEFAULT_CAMERA: DnaCamera = {
  from: [-1.0, -2.0, 12.6],
  to: [0.7, -0.9, 11.4],
  lookFrom: [-0.3, -1.6, 0],
  lookTo: [0.35, -0.9, 0],
  rollFrom: -0.03,
  rollTo: 0.02,
  fov: 30,
};

const smooth = (t: number) => t * t * (3 - 2 * t);

export const createDnaScene =
  (
    palette: DnaPalette,
    cam: DnaCamera,
    durationInFrames: number,
  ): GLSceneFactory =>
  (canvas, width, height, fps) => {
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(1);
    renderer.setSize(width, height, false);
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    renderer.setClearColor(0x000000, 1);

    const post = new PostPipeline(renderer, width, height, FAR, {
      dofRings: 4,
      fillRings: 3,
    });
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      cam.fov,
      width / height,
      0.5,
      FAR,
    );

    // All helices share one orientation: axes run lower-left -> upper-right and
    // lean towards the camera, like the reference.
    const field = new THREE.Group();
    field.rotation.set(
      0,
      THREE.MathUtils.degToRad(-7),
      THREE.MathUtils.degToRad(35),
      "ZYX",
    );
    scene.add(field);

    const col = (c: [number, number, number]) =>
      new THREE.Color(c[0], c[1], c[2]);
    const baseUniforms = () => ({
      uGrowWire: { value: new THREE.Vector2() },
      uGrowShell: { value: new THREE.Vector2() },
      uFar: { value: FAR },
      uFade: { value: 1 },
      uWire: { value: col(palette.wire) },
      uRing: { value: col(palette.ring) },
      uShellA: { value: col(palette.shellA) },
      uShellB: { value: col(palette.shellB) },
      uRim: { value: col(palette.rim) },
      uSpec: { value: col(palette.spec) },
    });

    const rng = makeRng(20241);
    const helices: Helix[] = [];
    const X0 = -26;
    // Regular array of parallel helices: a = row (screen up/down), b = depth layer.
    const layout: [number, number][] = [
      [-2, 0],
      [-1, 0],
      [0, 0],
      [1, 0],
      [2, 0],
      [-1, -1],
      [0, -1],
      [1, -1],
      [-2, -1],
      [9, 9], // large defocused foreground helix, see below
    ];
    for (const [a, b] of layout) {
      {
        const isHero = a === 0 && b === 0;
        const isNear = a === 9;
        const jitterY = (rng() - 0.5) * 0.7;
        const jitterZ = (rng() - 0.5) * 0.9;
        const endJ = rng();
        const delayJ = rng();
        const phase = 0.5 + 0.55 * a + 0.8 * b + (rng() - 0.5) * 0.5;
        const pitchJ = rng();
        const spinJ = rng();
        const y = isNear
          ? -2.9
          : a * 2.9 + (isHero ? 0 : jitterY) + (b & 1 ? 1.45 : 0);
        const z = isNear ? 6.6 : b * 4.0 + (isHero ? 0 : jitterZ);
        const endA = isNear
          ? 6.5
          : (isHero ? 4.6 : 1.5 + endJ * 5.5) - y * 0.35;
        const endB = endA - 0.6 - rng() * 2.6;
        const geo = buildHelixGeometry({
          radius: 1,
          pitch: 8.2 + pitchJ * 0.3,
          phase,
          x0: X0,
          x1: endA + 0.01,
          tube: 0.098,
          rng,
        });
        const uniforms = baseUniforms();
        const mat = new THREE.RawShaderMaterial({
          glslVersion: THREE.GLSL3,
          vertexShader: VERT,
          fragmentShader: FRAG,
          uniforms,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.frustumCulled = false;
        mesh.position.set(0, y, z);
        field.add(mesh);
        helices.push({
          mesh,
          uniforms,
          delay: isHero || isNear ? 0.0 : delayJ * 1.2,
          startX: isNear ? -1.0 : -9.5 - y * 0.6 + z * 0.3,
          endA,
          endB,
          spin0: 0,
          spinRate: 0.11 + spinJ * 0.02,
        });
      }
    }

    const duration = durationInFrames / fps;
    const ease = (s: number) => {
      const c = Math.min(Math.max(s, 0), 1);
      return 0.5 * ((1 - Math.exp(-3 * c)) / (1 - Math.exp(-3))) + 0.5 * c;
    };

    const settings: PostSettings = {
      focus: 11,
      aperture: 0.01,
      maxCoc: 0.028,
      bloomThreshold: 1.25,
      bloomStrength: 0.17,
      bgInner: col(palette.bgInner),
      bgOuter: col(palette.bgOuter),
      bgCenter: new THREE.Vector2(0.5, 0.1),
      vignette: 0.3,
      grain: 0.012,
      exposure: 1.0,
      filmic: 1.0,
      tint: new THREE.Color(1, 1, 1),
      saturation: 1.05,
    };

    const from = new THREE.Vector3(...cam.from);
    const to = new THREE.Vector3(...cam.to);
    const lookFrom = new THREE.Vector3(...cam.lookFrom);
    const lookTo = new THREE.Vector3(...cam.lookTo);
    const look = new THREE.Vector3();

    const render = (frame: number) => {
      const t = frame / fps;
      const p = smooth(Math.min(t / duration, 1));

      camera.position.lerpVectors(from, to, p);
      look.lerpVectors(lookFrom, lookTo, p);
      camera.up.set(0, 1, 0);
      camera.lookAt(look);
      camera.rotateZ(cam.rollFrom + (cam.rollTo - cam.rollFrom) * p);
      camera.updateMatrixWorld();
      settings.focus = camera.position.distanceTo(look) + 0.15;

      for (const h of helices) {
        const s = (t - h.delay) / (duration - h.delay);
        const e = t < h.delay ? 0 : ease(s);
        const wireA = h.startX + (h.endA - h.startX) * e;
        const wireB = h.startX - 0.8 + (h.endB - (h.startX - 0.8)) * e;
        const shellA = wireA - 0.07;
        const shellB = wireB - 0.09;
        h.uniforms.uGrowWire.value.set(wireA, wireB);
        h.uniforms.uGrowShell.value.set(shellA, shellB);
        h.mesh.rotation.x = h.spin0 + h.spinRate * t;
      }

      renderer.setRenderTarget(post.sceneTarget);
      renderer.clear();
      renderer.render(scene, camera);
      post.render(settings, frame);
    };

    return {
      render,
      dispose: () => {
        helices.forEach((h) => {
          h.mesh.geometry.dispose();
          (h.mesh.material as THREE.Material).dispose();
        });
        post.dispose();
        renderer.dispose();
      },
    };
  };

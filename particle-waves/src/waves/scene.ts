import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { CreateStage } from "../gl/ThreeStage";
import { SIMPLEX_NOISE } from "../gl/noise";
import { mulberry32 } from "../gl/random";
import { rgb } from "../gl/color";
import type { CameraRig, WavePalette } from "./looks";

// Spacing between neighbouring particles of the cloth, in world units.
const GRID_SPACING = 0.0165;

const PARTICLE_VERT = /* glsl */ `
${SIMPLEX_NOISE}
uniform float uTime;
uniform float uPixel;
uniform float uFocus;
uniform vec3 uLightDir;
uniform vec3 uBase;
uniform vec3 uHighlight;
uniform vec3 uDeep;
attribute vec4 aRand;
varying vec3 vColor;

// The cloth: broad folds that roll and fold over each other, with lateral
// displacement so crests pinch into bright creases.
vec3 surface(vec2 g) {
  float t = uTime;
  vec3 q = vec3(g * 0.42, t * 0.07);
  float h = snoise(q + vec3(0.0, t * 0.035, 0.0)) * 0.72
          + snoise(q * 2.1 + vec3(3.1, -t * 0.05, 1.7)) * 0.28
          + snoise(q * 4.3 + vec3(-2.3, 5.1, t * 0.09)) * 0.07;
  vec2 lateral = vec2(
    snoise(q * 1.3 + vec3(11.0, 0.0, t * 0.03)),
    snoise(q * 1.3 + vec3(0.0, 17.0, -t * 0.03))
  ) * 0.26;
  return vec3(g.x + lateral.x, h, g.y + lateral.y);
}

void main() {
  vec2 g = position.xz;
  vec3 p = surface(g);
  float e = 0.03;
  vec3 px = surface(g + vec2(e, 0.0));
  vec3 pz = surface(g + vec2(0.0, e));
  vec3 n = normalize(cross(pz - p, px - p));

  // Dissolving regions: particles drift loose into dust.
  float dustMask = smoothstep(0.15, 0.75, snoise(vec3(g * 0.22 + vec2(5.0, 1.0), uTime * 0.06 + 3.0)));
  vec3 jitter = (aRand.xyz - 0.5) * vec3(0.5, 0.35, 0.5);
  p += jitter * dustMask * dustMask;

  vec4 world = modelMatrix * vec4(p, 1.0);
  vec4 mv = viewMatrix * world;
  vec3 viewDir = normalize(cameraPosition - world.xyz);

  float diffuse = max(dot(n, uLightDir), 0.0);
  vec3 hv = normalize(uLightDir + viewDir);
  float spec = pow(max(dot(n, hv), 0.0), 28.0);
  float grazing = pow(1.0 - abs(dot(n, viewDir)), 3.0);

  vec3 col = uDeep * 0.5 + uBase * (0.25 + 0.75 * diffuse) + uHighlight * (spec * 1.6 + grazing * 0.55);
  col *= mix(1.0, 0.45, dustMask) * (0.8 + 0.4 * aRand.w);

  float depth = -mv.z;
  float fog = exp(-max(depth - 2.5, 0.0) * 0.2);
  float coc = abs(depth - uFocus) * 0.45;
  gl_Position = projectionMatrix * mv;
  float size = uPixel * (10.0 / depth + coc * 2.2) * (1.0 - 0.35 * dustMask);
  gl_PointSize = clamp(size, 0.0, uPixel * 18.0);
  col *= fog * 0.55 / (1.0 + coc * coc * 2.5);
  vColor = col;
}
`;

const PARTICLE_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.15, r);
  gl_FragColor = vec4(vColor * a, 1.0);
}
`;

const QUAD_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const BG_FRAG = /* glsl */ `
${SIMPLEX_NOISE}
uniform float uTime;
uniform float uAspect;
uniform vec3 uBgDeep;
uniform vec3 uBgGlow;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  vec3 col = uBgDeep;
  float drift = snoise(vec3(p * 0.8, uTime * 0.05)) * 0.5 + 0.5;
  col += uBgGlow * (0.35 + 0.4 * drift) * exp(-dot(p - vec2(-0.85, 0.05), p - vec2(-0.85, 0.05)) / 0.12);
  col += uBgGlow * 0.25 * exp(-dot(p - vec2(0.7, 0.35), p - vec2(0.7, 0.35)) / 0.2);
  col += uBgGlow * 0.18 * exp(-dot(p, p) / 0.5);
  col *= smoothstep(1.35, 0.3, length(p));
  gl_FragColor = vec4(col, 1.0);
}
`;

export const createWaveStage =
  (palette: WavePalette, rig: CameraRig, extent: number): CreateStage =>
  (renderer, width, height, fps) => {
    renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
    const aspect = width / height;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, aspect, 0.05, 60);

    const quad = new THREE.PlaneGeometry(2, 2);
    const bgUniforms = {
      uTime: { value: 0 },
      uAspect: { value: aspect },
      uBgDeep: { value: rgb(palette.bgDeep) },
      uBgGlow: { value: rgb(palette.bgGlow) },
    };
    const bg = new THREE.Mesh(
      quad,
      new THREE.ShaderMaterial({
        uniforms: bgUniforms,
        vertexShader: QUAD_VERT,
        fragmentShader: BG_FRAG,
        depthTest: false,
        depthWrite: false,
      }),
    );
    bg.frustumCulled = false;
    bg.renderOrder = 0;
    scene.add(bg);

    const rand = mulberry32(3624860847);
    // The surface spans [-extent, extent] on x and z.
    const grid = Math.round((extent * 2) / GRID_SPACING) + 1;
    const count = grid * grid;
    const positions = new Float32Array(count * 3);
    const rands = new Float32Array(count * 4);
    const step = (extent * 2) / (grid - 1);
    for (let j = 0; j < grid; j++) {
      for (let i = 0; i < grid; i++) {
        const k = j * grid + i;
        positions[k * 3] = -extent + i * step;
        positions[k * 3 + 1] = 0;
        positions[k * 3 + 2] = -extent + j * step;
        rands[k * 4] = rand();
        rands[k * 4 + 1] = rand();
        rands[k * 4 + 2] = rand();
        rands[k * 4 + 3] = rand();
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aRand", new THREE.BufferAttribute(rands, 4));

    const pUniforms = {
      uTime: { value: 0 },
      uPixel: { value: height / 1080 },
      uFocus: { value: 4 },
      uLightDir: { value: new THREE.Vector3(0.55, 0.65, -0.5).normalize() },
      uBase: { value: rgb(palette.base) },
      uHighlight: { value: rgb(palette.highlight) },
      uDeep: { value: rgb(palette.deep) },
    };
    const field = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: pUniforms,
        vertexShader: PARTICLE_VERT,
        fragmentShader: PARTICLE_FRAG,
        blending: THREE.AdditiveBlending,
        depthTest: false,
        depthWrite: false,
        transparent: true,
      }),
    );
    field.frustumCulled = false;
    field.renderOrder = 1;
    scene.add(field);

    const composer = new EffectComposer(renderer);
    composer.setPixelRatio(1);
    composer.setSize(width, height);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.55, 0.6, 0.3));
    composer.addPass(new OutputPass());

    const target = new THREE.Vector3();
    return {
      render: (frame) => {
        const t = frame / fps;
        const pose = rig(t);
        camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
        target.set(pose.target[0], pose.target[1], pose.target[2]);
        camera.up.set(0, 1, 0);
        camera.lookAt(target);
        camera.rotateZ(pose.roll);
        camera.updateMatrixWorld();
        pUniforms.uTime.value = t;
        pUniforms.uFocus.value = camera.position.distanceTo(target);
        bgUniforms.uTime.value = t;
        composer.render();
      },
      dispose: () => {
        composer.dispose();
        geo.dispose();
        quad.dispose();
        (field.material as THREE.Material).dispose();
        (bg.material as THREE.Material).dispose();
      },
    };
  };

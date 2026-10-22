import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { CreateStage } from "../gl/ThreeStage";
import { SIMPLEX_NOISE } from "../gl/noise";
import { buildOrbGeometry } from "./strands";
import { rgb } from "../gl/color";
import { envelope, lerp, smooth } from "../gl/timeline";
import type { OrbPalette } from "./palettes";

// Camera distance chosen so the unit sphere's radius spans 36% of frame height,
// matching the reference framing (30° vertical FOV).
const CAMERA_DISTANCE = 5.28;

const PARTICLE_VERT = /* glsl */ `
${SIMPLEX_NOISE}
uniform float uTime;
uniform float uPixel;
uniform float uFlare;
uniform float uFlareLat;
uniform float uFlareFront;
uniform vec3 uCore;
uniform vec3 uBlue;
uniform vec3 uViolet;
uniform vec3 uMagenta;
uniform vec3 uFlareColor;
uniform float uTendril;
attribute vec4 aInfo; // class, strand brightness, arc length, core-thread flag
attribute vec4 aRand;
varying vec3 vColor;

void main() {
  vec3 p = position;
  float rad = length(p);
  float cls = aInfo.x;

  // Low-frequency morph field: whole strands bend and drift together so the
  // pattern keeps evolving while each strand stays smooth.
  vec3 mq = p * 0.85 + vec3(0.0, -uTime * 0.11, uTime * 0.03);
  vec3 disp = vec3(
    snoise(mq),
    snoise(mq + vec3(13.1, 4.7, 0.0)),
    snoise(mq + vec3(0.0, 9.3, 27.4))
  ) * 0.26;
  p = normalize(p + disp) * rad;
  vec3 d = p / rad;

  vec3 nrm = normalize(normalMatrix * d);
  float front = smoothstep(-0.9, 0.9, nrm.z);
  float depthFade = mix(0.28, 1.0, front);
  float shell = smoothstep(0.93, 0.99, rad);
  float rim = pow(1.0 - abs(nrm.z), 3.0) * shell;

  // Strands slowly ignite and fade on their own cycles; energy pulses travel along them.
  float life = 0.5 + 0.5 * sin(uTime * (0.25 + 0.35 * aRand.y) + aRand.z * 6.2832);
  life = 0.25 + 0.75 * smoothstep(0.15, 0.75, life);
  float pulse = 0.6 + 0.4 * sin(aInfo.z * 7.0 - uTime * 2.4 + aRand.x * 6.2832);
  float twinkle = 0.65 + 0.35 * sin(uTime * 6.0 + aInfo.z * 113.0 + aRand.w * 40.0);
  // Strands converge at the poles; damp them there so the pole doesn't blow out.
  float pole = mix(0.35, 1.0, smoothstep(0.97, 0.8, abs(d.y)));
  float b = aInfo.y * life * pulse * pole * 1.85;

  vec3 col;
  if (cls < 0.5) {
    col = mix(uBlue * 0.26, uCore * 0.7, aInfo.w) * b;
  } else if (cls < 1.5) {
    col = mix(uViolet * 0.3, mix(uViolet, uMagenta, 0.4) * 0.4, aInfo.w) * b;
  } else if (cls < 2.5) {
    col = uMagenta * 0.38 * b;
  } else {
    float speck = smoothstep(0.0, 0.6, snoise(p * 3.2 + vec3(0.0, -uTime * 0.12, 0.0)));
    col = (aRand.y > 0.25 ? uMagenta : uViolet) * (0.09 + 0.42 * speck) * aInfo.y + mix(uBlue, uViolet, 0.4) * rim * 0.09;
    // Sparse cyan glints scattered through the volume.
    col += uCore * step(0.93, aRand.x) * speck * 0.35;
  }
  col *= twinkle;

  // Build-up: strands curling at the left limb brighten before the surge.
  float limb = smoothstep(-0.8, -0.97, nrm.x) * exp(-pow((nrm.y + 0.05) / 0.22, 2.0));
  col += uCore * uTendril * limb * (cls < 2.5 ? 0.35 : 0.03) * pulse;

  // Excitation band: a latitude ring on the shell that ignites from the left limb.
  float band = exp(-pow((nrm.y - uFlareLat) / 0.1, 2.0));
  float sweep = smoothstep(uFlareFront, uFlareFront - 0.35, nrm.x);
  col += uFlareColor * uFlare * band * sweep * (0.05 + 0.1 * aRand.w) * (1.0 - 0.6 * rim);

  col *= depthFade;
  float bright = max(col.r, max(col.g, col.b));

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float persp = ${CAMERA_DISTANCE.toFixed(2)} / -mv.z;
  gl_PointSize = bright < 0.003 ? 0.0 : uPixel * (1.5 + 3.2 * clamp(bright, 0.0, 0.5)) * persp;
  vColor = col;
}
`;

const PARTICLE_FRAG = /* glsl */ `
varying vec3 vColor;
void main() {
  float r = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.05, r);
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

// Background: deep gradient, halo behind the orb, faint vertical light
// streaks and the soft rays that rise from the top of the sphere.
const BG_FRAG = /* glsl */ `
${SIMPLEX_NOISE}
uniform float uTime;
uniform float uAspect;
uniform float uRays;
uniform vec3 uBgDeep;
uniform vec3 uBgGlow;
uniform vec3 uRayColor;
uniform vec3 uHaze;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
  float r = length(p);
  vec3 col = uBgDeep;
  col += uBgGlow * exp(-r * r / 0.12) * 0.85;
  col += uBgGlow * exp(-r * r / 0.6) * 0.25;
  // Luminous haze filling the orb's volume.
  col += uHaze * smoothstep(0.37, 0.0, r) * 0.22;

  float streak = snoise(vec3(p.x * 22.0, 0.0, uTime * 0.05)) * 0.5 + 0.5;
  col += uBgGlow * pow(streak, 4.0) * 0.10 * smoothstep(0.9, 0.0, abs(p.x));

  float above = smoothstep(0.18, 0.36, p.y);
  float rayN = snoise(vec3(p.x * 16.0, p.y * 1.3 - uTime * 0.35, uTime * 0.2)) * 0.5 + 0.5;
  float rays = pow(rayN, 3.0) * above * exp(-pow(p.x / 0.1, 2.0)) * smoothstep(0.5, 0.3, p.y);
  col += uRayColor * rays * uRays * 0.9;

  col *= mix(0.6, 1.0, smoothstep(1.25, 0.25, r));
  gl_FragColor = vec4(col, 1.0);
}
`;

// Anamorphic flare at the orb's left limb during the energy surge.
const FLARE_FRAG = /* glsl */ `
uniform float uAspect;
uniform float uIntensity;
uniform float uLength;
uniform vec2 uPos;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0) - uPos;
  float core = exp(-dot(p, p) / 0.0016) * 0.02;
  float halo = exp(-dot(p, p) / 0.014) * 0.2;
  float dx = p.x > 0.0 ? p.x / uLength : p.x / (uLength * 0.2);
  float streak = exp(-dx * dx - pow(p.y / 0.02, 2.0)) * 0.3;
  vec3 col = uColor * (core + halo + streak) * uIntensity;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const createOrbStage = (palette: OrbPalette): CreateStage => (renderer, width, height, fps) => {
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  const aspect = width / height;
  const pixel = height / 1080;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, aspect, 0.1, 100);
  camera.position.set(0, 0, CAMERA_DISTANCE);
  camera.lookAt(0, 0, 0);

  const quad = new THREE.PlaneGeometry(2, 2);
  const bgUniforms = {
    uTime: { value: 0 },
    uAspect: { value: aspect },
    uRays: { value: 0 },
    uBgDeep: { value: rgb(palette.bgDeep) },
    uBgGlow: { value: rgb(palette.bgGlow) },
    uRayColor: { value: rgb(palette.rays) },
    uHaze: { value: rgb(palette.haze) },
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

  const orbGeo = buildOrbGeometry(1110756441);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(orbGeo.positions, 3));
  geo.setAttribute("aInfo", new THREE.BufferAttribute(orbGeo.info, 4));
  geo.setAttribute("aRand", new THREE.BufferAttribute(orbGeo.rands, 4));
  const pUniforms = {
    uTime: { value: 0 },
    uPixel: { value: pixel },
    uFlare: { value: 0 },
    uFlareLat: { value: 0 },
    uFlareFront: { value: -1 },
    uCore: { value: rgb(palette.core) },
    uBlue: { value: rgb(palette.blue) },
    uViolet: { value: rgb(palette.violet) },
    uMagenta: { value: rgb(palette.magenta) },
    uFlareColor: { value: rgb(palette.flare) },
    uTendril: { value: 0 },
  };
  const orb = new THREE.Points(
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
  orb.frustumCulled = false;
  orb.renderOrder = 1;
  scene.add(orb);

  const flareUniforms = {
    uAspect: { value: aspect },
    uIntensity: { value: 0 },
    uLength: { value: 0.1 },
    uPos: { value: new THREE.Vector2(-0.36, -0.02) },
    uColor: { value: rgb(palette.flare) },
  };
  const flare = new THREE.Mesh(
    quad,
    new THREE.ShaderMaterial({
      uniforms: flareUniforms,
      vertexShader: QUAD_VERT,
      fragmentShader: FLARE_FRAG,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    }),
  );
  flare.frustumCulled = false;
  flare.renderOrder = 2;
  scene.add(flare);

  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(1);
  composer.setSize(width, height);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(width, height), 0.6, 0.5, 0.28));
  composer.addPass(new OutputPass());

  return {
    render: (frame) => {
      const t = frame / fps;
      // Slow spin with a gentle wobble of the axis.
      orb.rotation.set(0.14 + 0.05 * Math.sin(t * 0.4), t * 0.28 + 0.4, 0.06 * Math.sin(t * 0.3));

      // Energy surge: strands curl and brighten at the left limb (2.4–3.9 s),
      // then a wide band ignites across the lower orb, slides down and fades
      // by ~6.3 s.
      const surge = envelope(t, 3.0, 3.9, 5.1, 6.3);
      const lat = lerp(-0.12, -0.42, smooth(3.6, 6.3, t));
      pUniforms.uTime.value = t;
      pUniforms.uTendril.value = envelope(t, 2.4, 3.3, 3.7, 4.6);
      pUniforms.uFlare.value = surge;
      pUniforms.uFlareFront.value = lerp(-1.1, 1.25, smooth(3.2, 5.0, t));
      pUniforms.uFlareLat.value = lat;
      flareUniforms.uIntensity.value = envelope(t, 3.0, 3.9, 4.6, 6.0) * 0.75;
      flareUniforms.uLength.value = lerp(0.04, 0.2, smooth(3.0, 4.8, t));
      flareUniforms.uPos.value.set(-0.33, lat * 0.36);

      bgUniforms.uTime.value = t;
      bgUniforms.uRays.value =
        0.3 + [0, 1.5, 6, 9, 10.5, 12].reduce((sum, c) => sum + 0.6 * Math.exp(-(((t - c) / 0.55) ** 2)), 0);

      composer.render();
    },
    dispose: () => {
      composer.dispose();
      geo.dispose();
      quad.dispose();
      (orb.material as THREE.Material).dispose();
      (bg.material as THREE.Material).dispose();
      (flare.material as THREE.Material).dispose();
    },
  };
};

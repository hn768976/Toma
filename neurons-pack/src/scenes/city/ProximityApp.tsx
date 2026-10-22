import * as THREE from "three";
import colors from "../../../data/colors.json";
import counts from "../../../data/counts.json";
import { easeInOut, easeOut, smoothstep } from "../../lib/math";
import { mulberry32, range } from "../../lib/random";
import { GLStage, Stage, StageContext } from "../../lib/three/GLStage";
import { makeMapLayer } from "./mapLayer";
import { SPRITE, SpriteBuffer } from "./overlays";
import { PHONE, makePhone } from "./phone";
import { greenScreenMaterial, screenUiMaterial } from "./screenUi";

export const PROXIMITY_FRAMES = 570;
const FPS = 30;
const FOG = { near: 140, far: 420 };
const DISC_R = 30;
const ICON = 4.4;

// Icon timeline: 3 s to 15 s, one at a time.
const ICON_T0 = 3;
const ICON_T1 = 14.6;

const cameraAt = (t: number) => {
  const az = -0.42 + 0.84 * (t / (PROXIMITY_FRAMES / FPS));
  const el = (40 * Math.PI) / 180;
  const dist = 60;
  const target = new THREE.Vector3(0, 7.5, 0);
  const cam = new THREE.PerspectiveCamera(40, 16 / 9, 1, 2000);
  cam.position.set(target.x + Math.sin(az) * Math.cos(el) * dist, target.y + Math.sin(el) * dist, target.z + Math.cos(az) * Math.cos(el) * dist);
  cam.lookAt(target);
  cam.updateMatrixWorld();
  return cam;
};

const ICON_FRAG = /* glsl */ `
vec4 extraSprite(vec2 p, float kind) {
  // People icon: white ring, slate fill, white head-and-shoulders glyph.
  float px = fwidth(p.x) * 0.8 + 1e-5;
  float r = length(p);
  float outer = 1.0 - smoothstep(0.47 - px, 0.47 + px, r);
  if (outer <= 0.0) return vec4(0.0);
  float ring = smoothstep(0.38 - px, 0.38 + px, r);
  vec3 fill = pow(vec3(0.23, 0.26, 0.32), vec3(2.2));
  float head = 1.0 - smoothstep(0.11 - px, 0.11 + px, length(p - vec2(0.0, 0.1)));
  vec2 b = p - vec2(0.0, -0.2);
  float body = (1.0 - smoothstep(0.2 - px, 0.2 + px, length(b))) * step(-0.02, b.y + 0.0) ;
  body *= 1.0 - smoothstep(0.31 - px, 0.31 + px, r);
  float glyph = max(head, body);
  vec3 c = mix(fill, vec3(1.0), max(ring, glyph));
  return vec4(c, outer);
}`;

const makeBuild = (green: boolean) => (ctx: StageContext): Stage => {
  const { renderer } = ctx;
  const pal = colors.cityDay;
  const scene = new THREE.Scene();
  const map = makeMapLayer(pal, false, FOG);
  scene.add(map.group);

  // Translucent radius disc with a soft edge, pulsing.
  const discMat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    // Opaque pass (blended, no depth write): drawn before the phone, so it
    // can never wash over the screen.
    transparent: false,
    depthTest: false,
    depthWrite: false,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { uR: { value: DISC_R }, uT: { value: 0 }, uIn: { value: 0 } },
    vertexShader: /* glsl */ `
precision highp float;
in vec3 position;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec2 vP;
void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
precision highp float;
uniform float uR;
uniform float uT;
uniform float uIn;
in vec2 vP;
out vec4 outColor;
void main() {
  float r = length(vP);
  float R = uR * uIn * (1.0 + 0.012 * sin(uT * 2.4));
  float body = 1.0 - smoothstep(R - 3.5, R + 0.5, r);
  float edge = exp(-pow((r - R) / 1.0, 2.0)) * 0.55;
  // Ripples running out from the phone.
  float w = fract(uT / 3.0);
  float rip = exp(-pow((r - w * R) / 1.5, 2.0)) * (1.0 - w) * 0.18 * step(r, R);
  float a = clamp(0.42 * body + edge * uIn + rip, 0.0, 1.0);
  outColor = vec4(vec3(a), a);
}`,
  });
  const disc = new THREE.Mesh(new THREE.PlaneGeometry(DISC_R * 2.4, DISC_R * 2.4).rotateX(-Math.PI / 2), discMat);
  disc.renderOrder = 0;
  disc.frustumCulled = false;
  scene.add(disc);

  // Soft contact shadow.
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(PHONE.w * 2.2, PHONE.w * 1.1).rotateX(-Math.PI / 2),
    new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: false,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: /* glsl */ `
precision highp float;
in vec3 position;
in vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out vec2 vUv;
void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
precision highp float;
in vec2 vUv;
out vec4 outColor;
void main() {
  float d = length(vUv);
  float a = 0.38 * exp(-d * d * 3.2) * (1.0 - smoothstep(0.85, 1.0, d));
  outColor = vec4(0.0, 0.0, 0.0, a);
}`,
    }),
  );
  shadow.position.set(0, 0, 0.6);
  shadow.renderOrder = 1;
  shadow.frustumCulled = false;
  scene.add(shadow);

  const screenMat = green ? greenScreenMaterial() : screenUiMaterial();
  const phone = makePhone(colors.phone, screenMat);
  if (!green) (screenMat as THREE.RawShaderMaterial).uniforms.uAspect.value = phone.screenSize[0] / phone.screenSize[1];
  phone.group.position.set(0, PHONE.h / 2, 0);
  phone.group.traverse((o) => (o.renderOrder = 10));
  scene.add(phone.group);

  // Icons: mostly inside the disc, a few outside.
  const rng = mulberry32(0x9a7e);
  const n = counts.proximity.icons;
  const icons: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const outside = i % 8 === 5;
    for (let tries = 0; tries < 400; tries++) {
      const a = rng() * Math.PI * 2;
      const r = outside ? range(rng, DISC_R * 1.08, DISC_R * 1.35) : DISC_R * Math.sqrt(range(rng, 0.06, 0.92));
      const p = new THREE.Vector3(Math.cos(a) * r, 2.2, Math.sin(a) * r);
      // Keep clear of the phone and of other icons.
      if (Math.hypot(p.x, p.z) < 12) continue;
      if (icons.some((q) => q.distanceTo(p) < ICON * 1.25)) continue;
      icons.push(p);
      break;
    }
  }
  const iconTime = icons.map((_, i) => ICON_T0 + (i / (icons.length - 1)) * (ICON_T1 - ICON_T0));

  const sprites = new SpriteBuffer(256, "#FFFFFF", pal.haze, { extraFrag: ICON_FRAG });
  sprites.mesh.renderOrder = 5;
  scene.add(sprites.mesh);

  // Lines from the phone to each new icon: camera-facing ribbons.
  const maxLines = 64;
  const lineGeo = new THREE.BufferGeometry();
  const linePos = new Float32Array(maxLines * 4 * 3);
  const lineA = new Float32Array(maxLines * 4);
  const lineIdx: number[] = [];
  for (let i = 0; i < maxLines; i++) lineIdx.push(4 * i, 4 * i + 1, 4 * i + 2, 4 * i, 4 * i + 2, 4 * i + 3);
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  lineGeo.setAttribute("aAlpha", new THREE.BufferAttribute(lineA, 1));
  lineGeo.setIndex(lineIdx);
  lineGeo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
  const lineMesh = new THREE.Mesh(
    lineGeo,
    new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      vertexShader: /* glsl */ `
precision highp float;
in vec3 position;
in float aAlpha;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
out float vA;
void main() { vA = aAlpha; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
precision highp float;
in float vA;
out vec4 outColor;
void main() { outColor = vec4(vec3(vA), vA); }`,
    }),
  );
  lineMesh.renderOrder = 4;
  lineMesh.frustumCulled = false;
  scene.add(lineMesh);

  return {
    render: (frame, target) => {
      const t = frame / FPS;
      const cam = cameraAt(t);
      const right = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const up = new THREE.Vector3().setFromMatrixColumn(cam.matrixWorld, 1);
      map.update(cam.position);
      discMat.uniforms.uT.value = t;
      discMat.uniforms.uIn.value = easeOut(smoothstep(0.2, 2.6, t));
      // Phone turns to keep facing the camera's general direction.
      phone.group.rotation.y = 0;
      if (!green) {
        const u = (screenMat as THREE.RawShaderMaterial).uniforms;
        u.uT.value = t;
        u.uCount.value = icons.reduce((a, _, i) => a + smoothstep(iconTime[i], iconTime[i] + 0.45, t), 0);
      }
      sprites.material.uniforms.uRight.value.copy(right);
      sprites.material.uniforms.uUp.value.copy(up);
      sprites.material.uniforms.uCam.value.copy(cam.position);
      sprites.material.uniforms.uFog.value.set(FOG.near, FOG.far);
      sprites.reset();
      let nl = 0;
      linePos.fill(0);
      lineA.fill(0);
      // Lines leave from the phone's foot, along the ground, so nothing
      // ever crosses the screen.
      const origin = new THREE.Vector3(0, 0.25, 0.2);
      icons.forEach((p, i) => {
        const a = t - iconTime[i];
        if (a < 0) return;
        const shoot = easeInOut(Math.min(1, a / 0.35));
        const pop = a < 0.35 ? 0 : easeOut(Math.min(1, (a - 0.35) / 0.25));
        const bob = 1 + 0.25 * Math.sin(Math.min(1, (a - 0.35) / 0.4) * Math.PI) * (a > 0.35 ? 1 : 0);
        if (pop > 0) sprites.push(p, ICON * pop * bob, SPRITE.icon + 0.0, 1);
        const fade = a < 0.35 ? 1 : Math.max(0, 1 - (a - 0.35) / 1.1);
        if (fade > 0 && nl < maxLines) {
          const end = origin.clone().lerp(p, shoot);
          const dir = end.clone().sub(origin);
          const view = cam.position.clone().sub(origin.clone().add(end).multiplyScalar(0.5)).normalize();
          const side = dir.clone().cross(view).normalize().multiplyScalar(0.12);
          const q = [origin.clone().sub(side), origin.clone().add(side), end.clone().add(side), end.clone().sub(side)];
          q.forEach((v, k) => linePos.set([v.x, v.y, v.z], (4 * nl + k) * 3));
          for (let k = 0; k < 4; k++) lineA[4 * nl + k] = 0.85 * fade;
          nl++;
        }
      });
      (lineGeo.getAttribute("position") as THREE.BufferAttribute).needsUpdate = true;
      (lineGeo.getAttribute("aAlpha") as THREE.BufferAttribute).needsUpdate = true;
      sprites.commit();
      renderer.setRenderTarget(target);
      renderer.setClearColor(new THREE.Color(pal.haze), 1);
      renderer.clear(true, true, true);
      renderer.render(scene, cam);
    },
  };
};

const buildCity = makeBuild(false);
const buildGreen = makeBuild(true);

export const ProximityApp_City: React.FC = () => <GLStage build={buildCity} background={colors.cityDay.haze} />;
export const ProximityApp_GreenScreen: React.FC = () => <GLStage build={buildGreen} background={colors.cityDay.haze} />;

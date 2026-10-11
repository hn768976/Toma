import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { linear, linearColor } from "../lib/color";
import { FullscreenPass, makeTarget } from "../lib/post";
import { wrapFrame } from "../lib/loop";
import { FramePipeline } from "../lib/ThreeStage";
import { DEPTH, MAP, MAP_WIDTH } from "./mapData";

export interface MapPalette {
  top: string;
  sides: string;
  edge: string;
  edgeOpacity: number;
  bgCenter: string;
  bgEdge: string;
  shadowColor: string;
  shadowStrength: number;
  keyIntensity: number;
  fillIntensity: number;
  envIntensity: number;
  rimIntensity: number; // cool rim light from upper right (graphite)
  rimColor: string;
  vignette: number;
}

const STORY = 450;
const FALL = 22; // frames
const HOP = 9; // frames
const DROP_H = 0.25 * MAP_WIDTH;
const HOP_H = 0.02 * DROP_H;
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export const dropState = (frame: number, start: number) => {
  const u = (frame - start) / FALL;
  if (u < 0) return { y: DROP_H, opacity: 0 };
  if (u < 1) return { y: DROP_H * (1 - easeOutCubic(u)), opacity: smooth(clamp01(u * 3)) };
  const h = (frame - start - FALL) / HOP;
  if (h < 1) return { y: HOP_H * Math.sin(Math.PI * h) * (1 - 0.3 * h), opacity: 1 };
  return { y: 0, opacity: 1 };
};

const BG_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform vec3 uCenter, uEdge; // linear
uniform float uAspect;
void main() {
  vec2 q = (vUv - vec2(0.5, 0.55)) * vec2(uAspect, 1.0);
  float d = length(q * vec2(0.62, 1.0));
  float t = smoothstep(0.45, 1.6, d);
  outColor = vec4(mix(uCenter, uEdge, t), 1.0);
}
`;

const SHADOW_DEPTH_VERT = /* glsl */ `
out float vH;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vH = wp.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const SHADOW_DEPTH_FRAG = /* glsl */ `
in float vH;
out vec4 outColor;
void main() {
  float h = max(vH, 0.0);
  outColor = vec4(exp(-h / 0.12), exp(-h / 1.1), 0.0, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uTex;
uniform vec2 uDir;     // one texel along the blur axis
uniform float uStepT;  // texels per tap, tight channel
uniform float uStepW;  // texels per tap, wide channel
void main() {
  float t = 0.0, w = 0.0, ws = 0.0;
  for (int i = -12; i <= 12; i++) {
    float fi = float(i);
    float g = exp(-fi * fi / 32.0);
    t += texture(uTex, vUv + uDir * fi * uStepT).r * g;
    w += texture(uTex, vUv + uDir * fi * uStepW).g * g;
    ws += g;
  }
  outColor = vec4(t / ws, w / ws, 0.0, 1.0);
}
`;

const FLOOR_VERT = /* glsl */ `
out vec4 vShadowPos;
out vec4 vShadowPosW;
uniform mat4 uShadowMat;
uniform vec2 uWideShift;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vShadowPos = uShadowMat * wp;
  vShadowPosW = uShadowMat * (wp - vec4(uWideShift.x, 0.0, uWideShift.y, 0.0));
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const FLOOR_FRAG = /* glsl */ `
in vec4 vShadowPos;
in vec4 vShadowPosW;
out vec4 outColor;
uniform sampler2D uShadow;
uniform vec3 uShadowColor;
uniform float uStrength;
void main() {
  vec2 uv = vShadowPos.xy / vShadowPos.w * 0.5 + 0.5;
  vec2 uvw = vShadowPosW.xy / vShadowPosW.w * 0.5 + 0.5;
  float tight = texture(uShadow, uv).r;
  float wide = texture(uShadow, uvw).g;
  float a = clamp(tight * 0.14 + wide * 0.7, 0.0, 1.0) * uStrength;
  outColor = vec4(uShadowColor, a);
}
`;

const FINAL_FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform float uFrame;
uniform float uVignette;
uniform float uAspect;
void main() {
  vec3 c = texture(uScene, vUv).rgb;
  vec2 q = (vUv - 0.5) * vec2(uAspect, 1.0);
  c *= 1.0 - uVignette * smoothstep(0.45, 1.25, length(q));
  c = linearToSrgb(c);
  c = grainDither(c, gl_FragCoord.xy, uFrame, 0.015);
  outColor = vec4(c, 1.0);
}
`;

export const createMapPipeline =
  (pal: MapPalette) =>
  (renderer: THREE.WebGLRenderer, bw: number, bh: number): FramePipeline => {
    const aspect = bw / bh;
    const scene = new THREE.Scene();

    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = pal.envIntensity;

    // Background sweep as a full-screen quad drawn first.
    const bgMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: `out vec2 vUv; void main(){ vUv = position.xy*0.5+0.5; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
      fragmentShader: BG_FRAG,
      uniforms: { uCenter: { value: linear(pal.bgCenter) }, uEdge: { value: linear(pal.bgEdge) }, uAspect: { value: aspect } },
      depthWrite: false,
      depthTest: false,
    });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), bgMat);
    bg.frustumCulled = false;
    bg.renderOrder = -10;
    scene.add(bg);

    // Lights.
    const key = new THREE.DirectionalLight(new THREE.Color().setRGB(0.93, 0.96, 1.0), pal.keyIntensity);
    key.position.set(-6, 10, 3.5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffffff, pal.fillIntensity);
    fill.position.set(5, 4, 8);
    scene.add(fill);
    if (pal.rimIntensity > 0) {
      const rim = new THREE.DirectionalLight(linearColor(pal.rimColor), pal.rimIntensity);
      rim.position.set(8, 5, -6);
      scene.add(rim);
    }

    // States.
    const mapGroup = new THREE.Group();
    scene.add(mapGroup);
    const edgeColor = linearColor(pal.edge);
    const meshes = MAP.states.map((st) => {
      const topMat = new THREE.MeshStandardMaterial({ color: linearColor(pal.top), roughness: 0.6, metalness: 0 });
      const sideMat = new THREE.MeshStandardMaterial({ color: linearColor(pal.sides), roughness: 0.6, metalness: 0 });
      const edgeMat = new THREE.MeshBasicMaterial({ color: edgeColor, transparent: true, opacity: pal.edgeOpacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const body = new THREE.Mesh(st.body, [topMat, sideMat]);
      const cap = new THREE.Mesh(st.cap, topMat);
      const edge = new THREE.Mesh(st.edge, edgeMat);
      const g = new THREE.Group();
      g.add(body, cap, edge);
      const seamMat = new THREE.MeshBasicMaterial({ color: edgeColor, transparent: true, opacity: 1 });
      if (st.seam) g.add(new THREE.Mesh(st.seam, seamMat));
      mapGroup.add(g);
      return { st, g, topMat, sideMat, edgeMat, seamMat };
    });

    // Contact shadow: render heights from below, blur, project on the floor.
    const SW = 1024;
    const shadowHalfX = MAP_WIDTH * 0.68;
    const shadowHalfZ = MAP.mapDepth * 0.5 + MAP_WIDTH * 0.18;
    const SH = Math.round((SW * shadowHalfZ) / shadowHalfX);
    const shadowCam = new THREE.OrthographicCamera(-shadowHalfX, shadowHalfX, shadowHalfZ, -shadowHalfZ, 0, 10);
    shadowCam.position.set(0, -0.001, 0);
    shadowCam.up.set(0, 0, -1);
    shadowCam.lookAt(0, 1, 0);
    shadowCam.updateMatrixWorld();
    const shadowDepthMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: SHADOW_DEPTH_VERT,
      fragmentShader: SHADOW_DEPTH_FRAG,
      side: THREE.DoubleSide,
    });
    const shadowScene = new THREE.Scene();
    shadowScene.background = new THREE.Color(0, 0, 0);
    const shadowRT = makeTarget(SW, SH, { depthBuffer: true });
    const blurA = makeTarget(SW, SH);
    const blurB = makeTarget(SW, SH);
    const blur = new FullscreenPass(BLUR_FRAG, {
      uTex: { value: null },
      uDir: { value: new THREE.Vector2() },
      uStepT: { value: 0.55 },
      uStepW: { value: 10.0 },
    });
    const shadowMat = new THREE.Matrix4().multiplyMatrices(shadowCam.projectionMatrix, shadowCam.matrixWorldInverse);
    const floorMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FLOOR_VERT,
      fragmentShader: FLOOR_FRAG,
      uniforms: {
        uShadow: { value: blurB.texture },
        uShadowMat: { value: shadowMat },
        uWideShift: { value: new THREE.Vector2(0.12, 0.16) },
        uShadowColor: { value: linear(pal.shadowColor) },
        uStrength: { value: pal.shadowStrength },
      },
      transparent: true,
      depthWrite: false,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(shadowHalfX * 2, shadowHalfZ * 2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.renderOrder = -5;
    scene.add(floor);

    // Camera.
    const camera = new THREE.PerspectiveCamera(34, aspect, 0.1, 200);
    const sceneRT = makeTarget(bw, bh, { depthBuffer: true, samples: 4 });
    const final = new FullscreenPass(FINAL_FRAG, {
      uScene: { value: sceneRT.texture },
      uFrame: { value: 0 },
      uVignette: { value: pal.vignette },
      uAspect: { value: aspect },
    });

    const target = new THREE.Vector3(-0.2, DEPTH * 0.5, 0.4);
    const ELEV = (50 * Math.PI) / 180;
    const BASE_DIST = 12.6;

    return {
      render: (frame) => {
        const f = wrapFrame(frame, STORY);
        for (const m of meshes) {
          const d = dropState(f, m.st.dropStart);
          m.g.position.y = d.y;
          m.g.visible = d.opacity > 0.001;
          const transparent = d.opacity < 0.999;
          for (const mat of [m.topMat, m.sideMat]) {
            if (mat.transparent !== transparent) {
              mat.transparent = transparent;
              mat.needsUpdate = true;
            }
            mat.opacity = d.opacity;
          }
          m.edgeMat.opacity = pal.edgeOpacity * d.opacity;
          m.seamMat.opacity = d.opacity;
        }

        // Hold: ease in ~6% and drift right.
        const hold = smooth(clamp01((f - 195) / (STORY - 1 - 195)));
        const dist = BASE_DIST * (1 - 0.06 * hold);
        const drift = 0.22 * hold;
        camera.position.set(target.x + drift, target.y + dist * Math.sin(ELEV), target.z + dist * Math.cos(ELEV));
        camera.lookAt(target.x + drift * 0.85, target.y, target.z);

        // Shadow heights.
        shadowScene.overrideMaterial = shadowDepthMat;
        shadowScene.add(mapGroup);
        renderer.setRenderTarget(shadowRT);
        renderer.setClearColor(0x000000, 1);
        renderer.clear();
        renderer.render(shadowScene, shadowCam);
        scene.add(mapGroup);
        // Separable blur, two iterations.
        let src = shadowRT;
        const dst = [blurA, blurB];
        for (let it = 0; it < 2; it++) {
          blur.uniforms.uTex.value = src.texture;
          blur.uniforms.uDir.value.set(1 / SW, 0);
          blur.render(renderer, dst[0]);
          blur.uniforms.uTex.value = dst[0].texture;
          blur.uniforms.uDir.value.set(0, 1 / SH);
          blur.render(renderer, dst[1]);
          src = dst[1];
        }

        renderer.setRenderTarget(sceneRT);
        renderer.render(scene, camera);
        final.uniforms.uFrame.value = f;
        final.render(renderer, null);
      },
    };
  };



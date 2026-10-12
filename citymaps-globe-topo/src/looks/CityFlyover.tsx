// Look 2 — City Flyover (3D). A glowing street map on a ground plane, camera
// ~30° above it, gliding exactly one tile period in 600 frames with a closed
// ±5° yaw. Strong depth of field focused ~40% up the frame.

import React, { useMemo } from "react";
import { AbsoluteFill } from "remotion";
import * as THREE from "three";
import { getCity, getCityCanvas, makeCityTexture } from "../city/assets";
import { CityStyle } from "../city/draw";
import { vec3Of } from "../gl/fullscreen";
import { PostFX } from "../gl/post";
import { Stage, StageFactory } from "../gl/Stage";
import { LOOP, phase } from "../lib/loop";
import { hash01 } from "../lib/random";
import { CityFlyoverPalette } from "../versions";

export interface CityFlyoverProps {
  citySeed: number;
  palette: CityFlyoverPalette;
}

const TEX = 8192;
const PITCH = (30 * Math.PI) / 180;
const FOV = 40;
const ALT = 1350; // metres
const YAW0 = (-58 * Math.PI) / 180;
const N_PILLS = 7;

const VERT = /* glsl */ `
precision highp float;
uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;
in vec3 position;
out vec3 vWorld;
out float vZ;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 v = viewMatrix * w;
  vZ = -v.z;
  gl_Position = projectionMatrix * v;
}`;

const FRAG = /* glsl */ `
precision highp float;
in vec3 vWorld;
in float vZ;
out vec4 fragColor;
uniform sampler2D tMap;
uniform float uW;
uniform float uGain;
uniform vec3 uGround;
uniform float uFocus;
uniform float uCocA;     // coc (fraction of max) = uCocA * |z - f| / z
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uPin;       // world position of the pin
uniform vec3 uPinCol;
uniform float uPinT;     // ring cycle phase 0..1
uniform vec3 uPillA;     // first pill (world)
uniform vec3 uPillB;     // last pill (world)
uniform vec3 uPillCol0;
uniform vec3 uPillCol1;
uniform vec3 uPillCol2;
uniform vec3 uPin2;
uniform float uPillOn[${N_PILLS}];
float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}
void main() {
  vec2 uv = vWorld.xz / uW;
  vec3 col = texture(tMap, uv).rgb * uGain;

  // pin: glowing dot with two expanding rings
  vec2 dp = vWorld.xz - uPin.xz;
  float d = length(dp);
  float aa = max(fwidth(d), 1e-3);
  float core = 1.0 - smoothstep(19.0 - aa, 19.0 + aa, d);
  float glow = exp(-d * d / (2.0 * 48.0 * 48.0));
  // a second, fainter pin far away (upper right)
  float d2 = length(vWorld.xz - uPin2.xz);
  col += uPinCol * (0.8 * (1.0 - smoothstep(24.0, 32.0, d2)) + 0.35 * exp(-d2 * d2 / (2.0 * 70.0 * 70.0)));
  col += uPinCol * (core * 1.6 + glow * 0.55);
  for (int i = 0; i < 2; i++) {
    float t = fract(uPinT + float(i) * 0.5);
    float r = mix(24.0, 180.0, t);
    float ring = 1.0 - smoothstep(0.0, 2.5 + aa, abs(d - r) - 1.5);
    col += uPinCol * ring * (1.0 - t) * 0.9;
  }

  // dashed pills lined up along a direction (lower left)
  vec2 ab = uPillB.xz - uPillA.xz;
  vec2 dir = normalize(ab);
  vec2 nrm = vec2(-dir.y, dir.x);
  for (int i = 0; i < ${N_PILLS}; i++) {
    vec2 c = uPillA.xz + ab * (float(i) / float(${N_PILLS - 1}));
    vec2 p = vWorld.xz - c;
    vec2 q = vec2(dot(p, dir), dot(p, nrm));
    float sd = sdRoundBox(q, vec2(60.0, 16.0), 14.0);
    float a = 1.0 - smoothstep(-fwidth(sd), fwidth(sd), sd);
    float halo = exp(-max(sd, 0.0) / 16.0) * 0.25;
    vec3 pc = (i % 3 == 2) ? uPillCol1 : (i == 0 ? uPillCol2 : uPillCol0);
    col = mix(col, pc * 1.35, a * uPillOn[i]);
    col += pc * halo * uPillOn[i];
  }

  // fog toward the horizon
  float fog = smoothstep(uFogNear, uFogFar, vZ);
  col = mix(col, uGround * 0.6, fog);
  float coc = clamp(uCocA * abs(vZ - uFocus) / vZ, 0.0, 1.0);
  fragColor = vec4(col, coc);
}`;

export const cityFlyoverStyle = (p: CityFlyoverPalette): CityStyle => ({
  size: TEX,
  ground: p.ground,
  widths: [10.5, 14, 19],
  colors: [p.local, p.avenue, p.avenue],
  alphas: [0.6, 1, 1],
  water: "#000000",
  park: "#000000",
  lot: "#000000",
  rail: p.local,
  halo: { color: p.avenue, width: 50, alpha: 0.22 },
  labels: { color: p.label, alpha: 0.75, angle: -YAW0 },
});

// ray from camera through NDC point -> ground (y = 0)
const groundHit = (cam: THREE.PerspectiveCamera, nx: number, ny: number) => {
  const v = new THREE.Vector3(nx, ny, 0.5).unproject(cam);
  const dir = v.sub(cam.position).normalize();
  const t = -cam.position.y / dir.y;
  return cam.position.clone().add(dir.multiplyScalar(t));
};

const makeFactory =
  (props: CityFlyoverProps): StageFactory =>
  ({ renderer, width, height }) => {
    const city = getCity(props.citySeed);
    const W = city.W;
    const tex = makeCityTexture(renderer, getCityCanvas(props.citySeed, cityFlyoverStyle(props.palette)));
    const pal = props.palette;
    const mat = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        tMap: { value: tex },
        uW: { value: W },
        uGain: { value: 1.4 },
        uGround: { value: vec3Of(pal.ground) },
        uFocus: { value: 1000 },
        uCocA: { value: 1 },
        uFogNear: { value: 4500 },
        uFogFar: { value: 12000 },
        uPin: { value: new THREE.Vector3() },
        uPinCol: { value: vec3Of(pal.pin) },
        uPinT: { value: 0 },
        uPillA: { value: new THREE.Vector3() },
        uPillB: { value: new THREE.Vector3() },
        uPillCol0: { value: vec3Of(pal.pillA) },
        uPillCol1: { value: vec3Of(pal.pillB) },
        uPillCol2: { value: vec3Of(pal.avenue) },
        uPin2: { value: new THREE.Vector3() },
        uPillOn: { value: new Array(N_PILLS).fill(1) },
      },
      depthTest: true,
      depthWrite: true,
    });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.scale.set(40000, 40000, 1);
    plane.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(plane);
    const cam = new THREE.PerspectiveCamera(FOV, width / height, 50, 40000);
    cam.rotation.order = "YXZ";

    // start so the view centre sits near downtown
    const start = city.districts[0].seed;
    const post = new PostFX(width, height, {
      dof: { cocMaxFrac: 0.02 },
      bloom: { strength: 0.4, threshold: 0.7, knee: 0.35, radius: 1 },
      vignette: 0.55,
      grain: 0.015,
    });
    return {
      render(r, f) {
        const yaw = YAW0 + ((5 * Math.PI) / 180) * Math.sin(phase(f, 1));
        const travel = (W * f) / LOOP; // exactly one tile in 600 frames
        cam.rotation.set(-PITCH, yaw, 0);
        // ground distance from camera to the view centre
        const fwd = ALT / Math.tan(PITCH);
        const fx = -Math.sin(yaw);
        const fz = -Math.cos(yaw);
        cam.position.set(start.x - fx * fwd + travel, ALT, start.y - fz * fwd);
        cam.updateMatrixWorld(true);
        plane.position.set(cam.position.x, 0, cam.position.z);

        // focus ~40% up the frame
        const focusPt = groundHit(cam, 0, -0.2);
        const toF = focusPt.clone().sub(cam.position);
        const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
        const zf = toF.dot(camDir);
        const u = mat.uniforms;
        u.uFocus.value = zf;
        u.uCocA.value = 0.75;

        // pin upper middle, pills lower left: anchored to the view
        u.uPin.value.copy(groundHit(cam, 0.02, 0.3));
        u.uPinT.value = (f % 150) / 150;
        u.uPin2.value.copy(groundHit(cam, 0.55, 0.82));
        u.uPillA.value.copy(groundHit(cam, -0.98, -0.18));
        u.uPillB.value.copy(groundHit(cam, -0.62, -0.86));
        for (let i = 0; i < N_PILLS; i++) {
          u.uPillOn.value[i] = hash01(Math.floor(f / 5), i, 17) < 0.82 ? 1 : 0.35;
        }
        post.render(r, f, (rr) => rr.render(scene, cam));
      },
      dispose() {
        tex.dispose();
        mat.dispose();
        plane.geometry.dispose();
        post.dispose();
      },
    };
  };

export const CityFlyover: React.FC<CityFlyoverProps> = (props) => {
  const key = JSON.stringify(props);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const factory = useMemo(() => makeFactory(props), [key]);
  return (
    <AbsoluteFill style={{ background: "#000" }}>
      <Stage factory={factory} />
    </AbsoluteFill>
  );
};

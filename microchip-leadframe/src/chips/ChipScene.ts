import * as THREE from "three";
import { sampleLinear, sampleTrack, Track } from "../engine/keyframes";
import { clamp, lerp, makeRng } from "../engine/math";
import { PostPipeline, defaultPostParams } from "../engine/post";
import type { StageArgs, StageController } from "../engine/ThreeStage";
import { buildBrushedTexture, buildDieTexture } from "./dieTexture";
import { buildEnvironment } from "./environment";
import {
  bondPads,
  buildUnitGeometry,
  DIE_HALF,
  DIE_HEIGHT,
  railDimples,
  tieBars,
  UNIT,
} from "./leadframe";
import type { ChipLook } from "./looks";

const GRID = 3; // units from -GRID..GRID in both directions

// Lighting timeline, keyed in seconds.

const ENV_INTENSITY: Track = [
  [0, 1.12],
  [6, 1.05],
  [7.4, 0.95],
  [12.04, 0.95],
];
/** 1 = cool blue grade of the opening, 0 = neutral steel of the ending. */
const COOLNESS: Track = [
  [0, 1],
  [3, 0.9],
  [6, 0.5],
  [7.5, 0.25],
  [12.04, 0.08],
];
/** Brightness / saturation of the thin-film colours on the dies. */
const DIE_LEVEL: Track = [
  [0, 1.05],
  [4, 1.1],
  [5.4, 1.3],
  [6.6, 0.9],
  [8, 0.66],
  [12.04, 0.56],
];
const DIE_SAT: Track = [
  [0, 0.72],
  [5.4, 0.85],
  [8, 0.6],
  [12.04, 0.45],
];

/**
 * Lean brushed-metal shader: a blurry mip of the environment cube map for the
 * reflection plus one analytic GGX highlight from the travelling light.
 * Works for instanced and regular meshes.
 */
const METAL_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vN;
void main() {
  #ifdef USE_INSTANCING
    mat4 m = modelMatrix * instanceMatrix;
  #else
    mat4 m = modelMatrix;
  #endif
  vec4 wp = m * vec4(position, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const METAL_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vN;
uniform samplerCube tEnv;
uniform sampler2D tBrushed;
uniform float uEnvLod;
uniform float uEnvIntensity;
uniform vec3 uF0;
uniform float uRough;
uniform vec3 uLightPos;
uniform float uLightPower;
uniform float uWallShade;
uniform vec2 uEnvRot; // cos, sin of the environment yaw
uniform float uGlint;

void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0) N = -N;
  float ndv = max(dot(N, V), 1e-3);
  vec3 R = reflect(-V, N);

  // brushed finish: streaks modulate roughness and reflectance a little
  float b = texture2D(tBrushed, vWorld.xz * 0.11).g;
  float rough = clamp(uRough * (0.82 + 0.36 * b), 0.05, 1.0);

  vec3 F = uF0 + (1.0 - uF0) * pow(1.0 - ndv, 5.0);
  vec3 Re = vec3(R.x * uEnvRot.x - R.z * uEnvRot.y, R.y, R.x * uEnvRot.y + R.z * uEnvRot.x);
  vec3 env = textureLod(tEnv, Re, uEnvLod + (b - 0.5) * 0.8).rgb * uEnvIntensity;

  vec3 Lv = uLightPos - vWorld;
  float d2 = dot(Lv, Lv);
  vec3 L = Lv * inversesqrt(d2);
  vec3 H = normalize(L + V);
  float ndl = max(dot(N, L), 0.0);
  float ndh = max(dot(N, H), 0.0);
  float a = rough * rough;
  float a2 = a * a;
  float dd = ndh * ndh * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159265 * dd * dd);
  float k = a * 0.5;
  float G = (ndl / (ndl * (1.0 - k) + k)) * (ndv / (ndv * (1.0 - k) + k));
  vec3 spec = F * (D * G / max(4.0 * ndl * ndv, 1e-3)) * ndl * uLightPower / d2;

  vec3 col = F * env * (0.93 + 0.14 * b) + spec;
  // tiny mirror image of a small, very bright lamp: turns into bokeh discs
  // wherever the part is out of focus
  col += F * uGlint * pow(max(dot(R, normalize(vec3(0.25, 0.86, -0.45))), 0.0), 1400.0);
  // side walls of the stamped openings sit in their own shadow
  float wall = 1.0 - smoothstep(0.2, 0.7, N.y);
  col *= mix(1.0, uWallShade, wall * smoothstep(0.0, -0.2, vWorld.y + 0.02));
  gl_FragColor = vec4(col, 1.0);
}
`;

const DIE_SIDE_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWorld;
varying vec3 vN;
varying vec2 vUv;
uniform samplerCube tEnv;
uniform sampler2D tSide;
uniform float uEnvIntensity;
uniform float uSideLevel;
uniform vec2 uEnvRot;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWorld);
  vec3 R = reflect(-V, N);
  vec3 tx = texture2D(tSide, vUv).rgb;
  // ground silicon: a soft reflection of the room plus light scattered
  // back from the bright sheet right in front of it
  vec3 Re = vec3(R.x * uEnvRot.x - R.z * uEnvRot.y, abs(R.y), R.x * uEnvRot.y + R.z * uEnvRot.x);
  vec3 env = textureLod(tEnv, Re, 3.5).rgb * uEnvIntensity;
  // only the flank that faces the key side of the room lights up
  float facing = mix(0.22, 1.0, smoothstep(0.3, 0.9, N.x));
  vec3 col = tx * (env * 0.5 + vec3(uSideLevel) * facing);
  gl_FragColor = vec4(col, 1.0);
}
`;

const DIE_SIDE_VERT = /* glsl */ `
varying vec3 vWorld;
varying vec3 vN;
varying vec2 vUv;
void main() {
  vUv = uv;
  mat4 m = modelMatrix * instanceMatrix;
  vec4 wp = m * vec4(position, 1.0);
  vWorld = wp.xyz;
  vN = normalize(mat3(m) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const DIE_TOP_VERT = /* glsl */ `
attribute float aPhase;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vCentre;
varying float vPhase;
void main() {
  vUv = uv;
  vPhase = aPhase;
  mat4 m = modelMatrix * instanceMatrix;
  vec4 wp = m * vec4(position, 1.0);
  vWorld = wp.xyz;
  vCentre = (m * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const DIE_TOP_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vCentre;
varying float vPhase;
uniform sampler2D tDie;
uniform vec3 uCamRight;
uniform float uLevel;
uniform float uSat;
uniform vec3 uSky;
uniform vec3 uLightPos;
uniform float uLightPower;

// Thin-film interference ramp: violet -> blue -> cyan -> green -> violet.
vec3 film(float t) {
  t = fract(t);
  vec3 violet = vec3(0.34, 0.17, 0.86);
  vec3 blue = vec3(0.06, 0.27, 0.88);
  vec3 cyan = vec3(0.05, 0.62, 0.84);
  vec3 green = vec3(0.14, 0.76, 0.46);
  vec3 c = mix(violet, blue, smoothstep(0.0, 0.3, t));
  c = mix(c, cyan, smoothstep(0.3, 0.6, t));
  c = mix(c, green, smoothstep(0.6, 0.85, t));
  c = mix(c, violet, smoothstep(0.88, 1.0, t));
  return c;
}

void main() {
  vec4 tx = texture2D(tDie, vUv);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndv = clamp(V.y, 0.0, 1.0);

  // The hue slides across the die along the screen-horizontal direction,
  // like a real oxide film seen under an extended light source.
  float across = dot(vWorld.xz - vCentre.xz, uCamRight.xz) / (${DIE_HALF.toFixed(2)} * 1.25);
  float toward = dot(vWorld.xz - vCentre.xz, vec2(-uCamRight.z, uCamRight.x)) / (${DIE_HALF.toFixed(2)} * 1.25);
  float t = -0.06 + 0.46 * (across + 1.0) - 0.12 * toward + 0.09 * (tx.b - 0.5) + vPhase + 0.1 * (1.0 - ndv);
  vec3 base = film(t);

  vec3 col = base * base * (0.22 + 0.95 * tx.r * tx.r);
  col += base * tx.g * 0.16 + vec3(tx.g) * 0.012;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSat) * uLevel;

  // Glossy top coat reflecting the room.
  float fres = 0.05 + 0.95 * pow(1.0 - ndv, 5.0);
  col += uSky * (0.015 + 0.4 * fres);

  // Glint of the travelling light.
  vec3 L = normalize(uLightPos - vWorld);
  vec3 H = normalize(L + V);
  col += vec3(1.0) * pow(max(H.y, 0.0), 420.0) * 0.35 * uLightPower;
  gl_FragColor = vec4(col, 1.0);
}
`;

const WIPE_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uAmount;   // 0..1 envelope
uniform float uProgress; // 0..1 travel of the panes, right -> left
uniform float uAspect;

// soft-edged slab of out-of-focus glass
float pane(vec2 p, float cx, float halfW, float soft, float skew, float y0, float y1) {
  float x = p.x - cx - (p.y - 0.5) * skew;
  float a = smoothstep(halfW + soft, halfW - soft, abs(x));
  a *= smoothstep(y0 - 0.12, y0 + 0.12, p.y) * smoothstep(y1 + 0.12, y1 - 0.12, p.y);
  return a;
}

void main() {
  vec2 p = vUv;
  float x0 = mix(1.3, -0.7, uProgress);
  float a1 = pane(p, x0, 0.17, 0.06, 0.05, 0.42, 1.3);
  float a2 = pane(p, x0 + 0.42, 0.13, 0.07, -0.03, -0.3, 0.62) * 0.9;
  float a3 = pane(p, x0 - 0.36, 0.1, 0.05, 0.08, -0.3, 1.3) * 0.75;
  float a4 = pane(p, x0 + 0.78, 0.09, 0.06, 0.02, 0.2, 1.3) * 0.6;
  float panes = clamp(a1 + a2 + a3 + a4, 0.0, 1.0);
  vec3 glass = vec3(0.22, 0.56, 0.9) * (0.85 + 0.45 * p.y);
  // white bloom low in the frame while the panes pass
  vec2 q = (p - vec2(0.5, 0.2)) * vec2(uAspect, 1.0);
  float bloom = exp(-dot(q, q) / 0.18) * uAmount;
  float aPane = panes * 0.56 * smoothstep(0.0, 0.3, uAmount);
  float aBloom = bloom * 0.12;
  float alpha = clamp(aPane + aBloom, 0.0, 0.85);
  vec3 col = (glass * aPane + vec3(0.92, 0.95, 1.0) * aBloom) / max(aPane + aBloom, 1e-4);
  gl_FragColor = vec4(col, alpha);
}
`;

const FULLSCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const buildDieSideTexture = (): THREE.CanvasTexture => {
  const W = 512;
  const H = 64;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  // bulk silicon: dark and glassy
  ctx.fillStyle = "#6f7a92";
  ctx.fillRect(0, 0, W, H);
  // thin dark active layer right under the top surface
  ctx.fillStyle = "#2c3348";
  ctx.fillRect(0, 0, W, 10);
  // row of micro bumps along the bottom edge
  ctx.fillStyle = "#39415a";
  ctx.fillRect(0, 36, W, 28);
  ctx.fillStyle = "#f6f8ff";
  for (let i = 0; i < 40; i++) {
    ctx.fillRect(4 + i * 12.7, 40, 7, 20);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
};

export const createChipScene =
  (look: ChipLook) =>
  (args: StageArgs): StageController => {
    const { renderer, bufferWidth, bufferHeight, fps } = args;
    const aspect = bufferWidth / bufferHeight;
    const post = new PostPipeline(renderer, bufferWidth, bufferHeight);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(look.fov, aspect, 10, 200);

    // -- Environment ---------------------------------------------------------
    const env = buildEnvironment(renderer, {
      cool: new THREE.Color(0.36, 0.46, 0.66),
      neutral: new THREE.Color(0.09, 0.095, 0.102),
      ground: new THREE.Color(0.05, 0.058, 0.07),
    });

    // -- Instanced lead-frame sheet -------------------------------------------
    const sites: { x: number; z: number }[] = [];
    for (let i = -GRID; i <= GRID; i++) {
      for (let j = -GRID; j <= GRID; j++) {
        sites.push({ x: i * UNIT, z: j * UNIT });
      }
    }
    // draw order irrelevant (opaque), but keep the hero site first
    sites.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
    const N = sites.length;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const one = new THREE.Vector3(1, 1, 1);
    const Y = new THREE.Vector3(0, 1, 0);

    const brushed = buildBrushedTexture();
    const lightPos = new THREE.Vector3();
    const metalUniforms = {
      tEnv: { value: env.texture },
      tBrushed: { value: brushed },
      uEnvIntensity: { value: 1 },
      uLightPos: { value: lightPos },
      uLightPower: { value: 0 },
      uEnvRot: { value: new THREE.Vector2(1, 0) },
    };
    const makeMetal = (
      f0: THREE.Color,
      rough: number,
      envLod: number,
      wallShade: number,
      glint = 0,
    ) =>
      new THREE.ShaderMaterial({
        vertexShader: METAL_VERT,
        fragmentShader: METAL_FRAG,
        side: THREE.DoubleSide,
        uniforms: {
          ...metalUniforms,
          uF0: { value: f0 },
          uRough: { value: rough },
          uEnvLod: { value: envLod },
          uWallShade: { value: wallShade },
          uGlint: { value: glint },
        },
      });
    const unitGeo = buildUnitGeometry();
    const sheetMat = makeMetal(new THREE.Color(0.9, 0.9, 0.9), 0.44, 4.3, 0.6);
    const sheet = new THREE.InstancedMesh(unitGeo, sheetMat, N);
    sites.forEach((s, i) => {
      m4.makeTranslation(s.x, 0, s.z);
      sheet.setMatrixAt(i, m4);
    });
    sheet.frustumCulled = false;
    scene.add(sheet);

    // Whatever is underneath the stamped openings.
    const floorMat = new THREE.MeshBasicMaterial({ color: 0x05080f });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.62;
    scene.add(floor);

    // -- Dies ------------------------------------------------------------------
    const rng = makeRng(90210);
    const dieTex = buildDieTexture();
    const dieSideTex = buildDieSideTexture();
    const camRight = new THREE.Vector3(1, 0, 0);
    const sky = new THREE.Color();
    const dieTopMat = new THREE.ShaderMaterial({
      vertexShader: DIE_TOP_VERT,
      fragmentShader: DIE_TOP_FRAG,
      uniforms: {
        tDie: { value: dieTex },
        uCamRight: { value: camRight },
        uLevel: { value: 1 },
        uSat: { value: 1 },
        uSky: { value: sky },
        uLightPos: { value: lightPos },
        uLightPower: { value: 1 },
      },
    });
    const dieSideMat = new THREE.ShaderMaterial({
      vertexShader: DIE_SIDE_VERT,
      fragmentShader: DIE_SIDE_FRAG,
      uniforms: {
        tEnv: { value: env.texture },
        tSide: { value: dieSideTex },
        uEnvIntensity: metalUniforms.uEnvIntensity,
        uSideLevel: { value: 0.1 },
        uEnvRot: metalUniforms.uEnvRot,
      },
    });
    const dieBottomMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const dieGeo = new THREE.BoxGeometry(DIE_HALF * 2, DIE_HEIGHT, DIE_HALF * 2);
    const phases = new Float32Array(N);
    const dies = new THREE.InstancedMesh(
      dieGeo,
      [dieSideMat, dieSideMat, dieTopMat, dieBottomMat, dieSideMat, dieSideMat],
      N,
    );
    sites.forEach((s, i) => {
      m4.makeTranslation(s.x, DIE_HEIGHT / 2 + 0.02, s.z);
      dies.setMatrixAt(i, m4);
      phases[i] = i === 0 ? 0 : (rng() - 0.5) * 0.3;
    });
    dieGeo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1));
    dies.frustumCulled = false;
    scene.add(dies);

    // -- Small parts -----------------------------------------------------------
    // slightly warm, polished parts: tie-bar ribs, bond pads, rail dimples
    const brightMetal = makeMetal(new THREE.Color(1.0, 0.95, 0.87), 0.24, 2.6, 1.0, 26);
    const ties = tieBars();
    const tieGeo = new THREE.BoxGeometry(1, 0.1, 0.16);
    const tieMesh = new THREE.InstancedMesh(tieGeo, brightMetal, N * ties.length);
    const pads = bondPads();
    const padGeo = new THREE.BoxGeometry(0.075, 0.07, 0.15);
    const padMesh = new THREE.InstancedMesh(padGeo, brightMetal, N * pads.length);
    const dimples = railDimples();
    const dimpleGeo = new THREE.SphereGeometry(0.13, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2);
    const dimpleMesh = new THREE.InstancedMesh(dimpleGeo, brightMetal, N * dimples.length);
    let ti = 0;
    let pi = 0;
    let di = 0;
    for (const s of sites) {
      for (const tb of ties) {
        q.setFromAxisAngle(Y, -tb.angle);
        v.set(s.x + tb.x, 0.045, s.z + tb.z);
        m4.compose(v, q, one.set(tb.length, 1, 1));
        tieMesh.setMatrixAt(ti++, m4);
      }
      one.set(1, 1, 1);
      for (const p of pads) {
        q.setFromAxisAngle(Y, p.alongX ? 0 : Math.PI / 2);
        v.set(s.x + p.x, 0.035, s.z + p.z);
        m4.compose(v, q, one);
        padMesh.setMatrixAt(pi++, m4);
      }
      q.identity();
      for (const d of dimples) {
        v.set(s.x + d.x, 0.0, s.z + d.z);
        m4.compose(v, q, one.set(1, 0.55, 1));
        dimpleMesh.setMatrixAt(di++, m4);
      }
      one.set(1, 1, 1);
    }
    for (const mesh of [tieMesh, padMesh, dimpleMesh]) {
      mesh.frustumCulled = false;
      scene.add(mesh);
    }

    // -- Lights ------------------------------------------------------------------
    const LIGHT_HEIGHT = 7;

    // -- Foreground wipe overlay ----------------------------------------------------
    const wipeMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: WIPE_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uAmount: { value: 0 },
        uProgress: { value: 0 },
        uAspect: { value: aspect },
      },
    });
    const wipeQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), wipeMat);
    wipeQuad.frustumCulled = false;
    const overlayScene = new THREE.Scene();
    overlayScene.add(wipeQuad);
    const overlayCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const params = defaultPostParams();
    const target = new THREE.Vector3();
    const right = new THREE.Vector3();
    const away = new THREE.Vector3();
    const rollQ = new THREE.Quaternion();
    const FWD = new THREE.Vector3(0, 0, -1);
    const coolTint = new THREE.Color(0.93, 0.97, 1.04);
    const steelTint = new THREE.Color(1.0, 1.0, 0.97);
    const floorCool = new THREE.Color(0.02, 0.032, 0.05);
    const floorSteel = new THREE.Color(0.03, 0.04, 0.05);
    const skyCool = new THREE.Color(0.45, 0.62, 0.9);
    const skySteel = new THREE.Color(0.3, 0.33, 0.38);

    const render = (frameIndex: number) => {
      const t = frameIndex / fps;

      // Camera
      const yaw = THREE.MathUtils.degToRad(sampleTrack(look.yaw, t));
      const el = THREE.MathUtils.degToRad(sampleTrack(look.elevation, t));
      const width = sampleTrack(look.frameWidth, t);
      const dist = width / 2 / (Math.tan(THREE.MathUtils.degToRad(look.fov / 2)) * aspect);
      target.set(sampleTrack(look.targetX, t), 0.45, sampleTrack(look.targetZ, t));
      camera.position.set(
        target.x - Math.sin(yaw) * Math.cos(el) * dist,
        target.y + Math.sin(el) * dist,
        target.z + Math.cos(yaw) * Math.cos(el) * dist,
      );
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      rollQ.setFromAxisAngle(FWD, THREE.MathUtils.degToRad(sampleTrack(look.roll, t)));
      camera.quaternion.multiply(rollQ);
      camera.near = Math.max(dist - 60, 5);
      camera.far = dist + 90;
      camera.updateProjectionMatrix();
      camera.updateMatrixWorld(true);

      right.set(Math.cos(yaw), 0, Math.sin(yaw));
      away.set(Math.sin(yaw), 0, -Math.cos(yaw));
      camRight.copy(right);

      // Travelling soft light: place it so its mirror image on the sheet sits
      // at the wanted spot.
      const sampleLight = look.light.linear ? sampleLinear : sampleTrack;
      const hx = sampleLight(look.light.x, t);
      const hy = sampleLight(look.light.y, t);
      const gx = target.x + right.x * hx + away.x * hy;
      const gz = target.z + right.z * hx + away.z * hy;
      const k = LIGHT_HEIGHT / (LIGHT_HEIGHT + camera.position.y);
      lightPos.set(
        (gx - k * camera.position.x) / (1 - k),
        LIGHT_HEIGHT,
        (gz - k * camera.position.z) / (1 - k),
      );
      const power = sampleLight(look.light.power, t) * look.hotZone;
      metalUniforms.uLightPower.value = 62 * power;

      // Grade
      const envYaw = THREE.MathUtils.degToRad(sampleTrack(look.envYaw, t));
      // rotate the lookup the opposite way = rotate the room with the camera
      metalUniforms.uEnvRot.value.set(Math.cos(envYaw), -Math.sin(envYaw));
      const cool = clamp(sampleTrack(COOLNESS, t) + look.coolBias, 0, 1.3);
      metalUniforms.uEnvIntensity.value = sampleTrack(ENV_INTENSITY, t);
      dieSideMat.uniforms.uSideLevel.value = lerp(0.95, 0.1, cool);
      floorMat.color.copy(floorSteel).lerp(floorCool, cool).multiplyScalar(look.openingLevel);
      sky.copy(skySteel).lerp(skyCool, cool);
      dieTopMat.uniforms.uLevel.value = sampleTrack(DIE_LEVEL, t);
      dieTopMat.uniforms.uSat.value = sampleTrack(DIE_SAT, t);
      dieTopMat.uniforms.uLightPower.value = power;

      // Foreground wipe
      let wipe = 0;
      let progress = 0;
      if (look.wipeWindow) {
        const [w0, w1] = look.wipeWindow;
        progress = clamp((t - w0) / (w1 - w0), 0, 1);
        const sn = Math.sin(Math.PI * progress);
        wipe = sn * sn * (1.5 - 0.5 * sn * sn); // smooth at both ends, broad in the middle
      }
      // the whole image drifts out of focus as the wipe passes and eases back
      const defocus = look.wipeDefocus ? Math.max(0, sampleTrack(look.wipeDefocus, t)) : 0;
      wipeMat.uniforms.uAmount.value = wipe;
      wipeMat.uniforms.uProgress.value = progress;

      params.frame = frameIndex;
      params.focus = dist;
      params.nearBlur = 0.66;
      // keep the whole hero die sharp; its neighbours still fall off quickly
      params.focusRange = 0.0036;
      params.defocus = defocus;
      params.aperture = sampleTrack(look.aperture, t);
      params.maxCoc = 0.04;
      params.bloomStrength = 0.3;
      params.bloomThreshold = 1.0;
      params.exposure = lerp(0.9, 0.8, cool) * sampleTrack(look.exposure, t);
      params.tint.copy(steelTint).lerp(coolTint, cool);
      const lift = look.blackLift;
      params.lift.setRGB(
        0.011 - 0.002 * cool + 0.9 * lift,
        0.015 - 0.002 * cool + lift,
        0.019 + 0.002 * cool + 1.2 * lift,
      );
      params.contrast = 1.03;
      params.saturation = lerp(0.42, 0.8, cool);
      params.vignette = 0.3;
      params.vignetteColor.setRGB(0.25, 0.3, 0.4);
      params.grain = 0.014;
      post.render(
        scene,
        camera,
        params,
        wipe > 0.001 ? { scene: overlayScene, camera: overlayCam } : undefined,
      );
    };

    return {
      render,
      dispose: () => {
        post.dispose();
        env.dispose();
        for (const g of [unitGeo, dieGeo, tieGeo, padGeo, dimpleGeo, floor.geometry, wipeQuad.geometry]) {
          g.dispose();
        }
        for (const m of [sheetMat, floorMat, dieTopMat, dieSideMat, dieBottomMat, brightMetal, wipeMat]) {
          m.dispose();
        }
        for (const tx of [brushed, dieTex, dieSideTex]) {
          tx.dispose();
        }
        for (const mesh of [sheet, dies, tieMesh, padMesh, dimpleMesh]) {
          mesh.dispose();
        }
      },
    };
  };

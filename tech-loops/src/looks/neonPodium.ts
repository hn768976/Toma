import * as THREE from "three";
import { HASH } from "../engine/glsl";
import type { Look, LookFactory } from "../engine/LoopCanvas";
import { TAU, cyc } from "../engine/loop";
import { shaderMat } from "../engine/material";
import { Post } from "../engine/post";

export interface NeonPodiumParams {
  neonA: string;
  neonB: string;
  /** Deep background / face tint. */
  ambient: string;
}

// ---------------------------------------------------------------------------
// Layout. Units: podium radius = 1.
// ---------------------------------------------------------------------------
const COLS = 20;
const ROWS = 7;
const CUBE = 0.42; // cube edge
const PITCH = 0.56; // spacing along the arc (columns stand apart)
const ROW_PITCH = 0.44; // vertical spacing
// Concave wall: a parabola in plan, z = WALL_Z + WALL_K * x^2, so the sides
// sweep forward toward the camera.
const WALL_Z = -3.3;
const WALL_K = 0.38;
const WALL_Y0 = 0.12; // centre height of the bottom row
const EDGE_T = 0.024; // neon tube thickness
const POD_R = 1.0;
const POD_H = 0.22;

interface Slot {
  col: number;
  row: number;
  angle: number; // around the arc
  x: number;
  y: number;
  z: number;
  band: number; // 0..1 colour mix
}
const SLOTS: Slot[] = [];
{
  // Column x positions at equal arc length along the parabola.
  const colX: number[] = [];
  {
    const half: number[] = [];
    let x = 0;
    let len = PITCH / 2;
    for (let k = 0; k < COLS / 2; k++) {
      // March until the arc length since x=0 reaches len.
      let acc = 0;
      let xx = 0;
      while (acc < len) {
        const dx = 0.001;
        acc += Math.sqrt(1 + (2 * WALL_K * (xx + dx / 2)) ** 2) * dx;
        xx += dx;
      }
      x = xx;
      half.push(x);
      len += PITCH;
    }
    for (let k = half.length - 1; k >= 0; k--) colX.push(-half[k]);
    for (const h of half) colX.push(h);
  }
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cx = colX[c];
      const a = Math.atan(2 * WALL_K * cx);
      // Colour bands: groups of columns alternate A / B with soft-ish transitions.
      // Skewed toward neon A, so the first colour (cyan-blue in 5A) carries more of the wall.
      const band = Math.pow(0.5 + 0.5 * Math.sin(c * 1.05 + 0.4 + r * 0.18), 1.5);
      SLOTS.push({
        col: c,
        row: r,
        angle: a,
        x: cx,
        y: WALL_Y0 + r * ROW_PITCH,
        z: WALL_Z + WALL_K * cx * cx,
        band: band < 0.5 ? Math.pow(band * 2, 3) / 2 : 1 - Math.pow((1 - band) * 2, 3) / 2,
      });
    }
  }
}

// 12 cube edges in unit-cube space: [centre, scale] for a unit box.
const EDGES12: { c: THREE.Vector3; s: THREE.Vector3; depth: boolean }[] = [];
{
  const h = 0.5;
  for (const y of [-h, h]) for (const z of [-h, h]) EDGES12.push({ c: new THREE.Vector3(0, y, z), s: new THREE.Vector3(1 + EDGE_T / CUBE, EDGE_T / CUBE, EDGE_T / CUBE), depth: false });
  for (const x of [-h, h]) for (const z of [-h, h]) EDGES12.push({ c: new THREE.Vector3(x, 0, z), s: new THREE.Vector3(EDGE_T / CUBE, 1 + EDGE_T / CUBE, EDGE_T / CUBE), depth: false });
  for (const x of [-h, h]) for (const y of [-h, h]) EDGES12.push({ c: new THREE.Vector3(x, y, 0), s: new THREE.Vector3(EDGE_T / CUBE, EDGE_T / CUBE, 1 + EDGE_T / CUBE), depth: true });
}

const FACE_VERT = /* glsl */ `
out vec3 vN;
out vec3 vW;
out vec3 vL; // local position in the unit cube
out float vBand;
in float aBand;
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vL = position;
  vBand = aBand;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FACE_FRAG = /* glsl */ `
precision highp float;
in vec3 vN;
in vec3 vW;
in vec3 vL;
in float vBand;
uniform vec3 uA;
uniform vec3 uB;
uniform vec3 uAmb;
uniform vec3 uCam;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  // Distance to the nearest border of this face (unit-cube coordinates).
  // MSAA can evaluate varyings slightly outside the triangle; keep them in the cube.
  vec3 a = min(abs(vL), vec3(0.5));
  vec3 m = step(0.499, a); // the axis this face is perpendicular to
  vec2 q = m.x > 0.5 ? a.yz : m.y > 0.5 ? a.xz : a.xy;
  float d = max(0.5 - max(q.x, q.y), 0.0);
  vec3 neon = mix(uA, uB, vBand);
  float glow = exp(-d * 26.0) * 0.12 + exp(-d * 5.0) * 0.012;
  float fres = pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 3.0);
  // Dark tinted glass-like faces: a soft gradient of both neons, brighter toward the top.
  float up = clamp(vL.y + 0.5, 0.0, 1.0);
  vec3 col = uAmb * 1.2 + neon * (glow * 0.6 + fres * 0.08) + mix(uB, uA, vBand) * 0.02 * (0.4 + 0.6 * up) + mix(uA, uB, 0.3) * 0.02;
  gl_FragColor = vec4(col, 1.0);
}
`;

const EDGE_VERT = /* glsl */ `
in vec3 aCol;
out vec3 vCol;
out vec3 vN;
out vec3 vW;
void main() {
  vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix * instanceMatrix) * normal);
  vCol = aCol;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const EDGE_FRAG = /* glsl */ `
precision highp float;
in vec3 vCol;
in vec3 vN;
in vec3 vW;
uniform vec3 uCam;
uniform float uGain;
void main() {
  vec3 V = normalize(uCam - vW);
  float facing = abs(dot(normalize(vN), V));
  gl_FragColor = vec4(vCol * uGain * (0.75 + 0.5 * facing), 1.0);
}
`;

const POD_VERT = /* glsl */ `
out vec3 vN;
out vec3 vW;
out vec3 vL;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vL = position;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const POD_FRAG = /* glsl */ `
precision highp float;
in vec3 vN;
in vec3 vW;
in vec3 vL;
uniform vec3 uRim;
uniform vec3 uRim2;
uniform vec3 uAmb;
uniform vec3 uCam;
uniform float uH;
uniform float uR;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  vec3 col;
  if (N.y > 0.5) {
    // Top: dark satin, reflecting the wall's glow as a soft vertical gradient.
    float r = length(vL.xz) / uR;
    float fres = pow(clamp(1.0 - dot(N, V), 0.0, 1.0), 4.0);
    col = uAmb * 1.4 + mix(uRim2, uRim, 0.5) * (0.04 + fres * 0.3) * (0.5 + 0.5 * smoothstep(1.0, -1.0, vL.z / uR));
    col += uRim * smoothstep(0.965, 0.995, r) * 0.6;
  } else if (N.y < -0.5) {
    col = vec3(0.0);
  } else {
    // Side: dark metal with a glowing band low down and a fine lit lip on top.
    float y = (vL.y + uH * 0.5) / uH; // 0 bottom .. 1 top
    float band = smoothstep(0.1, 0.13, y) * (1.0 - smoothstep(0.19, 0.22, y));
    float lip = smoothstep(0.86, 0.97, y);
    float side = 0.5 + 0.5 * dot(N, V);
    col = uAmb * 1.2 * side + uRim * (band * 1.8 + lip * 0.25) + uRim * 0.05;
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

const FLOOR_VERT = /* glsl */ `
out vec3 vW;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const FLOOR_FRAG = /* glsl */ `
precision highp float;
in vec3 vW;
uniform sampler2D tRefl;
uniform sampler2D tReflBlur;
uniform vec2 uRes;
uniform vec3 uCam;
uniform vec3 uRim;
uniform vec3 uAmb;
uniform float uPodR;
${HASH}
void main() {
  vec2 suv = gl_FragCoord.xy / uRes;
  vec3 V = normalize(uCam - vW);
  float fres = 0.05 + 0.95 * pow(clamp(1.0 - V.y, 0.0, 1.0), 5.0);
  vec3 sharp = texture(tRefl, suv).rgb;
  vec3 blur = texture(tReflBlur, suv).rgb;
  // Roughness ~0.1: mostly sharp near the contact, softer farther from it.
  float dist = length(vW - uCam);
  vec3 refl = mix(sharp, blur, 0.85);
  vec3 col = uAmb * 0.15 + refl * (0.2 + 0.4 * fres);
  // Light pool from the podium rim.
  float rp = length(vW.xz);
  col += uRim * 0.05 * exp(-max(rp - uPodR, 0.0) * 2.2) * smoothstep(uPodR * 0.9, uPodR * 1.02, rp);
  gl_FragColor = vec4(col, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform vec3 uAmb;
uniform vec3 uA;
uniform vec3 uB;
void main() {
  float y = vUv.y;
  vec3 col = uAmb * (0.5 + 0.9 * (1.0 - y));
  gl_FragColor = vec4(col, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D tSrc;
uniform vec2 uDir;
void main() {
  vec3 s = texture(tSrc, vUv).rgb * 0.227;
  s += (texture(tSrc, vUv + uDir * 1.385).rgb + texture(tSrc, vUv - uDir * 1.385).rgb) * 0.316;
  s += (texture(tSrc, vUv + uDir * 3.231).rgb + texture(tSrc, vUv - uDir * 3.231).rgb) * 0.070;
  gl_FragColor = vec4(s, 1.0);
}
`;

export const createNeonPodium: LookFactory<NeonPodiumParams> = (gl, params): Look => {
  const post = new Post(gl, {
    msaa: 4,
    bloomStrength: 0.6,
    bloomRadius: 0.55,
    bloomThreshold: 0.7,
    bloomKnee: 0.5,
    exposure: 1.0,
    vignette: 0.5,
    grain: 0.015,
    grainDarkCut: 0,
    whiten: 0.03,
  });
  const A = new THREE.Color(params.neonA);
  const B = new THREE.Color(params.neonB);
  const amb = new THREE.Color(params.ambient);

  const scene = new THREE.Scene(); // everything above the floor
  const world = new THREE.Group();
  scene.add(world);
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.1, 100);

  // Cube faces.
  const faceGeo = new THREE.BoxGeometry(1, 1, 1);
  faceGeo.setAttribute("aBand", new THREE.InstancedBufferAttribute(new Float32Array(SLOTS.map((s) => s.band)), 1));
  const faceMat = shaderMat({
    vertexShader: FACE_VERT,
    fragmentShader: FACE_FRAG,
    uniforms: {
      uA: { value: A },
      uB: { value: B },
      uAmb: { value: amb },
      uCam: { value: new THREE.Vector3() },
    },
  });
  const faces = new THREE.InstancedMesh(faceGeo, faceMat, SLOTS.length);
  faces.frustumCulled = false;
  world.add(faces);

  // Neon edge tubes: 12 per cube.
  const edgeGeo = new THREE.BoxGeometry(1, 1, 1);
  const cols = new Float32Array(SLOTS.length * 12 * 3);
  SLOTS.forEach((s, i) => {
    EDGES12.forEach((e, k) => {
      // Front-to-back edges take the other colour of the band: rotating cubes show both.
      const t = e.depth ? 1 - s.band : s.band;
      const c = A.clone().lerp(B, t);
      cols.set([c.r, c.g, c.b], (i * 12 + k) * 3);
    });
  });
  edgeGeo.setAttribute("aCol", new THREE.InstancedBufferAttribute(cols, 3));
  const edgeMat = shaderMat({
    vertexShader: EDGE_VERT,
    fragmentShader: EDGE_FRAG,
    uniforms: { uCam: { value: new THREE.Vector3() }, uGain: { value: 1.6 } },
  });
  const edges = new THREE.InstancedMesh(edgeGeo, edgeMat, SLOTS.length * 12);
  edges.frustumCulled = false;
  world.add(edges);

  // Podium.
  const podGeo = new THREE.CylinderGeometry(POD_R, POD_R, POD_H, 160, 1);
  const rim = new THREE.Color();
  const rim2 = new THREE.Color();
  const podMat = shaderMat({
    vertexShader: POD_VERT,
    fragmentShader: POD_FRAG,
    uniforms: {
      uRim: { value: rim },
      uRim2: { value: rim2 },
      uAmb: { value: amb },
      uCam: { value: new THREE.Vector3() },
      uH: { value: POD_H },
      uR: { value: POD_R },
    },
  });
  const podium = new THREE.Mesh(podGeo, podMat);
  podium.position.set(0, POD_H / 2, 0);
  world.add(podium);

  // Background: a big dark backdrop sphere drawn as a full-screen pass first.
  const skyMat = shaderMat({
    vertexShader: /* glsl */ `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
    fragmentShader: SKY_FRAG,
    uniforms: { uAmb: { value: amb }, uA: { value: A }, uB: { value: B } },
    depthWrite: false,
    depthTest: false,
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);

  // Floor (drawn only in the main pass).
  const reflRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const reflBlurA = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const reflBlurB = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  const floorMat = shaderMat({
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG,
    uniforms: {
      tRefl: { value: reflRT.texture },
      tReflBlur: { value: reflBlurB.texture },
      uRes: { value: new THREE.Vector2() },
      uCam: { value: new THREE.Vector3() },
      uRim: { value: rim },
      uAmb: { value: amb },
      uPodR: { value: POD_R },
    },
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80).rotateX(-Math.PI / 2), floorMat);
  const floorScene = new THREE.Scene();
  floorScene.add(floor);

  const blurMat = shaderMat({
    vertexShader: /* glsl */ `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: BLUR_FRAG,
    uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
    depthTest: false,
    depthWrite: false,
  });

  const m4 = new THREE.Matrix4();
  const e4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();

  /** Wall pose for this frame: two ripple waves per loop sweep across the wall. */
  const layoutWall = (frame: number) => {
    const ph = cyc(frame, 2); // two waves per loop
    SLOTS.forEach((s, i) => {
      const u = s.col / (COLS - 1);
      const v = s.row / (ROWS - 1);
      // Travelling bump: phase advances across the wall, slightly diagonal.
      // Travelling wave, about three crests across the wall, slightly diagonal.
      const phi = ph - u * 3.0 - v * 0.25;
      const sw = Math.sin(TAU * phi);
      // Alternate rows turn opposite ways: columns fold like an accordion.
      const rot = ((s.row % 2 ? 1 : -1) * sw * Math.PI) / 4; // up to +-45 deg
      const push = Math.abs(sw) * 0.16;
      const nx = -Math.sin(s.angle);
      const nz = Math.cos(s.angle); // inward normal (toward the camera side)
      pos.set(s.x + nx * push, s.y, s.z + nz * push);
      q.setFromAxisAngle(yAxis, -s.angle + rot);
      scl.setScalar(CUBE);
      m4.compose(pos, q, scl);
      faces.setMatrixAt(i, m4);
      EDGES12.forEach((e, k) => {
        e4.compose(e.c, new THREE.Quaternion(), e.s);
        edges.setMatrixAt(i * 12 + k, e4.premultiply(m4));
      });
    });
    faces.instanceMatrix.needsUpdate = true;
    edges.instanceMatrix.needsUpdate = true;
  };

  const black = new THREE.Color(0, 0, 0);
  const mirror = new THREE.Matrix4().makeScale(1, -1, 1);

  return {
    render(frame) {
      const [w, h] = post.ensureSize();
      if (reflRT.width !== w >> 1) {
        reflRT.setSize(w >> 1, h >> 1);
        reflBlurA.setSize(w >> 2, h >> 2);
        reflBlurB.setSize(w >> 2, h >> 2);
      }
      const a = cyc(frame, 1) * TAU;
      // Slow closed dolly, +-3 %.
      const dz = 1 + 0.03 * Math.sin(a);
      camera.position.set(0, 0.5, 3.5 * dz);
      camera.lookAt(0, 0.94, 0);
      camera.updateMatrixWorld();
      // Rim colour drifts between the two neons (one full cycle per loop).
      // Dwell on each neon, crossing over quickly in between.
      const c = 0.5 + 0.5 * Math.cos(a);
      const k = c * c * (3 - 2 * c);
      rim.copy(A).lerp(B, k);
      rim2.copy(A).lerp(B, 1 - k);
      for (const mat of [faceMat, edgeMat, podMat, floorMat]) mat.uniforms.uCam.value.copy(camera.position);
      layoutWall(frame);

      // 1) Mirrored pass for the floor reflection.
      world.matrixAutoUpdate = false;
      world.matrix.copy(mirror);
      world.updateMatrixWorld(true);
      gl.setRenderTarget(reflRT);
      gl.setClearColor(black, 1);
      gl.clear(true, true, false);
      sky.visible = false;
      gl.render(scene, camera);
      sky.visible = true;
      world.matrix.identity();
      world.updateMatrixWorld(true);
      // Soften it (roughness ~0.1, slightly streaked vertically like polished resin).
      blurMat.uniforms.tSrc.value = reflRT.texture;
      blurMat.uniforms.uDir.value.set(0.5 / (w >> 2), 0);
      post.blit(blurMat, reflBlurA);
      blurMat.uniforms.tSrc.value = reflBlurA.texture;
      blurMat.uniforms.uDir.value.set(0, 5.0 / (h >> 2));
      post.blit(blurMat, reflBlurB);

      // 2) Main pass.
      post.beginScene(black);
      gl.render(scene, camera);
      floorMat.uniforms.uRes.value.set(w, h);
      gl.render(floorScene, camera);
      post.finish(frame);
    },
    dispose() {
      post.dispose();
      for (const t of [reflRT, reflBlurA, reflBlurB]) t.dispose();
      for (const m of [faceMat, edgeMat, podMat, floorMat, skyMat, blurMat]) m.dispose();
      for (const g of [faceGeo, edgeGeo, podGeo, floor.geometry, sky.geometry]) g.dispose();
    },
  };
};

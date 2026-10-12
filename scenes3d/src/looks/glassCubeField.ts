import * as THREE from "three";
import { LookInstance, SHARED_GLSL } from "../kit/post";
import { LOOP } from "../kit/random";

export type GlassCubeFieldParams = {
  fill: string;
  edge: string;
  glow: string;
};

// The field is a periodic tile of TILE x TILE cells. Heights are a function
// of (cell mod TILE, time) with integer wave numbers, so the camera can glide
// exactly one tile per loop and land on an identical view.
const TILE = 24;
const WIN = 72; // instance window (cells) that follows the camera
const GAP = 0.06;

const FIELD_GLSL = /* glsl */ `
${SHARED_GLSL}
uniform float uT;
float hfield(vec2 c) {
  vec2 q = c * 6.2831853 / ${TILE.toFixed(1)};
  float T = uT;
  float n = 0.0;
  n += 0.50 * sin(q.x + T + 0.3);
  n += 0.45 * sin(q.y - T + 1.7);
  n += 0.35 * sin(q.x + 2.0 * q.y + 2.0 * T + 2.9);
  n += 0.30 * sin(2.0 * q.x - q.y - T + 4.1);
  n += 0.22 * sin(3.0 * q.x + q.y + 2.0 * T + 0.8);
  n += 0.20 * sin(-q.x + 3.0 * q.y - 3.0 * T + 5.3);
  n *= 0.5;
  vec2 cm = mod(c, ${TILE.toFixed(1)});
  vec3 r = hash3(uvec3(uvec2(cm + 0.5), 7u));
  float k = floor(r.z * 2.0) + 1.0;
  n = n * 0.6 + 0.95 * (r.x - 0.5) + 0.25 * sin(k * T + 6.2831853 * r.y);
  return clamp(1.0 + 0.9 * n, 0.4, 1.6);
}
`;

const VERT = /* glsl */ `
attribute vec2 iCell;
uniform vec2 uShift;
${FIELD_GLSL}
varying vec3 vLocal;
varying vec3 vSize;
varying vec3 vN;
varying vec3 vWorld;
varying float vH;
void main() {
  vec2 c = iCell + uShift;
  float h = hfield(c);
  float w = 1.0 - ${GAP.toFixed(3)};
  vec3 size = vec3(w, h, w);
  vec3 local = position * size;
  vec3 world = local + vec3(c.x + 0.5, h * 0.5, c.y + 0.5);
  vLocal = local;
  vSize = size;
  vN = normal;
  vWorld = world;
  vH = h;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uFill;
uniform vec3 uEdge;
uniform vec3 uGlow;
uniform vec3 uCamPos;
uniform float uFog;
uniform float uBack;
varying vec3 vLocal;
varying vec3 vSize;
varying vec3 vN;
varying vec3 vWorld;
varying float vH;
void main() {
#ifdef DEPTH_ONLY
  gl_FragColor = vec4(0.0);
#else
  vec3 N = normalize(vN);
  vec3 V = normalize(uCamPos - vWorld);
  vec3 a = abs(N);
  // Distance to the nearest edge of this face, in world units.
  vec3 d = vSize * 0.5 - abs(vLocal);
  float e;
  if (a.y > 0.5) e = min(d.x, d.z);
  else if (a.x > 0.5) e = min(d.y, d.z);
  else e = min(d.x, d.y);
  float fw = fwidth(e);
  float line = 1.0 - smoothstep(0.008, 0.008 + max(fw, 1e-4) * 1.2, e);
  // Faces seen edge-on stack up along one screen column; fade them out.
  float facing = smoothstep(0.03, 0.15, abs(dot(N, V)));
  line *= facing;
  float fres = pow(max(1.0 - abs(dot(N, V)), 0.0), 3.0);
  float y01 = clamp(vWorld.y / max(vH, 1e-3), 0.0, 1.0);
  // Key light from the lower left of the view: falls off toward top right.
  vec3 vp = (viewMatrix * vec4(vWorld, 1.0)).xyz;
  vec2 sdir = vp.xy / max(-vp.z, 0.1);
  float key = mix(1.15, 0.02, smoothstep(-0.55, 0.55, sdir.x * 0.75 + sdir.y * 0.9));
  vec3 col;
  float alpha = 0.0;
  if (a.y > 0.5) {
    // Top face: a filled glass panel, brightest toward its front-left edge.
    vec2 q = vLocal.xz / (vSize.xz * 0.5);
    vec3 viewL = (inverse(viewMatrix) * vec4(-0.7, -0.5, 0.0, 0.0)).xyz;
    vec2 ld = normalize(viewL.xz + vec2(1e-4));
    float g = clamp(0.55 + 0.45 * dot(q, ld), 0.0, 1.0);
    col = uFill * (0.25 + 1.6 * g * g) * key;
    col += uEdge * line * (0.2 + 0.9 * g * g) * key * uBack * uBack;
    col += uEdge * exp(-e / 0.05) * 0.12 * key * facing;
    alpha = 0.72 * uBack * uBack;
  } else {
    // Sides: dark smoky glass with a faint lift near the top.
    col = uFill * (0.03 + 0.18 * y01 * y01 + 0.12 * fres) * key;
    col += uEdge * line * 0.1 * (0.3 + y01) * key * uBack * uBack;
  }
  col += uGlow * 0.03 * (1.0 - y01) * key;
  col *= uBack;
  float dist = length(uCamPos - vWorld);
  float fog = exp(-dist * dist * uFog * uFog);
  gl_FragColor = vec4(col * fog, alpha * fog);
#endif
}
`;

const GROUND_FRAG = /* glsl */ `
uniform vec3 uGlow;
uniform vec3 uCamPos;
uniform float uFog;
varying vec3 vWorld;
void main() {
  float dist = length(uCamPos - vWorld);
  float fog = exp(-dist * dist * uFog * uFog);
  gl_FragColor = vec4(uGlow * 0.012 * fog, 1.0);
}
`;

const lin = (hex: string, gain = 1) =>
  // Hex strings are sRGB; THREE.Color stores linear.
  new THREE.Color(hex).multiplyScalar(gain);

export const createGlassCubeField = (P: GlassCubeFieldParams): LookInstance => {
  const scene = new THREE.Scene();
  const depthScene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.2, 60);

  const box = new THREE.BoxGeometry(1, 1, 1);
  const g = new THREE.InstancedBufferGeometry();
  g.index = box.index;
  g.setAttribute("position", box.getAttribute("position"));
  g.setAttribute("normal", box.getAttribute("normal"));
  const n = WIN * WIN;
  // Far cells first (the camera always looks roughly along +z, +x), so the
  // semi-opaque top faces composite back to front.
  const list: [number, number][] = [];
  for (let i = 0; i < n; i++) list.push([(i % WIN) - WIN / 2, Math.floor(i / WIN) - WIN / 2]);
  list.sort((a, b) => b[0] * 0.34 + b[1] * 0.94 - (a[0] * 0.34 + a[1] * 0.94));
  const cells = new Float32Array(n * 2);
  list.forEach(([x, z], i) => {
    cells[i * 2] = x;
    cells[i * 2 + 1] = z;
  });
  g.setAttribute("iCell", new THREE.InstancedBufferAttribute(cells, 2));
  g.instanceCount = n;

  const camPos = new THREE.Vector3();
  const uniforms = {
    uShift: { value: new THREE.Vector2() },
    uT: { value: 0 },
    uFill: { value: lin(P.fill) },
    uEdge: { value: lin(P.edge, 1.0) },
    uGlow: { value: lin(P.glow) },
    uCamPos: { value: camPos },
    uFog: { value: 0.075 },
  };
  // Premultiplied "over": alpha 0 is purely additive (sides, back faces),
  // alpha > 0 on the top faces lets them partly hide what is behind.
  const glass = (side: THREE.Side, back: number) =>
    new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: { ...uniforms, uBack: { value: back } },
      side,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
      depthWrite: false,
      transparent: true,
    });
  const backMesh = new THREE.Mesh(g, glass(THREE.BackSide, 0.35));
  backMesh.renderOrder = 1;
  const frontMesh = new THREE.Mesh(g, glass(THREE.FrontSide, 1.0));
  frontMesh.renderOrder = 2;
  backMesh.frustumCulled = frontMesh.frustumCulled = false;
  scene.add(backMesh, frontMesh);

  const depthMat = glass(THREE.FrontSide, 1);
  depthMat.defines = { DEPTH_ONLY: 1 };
  depthMat.blending = THREE.NoBlending;
  depthMat.colorWrite = false;
  depthMat.depthWrite = true;
  depthMat.transparent = false;
  const depthMesh = new THREE.Mesh(g, depthMat);
  depthMesh.frustumCulled = false;
  depthScene.add(depthMesh);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(200, 200),
    new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vWorld; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: GROUND_FRAG,
      uniforms: { uGlow: uniforms.uGlow, uCamPos: uniforms.uCamPos, uFog: uniforms.uFog },
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const H = 4.3;
  const start = new THREE.Vector2(0.37, 0.61);

  return {
    scene,
    camera,
    post: {
      focus: 7.0,
      cocScale: 7,
      maxCoc: 9,
      nearScale: 1.6,
      bloomStrength: 0.3,
      bloomThreshold: 0.6,
      exposure: 1.0,
      vignette: 0.45,
      grain: 0.015,
      acesMix: 0.0,
    },
    update: (frame, w, h) => {
      const f = frame % LOOP;
      const t = f / LOOP;
      const a = t * Math.PI * 2;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      // Glide diagonally exactly one tile per loop.
      const cx = start.x + t * TILE;
      const cz = start.y + t * TILE;
      const yaw = THREE.MathUtils.degToRad(70 + 6 * Math.sin(a));
      const pitch = THREE.MathUtils.degToRad(-34 + 1.5 * Math.sin(a * 2 + 1));
      camera.position.set(cx, H + 0.25 * Math.sin(a + 0.4), cz);
      const dir = new THREE.Vector3(
        Math.cos(yaw) * Math.cos(pitch),
        Math.sin(pitch),
        Math.sin(yaw) * Math.cos(pitch),
      );
      camera.lookAt(camera.position.clone().add(dir));
      camPos.copy(camera.position);
      // Keep the instance window centred ahead of the camera, in whole cells.
      uniforms.uShift.value.set(
        Math.floor(cx + Math.cos(yaw) * 22),
        Math.floor(cz + Math.sin(yaw) * 22),
      );
      uniforms.uT.value = a;
      ground.position.set(cx, 0, cz);
    },
    draw: (gl) => {
      gl.render(scene, camera);
      gl.render(depthScene, camera);
    },
    dispose: () => {
      g.dispose();
    },
  };
};

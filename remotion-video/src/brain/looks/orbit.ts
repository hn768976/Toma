import { BackSide, FrontSide, Group, LineSegments, Mesh, PerspectiveCamera, Points, Scene, ShaderMaterial, Vector3 } from "three";
import { cortexGeometry, fibreLines, pointCloud } from "../engine/geometry";
import { makeDrift } from "../engine/drift";
import { lin, srgb, TAU } from "../engine/math";
import { Post, pxScale } from "../engine/post";
import { ADDITIVE, POINT_GLSL } from "../engine/primitives";
import type { LookFactory } from "../engine/Stage";

// Look 8 · Brain Orbit Deep Blue (20 s loop). A luminous blue brain - glowing
// veins along every fold, white at the crests - turning in deep-blue space with
// drifting dust, out-of-focus specks and slowly rising orange embers.

export const ORBIT_COLORS = {
  // One data row: veins, crest highlight, body glow, background top, background bottom, embers, dust
  vein: "#5AB8FF",
  crest: "#FFFFFF",
  body: "#1A8FE0",
  bgTop: "#06142A",
  bgBottom: "#020610",
  ember: "#FF7A3A",
  dust: "#9CC8FF",
};

const PERIOD = 600;
const TILT = 0.14; // forward tilt (top toward camera), rad

const BG = /* glsl */ `
  vec3 top = uBgTop;
  vec3 bot = uBgBottom;
  vec3 c = mix(bot, top, smoothstep(0.0, 1.0, uv.y));
  // faint light rays fanning down from above the frame
  vec2 src = vec2(0.52, 1.35);
  vec2 d = vec2((uv.x - src.x) * aspect, uv.y - src.y);
  float ang = atan(d.x, -d.y);
  float rays = 0.0;
  rays += 0.5 + 0.5 * sin(ang * 23.0 + 1.3);
  rays *= 0.5 + 0.5 * sin(ang * 41.0 + 0.4);
  rays = pow(rays, 3.0) + 0.35 * pow(0.5 + 0.5 * sin(ang * 9.0 + 2.0), 4.0);
  float fall = exp(-length(d) * 1.6) * smoothstep(0.75, 0.15, abs(ang));
  c += vec3(0.10, 0.22, 0.42) * rays * fall * 0.22;
  c += vec3(0.03, 0.08, 0.16) * exp(-pow(length(d) - 0.9, 2.0) * 3.0) * 0.6;
  // gentle vignette toward the corners
  vec2 q = uv - 0.5;
  c *= 1.0 - 0.75 * smoothstep(0.05, 0.5, dot(q * vec2(aspect * 0.7, 1.0), q * vec2(aspect * 0.7, 1.0)));
  // faint smoky fog (static)
  vec2 f = uv * vec2(aspect, 1.0) * 3.0;
  float fog = sin(f.x * 1.3 + sin(f.y * 1.7)) * sin(f.y * 1.1 + sin(f.x * 0.9 + 1.0)) + 0.5 * sin(f.x * 2.7 - f.y * 2.1 + 2.0);
  c += vec3(0.010, 0.016, 0.026) * smoothstep(0.1, 1.2, fog) * smoothstep(0.9, 0.2, abs(uv.y - 0.5) * 2.0);
  return c;
`;

const SHELL_VERT = /* glsl */ `
in float curv;
in float ao;
in float depth;
in float label;
out vec3 vN;
out vec3 vV;
out float vCurv;
out float vAo;
out float vDepth;
out float vLabel;
void main() {
  vLabel = label;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  vCurv = curv;
  vAo = ao;
  vDepth = depth;
  gl_Position = projectionMatrix * mv;
}`;

const SHELL_FRAG = /* glsl */ `
uniform vec3 uVein;
uniform vec3 uCrest;
uniform vec3 uBody;
uniform vec3 uEmber;
uniform float uBack;
in vec3 vN;
in vec3 vV;
in float vCurv;
in float vAo;
in float vDepth;
in float vLabel;
out vec4 outColor;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  float ndv = abs(dot(N, V));
  float fr = pow(1.0 - ndv, 2.2);
  // glowing lines in the sulci (the folds) and white at the gyral crests
  float fold = smoothstep(0.35, 0.75, vDepth) * (1.0 - smoothstep(0.85, 1.0, vDepth));
  float crest = smoothstep(0.45, 1.0, vCurv);
  vec3 c = uBody * (0.015 + 0.07 * fr);
  c += uVein * (fold * 0.09 + fr * 0.11);
  c += uEmber * pow(1.0 - ndv, 7.0) * 0.06;
  // cerebellum: its own fine parallel folia lines and a cooler, brighter tint
  // so it reads as a separate structure under the occipital lobe
  float cb = step(0.5, vLabel) * (1.0 - step(1.5, vLabel));
  float folia = smoothstep(0.15, 0.55, vCurv);
  c = mix(c, c * 0.55 + uCrest * folia * 0.07 + uVein * (0.025 + 0.06 * fr), cb);
  c += uCrest * crest * (0.015 + 0.03 * ndv) * vAo;
  c *= uBack > 0.5 ? 0.35 : 1.0;
  outColor = vec4(c, 0.0);
}`;

const FIBRE_VERT = /* glsl */ `
in float aT;
in vec4 aCurve;
in float aLabel;
uniform float uPhase;
uniform float uPx;
out float vI;
out float vW;
void main() {
  // native 1px line; brightness carries the fibre's width (0.9-2.6 px at 2160p)
  float w = mix(0.9, 2.6, aCurve.y * aCurve.y) * uPx;
  // slow luminous pulses along the veins (periodic in the loop)
  float pulse = 0.5 + 0.5 * sin(6.28318 * (uPhase * 2.0 + aCurve.z) - aT * 9.0);
  vI = w * (0.35 + 0.65 * aCurve.z) * (0.65 + 0.6 * pow(pulse, 6.0)) * (aCurve.x > 0.5 ? 0.45 : 1.0) * (aLabel > 0.5 && aLabel < 1.5 ? 0.35 : 1.0);
  vW = aCurve.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const FIBRE_FRAG = /* glsl */ `
uniform vec3 uVein;
uniform vec3 uCrest;
in float vI;
in float vW;
out vec4 outColor;
void main() {
  vec3 c = mix(uVein, uCrest, 0.15 + 0.45 * vW * vW);
  outColor = vec4(c * vI * 0.065, 0.0);
}`;

const SPARK_VERT = /* glsl */ `
${POINT_GLSL}
in vec4 aAttr;
uniform float uPhase;
out float vI;
out float vOr;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vOr = step(0.988, fract(aAttr.w * 7.77));
  float tw = 0.5 + 0.5 * sin(6.28318 * (uPhase * (2.0 + floor(aAttr.w * 5.0)) + aAttr.w * 13.0));
  gl_PointSize = pointSize(vOr > 0.5 ? 0.02 : 0.006, mv.z, vOr > 0.5 ? 5.0 : 2.4);
  vI = (0.25 + 0.75 * smoothstep(0.0, 0.9, aAttr.x)) * (0.4 + 0.6 * tw) * vPtAlpha;
  gl_Position = projectionMatrix * mv;
}`;

const SPARK_FRAG = /* glsl */ `
uniform vec3 uCrest;
uniform vec3 uVein;
uniform vec3 uEmber;
in float vI;
in float vOr;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  float a = exp(-r2 * 4.0) * step(r2, 1.0);
  vec3 c = mix(mix(uVein, uCrest, 0.35) * 0.26, uEmber * 2.8, vOr);
  outColor = vec4(c * vI * a, 0.0);
}`;

export const orbitLook: LookFactory = ({ gl, assets, width, height }) => {
  const post = new Post(
    gl,
    {
      msaa: 0,
      bloom: { strength: 0.6, threshold: 0.45, knee: 0.3, levels: 6, radius: 0.85 },
      background: BG,
      uniforms: {
        uBgTop: { value: srgb(ORBIT_COLORS.bgTop) },
        uBgBottom: { value: srgb(ORBIT_COLORS.bgBottom) },
      },
      key: null,
      exposure: 1,
    },
    assets.blueNoise,
  );
  const scene = new Scene();
  const fov = 30;
  const viewH = 3.1;
  const dist = viewH / 2 / Math.tan((fov / 2) * (Math.PI / 180));
  const cam = new PerspectiveCamera(fov, width / height, 0.05, 60);
  cam.position.set(0, 0.06, dist);
  cam.lookAt(0, 0.0, 0);
  cam.updateMatrixWorld();
  const projY = cam.projectionMatrix.elements[5];

  const tilt = new Group();
  tilt.rotation.x = TILT;
  const brain = new Group();
  tilt.add(brain);
  scene.add(tilt);

  const colors = {
    uVein: { value: new Vector3(...lin(ORBIT_COLORS.vein)) },
    uCrest: { value: new Vector3(...lin(ORBIT_COLORS.crest)) },
    uBody: { value: new Vector3(...lin(ORBIT_COLORS.body)) },
    uEmber: { value: new Vector3(...lin(ORBIT_COLORS.ember)) },
  };
  const shell = (side: typeof FrontSide | typeof BackSide) =>
    new ShaderMaterial({
      glslVersion: "300 es" as never,
      vertexShader: SHELL_VERT,
      fragmentShader: SHELL_FRAG,
      uniforms: { ...colors, uBack: { value: side === BackSide ? 1 : 0 } },
      side,
      ...ADDITIVE,
      depthTest: false,
    });
  const back = shell(BackSide);
  const front = shell(FrontSide);
  const mBack = new Mesh(cortexGeometry(assets), back);
  const mFront = new Mesh(cortexGeometry(assets), front);
  mBack.renderOrder = 0;
  mFront.renderOrder = 2;
  brain.add(mBack, mFront);

  const common = {
    uRes: { value: post.size },
    uPx: { value: pxScale(post) },
    uNear: { value: 0.05 },
    uProjY: { value: projY },
    uPhase: { value: 0 },
  };
  const fibreMat = new ShaderMaterial({
    glslVersion: "300 es" as never,
    vertexShader: FIBRE_VERT,
    fragmentShader: FIBRE_FRAG,
    uniforms: { ...common, ...colors },
    ...ADDITIVE,
    depthTest: false,
  });
  const fibres = new LineSegments(fibreLines(assets, "orbit", (i) => assets.fibres.kind[i] === 0 || i % 3 === 0), fibreMat);
  fibres.frustumCulled = false;
  fibres.renderOrder = 1;
  brain.add(fibres);

  const sparkMat = new ShaderMaterial({
    glslVersion: "300 es" as never,
    vertexShader: SPARK_VERT,
    fragmentShader: SPARK_FRAG,
    uniforms: { ...common, ...colors },
    ...ADDITIVE,
    depthTest: false,
  });
  const sparks = new Points(pointCloud(assets, "orbit", 120_000, 0), sparkMat);
  sparks.frustumCulled = false;
  sparks.renderOrder = 3;
  brain.add(sparks);

  // Space: three dust depths, near out-of-focus specks, rising embers.
  const dustCol = lin(ORBIT_COLORS.dust);
  const ember = lin(ORBIT_COLORS.ember);
  const drifts = [
    makeDrift({ seed: 81, count: 1100, min: [-7, -4.2, -9], max: [7, 4.2, -3], laps: [1, 0, 0], period: PERIOD, size: [0.006, 0.02], minPx: 2.2, color: dustCol, intensity: 0.35, twinkle: 0.5, wobble: 0.05 }, post, projY),
    makeDrift({ seed: 82, count: 1100, min: [-4.5, -2.6, -3], max: [4.5, 2.6, 0.5], laps: [-1, 0, 0], period: PERIOD, size: [0.005, 0.016], minPx: 2.4, color: dustCol, intensity: 0.5, twinkle: 0.6, wobble: 0.06 }, post, projY),
    makeDrift({ seed: 83, count: 420, min: [-3, -1.8, 0.5], max: [3, 1.8, 3.2], laps: [1, 0, 0], period: PERIOD, size: [0.004, 0.012], minPx: 2.6, color: dustCol, intensity: 0.6, twinkle: 0.6, wobble: 0.04, focus: dist, coc: 0.0035 }, post, projY),
    makeDrift({ seed: 84, count: 44, min: [-2.6, -1.6, 2.6], max: [2.6, 1.6, 5.0], laps: [0, 1, 0], period: PERIOD, size: [0.01, 0.02], minPx: 3, color: dustCol, colorB: ember, intensity: 0.14, twinkle: 0.2, focus: dist, coc: 0.02, soft: 1 }, post, projY),
    makeDrift({ seed: 85, count: 190, min: [-3.6, -2.4, -2.5], max: [3.6, 2.4, 2.0], laps: [0, 1, 0], period: PERIOD, size: [0.006, 0.016], minPx: 2.6, color: ember, intensity: 1.3, twinkle: 0.7, wobble: 0.08, focus: dist, coc: 0.0015 }, post, projY),
  ];
  // a particle stream running vertically through the brain, and clusters drifting around it
  drifts.push(
    makeDrift({ seed: 86, count: 320, min: [-0.14, -2.6, -0.16], max: [0.14, 2.6, 0.16], laps: [0, 1, 0], period: PERIOD, size: [0.004, 0.012], minPx: 2.4, color: lin("#BFEFFF"), intensity: 0.9, twinkle: 0.5, wobble: 0.05 }, post, projY),
    makeDrift({ seed: 87, count: 900, min: [-1.9, -1.2, -1.0], max: [1.9, 1.2, 1.0], laps: [1, 0, 0], period: PERIOD, size: [0.004, 0.014], minPx: 2.4, color: lin("#9FE6FF"), colorB: ember, intensity: 0.55, twinkle: 0.6, wobble: 0.12, focus: dist, coc: 0.0025 }, post, projY),
  );
  drifts.forEach((d) => scene.add(d.points));

  return {
    render(frame) {
      const f = frame % PERIOD;
      brain.rotation.y = (TAU * f) / PERIOD; // frame 150: back view, as in the reference
      tilt.updateMatrixWorld(true);
      common.uPhase.value = f / PERIOD;
      drifts.forEach((d) => d.set(f));
      post.begin();
      gl.render(scene, cam);
      post.end(f);
    },
    dispose() {
      post.dispose();
      [back, front, fibreMat, sparkMat].forEach((m) => m.dispose());
      drifts.forEach((d) => d.dispose());
    },
  };
};

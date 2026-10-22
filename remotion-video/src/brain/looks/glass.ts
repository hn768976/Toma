import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  Mesh,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
} from "three";
import type { BrainAssets } from "../engine/assets";
import { cortexGeometry, memo } from "../engine/geometry";
import { clamp, lin, smoothstep } from "../engine/math";
import { Post, pxScale } from "../engine/post";
import { ADDITIVE, buildSegments, FATLINE_FRAG_GLSL, FATLINE_GLSL, POINT_GLSL } from "../engine/primitives";
import { mulberry32, range } from "../engine/random";
import type { LookFactory } from "../engine/Stage";

// Look 6 · Brain Glass Thoughts (24 s). A violet glass brain in a still side
// view; white thought-lines draw on inside it, multiply into a web, burst into
// sparkles and fade back to the empty brain.

export const GLASS_COLORS = {
  // One data row: fresnel edge, inner body tint, thought lines, sparkles
  edge: "#6A5AFF",
  body: "#1A1250",
  line: "#FFFFFF",
  sparkle: "#F4F0FF",
};

const F = (s: number) => s * 30;
const T = {
  firstLines: F(3),
  multiply: F(8),
  webFull: F(14),
  burstEnd: F(17),
  fadeEnd: F(21),
  end: F(24),
};

const N_SPARKLES = 6000;
const N_LINES = 230; // of the baked thought-lines, this many are used

// Per-line birth frame and draw duration: ~10 lines in 3-8 s, the rest in 8-14 s
// at an accelerating rate.
const lineTiming = (n: number) => {
  const rng = mulberry32(6006);
  const early = 7;
  const birth = new Float32Array(n);
  const dur = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    if (i < early) {
      birth[i] = T.firstLines + 10 + Math.pow(i / early, 1.3) * (T.multiply - T.firstLines - 30) + range(rng, -6, 6);
      dur[i] = range(rng, 32, 50);
    } else if (i >= N_LINES) {
      birth[i] = 1e9;
      dur[i] = 1;
    } else {
      const u = (i - early) / (N_LINES - early);
      birth[i] = T.multiply + Math.pow(u, 0.7) * (T.webFull - T.multiply - 40) + range(rng, -4, 4);
      dur[i] = range(rng, 22, 40);
    }
  }
  return { birth, dur };
};

const thoughtData = (a: BrainAssets) =>
  memo(a, "glass-thoughts", () => {
    const { lines, per, position, count } = a.thoughts;
    const timing = lineTiming(lines);
    const ids = Array.from({ length: lines }, (_, i) => i);
    const geo = buildSegments(
      position,
      per,
      ids,
      (c) => [timing.birth[c], timing.dur[c], c, 0],
      (c) => count[c],
    );
    // node dots at polyline vertices
    let nn = 0;
    for (let i = 0; i < lines; i++) nn += count[i];
    const np = new Float32Array(nn * 3);
    const nd = new Float32Array(nn * 3); // birth, dur, t
    let k = 0;
    for (let i = 0; i < lines; i++) {
      for (let j = 0; j < count[i]; j++) {
        np.set(position.subarray((i * per + j) * 3, (i * per + j) * 3 + 3), k * 3);
        nd[k * 3] = timing.birth[i];
        nd[k * 3 + 1] = timing.dur[i];
        nd[k * 3 + 2] = j / Math.max(1, count[i] - 1);
        k++;
      }
    }
    const nodes = new BufferGeometry();
    nodes.setAttribute("position", new BufferAttribute(np, 3));
    nodes.setAttribute("aTime", new BufferAttribute(nd, 3));
    // sparkles sampled along the lines
    const rng = mulberry32(6116);
    const sp = new Float32Array(N_SPARKLES * 3);
    const sa = new Float32Array(N_SPARKLES * 4); // appear frame, twinkle phase, size, drift seed
    const sd = new Float32Array(N_SPARKLES * 3); // drift dir
    for (let s = 0; s < N_SPARKLES; s++) {
      const li = Math.floor(rng() * lines);
      const c = count[li];
      const u = rng() * (c - 1);
      const j = Math.min(c - 2, Math.floor(u));
      const f = u - j;
      for (let d = 0; d < 3; d++) {
        const p0 = position[(li * per + j) * 3 + d];
        const p1 = position[(li * per + j + 1) * 3 + d];
        sp[s * 3 + d] = p0 + (p1 - p0) * f;
      }
      sa[s * 4] = T.webFull + Math.pow(rng(), 1.4) * (T.burstEnd - T.webFull - 25);
      sa[s * 4 + 1] = rng() * Math.PI * 2;
      sa[s * 4 + 2] = Math.pow(rng(), 3);
      sa[s * 4 + 3] = rng();
      const th = rng() * Math.PI * 2;
      const ph = Math.acos(2 * rng() - 1);
      sd[s * 3] = Math.sin(ph) * Math.cos(th);
      sd[s * 3 + 1] = Math.sin(ph) * Math.sin(th);
      sd[s * 3 + 2] = Math.cos(ph);
    }
    const sparkles = new BufferGeometry();
    sparkles.setAttribute("position", new BufferAttribute(sp, 3));
    sparkles.setAttribute("aSp", new BufferAttribute(sa, 4));
    sparkles.setAttribute("aDir", new BufferAttribute(sd, 3));
    return { geo, nodes, sparkles };
  });

const GLASS_VERT = /* glsl */ `
in float ao;
in float curv;
out vec3 vN;
out vec3 vV;
out float vAo;
out float vCurv;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = -mv.xyz;
  vAo = ao;
  vCurv = curv;
  gl_Position = projectionMatrix * mv;
}`;

const GLASS_FRAG = /* glsl */ `
uniform vec3 uEdge;
uniform vec3 uBody;
in vec3 vN;
in vec3 vV;
in float vAo;
in float vCurv;
out vec4 outColor;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(vV);
  float ndv = abs(dot(N, V));
  float fr = pow(1.0 - ndv, 2.6);
  // folds: sulcal walls turn away from the eye -> bright violet edges
  float front = gl_FrontFacing ? 1.0 : 0.55;
  vec3 c = uEdge * fr * front * mix(0.45, 0.8, vAo);
  // a hint of crest highlight so the gyri read as glass
  float crest = smoothstep(0.35, 1.0, vCurv) * pow(ndv, 4.0);
  c += uEdge * crest * 0.05 * front;
  c += uBody * 0.05 * front;
  outColor = vec4(c, 0.0);
}`;

const LINE_VERT = /* glsl */ `
${FATLINE_GLSL}
in vec3 aA;
in vec3 aB;
in vec4 aSeg;
in vec4 aCurve;
uniform float uFrame;
uniform float uLineGain;
out float vI;
void main() {
  float birth = aCurve.x;
  float dur = aCurve.y;
  float h = clamp((uFrame - birth) / dur, 0.0, 1.0);
  float t0 = aSeg.x;
  float t1 = aSeg.y;
  float on = (uFrame >= birth && t0 < h) ? 1.0 : 0.0;
  vec3 b = aB;
  if (t1 > h) b = mix(aA, aB, clamp((h - t0) / max(t1 - t0, 1e-4), 0.0, 1.0));
  // bright moving head, settling to a steady glow
  float headDist = max(h - t1, 0.0);
  float head = (h < 1.0) ? exp(-headDist * 9.0) * 1.6 : 0.0;
  float settle = smoothstep(0.0, 0.6, (uFrame - birth - dur) / 30.0 + 0.6);
  vI = on * uLineGain * (0.42 + head + 0.1 * settle);
  vec4 c = fatLine(aA, b, 2.6 + head * 1.6, position.x, position.y);
  gl_Position = on > 0.0 ? c : vec4(2.0, 2.0, 2.0, 1.0);
}`;

const LINE_FRAG = /* glsl */ `
${FATLINE_FRAG_GLSL}
uniform vec3 uLine;
in float vI;
out vec4 outColor;
void main() {
  float a = lineCoverage() * (0.35 + 0.65 * lineProfile());
  outColor = vec4(uLine * vI * a, 0.0);
}`;

const NODE_VERT = /* glsl */ `
${POINT_GLSL}
in vec3 aTime;
uniform float uFrame;
uniform float uLineGain;
out float vI;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float h = clamp((uFrame - aTime.x) / aTime.y, 0.0, 1.0);
  float on = (uFrame >= aTime.x && aTime.z <= h + 1e-3) ? 1.0 : 0.0;
  float pop = exp(-max(h - aTime.z, 0.0) * 6.0);
  vI = on * uLineGain * (0.7 + 1.5 * pop);
  gl_PointSize = pointSize(0.012, mv.z, 7.0);
  gl_Position = on > 0.0 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
}`;

const NODE_FRAG = /* glsl */ `
uniform vec3 uLine;
in float vI;
in float vPtAlpha;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  float a = exp(-r2 * 4.0) * step(r2, 1.0);
  outColor = vec4(uLine * vI * a * vPtAlpha, 0.0);
}`;

const SPARK_VERT = /* glsl */ `
${POINT_GLSL}
in vec4 aSp;
in vec3 aDir;
uniform float uFrame;
uniform float uFadeEnd;
uniform float uBurstEnd;
out float vI;
out float vHaze;
void main() {
  float age = uFrame - aSp.x;
  float on = age >= 0.0 ? 1.0 : 0.0;
  // ease outward a little (stays well inside: lines are >= 0.07 below the cortex)
  float drift = 0.035 * (1.0 - exp(-max(age, 0.0) / 40.0));
  vec3 p = position + aDir * drift;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float tw = 0.55 + 0.45 * sin(uFrame * (0.35 + aSp.w * 0.5) + aSp.y);
  float pop = smoothstep(0.0, 6.0, age) * (1.0 + 1.5 * exp(-age / 8.0));
  float fade = 1.0 - smoothstep(uBurstEnd - 10.0, uFadeEnd - 20.0, uFrame);
  vI = on * pop * tw * fade;
  vHaze = on * smoothstep(0.0, 20.0, age) * (1.0 - smoothstep(uBurstEnd, uFadeEnd, uFrame));
  gl_PointSize = pointSize(0.006 + 0.014 * aSp.z, mv.z, 4.0);
  gl_Position = on > 0.0 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
}`;

const SPARK_FRAG = /* glsl */ `
uniform vec3 uSpark;
in float vI;
in float vHaze;
in float vPtAlpha;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  float core = exp(-r2 * 6.0);
  float star = max(exp(-abs(d.x) * 14.0) * exp(-abs(d.y) * 2.5), exp(-abs(d.y) * 14.0) * exp(-abs(d.x) * 2.5));
  float a = (core + 0.4 * star) * step(r2, 1.0) * vPtAlpha;
  outColor = vec4(uSpark * (vI * a * 1.3 + vHaze * core * 0.05), 0.0);
}`;

export const glassLook: LookFactory = ({ gl, assets, width, height }) => {
  const post = new Post(
    gl,
    {
      msaa: 0,
      bloom: { strength: 0.45, threshold: 0.55, knee: 0.25, levels: 6, radius: 0.8 },
      background: "return vec3(0.0);",
      key: [0, 0, 0],
      exposure: 1,
    },
    assets.blueNoise,
  );
  const scene = new Scene();
  const fov = 22;
  const viewH = 2.08;
  const dist = viewH / 2 / Math.tan((fov / 2) * (Math.PI / 180));
  const cam = new PerspectiveCamera(fov, width / height, 0.1, 40);
  // Side view of the left hemisphere, front to the right; the brain sits a
  // little left of centre as in the reference.
  const cx = 0.5;
  cam.position.set(cx, -0.02, dist);
  cam.lookAt(cx, -0.02, 0);
  cam.updateMatrixWorld();

  const glass = new ShaderMaterial({
    glslVersion: "300 es" as never,
    vertexShader: GLASS_VERT,
    fragmentShader: GLASS_FRAG,
    uniforms: {
      uEdge: { value: new Vector3(...lin(GLASS_COLORS.edge)) },
      uBody: { value: new Vector3(...lin(GLASS_COLORS.body)) },
    },
    side: DoubleSide,
    ...ADDITIVE,
    depthTest: false,
  });
  scene.add(new Mesh(cortexGeometry(assets), glass));

  const td = thoughtData(assets);
  const common = {
    uRes: { value: post.size },
    uPx: { value: pxScale(post) },
    uNear: { value: 0.1 },
    uCap: { value: 1 },
    uProjY: { value: cam.projectionMatrix.elements[5] },
    uFrame: { value: 0 },
    uLineGain: { value: 1 },
  };
  const lineMat = new ShaderMaterial({
    glslVersion: "300 es" as never,
    vertexShader: LINE_VERT,
    fragmentShader: LINE_FRAG,
    uniforms: { ...common, uLine: { value: new Vector3(...lin(GLASS_COLORS.line)) } },
    ...ADDITIVE,
    depthTest: false,
  });
  const lines = new Mesh(td.geo, lineMat);
  lines.frustumCulled = false;
  scene.add(lines);
  const nodeMat = new ShaderMaterial({
    glslVersion: "300 es" as never,
    vertexShader: NODE_VERT,
    fragmentShader: NODE_FRAG,
    uniforms: { ...common, uLine: lineMat.uniforms.uLine },
    ...ADDITIVE,
    depthTest: false,
  });
  const nodes = new Points(td.nodes, nodeMat);
  nodes.frustumCulled = false;
  scene.add(nodes);
  const sparkMat = new ShaderMaterial({
    glslVersion: "300 es" as never,
    vertexShader: SPARK_VERT,
    fragmentShader: SPARK_FRAG,
    uniforms: {
      ...common,
      uSpark: { value: new Vector3(...lin(GLASS_COLORS.sparkle)) },
      uBurstEnd: { value: T.burstEnd },
      uFadeEnd: { value: T.fadeEnd },
    },
    ...ADDITIVE,
    depthTest: false,
  });
  const sparkles = new Points(td.sparkles, sparkMat);
  sparkles.frustumCulled = false;
  scene.add(sparkles);

  return {
    render(frame) {
      // Lines brighten as the web densifies; dissolve into the sparkles 14-16 s.
      const dens = smoothstep(T.multiply, T.webFull, frame);
      const gain = (1 - 0.62 * dens) * (1 - smoothstep(T.webFull + 5, T.webFull + 50, frame));
      for (const m of [lineMat, nodeMat, sparkMat]) {
        m.uniforms.uFrame.value = frame;
        m.uniforms.uLineGain.value = clamp(gain);
      }
      post.begin();
      gl.render(scene, cam);
      post.end(frame);
    },
    dispose() {
      post.dispose();
      [glass, lineMat, nodeMat, sparkMat].forEach((m) => m.dispose());
    },
  };
};

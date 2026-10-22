import { BufferAttribute, BufferGeometry, Group, Matrix4, Mesh, PerspectiveCamera, Points, Scene, ShaderMaterial, Vector2, Vector3, Vector4 } from "three";
import type { BrainAssets } from "../engine/assets";
import { cortexGeometry, memo } from "../engine/geometry";
import { lin, TAU } from "../engine/math";
import { Post, pxScale } from "../engine/post";
import { ADDITIVE, buildSegments, FATLINE_FRAG_GLSL, FATLINE_GLSL, POINT_GLSL } from "../engine/primitives";
import { activeAt, hash01, makeSchedule } from "../engine/schedule";
import type { LookFactory } from "../engine/Stage";

// Looks 4-5 · Brain Solid. Realistic soft tissue turning 360deg in 600 frames,
// with small blue-white electric discharges crawling over the cortex.

export const SOLID_COLORS = {
  // One data row: tissue, warm subsurface tint, key light, rim light, arc core, arc glow
  tissue: "#A08A88",
  warm: "#C9746A",
  key: "#FFF4EC",
  rim: "#9FB8FF",
  arc: "#E2DEFF",
  arcGlow: "#8C9CFF",
};

const PERIOD = 600;
const MAX_ACTIVE = 4;
const GLOW_PTS = 10;

const ELEV = 0.3; // camera elevation (rad)
const FOV = 30;
const VIEW_H = 1.95; // visible height in brain units
const START_YAW = -0.7; // frame 0 shows the left hemisphere, three-quarter front

const yawAt = (f: number) => START_YAW + (TAU * (f % PERIOD)) / PERIOD;

// Arc schedule: one every 1-2 s, 6-15 frames, choosing an arc that faces the
// camera at that moment. Built once per asset set (needs the baked arc centres).
const arcSchedule = (a: BrainAssets) =>
  memo(a, "solid-arcs", () => {
    const camDir = new Vector3(0, Math.sin(ELEV), Math.cos(ELEV));
    const rot = new Matrix4();
    const c = new Vector3();
    return makeSchedule({
      seed: 4004,
      period: PERIOD,
      gap: [30, 60],
      dur: [6, 15],
      pick: (start, rng) => {
        rot.makeRotationY(yawAt(start + 4));
        let best = 0;
        let bestScore = -Infinity;
        for (let k = 0; k < 24; k++) {
          const i = Math.floor(rng() * a.arcs.count);
          c.fromArray(a.arcs.centre, i * 3).applyMatrix4(rot);
          const m0 = i * a.arcs.mainPts * 3;
          const m1 = ((i + 1) * a.arcs.mainPts - 1) * 3;
          const vertical = Math.abs(a.arcs.main[m1 + 1] - a.arcs.main[m0 + 1]);
          const score = c.clone().normalize().dot(camDir) + c.y * 0.15 + vertical * 0.6;
          if (score > bestScore) {
            bestScore = score;
            best = i;
          }
        }
        return best;
      },
    });
  });

const arcGeometry = (a: BrainAssets) =>
  memo(a, "solid-arc-geo", () => {
    const { count, mainPts, forkPts, forkCount } = a.arcs;
    // Pack main channels and forks into one curve table (stride = mainPts).
    const per = mainPts;
    const nCurves = count * (1 + forkCount);
    const pts = new Float32Array(nCurves * per * 3);
    const kinds: number[] = [];
    for (let i = 0; i < count; i++) {
      pts.set(a.arcs.main.subarray(i * mainPts * 3, (i + 1) * mainPts * 3), i * (1 + forkCount) * per * 3);
      kinds.push(i, -1);
      for (let f = 0; f < forkCount; f++) {
        const ci = i * (1 + forkCount) + 1 + f;
        const src = a.arcs.forks.subarray(((i * forkCount + f) * forkPts) * 3, ((i * forkCount + f + 1) * forkPts) * 3);
        pts.set(src, ci * per * 3);
      }
    }
    const ids = Array.from({ length: nCurves }, (_, k) => k);
    return buildSegments(
      pts,
      per,
      ids,
      (curve) => {
        const arc = Math.floor(curve / (1 + forkCount));
        const f = (curve % (1 + forkCount)) - 1;
        return [arc, f < 0 ? 0 : 1, f < 0 ? 0 : a.arcs.forkAt[arc * forkCount + f], 0];
      },
      (curve) => (curve % (1 + forkCount) === 0 ? mainPts : forkPts),
    );
  });

const BRAIN_VERT = /* glsl */ `
in float curv;
in float ao;
in float depth;
out vec3 vN;
out vec3 vW;
out float vCurv;
out float vAo;
out float vDepth;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vCurv = curv;
  vAo = ao;
  vDepth = depth;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const BRAIN_FRAG = /* glsl */ `
uniform vec3 uTissue;
uniform vec3 uWarm;
uniform vec3 uKeyDir;
uniform vec3 uKeyCol;
uniform vec3 uRimDir;
uniform vec3 uRimCol;
uniform vec3 uCam;
uniform vec4 uGlow[${MAX_ACTIVE * GLOW_PTS}];
uniform vec3 uGlowCol;
in vec3 vN;
in vec3 vW;
in float vCurv;
in float vAo;
in float vDepth;
out vec4 outColor;
void main() {
  vec3 N = normalize(vN);
  vec3 V = normalize(uCam - vW);
  float ndv = max(dot(N, V), 0.0);
  // wrap diffuse (soft, translucent-looking terminator)
  float wrap = 0.45;
  float nl = dot(N, uKeyDir);
  float kd = max((nl + wrap) / (1.0 + wrap), 0.0);
  float occ = mix(0.2, 1.0, vAo * vAo);
  vec3 col = uTissue * uKeyCol * kd * 0.95 * occ;
  // hemispheric ambient
  float sky = N.y * 0.5 + 0.5;
  col += uTissue * mix(vec3(0.08, 0.075, 0.08), vec3(0.17, 0.17, 0.19), sky) * occ;
  // subsurface: warm tint where light wraps past the terminator and on thin crests
  float thin = smoothstep(0.0, 0.9, vCurv);
  float sss = max(nl + 0.6, 0.0) / 1.6 - max(nl, 0.0) * 0.6;
  col += uWarm * (0.10 * sss + 0.06 * thin * kd) * occ;
  // wet sheen on the gyri, damped in the sulci
  vec3 H = normalize(uKeyDir + V);
  float spec = pow(max(dot(N, H), 0.0), 18.0) * 0.22 + pow(max(dot(N, H), 0.0), 6.0) * 0.06;
  col += uKeyCol * spec * smoothstep(-0.2, 0.5, vCurv) * vAo * vAo;
  // cool rim from behind
  float fr = pow(1.0 - ndv, 3.0);
  col += uRimCol * fr * (0.35 + 0.65 * max(dot(N, uRimDir), 0.0)) * 0.55 * mix(0.6, 1.0, vAo);
  // light from active discharges
  vec3 g = vec3(0.0);
  for (int i = 0; i < ${MAX_ACTIVE * GLOW_PTS}; i++) {
    vec4 p = uGlow[i];
    if (p.w <= 0.0) continue;
    vec3 d = vW - p.xyz;
    float r2 = dot(d, d);
    g += p.w * (exp(-r2 / 0.003) * 0.5 + exp(-r2 / 0.03) * 0.4 + exp(-r2 / 0.09) * 0.12);
  }
  // discharge light: a pale translucent haze that washes the folds toward blue-white
  float gh = clamp(g.x, 0.0, 2.0);
  col = mix(col, col * 0.45 + uGlowCol * 0.55, clamp(gh * 0.55, 0.0, 0.7)) + uGlowCol * gh * (0.18 + 0.2 * ndv);
  outColor = vec4(col, 1.0);
}`;

const ARC_VERT = /* glsl */ `
${FATLINE_GLSL}
in vec3 aA;
in vec3 aB;
in vec4 aSeg;
in vec4 aCurve;
uniform vec2 uArc[96]; // x: head (0..1, <0 = off), y: intensity
out float vI;
void main() {
  vec2 st = uArc[int(aCurve.x)];
  float head = st.x;
  float t1 = aSeg.y;
  // forks: their own head starts once the main head passes the branch point
  float h = aCurve.y > 0.5 ? (head - aCurve.z) / max(1.0 - aCurve.z, 0.2) * 1.6 : head;
  float on = (head >= 0.0 && t1 <= h + 1e-4) ? 1.0 : 0.0;
  vI = st.y * on * (aCurve.y > 0.5 ? 0.75 : 1.0);
  float w = aCurve.y > 0.5 ? 2.0 : 3.0;
  vec4 c = fatLine(aA, aB, w, position.x, position.y);
  gl_Position = on > 0.0 ? c : vec4(2.0, 2.0, 2.0, 1.0);
}`;

const ARC_FRAG = /* glsl */ `
${FATLINE_FRAG_GLSL}
uniform vec3 uArcCol;
in float vI;
out vec4 outColor;
void main() {
  float a = lineCoverage() * lineProfile();
  outColor = vec4(uArcCol * vI * a, 0.0);
}`;

// Star glints where a discharge ends (both ends of the main channel).
const GLINT_VERT = /* glsl */ `
${POINT_GLSL}
in vec2 aEnd; // arc index, end (0 start / 1 finish)
uniform vec2 uArc[96];
out float vI;
void main() {
  vec2 st = uArc[int(aEnd.x)];
  float on = st.x >= 0.0 && (aEnd.y < 0.5 || st.x >= 0.999) ? 1.0 : 0.0;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = pointSize(0.05, mv.z, 18.0);
  vI = on * st.y;
  gl_Position = on > 0.0 ? projectionMatrix * mv : vec4(2.0, 2.0, 2.0, 1.0);
}`;
const GLINT_FRAG = /* glsl */ `
uniform vec3 uArcCol;
uniform float uStar;
in float vI;
out vec4 outColor;
void main() {
  vec2 d = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(d, d);
  float star = max(exp(-abs(d.x) * 22.0) * exp(-abs(d.y) * 3.0), exp(-abs(d.y) * 22.0) * exp(-abs(d.x) * 3.0));
  float core = exp(-r2 * 28.0);
  outColor = vec4(uArcCol * vI * (core * 1.4 + star * 0.8 * uStar), 0.0);
}`;

const glintGeometry = (a: BrainAssets) =>
  memo(a, "solid-glints", () => {
    const { count, mainPts, main } = a.arcs;
    const pos = new Float32Array(count * 2 * 3);
    const end = new Float32Array(count * 2 * 2);
    for (let i = 0; i < count; i++) {
      pos.set(main.subarray(i * mainPts * 3, i * mainPts * 3 + 3), i * 6);
      pos.set(main.subarray(((i + 1) * mainPts - 1) * 3, (i + 1) * mainPts * 3), i * 6 + 3);
      end.set([i, 0, i, 1], i * 4);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(pos, 3));
    g.setAttribute("aEnd", new BufferAttribute(end, 2));
    return g;
  });

export const makeSolidLook =
  (variant: "black" | "green"): LookFactory =>
  ({ gl, assets, width, height }) => {
    const green = variant === "green";
    const post = new Post(
      gl,
      {
        msaa: 4,
        bloom: green ? null : { strength: 0.55, threshold: 0.95, knee: 0.3, levels: 6, radius: 0.85 },
        background: green ? "return vec3(0.0, 1.0, 0.0);" : "return vec3(0.0);",
        key: green ? [0, 1, 0] : [0, 0, 0],
        exposure: 1,
      },
      assets.blueNoise,
    );
    const scene = new Scene();
    const brain = new Group();
    scene.add(brain);

    const camPos = new Vector3(0, Math.sin(ELEV), Math.cos(ELEV)).multiplyScalar(VIEW_H / 2 / Math.tan((FOV / 2) * (Math.PI / 180)));
    const cam = new PerspectiveCamera(FOV, width / height, 0.1, 30);
    cam.position.copy(camPos);
    cam.lookAt(0, -0.05, 0);
    cam.updateMatrixWorld();

    const glow = Array.from({ length: MAX_ACTIVE * GLOW_PTS }, () => new Vector4());
    const mat = new ShaderMaterial({
      glslVersion: "300 es" as never,
      vertexShader: BRAIN_VERT,
      fragmentShader: BRAIN_FRAG,
      uniforms: {
        uTissue: { value: new Vector3(...lin(SOLID_COLORS.tissue)) },
        uWarm: { value: new Vector3(...lin(SOLID_COLORS.warm)) },
        uKeyDir: { value: new Vector3(-0.35, 0.75, 0.6).normalize() },
        uKeyCol: { value: new Vector3(...lin(SOLID_COLORS.key)).multiplyScalar(0.86) },
        uRimDir: { value: new Vector3(0.3, 0.35, -1).normalize() },
        uRimCol: { value: new Vector3(...lin(SOLID_COLORS.rim)) },
        uCam: { value: camPos },
        uGlow: { value: glow },
        uGlowCol: { value: new Vector3(...lin(SOLID_COLORS.arcGlow)) },
      },
    });
    brain.add(new Mesh(cortexGeometry(assets), mat));

    const arcState = Array.from({ length: 96 }, () => new Vector2(-1, 0));
    const arcMat = new ShaderMaterial({
      glslVersion: "300 es" as never,
      vertexShader: ARC_VERT,
      fragmentShader: ARC_FRAG,
      uniforms: {
        uRes: { value: post.size },
        uNear: { value: 0.1 },
        uCap: { value: 1 },
        uPx: { value: pxScale(post) },
        uArc: { value: arcState },
        uArcCol: { value: new Vector3(...lin(SOLID_COLORS.arc)).multiplyScalar(green ? 1.6 : 3.2) },
      },
      ...ADDITIVE,
      depthTest: true,
    });
    const arcs = new Mesh(arcGeometry(assets), arcMat);
    arcs.frustumCulled = false;
    arcs.renderOrder = 1;
    brain.add(arcs);

    const glintMat = new ShaderMaterial({
      glslVersion: "300 es" as never,
      vertexShader: GLINT_VERT,
      fragmentShader: GLINT_FRAG,
      uniforms: { ...arcMat.uniforms, uProjY: { value: cam.projectionMatrix.elements[5] }, uStar: { value: green ? 0 : 1 } },
      ...ADDITIVE,
      depthTest: true,
    });
    const glints = new Points(glintGeometry(assets), glintMat);
    glints.frustumCulled = false;
    glints.renderOrder = 2;
    brain.add(glints);

    const events = arcSchedule(assets);
    const tmp = new Vector3();
    const { mainPts } = assets.arcs;

    return {
      render(frame) {
        const f = frame % PERIOD;
        brain.rotation.set(0, yawAt(f), 0);
        brain.updateMatrixWorld(true);
        for (const s of arcState) {
          s.x = -1;
          s.y = 0;
        }
        glow.forEach((g) => g.set(0, 0, 0, 0));
        const act = activeAt(events, f, PERIOD).slice(0, MAX_ACTIVE);
        act.forEach(({ ev, age, p }, k) => {
          // crawl: head reaches the end at 45% of the life, then flicker and fade
          const head = Math.min(1, (age + 1) / Math.max(2, ev.dur * 0.45));
          const fade = p < 0.7 ? 1 : 1 - (p - 0.7) / 0.3;
          const flick = 0.55 + 0.45 * hash01(frame % PERIOD, ev.id * 7 + 3);
          const I = fade * flick * (0.8 + 0.4 * ev.r);
          arcState[ev.id].x = head;
          arcState[ev.id].y = I;
          for (let j = 0; j < GLOW_PTS; j++) {
            const u = (j / (GLOW_PTS - 1)) * head;
            const idx = Math.min(mainPts - 1, Math.round(u * (mainPts - 1)));
            tmp.fromArray(assets.arcs.main, (ev.id * mainPts + idx) * 3).applyMatrix4(brain.matrixWorld);
            glow[k * GLOW_PTS + j].set(tmp.x, tmp.y, tmp.z, I * (green ? 0.55 : 0.75));
          }
        });
        post.begin();
        gl.render(scene, cam);
        post.end(frame);
      },
      dispose() {
        post.dispose();
        mat.dispose();
        arcMat.dispose();
        glintMat.dispose();
      },
    };
  };

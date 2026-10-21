import * as THREE from "three";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import colors from "../../../data/colors.json";
import labels from "../../../data/neuronLabels.json";
import { LABEL_FONT, loadLabelFont } from "../../lib/fonts";
import { easeOut, smoothstep } from "../../lib/math";
import { mulberry32, unitVec } from "../../lib/random";
import { GLStage, Stage, StageContext } from "../../lib/three/GLStage";
import { V3, add, mul } from "./geometry";
import { FPS, anatomyModel, makeCamera, modelMatrix } from "./anatomyModel";
import { SparkBuffer, neuronMaterial, sparkMaterial } from "./material";

export const ANATOMY_FRAMES = 900;
const SIGNALS_LABELLED = [16, 19.1, 26.4];
const SIGNALS_CLEAN = [16, 19.1, 23.2];
const NODE_DT = 0.14;

/** All signal visuals at time t for one signal starting at t0. */
const signal = (t: number, t0: number, sparks: SparkBuffer, m: THREE.Matrix4) => {
  const M = anatomyModel();
  const out = { soma: 0, term: 0 };
  const dt = t - t0;
  if (dt < 0 || dt > 4) return out;
  const P = (p: V3): V3 => {
    const v = new THREE.Vector3(...p).applyMatrix4(m);
    return [v.x, v.y, v.z];
  };
  // In along three dendrites.
  M.dendPaths.forEach((path, i) => {
    const u = (dt - i * 0.07) / 0.8;
    if (u > 0 && u < 1) sparks.push(P(path.at(u)), Math.min(1, u * 5, (1 - u) * 10), 420);
  });
  // Soma flash.
  const ts = 0.85;
  if (dt > ts - 0.05) out.soma = 0.85 * Math.exp(-Math.max(0, dt - ts) / 0.22) * smoothstep(ts - 0.05, ts + 0.02, dt);
  // Down the hillock, then node to node (saltatory conduction).
  const uh = (dt - ts) / 0.16;
  const s0 = 0.75 / M.axon.total;
  if (uh > 0 && uh < 1) sparks.push(P(M.axon.at(uh * s0)), 1, 520);
  M.nodes.forEach((n, i) => {
    const ti = ts + 0.16 + i * NODE_DT;
    const a = dt - ti;
    if (a >= -0.02 && a < 0.5) sparks.push(P(n), Math.exp(-Math.max(0, a) / 0.09) * smoothstep(-0.02, 0.0, a), 620);
  });
  // Terminals flash and release tiny sparkles.
  const te = ts + 0.16 + M.nodes.length * NODE_DT + 0.12;
  const at = dt - te;
  if (at > -0.05) out.term = 0.7 * Math.exp(-Math.max(0, at) / 0.3) * smoothstep(-0.05, 0.03, at);
  if (at > 0 && at < 1.1) {
    const rng = mulberry32(Math.round(t0 * 1000));
    M.bulbs.forEach((b) => {
      for (let k = 0; k < 6; k++) {
        const d = unitVec(rng);
        const sp = 0.12 + 0.25 * rng();
        const age = at - 0.08 * rng();
        if (age <= 0) continue;
        const p = add(b, mul(d, sp * (1 - Math.exp(-age * 3))));
        sparks.push(P(p), Math.max(0, 1 - age / 1.0) * 0.9, 110);
      }
      sparks.push(P(b), 0.8 * Math.exp(-at / 0.25), 300);
    });
  }
  return out;
};

const makeBuild = (signals: number[]) => (ctx: StageContext): Stage => {
  const { renderer, px, height } = ctx;
  const M = anatomyModel();
  const silver = colors.neuron.silver;
  const fibreMat = neuronMaterial({ silver });
  const nucMat = neuronMaterial({ silver });
  const somaMat = neuronMaterial({ silver });
  somaMat.transparent = true;
  somaMat.depthWrite = false;
  somaMat.blending = THREE.CustomBlending;
  somaMat.blendSrc = THREE.OneFactor;
  somaMat.blendDst = THREE.OneMinusSrcAlphaFactor;
  somaMat.uniforms.uSomaAlpha.value = 0.55;
  for (const m of [fibreMat, nucMat, somaMat]) m.uniforms.uViewportH.value = height;
  const scene = new THREE.Scene();
  const group = new THREE.Group();
  group.matrixAutoUpdate = false;
  const fibres = new THREE.Mesh(M.fibres, fibreMat);
  const nucleus = new THREE.Mesh(M.nucleus, nucMat);
  const soma = new THREE.Mesh(M.soma, somaMat);
  soma.renderOrder = 2;
  for (const o of [fibres, nucleus, soma]) {
    o.frustumCulled = false;
    group.add(o);
  }
  scene.add(group);
  const sparks = new SparkBuffer(1024);
  const sparkMesh = new THREE.Points(sparks.geo, sparkMaterial(px));
  sparkMesh.frustumCulled = false;
  sparkMesh.renderOrder = 3;
  scene.add(sparkMesh);
  return {
    render: (frame, target) => {
      const t = frame / FPS;
      const cam = makeCamera(t);
      const m = modelMatrix(t);
      group.matrix.copy(m);
      group.matrixWorldNeedsUpdate = true;
      const somaScale = easeOut(smoothstep(0, 1.6, t));
      sparks.reset();
      let somaFlash = 0;
      let term = 0;
      for (const t0 of signals) {
        const r = signal(t, t0, sparks, m);
        somaFlash = Math.max(somaFlash, r.soma);
        term = Math.max(term, r.term);
      }
      sparks.commit();
      for (const mat of [fibreMat, nucMat, somaMat]) {
        mat.uniforms.uTime.value = t;
        mat.uniforms.uSomaScale.value = Math.max(1e-3, somaScale);
        (mat.uniforms.uFlash.value as Float32Array)[0] = somaFlash;
        mat.uniforms.uTerminalFlash.value = term;
      }
      renderer.setRenderTarget(target);
      renderer.setClearColor(0x000000, 1);
      renderer.clear(true, true, true);
      renderer.render(scene, cam);
    },
  };
};

const buildLabelled = makeBuild(SIGNALS_LABELLED);
const buildClean = makeBuild(SIGNALS_CLEAN);

// --- Labels -----------------------------------------------------------------

type LabelSpec = { key: keyof typeof labels; text: [number, number]; anchors: V3[]; align?: "start" | "end" };

const LABEL_START = 22.4;
const LABEL_STEP = 0.5;

const Labels: React.FC = () => {
  loadLabelFont();
  const frame = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const t = frame / FPS;
  if (t < LABEL_START - 0.6) return null;
  const M = anatomyModel();
  const cam = makeCamera(t);
  const mm = modelMatrix(t);
  const proj = (p: V3): [number, number] => {
    const v = new THREE.Vector3(...p).applyMatrix4(mm).project(cam);
    return [(v.x * 0.5 + 0.5) * W, (-v.y * 0.5 + 0.5) * H];
  };
  const A = M.anchors;
  const specs: LabelSpec[] = [
    { key: "cellBody", text: [0.335, 0.28], anchors: [A.cellBody] },
    { key: "nucleus", text: [0.345, 0.345], anchors: [A.nucleus] },
    { key: "axon", text: [0.36, 0.415], anchors: [A.axon] },
    { key: "myelinSheath", text: [0.37, 0.485], anchors: [A.myelin] },
    { key: "nodeOfRanvier", text: [0.5, 0.79], anchors: [A.node] },
    { key: "dendrites", text: [0.08, 0.85], anchors: A.dendrites },
    { key: "axonTerminals", text: [0.69, 0.33], anchors: A.terminals },
  ];
  const fontSize = 64;
  const stroke = 3;
  const col = "#D8D8D8";
  const titleP = interpolate(t, [LABEL_START - 0.4, LABEL_START + 0.4], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute" }}>
        <text x={W * 0.06} y={H * 0.105} fill="#FFFFFF" fontFamily={LABEL_FONT} fontWeight={700} fontSize={84} letterSpacing={6} opacity={titleP}>
          {labels.title}
        </text>
        <line x1={W * 0.06} y1={H * 0.13} x2={W * 0.06 + W * 0.88 * titleP} y2={H * 0.13} stroke="#FFFFFF" strokeWidth={3} />
        {specs.map((s, i) => {
          const t0 = LABEL_START + 0.3 + i * LABEL_STEP;
          const lineP = interpolate(t, [t0, t0 + 0.35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          const textP = interpolate(t, [t0 + 0.2, t0 + 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          if (lineP <= 0) return null;
          const tx = s.text[0] * W;
          const ty = s.text[1] * H;
          // Leader starts just under/beside the label, ends on the structure.
          const start: [number, number] = [tx + (s.key === "dendrites" ? 20 : -14), ty + (s.key === "dendrites" ? -fontSize * 0.95 : -fontSize * 0.33)];
          return (
            <g key={s.key}>
              {s.anchors.map((a, k) => {
                const [ax, ay] = proj(a);
                const sx = s.key === "axonTerminals" ? tx + fontSize * 6.2 : start[0];
                const sy = s.key === "axonTerminals" ? ty + 18 : start[1];
                void k;
                return (
                  <line key={k} x1={sx} y1={sy} x2={sx + (ax - sx) * lineP} y2={sy + (ay - sy) * lineP} stroke={col} strokeWidth={stroke} />
                );
              })}
              <text x={tx} y={ty} fill={col} fontFamily={LABEL_FONT} fontWeight={600} fontSize={fontSize} letterSpacing={2} opacity={textP}>
                {labels[s.key]}
              </text>
            </g>
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};

export const NeuronAnatomy_Labelled: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#000" }}>
    <GLStage build={buildLabelled} />
    <Labels />
  </AbsoluteFill>
);

export const NeuronAnatomy_Clean: React.FC = () => <GLStage build={buildClean} />;

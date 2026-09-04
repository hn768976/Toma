import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  type Quaternion,
  ShaderMaterial,
  Vector2,
} from "three";
import { c3, type Theme } from "../theme";
import { BRAIN } from "./geometry";
import { AI_ASPECT, getAiTexture } from "./aiTexture";

/**
 * The brain: instanced billboard sprites for the contour nodes, screen-space
 * quads for the connecting lines, and a billboarded "AI" plate.
 *
 * The node sprites carry their own radial falloff, which is where the brain's
 * bloom comes from. Doing it per object rather than as a post pass is what
 * keeps the plane sharp — a global bloom would fog the surface and swallow the
 * binary strings, which are most of the texture.
 *
 * Lines are built as quads that are widened in screen space in the vertex
 * shader, so their thickness is a constant fraction of frame height at 1080p
 * and at 4K alike. GL's native 1px lines would have halved in relative weight
 * between the two.
 */

export type BrainAnim = {
  /** 0..1 draw-on progress. */
  progress: number;
  /** Seconds; drives shimmer and the contour pulse. */
  time: number;
  /** 0..1 opacity of the "AI". */
  aiOpacity: number;
};

const NODE_COMMON = /* glsl */ `
uniform float uTime;
uniform float uProgress;
uniform float uPulseHead;
uniform float uPulseOn;
`;

/** Shared draw-on / shimmer / pulse maths, used by both brain shaders. */
const NODE_ANIM = /* glsl */ `
float appearOf(float order) {
  return smoothstep(order, order + 0.05, uProgress);
}
float flashOf(float order) {
  return exp(-max(0.0, uProgress - order) * 34.0) * 2.2;
}
float shimmerOf(float phase, float rate) {
  return 0.76 + 0.24 * sin(uTime * rate + phase);
}
float contourPulseOf(float param) {
  return exp(-fract(uPulseHead - param) * 9.0) * uPulseOn;
}
`;

const nodeVertex = /* glsl */ `
precision highp float;
${NODE_COMMON}
uniform float uNodeScale;

attribute vec3 iPos;
attribute float iSize;
attribute float iOrder;
attribute float iParam;
attribute float iPhase;
attribute float iRate;
attribute float iBright;

varying vec2 vQuad;
varying float vAlpha;
varying float vIntensity;

${NODE_ANIM}

void main() {
  vQuad = position.xy;

  float appear = appearOf(iOrder);
  float flash = flashOf(iOrder);
  float shimmer = shimmerOf(iPhase, iRate);
  float pulse = contourPulseOf(iParam);

  vAlpha = appear;
  vIntensity = iBright * shimmer * (1.0 + flash) + pulse * 1.6;

  float size = iSize * uNodeScale * (0.9 + 0.2 * shimmer) * (1.0 + pulse * 0.6 + flash * 0.35);
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  mv.xy += position.xy * size;
  gl_Position = projectionMatrix * mv;
}
`;

const nodeFragment = /* glsl */ `
precision highp float;
uniform vec3 uCore;
uniform vec3 uHalo;
varying vec2 vQuad;
varying float vAlpha;
varying float vIntensity;

void main() {
  float d = length(vQuad);
  if (d > 1.0) discard;
  // A hard core that clips to white plus a wide skirt: the sprite is the bloom.
  float core = exp(-d * d * 40.0);
  float halo = exp(-d * 4.6) * 0.16;
  float edge = 1.0 - smoothstep(0.85, 1.0, d);
  vec3 col = (uCore * core * 1.5 + uHalo * halo) * vIntensity * vAlpha * edge;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const lineVertex = /* glsl */ `
precision highp float;
${NODE_COMMON}
uniform vec2 uResolution;
uniform float uWidth;

attribute vec3 aOther;
attribute float aSide;
attribute float aOrder;
attribute float aParam;
attribute float aBright;

varying float vSide;
varying float vAlpha;
varying float vIntensity;

${NODE_ANIM}

void main() {
  vSide = aSide;
  // Lines follow their endpoints on, a beat later.
  float appear = appearOf(aOrder);
  vAlpha = appear;
  vIntensity = aBright * (0.62 + 0.38 * shimmerOf(aParam * 31.0, 1.1)) + contourPulseOf(aParam) * 1.4;

  vec4 clipA = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 clipB = projectionMatrix * modelViewMatrix * vec4(aOther, 1.0);
  vec2 screenA = (clipA.xy / max(clipA.w, 1e-4)) * uResolution;
  vec2 screenB = (clipB.xy / max(clipB.w, 1e-4)) * uResolution;
  vec2 dir = screenB - screenA;
  float len = length(dir);
  vec2 normal = len > 1e-5 ? vec2(-dir.y, dir.x) / len : vec2(0.0, 1.0);

  vec4 pos = clipA;
  pos.xy += (normal * aSide * uWidth / uResolution) * pos.w;
  gl_Position = pos;
}
`;

const lineFragment = /* glsl */ `
precision highp float;
uniform vec3 uColor;
varying float vSide;
varying float vAlpha;
varying float vIntensity;

void main() {
  // The quad is a little wider than the line so the edges can feather.
  float a = 1.0 - smoothstep(0.42, 1.0, abs(vSide));
  vec3 col = uColor * a * vAlpha * vIntensity;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}
`;

const aiVertex = /* glsl */ `
precision highp float;
uniform float uScale;
uniform vec3 uCenter;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(uCenter, 1.0);
  mv.xy += position.xy * uScale;
  gl_Position = projectionMatrix * mv;
}
`;

const aiFragment = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform vec3 uColor;
uniform float uOpacity;
varying vec2 vUv;
void main() {
  float m = texture2D(uMap, vUv).r;
  gl_FragColor = vec4(uColor * m * uOpacity * 1.25, 1.0);
  #include <colorspace_fragment>
}
`;

/** Quad corners in [-1,1], shared by every billboard in the scene. */
const QUAD = new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]);
const QUAD_UV = new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]);
const QUAD_INDEX = [0, 1, 2, 0, 2, 3];

const buildNodeGeometry = () => {
  const g = new InstancedBufferGeometry();
  g.setAttribute("position", new BufferAttribute(QUAD, 3));
  g.setIndex(QUAD_INDEX);
  const n = BRAIN.nodes.length;
  const pos = new Float32Array(n * 3);
  const size = new Float32Array(n);
  const order = new Float32Array(n);
  const param = new Float32Array(n);
  const phase = new Float32Array(n);
  const rate = new Float32Array(n);
  const bright = new Float32Array(n);
  BRAIN.nodes.forEach((node, i) => {
    pos[i * 3] = node.x;
    pos[i * 3 + 1] = node.y;
    pos[i * 3 + 2] = node.z;
    // The quad is 3.4x the node radius so the skirt has room to fall off.
    size[i] = node.size * 2.9;
    order[i] = node.order;
    param[i] = node.param;
    phase[i] = node.phase;
    rate[i] = node.rate;
    bright[i] = node.bright;
  });
  g.setAttribute("iPos", new InstancedBufferAttribute(pos, 3));
  g.setAttribute("iSize", new InstancedBufferAttribute(size, 1));
  g.setAttribute("iOrder", new InstancedBufferAttribute(order, 1));
  g.setAttribute("iParam", new InstancedBufferAttribute(param, 1));
  g.setAttribute("iPhase", new InstancedBufferAttribute(phase, 1));
  g.setAttribute("iRate", new InstancedBufferAttribute(rate, 1));
  g.setAttribute("iBright", new InstancedBufferAttribute(bright, 1));
  g.instanceCount = n;
  return g;
};

const buildLineGeometry = () => {
  const edges = BRAIN.edges;
  const count = edges.length;
  const pos = new Float32Array(count * 4 * 3);
  const other = new Float32Array(count * 4 * 3);
  const side = new Float32Array(count * 4);
  const order = new Float32Array(count * 4);
  const param = new Float32Array(count * 4);
  const bright = new Float32Array(count * 4);
  const index = new Uint32Array(count * 6);

  edges.forEach((edge, e) => {
    const a = BRAIN.nodes[edge.a];
    const b = BRAIN.nodes[edge.b];
    // Vertices 0,1 sit at A (sides -1/+1); 2,3 sit at B.
    const ends = [a, a, b, b];
    const opp = [b, b, a, a];
    const sides = [-1, 1, -1, 1];
    const edgeOrder = Math.min(1, Math.max(a.order, b.order) + 0.025);
    const edgeBright = Math.min(a.bright, b.bright) * 2.2;
    for (let v = 0; v < 4; v++) {
      const i = e * 4 + v;
      pos[i * 3] = ends[v].x;
      pos[i * 3 + 1] = ends[v].y;
      pos[i * 3 + 2] = ends[v].z;
      other[i * 3] = opp[v].x;
      other[i * 3 + 1] = opp[v].y;
      other[i * 3 + 2] = opp[v].z;
      side[i] = sides[v];
      order[i] = edgeOrder;
      param[i] = ends[v].param;
      bright[i] = edgeBright;
    }
    const base = e * 4;
    index.set(
      [base, base + 2, base + 1, base + 2, base + 3, base + 1],
      e * 6,
    );
  });

  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aOther", new BufferAttribute(other, 3));
  g.setAttribute("aSide", new BufferAttribute(side, 1));
  g.setAttribute("aOrder", new BufferAttribute(order, 1));
  g.setAttribute("aParam", new BufferAttribute(param, 1));
  g.setAttribute("aBright", new BufferAttribute(bright, 1));
  g.setIndex(new BufferAttribute(index, 1));
  return g;
};

/** Both are pure geometry, so they are built once and shared. */
let geometries: {
  nodes: InstancedBufferGeometry;
  lines: BufferGeometry;
} | null = null;
const getGeometries = () => {
  if (!geometries) {
    geometries = { nodes: buildNodeGeometry(), lines: buildLineGeometry() };
  }
  return geometries;
};

export const Brain: React.FC<{
  theme: Theme;
  anim: BrainAnim;
  /** Uniform scale applied to the brain's local units. */
  scale: number;
  position: [number, number, number];
  /** Orientation: faces the camera, plus a slight lean. */
  quaternion: Quaternion;
  /** Where the "AI" sits, in brain-local units. */
  aiCenter: [number, number, number];
  aiHeight: number;
}> = ({ theme, anim, scale, position, quaternion, aiCenter, aiHeight }) => {
  const size = useThree((s) => s.size);
  const geo = getGeometries();

  const materials = useMemo(() => {
    const shared = {
      uTime: { value: 0 },
      uProgress: { value: 0 },
      uPulseHead: { value: 0 },
      uPulseOn: { value: 0 },
    };
    const nodes = new ShaderMaterial({
      vertexShader: nodeVertex,
      fragmentShader: nodeFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      uniforms: {
        ...shared,
        uNodeScale: { value: 1 },
        uCore: { value: c3(theme.node).clone() },
        uHalo: { value: c3(theme.contour).clone() },
      },
    });
    const lines = new ShaderMaterial({
      vertexShader: lineVertex,
      fragmentShader: lineFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      uniforms: {
        ...shared,
        uResolution: { value: new Vector2(1, 1) },
        uWidth: { value: 2 },
        uColor: { value: c3(theme.contour).clone() },
      },
    });
    const ai = new ShaderMaterial({
      vertexShader: aiVertex,
      fragmentShader: aiFragment,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      toneMapped: false,
      uniforms: {
        uMap: { value: getAiTexture() },
        uColor: { value: c3(theme.ai).clone() },
        uOpacity: { value: 0 },
        uScale: { value: 1 },
        uCenter: { value: [0, 0, 0] },
      },
    });
    return { nodes, lines, ai };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme.id]);

  // A faint pulse runs around the contour every few seconds: it travels for
  // about a third of the cycle, then the contour rests.
  const cycle = (anim.time % 5.2) / 5.2;
  const pulseOn =
    Math.min(1, cycle / 0.04) * Math.max(0, 1 - Math.max(0, cycle - 0.3) / 0.08);

  for (const m of [materials.nodes, materials.lines]) {
    m.uniforms.uTime.value = anim.time;
    m.uniforms.uProgress.value = anim.progress;
    m.uniforms.uPulseHead.value = cycle / 0.34;
    m.uniforms.uPulseOn.value = Math.max(0, pulseOn) * 0.9;
  }
  materials.nodes.uniforms.uNodeScale.value = scale;
  materials.lines.uniforms.uResolution.value.set(size.width, size.height);
  // Line weight as a fraction of frame height, so 1080p and 4K match.
  materials.lines.uniforms.uWidth.value = size.height * 0.0013;
  materials.ai.uniforms.uOpacity.value = anim.aiOpacity;
  materials.ai.uniforms.uScale.value = (aiHeight * scale) / 2;
  materials.ai.uniforms.uCenter.value = aiCenter;

  return (
    <group position={position} quaternion={quaternion} scale={scale}>
      <mesh geometry={geo.lines} frustumCulled={false}>
        <primitive object={materials.lines} attach="material" />
      </mesh>
      <mesh geometry={geo.nodes} frustumCulled={false}>
        <primitive object={materials.nodes} attach="material" />
      </mesh>
      <mesh frustumCulled={false}>
        <planeGeometry args={[2 * AI_ASPECT, 2]} />
        <primitive object={materials.ai} attach="material" />
      </mesh>
    </group>
  );
};

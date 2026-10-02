import { useMemo } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  ShaderMaterial,
  Vector2,
  Vector4,
} from "three";
import type { OrbitModel, StrandModel } from "./model";

/**
 * Points per orbit curve. Way above the 256 minimum so trails stay smooth
 * at 4K and at the 6000 px stills.
 */
export const ORBIT_SEGMENTS = 1024;

/** One ribbon: ORBIT_SEGMENTS+1 points along u ∈ [0,1], two verts each (side ±1). */
const buildRibbon = () => {
  const n = ORBIT_SEGMENTS + 1;
  const u = new Float32Array(n * 2);
  const side = new Float32Array(n * 2);
  const pos = new Float32Array(n * 2 * 3); // unused by the shader, required by three
  const index: number[] = [];
  for (let i = 0; i < n; i++) {
    u[i * 2] = u[i * 2 + 1] = i / ORBIT_SEGMENTS;
    side[i * 2] = -1;
    side[i * 2 + 1] = 1;
    if (i < n - 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("aU", new BufferAttribute(u, 1));
  g.setAttribute("aSide", new BufferAttribute(side, 1));
  g.setIndex(index);
  return g;
};

let sharedRibbon: BufferGeometry | null = null;
const ribbon = () => (sharedRibbon ??= buildRibbon());

const VERT = /* glsl */ `
#define TAU 6.283185307179586
attribute float aU;
attribute float aSide;
uniform float uA;
uniform float uB;
uniform float uHead;
uniform float uDir;
uniform float uTrail;
uniform float uTime;
uniform vec4 uWR[3];
uniform vec4 uWN[3];
uniform vec2 uBaseOff;
uniform vec2 uRes;
uniform float uWidthPx;
uniform float uBaseWidthPx;
varying float vU;
varying float vSide;

vec3 curve(float u, float spread){
  float th = TAU * u;
  vec2 cs = vec2(cos(th), sin(th));
  vec3 p = vec3(uA * cs.x, uB * cs.y, 0.0);
  vec3 outward = normalize(vec3(uB * cs.x, uA * cs.y, 0.0));
  float r = uBaseOff.x;
  float n = uBaseOff.y;
  for (int j = 0; j < 3; j++){
    r += uWR[j].x * sin(TAU * (uWR[j].y * u + uWR[j].z * uTime) + uWR[j].w);
    n += uWN[j].x * sin(TAU * (uWN[j].y * u + uWN[j].z * uTime) + uWN[j].w);
  }
  return p + spread * (outward * r + vec3(0.0, 0.0, n));
}

void main(){
  // distance behind the electron, worked out from its CURRENT phase only
  float d = fract(uDir * (uHead - aU));
  float tr = d < uTrail ? 1.0 - d / uTrail : 0.0;
  // strands pinch together at the head and fan out along the tail
  float spread = mix(1.0, 0.35, tr * tr);
  float e = 0.5 / ${ORBIT_SEGMENTS}.0;
  mat4 mvp = projectionMatrix * modelViewMatrix;
  vec4 c  = mvp * vec4(curve(aU, spread), 1.0);
  vec4 c1 = mvp * vec4(curve(aU + e, spread), 1.0);
  vec4 c0 = mvp * vec4(curve(aU - e, spread), 1.0);
  vec2 dir = (c1.xy / c1.w - c0.xy / c0.w) * uRes;
  dir = dir / max(length(dir), 1e-6);
  vec2 nrm = vec2(-dir.y, dir.x);
  float halfW = mix(uBaseWidthPx, uWidthPx, sqrt(tr));
  c.xy += nrm * aSide * halfW * 2.0 / uRes * c.w;
  gl_Position = c;
  vU = aU;
  vSide = aSide;
}
`;

const FRAG = /* glsl */ `
#define TAU 6.283185307179586
uniform vec3 uColor;
uniform float uHead;
uniform float uDir;
uniform float uTrail;
uniform float uTime;
uniform float uTrailI;
uniform float uBaseI;
uniform float uGain;
uniform vec4 uFlick;
uniform float uDepthOnly;
varying float vU;
varying float vSide;
void main(){
  float d = fract(uDir * (uHead - vU));
  float tr = d < uTrail ? pow(1.0 - d / uTrail, 1.6) : 0.0;
  float flick = 1.0 + uFlick.x * sin(TAU * (uFlick.y * vU + uFlick.z * uTime) + uFlick.w);
  float inten = uBaseI + uTrailI * tr * flick;
  // soft gaussian cross-section that reaches exactly 0 at the ribbon edge
  float xs = (exp(-vSide * vSide * 4.0) - 0.0183156) / 0.9816844;
  if (uDepthOnly > 0.5) {
    // depth for the DoF pass: the ribbon core, wherever the line is visible
    if (xs < 0.4 || inten < 0.05) discard;
    gl_FragColor = vec4(0.0);
    return;
  }
  gl_FragColor = vec4(uColor * inten * uGain * xs, 1.0);
}
`;

export const makeStrandMaterial = (depthOnly: boolean) =>
  new ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uA: { value: 1 },
      uB: { value: 1 },
      uHead: { value: 0 },
      uDir: { value: 1 },
      uTrail: { value: 0.25 },
      uTime: { value: 0 },
      uWR: { value: [new Vector4(), new Vector4(), new Vector4()] },
      uWN: { value: [new Vector4(), new Vector4(), new Vector4()] },
      uBaseOff: { value: new Vector2() },
      uRes: { value: new Vector2(1920, 1080) },
      uWidthPx: { value: 2 },
      uBaseWidthPx: { value: 1 },
      uColor: { value: new Color() },
      uTrailI: { value: 1 },
      uBaseI: { value: 0 },
      uGain: { value: 1 },
      uFlick: { value: new Vector4() },
      uDepthOnly: { value: depthOnly ? 1 : 0 },
    },
    transparent: true,
    side: DoubleSide,
    depthTest: true,
    depthWrite: depthOnly,
    colorWrite: !depthOnly,
    blending: AdditiveBlending,
  });

export type StrandFrame = {
  head: number; // electron phase [0,1)
  time: number; // loop fraction [0,1)
  res: Vector2; // drawing-buffer size in px
};

const setStrandUniforms = (
  m: ShaderMaterial,
  o: OrbitModel,
  s: StrandModel,
  f: StrandFrame,
  look: {
    trail: number; trailWidth: number; baseWidth: number; baseIntensity: number;
    trailIntensity: number; color: Color;
  },
) => {
  const u = m.uniforms;
  const dir = Math.sign(o.laps) || 1;
  u.uA.value = o.a;
  u.uB.value = o.b;
  u.uHead.value = (((f.head - dir * s.lag) % 1) + 1) % 1;
  u.uDir.value = dir;
  u.uTrail.value = look.trail * s.trailScale;
  u.uTime.value = f.time;
  for (let j = 0; j < 3; j++) {
    (u.uWR.value[j] as Vector4).fromArray(s.wr, j * 4);
    (u.uWN.value[j] as Vector4).fromArray(s.wn, j * 4);
  }
  (u.uBaseOff.value as Vector2).set(s.baseOff[0], s.baseOff[1]);
  (u.uRes.value as Vector2).copy(f.res);
  // widths are fractions of frame height → identical framing at any resolution
  u.uWidthPx.value = look.trailWidth * f.res.y;
  u.uBaseWidthPx.value = look.baseWidth * f.res.y;
  (u.uColor.value as Color).copy(look.color);
  u.uTrailI.value = look.trailIntensity;
  u.uBaseI.value = look.baseIntensity;
  u.uGain.value = s.gain;
  (u.uFlick.value as Vector4).fromArray(s.flick);
};

export const Strand: React.FC<{
  orbit: OrbitModel;
  strand: StrandModel;
  frame: StrandFrame;
  look: Parameters<typeof setStrandUniforms>[4];
  depthPrepass: boolean;
}> = ({ orbit, strand, frame, look, depthPrepass }) => {
  const color = useMemo(() => makeStrandMaterial(false), []);
  const depth = useMemo(() => (depthPrepass ? makeStrandMaterial(true) : null), [depthPrepass]);
  // uniforms are set during render from the frame number only
  setStrandUniforms(color, orbit, strand, frame, look);
  if (depth) setStrandUniforms(depth, orbit, strand, frame, look);
  return (
    <>
      <mesh geometry={ribbon()} material={color} frustumCulled={false} renderOrder={10} />
      {depth ? (
        <mesh geometry={ribbon()} material={depth} frustumCulled={false} renderOrder={50} />
      ) : null}
    </>
  );
};

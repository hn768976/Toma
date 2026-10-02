import { useMemo } from "react";
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  Vector3,
} from "three";
import { SIMPLEX_4D } from "../lib/glsl";
import { cycleFrac, loopCircle, loopSin } from "../lib/loop";
import { bokehAt, type AtomModel } from "./model";

const MAX_BOKEH = 16;

const VERT = /* glsl */ `
uniform float uZ;
void main(){ gl_Position = vec4(position.xy, uZ, 1.0); }
`;

const FRAG = /* glsl */ `
${SIMPLEX_4D}
uniform vec2 uRes;
uniform vec2 uLoop;
uniform vec2 uDrift;
uniform vec2 uShift;
uniform vec3 uCenter, uEdge, uNebA, uNebB, uWarm;
uniform float uNebula;
uniform vec3 uBokeh[${MAX_BOKEH}];
uniform vec4 uBokehCol[${MAX_BOKEH}];
uniform int uBokehCount;

void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;
  // p is in frame-height units, centred: independent of resolution
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) + uShift;
  vec3 col;
#ifdef NAVY
  float r = length(p * vec2(0.78, 1.05));
  float vig = 1.0 - smoothstep(0.08, 0.95, r);
  col = mix(uEdge, uCenter, vig * vig * (3.0 - 2.0 * vig));
  if (uNebula > 0.5) {
    vec4 q = vec4(p * 1.1 + uDrift, uLoop * 0.42);
    float w = fbm4(q + vec4(5.2, 1.3, 0.0, 0.0), 3);
    float n = fbm4(q + vec4(0.55 * w, 0.4 * w, 0.0, 0.0), 5);
    float clouds = smoothstep(-0.25, 0.7, n);
    float hi = smoothstep(0.25, 0.85, n);
    float tint = smoothstep(-0.4, 0.5, w);
    vec3 neb = mix(uNebA, uNebB, tint) * clouds * clouds + uWarm * hi * hi * 0.5;
    col += neb * (0.3 + 0.7 * vig);
  }
#else
  float r = length(p * vec2(0.8, 1.0));
  float vig = 1.0 - smoothstep(0.25, 1.1, r);
  col = mix(uEdge, uCenter, vig);
  if (uNebula > 0.5) {
    vec4 q = vec4(p * 0.95 + uDrift, uLoop * 0.35);
    float w = fbm4(q + vec4(2.4, 8.1, 0.0, 0.0), 3);
    float teal = smoothstep(-0.2, 0.7, fbm4(q + vec4(0.35 * w, 0.25 * w, 0.0, 0.0), 4));
    float blue = smoothstep(-0.35, 0.55, fbm4(q * vec4(0.8, 0.8, 1.0, 1.0) + vec4(9.3, 3.7, 0.0, 0.0), 3));
    float warm = smoothstep(0.25, 0.75, fbm4(q * vec4(1.1, 1.1, 1.0, 1.0) + vec4(-4.1, 6.6, 0.0, 0.0), 3));
    // darker pocket behind the atom so it reads clearly
    float pocket = smoothstep(0.08, 0.42, length(p));
    col += uNebB * blue * blue * 0.8 + uNebA * teal * teal * (0.3 + 0.7 * pocket) + uWarm * warm * teal * pocket;
  }
  for (int i = 0; i < ${MAX_BOKEH}; i++){
    if (i >= uBokehCount) break;
    vec3 b = uBokeh[i];
    float d = length(p - b.xy);
    float disc = 1.0 - smoothstep(b.z * 0.82, b.z, d);
    float rim = 0.8 + 0.2 * smoothstep(b.z * 0.4, b.z * 0.9, d);
    col += uBokehCol[i].rgb * uBokehCol[i].a * disc * rim;
  }
#endif
  gl_FragColor = vec4(col, 1.0);
}
`;

/** NDC z for a plane `dist` in front of a perspective camera (so DoF sees a sensible depth). */
export const ndcZ = (dist: number, near: number, far: number) =>
  (far + near) / (far - near) - (2 * far * near) / ((far - near) * dist);

let fsQuad: PlaneGeometry | null = null;

export const Background: React.FC<{
  model: AtomModel;
  frame: number;
  res: Vector2;
  z: number;
  nebula: boolean;
  bokeh: boolean;
  shift: [number, number];
}> = ({ model, frame, res, z, nebula, bokeh, shift }) => {
  const look = model.look;
  const navy = look.background === "navy-nebula";
  const mat = useMemo(() => {
    const c = look.colors;
    return new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      defines: navy ? { NAVY: "" } : {},
      uniforms: {
        uZ: { value: 0.99 },
        uRes: { value: new Vector2() },
        uLoop: { value: new Vector2() },
        uDrift: { value: new Vector2() },
        uShift: { value: new Vector2() },
        uCenter: { value: new Color(c.bgCenter) },
        uEdge: { value: new Color(c.bgEdge) },
        uNebA: { value: new Color(c.nebulaA) },
        uNebB: { value: new Color(c.nebulaB) },
        uWarm: { value: new Color(c.nebulaWarm) },
        uNebula: { value: 1 },
        uBokeh: { value: Array.from({ length: MAX_BOKEH }, () => new Vector3()) },
        uBokehCol: {
          value: Array.from({ length: MAX_BOKEH }, () => [0, 0, 0, 0]).flat(),
        },
        uBokehCount: { value: 0 },
      },
      depthTest: false,
      depthWrite: true,
    });
  }, [look, navy]);

  const u = mat.uniforms;
  u.uZ.value = z;
  (u.uRes.value as Vector2).copy(res);
  (u.uLoop.value as Vector2).fromArray(loopCircle(1, frame));
  // background drift: a small closed circle, whole cycles per loop
  const dc = look.motion.bgDriftCycles;
  (u.uDrift.value as Vector2).set(
    model.bgDrift[0] + 0.12 * loopSin(dc, frame),
    model.bgDrift[1] + 0.12 * loopSin(dc, frame, Math.PI / 2),
  );
  (u.uShift.value as Vector2).fromArray(shift);
  u.uNebula.value = nebula ? 1 : 0;

  if (look.bokeh && bokeh) {
    const palette = [new Color(look.colors.nebulaA), new Color(look.colors.nebulaB), new Color(look.colors.nebulaWarm)];
    const cols: number[] = [];
    model.bokeh.forEach((b, i) => {
      const [x, y] = bokehAt(b, frame);
      (u.uBokeh.value[i] as Vector3).set(x, y, b.r);
      const c = palette[b.color];
      cols.push(c.r * 0.55, c.g * 0.55, c.b * 0.55, b.intensity);
    });
    while (cols.length < MAX_BOKEH * 4) cols.push(0);
    u.uBokehCol.value = cols;
    u.uBokehCount.value = model.bokeh.length;
  } else {
    u.uBokehCount.value = 0;
  }

  return (
    <mesh geometry={(fsQuad ??= new PlaneGeometry(2, 2))} material={mat} frustumCulled={false} renderOrder={-100} />
  );
};

const STAR_VERT = /* glsl */ `
#define TAU 6.283185307179586
attribute float aSize;
attribute float aBright;
attribute float aCycles;
attribute float aPhase;
uniform float uZ;
uniform float uT;
uniform float uScale;
uniform vec2 uShift;
varying float vB;
void main(){
  vB = aBright * (0.7 + 0.3 * sin(TAU * aCycles * uT + aPhase));
  gl_Position = vec4(position.xy - uShift, uZ, 1.0);
  gl_PointSize = aSize * uScale;
}
`;
const STAR_FRAG = /* glsl */ `
uniform vec3 uColor;
varying float vB;
void main(){
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  float a = exp(-r2 * 4.0) * (1.0 - smoothstep(0.7, 1.0, r2));
  gl_FragColor = vec4(uColor * vB * a, 1.0);
}
`;

/** Fine star scatter: positions fixed at build time, twinkle in whole cycles. */
export const Stars: React.FC<{ model: AtomModel; frame: number; res: Vector2; z: number; shift: [number, number] }> = ({
  model,
  frame,
  res,
  z,
  shift,
}) => {
  const { geom, mat } = useMemo(() => {
    const s = model.stars;
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(s.flatMap((t) => [t.x, t.y, 0])), 3));
    g.setAttribute("aSize", new BufferAttribute(new Float32Array(s.map((t) => t.size)), 1));
    g.setAttribute("aBright", new BufferAttribute(new Float32Array(s.map((t) => t.bright)), 1));
    g.setAttribute("aCycles", new BufferAttribute(new Float32Array(s.map((t) => t.cycles)), 1));
    g.setAttribute("aPhase", new BufferAttribute(new Float32Array(s.map((t) => t.phase)), 1));
    const m = new ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: {
        uZ: { value: 0.99 },
        uT: { value: 0 },
        uScale: { value: 1 },
        uShift: { value: new Vector2() },
        uColor: { value: new Color("#dfe8ff") },
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    return { geom: g, mat: m };
  }, [model]);
  const u = mat.uniforms;
  u.uZ.value = z;
  // star twinkle uses integer aCycles, so the loop fraction is enough
  u.uT.value = cycleFrac(1, frame);
  u.uScale.value = res.y / 1080;
  (u.uShift.value as Vector2).set((shift[0] * 2 * res.y) / res.x, shift[1] * 2);
  return <points geometry={geom} material={mat} frustumCulled={false} renderOrder={-90} />;
};

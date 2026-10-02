import { useMemo } from "react";
import { AdditiveBlending, Color, ShaderMaterial, Vector2 } from "three";
import { BILLBOARD_VERT, SIMPLEX_4D } from "../lib/glsl";
import { loopCircle, loopSin } from "../lib/loop";
import { unitQuad } from "./Sprites";

const FRAG = /* glsl */ `
${SIMPLEX_4D}
uniform vec3 uA;
uniform vec3 uB;
uniform float uI;
uniform vec2 uLoop1;
uniform vec2 uLoop2;
varying vec2 vP;
void main(){
  float r = length(vP);
  // falls to exactly 0 at the quad edge → black stays black
  float fall = 1.0 - smoothstep(0.0, 1.0, r);
  fall *= fall;
  float n1 = fbm4(vec4(vP * 1.7, uLoop1 * 0.9), 4) * 0.5 + 0.5;
  float n2 = fbm4(vec4(vP * 3.1 + 4.0, uLoop2 * 0.7), 3) * 0.5 + 0.5;
  float smoke = smoothstep(0.2, 0.8, n1) * (0.6 + 0.4 * n2);
  vec3 col = mix(uA, uB, smoothstep(0.35, 0.7, n2));
  float core = exp(-r * r / 0.08) * 0.9;
  gl_FragColor = vec4(col * uI * fall * (smoke + core), 1.0);
}
`;

/**
 * Look 2's breathing cloud of green-cyan glow. Looping 4D noise (time on a
 * circle) — no particles, no history.
 */
export const Smoke: React.FC<{
  frame: number;
  size: number;
  intensity: number;
  breathCycles: number;
  a: Color;
  b: Color;
}> = ({ frame, size, intensity, breathCycles, a, b }) => {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: BILLBOARD_VERT,
        fragmentShader: FRAG,
        uniforms: {
          uSize: { value: 1 },
          uA: { value: new Color() },
          uB: { value: new Color() },
          uI: { value: 1 },
          uLoop1: { value: new Vector2() },
          uLoop2: { value: new Vector2() },
        },
        transparent: true,
        depthTest: false,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  const breath = loopSin(breathCycles, frame);
  const u = mat.uniforms;
  u.uSize.value = size * 2 * (1 + 0.14 * breath);
  u.uI.value = intensity * (1 + 0.45 * loopSin(breathCycles, frame, 0.4));
  (u.uA.value as Color).copy(a);
  (u.uB.value as Color).copy(b);
  (u.uLoop1.value as Vector2).fromArray(loopCircle(1, frame));
  (u.uLoop2.value as Vector2).fromArray(loopCircle(2, frame));
  return <mesh geometry={unitQuad()} material={mat} frustumCulled={false} renderOrder={1} />;
};

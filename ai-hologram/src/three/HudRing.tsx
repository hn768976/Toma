import { useMemo } from "react";
import * as THREE from "three";
import { hexToRgb } from "../lib/color";

/**
 * A HUD ring lying flat on the plane.
 *
 * Everything — the band profile, the arc segmentation, the tick marks and the
 * sweep-on entrance — is computed in the fragment shader from the local polar
 * coordinate, so the ring stays crisp at any output resolution and needs no
 * texture. The entrance sweeps around the circumference with a bright leading
 * edge rather than fading up: on this kind of HUD, things get constructed.
 *
 * The geometry is padded past the band on both sides so the falloff has
 * somewhere to land; that soft tail is what reads as bloom on the ring.
 */
export type RingMode = 0 | 1 | 2; // 0 band, 1 ticked, 2 segmented arcs

const PAD = 0.42;

const VERT = /* glsl */ `
varying vec2 vLocal;
void main() {
  vLocal = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uInner;
uniform float uOuter;
uniform float uSpin;
uniform float uSegments;
uniform float uDuty;
uniform float uTicks;
uniform float uMode;
uniform float uReveal;
uniform float uDir;
uniform float uIntensity;
uniform float uAlpha;

varying vec2 vLocal;

const float TAU = 6.28318530718;

float band(float r, float a, float b, float soft) {
  return smoothstep(a - soft, a + soft, r) * (1.0 - smoothstep(b - soft, b + soft, r));
}

void main() {
  float r = length(vLocal);
  float ang = atan(vLocal.y, vLocal.x) / TAU + 0.5; // 0..1, unrotated
  float t = fract(ang + uSpin);

  float w = uOuter - uInner;
  float soft = max(w * 0.35, 0.012);

  float value = 0.0;
  if (uMode < 0.5) {
    value = band(r, uInner, uOuter, soft);
  } else if (uMode < 1.5) {
    // A thin base rail with radial ticks standing off it.
    float base = band(r, uInner, uInner + w * 0.14, 0.012);
    float ticksR = band(r, uInner + w * 0.3, uOuter, 0.014);
    float tickA = 1.0 - smoothstep(0.3, 0.38, fract(t * uTicks));
    // Every fourth tick is longer.
    float major = step(0.75, fract(t * uTicks * 0.25));
    float ticksLong = band(r, uInner + w * 0.3, uOuter + w * 0.5, 0.014) * major;
    value = base + max(ticksR, ticksLong) * tickA;
  } else {
    float segA = 1.0 - smoothstep(uDuty - 0.06, uDuty, fract(t * uSegments));
    value = band(r, uInner, uOuter, soft) * segA;
  }

  // Soft outer falloff on both sides of the band — the ring's own bloom.
  float mid = (uInner + uOuter) * 0.5;
  float hk = abs(r - mid) / (w * 2.6 + 0.14);
  float halo = exp(-hk * hk) * 0.3;
  value += halo;

  // Sweep-on, with a hot leading edge.
  float rt = uDir > 0.0 ? ang : 1.0 - ang;
  float on = 1.0 - smoothstep(uReveal - 0.035, uReveal, rt);
  float k = (uReveal - rt) / 0.03;
  float edge = exp(-k * k) * step(rt, uReveal + 0.001);
  if (uReveal >= 0.999) {
    on = 1.0;
    edge = 0.0;
  }
  // Before the sweep starts the ring is simply not there — without this the
  // leading edge leaves a hot sliver sitting at angle zero from frame 0.
  float armed = step(0.0005, uReveal);
  on *= armed;
  edge *= armed;

  float amount = (value * on + edge * value * 2.2) * uIntensity * uAlpha;
  gl_FragColor = vec4(uColor * amount, 1.0);
}
`;

export const HudRing: React.FC<{
  inner: number;
  outer: number;
  color: string;
  spin: number;
  segments?: number;
  duty?: number;
  ticks?: number;
  mode: RingMode;
  reveal: number;
  dir?: 1 | -1;
  intensity: number;
  alpha: number;
  y: number;
  stretchX?: number;
  renderOrder?: number;
}> = ({
  inner,
  outer,
  color,
  spin,
  segments = 0,
  duty = 1,
  ticks = 0,
  mode,
  reveal,
  dir = 1,
  intensity,
  alpha,
  y,
  stretchX = 1,
  renderOrder = 0,
}) => {
  const material = useMemo(() => {
    const c = hexToRgb(color);
    return new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uColor: { value: new THREE.Vector3(c.r, c.g, c.b) },
        uInner: { value: inner },
        uOuter: { value: outer },
        uSpin: { value: 0 },
        uSegments: { value: segments },
        uDuty: { value: duty },
        uTicks: { value: ticks },
        uMode: { value: mode },
        uReveal: { value: 0 },
        uDir: { value: dir },
        uIntensity: { value: 1 },
        uAlpha: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneFactor,
      blendEquation: THREE.AddEquation,
      toneMapped: false,
      side: THREE.DoubleSide,
    });
  }, [color, inner, outer, segments, duty, ticks, mode, dir]);

  const geometry = useMemo(
    () => new THREE.RingGeometry(Math.max(0.001, inner - PAD), outer + PAD, 320, 1),
    [inner, outer],
  );

  material.uniforms.uSpin.value = spin;
  material.uniforms.uReveal.value = reveal;
  material.uniforms.uIntensity.value = intensity;
  material.uniforms.uAlpha.value = alpha;

  return (
    <mesh
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, y, 0]}
      scale={[stretchX, 1, 1]}
      renderOrder={renderOrder}
      frustumCulled={false}
    />
  );
};

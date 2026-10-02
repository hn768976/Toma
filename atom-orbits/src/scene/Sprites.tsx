import { useMemo } from "react";
import { AdditiveBlending, Color, PlaneGeometry, ShaderMaterial } from "three";
import { BILLBOARD_VERT } from "../lib/glsl";

let quad: PlaneGeometry | null = null;
export const unitQuad = () => (quad ??= new PlaneGeometry(1, 1));

const ELECTRON_FRAG = /* glsl */ `
uniform vec3 uCore;
uniform vec3 uHalo;
uniform float uCoreI, uHaloI, uStar;
varying vec2 vP;
float ray(vec2 p, float len, float thick){
  return exp(-abs(p.x) / len) * exp(-p.y * p.y / thick);
}
void main(){
  float r = length(vP);
  float edge = 1.0 - smoothstep(0.55, 1.0, r);
  float core = exp(-r * r / 0.0016);
  float halo = 0.6 * exp(-r * r / 0.012) + 0.4 * exp(-r / 0.11);
  // soft cross flare, screen-aligned like a lens star
  float star = ray(vP, 0.13, 0.0012) + ray(vP.yx, 0.13, 0.0012);
  vec2 d = mat2(0.7071, -0.7071, 0.7071, 0.7071) * vP;
  star += 0.3 * (ray(d, 0.07, 0.0008) + ray(d.yx, 0.07, 0.0008));
  vec3 col = uCore * core * uCoreI + uHalo * (halo * uHaloI + star * uStar * uHaloI);
  gl_FragColor = vec4(col * edge, 1.0);
}
`;

/** Electron: tiny hot core + halo (+ optional star flare). Depth-tested at its centre, so the nucleus hides it. */
export const Electron: React.FC<{
  position: [number, number, number];
  size: number;
  core: Color;
  halo: Color;
  coreIntensity: number;
  haloIntensity: number;
  star: number;
}> = ({ position, size, core, halo, coreIntensity, haloIntensity, star }) => {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: BILLBOARD_VERT,
        fragmentShader: ELECTRON_FRAG,
        uniforms: {
          uSize: { value: 1 },
          uCore: { value: new Color() },
          uHalo: { value: new Color() },
          uCoreI: { value: 1 },
          uHaloI: { value: 1 },
          uStar: { value: 0 },
        },
        transparent: true,
        depthTest: true,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [],
  );
  const u = mat.uniforms;
  u.uSize.value = size;
  (u.uCore.value as Color).copy(core);
  (u.uHalo.value as Color).copy(halo);
  u.uCoreI.value = coreIntensity;
  u.uHaloI.value = haloIntensity;
  u.uStar.value = star;
  return (
    <mesh position={position} geometry={unitQuad()} material={mat} frustumCulled={false} renderOrder={20} />
  );
};

const GLOW_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uI, uSigma, uRing, uRingW, uRingI;
varying vec2 vP;
void main(){
  float r = length(vP);
  float g = exp(-r * r / (uSigma * uSigma));
  float ring = uRingI * exp(-pow((r - uRing) / uRingW, 2.0));
  float edge = 1.0 - smoothstep(0.7, 1.0, r);
  gl_FragColor = vec4(uColor * (g * uI + ring) * edge, 1.0);
}
`;

/** Soft additive glow disc around the nucleus. */
export const Glow: React.FC<{
  size: number;
  color: Color;
  intensity: number;
  sigma?: number;
  ring?: [number, number, number];
  depthTest?: boolean;
}> = ({ size, color, intensity, sigma = 0.4, ring = [0, 1, 0], depthTest = false }) => {
  const mat = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: BILLBOARD_VERT,
        fragmentShader: GLOW_FRAG,
        uniforms: {
          uSize: { value: 1 },
          uColor: { value: new Color() },
          uI: { value: 1 },
          uSigma: { value: 0.4 },
          uRing: { value: 0 },
          uRingW: { value: 1 },
          uRingI: { value: 0 },
        },
        transparent: true,
        depthTest,
        depthWrite: false,
        blending: AdditiveBlending,
      }),
    [depthTest],
  );
  const u = mat.uniforms;
  u.uSize.value = size;
  (u.uColor.value as Color).copy(color);
  u.uI.value = intensity;
  u.uSigma.value = sigma;
  u.uRing.value = ring[0];
  u.uRingW.value = ring[1];
  u.uRingI.value = ring[2];
  return <mesh geometry={unitQuad()} material={mat} frustumCulled={false} renderOrder={5} />;
};

import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { TextureSet } from "../lib/textures";
import { HASH, NOISE } from "./glsl";

/**
 * Light shared by Earth and Moon: w = 0 -> directional (xyz = direction
 * TOWARD the light), w = 1 -> point light at xyz (the Sun in comp 3).
 */
export type BodyLight = {
  light: THREE.Vector4;
  intensity: number;
  fill: number;
};

const LIGHT_PARS = /* glsl */ `
uniform vec4 uLight;
uniform float uIntensity;
uniform float uFill;
vec3 lightDirAt(vec3 worldPos) {
  return uLight.w > 0.5 ? normalize(uLight.xyz - worldPos) : normalize(uLight.xyz);
}
`;

const SPHERE_VERT = /* glsl */ `
varying vec3 vWorldPos;
varying vec3 vWorldN;
varying vec3 vObjN;
varying vec2 vUv;
void main() {
  vUv = uv;
  vObjN = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const EARTH_FRAG = /* glsl */ `
${LIGHT_PARS}
uniform sampler2D uDay;
uniform sampler2D uOcean;
uniform float uRim;
uniform float uSat;
varying vec3 vWorldPos;
varying vec3 vWorldN;
varying vec2 vUv;
void main() {
  vec3 N = normalize(vWorldN);
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 L = lightDirAt(vWorldPos);
  vec3 day = texture2D(uDay, vUv).rgb;
  float luma = dot(day, vec3(0.2126, 0.7152, 0.0722));
  day = max(mix(vec3(luma), day, uSat), 0.0);
  float ocean = texture2D(uOcean, vUv).r;
  float ndl = dot(N, L);
  float diff = clamp((ndl + 0.04) / 1.04, 0.0, 1.0);
  // Night side: dark but not black (a faint cool fill).
  vec3 col = day * (diff * uIntensity + uFill * vec3(0.55, 0.65, 1.0));
  // Ocean: slightly deeper, cooler blue (no sun glint; the references show none).
  col *= mix(vec3(1.0), vec3(0.85, 0.92, 1.05), ocean);
  // Atmospheric haze toward the limb, stronger on the day side.
  float fres = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  float lit = smoothstep(-0.25, 0.6, ndl);
  col = mix(col, vec3(0.32, 0.55, 1.0) * (0.04 + lit * uIntensity * 0.6), clamp(fres * 0.55 * uRim * (0.25 + 0.75 * lit), 0.0, 1.0));
  gl_FragColor = vec4(col, 1.0);
}
`;

const CLOUD_FRAG = /* glsl */ `
${LIGHT_PARS}
uniform sampler2D uClouds;
uniform float uAmount;
varying vec3 vWorldPos;
varying vec3 vWorldN;
varying vec2 vUv;
void main() {
  vec3 N = normalize(vWorldN);
  vec3 L = lightDirAt(vWorldPos);
  float a = texture2D(uClouds, vUv).r;
  a = smoothstep(0.03, 0.7, a);
  a = clamp(a * (0.45 + 0.2 * a) * uAmount, 0.0, 0.95);
  float diff = clamp((dot(N, L) + 0.06) / 1.06, 0.0, 1.0);
  vec3 col = vec3(1.0) * (diff * uIntensity * 0.95 + uFill * 0.8);
  gl_FragColor = vec4(col * a, a);
}
`;

const ATMO_FRAG = /* glsl */ `
${LIGHT_PARS}
uniform float uRim;
uniform float uShell;
varying vec3 vWorldPos;
varying vec3 vWorldN;
void main() {
  // Back faces of a slightly larger shell: glow just outside the limb.
  vec3 N = normalize(vWorldN);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float x = -dot(N, V);
  float limb = sqrt(max(1.0 - 1.0 / (uShell * uShell), 1e-4));
  float t = clamp(x / limb, 0.0, 1.0);
  float glow = pow(t, 3.2);
  vec3 L = lightDirAt(vWorldPos);
  float lit = smoothstep(-0.45, 0.55, dot(N, L));
  vec3 col = vec3(0.30, 0.56, 1.0) * glow * (0.02 + lit * uIntensity * 0.6) * uRim;
  gl_FragColor = vec4(col, 1.0);
}
`;

const MOON_FRAG = /* glsl */ `
${LIGHT_PARS}
uniform sampler2D uColor;
uniform sampler2D uBump;
uniform vec2 uBumpTexel;
uniform float uBumpScale;
uniform float uAlbedo;
varying vec3 vWorldPos;
varying vec3 vObjN;
varying vec2 vUv;
uniform mat3 uObjToWorld;
void main() {
  vec3 n = normalize(vObjN);
  vec3 T = normalize(vec3(n.z, 0.0, -n.x) + vec3(1e-5, 0.0, 0.0));
  vec3 B = cross(n, T);
  float h0 = texture2D(uBump, vUv).r;
  float hu = texture2D(uBump, vUv + vec2(uBumpTexel.x, 0.0)).r;
  float hv = texture2D(uBump, vUv + vec2(0.0, uBumpTexel.y)).r;
  vec3 pn = normalize(n - uBumpScale * ((hu - h0) * T + (hv - h0) * B));
  vec3 N = normalize(uObjToWorld * pn);
  vec3 L = lightDirAt(vWorldPos);
  vec3 albedo = texture2D(uColor, vUv).rgb * uAlbedo;
  float ndl = dot(N, L);
  float diff = clamp(ndl, 0.0, 1.0);
  vec3 col = albedo * (diff * uIntensity * 1.05 + uFill * vec3(0.6, 0.65, 0.8));
  gl_FragColor = vec4(col, 1.0);
}
`;

const SUN_FRAG = /* glsl */ `
${HASH}
${NOISE}
uniform float uPhase;
varying vec3 vWorldPos;
varying vec3 vWorldN;
varying vec3 vObjN;
void main() {
  vec3 N = normalize(vWorldN);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float mu = clamp(dot(N, V), 0.0, 1.0);
  // Granulation: noise on the sphere, drifting round a closed loop.
  float a = 6.2831853 * uPhase;
  vec3 drift = vec3(cos(a), sin(a), 0.0) * 0.6;
  vec3 p = vObjN * 9.0;
  float g = fbm(p + drift, 4);
  float cells = vnoise(vObjN * 26.0 + drift * 2.0);
  float gran = 0.78 + 0.32 * g + 0.14 * cells;
  // Limb darkening (linear law) with a warmer edge.
  float limb = 1.0 - 0.62 * (1.0 - mu);
  vec3 core = vec3(1.0, 0.86, 0.55);
  vec3 edge = vec3(1.0, 0.42, 0.10);
  vec3 col = mix(edge, core, pow(mu, 0.45)) * limb * gran * 3.4;
  gl_FragColor = vec4(col, 1.0);
}
`;

const GLOW_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const GLOW_FRAG = /* glsl */ `
uniform float uStrength;
uniform float uInner;
uniform float uSize;
varying vec2 vP;
void main() {
  float r = length(vP) / uSize;
  float d = max(r - uInner, 0.0);
  float g = 0.35 / (1.0 + pow(d * 5.0, 2.0)) + 0.45 * exp(-d * 9.0);
  g *= 1.0 - smoothstep(0.75, 1.0, r);
  vec3 col = mix(vec3(1.0, 0.45, 0.12), vec3(1.0, 0.78, 0.45), exp(-d * 6.0));
  gl_FragColor = vec4(col * g * uStrength, 1.0);
}
`;

const HALO_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uInner;
uniform float uFall;
varying vec2 vP;
void main() {
  // vP in units of the plane half-size; inner = body radius in those units.
  float r = length(vP);
  float d = max(r - uInner, 0.0) / (1.0 - uInner);
  float g = exp(-d * uFall) * (1.0 - smoothstep(0.8, 1.0, r));
  gl_FragColor = vec4(uColor * g, 1.0);
}
`;

const HALO_VERT = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xy * 2.0;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

/** Soft additive glow on a camera-facing quad, depth-tested (so a body in front hides it). */
const Halo: React.FC<{
  size: number;
  inner: number;
  fall: number;
  color: THREE.Color;
  quaternion: THREE.Quaternion;
  renderOrder?: number;
}> = ({ size, inner, fall, color, quaternion, renderOrder = 3 }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: HALO_VERT,
        fragmentShader: HALO_FRAG,
        uniforms: {
          uColor: { value: new THREE.Color() },
          uInner: { value: 0.5 },
          uFall: { value: 3 },
        },
        ...additive,
      }),
    [],
  );
  useLayoutEffect(() => {
    (mat.uniforms.uColor.value as THREE.Color).copy(color);
    mat.uniforms.uInner.value = inner;
    mat.uniforms.uFall.value = fall;
  }, [mat, color, inner, fall]);
  return (
    <mesh
      geometry={UNIT_PLANE}
      material={mat}
      quaternion={quaternion}
      scale={[size * 2, size * 2, 1]}
      renderOrder={renderOrder}
    />
  );
};

const additive = {
  transparent: true,
  depthWrite: false,
  blending: THREE.CustomBlending,
  blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
} as const;

const lightUniforms = () => ({
  uLight: { value: new THREE.Vector4(0, 1, 0, 0) },
  uIntensity: { value: 1 },
  uFill: { value: 0.05 },
});

const applyLight = (m: THREE.ShaderMaterial, l: BodyLight) => {
  (m.uniforms.uLight.value as THREE.Vector4).copy(l.light);
  m.uniforms.uIntensity.value = l.intensity;
  m.uniforms.uFill.value = l.fill;
};

const SPHERE = new THREE.SphereGeometry(1, 160, 96);
const SPHERE_LO = new THREE.SphereGeometry(1, 96, 64);

export type EarthPose = {
  position: THREE.Vector3;
  /** Spin angle about the (tilted) North Pole axis, radians, CCW from above. */
  spin: number;
  tiltRad: number;
  /** Lean of the pole toward the camera (+z), radians. */
  leanRad: number;
  radius: number;
};

/** Spin group: tilt the axis, then spin about it. */
const useEarthMatrix = (pose: EarthPose) =>
  useMemo(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion()
      .setFromAxisAngle(new THREE.Vector3(1, 0, 0), pose.leanRad)
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -pose.tiltRad),
      )
      .multiply(
        new THREE.Quaternion().setFromAxisAngle(
          new THREE.Vector3(0, 1, 0),
          pose.spin,
        ),
      );
    return { m, q };
  }, [pose.tiltRad, pose.leanRad, pose.spin]);

export const Earth: React.FC<{
  textures: TextureSet;
  pose: EarthPose;
  light: BodyLight;
  rim: number;
  clouds: number;
  saturation: number;
  haze: number;
  cameraQuat: THREE.Quaternion;
}> = ({ textures, pose, light, rim, clouds, saturation, haze, cameraQuat }) => {
  const mats = useMemo(() => {
    const surface = new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERT,
      fragmentShader: EARTH_FRAG,
      uniforms: {
        ...lightUniforms(),
        uDay: { value: textures.earthDay },
        uOcean: { value: textures.earthOcean },
        uRim: { value: 1 },
        uSat: { value: 1 },
      },
    });
    const clouds = new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERT,
      fragmentShader: CLOUD_FRAG,
      uniforms: {
        ...lightUniforms(),
        uClouds: { value: textures.earthClouds },
        uAmount: { value: 1 },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    const atmo = new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERT,
      fragmentShader: ATMO_FRAG,
      uniforms: { ...lightUniforms(), uRim: { value: 1 }, uShell: { value: 1.09 } },
      side: THREE.BackSide,
      ...additive,
    });
    return { surface, clouds, atmo };
  }, [textures]);

  const { q } = useEarthMatrix(pose);

  useLayoutEffect(() => {
    applyLight(mats.surface, light);
    applyLight(mats.clouds, light);
    applyLight(mats.atmo, light);
    mats.surface.uniforms.uRim.value = rim;
    mats.atmo.uniforms.uRim.value = rim;
    mats.surface.uniforms.uSat.value = saturation;
    mats.clouds.uniforms.uAmount.value = clouds;
  }, [mats, light, rim, saturation, clouds]);

  const hazeColor = useMemo(
    () => new THREE.Color(0.012, 0.03, 0.09).multiplyScalar(haze),
    [haze],
  );

  const r = pose.radius;
  return (
    <group position={pose.position}>
      <group quaternion={q} scale={[r, r, r]}>
        <mesh geometry={SPHERE} material={mats.surface} renderOrder={0} />
        <mesh
          geometry={SPHERE_LO}
          material={mats.clouds}
          scale={[1.006, 1.006, 1.006]}
          renderOrder={2}
        />
      </group>
      {haze > 0 ? (
        <Halo
          size={r * 1.8}
          inner={1 / 1.8}
          fall={3.0}
          color={hazeColor}
          quaternion={cameraQuat}
          renderOrder={-3}
        />
      ) : null}
      <mesh
        geometry={SPHERE_LO}
        material={mats.atmo}
        scale={[r * 1.09, r * 1.09, r * 1.09]}
        renderOrder={3}
      />
    </group>
  );
};

export const Moon: React.FC<{
  textures: TextureSet;
  position: THREE.Vector3;
  /** Orientation (tidal locking: the near side, object +x, faces Earth). */
  quaternion: THREE.Quaternion;
  radius: number;
  light: BodyLight;
  albedo: number;
  glow: number;
  cameraQuat: THREE.Quaternion;
}> = ({ textures, position, quaternion, radius, light, albedo, glow, cameraQuat }) => {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: SPHERE_VERT,
        fragmentShader: MOON_FRAG,
        uniforms: {
          ...lightUniforms(),
          uColor: { value: textures.moonColor },
          uBump: { value: textures.moonBump },
          uBumpTexel: { value: new THREE.Vector2(1 / 1024, 1 / 512) },
          uBumpScale: { value: 2.2 },
          uObjToWorld: { value: new THREE.Matrix3() },
          uAlbedo: { value: 1 },
        },
      }),
    [textures],
  );
  useLayoutEffect(() => {
    applyLight(mat, light);
    (mat.uniforms.uObjToWorld.value as THREE.Matrix3).setFromMatrix4(
      new THREE.Matrix4().makeRotationFromQuaternion(quaternion),
    );
    mat.uniforms.uAlbedo.value = albedo;
  }, [mat, light, quaternion, albedo]);
  const glowColor = useMemo(
    () => new THREE.Color(0.9, 0.88, 0.85).multiplyScalar(0.16 * glow),
    [glow],
  );
  return (
    <group position={position}>
      <mesh
        geometry={SPHERE}
        material={mat}
        quaternion={quaternion}
        scale={[radius, radius, radius]}
      />
      {glow > 0 ? (
        <Halo
          size={radius * 1.7}
          inner={1 / 1.7}
          fall={4.5}
          color={glowColor}
          quaternion={cameraQuat}
        />
      ) : null}
    </group>
  );
};

export const Sun: React.FC<{
  position: THREE.Vector3;
  radius: number;
  phase: number;
  glow: number;
  cameraQuat: THREE.Quaternion;
}> = ({ position, radius, phase, glow, cameraQuat }) => {
  const mats = useMemo(() => {
    const surface = new THREE.ShaderMaterial({
      vertexShader: SPHERE_VERT,
      fragmentShader: SUN_FRAG,
      uniforms: { uPhase: { value: 0 } },
    });
    const halo = new THREE.ShaderMaterial({
      vertexShader: GLOW_VERT,
      fragmentShader: GLOW_FRAG,
      uniforms: { uStrength: { value: 1 }, uInner: { value: 0.16 }, uSize: { value: 1 } },
      ...additive,
      depthTest: true,
    });
    return { surface, halo };
  }, []);
  useLayoutEffect(() => {
    mats.surface.uniforms.uPhase.value = phase;
    mats.halo.uniforms.uStrength.value = glow;
    mats.halo.uniforms.uSize.value = radius * 4.0;
    mats.halo.uniforms.uInner.value = 1 / 4.0;
  }, [mats, phase, glow, radius]);
  const haloSize = radius * 4.0;
  return (
    <group position={position}>
      <mesh geometry={SPHERE} material={mats.surface} scale={[radius, radius, radius]} />
      <mesh quaternion={cameraQuat} material={mats.halo} renderOrder={4}>
        <planeGeometry args={[haloSize * 2, haloSize * 2]} />
      </mesh>
    </group>
  );
};

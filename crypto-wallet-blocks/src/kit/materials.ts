import * as THREE from "three";

export const linearColor = (hex: string) => new THREE.Color(hex); // three converts sRGB hex to linear

// Bright, anti-aliased edges for box-like glass (blocks, panels, padlock
// body). The geometry is a unit box scaled by `uSize`; the distance to the
// nearest edge is the median of the three face distances, measured in world
// units, so line width does not depend on the output resolution.
const EDGE_VERT = /* glsl */ `
uniform vec3 uSize;
varying vec3 vP;
varying vec3 vN;
varying vec3 vViewN;
varying vec3 vViewPos;
void main() {
  vP = position * uSize;
  vN = normal;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vViewN = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * mv;
}`;

const EDGE_FRAG = /* glsl */ `
uniform vec3 uSize;
uniform vec3 uColor;
uniform float uIntensity;
uniform float uWidth;
uniform float uGlow;
uniform float uInner;
uniform float uFresnel;
uniform float uOpacity;
// panel extras
uniform sampler2D uTex;
uniform float uTexAmt;
uniform float uSide;
uniform float uFill;
uniform float uFaceFill;
uniform vec2 uTexOffset;
varying vec3 vP;
varying vec3 vN;
varying vec3 vViewN;
varying vec3 vViewPos;
void main() {
  vec3 d = uSize * 0.5 - abs(vP);
  float e = max(min(d.x, d.y), min(max(d.x, d.y), d.z));
  float aa = max(fwidth(e), 1e-5);
  float line = 1.0 - smoothstep(uWidth - aa, uWidth + aa, e);
  float glow = exp(-e / (uWidth * 6.0));
  float inset = min(uSize.x, uSize.y) * 0.2;
  float li = 1.0 - smoothstep(uWidth * 0.3, uWidth * 0.3 + aa * 1.5, abs(e - inset));
  float fres = pow(1.0 - abs(dot(normalize(vViewN), normalize(-vViewPos))), 2.5);
  float v = line + glow * uGlow + li * uInner + fres * uFresnel + uFaceFill * (0.55 + 0.45 * glow);
  if (uTexAmt > 0.0 || uSide > 0.0 || uFill > 0.0) {
    if (vN.z > 0.5) {
      vec2 uv = (vP.xy / uSize.xy + 0.5) + uTexOffset;
      v += texture2D(uTex, uv).r * uTexAmt + uFill;
    } else if (abs(vN.z) < 0.5) {
      float t = clamp(vP.z / uSize.z + 0.5, 0.0, 1.0);
      v += uSide * t * t;
    }
  }
  gl_FragColor = vec4(uColor * uIntensity * v * uOpacity, 1.0);
}`;

export type EdgeOpts = {
  color: THREE.Color;
  intensity?: number;
  width?: number;
  glow?: number;
  inner?: number;
  fresnel?: number;
  tex?: THREE.Texture | null;
  texAmt?: number;
  side?: number;
  fill?: number;
};

export const makeEdgeMaterial = (o: EdgeOpts) =>
  new THREE.ShaderMaterial({
    vertexShader: EDGE_VERT,
    fragmentShader: EDGE_FRAG,
    uniforms: {
      uSize: { value: new THREE.Vector3(1, 1, 1) },
      uColor: { value: o.color.clone() },
      uIntensity: { value: o.intensity ?? 1 },
      uWidth: { value: o.width ?? 0.008 },
      uGlow: { value: o.glow ?? 0.25 },
      uInner: { value: o.inner ?? 0 },
      uFresnel: { value: o.fresnel ?? 0 },
      uOpacity: { value: 1 },
      uTex: { value: o.tex ?? null },
      uTexAmt: { value: o.texAmt ?? 0 },
      uSide: { value: o.side ?? 0 },
      uFill: { value: o.fill ?? 0 },
      uFaceFill: { value: 0 },
      uTexOffset: { value: new THREE.Vector2(0, 0) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });

// Backdrop: a big inverted sphere, near-black with a soft glow. Computed in
// float in the shader (no 8-bit gradient textures to band).
export const makeBackdropMaterial = (bg: THREE.Color, glow: THREE.Color) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uBg: { value: bg },
      uGlow: { value: glow },
      uDir: { value: new THREE.Vector3(-0.25, -0.12, -1).normalize() },
      uDir2: { value: new THREE.Vector3(-0.8, -0.35, -0.6).normalize() },
      uGlowAmt: { value: 1 },
      uBgAmt: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBg; uniform vec3 uGlow; uniform vec3 uDir; uniform vec3 uDir2; uniform float uGlowAmt; uniform float uBgAmt;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float a = acos(clamp(dot(d, uDir), -1.0, 1.0));
        float a2 = acos(clamp(dot(d, uDir2), -1.0, 1.0));
        // Levels taken from the reference: navy ~sRGB(5,9,17) up top, a
        // little lighter low down, blue concentrated low on the left.
        float g = exp(-a * a / 0.35) * 0.05 + exp(-a2 * a2 / 0.25) * 0.35;
        float low = 1.0 - smoothstep(-0.3, 0.3, d.y);
        float top = smoothstep(0.0, 0.7, d.y);
        vec3 c = uBg * uBgAmt * (1.7 - 0.45 * top + 1.2 * low) + uGlow * uGlowAmt * (g + 0.03 * low);
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide,
    depthWrite: false,
  });

// Dark floor with a soft light pool under the wallet and a faint glow pool,
// fading out into the backdrop.
export const makeFloorMaterial = (bg: THREE.Color, spot: THREE.Color, glow: THREE.Color) =>
  new THREE.ShaderMaterial({
    uniforms: {
      uBg: { value: bg },
      uSpot: { value: spot },
      uGlow: { value: glow },
      uSpotPos: { value: new THREE.Vector2(0.1, 0.25) },
      uGlowPos: { value: new THREE.Vector2(-3.6, 0.2) },
      uSpotAmt: { value: 0.2 },
      uGlowAmt: { value: 1 },
      uBgAmt: { value: 1 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vXZ;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vXZ = w.xz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBg; uniform vec3 uSpot; uniform vec3 uGlow;
      uniform vec2 uSpotPos; uniform vec2 uGlowPos; uniform float uSpotAmt; uniform float uGlowAmt; uniform float uBgAmt;
      varying vec2 vXZ;
      void main() {
        vec2 s = (vXZ - uSpotPos) * vec2(0.7, 1.0);
        float spot = exp(-dot(s, s) / 0.55) + 0.3 * exp(-dot(s, s) / 2.5);
        vec2 g = (vXZ - uGlowPos) * vec2(0.4, 0.7);
        float glow = exp(-dot(g, g) / 2.2);
        vec3 c = uBg * uBgAmt * 3.2 + uSpot * spot * uSpotAmt + uGlow * (glow * uGlowAmt + 0.06 * uGlowAmt + 0.05);
        float r = length(vXZ);
        float a = 1.0 - smoothstep(10.0, 26.0, r);
        gl_FragColor = vec4(c, a);
      }`,
    transparent: true,
    depthWrite: true,
  });

// Glossy sheen across the dark screen: lighter toward the top-left. Done in
// float in the shader (an 8-bit texture gradient this subtle would band).
export const makeSheenMaterial = (tint: THREE.Color) =>
  new THREE.ShaderMaterial({
    uniforms: { uTint: { value: tint }, uAmt: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uTint; uniform float uAmt;
      varying vec2 vUv;
      void main() {
        float d = dot(vUv - vec2(0.0, 1.0), normalize(vec2(1.0, -1.0))) / 1.414;
        float g = 0.012 * (1.0 - smoothstep(0.0, 1.0, d)) + 0.002;
        gl_FragColor = vec4(uTint * g * uAmt, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

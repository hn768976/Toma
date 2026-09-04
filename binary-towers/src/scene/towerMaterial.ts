import * as THREE from "three";

const VERT = /* glsl */ `
varying vec2 vUv;
varying float vDepth;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

/**
 * Depth of field is done here, per plane, with a 13-tap disc. Each tower gets
 * its own radius from its distance to the camera (see dofRadius), which is why
 * near towers can be soft while the mid band stays sharp — a single
 * full-screen blur cannot do that.
 */
const FRAG = /* glsl */ `
precision highp float;

uniform sampler2D map;
uniform vec2 uvRepeat;
uniform vec2 uvOffset;
uniform vec2 blurUv;
uniform vec3 tint;
uniform float opacity;
uniform float mirror;
uniform float verticalFade;
uniform float topFade;
uniform vec3 fogColor;
uniform float fogDensity;

varying vec2 vUv;
varying float vDepth;

void main() {
  // Both faces of the curtain show readable digits: without this the back of a
  // plane shows mirrored glyphs, and a mirrored "1" is not a 1.
  float sx = gl_FrontFacing ? vUv.x : 1.0 - vUv.x;
  float sy = mix(vUv.y, 1.0 - vUv.y, mirror);
  vec2 base = vec2(sx, sy) * uvRepeat + uvOffset;

  vec4 col;
  if (blurUv.x + blurUv.y < 0.00004) {
    col = texture2D(map, base);
  } else {
    vec2 r1 = blurUv * 0.55;
    col  = texture2D(map, base) * 0.16;
    col += texture2D(map, base + vec2( 1.000,  0.000) * r1) * 0.09;
    col += texture2D(map, base + vec2( 0.500,  0.866) * r1) * 0.09;
    col += texture2D(map, base + vec2(-0.500,  0.866) * r1) * 0.09;
    col += texture2D(map, base + vec2(-1.000,  0.000) * r1) * 0.09;
    col += texture2D(map, base + vec2(-0.500, -0.866) * r1) * 0.09;
    col += texture2D(map, base + vec2( 0.500, -0.866) * r1) * 0.09;
    col += texture2D(map, base + vec2( 0.866,  0.500) * blurUv) * 0.05;
    col += texture2D(map, base + vec2( 0.000,  1.000) * blurUv) * 0.05;
    col += texture2D(map, base + vec2(-0.866,  0.500) * blurUv) * 0.05;
    col += texture2D(map, base + vec2(-0.866, -0.500) * blurUv) * 0.05;
    col += texture2D(map, base + vec2( 0.000, -1.000) * blurUv) * 0.05;
    col += texture2D(map, base + vec2( 0.866, -0.500) * blurUv) * 0.05;
  }

  float fade = mix(1.0, pow(clamp(vUv.y, 0.0, 1.0), 1.6), verticalFade);
  fade *= mix(1.0, smoothstep(1.0, 0.82, vUv.y), topFade);

  float f = clamp(1.0 - exp(-pow(fogDensity * vDepth, 2.0)), 0.0, 1.0);

  vec3 rgb = mix(col.rgb * tint, fogColor, f * 0.55);
  float a = col.a * opacity * fade * (1.0 - f);
  if (a < 0.004) discard;
  gl_FragColor = vec4(rgb, a);
}
`;

export type TowerUniforms = {
  map: { value: THREE.Texture | null };
  uvRepeat: { value: THREE.Vector2 };
  uvOffset: { value: THREE.Vector2 };
  blurUv: { value: THREE.Vector2 };
  tint: { value: THREE.Color };
  opacity: { value: number };
  mirror: { value: number };
  verticalFade: { value: number };
  topFade: { value: number };
  fogColor: { value: THREE.Color };
  fogDensity: { value: number };
};

export const createTowerMaterial = () => {
  const uniforms: TowerUniforms = {
    map: { value: null },
    uvRepeat: { value: new THREE.Vector2(1, 1) },
    uvOffset: { value: new THREE.Vector2(0, 0) },
    blurUv: { value: new THREE.Vector2(0, 0) },
    tint: { value: new THREE.Color(1, 1, 1) },
    opacity: { value: 1 },
    mirror: { value: 0 },
    verticalFade: { value: 0 },
    topFade: { value: 1 },
    fogColor: { value: new THREE.Color(0, 0, 0) },
    fogDensity: { value: 0.02 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms: uniforms as unknown as Record<string, THREE.IUniform>,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
  });

  return { material, uniforms };
};

/**
 * Five depth zones rather than one global blur:
 *   0-2.5   heavy foreground defocus
 *   2.5-8   near transition, sharpening
 *   8-19    the sharp band (digits must read here)
 *   19-42   far transition, softening
 *   42+     far dissolve, capped so it never becomes a smear
 * Radius is in world units on the tower face.
 */
export const dofRadius = (distance: number) => {
  if (distance < 8) {
    const t = Math.max(0, Math.min(1, (distance - 2.5) / 5.5));
    return 0.115 * (1 - t) * (1 - t);
  }
  if (distance < 19) return 0;
  return Math.min(0.17, (distance - 19) * 0.0046);
};

/**
 * Post chain: a physically-ish bloom built from a downsample/upsample pyramid
 * (the "dual filter" approach), then tonemap, grain and dither.
 *
 * A single wide gaussian cannot give the glow this reference needs - the haze
 * reaches most of the way across the frame. A pyramid does: each level doubles
 * the effective radius for a quarter of the cost, so six levels reach very far
 * while staying cheap and free of ringing.
 */

export const QUAD_VERT = `#version 300 es
precision highp float;
out vec2 vUv;
void main() {
  // Full-screen triangle from gl_VertexID; no vertex buffer needed.
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

/** Soft-knee bright pass. Feeds the top of the pyramid. */
export const PREFILTER_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2  uTexel;
uniform float uThreshold;
uniform float uKnee;

void main() {
  // 4-tap box while halving resolution, so nothing aliases into the pyramid.
  vec3 c = texture(uTex, vUv + uTexel * vec2(-1.0, -1.0)).rgb
         + texture(uTex, vUv + uTexel * vec2( 1.0, -1.0)).rgb
         + texture(uTex, vUv + uTexel * vec2(-1.0,  1.0)).rgb
         + texture(uTex, vUv + uTexel * vec2( 1.0,  1.0)).rgb;
  c *= 0.25;

  float br = max(c.r, max(c.g, c.b));
  float soft = clamp(br - uThreshold + uKnee, 0.0, 2.0 * uKnee);
  soft = soft * soft / (4.0 * uKnee + 1e-5);
  float w = max(soft, br - uThreshold) / max(br, 1e-5);
  fragColor = vec4(c * w, 1.0);
}
`;

/** 13-tap downsample, the Call-of-Duty style filter: stable, no pulsing. */
export const DOWNSAMPLE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2 uTexel;

void main() {
  vec2 t = uTexel;
  vec3 a = texture(uTex, vUv + t * vec2(-2.0,  2.0)).rgb;
  vec3 b = texture(uTex, vUv + t * vec2( 0.0,  2.0)).rgb;
  vec3 c = texture(uTex, vUv + t * vec2( 2.0,  2.0)).rgb;
  vec3 d = texture(uTex, vUv + t * vec2(-2.0,  0.0)).rgb;
  vec3 e = texture(uTex, vUv                        ).rgb;
  vec3 f = texture(uTex, vUv + t * vec2( 2.0,  0.0)).rgb;
  vec3 g = texture(uTex, vUv + t * vec2(-2.0, -2.0)).rgb;
  vec3 h = texture(uTex, vUv + t * vec2( 0.0, -2.0)).rgb;
  vec3 i = texture(uTex, vUv + t * vec2( 2.0, -2.0)).rgb;
  vec3 j = texture(uTex, vUv + t * vec2(-1.0,  1.0)).rgb;
  vec3 k = texture(uTex, vUv + t * vec2( 1.0,  1.0)).rgb;
  vec3 l = texture(uTex, vUv + t * vec2(-1.0, -1.0)).rgb;
  vec3 m = texture(uTex, vUv + t * vec2( 1.0, -1.0)).rgb;

  vec3 o = (j + k + l + m) * 0.125;
  o += (a + b + d + e) * 0.03125;
  o += (b + c + e + f) * 0.03125;
  o += (d + e + g + h) * 0.03125;
  o += (e + f + h + i) * 0.03125;
  fragColor = vec4(o, 1.0);
}
`;

/** 9-tap tent upsample, additively blended into the larger level. */
export const UPSAMPLE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;
uniform sampler2D uTex;
uniform vec2  uTexel;
uniform float uRadius;

void main() {
  vec2 t = uTexel * uRadius;
  vec3 s = texture(uTex, vUv + t * vec2(-1.0,  1.0)).rgb * 1.0;
  s += texture(uTex, vUv + t * vec2( 0.0,  1.0)).rgb * 2.0;
  s += texture(uTex, vUv + t * vec2( 1.0,  1.0)).rgb * 1.0;
  s += texture(uTex, vUv + t * vec2(-1.0,  0.0)).rgb * 2.0;
  s += texture(uTex, vUv                        ).rgb * 4.0;
  s += texture(uTex, vUv + t * vec2( 1.0,  0.0)).rgb * 2.0;
  s += texture(uTex, vUv + t * vec2(-1.0, -1.0)).rgb * 1.0;
  s += texture(uTex, vUv + t * vec2( 0.0, -1.0)).rgb * 2.0;
  s += texture(uTex, vUv + t * vec2( 1.0, -1.0)).rgb * 1.0;
  fragColor = vec4(s / 16.0, 1.0);
}
`;

/**
 * Final composite. Tonemapping is luminance-Reinhard rather than ACES: ACES
 * desaturates the hot core toward white too aggressively and loses the orange
 * this reference is built on, while luminance-Reinhard rolls off brightness
 * and leaves the hue intact.
 *
 * Grain and an ordered-ish triangular dither go on last. A bright object on a
 * large dark falloff is the worst case for H.264 banding, and dithering below
 * the 8-bit step is what stops the encoder from finding flat plateaus to band.
 */
export const COMPOSITE_FRAG = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform float uBloomStrength;
uniform float uGrain;
uniform float uSeed;
uniform float uSaturation;
uniform vec2  uRes;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec3 scene = texture(uScene, vUv).rgb;
  vec3 bloom = texture(uBloom, vUv).rgb;
  vec3 col = scene + bloom * uBloomStrength;

  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = col / (1.0 + l);

  l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, uSaturation);

  col = pow(max(col, 0.0), vec3(1.0 / 2.2));

  // Fine grain, and triangular dither at just under one 8-bit step.
  vec2 sp = gl_FragCoord.xy;
  float n1 = hash12(sp + uSeed);
  float n2 = hash12(sp * 1.7 + uSeed + 19.3);
  col += (n1 - 0.5) * uGrain;
  col += (n1 + n2 - 1.0) / 255.0;

  fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

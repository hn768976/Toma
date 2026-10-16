// GLSL 3 (WebGL2) shader sources shared by the looks.
//
// Everything is drawn as analytic-AA quads (lines, dots, sprites) instead of
// GL_LINES / GL_POINTS, so line widths are defined in pixels at 2160p and
// scale exactly with the output resolution. Depth of field is done per
// primitive: each quad grows by its circle of confusion and its energy is
// spread over the wider footprint, which gives soft, glowing out-of-focus
// lines without a separate depth-buffer blur pass.

export const COMMON = /* glsl */ `
uniform vec2 uRes;        // drawing buffer size in px
uniform float uFocus;     // focus distance (view-space units)
uniform float uCoc;       // CoC px@2160 for a point at infinity
uniform float uCocMax;    // clamp, px@2160
uniform vec4 uFade;       // near0, near1, far0, far1 (view distance)
uniform float uFarFloor;  // alpha kept beyond far1 (0 = fade out fully)

float pxScale() { return uRes.y / 2160.0; }
float cocPx(float d) {
  return min(uCoc * abs(d - uFocus) / max(d, 1e-4), uCocMax) * pxScale();
}
float depthFade(float d) {
  return smoothstep(uFade.x, uFade.y, d) * mix(1.0, uFarFloor, smoothstep(uFade.z, uFade.w, d));
}
`;

export const LINE_VERT = /* glsl */ `
precision highp float;
in vec3 position;          // x: 0..1 along, y: -1..1 across
in vec3 iA;
in vec3 iB;
in vec4 iColor;            // rgb, alpha
in float iWidth;           // px @2160
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;
uniform float uNear;
${COMMON}
out float vSide;
out float vHalf;
out float vSoft;
out vec4 vColor;

void main() {
  vec4 va = viewMatrix * modelMatrix * vec4(iA, 1.0);
  vec4 vb = viewMatrix * modelMatrix * vec4(iB, 1.0);
  float zn = -uNear;
  if ((va.z > zn && vb.z > zn) || iColor.a <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vColor = vec4(0.0);
    return;
  }
  if (va.z > zn) va = mix(va, vb, (zn - va.z) / (vb.z - va.z));
  if (vb.z > zn) vb = mix(vb, va, (zn - vb.z) / (va.z - vb.z));
  vec4 ca = projectionMatrix * va;
  vec4 cb = projectionMatrix * vb;
  vec2 sa = ca.xy / ca.w * 0.5 * uRes;
  vec2 sb = cb.xy / cb.w * 0.5 * uRes;
  vec2 dv = sb - sa;
  float len = length(dv);
  vec2 dir = len > 1e-5 ? dv / len : vec2(1.0, 0.0);
  vec2 nrm = vec2(-dir.y, dir.x);

  float t = position.x;
  float d = -mix(va.z, vb.z, t);
  float coc = cocPx(d);
  float w = iWidth * pxScale();
  float wv = max(w, 1.0);
  float full = wv + coc;
  float hw = full * 0.5 + 1.0;
  vec2 s = mix(sa, sb, t) + nrm * position.y * hw + dir * (t * 2.0 - 1.0) * (0.5 + coc * 0.5);

  vec4 c = mix(ca, cb, t);
  gl_Position = vec4(s / (0.5 * uRes) * c.w, c.z, c.w);
  vSide = position.y * hw;
  vHalf = full * 0.5;
  vSoft = 0.5 + coc * 0.5;
  float energy = min(w, 1.0) * wv / full;
  vColor = vec4(iColor.rgb, iColor.a * energy * depthFade(d));
}
`;

export const LINE_FRAG = /* glsl */ `
precision highp float;
in float vSide;
in float vHalf;
in float vSoft;
in vec4 vColor;
out vec4 outColor;
void main() {
  float a = 1.0 - smoothstep(vHalf - vSoft, vHalf + vSoft, abs(vSide));
  outColor = vec4(vColor.rgb * vColor.a * a, 0.0);
}
`;

export const DOT_VERT = /* glsl */ `
precision highp float;
in vec3 position;          // -1..1 quad
in vec3 iP;
in vec4 iColor;
in float iSize;            // diameter px @2160
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;
uniform float uNear;
${COMMON}
out vec2 vUv;
out float vR;
out float vSoft;
out vec4 vColor;
void main() {
  vec4 v = viewMatrix * modelMatrix * vec4(iP, 1.0);
  if (v.z > -uNear || iColor.a <= 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vColor = vec4(0.0);
    return;
  }
  float d = -v.z;
  float coc = cocPx(d);
  float s = max(iSize * pxScale(), 1.0);
  float full = s + coc;
  float hr = full * 0.5 + 1.0;
  vec4 c = projectionMatrix * v;
  c.xy += position.xy * hr / (0.5 * uRes) * c.w;
  gl_Position = c;
  vUv = position.xy * hr;
  vR = full * 0.5;
  vSoft = 0.5 + coc * 0.5;
  float energy = min(iSize * pxScale(), 1.0) * (s * s) / (full * full);
  vColor = vec4(iColor.rgb, iColor.a * energy * depthFade(d));
}
`;

export const DOT_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vR;
in float vSoft;
in vec4 vColor;
out vec4 outColor;
void main() {
  float a = 1.0 - smoothstep(vR - vSoft, vR + vSoft, length(vUv));
  outColor = vec4(vColor.rgb * vColor.a * a, 0.0);
}
`;

// World-space sprites (map tags) lying in a plane given by two axis vectors.
// DoF: mixes a sharp atlas with a pre-blurred copy by CoC.
export const SPRITE_VERT = /* glsl */ `
precision highp float;
in vec3 position;          // 0..1 quad
in vec3 iP;                // top-left corner, world
in vec2 iSize;             // world units along uAxisU / uAxisV
in vec4 iUv;               // atlas rect u0,v0,u1,v1
in vec4 iColor;
uniform mat4 viewMatrix;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;
uniform vec3 uAxisU;
uniform vec3 uAxisV;
${COMMON}
out vec2 vUv;
out vec4 vColor;
out float vBlur;
void main() {
  vec3 p = iP + uAxisU * position.x * iSize.x + uAxisV * position.y * iSize.y;
  vec4 v = viewMatrix * modelMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * v;
  float d = -v.z;
  vBlur = cocPx(d) / (uCocMax * pxScale());
  vUv = vec2(mix(iUv.x, iUv.z, position.x), mix(iUv.y, iUv.w, position.y));
  vColor = vec4(iColor.rgb, iColor.a * depthFade(d));
}
`;

export const SPRITE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uSharp;
uniform sampler2D uBlur;
in vec2 vUv;
in vec4 vColor;
in float vBlur;
out vec4 outColor;
void main() {
  float s = texture(uSharp, vUv).r;
  float b = texture(uBlur, vUv).r;
  float k = smoothstep(0.08, 0.75, vBlur);
  float a = mix(s, b, k);
  outColor = vec4(vColor.rgb * vColor.a * a, 0.0);
}
`;

export const FULLSCREEN_VERT = /* glsl */ `
precision highp float;
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Hash used for grain: a fixed formula of pixel position and loop frame.
export const HASH = /* glsl */ `
uint pcg(uint v) {
  uint state = v * 747796405u + 2891336453u;
  uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
float hash3(uvec3 p) {
  return float(pcg(p.x + pcg(p.y + pcg(p.z)))) / 4294967296.0;
}
`;

export const FINAL_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uScene;
uniform sampler2D uBloom;
uniform sampler2D uBlue;
uniform float uBloomStrength;
uniform vec3 uBgTop;
uniform vec3 uBgBottom;
uniform vec3 uBgCenter;     // tint at the radial centre
uniform vec3 uBgCenterPos;  // x, y (uv), radius
uniform float uBgCenterAmt;
uniform float uVignette;
uniform float uGrain;
uniform float uFrame;       // loop frame 0..599
uniform vec2 uRes;
in vec2 vUv;
out vec4 outColor;
${HASH}
void main() {
  vec3 bg = mix(uBgBottom, uBgTop, vUv.y);
  vec2 q = (vUv - uBgCenterPos.xy) * vec2(uRes.x / uRes.y, 1.0);
  float r = length(q) / uBgCenterPos.z;
  bg = mix(bg, uBgCenter, uBgCenterAmt * exp(-r * r));
  vec3 col = bg + texture(uScene, vUv).rgb + texture(uBloom, vUv).rgb * uBloomStrength;
  vec2 vq = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0);
  col *= 1.0 - uVignette * smoothstep(0.35, 1.25, length(vq));
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  uvec3 key = uvec3(uvec2(gl_FragCoord.xy), uint(uFrame));
  float g = hash3(key) - 0.5;
  col += g * 2.0 * uGrain * smoothstep(0.0, 0.03, lum);
  // +-1/255 blue-noise dither, offset per frame along an R2 sequence.
  vec2 off = fract(vec2(0.7548777, 0.5698403) * uFrame) * 64.0;
  float bn = texelFetch(uBlue, ivec2(mod(gl_FragCoord.xy + off, 64.0)), 0).r;
  col += (bn - 0.5) * (2.0 / 255.0);
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
`;

export const BRIGHT_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform float uThreshold;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec3 c = texture(uTex, vUv).rgb;
  float l = max(c.r, max(c.g, c.b));
  float k = smoothstep(uThreshold, uThreshold + 0.25, l);
  outColor = vec4(c * k, 1.0);
}
`;

// 13-tap downsample (Jimenez 2014).
export const DOWN_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uTexel;
in vec2 vUv;
out vec4 outColor;
vec3 s(vec2 o) { return texture(uTex, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
  vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 o = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  outColor = vec4(o, 1.0);
}
`;

// 3x3 tent upsample, added onto the next larger level.
export const UP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uTex;
uniform vec2 uTexel;
uniform float uRadius;
in vec2 vUv;
out vec4 outColor;
vec3 s(vec2 o) { return texture(uTex, vUv + o * uTexel * uRadius).rgb; }
void main() {
  vec3 o = s(vec2(0, 0)) * 4.0
    + (s(vec2(-1, 0)) + s(vec2(1, 0)) + s(vec2(0, -1)) + s(vec2(0, 1))) * 2.0
    + s(vec2(-1, -1)) + s(vec2(1, -1)) + s(vec2(-1, 1)) + s(vec2(1, 1));
  outColor = vec4(o / 16.0, 1.0);
}
`;

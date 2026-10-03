// GLSL ES 3.00 (WebGL2). All shaders are used with THREE.ShaderMaterial + GLSL3.

export const PCG = /* glsl */ `
uvec3 pcg3d(uvec3 v) {
  v = v * 1664525u + 1013904223u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  v ^= v >> 16u;
  v.x += v.y * v.z; v.y += v.z * v.x; v.z += v.x * v.y;
  return v;
}
`;

// --- widgets: per-plane depth-of-field (golden-angle disc gather over mips) --
export const WIDGET_VERT = /* glsl */ `
out vec2 vUv;
out float vDepth;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const WIDGET_FRAG = /* glsl */ `
out highp vec4 outColor;
uniform sampler2D map;
uniform vec2 texSize;
uniform vec2 planeSize;   // world size of the content (without padding)
uniform float pad;        // world padding on each side
uniform float focus;
uniform float cocK;
uniform float gain;
uniform float opacity;
in vec2 vUv;
in float vDepth;

vec4 tap(vec2 uv, float lod) {
  vec2 inside = step(vec2(0.0), uv) * step(uv, vec2(1.0));
  return textureLod(map, uv, lod) * inside.x * inside.y;
}

void main() {
  vec2 full = planeSize + 2.0 * pad;
  vec2 uvT = (vUv * full - pad) / planeSize;
  vec2 tc = uvT * texSize;
  float lod0 = log2(max(max(length(dFdx(tc)), length(dFdy(tc))), 1e-4));
  float coc = cocK * abs(vDepth - focus);           // world units
  vec2 rUv = coc / planeSize;                       // radius in uv
  float rTex = rUv.x * texSize.x;                   // radius in texels
  vec4 c;
  if (rTex < 0.75) {
    c = tap(uvT, max(lod0, 0.0));
  } else {
    const int N = 40;
    float lod = max(lod0, log2(max(1.0, rTex * 0.30)));
    vec4 acc = vec4(0.0);
    float wsum = 0.0;
    for (int i = 0; i < N; i++) {
      float fi = float(i) + 0.5;
      float r = sqrt(fi / float(N));
      float a = fi * 2.39996323;
      vec2 o = vec2(cos(a), sin(a)) * r * rUv;
      acc += tap(uvT + o, lod);
      wsum += 1.0;
    }
    c = acc / wsum;
  }
  c *= opacity;
  c.rgb *= gain;
  if (c.a < 0.002 && max(c.r, max(c.g, c.b)) < 0.002) discard;
  outColor = c; // premultiplied
}
`;

// --- map plane --------------------------------------------------------------
export const MAP_VERT = /* glsl */ `
out vec2 vWorld;
out float vDepth;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xy;
  vec4 mv = viewMatrix * wp;
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

export const MAP_FRAG = /* glsl */ `
out highp vec4 outColor;
uniform sampler2D map;
uniform vec2 mapSize;   // world size of one copy of the world map
uniform vec2 mapOrigin; // world position of the map's lon=-180, lat=0 point
uniform float texW;
uniform vec3 ocean;
uniform vec3 gridCol;
uniform float focus;
uniform float cocK;
in vec2 vWorld;
in float vDepth;
void main() {
  vec2 uv = vec2((vWorld.x - mapOrigin.x) / mapSize.x, 0.5 + (vWorld.y - mapOrigin.y) / mapSize.y);
  float coc = cocK * abs(vDepth - focus);
  float rTex = coc / mapSize.x * texW;
  float bias = log2(max(1.0, rTex * 0.8));
  vec3 c = texture(map, uv, bias).rgb;
  float inside = smoothstep(0.0, 0.02, uv.y) * smoothstep(1.0, 0.98, uv.y);
  // beyond the poles: ocean with the same 15° grid continued
  vec2 g = vec2(uv.x * 24.0, uv.y * 12.0);
  vec2 fw = fwidth(g);
  vec2 l = 1.0 - smoothstep(vec2(0.0), fw * 1.2, abs(fract(g + 0.5) - 0.5));
  vec3 outside = ocean + gridCol * max(l.x, l.y);
  outColor = vec4(mix(outside, c, inside), 1.0);
}
`;

// --- post -------------------------------------------------------------------
export const FS_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const DOWN_FRAG = /* glsl */ `
out highp vec4 outColor;
uniform sampler2D src;
uniform vec2 texel;      // 1 / source size
uniform float threshold; // < 0: no threshold
in vec2 vUv;
vec3 s(vec2 o) { return texture(src, vUv + o * texel).rgb; }
void main() {
  // 13-tap downsample (CoD: AW)
  vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
  vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
  vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
  vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
  vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
  if (threshold >= 0.0) {
    float br = max(dot(col, vec3(0.2126, 0.7152, 0.0722)), 0.62 * max(col.r, max(col.g, col.b)));
    float knee = 0.12;
    float soft = clamp(br - threshold + knee, 0.0, 2.0 * knee);
    soft = soft * soft / (4.0 * knee + 1e-4);
    float contrib = max(soft, br - threshold) / max(br, 1e-4);
    col *= contrib;
  }
  outColor = vec4(col, 1.0);
}
`;

export const UP_FRAG = /* glsl */ `
out highp vec4 outColor;
uniform sampler2D src;
uniform vec2 texel;
uniform float weight;
in vec2 vUv;
vec3 s(vec2 o) { return texture(src, vUv + o * texel).rgb; }
void main() {
  vec3 col = s(vec2(0, 0)) * 4.0
    + (s(vec2(-1, 0)) + s(vec2(1, 0)) + s(vec2(0, -1)) + s(vec2(0, 1))) * 2.0
    + s(vec2(-1, -1)) + s(vec2(1, -1)) + s(vec2(-1, 1)) + s(vec2(1, 1));
  outColor = vec4(col / 16.0 * weight, 1.0);
}
`;

export const COMPOSITE_FRAG = /* glsl */ `
out highp vec4 outColor;
uniform sampler2D scene;
uniform sampler2D bloom;
uniform float bloomStrength;
uniform vec3 haze;
uniform uint frameMod;
uniform vec2 resolution;
in vec2 vUv;
${PCG}
void main() {
  vec3 c = texture(scene, vUv).rgb;
  c += texture(bloom, vUv).rgb * bloomStrength;
  // broad haze glows (static, screen space)
  vec2 p = vUv - vec2(0.82, 0.2);
  c += haze * exp(-dot(p, p) * 5.0);
  vec2 q = vUv - vec2(0.15, 0.85);
  c += haze * 0.6 * exp(-dot(q, q) * 6.0);
  vec2 r = (vUv - vec2(0.5, 0.48)) * vec2(1.0, 1.4);
  c += haze * vec3(0.5, 1.0, 1.0) * 0.8 * exp(-dot(r, r) * 7.0);
  // vignette
  vec2 v = (vUv - 0.5) * vec2(1.0, 0.82);
  c *= mix(1.0, 0.42, smoothstep(0.22, 0.78, length(v)));
  // gentle highlight shoulder
  c = c / (1.0 + max(c - 0.85, 0.0) * 0.6);
  // dither (±1/255, triangular) + grain (~2 %), pure function of pixel + frame
  uvec3 h = pcg3d(uvec3(uvec2(gl_FragCoord.xy), frameMod));
  vec3 n = vec3(h) / 4294967295.0;
  float tri = n.x + n.y - 1.0;
  float grain = (n.z - 0.5) * 0.04;
  c += tri / 255.0 + grain * (0.35 + 0.65 * clamp(dot(c, vec3(0.3, 0.5, 0.2)) * 3.0, 0.0, 1.0));
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

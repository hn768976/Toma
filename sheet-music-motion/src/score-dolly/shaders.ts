export const vertexShader = /* glsl */ `
out vec2 vUv;
out float vDepth;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

// Per-pixel depth of field on the page plane: the circle of confusion is derived
// from view depth and gathered with a golden-angle disc of pre-filtered
// (textureGrad) taps, which keeps large blurs smooth at any output resolution.
export const fragmentShader = /* glsl */ `
precision highp float;
uniform sampler2D uMap;
uniform sampler2D uGhost;
uniform vec2 uRes;
uniform float uFocus;
uniform float uAperture;
uniform float uTime;
uniform vec4 uLight;      // xy centre (0..1 screen), z radius, w ambient
uniform vec2 uGhostOffset;
uniform float uExposure;
in vec2 vUv;
in float vDepth;
out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  // Circle of confusion in pixels, relative to output height so 4K == 1080p look.
  float coc = uAperture * abs(vDepth - uFocus) / vDepth * uRes.y;
  coc = clamp(coc, 0.0, 0.045 * uRes.y);

  vec2 dx = dFdx(vUv);
  vec2 dy = dFdy(vUv);
  // Adaptive tap count: in-focus pixels need a single tap.
  const int MAX_TAPS = 14;
  int taps = int(clamp(ceil(coc * 0.9), 1.0, float(MAX_TAPS)));
  float preblur = max(1.0, coc * 1.5 / sqrt(float(taps)));
  vec3 acc = vec3(0.0);
  for (int i = 0; i < MAX_TAPS; i++) {
    if (i >= taps) break;
    float fi = float(i) + 0.5;
    float r = taps == 1 ? 0.0 : sqrt(fi / float(taps)) * coc;
    float a = fi * 2.39996323;
    vec2 o = vec2(cos(a), sin(a)) * r;
    vec2 uv = vUv + dx * o.x + dy * o.y;
    acc += textureGrad(uMap, uv, dx * preblur, dy * preblur).rgb;
  }
  vec3 paper = acc / float(taps);

  vec2 sp = gl_FragCoord.xy / uRes;
  float aspect = uRes.x / uRes.y;

  // Double-exposure ghost layer (faint rules + small floating notes).
  vec2 guv = vec2(sp.x * aspect, sp.y) * 0.62 + uGhostOffset;
  float gblur = 2.5 + coc * 0.25;
  vec2 gd = vec2(gblur / uRes.y * 0.62, 0.0);
  float ghost = textureGrad(uGhost, guv, gd, gd.yx).a;
  paper *= 1.0 - ghost * 0.16;

  // Warm key light pool + side fall-off into darkness.
  vec2 d = (sp - uLight.xy) * vec2(aspect * 0.62, 1.0);
  float pool = exp(-dot(d, d) / (uLight.z * uLight.z));
  float rightFall = 1.0 - smoothstep(0.5, 0.98, sp.x + (1.0 - sp.y) * 0.18) * 0.95;
  float topFall = 1.0 - smoothstep(0.82, 1.08, sp.y) * 0.55 * (1.0 - smoothstep(0.2, 0.55, sp.x) * 0.5);
  vec2 vq = sp - 0.5;
  float vig = 1.0 - smoothstep(0.5, 1.05, length((vq - vec2(0.12, -0.05)) * vec2(1.0, 1.25))) * 0.35;
  float light = (uLight.w + pool * 1.55) * rightFall * topFall * vig * uExposure;

  float lum = dot(paper, vec3(0.3, 0.55, 0.15));
  vec3 c = mix(vec3(lum), paper, 0.6) * light;
  // Sepia/gold grade: shadows fall to deep brown, highlights to pale gold.
  vec3 graded = vec3(1.0, 0.86, 0.56) * pow(max(c, 0.0), vec3(0.95, 1.38, 2.5));
  graded += vec3(0.018, 0.008, 0.0);

  float g = hash(gl_FragCoord.xy + fract(uTime * 7.31) * 913.0) - 0.5;
  graded += g * 0.035 * (0.4 + graded.g);

  fragColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
}
`;

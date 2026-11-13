// GLSL ES 3.00 (WebGL 2) shaders for the particle ribbons.
// Particle positions are computed entirely on the GPU from static attributes
// and the uTime uniform, so every frame is a pure function of time.

export const particleVertex = /* glsl */ `
precision highp float;

in vec3 position;          // unused placeholder (required by three.js)
in vec4 aParams;           // x: u (0..1 along ribbon), y: v (0..1 across), z: ribbon id (0,1 = ribbon, 2 = dust), w: kind (0 = spark, 1 = glow, 2 = comb rung)
in vec4 aRand;             // 4 uniform randoms in [0,1)

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform float uTime;
uniform float uPxScale;     // pixels per "1080p pixel" (2.0 at 4K)
uniform float uFocus;       // focus distance (world units, view space)
uniform float uAperture;    // circle-of-confusion strength (1080p px)
uniform float uViewH;       // drawing-buffer height in px

uniform vec3 uA[4];  uniform vec3 uAW0; uniform vec3 uAW1;
uniform vec3 uB[4];  uniform vec3 uBW0; uniform vec3 uBW1;

out vec3 vColor;
out float vAlpha;
out float vBlur;

vec3 bez(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
  float s = 1.0 - t;
  return s*s*s*a + 3.0*s*s*t*b + 3.0*s*t*t*c + t*t*t*d;
}
vec3 bezD(vec3 a, vec3 b, vec3 c, vec3 d, float t) {
  float s = 1.0 - t;
  return 3.0*s*s*(b-a) + 6.0*s*t*(c-b) + 3.0*t*t*(d-c);
}

void main() {
  float u0 = aParams.x;
  float v = aParams.y;
  float rid = aParams.z;
  float glow = aParams.w;

  vec3 p;
  float alpha;
  vec3 col;
  float size;

  if (rid < 1.5) {
    bool isA = rid < 0.5;
    // particles stream along the ribbon; the shape itself stays put
    // rung particles share one speed so the comb stripes stay coherent
    float speed = (glow > 1.5 ? 0.016 : mix(0.010, 0.032, aRand.x)) * (isA ? 1.0 : -1.0);
    float u = fract(u0 + uTime * speed);

    vec3 c, d, w;
    if (isA) {
      c = bez(uA[0], uA[1], uA[2], uA[3], u);
      d = normalize(bezD(uA[0], uA[1], uA[2], uA[3], u));
      w = mix(uAW0, uAW1, u);
    } else {
      c = bez(uB[0], uB[1], uB[2], uB[3], u);
      d = normalize(bezD(uB[0], uB[1], uB[2], uB[3], u));
      w = mix(uBW0, uBW1, u);
    }
    // ribbon tapers toward its ends
    float taper = pow(sin(3.14159 * clamp(u, 0.0, 1.0)), 0.6);
    vec3 nrm = normalize(cross(d, w));
    float wave = sin(u * 7.0 + v * 2.5 + uTime * 0.55 + (isA ? 0.0 : 2.0)) * 0.10
               + sin(u * 17.0 - uTime * 0.9 + v * 5.0) * 0.03;
    p = c + w * v * taper + nrm * wave * (0.3 + v);
    // volume jitter grows toward the trailing edge of the sheet
    vec3 j = (aRand.yzw - 0.5);
    p += j * (0.02 + 0.16 * v * v);

    float ends = smoothstep(0.0, 0.10, u) * smoothstep(1.0, 0.80, u);
    float edge = exp(-v * 9.0);                 // bright leading edge
    float sheet = 0.34 * (1.0 - smoothstep(0.5, 1.0, v));
    if (glow > 1.5) sheet *= 2.2;               // comb rungs read brighter than the fill
    alpha = ends * (sheet + 0.95 * edge);
    col = mix(vec3(1.0, 0.40, 0.07), vec3(1.0, 0.62, 0.22), edge);
    size = mix(1.4, 2.6, aRand.y * aRand.y);
    // occasional glints give the sheet its sparkling, granular texture
    if (aRand.w > 0.975) {
      size *= 2.2;
      alpha *= 2.5;
      col = vec3(1.0, 0.66, 0.30);
    }
    if (glow > 0.5 && glow < 1.5) {
      size *= 11.0;
      alpha *= 0.030;
      col = vec3(1.0, 0.38, 0.06);
    }
  } else {
    // floating dust / bokeh specks
    p = (aRand.xyz - 0.5) * vec3(26.0, 12.0, 22.0);
    p += vec3(sin(uTime * 0.11 + aRand.w * 20.0), cos(uTime * 0.09 + aRand.x * 17.0), 0.0) * 0.4;
    bool teal = aParams.y > 0.93;
    col = teal ? vec3(0.25, 0.85, 0.85) : vec3(1.0, 0.45, 0.10);
    float tw = 0.6 + 0.4 * sin(uTime * (0.7 + aRand.w) + aRand.z * 30.0);
    alpha = (teal ? 0.55 : 0.85) * tw;
    size = mix(1.5, 3.2, aParams.x);
  }

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float depth = -mv.z;
  // depth of field: circle of confusion grows with distance from focus plane
  float coc = uAperture * abs(depth - uFocus) / max(depth, 0.1);
  float s = sqrt(size * size + coc * coc);
  // conserve energy as the point spreads out
  alpha *= clamp((size * size) / (s * s), 0.0, 1.0) * mix(1.0, 1.8, clamp(coc / 30.0, 0.0, 1.0));
  vBlur = clamp(coc / (size + coc), 0.0, 1.0);
  vColor = col;
  vAlpha = alpha * smoothstep(0.3, 2.0, depth);

  gl_Position = projectionMatrix * mv;
  gl_PointSize = s * uPxScale;
}
`;

export const particleFragment = /* glsl */ `
precision highp float;
in vec3 vColor;
in float vAlpha;
in float vBlur;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(q, q);
  if (r2 > 1.0) discard;
  float sharp = exp(-r2 * 4.5);
  float bokeh = smoothstep(1.0, 0.72, sqrt(r2)) * (0.75 + 0.25 * r2);
  float a = mix(sharp, bokeh, vBlur) * vAlpha;
  outColor = vec4(vColor * a, 1.0);
}
`;

export const quadVertex = /* glsl */ `
in vec3 position;
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// HDR -> display: filmic exponential tone map (orange saturates to yellow,
// then white-hot), subtle vignette and dithering to avoid banding.
export const toneFragment = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D uHdr;
uniform sampler2D uBloom;
uniform float uExposure;
uniform float uBloomStrength;
uniform vec3 uBloomTint;
uniform float uFrame;
uniform float uGrid;
uniform float uGridW;
out vec4 outColor;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uFrame * 0.618) * 43758.5453); }
void main() {
  vec3 hdr = texture(uHdr, vUv).rgb + texture(uBloom, vUv).rgb * uBloomTint * uBloomStrength;
  vec3 c = 1.0 - exp(-hdr * uExposure);
  vec2 d = vUv - 0.5;
  c *= 1.0 - dot(d, d) * 0.55;
  // fine display mesh (like a screen-door / LED grid) that reads on bright areas
  vec2 g = mod(gl_FragCoord.xy, uGrid);
  float mesh = step(uGrid - uGridW, g.x) + step(uGrid - uGridW, g.y);
  c *= 1.0 - 0.18 * clamp(mesh, 0.0, 1.0);
  c += (h(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(c, 1.0);
}
`;

// Separable gaussian used for the low-resolution bloom chain.
export const blurFragment = /* glsl */ `
precision highp float;
in vec2 vUv;
uniform sampler2D uTex;
uniform vec2 uDir;
out vec4 outColor;
void main() {
  vec3 s = texture(uTex, vUv).rgb * 0.2270270270;
  s += texture(uTex, vUv + uDir * 1.3846153846).rgb * 0.3162162162;
  s += texture(uTex, vUv - uDir * 1.3846153846).rgb * 0.3162162162;
  s += texture(uTex, vUv + uDir * 3.2307692308).rgb * 0.0702702703;
  s += texture(uTex, vUv - uDir * 3.2307692308).rgb * 0.0702702703;
  outColor = vec4(s, 1.0);
}
`;

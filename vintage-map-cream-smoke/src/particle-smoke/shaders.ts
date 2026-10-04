import { GRAIN_GLSL, SIMPLEX3_GLSL } from "../lib/glsl";

// Particle vertex shader: each vertex is one particle. Its 3D position on a
// flowing ribbon sheet and its perspective projection are computed here from
// the loop phase, so frames never depend on each other.
export const particleVertex = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition; // (u, v) on the sheet
in vec2 aData;     // sheet id (+10 for dust), seed
uniform float uPhase;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanHalf;
uniform float uAspect;
uniform float uPointSize;
uniform float uAlpha;
uniform float uFocusDist;
uniform float uDofPx;     // blur diameter in pixels per unit of |1 - focus/z|
uniform float uMaxPointPx;
out float vAlpha;
${SIMPLEX3_GLSL}

// Vector noise whose domain walks around a circle over the loop.
vec3 flow(vec3 p, float f, float r, float ofs) {
  vec2 c = r * vec2(cos(uPhase + ofs), sin(uPhase + ofs));
  vec3 q = p * f;
  return vec3(
    snoise(vec3(q.x + c.x, q.y + c.y, q.z + ofs)),
    snoise(vec3(q.y - c.y + 31.4, q.z + c.x, q.x + 7.1 + ofs)),
    snoise(vec3(q.z + c.x + 17.3, q.x - c.y, q.y + 3.7 - ofs)));
}

float hash1(float n) { return fract(sin(n * 12.9898) * 43758.5453); }

void main() {
  bool dust = aData.x > 9.5;
  float sheet = dust ? aData.x - 10.0 : aData.x;
  float seed = aData.y;
  float u = aPosition.x;
  float v = aPosition.y;
  float k = sheet * 1.7;
  float t = uPhase;

  // Sheet 0 is one large curling band; sheets 1 and 2 are thin strands that
  // run alongside it and fan out, so the form reads as one wave with trails.
  bool strand = sheet > 0.5;
  float ang = 0.95 + 0.22 * sin(t) + (strand ? 0.12 * (sheet - 1.5) : 0.0);
  vec3 A = normalize(vec3(cos(ang), sin(ang), 0.3 * sin(t * 1.0 + 0.5)));
  vec3 N1 = normalize(cross(A, vec3(0.0, 0.0, 1.0)));
  vec3 N2 = cross(N1, A);
  float twist = -0.35 + u * 1.1 + 0.55 * sin(t + u * 1.5);
  vec3 Bw = cos(twist) * N1 + sin(twist) * N2;
  float len = strand ? 3.6 : 4.4;
  // rounded ends, not points
  float prof = pow(max(sin(3.14159 * u), 0.0), 0.3);
  float width = (strand ? 0.6 : 1.95) * prof;
  // strands sit off the main band's lower edge and peel away toward its tail
  vec3 C = vec3(-0.55, -0.05, 0.0);
  // strands follow the main band's lower edge, peeling away toward the tail
  if (strand) C += -Bw * (0.95 + (0.25 + 0.2 * (sheet - 1.0)) * (1.0 - u) * 1.6) * prof + N2 * 0.15 * (sheet - 1.5);
  vec3 thick = cross(A, Bw);
  float th = (hash1(seed * 7.77 + 9.0) - 0.5) * (hash1(seed * 3.3 + 1.0) + 0.3);
  vec3 P = C + A * (u - 0.5) * len + Bw * (v - 0.5) * width + thick * th * (strand ? 0.16 : 0.2) * prof;
  // curl the band's cross-section like a half-pipe; its edges turn away from
  // the camera and read as bright, dense rims
  float across = (v - 0.5) * width;
  float curl = strand ? 0.0 : 0.35 + 0.3 * sin(t + u * 2.4);
  P += thick * curl * across * across;
  // S-bend across the band
  P += N1 * 0.6 * sin(3.0 * u + 0.6 * sin(t));
  P += N2 * 0.5 * cos(2.4 * u + 0.5 * cos(t));

  // Large smooth folding flow plus a little finer curling.
  P += 0.85 * flow(P, 0.30, 0.9, 0.0);
  P += 0.08 * flow(P, 1.10, 0.7, 2.0);
  // slow turn of the whole form
  float rot = 0.35 * sin(t + 0.4) + 0.12 * P.y;
  float ca = cos(rot), sa = sin(rot);
  P.xz = mat2(ca, -sa, sa, ca) * P.xz;

  float alpha = uAlpha;
  // bright rims along the band edges
  float edge = smoothstep(0.12, 0.0, min(v, 1.0 - v));
  alpha *= 1.0 + (strand ? 0.8 : 1.6) * edge;
  if (dust) {
    // loose wisps drifting off the sheet edges
    vec3 out1 = normalize(Bw + vec3(0.0, 0.3, 0.0)) * (v < 0.5 ? -1.0 : 1.0);
    float drift = 0.06 + 1.1 * seed * seed;
    P += out1 * drift;
    P += 0.5 * drift * flow(P + seed, 1.4, 0.8, 4.0);
    alpha *= 0.7 * (1.0 - 0.5 * seed);
  }

  // per-particle jitter: grainy, not solid
  vec3 j = vec3(hash1(seed * 91.7 + 1.0), hash1(seed * 53.3 + 2.0), hash1(seed * 27.1 + 3.0)) - 0.5;
  P += j * 0.022;

  // perspective projection
  vec3 rel = P - uCamPos;
  float z = dot(rel, uCamFwd);
  float x = dot(rel, uCamRight);
  float yy = dot(rel, uCamUp);
  gl_Position = vec4(x / (z * uTanHalf * uAspect), yy / (z * uTanHalf), 0.0, 1.0);
  if (z < 0.1) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  // a few particles sparkle much brighter than the rest
  float h = hash1(seed * 17.31 + 5.0);
  alpha *= 0.35 + 1.6 * pow(h, 3.0) + 3.0 * pow(h, 40.0);
  // depth of field: out-of-focus particles grow and dim (same total light)
  float coc = uDofPx * abs(1.0 - uFocusDist / z);
  float size = clamp(max(uPointSize, coc), uPointSize, uMaxPointPx);
  gl_PointSize = size;
  // nearer particles a touch brighter
  vAlpha = alpha * clamp(5.0 / z, 0.6, 1.5) * (uPointSize * uPointSize) / (size * size);
}
`;

export const particleFragment = /* glsl */ `#version 300 es
precision highp float;
in float vAlpha;
out vec4 finalColor;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float g = exp(-dot(d, d) * 14.0);
  finalColor = vec4(vAlpha * g, 0.0, 0.0, vAlpha * g);
}
`;

// Final filter: background gradient, density -> colour, soft glow from the
// downsampled copy, highlight roll-off, grain and dither.
export const compositeFragment = /* glsl */ `#version 300 es
precision highp float;
in vec2 vTextureCoord;
uniform sampler2D uTexture;
uniform sampler2D uDensity;
uniform sampler2D uGlowTex;
uniform vec2 uRes;
uniform vec2 uGlowTexel;
uniform vec3 uColLow;
uniform vec3 uColHigh;
uniform vec3 uBgCenter;
uniform vec3 uBgEdge;
uniform float uGain;
uniform float uGlowStrength;
uniform float uGrainFrame;
uniform float uGrainAmount;
out vec4 finalColor;
${GRAIN_GLSL}

vec3 softClip(vec3 x) {
  // linear to 0.75, then rolls off smoothly toward 1.0
  vec3 over = max(x - 0.75, 0.0);
  return min(x, 0.75) + 0.25 * (1.0 - exp(-over / 0.25));
}

void main() {
  vec2 uv = gl_FragCoord.xy / uRes;
  float d = texture(uDensity, uv).r * uGain;
  float glow = 0.0;
  float wsum = 0.0;
  for (int i = -3; i <= 3; i++) {
    for (int j = -3; j <= 3; j++) {
      float w = exp(-float(i * i + j * j) / 6.0);
      glow += texture(uGlowTex, uv + vec2(float(i), float(j)) * uGlowTexel * 2.2).r * w;
      wsum += w;
    }
  }
  glow = glow / wsum * uGain;

  float aspect = uRes.x / uRes.y;
  // gradient centre sits up and left: light seems to come from above
  float r = length((uv - vec2(0.62, 0.8)) * vec2(aspect, 1.0)) / (0.5 * aspect);
  vec3 bg = mix(uBgCenter, uBgEdge, smoothstep(0.0, 1.1, r));

  float body = 1.0 - exp(-d * 0.75);
  vec3 col = mix(uColLow, uColHigh, smoothstep(2.5, 7.0, d));
  vec3 c = bg + col * body + uColLow * (1.0 - exp(-glow * 1.2)) * uGlowStrength;
  // hot, near-white cores where the sheet folds edge-on
  c += uColHigh * 0.55 * smoothstep(2.0, 6.0, d);
  c = softClip(c);
  float g = grainNoise(gl_FragCoord.xy, uGrainFrame);
  c += g * uGrainAmount * (0.6 + 0.4 * clamp(dot(c, vec3(0.3, 0.6, 0.1)) * 3.0, 0.0, 1.0));
  c += ditherRGB(gl_FragCoord.xy, uGrainFrame);
  finalColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

export const compositeVertex = /* glsl */ `#version 300 es
in vec2 aPosition;
out vec2 vTextureCoord;
uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;
vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
  return vec4(position, 0.0, 1.0);
}
void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = aPosition * (uOutputFrame.zw * uInputSize.zw);
}
`;

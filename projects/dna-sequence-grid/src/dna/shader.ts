// WebGL 2 fragment shader that ray-casts an infinite "sequencing gel" plane.
// Every bar is an analytic rectangle; depth of field and anti-aliasing are
// done by convolving each rectangle with a box whose width is the pixel
// footprint plus the circle of confusion at that depth. This gives a true
// camera-style focus falloff with zero noise and constant cost per pixel.

export const VERT = /* glsl */ `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;

in vec2 vUv;
out vec4 outColor;

uniform vec2 uRes;          // drawing-buffer size in px
uniform float uTime;        // seconds
uniform vec3 uCamPos;       // camera position (plane is y = 0)
uniform mat3 uCamRot;       // camera to world rotation
uniform float uTanHalfFov;
uniform float uFocusDist;   // distance in focus
uniform float uAperture;    // circle-of-confusion scale (in px at 1080p)
uniform float uPxScale;     // uRes.y / 1080

// palette
uniform vec3 uBg;
uniform vec3 uLaneBg;
uniform vec3 uColA;   // dominant bar colour
uniform vec3 uColB;   // secondary bar colour
uniform vec3 uColC;   // accent 1
uniform vec3 uColD;   // accent 2
uniform vec4 uMix;    // probabilities: (B, C, D, white-boost)
uniform float uBlockAccent;

const float LANE = 1.0;      // lane pitch
const float LANE_FILL = 0.78; // bar width inside a lane
const float CELL = 1.0;     // cell length along a lane

uint hash(uint x) {
  x ^= x >> 16; x *= 0x7feb352du;
  x ^= x >> 15; x *= 0x846ca68bu;
  x ^= x >> 16;
  return x;
}
float h1(int a, int b, int c) {
  uint v = hash(uint(a) * 1973u + hash(uint(b) * 9277u + hash(uint(c) * 26699u + 0x9e37u)));
  return float(v & 0xffffffu) / 16777216.0;
}

// 1D box-filtered coverage of interval [a,b] at x with filter width w
float cov(float x, float a, float b, float w) {
  float hw = 0.5 * w;
  return clamp((x - a + hw) / w, 0.0, 1.0) - clamp((x - b + hw) / w, 0.0, 1.0);
}

vec3 barColor(int lane, int cell, int k, float bright) {
  float r = h1(lane, cell, 40 + k);
  // big blocks keep an accent colour only with probability uBlockAccent;
  // otherwise accents live on the thin bands (as in the reference)
  if (k == 0 && r >= uMix.x && h1(lane, cell, 90) > uBlockAccent) r = 1.0;
  vec3 c = uColA;
  if (r < uMix.x) c = uColB;
  else if (r < uMix.x + uMix.y) c = uColC;
  else if (r < uMix.x + uMix.y + uMix.z) c = uColD;
  // brighter bars drift toward white like over-exposed film
  float wb = smoothstep(0.7, 1.0, bright) * uMix.w;
  return mix(c, vec3(1.0), wb) * bright;
}

// Lane scroll offset (each lane slides at its own slow speed).
float laneOffset(int lane) {
  float s = h1(lane, 7, 3);
  float speed = (s < 0.35) ? 0.0 : (s - 0.675) * 0.42;
  return uTime * speed + h1(lane, 9, 1) * 50.0;
}

// Accumulates the colour of every bar in one cell of one lane.
vec3 shadeCell(int lane, int cell, float lx, float lz, float wx, float wz) {
  vec3 acc = vec3(0.0);
  float kind = h1(lane, cell, 1);
  float z0 = float(cell) * CELL;
  float halfFill = 0.5 * LANE_FILL;
  float xCov = cov(lx, -halfFill, halfFill, wx);
  if (xCov <= 0.0) return acc;
  float pulse = 0.82 + 0.18 * sin(uTime * (0.6 + 1.6 * h1(lane, cell, 5)) + 6.283 * h1(lane, cell, 6));
  if (kind < 0.5) {
    // big block
    float len = mix(0.4, 0.86, h1(lane, cell, 2));
    float start = z0 + (CELL - len) * h1(lane, cell, 3);
    float bright = mix(0.4, 1.15, pow(h1(lane, cell, 4), 0.5)) * pulse;
    float c = cov(lz, start, start + len, wz) * xCov;
    if (c > 0.0) {
      // faint inner scan lines and lighter rim, which fade out as blur grows
      float detail = 1.0 - smoothstep(0.004, 0.03, wz);
      float scan = 0.92 + 0.08 * sin((lz - start) * 140.0);
      // bright far (top-of-frame) edge, softer near edge
      float rim = 1.0 + 0.7 * (1.0 - smoothstep(0.0, 0.04, lz - start))
                      + 0.2 * (1.0 - smoothstep(0.0, 0.05, start + len - lz));
      float shade = mix(1.0, scan * rim, detail);
      float side = mix(1.0, 0.85 + 0.15 * (1.0 - abs(lx) / halfFill), detail);
      acc += barColor(lane, cell, 0, bright) * c * shade * side;
    }
  } else if (kind < 0.95) {
    // clusters of 1-4 thin bands
    int n = 1 + int(h1(lane, cell, 2) * 4.0);
    for (int k = 0; k < 4; k++) {
      if (k >= n) break;
      float th = mix(0.016, 0.06, h1(lane, cell, 10 + k));
      float pos = z0 + 0.04 + (CELL - 0.12) * (float(k) + 0.7 * h1(lane, cell, 20 + k)) / float(n);
      float bright = mix(0.35, 1.15, pow(h1(lane, cell, 30 + k), 0.7)) * pulse;
      float c = cov(lz, pos, pos + th, wz) * xCov;
      acc += barColor(lane, cell, k + 1, bright) * c;
    }
  }
  return acc;
}

void main() {
  vec2 p = (vUv * 2.0 - 1.0);
  float aspect = uRes.x / uRes.y;
  vec3 dirCam = normalize(vec3(p.x * aspect * uTanHalfFov, p.y * uTanHalfFov, -1.0));
  vec3 dir = uCamRot * dirCam;

  vec3 col = uBg;
  if (dir.y < -1e-4) {
    float tHit = uCamPos.y / -dir.y;
    vec3 hit = uCamPos + dir * tHit;

    // pixel footprint on the plane
    vec2 fp = vec2(length(vec2(dFdx(hit.x), dFdy(hit.x))), length(vec2(dFdx(hit.z), dFdy(hit.z))));
    fp = max(fp, vec2(1e-5));
    // behind the focus plane the blur grows more slowly, as with a real lens
    float coc = uAperture * uPxScale * (tHit < uFocusDist ? (uFocusDist / tHit - 1.0) : 0.6 * (1.0 - uFocusDist / tHit));
    float blurPx = 1.0 + coc;
    float wx = fp.x * blurPx;
    float wz = fp.y * blurPx;

    float laneF = hit.x / LANE;
    int lane0 = int(floor(laneF + 0.5));
    vec3 acc = vec3(0.0);
    float laneBgCov = 0.0;
    for (int dl = -1; dl <= 1; dl++) {
      int lane = lane0 + dl;
      float lx = hit.x - float(lane) * LANE;
      if (abs(lx) > 0.5 * LANE_FILL + wx) continue;
      float lz = hit.z + laneOffset(lane);
      int cell0 = int(floor(lz / CELL));
      laneBgCov += cov(lx, -0.5 * LANE_FILL, 0.5 * LANE_FILL, wx);
      // neighbour cells only matter when the blur reaches across the boundary
      float inCell = lz - float(cell0) * CELL;
      acc += shadeCell(lane, cell0, lx, lz, wx, wz);
      if (inCell < wz) acc += shadeCell(lane, cell0 - 1, lx, lz, wx, wz);
      if (CELL - inCell < wz) acc += shadeCell(lane, cell0 + 1, lx, lz, wx, wz);
    }

    // dotted separator ticks in some of the gaps between lanes
    {
      int g = int(floor(hit.x / LANE));
      float sx = hit.x - (float(g) + 0.5) * LANE;
      if (h1(g, 0, 88) < 0.55 && abs(sx) < 0.03 + wx) {
        float tickZ = hit.z + laneOffset(g) * 0.6;
        int tc = int(floor(tickZ / 0.075));
        for (int dt = -1; dt <= 1; dt++) {
          int ti = tc + dt;
          if (h1(g, ti, 77) < 0.5) {
            float tz = float(ti) * 0.075;
            float c = cov(sx, -0.011, 0.011, wx) * cov(tickZ, tz + 0.02, tz + 0.042, wz);
            acc += vec3(0.85, 0.9, 1.0) * c * 1.5;
          }
        }
      }
    }

    // very distant / very blurred: converge to the average texture brightness
    float far = smoothstep(0.45, 1.6, wz / CELL);
    vec3 avg = mix(uColA, uColB, 0.3) * 0.2;
    acc = mix(acc, avg * clamp(laneBgCov, 0.0, 1.0), far);

    col = uBg + uLaneBg * clamp(laneBgCov, 0.0, 1.0) + acc;
    // atmospheric falloff with distance
    col *= exp(-max(tHit - 19.0, 0.0) * 0.035);
  }

  // stored at half scale so highlights up to 2.0 survive the 8-bit target
  outColor = vec4(col * 0.5, 1.0);
}
`;

// Post pass: lens chromatic aberration (radial R/B split), mip-pyramid bloom,
// vignette and a gentle filmic shoulder.
export const POST_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uScene;
uniform float uCA;      // aberration strength (fraction of frame)
uniform float uBloom;
uniform vec3 uBloomTint;
void main() {
  vec2 d = vUv - 0.5;
  vec2 off = d * length(d) * uCA;
  vec3 base;
  base.r = texture(uScene, vUv + off).r;
  base.g = texture(uScene, vUv).g;
  base.b = texture(uScene, vUv - off).b;
  base *= 2.0;
  vec3 glow = textureLod(uScene, vUv, 3.0).rgb * 0.55
            + textureLod(uScene, vUv, 4.5).rgb * 0.3
            + textureLod(uScene, vUv, 6.0).rgb * 0.15;
  glow *= 2.0;
  vec3 col = base + glow * uBloom * uBloomTint;
  vec2 p = vUv * 2.0 - 1.0;
  float v = smoothstep(1.55, 0.35, length(p * vec2(0.85, 1.0)));
  col *= mix(0.45, 1.0, v);
  col = col / (1.0 + 0.18 * col);
  outColor = vec4(pow(col, vec3(1.0 / 1.08)), 1.0);
}
`;

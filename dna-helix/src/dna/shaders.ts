/**
 * GLSL (WebGL 2 / GLSL ES 3.0 via Three.js) shaders used by the DNA scene.
 */

export type Palette = {
  bgCenter: [number, number, number];
  bgMid: [number, number, number];
  bgEdge: [number, number, number];
  streakA: [number, number, number];
  streakB: [number, number, number];
  glowCenter: [number, number];
};

/** Full-screen procedural backdrop: gradient, digital dot texture, lens streaks. */
export const backgroundVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const backgroundFragment = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;      // frame number
uniform vec2 uRes;
uniform vec3 uCenter;
uniform vec3 uMid;
uniform vec3 uEdge;
uniform vec3 uStreakA;
uniform vec3 uStreakB;
uniform vec2 uGlow;       // glow centre in uv
uniform float uStreakScale;
uniform float uLeak;       // late magenta edge light leaks (0..1)

float hash11(float p) { p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float hash21(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }

float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash21(i), hash21(i + vec2(1, 0)), u.x), mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), u.x), u.y);
}

// One horizontal lens streak: a bright thin core + soft halo, with soft ends.
float streak(vec2 uv, float y, float x0, float x1, float thick) {
  float aspect = uRes.x / uRes.y;
  float dy = abs(uv.y - y) * 1.0;
  float core = exp(-pow(dy / thick, 2.0));
  float halo = exp(-pow(dy / (thick * 6.0), 2.0)) * 0.25;
  float ends = smoothstep(x0, x0 + 0.08, uv.x) * (1.0 - smoothstep(x1 - 0.12, x1, uv.x));
  return (core + halo) * ends;
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2((uv.x - uGlow.x) * aspect, uv.y - uGlow.y);

  // --- base radial gradient (slowly breathing) ---
  float r = length(p * vec2(0.85, 1.15));
  float breathe = 0.03 * sin(uTime / 70.0);
  vec3 col = mix(uCenter, uMid, smoothstep(0.0, 0.55 + breathe, r));
  col = mix(col, uEdge, smoothstep(0.45, 1.25, r));
  // darker band on the far left
  col *= mix(0.38, 1.0, smoothstep(0.0, 0.5, uv.x));

  // --- large soft cloud variation ---
  float n = vnoise(uv * vec2(3.0, 2.0) + vec2(uTime * 0.0015, 0.0));
  col *= 0.85 + 0.3 * n;

  // --- distant "digital" dot texture, only visible inside the glow ---
  vec2 g = uv * vec2(aspect, 1.0) * 62.0 + vec2(uTime * 0.01, 0.0);
  vec2 gc = fract(g) - 0.5;
  float dotMask = smoothstep(0.22, 0.05, length(gc));
  float dotRand = step(0.55, hash21(floor(g)));
  float glowMask = 1.0 - smoothstep(0.0, 0.75, r);
  col += uCenter * dotMask * dotRand * glowMask * 0.12;

  // --- horizontal lens streaks (paired red/blue lines) ---
  vec3 streaks = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float period = 170.0 + 60.0 * fi;
    float tt = uTime + fi * 47.0 + 20.0;
    float cycle = floor(tt / period);
    float local = fract(tt / period);
    float vis = smoothstep(0.0, 0.12, local) * (1.0 - smoothstep(0.3, 0.45, local));
    float y = 0.12 + 0.76 * hash11(cycle * 7.13 + fi * 3.1);
    float x0 = 0.28 + 0.2 * hash11(cycle * 1.7 + fi);
    float len = 0.35 + 0.35 * hash11(cycle * 3.3 + fi * 9.0);
    float drift = (local - 0.3) * 0.12 * (hash11(fi * 4.2 + cycle) - 0.5);
    float thick = 0.0016 * uStreakScale;
    float a = streak(uv, y + 0.012, x0 + drift, x0 + len + drift, thick);
    float b = streak(uv, y - 0.012, x0 + 0.03 + drift, x0 + len + 0.05 + drift, thick);
    streaks += vis * (uStreakA * a * 0.35 + uStreakB * b * 0.45);
  }
  col += streaks;

  // --- faint vertical flares near the left / right edges ---
  for (int i = 0; i < 2; i++) {
    float fi = float(i);
    float period = 210.0 + 70.0 * fi;
    float tt = uTime + 90.0 * fi + 40.0;
    float cycle = floor(tt / period);
    float local = fract(tt / period);
    float vis = smoothstep(0.0, 0.1, local) * (1.0 - smoothstep(0.25, 0.45, local));
    float x = (i == 0) ? 0.05 + 0.06 * hash11(cycle + 2.0) : 0.86 + 0.08 * hash11(cycle + 5.0);
    float dx = abs(uv.x - x) * aspect;
    float core = exp(-pow(dx / 0.0018, 2.0)) + 0.25 * exp(-pow(dx / 0.012, 2.0));
    float yMask = smoothstep(0.1, 0.4, uv.y) * (1.0 - smoothstep(0.6, 0.95, uv.y));
    col += vis * core * yMask * mix(uStreakB, uStreakA, 0.35) * 0.16;
  }

  // --- late magenta light leaks at the left edge and bottom-right corner ---
  if (uLeak > 0.0) {
    float l1 = exp(-pow((uv.x - 0.0) / 0.045, 2.0)) * exp(-pow((uv.y - 0.45) / 0.35, 2.0));
    float l2 = exp(-pow(length((uv - vec2(1.0, 0.04)) * vec2(aspect, 1.0)) / 0.22, 2.0));
    float flick = 0.85 + 0.15 * sin(uTime * 0.21) * sin(uTime * 0.07 + 1.0);
    col += uLeak * flick * (l1 * vec3(0.07, 0.006, 0.045) + l2 * vec3(0.045, 0.004, 0.032));
  }

  // --- vignette ---
  vec2 v = uv - 0.5;
  col *= 1.0 - smoothstep(0.35, 0.95, length(v * vec2(1.1, 1.35)));

  gl_FragColor = vec4(col, 1.0);
}
`;

/** Soft point sprites for bokeh, dust and sparkles (size-attenuated, twinkling). */
export const pointsVertex = /* glsl */ `
attribute float aSize;
attribute float aPhase;
attribute vec3 aColor;
uniform float uTime;
uniform float uPixelScale;
uniform float uTwinkle;
varying vec3 vColor;
varying float vTw;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float tw = 1.0 - uTwinkle + uTwinkle * (0.5 + 0.5 * sin(uTime * (0.08 + 0.12 * fract(aPhase * 7.0)) + aPhase * 6.2831));
  vTw = tw;
  vColor = aColor;
  gl_PointSize = max(1.0, aSize * uPixelScale / max(0.1, -mv.z));
}
`;

export const pointsFragment = /* glsl */ `
precision highp float;
uniform float uOpacity;
uniform float uDisc;     // 0 = gaussian dust, 1 = flat bokeh disc
varying vec3 vColor;
varying float vTw;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  if (d > 1.0) discard;
  float gauss = exp(-d * d * 4.0);
  float disc = smoothstep(1.0, 0.82, d) * (0.75 + 0.25 * smoothstep(0.55, 0.95, d));
  float a = mix(gauss, disc, uDisc) * uOpacity * vTw;
  gl_FragColor = vec4(vColor * a, a);
}
`;

/** Separable tilt-shift blur: sharp focus band, increasing blur above/below. */
export const tiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null },
    uDir: { value: [1, 0] },
    uRes: { value: [1920, 1080] },
    uFocusY: { value: 0.5 },
    uFocusWidth: { value: 0.3 },
    uMaxRadius: { value: 8.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform vec2 uDir;
    uniform vec2 uRes;
    uniform float uFocusY;
    uniform float uFocusWidth;
    uniform float uMaxRadius;
    varying vec2 vUv;
    void main() {
      float d = max(0.0, abs(vUv.y - uFocusY) - uFocusWidth) / max(0.001, 0.5 - uFocusWidth);
      float edgeX = smoothstep(0.75, 1.0, vUv.x) * 0.6;
      float radius = uMaxRadius * clamp(d * d + edgeX * 0.5, 0.0, 1.5);
      if (radius < 0.35) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      vec2 stepUv = uDir / uRes * radius / 4.0;
      vec4 acc = vec4(0.0);
      float wsum = 0.0;
      for (int i = -6; i <= 6; i++) {
        float fi = float(i);
        float w = exp(-fi * fi / 18.0);
        acc += texture2D(tDiffuse, vUv + stepUv * fi) * w;
        wsum += w;
      }
      gl_FragColor = acc / wsum;
    }
  `,
};

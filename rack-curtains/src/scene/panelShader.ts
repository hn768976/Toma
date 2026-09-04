// Dot grids are evaluated in the fragment shader rather than drawn into
// canvas textures: one instanced draw call covers every panel, the dots stay
// resolution-independent (so 1080p and 4K read identically), and there are no
// per-frame texture uploads.
//
// Every time-varying term is periodic with period 1 in uTime (which runs
// 0 -> 1 across the composition): fract() terms advance by whole cycles and
// sin() terms use integer frequencies, so frame 300 reproduces frame 0
// exactly.

export const panelVertexShader = /* glsl */ `
  attribute float aPanelId;
  attribute float aBright;

  uniform float uFocus;
  uniform float uRange;
  uniform float uBuckets;

  varying vec2  vUv;
  varying float vPanelId;
  varying float vBright;
  varying float vBlur;
  varying float vDepth;

  void main() {
    vUv = uv;
    vPanelId = aPanelId;
    vBright = aBright;

    // Depth of field is bucketed per instance, not per fragment, so a panel
    // never has a blur gradient running across its own face.
    vec4 instOrigin = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    vDepth = -instOrigin.z;
    float raw = clamp(abs(vDepth - uFocus) / uRange, 0.0, 1.0);
    vBlur = floor(raw * uBuckets + 0.5) / uBuckets;

    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

export const panelFragmentShader = /* glsl */ `
  precision highp float;

  uniform float uTime;      // 0 -> 1 across the loop
  uniform float uCols;
  uniform float uRows;
  uniform vec3  uDim;
  uniform vec3  uBright;
  uniform float uGain;
  uniform float uHazeStart;
  uniform float uHazeFalloff;

  varying vec2  vUv;
  varying float vPanelId;
  varying float vBright;
  varying float vBlur;
  varying float vDepth;

  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 grid = vec2(uCols, uRows);
    vec2 gv   = vUv * grid;
    vec2 cell = floor(gv);
    vec2 f    = fract(gv) - 0.5;

    float seed = vPanelId * 17.13 + 3.7;
    float cellRow = cell.y;
    float cellCol = cell.x;

    // Idle shimmer so unlit parts of the grid still read as a dot field.
    float base = 0.045 + 0.10 * hash21(cell + seed);

    // Horizontal runs: a bright head sweeping along a row with a short
    // trailing tail, which is what makes the panels read as "processing".
    // Integer speeds keep the sweep loop-exact.
    float rowActive = step(0.42, hash11(cellRow * 3.71 + seed));
    float speed     = 1.0 + floor(hash11(cellRow * 7.13 + seed) * 3.0);
    float dir       = hash11(cellRow * 11.7 + seed) < 0.5 ? -1.0 : 1.0;
    float head      = fract(hash11(cellRow * 5.37 + seed) + dir * uTime * speed);
    float u         = (cellCol + 0.5) / uCols;
    float trail     = fract(u - head + 1.0);
    float run       = exp(-trail * 18.0) * rowActive;

    // Blocks of the grid breathing in and out, again on integer frequencies.
    vec2  clusterId   = floor(cell / vec2(7.0, 11.0));
    float clusterSeed = hash21(clusterId + seed);
    float cycles      = 1.0 + floor(hash21(clusterId + seed + 19.0) * 2.0);
    float pulse       = 0.5 + 0.5 * sin(6.2831853 * (cycles * uTime + clusterSeed));
    float clusterMask = step(0.55, clusterSeed);

    float lum = base + run * 1.30 + pulse * clusterMask * 0.22;
    lum *= vBright;

    // Dot shape. The core stays tight so the sharp band still reads as
    // discrete dots; the wide lobe is the bloom, which additive blending
    // accumulates into glow wherever dots are dense and bright.
    float r  = length(f * vec2(1.06, 1.0));
    float radius = 0.30 + vBlur * 0.22;
    float edge   = 0.07 + vBlur * 0.46;
    float aa     = fwidth(r) * 1.25;
    float core   = 1.0 - smoothstep(radius - edge - aa, radius + edge + aa, r);
    float halo   = exp(-r * r * (3.4 - vBlur * 2.0)) * (0.26 + vBlur * 0.42);

    // Panels sit in atmosphere, so the far aisles wash out into the haze.
    float haze = exp(-max(vDepth - uHazeStart, 0.0) * uHazeFalloff);

    // Soften only where a panel meets the floor; the top edge stays crisp.
    float bottomFade = smoothstep(0.0, 0.07, vUv.y);

    vec3  tint = mix(uDim, uBright, smoothstep(0.10, 0.60, clamp(lum, 0.0, 1.0)));
    // A faint flat sheet under the dots, so each panel still reads as a
    // bounded rectangle rather than dissolving into the mass behind it.
    float body = 0.012;
    float intensity = (lum * (core + halo) + body) * haze * bottomFade * uGain;

    gl_FragColor = vec4(tint * intensity, 1.0);
  }
`;

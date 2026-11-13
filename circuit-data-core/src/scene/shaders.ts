// WebGL 2 GLSL shaders for the circuit-board data core.

const NOISE = /* glsl */ `
  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float vnoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash12(i), hash12(i + vec2(1.0, 0.0)), u.x),
               mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x), u.y);
  }
`;

// ---------------------------------------------------------------------------
// Circuit floor / substrate top: tiled PCB with energised, pulsing traces,
// a blue light pool under the core, depth haze and fake depth-of-field
// (blend between pre-blurred texture levels by circle of confusion).
// ---------------------------------------------------------------------------
export const floorVertex = /* glsl */ `
  varying vec3 vWorld;
  varying float vDepth;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mv = viewMatrix * world;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

export const floorFragment = /* glsl */ `
  uniform sampler2D uBase0;
  uniform sampler2D uBase1;
  uniform sampler2D uBase2;
  uniform sampler2D uGlow0;
  uniform sampler2D uGlow1;
  uniform sampler2D uGlow2;
  uniform float uTileSize;
  uniform vec2 uTileOffset;
  uniform float uFocusDist;
  uniform float uDofRange;
  uniform float uSharpBias;
  uniform float uTime;
  uniform vec3 uGlowColor;
  uniform vec3 uGlowCore;
  uniform float uGlowGain;
  uniform vec3 uPoolColor;
  uniform float uPoolRadius;
  uniform float uPoolGain;
  uniform vec3 uFogColor;
  uniform float uFogNear;
  uniform float uFogFar;
  uniform float uBaseGain;
  uniform float uEnergy;
  varying vec3 vWorld;
  varying float vDepth;
  ${NOISE}

  void main() {
    vec2 uv = vWorld.xz / uTileSize + uTileOffset;

    // Circle of confusion: 0 = in focus, 1 = fully defocused.
    float coc = clamp(abs(vDepth - uFocusDist) / (uDofRange * uFocusDist) - uSharpBias, 0.0, 1.0);
    // Far regions need relatively more texture-space blur to look equally soft.
    float lvl = clamp(coc * 2.0, 0.0, 2.0);

    vec3 b0 = texture2D(uBase0, uv).rgb;
    vec3 b1 = texture2D(uBase1, uv).rgb;
    vec3 b2 = texture2D(uBase2, uv).rgb;
    float g0 = texture2D(uGlow0, uv).r;
    float g1 = texture2D(uGlow1, uv).r;
    float g2 = texture2D(uGlow2, uv).r;
    vec3 base = lvl < 1.0 ? mix(b0, b1, lvl) : mix(b1, b2, lvl - 1.0);
    float glow = lvl < 1.0 ? mix(g0, g1, lvl) : mix(g1, g2, lvl - 1.0);
    // Defocused glow spreads out — keep its energy so bokeh stays luminous.
    glow *= 1.0 + lvl * 0.7;

    // Energy pulses running through the traces.
    float n = vnoise(vWorld.xz * 0.33 + 7.0);
    float wave = 0.5 + 0.5 * sin(vWorld.x * 1.1 + vWorld.z * 0.6 - uTime * 1.5 + n * 9.0);
    float wave2 = 0.5 + 0.5 * sin(-vWorld.x * 0.5 + vWorld.z * 1.3 - uTime * 1.1 + n * 5.0);
    float pulse = 0.35 + 1.2 * pow(wave, 6.0) + 0.7 * pow(wave2, 8.0);
    float breathe = 0.65 + 0.35 * vnoise(vWorld.xz * 0.18 + vec2(uTime * 0.07, 0.0));

    // Light pool spilling out from the glowing core.
    float d = length(vWorld.xz);
    float pool = exp(-(d * d) / (uPoolRadius * uPoolRadius));

    // Blinking SMD lights: bright board pixels flash on and off in their own rhythm.
    vec2 cellB = floor(vWorld.xz * 2.5);
    float blink = step(0.55, fract(uTime * (0.6 + hash12(cellB) * 1.4) + hash12(cellB + 3.1)));
    float padMask = smoothstep(0.36, 0.55, dot(base, vec3(0.333)));
    vec3 col = base * uBaseGain * (0.85 + pool * 1.6) * (1.0 - padMask * 0.6 + padMask * blink * 2.6);
    vec3 glowCol = mix(uGlowColor, uGlowCore, clamp(glow * glow * 0.8, 0.0, 1.0));
    col += glowCol * glow * pulse * breathe * uGlowGain * uEnergy * (0.75 + pool * 1.8);
    col += uPoolColor * pool * uPoolGain;

    float fog = smoothstep(uFogNear, uFogFar, vDepth);
    col = mix(col, uFogColor, fog * 0.85);
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// Data-core glass shell: procedural grid of memory cells, twinkling bits,
// a travelling scan band, etched glowing circuitry, fresnel glass and
// bright bevelled edges. Rendered additively, several nested shells deep.
// ---------------------------------------------------------------------------
export const shellVertex = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vObjN;
  varying vec3 vWorldN;
  varying vec3 vWorldPos;
  varying float vDepth;
  void main() {
    vObj = position;
    vObjN = normal;
    vWorldN = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vec4 mv = viewMatrix * world;
    vDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

export const shellFragment = /* glsl */ `
  uniform vec3 uSize;          // full box size (object units)
  uniform float uTime;
  uniform float uSeed;
  uniform float uIntensity;
  uniform vec3 uGlass;
  uniform vec3 uCell;
  uniform vec3 uTraceColor;
  uniform vec3 uEdgeColor;
  uniform float uCellSize;
  uniform float uCellGain;
  uniform float uTraceGain;
  uniform float uEdgeGain;
  uniform float uSparkGain;
  uniform sampler2D uTrace;
  uniform float uEnergy;
  uniform float uReflect;      // 1 when drawing the floor reflection
  uniform float uBaseY;        // world Y of the reflection plane
  varying vec3 vObj;
  varying vec3 vObjN;
  varying vec3 vWorldN;
  varying vec3 vWorldPos;
  varying float vDepth;
  ${NOISE}

  void main() {
    vec3 an = abs(vObjN);
    vec2 coord;
    vec2 half_;
    float side = 0.0;
    if (an.y > 0.5) {
      coord = vObj.xz; half_ = uSize.xz * 0.5;
    } else if (an.x > 0.5) {
      coord = vObj.zy; half_ = uSize.zy * 0.5; side = 1.0;
    } else {
      coord = vObj.xy; half_ = uSize.xy * 0.5; side = 1.0;
    }

    // Distance to the face border (world-ish units) for bevel glow.
    vec2 edgeD = half_ - abs(coord);
    float ed = min(edgeD.x, edgeD.y);
    float edgePx = ed / max(fwidth(ed), 1e-5);
    float edgeLine = 1.0 - smoothstep(1.0, 2.6, edgePx);
    float edgeGlow = exp(-ed / 0.035) * 0.6 + edgeLine;

    // Memory-cell grid. Side faces get wider cells in horizontal strata.
    vec2 cs = side > 0.5 ? vec2(uCellSize * 1.55, uCellSize * 0.95) : vec2(uCellSize * 1.25, uCellSize);
    vec2 g = (coord + half_) / cs;
    vec2 id = floor(g);
    vec2 f = fract(g);
    vec2 fw = fwidth(g);
    vec2 m = smoothstep(vec2(0.14, 0.2), vec2(0.14, 0.2) + fw * 1.2, f) * (1.0 - smoothstep(vec2(0.86, 0.8) - fw * 1.2, vec2(0.86, 0.8), f));
    float mask = m.x * m.y;
    float h = hash12(id + uSeed * 17.0);
    float on = step(0.22, h);
    float lum = 0.12 + 0.88 * h * h * h;
    // Scan band sweeping across the core (data flowing).
    float scan = pow(0.5 + 0.5 * sin((coord.x + coord.y) * 2.4 - uTime * 1.8 + uSeed * 3.0), 10.0);
    // Individual bits flicking on to white.
    float tick = floor(uTime * 7.0 + h * 40.0);
    float spark = step(0.982, hash12(id * 1.37 + tick + uSeed));
    float strata = side * smoothstep(0.86, 1.0, fract((vObj.y + half_.y) / (uCellSize * 2.9)));

    vec3 cells = uCell * lum * mask * on * (0.8 + scan * 1.6);
    vec3 sparks = vec3(1.0) * spark * mask * uSparkGain;

    // Etched circuitry on the glass, pulsing.
    float tr = texture2D(uTrace, coord * 0.33 + vec2(uSeed * 0.37, uSeed * 0.71)).r;
    float trPulse = 0.4 + 1.3 * pow(0.5 + 0.5 * sin(coord.x * 3.0 - coord.y * 2.0 - uTime * 2.2 + uSeed), 4.0);

    // Fresnel glass body.
    vec3 V = normalize(cameraPosition - vWorldPos);
    float fres = pow(1.0 - abs(dot(normalize(vWorldN), V)), 2.0);
    vec3 glass = uGlass * (0.12 + 0.7 * fres);
    // Glassy sheen: brighter towards the top / far edge of each face.
    float sheen = smoothstep(-half_.y, half_.y, coord.y) * (1.0 - side) * 0.25
      + smoothstep(0.0, half_.y * 2.0, coord.y + half_.y) * side * 0.12;
    glass += uEdgeColor * sheen * 0.35;

    // Irregular electric-cyan patches crawling over the glass.
    float blotch = smoothstep(0.58, 0.92, vnoise(coord * 2.2 + vec2(uTime * 0.12, uSeed * 5.0)));

    vec3 col = glass
      + uTraceColor * blotch * 0.8 * uTraceGain * uEnergy
      + cells * uCellGain * (1.0 + blotch * 0.8)
      + sparks
      + uTraceColor * tr * trPulse * uTraceGain
      + uEdgeColor * edgeGlow * uEdgeGain
      + uCell * strata * 0.35;
    col *= uIntensity * mix(1.0, uEnergy, 0.7);

    if (uReflect > 0.5) {
      // Reflection fades out the further it is from the mirror plane.
      float below = max(uBaseY - vWorldPos.y, 0.0);
      col *= exp(-below * 2.2) * 0.28;
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ---------------------------------------------------------------------------
// Floating dust / data motes rendered as soft bokeh discs whose size follows
// the circle of confusion.
// ---------------------------------------------------------------------------
export const moteVertex = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uFocusDist;
  uniform float uPxScale;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    vec3 p = position;
    p.y += mod(uTime * (0.05 + aSeed * 0.08) + aSeed * 3.0, 2.2);
    p.x += sin(uTime * 0.4 + aSeed * 30.0) * 0.06;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float depth = -mv.z;
    float coc = clamp(abs(depth - uFocusDist) / (0.45 * uFocusDist), 0.0, 1.0);
    float size = (2.0 + coc * 26.0) * uPxScale;
    gl_PointSize = size;
    float life = mod(uTime * (0.05 + aSeed * 0.08) + aSeed * 3.0, 2.2) / 2.2;
    vAlpha = sin(life * 3.14159) * (0.9 - coc * 0.6) * (0.5 + 0.5 * fract(aSeed * 91.7));
    vSoft = coc;
    gl_Position = projectionMatrix * mv;
  }
`;

export const moteFragment = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  varying float vSoft;
  void main() {
    vec2 c = gl_PointCoord * 2.0 - 1.0;
    float r = length(c);
    float disc = 1.0 - smoothstep(mix(0.45, 0.85, vSoft), 1.0, r);
    gl_FragColor = vec4(uColor * disc * vAlpha, 1.0);
  }
`;

/** GLSL shared by the globe layers. Positions are in world units, globe radius 1 at the origin. */

const COMMON = /* glsl */ `
  float hash11(float n) { return fract(sin(n) * 43758.5453123); }

  // 1.0 when world point P is hidden behind the globe as seen from the camera.
  float behindGlobe(vec3 P) {
    vec3 C = cameraPosition;
    vec3 D = P - C;
    float L = length(D);
    D /= L;
    float b = dot(C, D);
    float c = dot(C, C) - 1.0;
    float h = b * b - c;
    if (h <= 0.0) return 0.0;
    float tHit = -b - sqrt(h);
    return (tHit > 0.0 && tHit < L) ? smoothstep(0.0, 0.03, h) : 0.0;
  }

  vec3 ramp(vec3 deep, vec3 mainC, vec3 hot, float level) {
    return level < 0.5 ? mix(deep, mainC, level * 2.0) : mix(mainC, hot, (level - 0.5) * 2.0);
  }
`;

/**
 * Binary digits lying flat on spherical shells (the planet surface and the
 * floating data panels). Each instance is a quad oriented east/north at its
 * position, textured from a 4-cell atlas: [0][1][0 blurred][1 blurred].
 */
export const digitVertex = /* glsl */ `
  ${COMMON}
  attribute vec3 iPos;
  attribute vec4 iData;   // seed, colour level, size multiplier, flicker rate
  attribute float iKind;  // 0 = planet surface, 1 = floating data panel
  uniform float uTime;
  uniform float uSize;
  uniform float uDefocus;
  uniform float uPanelDefocus;
  uniform float uBackFade;
  uniform float uExposure;
  uniform float uGain;
  uniform float uPanelBoost;
  varying vec2 vUv;
  varying float vGlyph;
  varying float vAlpha;
  varying float vLevel;
  varying float vBlur;

  void main() {
    vUv = uv;
    vec3 n = normalize(iPos);
    vec3 refUp = abs(n.y) > 0.999 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
    vec3 east = normalize(cross(refUp, n));
    vec3 north = normalize(cross(n, east));

    float blur = clamp(uDefocus + iKind * uPanelDefocus, 0.0, 1.0);
    float s = uSize * iData.z * (1.0 + 0.5 * blur);
    vec3 p = iPos + (east * position.x * 0.625 + north * position.y) * s;
    vec4 world = modelMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;

    vec3 nW = normalize(mat3(modelMatrix) * n);
    vec3 toCam = normalize(cameraPosition - world.xyz);
    float facing = dot(nW, toCam);
    float front = mix(uBackFade, 1.0, smoothstep(-0.02, 0.22, facing));
    if (iKind > 0.5) {
      front = mix(1.0, 0.18, behindGlobe(world.xyz));
    }

    float rate = 0.35 + iData.w * 4.0;
    float tick = floor(uTime * rate + iData.x * 17.0);
    vGlyph = step(0.5, hash11(iData.x * 91.7 + tick * 13.37));

    float twinkle = 0.78 + 0.22 * sin(uTime * (1.3 + iData.w * 5.0) + iData.x * 61.0);
    // Panels: rows switch on/off in little bursts, like streaming data.
    float panelGate = 1.0;
    if (iKind > 0.5) {
      float g = hash11(floor(uTime * 2.5 + iData.x * 5.0) * 7.1 + iData.x * 33.0);
      panelGate = g > 0.22 ? 1.0 : 0.15;
    }
    vAlpha = front * twinkle * panelGate * uExposure * (1.0 - 0.35 * blur) * mix(uGain, (1.0 + 0.4 * (uGain - 1.0)) * uPanelBoost, iKind);
    vLevel = iData.y;
    vBlur = blur;
  }
`;

export const digitFragment = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 uDeep;
  uniform vec3 uMain;
  uniform vec3 uHot;
  varying vec2 vUv;
  varying float vGlyph;
  varying float vAlpha;
  varying float vLevel;
  varying float vBlur;
  ${COMMON.split("float behindGlobe")[0]}
  vec3 rampF(float level) {
    return level < 0.5 ? mix(uDeep, uMain, level * 2.0) : mix(uMain, uHot, (level - 0.5) * 2.0);
  }
  void main() {
    float cx = (vUv.x + vGlyph) * 0.25;
    float sharp = texture2D(uAtlas, vec2(cx, vUv.y)).a;
    float soft = texture2D(uAtlas, vec2(cx + 0.5, vUv.y)).a;
    float a = mix(sharp, soft, vBlur) * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(rampF(vLevel), a);
  }
`;

/**
 * Camera-facing binary strings ("01101001") that float around the planet.
 * One instance per character; all characters of a label share the anchor.
 */
export const labelVertex = /* glsl */ `
  ${COMMON}
  attribute vec3 iAnchor;
  attribute vec4 iChar;   // char offset, seed, label seed, brightness
  uniform float uTime;
  uniform float uCharH;
  uniform float uExposure;
  varying vec2 vUv;
  varying float vGlyph;
  varying float vAlpha;

  void main() {
    vUv = uv;
    vec4 world = modelMatrix * vec4(iAnchor, 1.0);
    vec4 mv = viewMatrix * world;
    float w = uCharH * 0.625;
    mv.xy += vec2((iChar.x + position.x * 0.92) * w * 1.05, position.y * uCharH);
    gl_Position = projectionMatrix * mv;

    float rate = 1.5 + hash11(iChar.z * 13.0) * 5.0;
    float tick = floor(uTime * rate + iChar.y * 7.0);
    vGlyph = step(0.5, hash11(iChar.y * 51.3 + tick * 3.77));

    // Labels blink in and out over a few seconds with a typewriter reveal.
    float cycle = uTime * 0.22 + iChar.z * 9.0;
    float ph = fract(cycle);
    float on = hash11(floor(cycle) * 3.1 + iChar.z * 17.0) > 0.25 ? 1.0 : 0.0;
    float reveal = step(iChar.x + 4.5, ph * 60.0) * step(ph, 0.92);
    float occl = mix(1.0, 0.12, behindGlobe(world.xyz));
    vAlpha = on * reveal * occl * iChar.w * uExposure;
  }
`;

export const labelFragment = /* glsl */ `
  uniform sampler2D uAtlas;
  uniform vec3 uHot;
  varying vec2 vUv;
  varying float vGlyph;
  varying float vAlpha;
  void main() {
    float a = texture2D(uAtlas, vec2((vUv.x + vGlyph) * 0.25, vUv.y)).a * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uHot, a);
  }
`;

/** Soft round points: orbital ring particles, network nodes and dust. */
export const pointVertex = /* glsl */ `
  ${COMMON}
  attribute float aSize;   // diameter in 1080p pixels
  attribute float aBright;
  attribute float aLevel;
  uniform float uPx;
  uniform float uTime;
  uniform float uExposure;
  uniform float uOcclusion;   // how strongly the globe hides points behind it
  uniform float uSurface;     // 1 = points sit on the globe surface (fade back side)
  uniform vec3 uDeep;
  uniform vec3 uMain;
  uniform vec3 uHot;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * viewMatrix * world;
    float hidden = behindGlobe(world.xyz);
    if (uSurface > 0.5) {
      vec3 nW = normalize(world.xyz);
      float facing = dot(nW, normalize(cameraPosition - world.xyz));
      hidden = 1.0 - smoothstep(-0.05, 0.2, facing);
    }
    float twinkle = 0.7 + 0.3 * sin(uTime * 2.3 + aBright * 40.0 + position.x * 30.0);
    vAlpha = aBright * twinkle * mix(1.0, 0.15, hidden * uOcclusion) * uExposure;
    vColor = ramp(uDeep, uMain, uHot, aLevel);
    gl_PointSize = max(1.0, aSize * uPx);
  }
`;

export const pointFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 d = gl_PointCoord - 0.5;
    float r = length(d) * 2.0;
    float core = smoothstep(1.0, 0.0, r);
    float a = core * core * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

/** Fresnel shell: bright limb plus faint body fill of the hologram. */
export const atmoVertex = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

export const atmoFragment = /* glsl */ `
  uniform vec3 uRim;
  uniform vec3 uFill;
  uniform float uExposure;
  uniform float uRimStrength;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float f = 1.0 - clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
    float rim = pow(f, 5.0) * uRimStrength;
    vec3 col = uRim * rim + uFill * (0.10 + 0.3 * f);
    gl_FragColor = vec4(col * uExposure, 1.0);
  }
`;

import * as THREE from "three";

// Screen-space "neon" filaments with a cheap depth-of-field model.
//
// Every polyline segment becomes its own quad. The fragment shader evaluates
// the segment convolved with a 2D gaussian: a gaussian across the segment
// times an erf window along it. Adjacent segment windows telescope, so a
// polyline sums to one seamless line, and tight bends cannot fan out.
//
// The gaussian width is the line's own projected width plus the circle of
// confusion for its depth, and brightness is divided by the same factor, so
// lines away from the focal plane bloom into soft, dimmer bokeh streaks
// exactly like a shallow-focus lens.
const vertexShader = /* glsl */ `
  uniform float uAspect;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uMinWidth;
  uniform float uFog;
  uniform float uMaxCoc;
  attribute vec3 aOther;
  attribute float aEnd;
  attribute float aSide;
  attribute float aWidth;
  attribute float aIntensity;
  attribute vec3 aColor;
  attribute float aU;
  // Screen-linear quantities are passed pre-multiplied by w and divided in
  // the fragment shader (GLSL ES 3.00 has no noperspective qualifier).
  varying float vAcrossW;
  varying float vAlongW;
  varying float vLenW;
  varying float vW;
  varying float vEnergy;
  varying vec3 vColor;

  const float EXTENT = 3.2; // quad half-size in sigmas

  void main() {
    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    vec4 cur = projectionMatrix * viewPos;
    vec4 oth = projectionMatrix * modelViewMatrix * vec4(aOther, 1.0);
    float depth = -viewPos.z;

    vColor = aColor;
    vec3 seg3 = aOther - position;
    if (depth < 0.05 || oth.w < 0.05 || dot(seg3, seg3) == 0.0) {
      vEnergy = 0.0;
      vAcrossW = 0.0;
      vAlongW = 0.0;
      vLenW = 0.0;
      vW = cur.w;
      gl_Position = cur;
      return;
    }

    vec2 aspect = vec2(uAspect, 1.0);
    vec2 self2 = cur.xy / cur.w * aspect;
    vec2 other2 = oth.xy / oth.w * aspect;
    vec2 dir = aEnd < 0.5 ? other2 - self2 : self2 - other2;
    float segLen = length(dir);
    dir = segLen > 1e-7 ? dir / segLen : vec2(1.0, 0.0);
    vec2 normal = vec2(-dir.y, dir.x);

    // Half widths in NDC-y units.
    float core = max(0.5 * aWidth * projectionMatrix[1][1] / depth, uMinWidth);
    // Capped so filaments brushing past the lens stay a soft glow instead of
    // screen-filling haze (which is also very expensive to fill).
    float coc = min(uAperture * abs(depth - uFocus) / max(depth, 0.001), uMaxCoc);
    float sigma = core + coc;

    float endSign = aEnd < 0.5 ? -1.0 : 1.0;
    vec2 offset = normal * aSide * EXTENT * sigma + dir * endSign * EXTENT * sigma;
    cur.xy += offset / aspect * cur.w;
    gl_Position = cur;

    float lenS = segLen / sigma;
    float along = aEnd < 0.5 ? -EXTENT : lenS + EXTENT;
    vW = cur.w;
    vAcrossW = aSide * EXTENT * cur.w;
    vAlongW = along * cur.w;
    vLenW = lenS * cur.w;

    vEnergy = aIntensity * core / sigma;
    // Fade lines that brush past the lens and dissolve the far track into haze.
    vEnergy *= smoothstep(0.25, 1.2, depth) * exp(-depth * uFog);
    // Soft ends so short light segments never show hard caps.
    vEnergy *= smoothstep(0.0, 0.2, aU) * smoothstep(1.0, 0.8, aU);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uGain;
  varying float vAcrossW;
  varying float vAlongW;
  varying float vLenW;
  varying float vW;
  varying float vEnergy;
  varying vec3 vColor;

  float erfApprox(float x) {
    float x2 = x * x;
    float a = 0.147;
    float r = sqrt(1.0 - exp(-x2 * (1.27324 + a * x2) / (1.0 + a * x2)));
    return x < 0.0 ? -r : r;
  }

  // Gaussian line segment of length len (all in units of s) evaluated at
  // (across, along).
  float segment(float across, float along, float len, float s) {
    float g = exp(-0.5 * (across * across) / (s * s));
    float w = 0.5 * (erfApprox(along / (s * 1.41421)) - erfApprox((along - len) / (s * 1.41421)));
    return g * w;
  }

  void main() {
    if (vEnergy <= 0.0) discard;
    float across = vAcrossW / vW;
    float along = vAlongW / vW;
    float len = vLenW / vW;
    float core = segment(across, along, len, 0.8);
    float halo = segment(across, along, len, 1.4) * 0.24;
    float a = (core + halo) * vEnergy * uGain;
    // Hot cores drift toward white, like an over-exposed light trail.
    vec3 col = mix(vColor, vec3(0.85, 0.95, 1.0), clamp(core * vEnergy - 0.55, 0.0, 0.6));
    gl_FragColor = vec4(col * a, 1.0);
  }
`;

export const createRibbonMaterial = () =>
  new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      uAspect: { value: 16 / 9 },
      uFocus: { value: 6 },
      uAperture: { value: 0.02 },
      uMinWidth: { value: 0.0012 },
      uGain: { value: 0.68 },
      uFog: { value: 0.03 },
      uMaxCoc: { value: 0.035 },
    },
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    side: THREE.DoubleSide,
  });

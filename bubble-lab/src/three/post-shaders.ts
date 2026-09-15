/** Fullscreen-triangle vertex stage shared by every post pass. */
export const quadVertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

/**
 * Studio backdrop. A soft radial falloff plus an optional linear ramp,
 * which together cover every background in the reference set — flat white
 * sweeps, warm cream, and the deep blue vignette gradient alike.
 */
export const backgroundFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform vec3  uInner;
  uniform vec3  uOuter;
  uniform vec2  uCenter;
  uniform float uRadius;
  uniform float uFalloff;
  uniform vec3  uRampColor;
  uniform float uRampAmount;
  uniform float uRampAngle;
  uniform float uAspect;
  uniform float uPanel;

  /** Soft elliptical softbox. */
  float panel(vec2 p, vec2 c, vec2 r, float rot) {
    vec2 q = p - c;
    float cs = cos(rot);
    float sn = sin(rot);
    q = vec2(q.x * cs - q.y * sn, q.x * sn + q.y * cs) / r;
    return 1.0 - smoothstep(0.35, 1.0, length(q));
  }

  void main() {
    vec2 p = vUv - uCenter;
    p.x *= uAspect;
    float d = length(p) / max(uRadius, 0.0001);
    float g = pow(clamp(d, 0.0, 1.0), uFalloff);
    vec3 col = mix(uInner, uOuter, g);

    vec2 dir = vec2(cos(uRampAngle), sin(uRampAngle));
    float ramp = clamp(dot(vUv - 0.5, dir) + 0.5, 0.0, 1.0);
    col = mix(col, uRampColor, ramp * uRampAmount);

    // Two softboxes standing off-camera. A smooth gradient refracts to nothing
    // visible, so without some structure in the environment the bubbles have
    // nothing to bend and read as flat tinted discs. These are what produce the
    // sweeping bright bands seen inside the reference bubbles.
    vec2 q = vec2((vUv.x - 0.5) * uAspect, vUv.y - 0.5);
    float lights =
      panel(q, vec2(-0.42, 0.26), vec2(0.20, 0.50), 0.35) * 1.0 +
      panel(q, vec2(0.50, -0.10), vec2(0.15, 0.42), -0.25) * 0.7;
    col += lights * uPanel;

    gl_FragColor = vec4(col, 1.0);
  }
`;

/**
 * Separable gaussian used to build the out-of-focus layers. Nine taps at a
 * scalable stride: wide enough for creamy bokeh, cheap enough to run twice
 * per layer per frame.
 */
export const blurFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uTex;
  uniform vec2  uTexel;
  uniform vec2  uDirection;
  uniform float uRadius;

  void main() {
    vec2 step = uTexel * uDirection * uRadius;
    vec4 sum = texture2D(uTex, vUv) * 0.1963;
    sum += texture2D(uTex, vUv + step * 1.0) * 0.1747;
    sum += texture2D(uTex, vUv - step * 1.0) * 0.1747;
    sum += texture2D(uTex, vUv + step * 2.0) * 0.1213;
    sum += texture2D(uTex, vUv - step * 2.0) * 0.1213;
    sum += texture2D(uTex, vUv + step * 3.0) * 0.0658;
    sum += texture2D(uTex, vUv - step * 3.0) * 0.0658;
    sum += texture2D(uTex, vUv + step * 4.0) * 0.0279;
    sum += texture2D(uTex, vUv - step * 4.0) * 0.0279;
    gl_FragColor = sum;
  }
`;

/**
 * Final grade: composites the sharp mid layer over the blurred background,
 * lays the defocused foreground on top, then applies bloom, lens chroma,
 * vignette, and grain. Grain is driven by a frame uniform rather than a clock
 * so renders stay deterministic.
 */
export const gradeFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uScene;
  uniform sampler2D uForeground;
  uniform sampler2D uBloom;
  uniform float uBloomAmount;
  uniform float uChroma;
  uniform float uVignette;
  uniform float uGrain;
  uniform float uExposure;
  uniform float uContrast;
  uniform float uSaturation;
  uniform float uFrame;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    // Lens chromatic aberration, scaled by distance from centre.
    vec2 d = vUv - 0.5;
    float r2 = dot(d, d);
    vec2 ca = d * r2 * uChroma;

    vec3 col;
    col.r = texture2D(uScene, vUv + ca).r;
    col.g = texture2D(uScene, vUv).g;
    col.b = texture2D(uScene, vUv - ca).b;

    // The foreground plate is rendered premultiplied so the defocus blur does
    // not bleed black in from the transparent regions around each bubble.
    vec4 fg = texture2D(uForeground, vUv);
    col = fg.rgb + col * (1.0 - clamp(fg.a, 0.0, 1.0));

    col += texture2D(uBloom, vUv).rgb * uBloomAmount;

    col *= uExposure;
    col = (col - 0.5) * uContrast + 0.5;

    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(luma), col, uSaturation);

    float vig = 1.0 - uVignette * smoothstep(0.25, 0.95, length(d) * 1.414);
    col *= vig;

    float g = hash12(vUv * vec2(1920.0, 1080.0) + uFrame * 17.13) - 0.5;
    col += g * uGrain;

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

/** Highlight isolation feeding the bloom blur. */
export const brightPassFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform float uThreshold;

  void main() {
    vec3 c = texture2D(uTex, vUv).rgb;
    float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
    float k = smoothstep(uThreshold, uThreshold + 0.25, l);
    gl_FragColor = vec4(c * k, 1.0);
  }
`;

/** Straight copy, used to promote a render target into the next layer's backdrop. */
export const copyFragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  void main() {
    gl_FragColor = texture2D(uTex, vUv);
  }
`;

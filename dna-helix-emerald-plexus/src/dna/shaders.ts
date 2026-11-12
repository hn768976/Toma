// GLSL for the plexus/particle look.
//
// All sizes are authored in "1080p pixels" and multiplied by uPxScale
// (= canvas height / 1080) so the 4K composition is a sharper version of
// the same image rather than a different-looking one.
//
// Depth of field: circle of confusion (CoC) in pixels is
//   coc = aperture * |depth - focus| / depth * pxScale
// Points grow by the CoC and turn into hollow "bokeh rings" (lens look in
// the reference); lines widen and fade with the CoC.

export const pointVertex = /* glsl */ `
  attribute vec3 color;
  attribute float size;
  attribute float alpha;
  attribute float kind;   // 0 sparkle, 1 bokeh-capable dust, 2 node marker, 3 soft blob, 4 ring dot
  attribute float phase;

  uniform float uTime;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uPxScale;
  uniform float uMaxCoc;
  uniform float uRefDepth;
  uniform float uMaxPoint;
  uniform float uRingAmount;
  uniform float uTwinkle;
  uniform float uGain;
  uniform vec2 uFog; // x: start distance, y: density (0 = off)

  varying vec3 vColor;
  varying float vAlpha;
  varying float vRing;
  varying float vKind;
  varying float vSharp;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = -mv.z;
    gl_Position = projectionMatrix * mv;
    if (depth < 0.05) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      gl_PointSize = 0.0;
      vAlpha = 0.0;
      return;
    }
    float base = max(size * uPxScale * (uRefDepth / depth), 1.1 * uPxScale);
    float coc = min(uAperture * abs(depth - uFocus) / depth * uPxScale, uMaxCoc * uPxScale);
    if (kind > 2.5) coc *= 1.0; // blobs keep full blur
    float s = sqrt(base * base + coc * coc);
    float tw = 1.0 - uTwinkle + uTwinkle * (0.5 + 0.5 * sin(uTime * (1.3 + fract(phase * 7.31) * 3.7) + phase * 6.2831));
    float energy = pow(base / s, kind > 0.5 && kind < 1.5 ? 1.05 : 1.35);
    gl_PointSize = min(s + 2.0 * uPxScale, uMaxPoint);
    vColor = color;
    float fog = exp(-max(depth - uFog.x, 0.0) * uFog.y);
    vAlpha = alpha * tw * energy * uGain * smoothstep(0.12, 0.7, depth) * fog;
    vSharp = base / s;
    // Out-of-focus dust becomes a ring; sparkles mostly stay soft discs.
    float ringiness = kind > 0.5 && kind < 1.5 ? 1.0 : 0.35;
    vRing = smoothstep(5.0 * uPxScale, 16.0 * uPxScale, coc) * ringiness * uRingAmount;
    // ring dots: small hollow "lens" particles even when in focus
    if (kind > 3.5) vRing = max(vRing, 0.8);
    vKind = kind;
  }
`;

export const pointFragment = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  varying float vRing;
  varying float vKind;
  varying float vSharp;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c) * 2.0;
    if (d > 1.0) discard;
    float shape;
    if (vKind > 2.5 && vKind < 3.5) {
      // soft out-of-focus blob
      shape = pow(1.0 - d, 1.6) * 0.9;
    } else if (vKind > 1.5 && vKind < 2.5) {
      // plexus node marker: thin ring + bright centre dot
      float ring = smoothstep(0.58, 0.68, d) * (1.0 - smoothstep(0.76, 0.86, d));
      float dot = exp(-d * d * 60.0);
      float halo = exp(-d * d * 6.0) * 0.12;
      shape = mix(halo + dot * 0.6, ring * 0.8 + dot * 1.2 + halo, vSharp);
    } else {
      float core = exp(-d * d * 5.5) + 0.18 * exp(-d * d * 1.6);
      float rim = smoothstep(0.62, 0.86, d) * (1.0 - smoothstep(0.9, 1.0, d));
      float fill = 0.22 * (1.0 - smoothstep(0.85, 1.0, d));
      shape = mix(core, rim * 1.15 + fill, vRing);
    }
    gl_FragColor = vec4(vColor * vAlpha * shape, 1.0);
  }
`;

// Instanced screen-space quads: anti-aliased lines of any pixel width.
export const lineVertex = /* glsl */ `
  attribute vec2 corner;     // x: 0 start / 1 end, y: -1 / +1 side
  attribute vec3 iStart;
  attribute vec3 iEnd;
  attribute vec4 iColor;     // rgb + alpha

  uniform vec2 uResolution;
  uniform float uWidth;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uPxScale;
  uniform float uMaxCoc;
  uniform float uGain;
  uniform float uNearFade;
  uniform vec2 uFog;

  varying vec4 vColor;
  varying float vPx;
  varying float vHalf;

  void main() {
    vec4 mvA = modelViewMatrix * vec4(iStart, 1.0);
    vec4 mvB = modelViewMatrix * vec4(iEnd, 1.0);
    float dA = -mvA.z;
    float dB = -mvB.z;
    if (min(dA, dB) < 0.08) {
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      vColor = vec4(0.0);
      return;
    }
    vec4 a = projectionMatrix * mvA;
    vec4 b = projectionMatrix * mvB;
    vec2 sa = a.xy / a.w * uResolution * 0.5;
    vec2 sb = b.xy / b.w * uResolution * 0.5;
    vec2 dir = sb - sa;
    float len = length(dir);
    dir = len > 1e-4 ? dir / len : vec2(1.0, 0.0);
    vec2 n = vec2(-dir.y, dir.x);

    float depth = mix(dA, dB, corner.x);
    float coc = min(uAperture * abs(depth - uFocus) / depth * uPxScale, uMaxCoc * uPxScale);
    float w = uWidth * uPxScale + coc * 0.3;
    float halfW = w * 0.5;
    float ext = halfW + 1.0;

    vec4 p = corner.x < 0.5 ? a : b;
    p.xy += n * corner.y * ext / (uResolution * 0.5) * p.w;
    gl_Position = p;

    float near = smoothstep(0.15, uNearFade, depth) * exp(-max(depth - uFog.x, 0.0) * uFog.y);
    vColor = vec4(iColor.rgb, iColor.a * (uWidth * uPxScale / w) * uGain * near);
    vPx = corner.y * ext;
    vHalf = halfW;
  }
`;

export const lineFragment = /* glsl */ `
  varying vec4 vColor;
  varying float vPx;
  varying float vHalf;
  void main() {
    float a = clamp(vHalf + 0.5 - abs(vPx), 0.0, 1.0);
    // Thin lines (< 1px) keep their energy by fading instead of vanishing.
    a *= min(1.0, vHalf * 2.0 + 0.35);
    gl_FragColor = vec4(vColor.rgb * vColor.a * a, 1.0);
  }
`;

// Faint plexus facets (filled triangles), faded by depth of field.
export const facetVertex = /* glsl */ `
  attribute vec4 rgba;
  uniform float uFocus;
  uniform float uAperture;
  uniform float uGain;
  varying vec4 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = max(-mv.z, 0.05);
    float coc = uAperture * abs(depth - uFocus) / depth;
    gl_Position = projectionMatrix * mv;
    vColor = vec4(rgba.rgb, rgba.a * uGain / (1.0 + coc * 0.25));
  }
`;

export const facetFragment = /* glsl */ `
  varying vec4 vColor;
  void main() { gl_FragColor = vec4(vColor.rgb * vColor.a, 1.0); }
`;

// Full-screen background: two-tone radial gradient, vignette, dither.
export const bgVertex = /* glsl */ `
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

export const bgFragment = /* glsl */ `
  uniform vec3 uDark;
  uniform vec3 uMid;
  uniform vec3 uLight;
  uniform vec2 uCenter;
  uniform vec2 uRadius;
  uniform float uVignette;
  uniform float uAspect;
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    vec2 q = vUv - uCenter;
    q.x *= uAspect;
    float r = length(q / uRadius);
    float g = exp(-r * r * 1.4);
    vec3 col = mix(uDark, uMid, smoothstep(0.0, 1.0, exp(-r * r * 0.45)));
    col = mix(col, uLight, g);
    vec2 v = vUv - 0.5;
    v.x *= uAspect * 0.8;
    float vig = 1.0 - uVignette * smoothstep(0.25, 0.95, length(v));
    col *= vig;
    // Triangular dither: kills banding in the 8-bit H.264 encode.
    float n = hash(gl_FragCoord.xy + fract(uTime) * 91.7) + hash(gl_FragCoord.yx * 1.31 + 7.0) - 1.0;
    col += n / 255.0;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Soft volumetric glow sprite (world-space billboard).
export const glowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const glowFragment = /* glsl */ `
  uniform vec3 uColor;
  uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float g = exp(-d * d * 3.2) * (1.0 - smoothstep(0.85, 1.0, d));
    // dither so stacked soft glows don't band in 8-bit output
    float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
    gl_FragColor = vec4(max(uColor * g * uIntensity + n / 255.0 * step(0.002, g), 0.0), 1.0);
  }
`;

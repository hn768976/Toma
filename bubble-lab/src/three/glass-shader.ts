/**
 * Screen-space refractive glass used for every bubble in every composition.
 *
 * Rather than three's built-in `transmission` (which renders a single shared
 * transmission target and therefore cannot show one transmissive object
 * through another) each bubble samples an explicitly supplied backdrop
 * texture. The scene is drawn in depth-sorted layers and each layer's
 * backdrop is the composited layer behind it, so bubbles refract each other
 * the way they do in the reference footage.
 */

export const glassVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWobble;
  uniform float uSeed;

  varying vec3 vViewPos;
  varying vec3 vViewNormal;
  varying vec3 vObjPos;

  // Cheap value noise, enough to break the silhouette off a perfect sphere.
  float hash31(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i + vec3(0, 0, 0)), hash31(i + vec3(1, 0, 0)), f.x),
          mix(hash31(i + vec3(0, 1, 0)), hash31(i + vec3(1, 1, 0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0, 0, 1)), hash31(i + vec3(1, 0, 1)), f.x),
          mix(hash31(i + vec3(0, 1, 1)), hash31(i + vec3(1, 1, 1)), f.x), f.y),
      f.z);
  }

  void main() {
    vObjPos = position;

    // Surface-tension wobble: low-frequency, slow, and scaled by uWobble so a
    // taut water bead and a slack gel blob use the same code path.
    vec3 np = position * 1.6 + vec3(uSeed * 13.7) + uTime * 0.35;
    float n = vnoise(np);
    vec3 displaced = position * (1.0 + (n - 0.5) * uWobble);

    // Perturb the normal by the tangential part of the noise gradient. Central
    // differences keep this continuous across the surface; reconstructing the
    // normal from finite-difference cross products instead produces visible
    // faceting wherever the two sample tangents flip orientation.
    float e = 0.12;
    vec3 grad = vec3(
      vnoise(np + vec3(e, 0.0, 0.0)) - vnoise(np - vec3(e, 0.0, 0.0)),
      vnoise(np + vec3(0.0, e, 0.0)) - vnoise(np - vec3(0.0, e, 0.0)),
      vnoise(np + vec3(0.0, 0.0, e)) - vnoise(np - vec3(0.0, 0.0, e))
    ) / (2.0 * e);
    vec3 tangential = grad - normal * dot(grad, normal);
    vec3 shaped = normalize(normal - tangential * uWobble * 0.6);

    vec4 viewPos = modelViewMatrix * vec4(displaced, 1.0);
    vViewPos = viewPos.xyz;
    vViewNormal = normalize(normalMatrix * shaped);

    gl_Position = projectionMatrix * viewPos;
  }
`;

export const glassFragmentShader = /* glsl */ `
  precision highp float;

  uniform sampler2D uBackdrop;
  uniform vec2  uResolution;
  uniform vec3  uTint;
  uniform vec3  uRimColor;
  uniform vec3  uSpecColor;
  uniform vec3  uLightA;
  uniform vec3  uLightB;
  uniform float uIor;
  uniform float uRefract;
  uniform float uAbsorb;
  uniform float uFresnelPower;
  uniform float uFresnelStrength;
  uniform float uDispersion;
  uniform float uSpecPower;
  uniform float uSpecStrength;
  uniform float uInnerAmount;
  uniform float uInnerScale;
  uniform float uInnerDensity;
  uniform float uIridescence;
  uniform float uOpacity;
  uniform float uSeed;
  uniform float uShellGap;
  uniform float uEdgeDark;
  uniform float uSpecAniso;
  uniform float uRimWidth;

  varying vec3 vViewPos;
  varying vec3 vViewNormal;
  varying vec3 vObjPos;

  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    return fract(p * (p + p));
  }

  vec3 hash33(vec3 p) {
    p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
             dot(p, vec3(269.5, 183.3, 246.1)),
             dot(p, vec3(113.5, 271.9, 124.6)));
    return fract(sin(p) * 43758.5453123);
  }

  /**
   * Micro-bubbles trapped inside the gel. A sparse 3D point lattice is jittered
   * per cell and each occupied cell contributes one shaded sphere, which is
   * what gives the reference clips their "serum" reading rather than plain glass.
   */
  vec2 innerBubbles(vec3 p) {
    vec3 gp = p * uInnerScale + uSeed * 4.13;
    vec3 base = floor(gp);
    vec3 f = gp - base;
    float body = 0.0;
    float ring = 0.0;
    for (int x = -1; x <= 0; x++) {
      for (int y = -1; y <= 0; y++) {
        for (int z = -1; z <= 0; z++) {
          vec3 o = vec3(float(x), float(y), float(z));
          vec3 cell = base + o;
          vec3 h = hash33(cell);
          if (h.x > uInnerDensity) continue;
          vec3 jitter = hash33(cell + 19.1);
          float rad = 0.10 + 0.24 * h.y;
          float d = length(f - o - jitter);
          body += smoothstep(rad, rad * 0.25, d);
          ring += smoothstep(rad, rad * 0.78, d) - smoothstep(rad * 0.78, rad * 0.5, d);
        }
      }
    }
    return vec2(clamp(body, 0.0, 1.0), clamp(ring, 0.0, 1.0));
  }

  /** Thin-film interference approximated as a hue sweep over the fresnel term. */
  vec3 iridescent(float t) {
    return 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + t));
  }

  void main() {
    vec3 N = normalize(vViewNormal);
    vec3 V = normalize(-vViewPos);
    float ndv = max(dot(N, V), 0.0);

    float fres = pow(1.0 - ndv, uFresnelPower);

    // Thickness along the view ray. Grazing angles travel further through the
    // shell, which drives both absorption and how far the backdrop is bent.
    float thickness = 1.0 - ndv * 0.72;

    vec3 R = refract(-V, N, 1.0 / uIor);
    vec2 uv = gl_FragCoord.xy / uResolution;
    vec2 offset = R.xy * uRefract * thickness;

    // Chromatic dispersion: each channel takes a slightly different path.
    // Clamped, because a grazing ray can bend the sample point off-screen and
    // edge-clamped texels smear into long streaks across the silhouette.
    vec3 refracted;
    refracted.r = texture2D(uBackdrop, clamp(uv + offset * (1.0 + uDispersion), 0.002, 0.998)).r;
    refracted.g = texture2D(uBackdrop, clamp(uv + offset, 0.002, 0.998)).g;
    refracted.b = texture2D(uBackdrop, clamp(uv + offset * (1.0 - uDispersion), 0.002, 0.998)).b;

    // Beer-Lambert absorption gives colour that deepens with path length
    // instead of a flat multiply, so edges read denser than centres.
    vec3 absorbed = refracted * exp(-(1.0 - uTint) * uAbsorb * thickness);

    vec2 inner = innerBubbles(vObjPos);
    absorbed += inner.x * uInnerAmount;
    absorbed -= inner.y * uInnerAmount * 0.55;

    // Two-light studio rig. The key uses an anisotropic falloff so its
    // catchlight is an elongated streak rather than a round dot — that shape is
    // the single strongest cue that a surface is wet glass and not plastic.
    vec3 Rv = reflect(-V, N);
    vec3 La = normalize(uLightA);
    vec3 Lb = normalize(uLightB);

    vec3 da = Rv - La;
    float aniso = da.x * da.x * uSpecAniso + da.y * da.y / uSpecAniso + da.z * da.z;
    float specA = exp(-aniso * uSpecPower);

    float specB = pow(max(dot(Rv, Lb), 0.0), uSpecPower * 0.6);

    // The far inner wall throws a second, dimmer highlight back at the camera.
    vec3 Rb = reflect(-V, -N);
    float specInner = pow(max(dot(Rb, La), 0.0), uSpecPower * 0.35) * 0.35;

    vec3 spec = uSpecColor * (specA * uSpecStrength
                            + specB * uSpecStrength * 0.4
                            + specInner * uSpecStrength);

    float r = 1.0 - ndv;  // 0 at the centre of the silhouette, 1 at its edge

    // Inner shell: the second meniscus visible inside a real bubble wall.
    float shell = smoothstep(uShellGap, uShellGap - 0.06, r);
    absorbed *= mix(1.0, 0.93, shell);

    vec3 color = absorbed;

    // A thin dark contour set just inside the silhouette, then a bright
    // fresnel rim outboard of it. Glass reads as glass because of this
    // dark-then-bright pair; a uniformly darkened edge reads as matte.
    float contour = smoothstep(uRimWidth - 0.26, uRimWidth, r)
                  * (1.0 - smoothstep(uRimWidth, uRimWidth + 0.12, r));
    color *= 1.0 - contour * uEdgeDark;

    float rim = pow(clamp((r - uRimWidth) / max(1.0 - uRimWidth, 0.001), 0.0, 1.0), 0.85);
    color = mix(color, uRimColor, rim * uFresnelStrength);

    color += spec;
    color += iridescent(fres * 1.8 + uSeed) * uIridescence * fres;

    float alpha = clamp(uOpacity + fres * (1.0 - uOpacity) * 1.15, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

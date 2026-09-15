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
  varying vec3 vViewPos;
  varying vec3 vViewNormal;
  varying vec3 vObjPos;

  void main() {
    // No surface displacement. Serum bubbles read as perfect spheres, and any
    // noise on the silhouette immediately reads as a blob instead, so the
    // geometry is left exactly as authored and only scale varies per bubble.
    vObjPos = position;

    vec4 viewPos = modelViewMatrix * vec4(position, 1.0);
    vViewPos = viewPos.xyz;
    vViewNormal = normalize(normalMatrix * normal);

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
  uniform float uSheen;

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
  /** One lattice shell: the trapped bubbles this sample point passes through. */
  vec2 innerShell(vec3 p) {
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
          float rad = 0.08 + 0.20 * h.y;
          float d = length(f - o - jitter);
          // Soft-shouldered disc with a gentle darker ring just inside its
          // edge, so each trapped bubble reads as a little sphere.
          body += smoothstep(rad, rad * 0.15, d);
          ring += smoothstep(rad * 1.05, rad * 0.82, d)
                - smoothstep(rad * 0.82, rad * 0.55, d);
        }
      }
    }
    return vec2(body, ring);
  }

  /**
   * Micro-bubbles suspended inside the gel. Sampling the lattice once, at the
   * surface point, only ever decorates the shell — the droplets cluster toward
   * the silhouette and the interior stays empty. Three concentric shells stand
   * in for a volume: each is dimmer than the one outside it, as if seen
   * through more medium, which is what gives the read of depth.
   */
  vec2 innerBubbles(vec3 p) {
    vec2 acc = innerShell(p)
             + innerShell(p * 0.72) * 0.78
             + innerShell(p * 0.45) * 0.52;
    return vec2(clamp(acc.x, 0.0, 1.0), clamp(acc.y, 0.0, 1.0));
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
    float specInner = pow(max(dot(Rb, La), 0.0), uSpecPower * 0.35) * 0.22;

    vec3 spec = uSpecColor * (specA * uSpecStrength
                            + specB * uSpecStrength * 0.20
                            + specInner * uSpecStrength * 0.45);

    float r = 1.0 - ndv;  // 0 at the centre of the silhouette, 1 at its edge

    // Inner shell: the second meniscus visible inside a real bubble wall.
    float shell = smoothstep(uShellGap, uShellGap - 0.06, r);
    absorbed *= mix(1.0, 0.93, shell);

    vec3 color = absorbed;

    // A broad, very soft wrap of light across the lit hemisphere. This is what
    // makes the surface read as soft gel rather than hard glass — without it
    // the only tonal variation is at the silhouette and the interior goes flat.
    float wrap = pow(clamp(dot(N, La) * 0.5 + 0.5, 0.0, 1.0), 1.6);
    color += uSpecColor * wrap * uSheen;

    // A soft density band inside the silhouette, then a gentle fresnel rim
    // outboard of it. Both are deliberately wide and low-contrast: a narrow,
    // hard contour reads as a drawn outline, not as thickness.
    float contour = smoothstep(uRimWidth - 0.44, uRimWidth + 0.04, r)
                  * (1.0 - smoothstep(uRimWidth + 0.04, uRimWidth + 0.30, r));
    color *= 1.0 - contour * uEdgeDark;

    float rim = pow(clamp((r - uRimWidth) / max(1.0 - uRimWidth, 0.001), 0.0, 1.0), 1.35);
    color = mix(color, uRimColor, rim * uFresnelStrength);

    color += spec;
    color += iridescent(fres * 1.8 + uSeed) * uIridescence * fres;

    float alpha = clamp(uOpacity + fres * (1.0 - uOpacity) * 1.15, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

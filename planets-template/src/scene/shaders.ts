// GLSL (WebGL2 / GLSL ES 3.00 via three.js ShaderMaterial).
//
// All lighting is done in the body's object space: the JS side passes the
// sun direction and camera position already transformed into it, so the
// spin, tilt and camera motion all come from uniforms computed from the
// current frame only.

const common = /* glsl */ `
  const float PI = 3.141592653589793;
  uniform float uFlat;        // 1 - flattening (polar / equatorial radius)
  uniform vec3 uLight;        // unit vector toward the sun, object space
  uniform vec3 uCam;          // camera position, object space
  uniform sampler2D uRingTex; // RGBA radial ring profile
  uniform vec2 uRingRange;    // inner, outer radius (planet radii)
  uniform float uHasRings;
  uniform vec3 uSunColor;     // sunlight colour

  // Ellipsoid -> unit sphere.
  vec3 toUnit(vec3 q) { return vec3(q.x, q.y / uFlat, q.z); }

  // Fraction of sunlight reaching object-space point q (on or above the
  // surface) through the rings.
  float ringTransmit(vec3 q) {
    if (uHasRings < 0.5 || abs(uLight.y) < 1e-4) return 1.0;
    float t = -q.y / uLight.y;
    if (t <= 0.0) return 1.0;
    vec3 h = q + t * uLight;
    float r = length(h.xz);
    float u = (r - uRingRange.x) / (uRingRange.y - uRingRange.x);
    if (u <= 0.0 || u >= 1.0) return 1.0;
    float a = texture(uRingTex, vec2(u, 0.5)).a;
    return 1.0 - 0.92 * a;
  }
`;

export const planetVert = /* glsl */ `
  out vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const planetFrag = /* glsl */ `
  precision highp float;
  ${common}
  uniform sampler2D uColor;
  uniform sampler2D uNormal;
  uniform float uNormalStrength;
  uniform float uWrap;
  uniform float uSaturation;
  uniform float uLimb;        // limb darkening amount
  uniform float uSun;         // sun intensity (exposure)
  uniform vec3 uAtmColor;
  uniform float uAtmStrength;
  in vec3 vPos;
  out vec4 fragColor;

  void main() {
    vec3 p = normalize(toUnit(vPos));               // unit-sphere point
    vec3 nGeo = normalize(vec3(p.x, p.y / uFlat, p.z)); // ellipsoid normal
    // Equirectangular lookup, left edge = -180 deg, top = north.
    float lon = atan(-p.z, p.x);
    float lat = asin(clamp(p.y, -1.0, 1.0));
    vec2 uv = vec2(lon / (2.0 * PI) + 0.5, lat / PI + 0.5);
    // Seam-safe gradients: take the smaller derivative of u and of u
    // shifted by half a turn, so the +-180 seam never picks a tiny mip.
    float u2 = fract(uv.x + 0.5);
    vec2 dx = vec2(dFdx(uv.x), dFdx(uv.y));
    vec2 dy = vec2(dFdy(uv.x), dFdy(uv.y));
    float dx2 = dFdx(u2), dy2 = dFdy(u2);
    if (abs(dx2) < abs(dx.x)) dx.x = dx2;
    if (abs(dy2) < abs(dy.x)) dy.x = dy2;
    vec3 albedo = textureGrad(uColor, uv, dx, dy).rgb;
    vec3 nm = textureGrad(uNormal, uv, dx, dy).rgb;
    float l = dot(albedo, vec3(0.2126, 0.7152, 0.0722));
    albedo = max(vec3(0.0), mix(vec3(l), albedo, uSaturation));

    // Tangent frame on the ellipsoid: east, north, up.
    vec3 east = normalize(cross(vec3(0.0, 1.0, 0.0), nGeo) + vec3(1e-6, 0.0, 0.0));
    vec3 north = cross(nGeo, east);
    vec3 tn = vec3((nm.xy * 2.0 - 1.0) * uNormalStrength, max(nm.z, 0.05));
    vec3 n = normalize(east * tn.x + north * tn.y + nGeo * tn.z);

    vec3 V = normalize(uCam - vPos);
    float geo = dot(nGeo, uLight);
    float d = dot(n, uLight);
    // Wrap diffuse: a soft terminator whose width is set per body.
    float diff = clamp((d + uWrap) / (1.0 + uWrap), 0.0, 1.0);
    // Keep normal-mapped relief from lighting the far side of the terminator.
    diff *= smoothstep(-uWrap - 0.03, 0.04, geo);
    float mu = clamp(dot(nGeo, V), 0.0, 1.0);
    float limb = mix(1.0, pow(mu, 0.35), uLimb);
    float shadow = ringTransmit(vPos);
    vec3 col = albedo * diff * limb * shadow * uSun * uSunColor;

    // Atmospheric in-scatter on the disc toward the limb (lit side only).
    float rim = pow(1.0 - mu, 3.0);
    float lit = smoothstep(-0.25, 0.35, geo);
    col += uAtmColor * uAtmStrength * rim * lit * 0.35 * uSun * shadow;
    fragColor = vec4(col, 1.0);
  }
`;

// Atmosphere shell: drawn additively on a slightly larger ellipsoid. For
// each pixel the view ray's closest approach to the body gives an optical
// depth; lighting comes from the sun direction at that closest point, with
// a forward-scattering boost when looking toward the sun (crescent shots).
export const atmVert = planetVert;
export const atmFrag = /* glsl */ `
  precision highp float;
  ${common}
  uniform vec3 uAtmColor;
  uniform float uAtmStrength;
  uniform float uAtmThickness;
  uniform float uForward;
  uniform float uSun;
  in vec3 vPos;
  out vec4 fragColor;

  void main() {
    vec3 o = toUnit(uCam);
    vec3 dir = normalize(toUnit(vPos) - o);
    float tc = -dot(o, dir);
    vec3 c = o + tc * dir;
    float b = length(c);
    float H = uAtmThickness;
    float dens;
    if (b >= 1.0) {
      dens = exp(-(b - 1.0) / H);
    } else {
      // In front of the disc: a thin haze that thickens toward the limb.
      dens = 0.55 * exp(-(1.0 - b) / (H * 2.5));
    }
    vec3 nc = normalize(c);
    float cosL = dot(nc, uLight);
    float illum = smoothstep(-0.28, 0.30, cosL);
    // Forward scattering (sun behind the body): Henyey-Greenstein-like.
    float g = 0.75;
    float cosT = dot(dir, uLight);
    float hg = (1.0 - g * g) / pow(1.0 + g * g - 2.0 * g * cosT, 1.5) / 12.0;
    float scatter = 1.0 + uForward * hg * smoothstep(-0.6, 0.05, cosL);
    // Light passing through the rings' shadow is dimmed too.
    float sh = ringTransmit(c * vec3(1.0, uFlat, 1.0));
    vec3 col = uAtmColor * uAtmStrength * dens * illum * scatter * sh * uSun;
    fragColor = vec4(col, 1.0);
  }
`;

export const ringVert = /* glsl */ `
  out vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const ringFrag = /* glsl */ `
  precision highp float;
  ${common}
  uniform float uSun;
  in vec3 vPos;
  out vec4 fragColor;

  // Is object-space point q in the planet's shadow? (soft edge)
  float planetShadow(vec3 q) {
    vec3 o = toUnit(q);
    vec3 L = normalize(toUnit(uLight));
    float t = -dot(o, L);
    if (t < 0.0) return 1.0;
    float dist = length(o + t * L);
    return smoothstep(0.985, 1.015, dist);
  }

  void main() {
    float r = length(vPos.xz);
    float u = (r - uRingRange.x) / (uRingRange.y - uRingRange.x);
    if (u <= 0.0 || u >= 1.0) discard;
    // Filter the radial profile over ~1.5x the pixel footprint (isotropic,
    // trilinear) so narrow ringlets fade smoothly instead of aliasing.
    float du = fwidth(u) * 1.5;
    vec4 ring = textureGrad(uRingTex, vec2(u, 0.5), vec2(du, 0.0), vec2(0.0, du));
    float a = ring.a;
    vec3 V = normalize(uCam - vPos);
    float sideL = sign(uLight.y);
    float sideV = sign(V.y);
    float sun = planetShadow(vPos);
    float muL = abs(uLight.y);
    vec3 col;
    if (sideL == sideV) {
      // Lit face: optically thick parts scatter like a rough surface.
      col = ring.rgb * (0.55 + 0.45 * sqrt(muL)) * 1.05;
    } else {
      // Unlit face: only light diffusing through the ring gets out, so the
      // dense B ring goes dark and the sparse C ring / Cassini Division glow.
      float cosT = dot(-V, uLight);
      float fwd = 1.0 + 3.0 * pow(max(cosT, 0.0), 6.0);
      col = ring.rgb * (1.0 - a) * 1.6 * fwd * (0.35 + 0.65 * sqrt(muL));
    }
    col *= sun * uSun * uSunColor;
    // Premultiplied alpha.
    fragColor = vec4(col * a, a);
  }
`;

export const starVert = /* glsl */ `
  in float aSize;     // gaussian sigma in 2160p pixels
  in float aBright;
  in vec3 aTint;
  uniform float uPxScale;    // output height / 2160
  uniform float uStarGain;
  out float vBright;
  out vec3 vTint;
  out float vSigma;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float s = aSize * uPxScale;
    // Energy-preserving clamp: a star never becomes smaller than ~0.65 px,
    // it just gets dimmer, so stars look the same at 720p and 4K.
    float sc = max(s, 0.65);
    vBright = aBright * uStarGain * (s * s) / (sc * sc);
    vSigma = sc;
    vTint = aTint;
    gl_PointSize = ceil(sc * 6.0) + 2.0;
  }
`;

export const starFrag = /* glsl */ `
  precision highp float;
  in float vBright;
  in vec3 vTint;
  in float vSigma;
  out vec4 fragColor;
  void main() {
    vec2 d = (gl_PointCoord - 0.5) * (ceil(vSigma * 6.0) + 2.0);
    float g = exp(-dot(d, d) / (2.0 * vSigma * vSigma));
    fragColor = vec4(vTint * vBright * g, 1.0);
  }
`;

// ---------------------------------------------------------------- post
export const fsVert = /* glsl */ `
  out vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// 13-tap downsample (with a soft threshold on the first pass).
export const downFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2 uTexel;
  uniform float uThreshold;
  uniform float uFirst;
  in vec2 vUv;
  out vec4 fragColor;
  vec3 s(vec2 o) { return texture(uTex, vUv + o * uTexel).rgb; }
  void main() {
    vec3 a = s(vec2(-2, 2)), b = s(vec2(0, 2)), c = s(vec2(2, 2));
    vec3 d = s(vec2(-2, 0)), e = s(vec2(0, 0)), f = s(vec2(2, 0));
    vec3 g = s(vec2(-2, -2)), h = s(vec2(0, -2)), i = s(vec2(2, -2));
    vec3 j = s(vec2(-1, 1)), k = s(vec2(1, 1)), l = s(vec2(-1, -1)), m = s(vec2(1, -1));
    vec3 col = e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
    if (uFirst > 0.5) {
      float br = max(col.r, max(col.g, col.b));
      float soft = clamp(br - uThreshold * 0.5, 0.0, uThreshold);
      soft = soft * soft / (2.0 * uThreshold + 1e-4);
      float w = max(soft, br - uThreshold) / max(br, 1e-4);
      col *= w;
    }
    fragColor = vec4(col, 1.0);
  }
`;

// 3x3 tent upsample, added onto the next finer level.
export const upFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uTex;
  uniform vec2 uTexel;
  in vec2 vUv;
  out vec4 fragColor;
  vec3 s(vec2 o) { return texture(uTex, vUv + o * uTexel).rgb; }
  void main() {
    vec3 col = s(vec2(0, 0)) * 4.0
      + (s(vec2(-1, 0)) + s(vec2(1, 0)) + s(vec2(0, -1)) + s(vec2(0, 1))) * 2.0
      + s(vec2(-1, -1)) + s(vec2(1, -1)) + s(vec2(-1, 1)) + s(vec2(1, 1));
    fragColor = vec4(col / 16.0, 1.0);
  }
`;

// Final: bloom mix, filmic tone map, sRGB encode, then grain (faded out in
// the blacks) and +-1/255 dither. Grain and dither are a fixed hash of the
// pixel position and the loop-wrapped frame number.
export const finalFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uScene;
  uniform sampler2D uBloom;
  uniform float uBloomStrength;
  uniform float uExposure;
  uniform float uGrain;
  uniform float uFrame;
  in vec2 vUv;
  out vec4 fragColor;

  uint pcg(uint v) {
    uint state = v * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
  }
  float hash(uvec2 p, uint f, uint salt) {
    return float(pcg(p.x + pcg(p.y + pcg(f * 7919u + salt)))) / 4294967295.0;
  }
  // Filmic curve (ACES fit, Narkowicz 2015).
  vec3 aces(vec3 x) {
    return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
  }
  vec3 toSRGB(vec3 c) {
    return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
  }
  void main() {
    vec3 hdr = texture(uScene, vUv).rgb;
    vec3 bloom = texture(uBloom, vUv).rgb;
    hdr += bloom * uBloomStrength;
    vec3 c = toSRGB(aces(hdr * uExposure));
    uvec2 px = uvec2(gl_FragCoord.xy);
    uint f = uint(uFrame);
    float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
    // Grain: zero below ~3% luminance so space stays clean black.
    float gmask = smoothstep(0.03, 0.09, lum);
    float g = (hash(px, f, 17u) + hash(px, f, 101u) - 1.0);
    c += g * uGrain * gmask;
    // Triangular dither of +-1/255.
    float dth = (hash(px, f, 59u) - hash(px, f, 211u)) / 255.0;
    c += dth;
    fragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
  }
`;

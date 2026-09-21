/**
 * Blade shaders.
 *
 * Vertex: places one instance of the unit blade. Twist is a rotation about the
 * blade's own vertical axis whose angle varies with height and with a wave
 * travelling horizontally through the row; bow is a static horizontal
 * displacement that peaks at mid-height. Both are recomputed every frame from
 * `uTime` alone - nothing is advanced from the previous frame.
 *
 * Fragment: the blade material is a neutral near-white gloss. All colour comes
 * from the environment gradient, looked up along the reflection vector. Because
 * the cross-section is an arc, the reflection vector swings across the blade's
 * width and the gradient spreads across it - which is why colour shifts within
 * a single blade and why bands sweep smoothly across dozens of blades at once.
 */

export const bladeVertexShader = /* glsl */ `
attribute float aXn;
attribute float aX;
attribute float aW;

uniform float uTime;        // loop position, 0..1
uniform float uHeight;
uniform float uTwistAmp;    // radians
uniform float uTwistC;
uniform float uTwistK;
uniform float uTwistF;
uniform float uTwistW;
uniform float uBowAmp;
uniform float uBowWidth;
uniform float uBowCount;    // 0 = spans the whole array
uniform float uBowC0;
uniform float uBowC1;

uniform float uWallRadius;

varying vec3 vWorld;
varying vec3 vNormal;
varying float vPosAzim;

const float TAU = 6.2831853;
const float PI = 3.1415927;
const float INV_TAU = 0.15915494;

float bowFalloff(float xn) {
  if (uBowCount < 0.5) {
    // Spans the whole array, tapering to nothing at the two ends.
    return sin(PI * clamp(xn, 0.0, 1.0));
  }
  float d0 = (xn - uBowC0) / uBowWidth;
  float f = exp(-d0 * d0);
  if (uBowCount > 1.5) {
    float d1 = (xn - uBowC1) / uBowWidth;
    f += exp(-d1 * d1);
  }
  return clamp(f, 0.0, 1.0);
}

void main() {
  float y01 = position.y + 0.5;

  // theta(y, x, t) = A * sin( 2pi(f*t - k*x) + c*y ), plus an optional warp of
  // the wave phase that bends the crossing line into an S instead of a straight
  // diagonal. W = 0 gives the plain form.
  float P = TAU * (uTwistF * uTime - uTwistK * aXn);
  float theta = uTwistAmp * sin(P + uTwistW * sin(P) + uTwistC * y01);
  float s = sin(theta);
  float c = cos(theta);

  vec3 p = vec3(position.x * aW, position.y * uHeight, position.z * aW);
  vec3 n = normal;

  vec3 rp = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c);
  vec3 rn = vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);

  float fall = bowFalloff(aXn);
  float bow = uBowAmp * sin(PI * y01) * fall;
  // The bow is a shear in x as a function of y, so it tilts the normal too.
  // That tilt is what makes a lit column read as a curved panel.
  float dBow = (uBowAmp * PI * cos(PI * y01) * fall) / uHeight;

  rp.x += aX + bow;
  rn = normalize(vec3(rn.x, rn.y - dBow * rn.x, rn.z));

  vec4 world = modelMatrix * vec4(rp, 1.0);
  vWorld = world.xyz;
  vNormal = normalize(mat3(modelMatrix) * rn);

  // Where this blade sits on the light cylinder, ignoring which way it faces.
  float px = clamp(world.x / uWallRadius, -0.999, 0.999);
  vPosAzim = atan(sqrt(max(1.0 - px * px, 0.0)), px) * INV_TAU;

  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const bladeFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uLut;
uniform float uLutMax;
uniform float uScroll;       // N * frame / LOOP_FRAMES; N integer, so it wraps exactly
uniform float uAzimZoom;
uniform float uParallax;
uniform float uWallRadius;
uniform vec3 uBaseColor;
uniform float uSpecGain;
uniform float uDiffGain;
uniform float uKeyInt;
uniform vec3 uKeyDir;
uniform float uAmbient;
uniform float uExposure;
uniform float uF0;
uniform float uElevLo;
uniform float uElevHi;
uniform float uElevTilt;
uniform float uElevFreq;
uniform float uElevSym;
uniform float uShadeMix;
uniform float uShadePow;
uniform float uFillSharp;
uniform float uBandHalf;
uniform float uBandSoft;
uniform float uBandAmp;
uniform float uBandFreq;
uniform float uBandZoom;
uniform float uBandElev;

uniform float uGrainFrame;

varying vec3 vWorld;
varying vec3 vNormal;
varying float vPosAzim;

const float INV_TAU = 0.15915494;
const float TAU = 6.2831853;

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

/**
 * Decode one row of the environment gradient. The table is stored gamma-encoded
 * and normalised by the gradient's peak, which keeps precision in the dark end -
 * look 3 is mostly dark ramp - for the cost of one multiply.
 */
vec3 lut(float u, float row) {
  vec3 c = texture2D(uLut, vec2(fract(u), row)).rgb;
  return c * c * uLutMax;
}

void main() {
  vec3 N = normalize(vNormal);
  vec3 V = normalize(cameraPosition - vWorld);
  if (dot(N, V) < 0.0) N = -N;
  float NdV = clamp(dot(N, V), 0.0, 1.0);
  vec3 R = reflect(-V, N);

  // Intersect the reflected ray with the light cylinder. The cylinder has a
  // finite radius on purpose: a distant environment gives the whole frame one
  // colour, a near one gives the parallax that lets the colour travel across
  // the array while each blade still shows its own slice of it.
  vec2 p = vec2(vWorld.x, vWorld.z);
  vec2 d = vec2(R.x, R.z);
  float dd = max(dot(d, d), 1e-6);
  float pd = dot(p, d);
  float disc = max(pd * pd - dd * (dot(p, p) - uWallRadius * uWallRadius), 0.0);
  float t = (-pd + sqrt(disc)) / dd;
  vec2 hit = p + t * d;
  float rayAzim = atan(hit.y, hit.x) * INV_TAU;
  float elev = (vWorld.y + t * R.y) / uWallRadius;

  // Blend the reflection's azimuth with the blade's own position on the
  // cylinder. uParallax = 1 is pure reflection - the whole gradient swings
  // across every blade; low values pin the large-scale structure to position so
  // lit zones read as columns spanning many blades. Never 0: colour has to vary
  // across the width of a single blade.
  float da = rayAzim - vPosAzim;
  da -= floor(da + 0.5);
  float u = (vPosAzim + uParallax * da) * uAzimZoom + uScroll;

  // Vertical shaping of the environment: a bright field that falls off with
  // height, its boundary undulating as the gradient scrolls. uElevSym folds it
  // about the centre line instead, for the hourglass - bright top and bottom,
  // dark waist - that the barrel compositions read as.
  float ref = uElevTilt * sin(TAU * uElevFreq * u);
  float e = mix(elev, abs(elev) - 0.28, uElevSym);
  float gain = mix(uElevLo, uElevHi, smoothstep(-1.0, 1.0, (e - ref) * 2.2));

  // 3C: confine the light to one horizontal band crossing as an S-curve.
  if (uBandHalf > 0.0) {
    float centre = uBandAmp * sin(TAU * uBandFreq * (u * uBandZoom));
    gain *= 1.0 - smoothstep(uBandHalf, uBandHalf + uBandSoft,
                             abs(elev * uBandElev - centre));
  }

  float k = 1.0 - NdV;
  float k2 = k * k;
  float refl = uF0 + (1.0 - uF0) * (k2 * k2 * k);

  // Directional shading across the blade's width. The environment supplies the
  // hue; this supplies the bright-core-to-dark-edge ramp that makes each blade
  // read as a separately lit object rather than one even corrugation.
  float nd = max(dot(N, uKeyDir), 0.0);
  float ndp = pow(nd, uShadePow);
  float shade = mix(1.0, ndp, uShadeMix);

  vec3 col = lut(u, 0.25) * (uSpecGain * refl * shade);
  col += lut(u, 0.75) * uBaseColor * uDiffGain;
  col *= gain;

  // Soft key highlight: the narrow specular line down each blade. x^256 by
  // repeated squaring, which is about a fifth of a blade's width. Tinted by the
  // environment rather than white - the references' hot cores are white-cyan
  // and white-amber, the gradient pushed to the top of the range, not a white
  // lamp laid over the colour.
  float h = max(dot(N, normalize(uKeyDir + V)), 0.0);
  h *= h; h *= h; h *= h; h *= h; h *= h; h *= h; h *= h; h *= h;
  col += lut(u, 0.25) * (uKeyInt * h * gain);

  // Fill. Keeps unlit blades physically present in the black regions: brighten
  // an extracted frame heavily and the ribbing is still there.
  //
  // What survives quantisation is contrast, not level - a uniform lift just
  // turns the black field grey and x264 flattens it anyway. uFillSharp tightens
  // the falloff across the blade so the fill is a comb rather than a plateau:
  // bright along the blade's lit face, zero at the seams. At 0 this is the
  // plain wrap term, which is all the looks that are lit edge to edge need.
  const vec3 fillDir = vec3(0.7191, 0.2197, 0.6592);
  float fillShape = mix(max(dot(N, fillDir), 0.0), ndp * ndp, uFillSharp);
  col += uAmbient * uBaseColor * (0.06 + 0.94 * fillShape);

  // Tonemap here rather than in a post pass: the composer's frame buffer is
  // 8-bit sRGB, which is far cheaper than half-float in software rasterisation
  // but would clip anything above 1.0 on the way in.
  vec3 tone = aces(col * uExposure);

  // Dither before that quantisation, not only after it. This batch is almost
  // entirely smooth gradient, and a dither applied downstream of an 8-bit
  // buffer cannot undo steps the buffer has already made. The sqrt converts a
  // +/- 1/255 step in display space into the equivalent linear amount.
  vec2 P = gl_FragCoord.xy;
  float n1 = hash13(vec3(P, uGrainFrame));
  float n2 = hash13(vec3(P + 11.7, uGrainFrame + 53.0));
  tone += ((n1 + n2 - 1.0) / 255.0) * 2.0 * sqrt(tone);

  gl_FragColor = vec4(max(tone, 0.0), 1.0);
}
`;

/**
 * Backdrop.
 *
 * A dim wall behind the array. Where the wave turns blades edge-on you see
 * through the row, and in the references that gap is a deep saturated navy, not
 * a hole - there is more wall behind the blades. Looks that want genuinely
 * black gaps set the gain to zero and skip it.
 */
export const backdropVertexShader = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const backdropFragmentShader = /* glsl */ `
precision highp float;

uniform sampler2D uLut;
uniform float uLutMax;
uniform float uScroll;
uniform float uAzimZoom;
uniform float uWallRadius;
uniform float uGain;
uniform float uExposure;
uniform float uElevLo;
uniform float uElevHi;
uniform float uElevSym;

varying vec3 vWorld;

const float INV_TAU = 0.15915494;

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  float px = clamp(vWorld.x / uWallRadius, -0.999, 0.999);
  float u = atan(sqrt(max(1.0 - px * px, 0.0)), px) * INV_TAU * uAzimZoom + uScroll;
  vec3 c = texture2D(uLut, vec2(fract(u), 0.75)).rgb;
  float elev = vWorld.y / uWallRadius;
  float e = mix(elev, abs(elev) - 0.28, uElevSym);
  float gain = mix(uElevLo, uElevHi, smoothstep(-1.0, 1.0, e * 2.2));
  gl_FragColor = vec4(aces(c * c * uLutMax * uGain * gain * uExposure), 1.0);
}
`;

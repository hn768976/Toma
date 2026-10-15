import { FINISH_GLSL } from '../lib/finish';

// Particle DNA vertex shader. Every particle's 3D position is a closed-form
// function of its fixed attributes and the frame-derived uniforms; it is
// projected here and expanded to a screen-space quad whose radius includes
// the depth-of-field circle of confusion.
//
// Helix (local space, axis +y):  p(s) = (R sin(a), s*rise, R cos(a)),
// a = twist*s + strand*groove. With x right, y up, z toward the viewer this
// is a RIGHT-HANDED helix. Strand 1 is offset by `groove` (< 180 deg), which
// makes one groove narrow (minor) and the other wide (major).
export const DNA_VERT = /* glsl */ `
in vec2 aPosition;
in vec4 aA;   // kind, s (steps) or base x, strand / rung u / base y, twinkle phase
in vec4 aB;   // jitter radial, axial, tangential (or base z for loose), world size
in vec4 aC;   // cloud offset xyz, brightness
in vec4 aD;   // twinkle freq (int), twinkle q (int), colour mix, drift freq (int)

uniform mat4 uModel;      // helix local -> view
uniform mat4 uView;       // world -> view (loose particles)
uniform vec3 uViewDirLocal; // direction toward the camera in helix-local space
uniform float uPhase;     // helix phase in base-pair steps (screw motion)
uniform float uLoopT;     // frame / 600 (whole cycles for loops)
uniform float uN;         // base pairs in the helix
uniform float uRise;
uniform float uRadius;
uniform float uTwist;
uniform float uGroove;
uniform float uFocalN;    // projection: normalised (frame-height) units per world unit at depth 1
uniform float uAspect;
uniform float uFocus;
uniform float uAperture;
uniform float uPx;        // one output pixel in frame-height units
uniform float uGain;
uniform vec3 uColA;
uniform vec3 uColB;
uniform vec3 uColRung;
uniform vec3 uColLoose;
// story (DNAForm): 0 = finished helix
uniform float uStory;
uniform float uTime;      // seconds
uniform vec3 uCloudShift; // sweep-in offset of the cloud (world units, helix-local)
uniform float uCloudAlpha;
uniform float uCloudSwirl;
uniform float uGatherStart;
uniform float uGatherDur;
uniform float uGatherStagger;
uniform float uLooseAlpha;

out vec2 vCorner;
out vec3 vColor;
out float vEdge;

const float TAU = 6.28318530718;

vec3 helixPoint(float s, float strand, float rScale) {
  float a = uTwist * s + strand * uGroove;
  return vec3(uRadius * rScale * sin(a), s * uRise, uRadius * rScale * cos(a));
}

float easeInOut(float x) {
  x = clamp(x, 0.0, 1.0);
  return x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
}

void main() {
  float kind = aA.x;
  vec3 viewPos;
  vec3 col;
  float bright = aC.w;
  float size = aB.w;

  // twinkle: whole cycles in 600 frames; varies along the helix through q*(s+phase)/N
  float sPos = aA.y + uPhase;
  float tw = 0.7 + 0.3 * cos(TAU * (aD.x * uLoopT + aA.w + aD.y * sPos / uN));

  if (kind < 1.5) {
    // helix particle: backbone (0) or rung (1)
    float s = mod(sPos, uN) - 0.5 * uN;
    vec3 p;
    vec3 radial;
    if (kind < 0.5) {
      float strand = aA.z;
      p = helixPoint(s, strand, 1.0);
      float a = uTwist * s + strand * uGroove;
      radial = vec3(sin(a), 0.0, cos(a));
      vec3 tang = vec3(cos(a), 0.0, -sin(a));
      p += radial * aB.x + vec3(0.0, aB.y, 0.0) + tang * aB.z;
      float along = clamp(s / (0.5 * uN) * 0.5 + 0.5, 0.0, 1.0);
      // colour shifts along the helix across the part that is on screen (violet at the top)
      col = mix(uColA, uColB, smoothstep(0.44, 0.6, along) * 0.9 + aD.z * 0.1);
      col = mix(col, uColB, strand * 0.55);
    } else {
      float u = aA.z;
      vec3 A = helixPoint(s, 0.0, 0.93);
      vec3 B = helixPoint(s, 1.0, 0.93);
      p = mix(A, B, u) + vec3(aB.x, aB.y, aB.z);
      radial = normalize(vec3(p.x, 0.0, p.z) + 1e-5);
      col = mix(uColRung, uColA, aD.z * 0.3);
    }
    // depth cue: the far side of the helix is dimmer than the near side
    float near = dot(normalize(vec3(p.x, 0.0, p.z) + 1e-5), normalize(vec3(uViewDirLocal.x, 0.0, uViewDirLocal.z)));
    bright *= mix(0.22, 1.0, 0.5 + 0.5 * near);
    // fade the far ends of the helix (off screen)
    bright *= 1.0 - smoothstep(0.36 * uN, 0.5 * uN, abs(s));

    if (uStory > 0.5) {
      // cloud -> helix gathering
      float u01 = clamp(s / uN + 0.5, 0.0, 1.0);
      float w = easeInOut((uTime - uGatherStart - uGatherStagger * u01) / uGatherDur);
      vec3 off = aC.xyz;
      float sw = uCloudSwirl * (1.0 - w) * (0.6 + 0.4 * fract(aA.w * 7.0));
      float cs = cos(sw), sn = sin(sw);
      off = vec3(cs * off.x + sn * off.z, off.y, -sn * off.x + cs * off.z);
      vec3 axisPt = vec3(0.0, s * uRise, 0.0);
      vec3 cloud = axisPt + off + uCloudShift * (0.75 + 0.5 * fract(aA.w * 13.0));
      p = mix(cloud, p, w);
      float a = mix(uCloudAlpha * 1.5, 1.0, w);
      bright *= a;
      size *= mix(0.8, 1.0, w);
    }
    viewPos = (uModel * vec4(p, 1.0)).xyz;
  } else {
    // loose particle drifting on a closed path (whole cycles per 600 frames)
    vec3 base = vec3(aA.y, aA.z, aB.z);
    float n = aD.w;
    vec3 drift = aC.xyz * vec3(
      sin(TAU * (n * uLoopT + aA.w)),
      sin(TAU * (n * uLoopT + aA.w * 1.7 + 0.25)),
      sin(TAU * (n * uLoopT + aA.w * 2.3 + 0.5)));
    viewPos = (uView * vec4(base + drift, 1.0)).xyz;
    col = mix(uColLoose, uColA, aD.z);
    bright *= uLooseAlpha;
  }

  float d = max(-viewPos.z, 0.05);
  vec2 ndc = vec2(viewPos.x * uFocalN * 2.0 / (d * uAspect), viewPos.y * uFocalN * 2.0 / d);
  // radii in frame-height units
  float rBase = size * uFocalN / d;
  float rCoc = uAperture * abs(d - uFocus) / d;
  float rMin = 0.85 * uPx;
  float r = sqrt(rBase * rBase + rCoc * rCoc + rMin * rMin);
  // energy conserving: intensity per area falls as the disc grows
  float energy = bright * tw * rBase * rBase / (r * r);
  // soft edge width relative to radius: about 1.2 output pixels
  float aa = clamp(1.2 * uPx / r, 0.04, 1.0);
  float a0 = 1.0 - aa;
  float integ = a0 * a0 + (2.0 / aa) * ((1.0 / 6.0) - (a0 * a0 * 0.5 - a0 * a0 * a0 / 3.0));
  vColor = col * energy * uGain / max(integ, 0.05);
  vEdge = aa;
  vCorner = aPosition;
  vec2 offs = aPosition * r * 2.0 * vec2(1.0 / uAspect, 1.0);
  // cull particles behind the camera
  float behind = step(viewPos.z, -0.05);
  gl_Position = vec4((ndc + offs) * behind + vec2(2.0) * (1.0 - behind), 0.0, 1.0);
}
`;

export const DNA_FRAG = /* glsl */ `
in vec2 vCorner;
in vec3 vColor;
in float vEdge;
out vec4 finalColor;
void main() {
  float rho = length(vCorner);
  float m = clamp((1.0 - rho) / vEdge, 0.0, 1.0);
  if (m <= 0.0) discard;
  finalColor = vec4(vColor * m, 0.0);
}
`;

// Final pass: background, faint vertical grid, particle light composited
// with an HDR "screen", then grain + dither.
export const DNA_FINAL_FRAG = /* glsl */ `
in vec2 vUV;
out vec4 finalColor;
uniform sampler2D uTexture;
uniform vec3 uBg;
uniform vec3 uBgRight;
uniform vec3 uBgGlow;
uniform vec2 uGlowPos;
uniform float uGridAlpha;
uniform float uGridPeriod; // in frame-width units
uniform vec2 uRes;
uniform float uFrameMod;
uniform float uExposure;
${FINISH_GLSL}
void main() {
  vec2 uv = vUV;
  float aspect = uRes.x / uRes.y;
  vec3 bg = mix(uBg, uBgRight, smoothstep(0.35, 1.0, uv.x));
  vec2 q = (uv - uGlowPos) * vec2(aspect, 1.0);
  bg += uBgGlow * exp(-dot(q, q) * 1.4);
  bg *= 1.0 - 0.08 * smoothstep(0.5, 1.4, length((uv - 0.5) * vec2(aspect, 1.0)));
  // faint fine grid of vertical lines
  float gx = uv.x / uGridPeriod;
  float lw = max(0.5 * uGridPeriod * uRes.x, 1.0);
  float line = 1.0 - smoothstep(0.0, 1.0 / lw, abs(fract(gx) - 0.5) * 2.0 - (1.0 - 1.0 / lw));
  line = smoothstep(1.0 - 1.2 / lw, 1.0, abs(fract(gx) - 0.5) * 2.0);
  bg *= 1.0 + uGridAlpha * line;
  vec3 acc = texture(uTexture, uv).rgb * uExposure;
  // hue-preserving soft clip: dense overlaps stay saturated instead of going white
  float m = max(acc.r, max(acc.g, acc.b));
  acc *= (1.0 - exp(-m)) / max(m, 1e-4);
  vec3 c = bg + (1.0 - bg) * acc;
  c = finishColor(c, gl_FragCoord.xy, uFrameMod, 0.015);
  finalColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

/**
 * Dendrite shading.
 *
 * The tubes themselves are mostly not emissive -- they carry a dim fresnel
 * rim, which is what gives the wet, translucent quality without paying for a
 * transmissive material. Everything that actually glows (pulses, junction
 * nodes, sparks) is additive on top, so a high bloom threshold picks out the
 * glow and leaves the network itself alone.
 *
 * A pulse is just a number: the vertex carries its normalised distance from
 * the soma, so the fragment shader compares that against a position derived
 * from the frame. No geometry moves and nothing is created or destroyed.
 */

export const TUBE_VERTEX = /* glsl */ `
attribute vec4 aMisc;      // x arc 0..1, y radius 0..1, z junction, w phase
attribute vec3 aPulseN;    // traversals over the loop, per pulse slot
attribute vec3 aPulseOff;  // phase offset, per pulse slot
attribute vec3 aPulseAmp;  // amplitude, per pulse slot (0 disables)

varying vec3 vNormalV;
varying vec3 vViewDir;
varying vec4 vMisc;
varying vec3 vPulseN;
varying vec3 vPulseOff;
varying vec3 vPulseAmp;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  vMisc = aMisc;
  vPulseN = aPulseN;
  vPulseOff = aPulseOff;
  vPulseAmp = aPulseAmp;
  gl_Position = projectionMatrix * mv;
}
`;

export const TUBE_FRAGMENT = /* glsl */ `
precision highp float;

uniform float uT;              // (frame % duration) / duration, 0..1
uniform vec3  uTube;
uniform vec3  uRim;
uniform vec3  uPulseColor;
uniform vec3  uNodeColor;
uniform float uAmbient;
uniform float uRimStrength;
uniform float uRimPower;
uniform float uSigma;
uniform float uHardness;
uniform float uJunctionFlare;
uniform float uNodeStrength;
uniform vec2  uNodeGate;
uniform float uFlashCycles;
uniform float uFlashStrength;
uniform float uCellPulse;      // 0..1, pure function of frame
uniform float uCellPulseDepth;
uniform float uTransparent;
uniform float uMinAlpha;
uniform float uExposure;

varying vec3 vNormalV;
varying vec3 vViewDir;
varying vec4 vMisc;
varying vec3 vPulseN;
varying vec3 vPulseOff;
varying vec3 vPulseAmp;

// One pulse slot. The wrapped difference is what lets a pulse run off the
// tip and reappear at the soma without a seam at the loop point.
float pulseAt(float n, float off, float amp, float arc) {
  if (amp <= 0.0) return 0.0;
  float pos = fract(uT * n + off);
  float d = arc - pos;
  d -= floor(d + 0.5);
  float soft = exp(-(d * d) / (2.0 * uSigma * uSigma));
  float hard = 1.0 - smoothstep(uSigma * 0.7, uSigma * 1.25, abs(d));
  return amp * mix(soft, hard, uHardness);
}

void main() {
  vec3 N = normalize(vNormalV);
  vec3 V = normalize(vViewDir);
  float ndv = clamp(abs(dot(N, V)), 0.0, 1.0);

  // Light roughly from the camera: these are stylised cells, not a lit set.
  float lambert = 0.3 + 0.7 * ndv;
  vec3 col = uTube * (uAmbient + (1.0 - uAmbient) * lambert);

  float fres = pow(1.0 - ndv, uRimPower);
  col += uRim * fres * uRimStrength;

  float arc = vMisc.x;
  // Confine nodes to branches thick enough to plausibly carry one. Without
  // this every terminal twig sprouts a bright spot and the look turns spiky.
  float junction = vMisc.z * smoothstep(uNodeGate.x, uNodeGate.y, vMisc.y);

  float glow =
      pulseAt(vPulseN.x, vPulseOff.x, vPulseAmp.x, arc)
    + pulseAt(vPulseN.y, vPulseOff.y, vPulseAmp.y, arc)
    + pulseAt(vPulseN.z, vPulseOff.z, vPulseAmp.z, arc);

  // A junction flares as the pulse crosses it, driven by the same position.
  col += uPulseColor * glow * (1.0 + junction * uJunctionFlare);

  // Steady nodes at the soma and branch junctions.
  col += uNodeColor * junction * uNodeStrength;

  // Brief, sharp flashes at junction points.
  if (uFlashStrength > 0.0) {
    float s = sin(6.2831853 * uFlashCycles * uT + vMisc.w);
    col += uNodeColor * junction * pow(max(0.0, s), 40.0) * uFlashStrength;
  }

  // Whole-cell activation.
  col *= 1.0 + uCellPulse * uCellPulseDepth;
  col *= uExposure;

  float alpha = 1.0;
  if (uTransparent > 0.5) {
    // Thinner tubes let more of the background through, which is what makes
    // the glassy look read as glass rather than as a pale plastic.
    alpha = clamp(
      mix(uMinAlpha, 0.92, vMisc.y) + fres * 0.55 + glow + junction * uNodeStrength * 0.35,
      0.0,
      1.0
    );
  }

  gl_FragColor = vec4(col, alpha);
}
`;

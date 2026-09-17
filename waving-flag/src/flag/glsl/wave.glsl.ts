/**
 * Procedural flag deformation — NOT a cloth simulation.
 *
 * Remotion renders frames out of order across threads, so anything that
 * accumulates state frame-to-frame produces inconsistent output and cannot
 * loop. Every term here is a pure function of the loop phase `t` in [0,1),
 * and every term completes a whole number of cycles over that range, so
 * frame 300 is identical to frame 0.
 *
 * Terms, all displacing along the flag's local +Z (perpendicular to the cloth):
 *   1. primary sine   — travels from the hoist (pole edge) outward
 *   2. secondary sine — different frequency, travelling at an angle
 *   3. gradient noise — low frequency irregularity, sampled on a CIRCLE in
 *      time so it returns to its start after one loop
 *   4. drape          — soft vertical folds gathered near the pole, plus a
 *      gentle gravitational sag toward the free edge
 *
 * Every term is multiplied by the envelope E(u) = u^p, which is exactly zero
 * at the attachment and largest at the free edge. Without that envelope the
 * cloth reads as a floating sheet rather than a flag.
 *
 * Derivatives dPdu / dPdv are closed form (the chain rule applied to the
 * expressions above, using the analytic derivative of the gradient noise), so
 * the normal is exact rather than reconstructed from neighbouring samples.
 */
export const WAVE_GLSL = /* glsl */ `
uniform float uTime;        // loop phase, 0..1
uniform vec2  uFlagSize;    // world width, height
uniform float uEnvPow;      // envelope exponent p
uniform float uAmp1;
uniform float uK1;          // spatial cycles across the flag
uniform float uN1;          // temporal cycles per loop (integer)
uniform float uAmp2;
uniform float uK2;
uniform float uN2;          // integer
uniform float uTheta;       // secondary travel angle, radians
uniform float uAmp3;
uniform vec2  uNoiseFreq;
uniform float uNoiseRadius; // radius of the circle traced in time
uniform float uDrapeAmp;
uniform float uDrapeSigma;
uniform float uDrapeCycles;
uniform float uSag;

const float WF_TAU = 6.283185307179586;

/**
 * Evaluates the deformation at flag coordinate (u,v), u=0 at the hoist.
 * Writes the displaced local position, its two analytic tangents, and a
 * normalised trough depth used for fold self-shading.
 */
void wf_wave(vec2 uv, out vec3 pos, out vec3 dPdu, out vec3 dPdv, out float cavity) {
  float u = uv.x;
  float v = uv.y;
  float t = uTime;

  // --- envelope: zero at the pole, largest at the free edge ---------------
  float uSafe = max(u, 1e-4);
  float env  = pow(uSafe, uEnvPow);
  float dEnv = uEnvPow * pow(uSafe, uEnvPow - 1.0);

  // --- 1. primary sine, travelling outward from the hoist -----------------
  float ph1 = WF_TAU * (uK1 * u - uN1 * t);
  float s1 = sin(ph1);
  float c1 = cos(ph1);
  float w1 = uAmp1 * env * s1;
  float dw1du = uAmp1 * (dEnv * s1 + env * c1 * WF_TAU * uK1);
  float dw1dv = 0.0;

  // --- 2. secondary sine, different frequency and angle -------------------
  float ct = cos(uTheta);
  float st = sin(uTheta);
  float s  = u * ct + v * st;
  float ph2 = WF_TAU * (uK2 * s - uN2 * t);
  float s2 = sin(ph2);
  float c2 = cos(ph2);
  float w2 = uAmp2 * env * s2;
  float dw2du = uAmp2 * (dEnv * s2 + env * c2 * WF_TAU * uK2 * ct);
  float dw2dv = uAmp2 * (env * c2 * WF_TAU * uK2 * st);

  // --- 3. low frequency noise, sampled on a circle in time ----------------
  float ang = WF_TAU * t;
  vec3 q = vec3(
    u * uNoiseFreq.x + uNoiseRadius * cos(ang),
    v * uNoiseFreq.y,
    uNoiseRadius * sin(ang)
  );
  vec4 n = wf_noised(q);
  float w3 = uAmp3 * env * n.x;
  float dw3du = uAmp3 * (dEnv * n.x + env * n.y * uNoiseFreq.x);
  float dw3dv = uAmp3 * (env * n.z * uNoiseFreq.y);

  // --- 4. drape: vertical folds gathered near the pole --------------------
  // u * exp(-u/sigma) is zero at the attachment and peaks a little way out,
  // so the cloth gathers without contradicting the fixed edge.
  float e = exp(-u / uDrapeSigma);
  float g = u * e;
  float dg = e * (1.0 - u / uDrapeSigma);
  float phv = WF_TAU * uDrapeCycles * v;
  float sv = sin(phv);
  float cv = cos(phv);
  float w4 = uDrapeAmp * g * sv;
  float dw4du = uDrapeAmp * dg * sv;
  float dw4dv = uDrapeAmp * g * cv * WF_TAU * uDrapeCycles;

  // --- sum ----------------------------------------------------------------
  float z    = w1 + w2 + w3 + w4;
  float dzdu = dw1du + dw2du + dw3du + dw4du;
  float dzdv = dw1dv + dw2dv + dw3dv + dw4dv;

  // gentle gravitational sag, growing toward the free edge
  float sag    = -uSag * u * u;
  float dsagdu = -2.0 * uSag * u;

  float x = (u - 0.5) * uFlagSize.x;
  float y = (v - 0.5) * uFlagSize.y + sag * uFlagSize.y;

  pos  = vec3(x, y, z * uFlagSize.y);
  dPdu = vec3(uFlagSize.x, dsagdu * uFlagSize.y, dzdu * uFlagSize.y);
  dPdv = vec3(0.0,         uFlagSize.y,          dzdv * uFlagSize.y);

  // Normalised trough depth. In a corrugation the troughs are the parts
  // occluded by the neighbouring crests, so this drives the fold shading.
  float reach = (uAmp1 + uAmp2 + uAmp3) * env + 1e-5;
  float trough = clamp(-(w1 + w2 + w3) / reach * 1.9, 0.0, 1.0);
  cavity = trough * trough * (3.0 - 2.0 * trough);
}
`;

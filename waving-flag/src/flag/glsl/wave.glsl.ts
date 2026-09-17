/**
 * Procedural flag deformation — NOT a cloth simulation.
 *
 * Remotion renders frames out of order across threads, so anything that
 * accumulates state frame to frame produces inconsistent output and cannot
 * loop. Every term here is a pure function of the loop phase `t` in [0,1), and
 * every term completes a whole number of cycles over that range, so the loop
 * closes exactly.
 *
 * Terms, in the order they are built up:
 *
 *   gust      a slow surge-and-settle modulating the whole wave (1 and 2
 *             cycles per loop), so the flag does not flutter at a constant rate
 *   envelope  E(u) = u^p with p ~ 2 — QUADRATIC, so the outer third does most
 *             of the moving and the attachment barely moves at all
 *   primary   a sine travelling from the hoist outward
 *   secondary a sine at a different frequency, travelling at an angle
 *   ripple    a third, higher-frequency, low-amplitude sine that puts small
 *             sharp creases on top of the broad folds
 *   noise     low-frequency gradient noise for irregularity, sampled on a
 *             circle in time so it returns to its start
 *   flutter   a faster term weighted toward the free edge
 *   curl      the last ~10% of the width rolling forward and back, varying
 *             along its length
 *   sharpen   a curve pushing the summed displacement toward its extremes, so
 *             creases form ridges rather than smooth sine humps
 *   drape     soft vertical folds gathered just outside the attachment
 *   edges     a vertical term that arcs the top edge and sags the bottom edge
 *             out of phase with it, so they are never straight and parallel
 *   poleSag   a downward sag over the first ~15% of the width, strongest at
 *             the bottom corner, so the flag hangs from its attachment
 *   gravity   a gentle sag growing toward the free edge
 *
 * Derivatives dPdu / dPdv are closed form throughout — the chain rule applied
 * to the expressions above, including through the sharpening curve and the
 * analytic derivative of the gradient noise. The normal is their cross
 * product, never reconstructed from a texture.
 */
export const WAVE_GLSL = /* glsl */ `
uniform float uTime;        // loop phase, 0..1 (may carry a sub-frame offset)
uniform vec2  uFlagSize;    // world width, height
uniform float uEnvPow;

uniform float uAmp1;  uniform float uK1;  uniform float uN1;
uniform float uAmp2;  uniform float uK2;  uniform float uN2;  uniform float uTheta;
uniform float uAmp3;  uniform float uK3;  uniform float uN3;  uniform float uTheta3;
uniform float uAmpN;  uniform vec2  uNoiseFreq;  uniform float uNoiseRadius;
uniform float uAmpFlutter; uniform float uKFlutter; uniform float uNFlutter; uniform float uFlutterStart;
uniform float uAmpCurl;    uniform float uKCurl;    uniform float uNCurl;    uniform float uCurlStart;
uniform float uSharpen;
uniform float uGustDepth;
uniform float uDrapeAmp;   uniform float uDrapeSigma;  uniform float uDrapeCycles;
uniform float uEdgeAmp;    uniform float uKEdge;       uniform float uNEdge;
uniform float uPoleSag;    uniform float uPoleSagWidth;
uniform float uSag;

const float WF_TAU = 6.283185307179586;

/** smoothstep and its derivative with respect to x. */
vec2 wf_sstep(float a, float b, float x) {
  float inv = 1.0 / (b - a);
  float xx = clamp((x - a) * inv, 0.0, 1.0);
  float s = xx * xx * (3.0 - 2.0 * xx);
  float d = (xx > 0.0 && xx < 1.0) ? 6.0 * xx * (1.0 - xx) * inv : 0.0;
  return vec2(s, d);
}

void wf_wave(vec2 uv, out vec3 pos, out vec3 dPdu, out vec3 dPdv, out float cavity) {
  float u = uv.x;
  float v = uv.y;
  float t = uTime;

  // --- gust: whole-number cycles, so it still loops --------------------------
  float gust = 1.0 + uGustDepth * (0.62 * sin(WF_TAU * t) + 0.38 * sin(WF_TAU * 2.0 * t + 1.7));

  // --- quadratic envelope: ~zero at the attachment, largest at the free edge --
  float uSafe = max(u, 1e-4);
  float env  = pow(uSafe, uEnvPow);
  float dEnv = uEnvPow * pow(uSafe, uEnvPow - 1.0);

  // --- 1. primary sine, travelling outward from the hoist --------------------
  float ph1 = WF_TAU * (uK1 * u - uN1 * t);
  float s1 = sin(ph1), c1 = cos(ph1);
  float w1 = uAmp1 * env * s1;
  float dw1du = uAmp1 * (dEnv * s1 + env * c1 * WF_TAU * uK1);

  // --- 2. secondary sine, different frequency and angle ----------------------
  float ct2 = cos(uTheta), st2 = sin(uTheta);
  float ph2 = WF_TAU * (uK2 * (u * ct2 + v * st2) - uN2 * t);
  float s2 = sin(ph2), c2 = cos(ph2);
  float w2 = uAmp2 * env * s2;
  float dw2du = uAmp2 * (dEnv * s2 + env * c2 * WF_TAU * uK2 * ct2);
  float dw2dv = uAmp2 * (env * c2 * WF_TAU * uK2 * st2);

  // --- 3. higher-frequency ripple riding on the broad folds ------------------
  float ct3 = cos(uTheta3), st3 = sin(uTheta3);
  float ph3 = WF_TAU * (uK3 * (u * ct3 + v * st3) - uN3 * t);
  float s3 = sin(ph3), c3 = cos(ph3);
  float w3 = uAmp3 * env * s3;
  float dw3du = uAmp3 * (dEnv * s3 + env * c3 * WF_TAU * uK3 * ct3);
  float dw3dv = uAmp3 * (env * c3 * WF_TAU * uK3 * st3);

  // --- 4. low frequency noise, sampled on a circle in time -------------------
  float ang = WF_TAU * t;
  vec3 q = vec3(u * uNoiseFreq.x + uNoiseRadius * cos(ang), v * uNoiseFreq.y, uNoiseRadius * sin(ang));
  vec4 n = wf_noised(q);
  float w4 = uAmpN * env * n.x;
  float dw4du = uAmpN * (dEnv * n.x + env * n.y * uNoiseFreq.x);
  float dw4dv = uAmpN * (env * n.z * uNoiseFreq.y);

  // --- 5. free-edge flutter: faster than the body ----------------------------
  vec2 gF = wf_sstep(uFlutterStart, 1.0, u);
  float phF = WF_TAU * (uKFlutter * u - uNFlutter * t);
  float sF = sin(phF), cF = cos(phF);
  float w5 = uAmpFlutter * gF.x * sF;
  float dw5du = uAmpFlutter * (gF.y * sF + gF.x * cF * WF_TAU * uKFlutter);

  // --- 6. free-edge curl: the last tenth rolling forward and back ------------
  vec2 gCs = wf_sstep(uCurlStart, 1.0, u);
  float gC = gCs.x * gCs.x;              // squared, so it bites only at the edge
  float dgC = 2.0 * gCs.x * gCs.y;
  float phC = WF_TAU * (uKCurl * v - uNCurl * t);
  float sC = sin(phC), cC = cos(phC);
  float w6 = uAmpCurl * gC * sC;
  float dw6du = uAmpCurl * dgC * sC;
  float dw6dv = uAmpCurl * gC * cC * WF_TAU * uKCurl;

  // --- sum, then sharpen -----------------------------------------------------
  float Z    = w1 + w2 + w3 + w4 + w5 + w6;
  float dZdu = dw1du + dw2du + dw3du + dw4du + dw5du + dw6du;
  float dZdv = dw2dv + dw3dv + dw4dv + dw6dv;

  // Normalise against the largest value the terms could reach, so |nz| <= 1.
  float reach = uAmp1 + uAmp2 + uAmp3 + uAmpN + uAmpFlutter + uAmpCurl + 1e-5;
  float nz = Z / reach;
  // n*(1.5 - 0.5n^2) pushes mid values outward: crests and troughs steepen into
  // ridges instead of staying as rounded sine humps. Monotonic on [-1,1], so
  // the surface stays single valued.
  float shaped = mix(nz, nz * (1.5 - 0.5 * nz * nz), uSharpen);
  float dShaped = mix(1.0, 1.5 - 1.5 * nz * nz, uSharpen);   // d(shaped)/d(nz)

  float zWave    = shaped * reach * gust;
  float dzWaveDu = dShaped * dZdu * gust;
  float dzWaveDv = dShaped * dZdv * gust;

  // --- drape: soft vertical folds gathered just outside the attachment -------
  float e = exp(-u / uDrapeSigma);
  float g = u * e;
  float dg = e * (1.0 - u / uDrapeSigma);
  float phv = WF_TAU * uDrapeCycles * v;
  float sv = sin(phv), cv = cos(phv);
  float w7 = uDrapeAmp * g * sv;
  float dw7du = uDrapeAmp * dg * sv;
  float dw7dv = uDrapeAmp * g * cv * WF_TAU * uDrapeCycles;

  float z    = zWave + w7;
  float dzdu = dzWaveDu + dw7du;
  float dzdv = dzWaveDv + dw7dv;

  // --- vertical: top edge arcs, bottom edge sags, out of phase ---------------
  float top = v * v;             float dtop = 2.0 * v;
  float bot = (1.0 - v) * (1.0 - v); float dbot = -2.0 * (1.0 - v);
  float phE  = WF_TAU * (uKEdge * u - uNEdge * t);
  float phE2 = phE + 1.9;        // deliberately out of phase with the top edge
  float sE = sin(phE),  cE = cos(phE);
  float sE2 = sin(phE2), cE2 = cos(phE2);
  float yEdge    = uEdgeAmp * u * (sE * top - sE2 * bot);
  float dyEdgeDu = uEdgeAmp * ((sE * top - sE2 * bot)
                   + u * WF_TAU * uKEdge * (cE * top - cE2 * bot));
  float dyEdgeDv = uEdgeAmp * u * (sE * dtop - sE2 * dbot);

  // --- drape at the pole: hangs from the attachment, heaviest at the bottom --
  float pw = exp(-u / uPoleSagWidth);
  float qv = (1.0 - v) * (1.0 - v);
  float yPole    = -uPoleSag * pw * qv;
  float dyPoleDu =  uPoleSag * pw * qv / uPoleSagWidth;
  float dyPoleDv =  uPoleSag * pw * 2.0 * (1.0 - v);

  // --- gravity, growing toward the free edge ---------------------------------
  float ySag    = -uSag * u * u;
  float dySagDu = -2.0 * uSag * u;

  float yTotal    = (v - 0.5) + ySag + yEdge + yPole;
  float dyTotalDu = dySagDu + dyEdgeDu + dyPoleDu;
  float dyTotalDv = 1.0 + dyEdgeDv + dyPoleDv;

  pos  = vec3((u - 0.5) * uFlagSize.x, yTotal * uFlagSize.y, z * uFlagSize.y);
  dPdu = vec3(uFlagSize.x, dyTotalDu * uFlagSize.y, dzdu * uFlagSize.y);
  dPdv = vec3(0.0,         dyTotalDv * uFlagSize.y, dzdv * uFlagSize.y);

  // Troughs are the parts occluded by the crests either side of them. Taken
  // after sharpening, so the deepened creases shade as strongly as they look.
  float trough = clamp(-shaped * 2.1, 0.0, 1.0);
  cavity = trough * trough * (3.0 - 2.0 * trough);
}
`;

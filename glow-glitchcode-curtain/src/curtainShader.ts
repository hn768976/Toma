/**
 * Light Curtain fragment shader: ~60 ribbons summed per pixel, in linear light,
 * then a soft tone-map, then dither + grain. Ribbon parameters come from the
 * CPU (seeded, deterministic) as uniform arrays; the shader itself uses no
 * float-hash randomness. Dither/grain use an integer hash of (pixel, frame%600).
 */
export const RIBBONS = 60;

export const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const fragmentShader = /* glsl */ `
  precision highp float;
  precision highp int;
  varying vec2 vUv;

  #define N ${RIBBONS}
  uniform float uPhase;      // frame % 600 / 600
  uniform float uFrame;      // frame % 600
  uniform float uAspect;
  uniform vec4 uA[N];        // x0, bend, w0, w1
  uniform vec4 uB[N];        // swayAmp, swayFreq, swayPhase, gain
  uniform vec4 uC[N];        // rampShift, waveTrips, wavePhase, thin
  uniform vec4 uD[N];        // swayAmp2, swayFreq2, swayPhase2, fadeLen
  uniform vec3 uRamp[5];     // linear-light ramp colours
  uniform vec3 uBg0;         // background bottom (sRGB 0..1)
  uniform vec3 uBg1;         // background top
  uniform vec3 uGlow;        // linear-light glow colour
  uniform float uExposure;
  uniform float uGrain;

  const float TAU = 6.28318530718;

  vec3 ramp(float s) {
    s = clamp(s, 0.0, 1.0) * 4.0;
    int i = int(min(floor(s), 3.0));
    float f = s - float(i);
    f = f * f * (3.0 - 2.0 * f) * 0.55 + f * 0.45;
    vec3 a = uRamp[0]; vec3 b = uRamp[1];
    if (i == 1) { a = uRamp[1]; b = uRamp[2]; }
    else if (i == 2) { a = uRamp[2]; b = uRamp[3]; }
    else if (i == 3) { a = uRamp[3]; b = uRamp[4]; }
    return mix(a, b, f);
  }

  uint pcg(uint v) {
    uint state = v * 747796405u + 2891336453u;
    uint word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
    return (word >> 22u) ^ word;
  }
  float rnd(uvec2 p, uint seed) {
    uint h = pcg(p.x + pcg(p.y + pcg(seed)));
    return float(h >> 8) * (1.0 / 16777216.0);
  }

  vec3 toSrgb(vec3 c) {
    return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2));
  }

  void main() {
    vec2 uv = vUv;                  // x: 0..1 left->right, y: 0 bottom .. 1 top
    float x = uv.x;
    float y = uv.y;

    vec3 sum = vec3(0.0);
    for (int i = 0; i < N; i++) {
      vec4 a = uA[i]; vec4 b = uB[i]; vec4 c = uC[i]; vec4 d = uD[i];
      float yy = pow(y, 1.6);
      // sway: smooth, sampled around a circle in time (cos/sin of the loop angle)
      float th = TAU * uPhase;
      float sway = b.x * sin(b.y * y * TAU + b.z + 1.7 * cos(th + b.z))
                 + d.x * sin(d.y * y * TAU + d.z + 1.3 * sin(th + d.z * 2.0));
      // the whole fan breathes: bend and base position drift on whole loop cycles
      float bendT = a.y * (1.0 + 0.35 * sin(th + b.z));
      float x0T = a.x + 0.03 * sin(2.0 * th + d.z);
      float xc = x0T + bendT * yy + sway;
      float w = mix(a.z, a.w, pow(y, 0.85)) ;
      float dist = (x - xc) / w;
      // contribution is < 1e-9 beyond ~3 widths: skip the expensive part
      if (abs(dist) > 3.2) continue;
      // softer on one side, crisper on the other (silk-like edge)
      float skew = (dist < 0.0) ? 0.85 : 1.9;
      float ad = abs(dist) * skew;
      float g = exp(-0.5 * pow(ad, 3.0) * 1.6);   // flatter top, defined shoulder
      float core = exp(-0.5 * dist * dist * 14.0) * c.w;
      // brightness fades along the ribbon, travelling wave flows upward
      float fade = pow(clamp(1.0 - y / d.w, 0.0, 1.0), 1.15);
      float wave = 0.78 + 0.22 * sin(TAU * (c.y * uPhase - y * 1.6 + c.z));
      float baseHot = 1.0 + 0.5 * exp(-y * 14.0);
      float amp = 0.44 * b.w * fade * wave * baseHot;
      vec3 col = ramp(pow(y, 0.55) * 0.62 + c.x);
      // bright rim on the crisp side of each broad/medium ribbon
      float rim = exp(-0.5 * pow((dist - 0.85) / 0.16, 2.0)) * (1.0 - c.w) * 0.7;
      vec3 rimCol = mix(col, vec3(1.0, 0.7, 0.6), 0.12);
      sum += (col * (g * (1.0 - c.w * 0.5) + core * 1.6) + rimCol * rim) * amp * pow(a.z / w, 0.35);
    }

    // background + faint glow behind the bundle
    vec3 bg = mix(uBg0, uBg1, smoothstep(0.0, 1.0, y));
    vec3 bgLin = pow(bg, vec3(2.2));
    float gl = exp(-pow((x - 0.5) / 0.55, 2.0)) * exp(-y * 2.2);
    sum += bgLin + uGlow * gl * 0.05;

    // soft tone-map: overlaps glow without clipping to flat white
    // (hue-preserving on the brightest channel, with a little per-channel
    // roll-off so the very hottest overlaps lose saturation, not detail)
    float m = max(max(sum.r, sum.g), max(sum.b, 1e-4));
    vec3 hueKeep = sum * ((1.0 - exp(-m * uExposure)) / m);
    vec3 perChan = vec3(1.0) - exp(-sum * uExposure);
    vec3 mapped = mix(hueKeep, perChan, 0.3);
    vec3 srgb = toSrgb(mapped);

    // dither (+-1/255) after tone-map, plus grain; integer hash of pixel+frame
    uvec2 p = uvec2(gl_FragCoord.xy);
    uint f = uint(uFrame);
    float n1 = rnd(p, f * 3u + 1u) - 0.5;
    float n2 = rnd(p, f * 3u + 2u) - 0.5;
    float n3 = rnd(p, f * 3u + 3u) - 0.5;
    float gr = (rnd(p, f * 7u + 17u) + rnd(p, f * 7u + 18u) - 1.0) * uGrain;
    srgb += gr + vec3(n1, n2, n3) * (2.0 / 255.0);
    gl_FragColor = vec4(srgb, 1.0);
  }
`;

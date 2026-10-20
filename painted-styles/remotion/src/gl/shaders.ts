// All motion is a pure function of the uniforms, which are pure functions of the frame.

export const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Layer pass: samples one painted layer (premultiplied) at a motion-warped position.
export const LAYER_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uTex;
uniform int uMode;          // 0 rigid offset, 1 water, 2 drifting tile cross-fade, 3 wrap, 4 bob, 5 image (no bleed)
uniform vec2 uComp;         // composition size (px)
uniform float uScale;       // backing px per composition px
uniform vec2 uCanvas;       // layer canvas size (px)
uniform vec2 uBleed;        // canvas offset of composition (0,0)
uniform vec2 uOff;          // camera offset for this layer (comp px)
uniform vec2 uOff2;         // water: offset at the bottom edge
uniform float uHorizon, uBottom;
uniform float uTheta;       // loop phase, 0..2pi
uniform float uAmp;         // water: displacement amplitude (px) at the bottom
uniform vec2 uDrift;        // mode 2: drift of copy A / copy B (px);  mode 3: wrap drift in .x
uniform vec2 uWeight;       // mode 2: weights of copy A / copy B
uniform vec2 uPivot;        // mode 4: pivot (comp px)
uniform float uAngle;       // mode 4: rotation (rad)
uniform vec2 uShift;        // mode 4: translation (px)
uniform float uOpacity;
out vec4 outColor;

float hash3(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.x + p.y) * p.z);
}
float vnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y);
  float b = mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y);
  return mix(a, b, f.z);
}
// noise on a time circle: z/w follow (cos, sin) of the loop phase, so the field returns exactly
float loopNoise(vec2 q) {
  vec2 c = vec2(cos(uTheta), sin(uTheta)) * 1.6;
  return 0.5 * vnoise(vec3(q, c.x)) + 0.5 * vnoise(vec3(q.yx + 17.3, c.y));
}
vec4 tap(vec2 c) {
  vec2 uv = c / uCanvas;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return vec4(0.0);
  return texture(uTex, uv);
}
vec4 tapWrapX(vec2 c) {
  c.x = mod(c.x, uCanvas.x);
  return tap(c);
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, uComp.y * uScale - gl_FragCoord.y) / uScale;   // comp px, y down
  vec4 col;
  if (uMode == 1) {
    float k = clamp((p.y - uHorizon) / (uBottom - uHorizon), 0.0, 1.0);
    vec2 off = mix(uOff, uOff2, k);
    vec2 q = vec2(p.x / 420.0, p.y / 90.0);       // broad, slow swells: a shimmer, not a ripple filter
    float dx = (loopNoise(q) - 0.5) * 2.0 * uAmp * pow(k, 1.3);
    float dy = (loopNoise(q * 1.7 + 5.1) - 0.5) * 0.6 * uAmp * pow(k, 1.3);
    col = tap(p + uBleed + off + vec2(dx, dy));
  } else if (uMode == 2) {
    vec2 c = p + uBleed + uOff;
    col = tapWrapX(c - vec2(uDrift.x, 0.0)) * uWeight.x + tapWrapX(c - vec2(uDrift.y, 0.0)) * uWeight.y;
  } else if (uMode == 3) {
    col = tapWrapX(p + uBleed + uOff - vec2(uDrift.x, 0.0));
  } else if (uMode == 4) {
    vec2 d = p - uPivot - uShift;
    float cs = cos(-uAngle), sn = sin(-uAngle);
    vec2 r = vec2(cs * d.x - sn * d.y, sn * d.x + cs * d.y) + uPivot;
    col = tap(r + uBleed + uOff);
  } else if (uMode == 5) {
    col = tap(p * uCanvas / uComp);
  } else {
    col = tap(p + uBleed + uOff);
  }
  outColor = col * uOpacity;
}
`;

// Final pass: half-float accumulation -> style light effects -> grain -> blue-noise dither -> 8-bit.
export const FINAL_FRAG = `#version 300 es
precision highp float;
uniform sampler2D uAcc;
uniform sampler2D uBlue;     // 64x64 blue noise, R in 0..1
uniform vec2 uComp;
uniform float uScale;
uniform int uFx;             // 0 none, 1 stained-glass light sweep
uniform float uSweep;        // sweep centre along the diagonal (comp px)
uniform float uGrain;        // ~0.01
out vec4 outColor;
float h21(vec2 p) {
  p = fract(p * vec2(443.897, 441.423));
  p += dot(p, p.yx + 19.19);
  return fract((p.x + p.y) * p.x);
}
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec3 c = texelFetch(uAcc, ip, 0).rgb;
  vec2 p = vec2(gl_FragCoord.x, uComp.y * uScale - gl_FragCoord.y) / uScale;
  if (uFx == 1) {
    // a broad band of light travelling along the diagonal; glass brightens, lead (dark) stays dark
    float d = (p.x * 0.8 + p.y * 0.6) - uSweep;
    float band = 1.0 - smoothstep(0.0, 1100.0, abs(d));   // compact: exactly 0 once off-frame
    float glass = smoothstep(0.10, 0.35, max(c.r, max(c.g, c.b)));
    c += band * glass * 0.32 * c;               // light passing through the glass: brightens it, never the leads
  }
  // fixed per-pixel grain (composition-space, so it sits on the painting like paper texture)
  float g = h21(floor(p * 1.0) + 0.5) - 0.5;
  c += g * 2.0 * uGrain;
  float bn = texelFetch(uBlue, ip % 64, 0).r - 0.5;
  c += bn * (2.0 / 255.0);
  outColor = vec4(clamp(c, 0.0, 1.0), 1.0);
}
`;

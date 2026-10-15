import { FINISH, NOISE } from '../lib/glsl';
import { Pass, makeRT } from '../lib/pixi';
import type { SceneFactory } from '../lib/PixiStage';
import { hexToLinear, smoothstep } from '../lib/random';

export interface FlareParams {
  glow: string; // main glow / streak colour
  core: string; // hot core colour
  loopFrames: number;
}

const FLARE_FRAG = /* glsl */ `
in vec2 vUV; out vec4 finalColor;
uniform vec2 uRes;      // physical px
uniform float uS;       // physical px per 4K px
uniform vec2 uPos;      // flare position, 0..1 of frame
uniform float uI;       // intensity
uniform float uStretch; // streak length factor
uniform vec3 uGlow;
uniform vec3 uCore;
${NOISE}
float win(float d, float r) { float x = clamp(1.0 - d / r, 0.0, 1.0); return x * x * (3.0 - 2.0 * x); }
// glow tint deepens (more saturated, toward red/blue) as intensity falls
vec3 tint(float I) { return I * pow(uGlow, vec3(1.0 + 0.9 * exp(-2.0 * I))); }
void main() {
  vec2 px = vUV * uRes / uS;            // 4K design px, y down
  vec2 P = uPos * vec2(3840.0, 2160.0);
  vec2 d = px - P;
  float r = length(d);
  vec3 c = vec3(0.0);
  // hot core: small white disc with a warm halo
  c += uCore * (4.0 * smoothstep(30.0, 14.0, r) + 1.2 * exp(-r / 34.0));
  c += tint(1.0) * 1.1 * exp(-r / 90.0);
  // short starburst spikes around the core
  float a = atan(d.y, d.x);
  float spikes = pow(abs(cos(a * 4.0 + 0.3)), 40.0) + 0.7 * pow(abs(cos(a * 7.0 + 1.1)), 70.0);
  c += mix(uCore, uGlow, 0.5) * spikes * 0.5 * exp(-r / 110.0) * smoothstep(10.0, 40.0, r);
  // big radial glow (compact support so far areas stay exactly black)
  float g = 0.75 * exp(-r / 230.0) + 0.42 * exp(-pow(r / 820.0, 2.0)) + 0.16 * exp(-pow(r / 1650.0, 2.0));
  c += tint(g) * win(r, 3100.0);
  // a soft beam fanning back and down to the left of the source
  vec2 bd = vec2(-0.93, 0.36);
  float along = dot(d, bd);
  float across = abs(dot(d, vec2(-bd.y, bd.x)));
  float cone = smoothstep(0.42, 0.0, across / max(along, 1.0)) * smoothstep(0.0, 300.0, along);
  c += tint(0.35 * cone * exp(-along / 1400.0)) * win(r, 2800.0);
  // anamorphic streak: two soft orange lines plus a thin bright core line
  float L = 1350.0 * uStretch;
  float ax = abs(d.x);
  float fall = exp(-ax / L) * win(ax, 3.0 * L);
  c += tint(0.55 * fall * exp(-pow((d.y + 28.0) / 9.0, 2.0)));
  c += tint(0.45 * exp(-ax / (0.85 * L)) * win(ax, 3.0 * L) * exp(-pow((d.y - 54.0) / 10.0, 2.0)));
  c += mix(uCore, uGlow, 0.6) * 0.5 * exp(-pow(d.y / 3.0, 2.0)) * exp(-ax / (0.35 * L)) * win(ax, 2.0 * L);
  c += tint(0.18 * fall * exp(-pow((d.y - 12.0) / 70.0, 2.0)));
  // faint ghosts: discs on the line through the frame centre, opposite side
  vec2 C = vec2(1920.0, 1080.0);
  vec2 axis = C - P;
  for (int k = 0; k < 5; k++) {
    float fk = float(k);
    float t = 0.35 + 0.42 * fk;
    float rad = 50.0 + 45.0 * mod(fk * 3.0, 5.0);
    vec2 gp = C + axis * (t - 0.4) * 1.3;
    float dg = length(px - gp);
    float disc = smoothstep(rad, rad * 0.7, dg) * (0.6 + 0.4 * smoothstep(rad * 0.4, rad, dg));
    c += mix(uGlow, uCore, 0.3) * disc * (0.012 + 0.008 * mod(fk, 2.0));
  }
  // faint ring
  vec2 rc = C + axis * 0.9;
  float rr = length(px - rc);
  c += uGlow * 0.012 * exp(-pow((rr - 420.0) / 22.0, 2.0));
  finalColor = vec4(c * uI, 1.0);
}
`;

const OUT_FRAG = /* glsl */ `
in vec2 vUV; out vec4 finalColor;
uniform sampler2D uSrc;
uniform float uFrameMod;
${NOISE}
${FINISH}
void main() {
  vec3 c = texture(uSrc, vUV).rgb;
  c = 1.0 - exp(-c * 1.1);           // filmic shoulder, 0 stays 0
  vec3 s = linearToSrgb(c);
  s = max(s - 2.0 / 255.0, 0.0) * (255.0 / 253.0); // overlay black floor
  finalColor = vec4(finishColor(s, uFrameMod, 0.015), 1.0);
}
`;

/** x position (0..1) of the flare at time t (s) */
function flareX(t: number) {
  if (t < 2) return 0.2 - 0.04 * (1 - smoothstep(0.5, 2, t));
  if (t < 6) {
    const u = (t - 2) / 4;
    return 0.2 + 0.72 * u * u * (2 - u);
  }
  const tau = t - 6;
  return 0.92 + 0.18 * tau + 0.071 * tau * tau;
}

export const flareScene: SceneFactory<FlareParams> = ({ renderer, w, h, s }, p) => {
  const rt = makeRT(w, h);
  const flare = new Pass(w, h, FLARE_FRAG, {
    uRes: { value: [w, h], type: 'vec2<f32>' },
    uS: { value: s, type: 'f32' },
    uPos: { value: [0.2, 0.42], type: 'vec2<f32>' },
    uI: { value: 0, type: 'f32' },
    uStretch: { value: 1, type: 'f32' },
    uGlow: { value: hexToLinear(p.glow), type: 'vec3<f32>' },
    uCore: { value: hexToLinear(p.core), type: 'vec3<f32>' },
  });
  const out = new Pass(w, h, OUT_FRAG, { uFrameMod: { value: 0, type: 'f32' } }, { uSrc: rt.source });
  return {
    render(frame) {
      const t = frame / 30;
      const inten =
        smoothstep(0.5, 2.0, t) * (0.85 + 0.15 * smoothstep(2, 5, t)) * (1 - smoothstep(6.0, 7.5, t));
      const y = 0.46 - 0.04 * smoothstep(0.5, 2.5, t);
      flare.u.uPos = [flareX(t), y];
      flare.u.uI = inten;
      flare.u.uStretch = 0.55 + 0.6 * smoothstep(1.5, 6, t);
      flare.draw(renderer, rt);
      out.u.uFrameMod = frame % p.loopFrames;
      out.draw(renderer);
    },
  };
};

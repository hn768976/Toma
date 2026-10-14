import { WebGLRenderer } from "three";
import { lin } from "../lib/color";
import { FINISH_GLSL, FullscreenPass, HASH_GLSL, finishUniforms, rawMaterial, setFinishUniforms } from "../lib/post";
import type { Look } from "../lib/ThreeLook";

export interface SoftLightParams {
  edge: string;
  glow: string;
  streak: string;
}

/**
 * Look 5 — Soft Light. One full-screen fragment shader, everything in float,
 * finished with grain + TPDF + blue-noise dither. Every motion term is
 * sin/cos of (TAU * frame / 600 * integer) so frame 600 == frame 0.
 */
const FRAG = /* glsl */ `
precision highp float;
precision highp int;
uniform vec3 uEdge;
uniform vec3 uGlow;
uniform vec3 uStreak;
uniform float uPhase;     // TAU * frame / 600
uniform float uAspect;
in vec2 vUv;
out vec4 outColor;
${HASH_GLSL}
${FINISH_GLSL}

const float TAU = 6.283185307179586;

// Streak: broad gaussian band across, long gentle modulation along.
float streak(vec2 p, float ang, float off, float width, float amp, float lenPeriod, float k, float ph) {
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 nrm = vec2(-dir.y, dir.x);
  float a = dot(p, dir);
  float b = dot(p, nrm) - off - 0.025 * sin(uPhase + ph);
  // gaussian, but compressed on one side → a crisp edge with a soft tail
  float bb = b < 0.0 ? b * 7.0 : b;
  float across = exp(-(bb * bb) / (width * width));
  // drift along the band: exactly k band-lengths per loop
  float along = 0.55 + 0.45 * sin(TAU * a / lenPeriod - uPhase * k + ph);
  return amp * across * along;
}

// Thin arc: circle through point P0, centre on the normal side at radius R.
float arc(vec2 p, vec2 p0, float ang, float R, float w, float glowW, float amp, float ph) {
  vec2 dir = vec2(cos(ang), sin(ang));
  vec2 nrm = vec2(-dir.y, dir.x);
  vec2 c = p0 + nrm * R;
  float ds = length(p - c) - R;               // signed: >0 outside the circle
  float d = abs(ds);
  float line = exp(-(d * d) / (w * w));
  float halo = exp(-(d * d) / (glowW * glowW));
  // soft fill on one side of the edge → reads as the lit face of a folded sheet
  float fill = (R > 0.0 ? step(ds, 0.0) : step(0.0, ds)) * exp(-d / 0.09) * 0.55;
  // fade toward the ends of the visible run
  float a = dot(p - p0, dir);
  float fade = smoothstep(-1.1, -0.2, a) * (1.0 - smoothstep(0.35, 1.2, a));
  float pulse = 0.75 + 0.25 * sin(uPhase + ph);
  return amp * fade * pulse * (line + 0.35 * halo + fill);
}

void main() {
  // p: x in [-aspect/2, aspect/2], y in [-0.5, 0.5] (y up)
  vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);

  // --- base gradient (linear light) ---
  vec2 gc = vec2((0.24 - 0.5) * uAspect, 0.5 - 0.78);   // glow centre: x 24%, y 78% from top
  vec2 dg = p - gc;
  // ellipse stretched along the light direction (lower-left → upper-right)
  float ca = cos(0.62), sa = sin(0.62);
  vec2 r = vec2(ca * dg.x + sa * dg.y, -sa * dg.x + ca * dg.y);
  float d2 = (r.x * r.x) / (0.62 * 0.62) + (r.y * r.y) / (0.36 * 0.36);
  float t = exp(-d2 * 1.05);
  // breathing of the glow, whole cycle
  t *= 0.96 + 0.04 * sin(uPhase);
  vec3 col = mix(uEdge * 1.2, uGlow, t) + uGlow * 0.3 * t * t + uStreak * 0.14 * t * t;
  // faint secondary lift top-right
  vec2 d3 = p - vec2(0.38 * uAspect, 0.42);
  col += uEdge * 0.35 * exp(-dot(d3, d3) / 0.18);
  // vignette, strongest bottom-right and corners
  float vr = length((p - vec2(-0.25, -0.1)) * vec2(0.8, 1.15));
  col *= 1.0 - 0.32 * smoothstep(0.5, 1.3, vr);
  col *= 1.0 - 0.1 * smoothstep(0.1, 0.9, p.x - p.y * 0.4);
  col *= 1.0 - 0.12 * smoothstep(0.0, 0.5, p.y - p.x * 0.6);   // darker top-left

  // --- streaks (lower-left → upper-right), opacity 8–18% ---
  float s = 0.0;
  float ang = 0.72;
  s += streak(p, ang, -0.26, 0.070, 0.24, 1.8, 1.0, 0.0);
  s += streak(p, ang + 0.03, -0.10, 0.045, 0.22, 2.2, 1.0, 1.7);
  s += streak(p, ang + 0.06, 0.06, 0.080, 0.10, 2.6, 1.0, 3.1);
  s += streak(p, ang - 0.03, 0.24, 0.060, 0.06, 2.0, 1.0, 4.4);
  s += streak(p, ang + 0.02, 0.44, 0.100, 0.04, 3.0, 1.0, 5.2);

  // --- thin curved light lines ---
  float l = 0.0;
  vec2 X = vec2(-0.20 * uAspect, -0.10);   // crossing point ≈ (30%, 60%)
  l += arc(p, X, 0.66, 3.2 + 0.6 * sin(uPhase + 0.4), 0.0075, 0.035, 0.20, 0.0);
  l += arc(p, X, 0.80, -3.6 + 0.8 * sin(uPhase + 2.1), 0.0065, 0.032, 0.17, 1.3);
  l += arc(p, X + vec2(0.16, 0.02), 0.58, 2.4 + 0.4 * cos(uPhase + 1.0), 0.006, 0.03, 0.13, 2.6);
  l += arc(p, X + vec2(0.34, 0.22), 0.86, -2.2 + 0.3 * sin(uPhase + 5.0), 0.006, 0.03, 0.10, 3.4);
  l += arc(p, X + vec2(0.55, 0.06), 0.64, -6.0 + 0.7 * cos(uPhase + 3.3), 0.006, 0.03, 0.09, 4.0);

  // light is added (screen-like) in linear light, weighted toward the glow
  float lit = 0.3 + 0.7 * smoothstep(0.0, 0.8, t);
  col += uStreak * (s + l) * lit;

  // to display
  col += uEdge * 0.25 * smoothstep(0.2, -0.6, p.x) * smoothstep(-0.1, 0.5, p.y);
  float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(lum), col, 0.9);
  col = clamp(col, 0.0, 1.0);
  outColor = vec4(finish(linearToSrgb(col)), 1.0);
}`;

export const createSoftLight = (params: SoftLightParams) => (): Look => {
  const pass = new FullscreenPass();
  const fin = finishUniforms();
  const mat = rawMaterial(FRAG, {
    uEdge: { value: lin(params.edge) },
    uGlow: { value: lin(params.glow) },
    uStreak: { value: lin(params.streak) },
    uPhase: { value: 0 },
    uAspect: { value: 16 / 9 },
    ...fin,
  });
  return {
    render(renderer: WebGLRenderer, frame: number, w: number, h: number) {
      const f = ((frame % 600) + 600) % 600;
      mat.uniforms.uPhase.value = (Math.PI * 2 * f) / 600;
      mat.uniforms.uAspect.value = w / h;
      setFinishUniforms(mat.uniforms as never, frame, 600, 0.02, true);
      pass.render(renderer, mat, null);
    },
    dispose() {
      mat.dispose();
    },
  };
};

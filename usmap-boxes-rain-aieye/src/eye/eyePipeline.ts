import * as THREE from "three";
import { srgb } from "../lib/color";
import { FullscreenPass } from "../lib/post";
import { motionFrame, wrapFrame } from "../lib/loop";
import { FramePipeline } from "../lib/ThreeStage";
import { buildEyeTextTexture, EYE_COLUMNS, STRIP_HEIGHT_FRAC } from "./textTexture";

export interface EyePalette {
  bgTop: string;
  bgBottom: string;
  scleraCenter: string;
  scleraEdge: string;
  dots: string;
  ring: string;
  rim: string;
}

const LOOP = 600;
const BLINK_FRAME = 330; // 11s
const BLINK_FRAMES = 8;

const col = srgb;

const FRAG = /* glsl */ `
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uText;
uniform float uFrame;      // frame % 600
uniform float uLoopPhase;  // frame / 600 (0..1)
uniform float uLid;        // 1 open .. 0 closed
uniform vec3 uBgTop, uBgBottom, uScleraC, uScleraE, uDots, uRing, uRim;
uniform float uColumns, uStripFrac;

const vec2 RES = vec2(3840.0, 2160.0);
const vec2 C = vec2(1920.0, 1080.0);
const float EA = 614.4;   // eye half-width  (32% of width / 2)
const float EB = 270.0;   // eye half-height (25% of height / 2; taller than the brief's 14% to match the reference)
const float AO = 800.0;   // lens outer half-width (diamond)
const float BO = 1500.0;  // lens outer half-height (diamond, beyond the frame)
const float TAU = 6.28318530718;

// Radius of the almond outline |y| = b (1 - (x/a)^2) along direction (c, s).
float almondR(float c, float s, float b) {
  float A = b * c * c / (EA * EA);
  float as = abs(s);
  return 2.0 * b / (as + sqrt(as * as + 4.0 * A * b));
}

vec3 sampleText(vec2 q, vec2 dqdx, vec2 dqdy) {
  float colW = RES.x / uColumns;
  float stripH = RES.y * uStripFrac;
  float ci = floor(q.x / colW);
  float dir = mod(ci, 2.0) < 0.5 ? -1.0 : 1.0; // even down, odd up
  float phase = fract(sin(ci * 12.9898) * 43758.5453);
  float yTop = RES.y - q.y;
  float v = (yTop + dir * stripH * uLoopPhase) / stripH + phase;
  vec2 uv = vec2(q.x / RES.x, fract(v));
  vec2 gx = vec2(dqdx.x / RES.x, -dqdx.y / stripH);
  vec2 gy = vec2(dqdy.x / RES.x, -dqdy.y / stripH);
  vec4 t = textureGrad(uText, uv, gx, gy);
  return vec3(t.rgb * t.a);
}

void main() {
  vec2 p = vUv * RES;
  vec2 d = p - C;
  float r = length(d);
  vec2 dir = r > 1e-4 ? d / r : vec2(1.0, 0.0);
  float rIn = almondR(dir.x, dir.y, EB);
  float rOut = 1.0 / (abs(dir.x) / AO + abs(dir.y) / BO);

  // Background.
  vec3 bg = mix(uBgBottom, uBgTop, vUv.y);
  // Dark top and bottom, a blue glow band across the middle.
  float band = exp(-pow((vUv.y - 0.48) / 0.32, 2.0));
  bg = bg * (0.25 + 0.75 * band) + vec3(0.07, 0.12, 0.24) * band * 0.85;
  bg *= 1.0 - 0.25 * smoothstep(0.3, 0.75, abs(vUv.x - 0.5));

  // Lens warp: everything inside the outer contour is squeezed outward into the
  // annulus between the eye outline and the outer contour.
  vec2 q = p;
  float lensT = 1.0;
  if (r < rOut) {
    float t = clamp((r - rIn) / (rOut - rIn), 0.0, 1.0);
    // Push the columns outward around the eye: source radius r - rIn (1 - t)^2.
    // Continuous with the unwarped text at the outer contour (value and slope).
    float src = r - rIn * (1.0 - t) * (1.0 - t);
    q = C + dir * max(src, 0.0);
    lensT = t;
  }
  vec3 text = sampleText(q, dFdx(q), dFdy(q));
  // Text squeezed against the rim reads slightly brighter, like the reference.
  text *= 0.85 + 0.15 * smoothstep(0.0, 0.3, lensT);
  vec3 colr = bg + text * (1.0 - 0.15 * (1.0 - lensT));

  // Soft glow around the eye.
  float e = r / rIn;                  // 1 on the outline
  float aaw = 2.0 / rIn;              // ~2px in normalized units
  float halo = exp(-max(e - 1.0, 0.0) * 9.0);
  colr += uRim * 0.10 * halo * step(1.0, e);

  // ---- Eye ----
  float rOpen = almondR(dir.x, dir.y, EB * max(uLid, 0.001));
  float eOpen = r / rOpen;
  if (e < 1.0 + aaw) {
    // Sclera on a virtual eyeball.
    float R = EA * 1.08;
    vec2 g = vec2(sin(TAU * uLoopPhase), sin(TAU * 2.0 * uLoopPhase + 0.9));
    vec2 gaze = vec2(0.12 * EA, 0.08 * EB) * g;
    float z = sqrt(max(R * R - dot(d, d), 1.0));
    vec3 n = vec3(d, z) / R;
    float ee = clamp(e, 0.0, 1.0);
    vec3 sclera = mix(uScleraC, uScleraE, smoothstep(0.15, 1.0, ee));
    sclera *= 0.92 + 0.08 * n.z;
    // Data dots on a lat/long grid that turns with the gaze.
    // Data dots on rays radiating from the iris.
    vec2 rp = d - gaze;
    float ang = atan(rp.y, rp.x);
    float rad = length(rp);
    float lr = log(max(rad, 1.0));
    vec2 cell = vec2(ang / (6.28318530718 / 48.0), lr / 0.12);
    vec2 cf = fract(cell) - 0.5;
    float dots = 1.0 - smoothstep(0.14, 0.26, length(cf * vec2(1.0, 0.55)));
    float near = smoothstep(EA * 0.95, 120.0, rad);
    sclera = mix(sclera, uDots, dots * (0.45 + 0.5 * near) * smoothstep(1.0, 0.8, ee));
    // Inner shadow at the lids.
    sclera *= 1.0 - 0.35 * smoothstep(0.7, 1.0, ee);

    // Iris / lens disc.
    float dil = 1.0 + 0.1 * sin(TAU * 3.0 * uLoopPhase);
    float ir = 112.0 * dil;
    vec2 pd = d - gaze;
    // Foreshorten the disc along the gaze direction.
    float gl = length(gaze);
    vec2 gd = gl > 1e-3 ? gaze / gl : vec2(1.0, 0.0);
    float fs = cos(asin(clamp(gl / R, 0.0, 0.95)));
    vec2 pl = vec2(dot(pd, gd) / fs, dot(pd, vec2(-gd.y, gd.x)));
    float pr = length(pl) / ir;
    vec3 iris = vec3(0.0);
    iris = mix(vec3(0.20, 0.22, 0.25), vec3(0.015, 0.018, 0.025), smoothstep(1.0, 0.82, pr)); // outer barrel ring
    iris += uRing * 0.16 * exp(-pow((pr - 0.62) / 0.06, 2.0));                             // blue reflection ring
    iris += vec3(0.05) * exp(-pow((pr - 0.86) / 0.03, 2.0));
    vec2 hl = pl / ir - vec2(-0.28, 0.30);
    iris += vec3(0.9, 0.95, 1.0) * 0.6 * exp(-dot(hl, hl) / 0.003);                            // small highlight
    iris += vec3(0.6, 0.75, 1.0) * 0.25 * exp(-dot(hl + vec2(0.5, -0.5), hl + vec2(0.5, -0.5)) / 0.01);
    float irisA = 1.0 - smoothstep(1.0 - 1.5 / ir, 1.0 + 1.5 / ir, pr);
    vec3 eyeCol = mix(sclera, iris, irisA);
    // Iris casts a soft shadow on the sclera.
    eyeCol *= 1.0 - 0.6 * exp(-max(pr - 1.0, 0.0) * 1.6) * (1.0 - irisA); // soft dark iris halo

    // Lids: closed region is dark skin-free void (reads as the eye narrowing to a line).
    float lidCover = smoothstep(1.0 - aaw, 1.0 + aaw, eOpen);
    vec3 lidCol = mix(uBgBottom * 0.6, uRim * 0.25, exp(-abs(d.y) / 18.0) * (1.0 - uLid));
    eyeCol = mix(eyeCol, lidCol, lidCover);
    // Bright rim along the outline.
    float rimLine = 0.4 * exp(-pow((e - 1.0) * rIn / 9.0, 2.0)) + 0.6 * exp(-pow((eOpen - 1.0) * rOpen / 4.0, 2.0)) * (1.0 - step(0.999, uLid));
    float inside = 1.0 - smoothstep(1.0 - aaw, 1.0 + aaw, e);
    colr = mix(colr, eyeCol, inside);
    colr += uRim * 0.3 * rimLine;
  }

  colr = grainDither(colr, gl_FragCoord.xy, uFrame, 0.015);
  outColor = vec4(colr, 1.0);
}
`;

export const createEyePipeline =
  (palette: EyePalette) =>
  (renderer: THREE.WebGLRenderer, bw: number, bh: number): FramePipeline => {
    const text = buildEyeTextTexture(bw, bh);
    const pass = new FullscreenPass(FRAG, {
      uText: { value: text },
      uFrame: { value: 0 },
      uLoopPhase: { value: 0 },
      uLid: { value: 1 },
      uBgTop: { value: col(palette.bgTop) },
      uBgBottom: { value: col(palette.bgBottom) },
      uScleraC: { value: col(palette.scleraCenter) },
      uScleraE: { value: col(palette.scleraEdge) },
      uDots: { value: col(palette.dots) },
      uRing: { value: col(palette.ring) },
      uRim: { value: col(palette.rim) },
      uColumns: { value: EYE_COLUMNS },
      uStripFrac: { value: STRIP_HEIGHT_FRAC },
    });
    return {
      render: (frame) => {
        const f = wrapFrame(frame, LOOP);
        const u = pass.uniforms;
        u.uFrame.value = f;
        u.uLoopPhase.value = motionFrame(frame, LOOP) / LOOP;
        const bt = (f - BLINK_FRAME) / BLINK_FRAMES;
        u.uLid.value = bt > 0 && bt < 1 ? 1 - Math.sin(Math.PI * bt) : 1;
        pass.render(renderer, null);
      },
    };
  };

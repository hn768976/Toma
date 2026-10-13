import * as THREE from "three";
import { LOOP, TAU } from "../common/constants";
import { FRAG_OUT, GLSL_HASH } from "../common/glsl";
import { GLSL_SNOISE } from "../common/noise";
import type { World } from "../common/world";

/**
 * Look 4 - Topo Lines. One full-screen fragment shader on a three.js plane.
 * The height field is 4D simplex fBm sampled with time on a circle
 * (theta = 2*pi*t/600), so it morphs and loops exactly.
 */
export type TopoParams = {
  line: string;
  glow: string;
  sparkle: string;
};

const frag = /* glsl */ `
${GLSL_HASH}
${GLSL_SNOISE}
uniform vec2 res;
uniform float pxScale;
uniform float theta;   // 2*pi*t/600
uniform float tf;      // t / 600 in [0,1)
uniform vec3 lineCol, glowCol, sparkCol;
in vec2 vUv;

const float LEVELS = 17.0;      // contour lines per unit of height
const float R = 0.42;          // radius of the time circle in noise space

float field(vec2 p) {
  vec2 tc = vec2(cos(theta), sin(theta)) * R;
  float s = 0.0;
  float a = 0.6;
  vec4 q = vec4(p, tc);
  for (int i = 0; i < 4; i++) {
    s += a * snoise(q);
    q = vec4(q.xy * 1.93 + vec2(17.1, -9.7), q.zw * 1.6 + vec2(3.3, 7.9));
    a *= 0.26;
  }
  return s;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  // Normalised coordinates: height of frame = 1.0 (aspect-correct).
  vec2 p = (frag - 0.5 * res) / res.y;
  vec2 fp = p * 0.72 + vec2(0.31, -0.17);

  // gentle slope keeps contours flowing and evenly spread (fewer voids)
  float h = field(fp) + dot(fp, vec2(0.32, 0.5)) * 0.55;
  float v = h * LEVELS;
  // screen-space gradient of the level value (value per real pixel)
  vec2 gv = vec2(dFdx(v), dFdy(v));
  float g = max(length(gv), 1e-6);
  float lvl = floor(v + 0.5);
  float dv = v - lvl;                 // signed distance to nearest level, value units
  float dpx = abs(dv) / g;            // ... in real pixels
  float d720 = dpx / pxScale;         // ... in 720p pixels

  // slow brightness variation along the lines
  vec2 tc = vec2(cos(theta), sin(theta)) * 0.3;
  float bn = snoise(vec4(fp * 0.85 + vec2(5.2, 1.3), tc + vec2(11.0, 0.0)));
  float bright = clamp(0.62 + 0.5 * bn, 0.2, 1.2);
  bright += 3.0 * smoothstep(0.12, 0.55, bn);          // occasional white-hot segments

  // anti-aliased core: ~2 px wide at 720p, 1 real-pixel AA ramp
  float halfW = (0.8 + 0.3 * min(bright, 1.8)) * pxScale;
  float core = clamp(halfW + 0.5 - dpx, 0.0, 1.0);
  // soft glow from a wider, fainter falloff (720p px)
  float glow = exp(-d720 / 2.4) * 0.34 + exp(-d720 / 9.0) * 0.08;
  // fade where the gradient collapses (peaks/saddles: width would blow up)
  float gfade = smoothstep(0.002, 0.012, g / pxScale);

  // --- sparkles travelling along the lines ---
  // phase field: a second smooth noise; along a contour it varies, so
  // fract(phase - k*t) marks beads that slide along the line.
  float ph = snoise(vec3(fp * 0.9 + vec2(-4.0, 8.0), lvl * 0.37)) * 26.0
           + dot(fp, vec2(2.1, -1.3)) * 22.0;
  vec2 gp = vec2(dFdx(ph), dFdy(ph));
  vec2 tang = vec2(-gv.y, gv.x) / g;
  float along = max(abs(dot(gp, tang)), 1e-4);      // phase per real px along line
  float bead = ph - tf * 6.0;                        // 6 whole cycles per loop
  float bi = floor(bead + 0.5);
  float sPx = abs(bead - bi) / along / pxScale;      // 720p px along the line
  float r1 = hash3u(uvec3(ivec3(int(bi) + 50000, int(lvl) + 50000, 7))).x;
  float r2 = hash3u(uvec3(ivec3(int(bi) + 50000, int(lvl) + 50000, 11))).x;
  // twinkle: smooth periodic, integer cycles per loop
  float tw = 0.5 + 0.5 * sin(TAU_ * (tf * floor(2.0 + r2 * 5.0) + r1));
  float beadAmp = mix(0.5, 1.1, r1) * (0.5 + 0.5 * tw);
  float dot0 = exp(-(sPx * sPx + d720 * d720) / 1.4);
  // a few bigger star glints: cross-shaped flare in line-local axes
  float big = step(0.965, r1) * tw * tw;
  float star = big * (exp(-d720 / 0.9) * exp(-sPx * sPx / 30.0) + exp(-sPx / 0.9) * exp(-d720 * d720 / 30.0)) * 0.9
             + big * exp(-(sPx * sPx + d720 * d720) / 6.0) * 0.8;
  float spacing = 1.0 / along / pxScale;               // 720p px between beads
  float spark = (dot0 * beadAmp * 1.4 + star) * gfade * smoothstep(5.0, 14.0, spacing) * (0.5 + 0.5 * bright);

  vec3 col = lineCol * core * bright * gfade
           + glowCol * glow * bright * gfade
           + sparkCol * spark;
  gl_FragColor = vec4(col, 1.0);
}
`;

export const makeTopo =
  (params: TopoParams) =>
  (): World => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 16 / 9, 0.1, 10);
    const uniforms = {
      res: { value: new THREE.Vector2(1280, 720) },
      pxScale: { value: 1 },
      theta: { value: 0 },
      tf: { value: 0 },
      lineCol: { value: new THREE.Color(params.line) },
      glowCol: { value: new THREE.Color(params.glow) },
      sparkCol: { value: new THREE.Color(params.sparkle) },
    };
    const material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */ `out vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `${FRAG_OUT}\n#define TAU_ 6.28318530718\n${frag}`,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    scene.add(mesh);

    return {
      scene,
      overlay: null,
      camera,
      post: {
        dof: null,
        bloom: {
          strength: 0.8,
          threshold: 0.5,
          knee: 0.3,
          weights: [1.0, 0.8, 0.55, 0.35, 0.2, 0.1],
        },
        exposure: 1,
        aces: false,
        grain: 0.015,
        grainLumaFade: 0.03,
        msaa: 0,
      },
      update(t, pxScale) {
        uniforms.theta.value = (TAU * t) / LOOP;
        uniforms.tf.value = t / LOOP;
        uniforms.pxScale.value = pxScale;
        uniforms.res.value.set(720 * pxScale * (16 / 9), 720 * pxScale);
      },
    };
  };

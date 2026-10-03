import React, { useCallback, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { BICUBIC } from "../glsl/bicubic";
import { NOISE4 } from "../glsl/noise4";
import { LookCanvas } from "../lib/LookCanvas";
import { ASPECT, loopPhase } from "../lib/constants";
import { PostConfig } from "../lib/post";
import { PrismRow } from "../versions";

/**
 * Look 2 — Prism Light Leaks. A full-screen fragment shader:
 * domain-warped 4D simplex noise shapes soft streaks fanning up from below the
 * frame; thin filaments are sampled at six angular offsets weighted by a
 * spectrum (a finer version of an R/G/B three-offset split) to give rainbow
 * fringes. Time enters only as a circle: noise(p, cos(2πt)·r, sin(2πt)·r),
 * t = frame / 600, so frame 600 == frame 0.
 *
 * The leak field is very soft, so it is evaluated at reduced resolution
 * (height clamp(H/2, 360, 720)) and upsampled with a B-spline bicubic read;
 * bloom, grain and dither run at full output resolution.
 */

const LEAK_FRAG = /* glsl */ `
uniform float phase;
uniform float aspect;
uniform vec3 cShadow, cBody, cAccent, cHigh, cBg;
uniform float fringe, fringeWidth, warmth;
varying vec2 vUv;
${NOISE4}

float fbm2(vec4 p) {
  return 0.66 * snoise(p) + 0.34 * snoise(p * vec4(2.07, 2.07, 1.0, 1.0) + vec4(5.2, 1.3, 0.0, 0.0));
}
float fbm3(vec4 p) {
  float s = 0.0, a = 0.55;
  for (int i = 0; i < 3; i++) {
    s += a * snoise(p);
    p = p * vec4(2.03, 2.03, 1.0, 1.0) + vec4(3.7, 9.1, 0.0, 0.0);
    a *= 0.48;
  }
  return s;
}

void main() {
  vec2 p = vec2((vUv.x - 0.5) * aspect, vUv.y - 0.5);
  float T = 6.28318530718 * phase;
  vec2 tc = vec2(cos(T), sin(T));

  // fan origin below the frame, swaying on a closed path
  vec2 O = vec2(0.04 * sin(T), -1.45 + 0.05 * cos(T));
  vec2 d = p - O;
  float th = atan(d.x, d.y);       // 0 = straight up
  float rho = length(d);

  // domain warp (bends the streaks a little, keeps them organic)
  float wq = fbm2(vec4(th * 1.1, rho * 0.9, tc * 0.55));
  float thw = th + 0.045 * wq + 0.015 * sin(T + rho * 1.7);

  // broad light envelope: big soft areas of light and big dark areas
  float env = fbm2(vec4(th * 1.05 + 3.1, rho * 0.6, tc * 0.42 + vec2(7.0, 2.0)));
  float E = smoothstep(-0.35, 0.5, env);

  // soft streak body, long along the rays
  float b = 0.5 + 0.5 * fbm3(vec4(thw * 4.2, rho * 0.3, tc * 0.75 + vec2(1.0, 4.0)));
  b = smoothstep(0.22, 0.95, b);
  float L = E * (0.3 + 0.7 * b);
  L *= smoothstep(0.75, 1.2, rho);
  L *= 1.0 - 0.75 * smoothstep(0.3, 0.8, abs(p.x));
  // brightest toward the top centre, sides fall off
  L *= 0.55 + 0.6 * smoothstep(-0.45, 0.4, p.y) * (1.0 - 0.45 * smoothstep(0.35, 0.95, abs(p.x)));

  vec3 col = mix(cShadow, cBody, smoothstep(0.0, 0.45, L));
  col = mix(col, cAccent, smoothstep(0.4, 0.8, L));
  col = mix(col, cHigh, smoothstep(0.75, 1.1, L));
  col *= L * L * 1.9 + L * 0.3;
  // broad, soft colour washes (prism dispersion at large scale)
  float hueN = snoise(vec4(thw * 3.0 + 2.0, rho * 0.8 + 7.0, tc * 0.35 + vec2(31.0, 9.0)));
  vec3 wash = 0.5 + 0.5 * cos(6.2831853 * (hueN * 0.55 + vec3(0.0, 0.33, 0.67) + 0.08 * warmth));
  col *= mix(vec3(1.0), wash * 1.35, 0.62);
  // diffuse veil of light under the streaks
  col += cBody * E * E * 0.05;
  // a thin, brighter core ray near the centre
  col += mix(cAccent, vec3(0.4, 0.9, 1.0), 0.6 - 0.6 * warmth) * exp(-abs(thw - 0.03 * sin(T)) * 70.0) * 0.5 * smoothstep(1.0, 1.4, rho);

  // thin filaments split into a spectrum (rainbow fringes on their edges)
  vec3 coolSpec[6] = vec3[6](vec3(0.55, 0.0, 1.0), vec3(0.0, 0.35, 1.0), vec3(0.0, 0.95, 0.9),
                             vec3(0.25, 1.0, 0.1), vec3(1.0, 0.85, 0.0), vec3(1.0, 0.12, 0.0));
  vec3 warmSpec[6] = vec3[6](vec3(0.95, 0.25, 0.75), vec3(1.0, 0.2, 0.05), vec3(1.0, 0.55, 0.0),
                             vec3(1.0, 0.92, 0.25), vec3(0.55, 1.0, 0.3), vec3(0.35, 0.75, 1.0));
  float E2 = smoothstep(-0.2, 0.5, env + 0.3 * b - 0.1);
  vec3 rain = vec3(0.0);
  vec3 norm = vec3(0.0);
  float filC = 0.0;
  for (int k = 0; k < 6; k++) {
    float off = (float(k) - 2.5) * 0.011 * fringeWidth * (0.5 + 0.6 * rho);
    float n = fbm2(vec4((thw + off) * 4.0 + 11.0, rho * 0.28, tc * 0.7 + vec2(13.0, 5.0)));
    float f = exp(-abs(n) * 5.0);
    vec3 sp = mix(coolSpec[k], warmSpec[k], warmth);
    rain += sp * f;
    norm += sp;
    filC += f;
  }
  rain = rain / norm;
  filC /= 6.0;
  vec3 tint = mix(vec3(1.0), cAccent / max(max(cAccent.r, cAccent.g), cAccent.b), 0.5);
  col += (filC * tint * 0.3 + (rain - filC) * 0.5) * fringe * E2 * smoothstep(0.85, 1.25, rho);

  // a few hot spots that bloom
  float hs = snoise(vec4(p * 0.9 + vec2(0.0, 0.3), tc * 0.5 + vec2(11.0, 3.0)));
  col += mix(cHigh, cAccent, 0.3) * pow(max(hs, 0.0), 2.5) * 3.0 * E;

  // near-black background with soft deep areas
  float bgN = 0.5 + 0.5 * snoise(vec4(p * 0.8 + 4.0, tc * 0.3 + vec2(20.0, 1.0)));
  col += cBg * (0.25 + 0.75 * smoothstep(0.25, 0.85, bgN)) * 0.55;

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}`;

const SHOW_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const SHOW_FRAG = /* glsl */ `
uniform sampler2D tLeak;
uniform vec2 leakSize;
varying vec2 vUv;
${BICUBIC}
void main() { gl_FragColor = vec4(textureBicubic(tLeak, vUv, leakSize).rgb, 1.0); }`;

const lin = (hex: string) => new THREE.Color(hex); // THREE.Color parses sRGB hex to linear

const POST: PostConfig = {
  exposure: 1.0,
  bloom: { strength: 0.32, threshold: 0.75, knee: 0.6, spread: 0.92 },
  vignette: 0.25,
  grain: 0.03,
  msaa: 0,
};

const fullTri = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  return g;
};

export const PrismLeaks: React.FC<{ row: PrismRow }> = ({ row }) => {
  const frame = useCurrentFrame();

  const leak = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: SHOW_VERT,
      fragmentShader: LEAK_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        phase: { value: 0 },
        aspect: { value: ASPECT },
        cShadow: { value: lin(row.shadow) },
        cBody: { value: lin(row.body) },
        cAccent: { value: lin(row.accent) },
        cHigh: { value: lin(row.highlight) },
        cBg: { value: lin(row.bgDeep) },
        fringe: { value: row.fringe },
        fringeWidth: { value: row.fringeWidth },
        warmth: { value: row.fringeWarmth },
      },
    });
    const scene = new THREE.Scene();
    const mesh = new THREE.Mesh(fullTri(), mat);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return { mat, scene, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), rt: null as THREE.WebGLRenderTarget | null };
  }, [row]);

  const show = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      vertexShader: SHOW_VERT,
      fragmentShader: SHOW_FRAG,
      depthTest: false,
      depthWrite: false,
      uniforms: { tLeak: { value: null }, leakSize: { value: new THREE.Vector2(1, 1) } },
    });
    const mesh = new THREE.Mesh(fullTri(), mat);
    mesh.frustumCulled = false;
    return { mat, mesh };
  }, []);

  const camera = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);

  leak.mat.uniforms.phase.value = loopPhase(frame);

  const before = useCallback(
    (gl: THREE.WebGLRenderer) => {
      const size = gl.getDrawingBufferSize(new THREE.Vector2());
      const h = Math.round(Math.min(720, Math.max(360, size.y / 2)));
      const w = Math.round(h * ASPECT);
      if (!leak.rt || leak.rt.height !== h) {
        leak.rt?.dispose();
        leak.rt = new THREE.WebGLRenderTarget(w, h, {
          type: THREE.HalfFloatType,
          depthBuffer: false,
          minFilter: THREE.LinearFilter,
          magFilter: THREE.LinearFilter,
        });
      }
      gl.setRenderTarget(leak.rt);
      gl.render(leak.scene, leak.cam);
      show.mat.uniforms.tLeak.value = leak.rt.texture;
      show.mat.uniforms.leakSize.value.set(w, h);
    },
    [leak, show],
  );

  return (
    <LookCanvas post={POST} camera={camera} before={before}>
      <primitive object={show.mesh} />
    </LookCanvas>
  );
};

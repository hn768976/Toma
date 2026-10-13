import { useThree } from "@react-three/fiber";
import React, { useEffect, useMemo } from "react";
import * as THREE from "three";
import { BG_DITHER_GLSL } from "../common/glsl";
import { bgDitherOffset, Pipeline, sharedBlueNoise } from "../common/Pipeline";
import { SceneCanvas, TAU, useFrameRender } from "../common/SceneCanvas";

// Look 4 — Ribbed Dunes (20 s loop, 600 frames)

export type RibbedDunesProps = {
  surface: string; // lit surface colour
  shadow: string; // shadow-side colour
  highlight: string; // crest highlight
  skyTop: string;
  skyHorizon: string;
  keyStrength: number;
};

const LOOP = 600;

// Height field shared by the vertex (displacement) and fragment (normals)
// stages. Every time term is an integer number of cycles per loop.
const HEIGHT_GLSL = /* glsl */ `
uniform float uPhase; // 2π · (frame % 600) / 600
float dunes(vec2 p) {
  // gentle domain warp, periodic in time
  vec2 q = p + vec2(1.4 * sin(0.11 * p.y + uPhase), 1.1 * sin(0.09 * p.x - uPhase + 1.3));
  float h = 0.0;
  h += 0.85 * sin(dot(q, vec2(0.17, 0.22)) + uPhase + 0.4);
  h += 0.6 * sin(dot(q, vec2(-0.25, 0.15)) - uPhase + 2.1);
  h += 0.32 * sin(dot(q, vec2(0.33, -0.29)) + 2.0 * uPhase + 4.2);
  h += 0.16 * sin(dot(q, vec2(0.05, 0.5)) - 2.0 * uPhase + 1.0);
  return h;
}
// Ridge phase: fine parallel lines that bend with the dune flow.
const float RIDGE_K = 6.2831853 / 0.3; // 0.27 world units per ridge (~120 across the view)
float ridgePhase(vec2 p, float h) {
  vec2 dir = normalize(vec2(0.07, 1.0));
  float bend = 1.6 * sin(0.21 * p.x + 0.5) + 0.7 * sin(0.07 * p.y - 0.8 + uPhase);
  return RIDGE_K * (dot(p, dir) + bend + 0.55 * h);
}
// Rounded "tube" ridge profile in [0,1]; s in [-1,1] across one ridge.
float ridgeProfile(float ph) {
  float s = fract(ph / 6.2831853) * 2.0 - 1.0;
  return sqrt(max(1.0 - s * s, 0.0));
}
`;

const Scene: React.FC<RibbedDunesProps> = (p) => {
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);

  const built = useMemo(() => {
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 16 / 9, 0.2, 80);

    const skyUniforms = {
      uSkyTop: { value: new THREE.Color(p.skyTop) },
      uSkyHorizon: { value: new THREE.Color(p.skyHorizon) },
      uHorizonY: { value: 0.45 },
      uAspect: { value: 16 / 9 },
      uRes: { value: new THREE.Vector2(1280, 720) },
      uBlueNoise: { value: sharedBlueNoise },
      uBnOffset: { value: new THREE.Vector3() },
    };
    const SKY_GLSL = /* glsl */ `
      uniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform float uHorizonY;
      uniform float uAspect; uniform vec2 uRes;
      vec3 skyAt(vec2 uv) {
        float t = clamp((uv.y - uHorizonY) / (1.0 - uHorizonY), 0.0, 1.0);
        t = pow(t, 0.8);
        vec3 c = mix(uSkyHorizon, uSkyTop, t);
        // darker upper corners, like a soft studio cyclorama
        vec2 d = (uv - vec2(0.5, 0.42)) * vec2(uAspect, 1.0);
        float v = smoothstep(0.35, 1.3, length(d));
        c = mix(c, uSkyTop * 0.9, v * 0.6);
        return c;
      }
    `;

    const skyMat = new THREE.ShaderMaterial({
      depthWrite: false,
      depthTest: false,
      uniforms: skyUniforms,
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
      fragmentShader: /* glsl */ `
        ${BG_DITHER_GLSL}
        ${SKY_GLSL}
        varying vec2 vUv;
        void main() {
          vec3 c = skyAt(vUv);
          c += bgDither(gl_FragCoord.xy) * (1.0 / 1024.0);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
    sky.frustumCulled = false;
    sky.renderOrder = -10;
    scene.add(sky);

    const geo = new THREE.PlaneGeometry(48, 48, 480, 640);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -21);
    const duneMat = new THREE.ShaderMaterial({
      uniforms: {
        ...skyUniforms,
        uPhase: { value: 0 },
        uSurface: { value: new THREE.Color(p.surface) },
        uShadow: { value: new THREE.Color(p.shadow) },
        uHighlight: { value: new THREE.Color(p.highlight) },
        uKey: { value: p.keyStrength },
        uCamPos: { value: new THREE.Vector3() },
      },
      vertexShader: /* glsl */ `
        ${HEIGHT_GLSL}
        uniform vec3 uCamPos;
        varying vec3 vWorld;
        void main() {
          vec3 pos = position;
          float h = dunes(pos.xz);
          // ridges are carried by per-pixel normals (crisp, anti-aliased)
          pos.y += h;
          vWorld = pos;
          gl_Position = projectionMatrix * viewMatrix * vec4(pos, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        ${HEIGHT_GLSL}
        ${SKY_GLSL}
        uniform vec3 uSurface; uniform vec3 uShadow; uniform vec3 uHighlight;
        uniform float uKey; uniform vec3 uCamPos;
        varying vec3 vWorld;
        void main() {
          vec2 p = vWorld.xz;
          float e = 0.02;
          float h = dunes(p);
          vec2 g = vec2(dunes(p + vec2(e, 0.0)) - dunes(p - vec2(e, 0.0)),
                        dunes(p + vec2(0.0, e)) - dunes(p - vec2(0.0, e))) / (2.0 * e);
          // ridge slope (analytic in phase, chain rule via finite differences of phase)
          float ph = ridgePhase(p, h);
          vec2 gph = vec2(ridgePhase(p + vec2(e, 0.0), h + g.x * e) - ph,
                          ridgePhase(p + vec2(0.0, e), h + g.y * e) - ph) / e;
          float s = fract(ph / 6.2831853) * 2.0 - 1.0;
          float prof = sqrt(max(1.0 - s * s, 0.0));
          float dprof = -s / max(prof, 0.18);         // d(profile)/ds, clamped at the groove
          float A = 0.09;                              // ridge height in world units
          // anti-aliasing: fade ridges as they approach pixel frequency
          float fw = fwidth(ph);
          float aa = 1.0 - smoothstep(0.5, 1.4, fw);
          vec2 gr = A * dprof * (gph / 3.14159265) * aa;
          vec3 n = normalize(vec3(-(g.x + gr.x), 1.0, -(g.y + gr.y)));

          vec3 L = normalize(vec3(-0.75, 0.3, -0.6));
          float wrap = 0.18;
          float diff = clamp((dot(n, L) + wrap) / (1.0 + wrap), 0.0, 1.0);
          float sky = 0.5 + 0.5 * n.y;
          // groove occlusion keeps the line visible even when lit edge-on
          float groove = mix(1.0, smoothstep(0.0, 0.8, prof), 0.95 * aa);
          float lit = diff * uKey * groove;
          vec3 c = mix(uShadow, uSurface, 0.15 + 0.85 * clamp(lit, 0.0, 1.0));
          c = mix(c, uHighlight, pow(clamp(lit - 0.7, 0.0, 1.0) * 3.3, 2.0) * 0.8);
          c *= mix(0.9, 1.04, sky);
          vec3 V = normalize(uCamPos - vWorld);
          vec3 Hh = normalize(L + V);
          c += uHighlight * pow(max(dot(n, Hh), 0.0), 24.0) * 0.12 * aa;
          float d = length(vWorld - uCamPos);
          c = mix(c, uHighlight, (1.0 - smoothstep(3.0, 8.0, d)) * 0.5 * smoothstep(0.3, 1.0, lit));
          // fog into the sky colour at the same screen position
          float fog = smoothstep(20.0, 46.0, d) * 0.8;
          vec2 suv = gl_FragCoord.xy / uRes;
          c = mix(c, skyAt(vec2(suv.x, uHorizonY + 0.01)), fog);
          gl_FragColor = vec4(c, 1.0);
        }
      `,
    });
    const dunes = new THREE.Mesh(geo, duneMat);
    dunes.frustumCulled = false;
    scene.add(dunes);

    const pipeline = new Pipeline({
      period: LOOP,
      samples: 4,
      dof: { focus: 10, range: 4, maxBlur: 0.02, nearOnly: true },
            vignette: 0.25,
      vignetteColor: new THREE.Color(p.skyTop).multiplyScalar(0.85),
      grain: 0.015,
    });
    return { scene, camera, duneMat, skyMat, pipeline, skyUniforms };
  }, [gl, p.surface, p.shadow, p.highlight, p.skyTop, p.skyHorizon, p.keyStrength]);

  useEffect(() => () => built.pipeline.dispose(), [built]);

  useFrameRender((frame) => {
    const { scene, camera, duneMat, pipeline, skyUniforms } = built;
    const f = ((frame % LOOP) + LOOP) % LOOP;
    const ph = (f / LOOP) * TAU;
    camera.aspect = size.width / size.height;
    // low camera, slow closed sideways drift
    camera.position.set(1.2 * Math.sin(ph), 1.95 + 0.05 * Math.sin(2 * ph), 0);
    camera.rotation.set(0, 0, 0);
    camera.rotation.order = "YXZ";
    camera.rotation.y = 0.04 * Math.sin(ph + 0.7);
    camera.rotation.x = -0.035;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    // where the true horizon lands on screen: used by the sky gradient
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const horizonNdc = Math.tan(-camera.rotation.x) / tanHalf;
    skyUniforms.uHorizonY.value = 0.5 + 0.5 * horizonNdc;
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    skyUniforms.uRes.value.copy(buf);
    skyUniforms.uAspect.value = camera.aspect;
    skyUniforms.uBnOffset.value.copy(bgDitherOffset(frame, LOOP));
    duneMat.uniforms.uPhase.value = ph;
    duneMat.uniforms.uCamPos.value.copy(camera.position);
    pipeline.render(gl, scene, camera, frame);
  });
  return null;
};

export const RibbedDunes: React.FC<RibbedDunesProps> = (props) => (
  <SceneCanvas>
    <Scene {...props} />
  </SceneCanvas>
);

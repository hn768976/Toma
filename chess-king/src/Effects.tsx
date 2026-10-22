import { useFrame, useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { BokehPass } from "three/examples/jsm/postprocessing/BokehPass.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { kingY } from "./sim";

// Lens finish applied after tone mapping: vignette, faint chromatic fringe
// and film grain.
const LensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAspect: { value: 16 / 9 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAspect;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime * 17.0) * 43758.5453); }
    void main() {
      vec2 d = vUv - 0.5;
      float r = length(d * vec2(uAspect, 1.0));
      vec2 off = d * 0.0016;
      vec3 c;
      c.r = texture2D(tDiffuse, vUv + off).r;
      c.g = texture2D(tDiffuse, vUv).g;
      c.b = texture2D(tDiffuse, vUv - off).b;
      c *= mix(1.0, 0.55, smoothstep(0.45, 1.15, r));
      c += (hash(vUv * 1000.0) - 0.5) * 0.022;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export const Effects: React.FC<{ time: React.MutableRefObject<number> }> = ({ time }) => {
  const { gl, scene, camera, size } = useThree();

  const { composer, bokeh, lens } = useMemo(() => {
    const c = new EffectComposer(gl);
    c.renderTarget1.samples = 4;
    c.renderTarget2.samples = 4;
    c.addPass(new RenderPass(scene, camera));
    const b = new BokehPass(scene, camera, { focus: 8, aperture: 0.0011, maxblur: 0.0065 });
    c.addPass(b);
    c.addPass(new UnrealBloomPass(new THREE.Vector2(size.width, size.height), 0.22, 0.45, 1.1));
    c.addPass(new OutputPass());
    const l = new ShaderPass(LensShader);
    l.uniforms.uAspect.value = size.width / size.height;
    c.addPass(l);
    return { composer: c, bokeh: b, lens: l };
  }, [gl, scene, camera, size.width, size.height]);

  useLayoutEffect(() => {
    composer.setPixelRatio(gl.getPixelRatio());
    composer.setSize(size.width, size.height);
    return () => composer.dispose();
  }, [composer, gl, size.width, size.height]);

  useFrame(() => {
    const t = time.current;
    const focusPoint = new THREE.Vector3(0, kingY(t) + 1.2, 0);
    (bokeh.uniforms as Record<string, THREE.IUniform>).focus.value = camera.position.distanceTo(focusPoint);
    lens.uniforms.uTime.value = t;
    composer.render();
  }, 1);

  return null;
};

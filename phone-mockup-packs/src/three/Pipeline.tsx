import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useMemo, useRef } from "react";
import {
  HalfFloatType,
  LinearSRGBColorSpace,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
} from "three";

// Final pass: linear half-float scene -> sRGB, plus +-1/255 dither to stop the
// white floor, graphite gradient and black rim falloff from banding.
// Dither is masked out of every #00FF00 pixel (screens and green backgrounds),
// and out of pure black/white so those stay exact.
const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tScene;
uniform float uSeed;
varying vec2 vUv;

vec3 toSRGB(vec3 c) {
  vec3 lo = c * 12.92;
  vec3 hi = 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055;
  return mix(lo, hi, step(vec3(0.0031308), c));
}

// Integer hash (deterministic, no texture lookups).
float hash(vec2 p) {
  uvec2 q = uvec2(ivec2(p)) * uvec2(1597334673u, 3812015801u);
  uint n = (q.x ^ q.y) * 1597334673u;
  n ^= uint(uSeed) * 2654435761u;
  n = (n ^ (n >> 16u)) * 2246822519u;
  n ^= n >> 13u;
  return float(n) * (1.0 / 4294967295.0);
}

void main() {
  vec3 lin = clamp(texture2D(tScene, vUv).rgb, 0.0, 1.0);
  bool isKey = lin.g > 0.996 && lin.r < 0.0015 && lin.b < 0.0015;
  if (isKey) {
    gl_FragColor = vec4(0.0, 1.0, 0.0, 1.0);
    return;
  }
  vec3 c = toSRGB(lin);
  // Triangular-ish dither in [-1, 1] / 255.
  float d = (hash(gl_FragCoord.xy) + hash(gl_FragCoord.yx + 17.0) - 1.0) / 255.0;
  // Fade the dither out at the extremes so 0 and 255 stay exact.
  vec3 room = clamp(min(c, 1.0 - c) * 255.0, 0.0, 1.0);
  c += d * room;
  gl_FragColor = vec4(c, 1.0);
}
`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export const Pipeline: React.FC<{ frame: number }> = ({ frame }) => {
  const { gl } = useThree();
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const target = useMemo(
    () =>
      new WebGLRenderTarget(1, 1, {
        type: HalfFloatType,
        samples: 4,
        colorSpace: LinearSRGBColorSpace,
        depthBuffer: true,
      }),
    [],
  );

  const post = useMemo(() => {
    const material = new ShaderMaterial({
      uniforms: { tScene: { value: null }, uSeed: { value: 0 } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const mesh = new Mesh(new PlaneGeometry(2, 2), material);
    mesh.frustumCulled = false;
    const scene = new Scene();
    scene.add(mesh);
    return { scene, camera: new OrthographicCamera(-1, 1, 1, -1, 0, 1), material };
  }, []);

  useEffect(() => {
    return () => {
      target.dispose();
      post.material.dispose();
    };
  }, [target, post]);

  const size = useMemo(() => new Vector2(), []);

  // Priority 1 takes over R3F's render call. This only issues draw calls;
  // every visual value comes from useCurrentFrame() via props.
  useFrame((state) => {
    gl.getDrawingBufferSize(size);
    if (target.width !== size.x || target.height !== size.y) {
      target.setSize(size.x, size.y);
    }
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, true, true);
    gl.render(state.scene, state.camera);
    gl.setRenderTarget(null);
    post.material.uniforms.tScene.value = target.texture;
    post.material.uniforms.uSeed.value = frameRef.current;
    gl.render(post.scene, post.camera);
  }, 1);

  return null;
};

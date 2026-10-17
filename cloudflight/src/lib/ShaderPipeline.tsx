import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import {
  FULLSCREEN_VERT,
  GLSL_FINISH,
  GLSL_HASH,
  GLSL_HEADER,
} from "./glsl";
import { getBlueNoiseTexture } from "./textures";
import { renderDpr } from "./dpr";

export type Uniforms = Record<string, THREE.IUniform>;

type InnerProps = {
  fragment: string;
  uniforms: Uniforms;
  /** Sets uniforms from the frame. Called in a layout effect, before R3F renders. */
  update: (frame: number, size: { w: number; h: number }) => void;
  loopFrames: number | null;
  /** Optional GLSL applied to the linear colour before sRGB (grade/tonemap). */
  gradeGlsl?: string;
  /** 3x3 binomial filter before grading (raymarched scenes). */
  denoise?: boolean;
};

const FINAL_FRAG = (grade: string, denoise: boolean) => `${GLSL_HEADER}
uniform sampler2D uScene;
uniform vec2 uResolution;
${GLSL_HASH}
${GLSL_FINISH}
${grade}
out vec4 fragColor;
void main() {
  ivec2 ip = ivec2(gl_FragCoord.xy);
  vec3 c = texelFetch(uScene, ip, 0).rgb;
  ${
    denoise
      ? `// 3x3 binomial filter: removes per-pixel raymarch speckle.
  ivec2 mx = ivec2(uResolution) - 1;
  vec3 acc = c * 4.0;
  acc += 2.0 * texelFetch(uScene, clamp(ip + ivec2(1, 0), ivec2(0), mx), 0).rgb;
  acc += 2.0 * texelFetch(uScene, clamp(ip + ivec2(-1, 0), ivec2(0), mx), 0).rgb;
  acc += 2.0 * texelFetch(uScene, clamp(ip + ivec2(0, 1), ivec2(0), mx), 0).rgb;
  acc += 2.0 * texelFetch(uScene, clamp(ip + ivec2(0, -1), ivec2(0), mx), 0).rgb;
  acc += texelFetch(uScene, clamp(ip + ivec2(1, 1), ivec2(0), mx), 0).rgb;
  acc += texelFetch(uScene, clamp(ip + ivec2(-1, 1), ivec2(0), mx), 0).rgb;
  acc += texelFetch(uScene, clamp(ip + ivec2(1, -1), ivec2(0), mx), 0).rgb;
  acc += texelFetch(uScene, clamp(ip + ivec2(-1, -1), ivec2(0), mx), 0).rgb;
  c = acc / 16.0;`
      : ""
  }
  c = grade(c, gl_FragCoord.xy / uResolution);
  fragColor = vec4(finishSrgb(linearToSrgb(c), gl_FragCoord.xy, uFrame), 1.0);
}
`;

const DEFAULT_GRADE = /* glsl */ `vec3 grade(vec3 c, vec2 uv) { return c; }`;

const Inner: React.FC<InnerProps> = ({
  fragment,
  uniforms,
  update,
  loopFrames,
  gradeGlsl,
  denoise,
}) => {
  const frame = useCurrentFrame();
  const { gl, size } = useThree();
  const buf = useMemo(() => new THREE.Vector2(), []);
  gl.getDrawingBufferSize(buf);
  const w = buf.x;
  const h = buf.y;

  const tri = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3),
    );
    return g;
  }, []);
  const cam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), []);

  const target = useMemo(
    () =>
      new THREE.WebGLRenderTarget(w, h, {
        type: THREE.HalfFloatType,
        format: THREE.RGBAFormat,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        depthBuffer: false,
        generateMipmaps: false,
      }),
    [w, h],
  );

  const sceneMat = useMemo(() => {
    uniforms.uResolution = { value: new THREE.Vector2() };
    uniforms.uBlue = { value: getBlueNoiseTexture() };
    uniforms.uFrame = { value: 0 };
    return new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: fragment,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
  }, [fragment, uniforms]);

  const finalMat = useMemo(
    () =>
      new THREE.RawShaderMaterial({
        glslVersion: THREE.GLSL3,
        vertexShader: FULLSCREEN_VERT,
        fragmentShader: FINAL_FRAG(gradeGlsl ?? DEFAULT_GRADE, !!denoise),
        uniforms: {
          uScene: { value: null },
          uResolution: { value: new THREE.Vector2() },
          uBlue: { value: getBlueNoiseTexture() },
          uFrame: { value: 0 },
          uGrain: { value: 0.01 },
        },
        depthTest: false,
        depthWrite: false,
      }),
    [gradeGlsl, denoise],
  );

  const scenes = useMemo(() => {
    const a = new THREE.Scene();
    const ma = new THREE.Mesh(tri, sceneMat);
    ma.frustumCulled = false;
    a.add(ma);
    const b = new THREE.Scene();
    const mb = new THREE.Mesh(tri, finalMat);
    mb.frustumCulled = false;
    b.add(mb);
    return { a, b };
  }, [tri, sceneMat, finalMat]);

  const looped = loopFrames ? frame % loopFrames : frame;

  useLayoutEffect(() => {
    uniforms.uResolution.value.set(w, h);
    uniforms.uFrame.value = looped;
    finalMat.uniforms.uResolution.value.set(w, h);
    finalMat.uniforms.uFrame.value = looped;
    finalMat.uniforms.uScene.value = target.texture;
    update(looped, { w, h });
  }, [looped, w, h, uniforms, finalMat, target, update]);

  useMemo(() => {
    const ctx = gl.getContext();
    const ext = ctx.getExtension("WEBGL_debug_renderer_info");
    // eslint-disable-next-line no-console
    console.log(
      "[gl]",
      ext ? ctx.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ctx.getParameter(ctx.RENDERER),
      w,
      h,
    );
  }, [gl, w, h]);

  useFrame(() => {
    gl.autoClear = false;
    gl.setRenderTarget(target);
    gl.render(scenes.a, cam);
    gl.setRenderTarget(null);
    gl.render(scenes.b, cam);
  }, 1);

  void size;
  return null;
};

export const ShaderPipeline: React.FC<InnerProps> = (props) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={renderDpr()}
      gl={{ antialias: false, alpha: false, powerPreference: "high-performance" }}
      linear
      flat
    >
      <Inner {...props} />
    </ThreeCanvas>
  );
};

export const useStableUniforms = (make: () => Uniforms) => {
  const ref = useRef<Uniforms | null>(null);
  if (!ref.current) ref.current = make();
  return ref.current;
};

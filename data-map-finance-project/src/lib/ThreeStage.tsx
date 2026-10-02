import React, { useMemo } from "react";
import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import { getRemotionEnvironment, useCurrentFrame, useVideoConfig } from "remotion";
import { THREE, GLSL_HASH } from "./three-setup";

/**
 * Device pixel ratio for the WebGL canvas. In a render Remotion sets it to the
 * --scale value (0.5 -> 1080p, 1 -> 4K, 1.5625 -> 6000 px stills). In the
 * Studio cap it at 1 so a 4K composition stays responsive.
 */
const stageDpr = () => {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  return getRemotionEnvironment().isStudio ? Math.min(dpr, 1) : dpr;
};

export type PostOptions = {
  /** Film grain amplitude (fraction of full scale, e.g. 0.02). 0 = none. */
  grain: number;
  /** When true, pixels with no signal (exact black) get neither grain nor dither. */
  blackSafe: boolean;
  /** Loop length in frames: noise is seeded with frame % loop so it loops too. */
  loop?: number;
};

const POST_VERT = /* glsl */ `
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const POST_FRAG = /* glsl */ `
precision highp float;
precision highp int;
uniform sampler2D tex;
uniform float frame;
uniform float grain;
uniform float blackSafe;
in vec2 vUv;
out vec4 outColor;
${GLSL_HASH}
void main() {
  vec3 c = texture(tex, vUv).rgb;
  uvec3 p = uvec3(uint(gl_FragCoord.x), uint(gl_FragCoord.y), uint(frame));
  // Triangular-PDF dither, +-1/255.
  float d = (rnd3(p) + rnd3(p + uvec3(7919u, 104729u, 31u)) - 1.0) / 255.0;
  // Grain: fixed function of pixel position and frame, lighter in deep shadow.
  float g = (rnd3(p + uvec3(1543u, 3079u, 911u)) - 0.5) * 2.0 * grain;
  float luma = dot(c, vec3(0.2126, 0.7152, 0.0722));
  g *= 0.35 + 0.65 * smoothstep(0.0, 0.25, luma);
  vec3 n = vec3(d + g);
  if (blackSafe > 0.5) {
    float signal = max(c.r, max(c.g, c.b));
    n *= step(0.5 / 255.0, signal);
  }
  outColor = vec4(max(c + n, 0.0), 1.0);
}
`;

/**
 * Renders the scene into a half-float, 4x MSAA target, then one full-screen
 * pass adds dither + grain and quantises to 8 bit exactly once. No temporal
 * effects: the output depends on the current frame only.
 */
const PostPass: React.FC<PostOptions> = ({ grain, blackSafe, loop }) => {
  const frame = useCurrentFrame();
  const { gl, scene, camera } = useThree();
  const rt = useMemo(
    () =>
      new THREE.WebGLRenderTarget(1, 1, {
        type: THREE.HalfFloatType,
        samples: 4,
        depthBuffer: true,
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
      }),
    [],
  );
  const post = useMemo(() => {
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: POST_VERT,
      fragmentShader: POST_FRAG,
      uniforms: {
        tex: { value: null },
        frame: { value: 0 },
        grain: { value: 0 },
        blackSafe: { value: 0 },
      },
      depthTest: false,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
    mesh.frustumCulled = false;
    const s = new THREE.Scene();
    s.add(mesh);
    return { mat, scene: s, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1) };
  }, []);
  const size = useMemo(() => new THREE.Vector2(), []);

  useFrame(() => {
    gl.getDrawingBufferSize(size);
    if (rt.width !== size.x || rt.height !== size.y) rt.setSize(size.x, size.y);
    gl.setRenderTarget(rt);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, true, true);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    post.mat.uniforms.tex.value = rt.texture;
    post.mat.uniforms.frame.value = loop ? frame % loop : frame;
    post.mat.uniforms.grain.value = grain;
    post.mat.uniforms.blackSafe.value = blackSafe ? 1 : 0;
    gl.render(post.scene, post.cam);
  }, 1);
  return null;
};

/** Full-frame WebGL2 stage with the shared post pass. */
export const ThreeStage: React.FC<{ children: React.ReactNode; post: PostOptions }> = ({
  children,
  post,
}) => {
  const { width, height } = useVideoConfig();
  return (
    <ThreeCanvas
      width={width}
      height={height}
      dpr={stageDpr()}
      flat
      linear
      gl={{
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: true,
        powerPreference: "high-performance",
      }}
      camera={{ fov: 40, near: 0.1, far: 500, position: [0, 0, 30] }}
      style={{ position: "absolute", inset: 0, background: "#000" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.LinearSRGBColorSpace;
        gl.autoClear = false;
      }}
    >
      <PostPass {...post} />
      {children}
    </ThreeCanvas>
  );
};

import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import {
  createBackgroundPass,
  createBillboardLayer,
  createLineLayer,
  createSharedUniforms,
} from "../engine/layers";
import { createPost } from "../engine/post";
import { buildNetworkScene, FPS } from "./build";
import { NetworkPalette, PALETTE_ALT, PALETTE_REFERENCE } from "./palette";
import { networkShapes } from "./shapes";

const glsl3 = (c: readonly number[]) =>
  `vec3(${c.map((x) => x.toFixed(4)).join(", ")})`;

const SceneContent: React.FC<{ palette: NetworkPalette }> = ({ palette }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { camera, scene: r3fScene } = useThree();

  const built = useMemo(() => {
    const data = buildNetworkScene(palette);
    const uniforms = createSharedUniforms(width, height);
    uniforms.uAperture.value = 42;
    uniforms.uFogDist.value = 75;
    const group = new THREE.Group();
    group.add(createLineLayer(data.lines, uniforms));
    group.add(
      createBillboardLayer(
        data.billboards,
        networkShapes(palette.nodeHalo),
        uniforms,
      ),
    );
    const bgUniforms = { uTime: uniforms.uTime, uYaw: { value: 0 } };
    group.add(
      createBackgroundPass(
        /* glsl */ `
        uniform float uTime;
        uniform float uYaw;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a*n(p); p *= 2.03; a *= 0.5; } return v; }
        vec3 bg(vec2 uv){
          vec2 c = (uv - vec2(0.5, 0.52)) * vec2(1.7778, 1.0);
          float r = length(c);
          vec3 col = mix(${glsl3(palette.bgCenter)}, ${glsl3(palette.bgEdge)}, smoothstep(0.0, 0.95, r));
          float haze = fbm(c * 2.2 + vec2(uYaw * 0.6, uTime * 0.015));
          col += ${glsl3(palette.bgHaze)} * (haze - 0.45) * 0.35 * (1.0 - smoothstep(0.2, 1.0, r));
          return col;
        }`,
        bgUniforms,
      ),
    );
    const fade = { value: 1 };
    const post = createPost({
      width,
      height,
      threshold: 0.6,
      bloomA: 0.5,
      bloomB: 0.3,
      time: uniforms.uTime,
      gradeUniforms: { uFade: fade },
      gradeBody: /* glsl */ `
        uniform float uFade;
        vec3 grade(vec3 c, vec2 uv) {
          vec2 d = (uv - 0.5) * vec2(1.25, 1.0);
          float vig = 1.0 - smoothstep(0.35, 0.95, length(d)) * 0.6;
          return c * vig * uFade * 1.32;
        }`,
    });
    return { data, uniforms, group, bgUniforms, fade, post };
  }, [palette, width, height]);

  useLayoutEffect(() => {
    r3fScene.add(built.group);
    return () => {
      r3fScene.remove(built.group);
      built.post.dispose();
    };
  }, [r3fScene, built.group, built.post]);

  // Priority 1 takes over rendering from R3F: render through the HDR pipeline.
  useFrame((state) => {
    built.post.render(state.gl, state.scene, state.camera);
  }, 1);

  useLayoutEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const cf = built.data.camera[Math.min(frame, built.data.camera.length - 1)];
    cam.fov = built.data.fov;
    cam.near = 0.1;
    cam.far = 2000;
    cam.aspect = width / height;
    cam.position.copy(cf.pos);
    cam.quaternion.copy(cf.quat);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    const t = frame / FPS;
    built.uniforms.uTime.value = t;
    built.uniforms.uFocus.value = cf.focus;
    built.bgUniforms.uYaw.value = Math.atan2(cf.quat.y, cf.quat.w);
    // gentle fade-in from the dark opening frame, like the reference
    built.fade.value = 0.55 + 0.45 * Math.min(1, t / 0.8);
  }, [frame, built, camera, width, height]);

  return null;
};

export const NetworkPlexus: React.FC<{ variant: "v1" | "v2" }> = ({
  variant,
}) => {
  const { width, height } = useVideoConfig();
  const palette = variant === "v1" ? PALETTE_REFERENCE : PALETTE_ALT;
  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      <ThreeCanvas
        linear
        flat
        width={width}
        height={height}
        dpr={1}
        gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true }}
        camera={{ fov: 52, near: 0.1, far: 2000 }}
      >
        <SceneContent palette={palette} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

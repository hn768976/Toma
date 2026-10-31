import { ThreeCanvas } from "@remotion/three";
import { useFrame, useThree } from "@react-three/fiber";
import React, { useEffect, useLayoutEffect, useMemo, useState } from "react";
import * as THREE from "three";
import {
  AbsoluteFill,
  continueRender,
  delayRender,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  createBackgroundPass,
  createBillboardLayer,
  createLineLayer,
  createSharedUniforms,
} from "../engine/layers";
import { createPost } from "../engine/post";
import {
  buildCameraV2,
  buildMarketScene,
  FOV,
  FPS,
  GAIN_KEYS,
  GLOW_KEYS,
  keyed,
} from "./build";
import { MARKET_SHAPES } from "./shapes";
import { createTablePlane } from "./tablePlane";
import { FONT_FAMILY, makeTableTexture } from "./textures";

type Variant = "v1" | "v2";

const SceneContent: React.FC<{ variant: Variant }> = ({ variant }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const { camera, scene: r3fScene } = useThree();

  const built = useMemo(() => {
    const data = buildMarketScene();
    const camFrames = variant === "v1" ? data.cameraV1 : buildCameraV2();
    const fov = variant === "v1" ? FOV : 40;
    const uniforms = createSharedUniforms(width, height);
    uniforms.uAperture.value = 46;
    uniforms.uFogDist.value = 60;
    const extra = { ...uniforms, uFlareGain: { value: 1 } };
    const group = new THREE.Group();
    const textures = Array.from({ length: 6 }, (_, i) =>
      makeTableTexture(100 + i * 17, i === 5),
    );
    data.tables.forEach((t, i) =>
      group.add(
        createTablePlane({
          texture: textures[t.texIndex],
          width: t.width,
          height: t.height,
          position: t.pos,
          quaternion: t.quat,
          tint: t.tint,
          intensity: t.intensity,
          appear: t.appear,
          fadeOut: t.fadeOut,
          nearFade: t.nearFade,
          uniforms,
          seed: i,
        }),
      ),
    );
    group.add(createLineLayer(data.lines, uniforms));
    group.add(createBillboardLayer(data.billboards, MARKET_SHAPES, extra));

    const bgUniforms = {
      uTime: uniforms.uTime,
      uGlow: { value: 1 },
      uShift: { value: new THREE.Vector2() },
    };
    group.add(
      createBackgroundPass(
        /* glsl */ `
        uniform float uTime;
        uniform float uGlow;
        uniform vec2 uShift;
        float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
        vec3 bg(vec2 uv){
          vec2 c = (uv - vec2(0.5, 0.47) - uShift) * vec2(1.7778, 1.0);
          float r = length(c * vec2(0.75, 1.0));
          float core = exp(-r * r * 9.0);
          float wide = exp(-r * r * 2.2);
          float haze = n(c * 3.0 + vec2(uTime * 0.05, 0.0)) * 0.5 + n(c * 7.0 - uTime * 0.03) * 0.25;
          vec3 col = vec3(0.6, 0.125, 0.02) * core * 0.95 + vec3(0.24, 0.04, 0.0) * wide;
          col *= (0.8 + 0.4 * haze);
          return col * uGlow;
        }`,
        bgUniforms,
      ),
    );
    const post = createPost({
      width,
      height,
      threshold: 0.45,
      bloomA: 0.85,
      bloomB: 0.8,
      time: uniforms.uTime,
      gradeBody: /* glsl */ `
        vec3 grade(vec3 c, vec2 uv) {
          vec2 d = (uv - 0.5) * vec2(1.15, 1.0);
          float vig = 1.0 - smoothstep(0.28, 0.82, length(d)) * 0.93;
          c *= vig * 0.86;
          c.r *= 1.12;
          // Filmic highlight handling: red saturates softly and its excess
          // bleeds into green/blue, so hot areas burn orange -> warm white
          // instead of clipping to a flat red block.
          float ex = max(c.r - 0.7, 0.0);
          c.g += ex * 0.42;
          c.b += ex * 0.12;
          c.r = c.r < 0.7 ? c.r : 0.7 + 0.3 * (1.0 - exp(-ex / 0.3));
          vec3 k = vec3(0.8);
          vec3 over = max(c - k, 0.0);
          c = min(c, k) + 0.2 * (1.0 - exp(-over / 0.2));
          return c;
        }`,
    });
    return { camFrames, fov, uniforms, extra, group, bgUniforms, post };
  }, [variant, width, height]);

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
    const cf = built.camFrames[Math.min(frame, built.camFrames.length - 1)];
    cam.fov = built.fov;
    cam.near = 0.1;
    cam.far = 2000;
    cam.aspect = width / height;
    cam.position.copy(cf.pos);
    cam.quaternion.copy(cf.quat);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    const t = frame / FPS;
    const glow = keyed(GLOW_KEYS, t);
    built.uniforms.uTime.value = t;
    built.uniforms.uFocus.value = cf.focus;
    built.extra.uFlareGain.value = glow;
    built.uniforms.uGain.value = keyed(GAIN_KEYS, t);
    built.bgUniforms.uGlow.value = glow;
    built.bgUniforms.uShift.value.set(
      Math.sin(t * 0.4) * 0.03,
      Math.cos(t * 0.3) * 0.02,
    );
  }, [frame, built, camera, width, height]);

  return null;
};

export const MarketCrash: React.FC<{ variant: Variant }> = ({ variant }) => {
  const { width, height } = useVideoConfig();
  const [handle] = useState(() => delayRender("Loading fonts"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const faces = [
      new FontFace(
        FONT_FAMILY,
        `url(${staticFile("fonts/barlow-condensed-latin-500-normal.woff2")})`,
        { weight: "500" },
      ),
      new FontFace(
        FONT_FAMILY,
        `url(${staticFile("fonts/barlow-condensed-latin-600-normal.woff2")})`,
        { weight: "600" },
      ),
    ];
    Promise.all(faces.map((f) => f.load()))
      .then((loaded) => {
        loaded.forEach((f) => document.fonts.add(f));
        setReady(true);
        continueRender(handle);
      })
      .catch((err) => {
        console.error(err);
        throw err;
      });
  }, [handle]);

  return (
    <AbsoluteFill style={{ backgroundColor: "black" }}>
      {ready ? (
        <ThreeCanvas
          linear
          flat
          width={width}
          height={height}
          dpr={1}
          gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true }}
          camera={{ fov: FOV, near: 0.1, far: 2000 }}
        >
          <SceneContent variant={variant} />
        </ThreeCanvas>
      ) : null}
    </AbsoluteFill>
  );
};

import { useFrame, useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import { useEffect, useMemo, useRef } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { hexToLinear } from "../lib/color";
import { failOnShaderError } from "../lib/shaderErrors";
import { loopFrame, loopPhase } from "../lib/timing";
import { useRenderDpr } from "../vintage-map/VintageMap";
import { creamFragment, creamPostFragment, fullscreenVertex } from "./shaders";
import { CREAM_VERSIONS } from "./versions";

export type CreamSwirlProps = { version: string; loopCheck?: boolean };

// The surface is raymarched at a fraction of the output resolution (most of
// the frame is out of focus), then depth of field runs at full resolution.
export const CREAM_LOOK = {
  marchScale: 0.5,
  camPos: [0.22, -0.62, 2.3] as [number, number, number],
  camTarget: [0.22, 0.12, -0.2] as [number, number, number],
  fovDeg: 40,
  swirl: [0.4, -0.12, 0.95] as [number, number, number],
  exposure: 0.8,
  aperture: 0.018, // fraction of output width
  baseCoc: 0.0025, // soft focus everywhere, fraction of output width
  maxCoc: 0.02, // fraction of output width
  grain: 0.015,
};

export const CreamSwirl: React.FC<CreamSwirlProps> = ({ version }) => {
  const { width, height } = useVideoConfig();
  const dpr = useRenderDpr();
  return (
    <AbsoluteFill style={{ backgroundColor: "#eeeeee" }}>
      <ThreeCanvas
          onCreated={(state) => failOnShaderError(state.gl)} width={width} height={height} dpr={dpr} linear flat gl={{ antialias: false, alpha: false, preserveDrawingBuffer: true }}>
        <CreamScene version={version} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};

const fullscreen = () => {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  return g;
};

const CreamScene: React.FC<{ version: string }> = ({ version }) => {
  const frame = useCurrentFrame();
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const gl = useThree((s) => s.gl);
  const v = CREAM_VERSIONS[version];

  const res = useMemo(() => {
    const geometry = fullscreen();
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      format: THREE.RGBAFormat,
      generateMipmaps: true,
      minFilter: THREE.LinearMipmapLinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
    });
    const march = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVertex,
      fragmentShader: creamFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uResolution: { value: new THREE.Vector2() },
        uPhase: { value: 0 },
        uCamPos: { value: new THREE.Vector3(...CREAM_LOOK.camPos) },
        uCamTarget: { value: new THREE.Vector3(...CREAM_LOOK.camTarget) },
        uTanHalfFov: { value: Math.tan((CREAM_LOOK.fovDeg * Math.PI) / 360) },
        uBase: { value: new THREE.Vector3(...hexToLinear(v.base)) },
        uGlow: { value: new THREE.Vector3(...hexToLinear(v.glow)) },
        uSwirl: { value: new THREE.Vector3(...CREAM_LOOK.swirl) },
      },
    });
    const post = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: fullscreenVertex,
      fragmentShader: creamPostFragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uScene: { value: target.texture },
        uResolution: { value: new THREE.Vector2() },
        uFocusDepth: { value: 1 },
        uAperture: { value: 1 },
        uMaxCoc: { value: 1 },
        uBaseCoc: { value: 0 },
        uExposure: { value: CREAM_LOOK.exposure },
        uGrainFrame: { value: 0 },
        uGrainAmount: { value: CREAM_LOOK.grain },
      },
    });
    const marchScene = new THREE.Scene();
    const m1 = new THREE.Mesh(geometry, march);
    m1.frustumCulled = false;
    marchScene.add(m1);
    const postScene = new THREE.Scene();
    const m2 = new THREE.Mesh(geometry, post);
    m2.frustumCulled = false;
    postScene.add(m2);
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    return { geometry, target, march, post, marchScene, postScene, camera };
  }, [v]);

  useEffect(
    () => () => {
      res.geometry.dispose();
      res.target.dispose();
      res.march.dispose();
      res.post.dispose();
    },
    [res],
  );

  useFrame(() => {
    const f = frameRef.current;
    const buf = gl.getDrawingBufferSize(new THREE.Vector2());
    const mw = Math.max(2, Math.round(buf.x * CREAM_LOOK.marchScale));
    const mh = Math.max(2, Math.round(buf.y * CREAM_LOOK.marchScale));
    if (res.target.width !== mw || res.target.height !== mh) res.target.setSize(mw, mh);
    res.march.uniforms.uResolution.value.set(mw, mh);
    res.march.uniforms.uPhase.value = loopPhase(f);
    const p = res.post.uniforms;
    p.uResolution.value.set(buf.x, buf.y);
    // focus on the near rim of the swirl
    const cam = new THREE.Vector3(...CREAM_LOOK.camPos);
    // focus on the inner rim, upper right of the swirl
    const rim = new THREE.Vector3(CREAM_LOOK.swirl[0] + CREAM_LOOK.swirl[2] * 0.55, CREAM_LOOK.swirl[1] + CREAM_LOOK.swirl[2] * 0.45, 0.2);
    p.uFocusDepth.value = rim.clone().sub(cam).length();
    p.uAperture.value = CREAM_LOOK.aperture * buf.x;
    p.uMaxCoc.value = CREAM_LOOK.maxCoc * buf.x;
    p.uBaseCoc.value = CREAM_LOOK.baseCoc * buf.x;
    p.uGrainFrame.value = loopFrame(f);
    gl.setRenderTarget(res.target);
    gl.render(res.marchScene, res.camera);
    gl.setRenderTarget(null);
    gl.render(res.postScene, res.camera);
  }, 1);
  return null;
};

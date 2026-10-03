import { useFrame, useThree } from "@react-three/fiber";
import React, { useLayoutEffect, useMemo, useRef } from "react";
import { useCurrentFrame } from "remotion";
import * as THREE from "three";
import { FULLSCREEN_VERT } from "../shared/glsl";
import { POST_FRAG, STAR_FRAG, STAR_VERT } from "./shaders";
import { BAND_NORMAL, buildStarGeometry, HALF } from "./starfield";
import { bodiesAt, fieldSpeed, warpAmount, makeCamera, pixelRadius, projectToPx, travel } from "./timeline";

const STREAK_FRAMES = 0.55; // "shutter" length in frames for the warp streaks

/**
 * Two passes, both driven only by the current frame:
 * 1. stars (instanced quads, additive) into a half-float target;
 * 2. full-screen post: Milky Way, Sun / Alpha Centauri bodies, tonemap, grain, dither.
 * R3F's useFrame is used only as the render hook that ThreeCanvas.advance()
 * calls; it never reads R3F's clock.
 */
export const SpaceScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { gl } = useThree();

  const res = useMemo(() => {
    const starScene = new THREE.Scene();
    const starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: {
        uRes: { value: new THREE.Vector2() },
        uPxScale: { value: 1 },
        uTravelMod: { value: 0 },
        uHalf: { value: HALF },
        uStreak: { value: 0 },
        uWarp: { value: 0 },
      },
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      transparent: true,
    });
    const stars = new THREE.Mesh(buildStarGeometry(), starMat);
    stars.frustumCulled = false;
    starScene.add(stars);

    const postScene = new THREE.Scene();
    const postMat = new THREE.ShaderMaterial({
      vertexShader: FULLSCREEN_VERT,
      fragmentShader: POST_FRAG,
      uniforms: {
        tScene: { value: null },
        uRes: { value: new THREE.Vector2() },
        uPxScale: { value: 1 },
        uFrame: { value: 0 },
        uTanHalf: { value: new THREE.Vector2() },
        uCamRot: { value: new THREE.Matrix3() },
        uBandNormal: { value: BAND_NORMAL.clone() },
        uWarp: { value: 0 },
        uBody: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
        uBodyCore: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
        uBodyGlow: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) },
        uBodyParams: { value: [0, 1, 2, 3].map(() => new THREE.Vector4()) },
      },
      depthTest: false,
      depthWrite: false,
    });
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat);
    quad.frustumCulled = false;
    postScene.add(quad);
    const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const rt = new THREE.WebGLRenderTarget(4, 4, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
    });
    return { starScene, starMat, postScene, postMat, postCam, rt };
  }, []);

  const camRef = useRef<THREE.PerspectiveCamera | null>(null);

  useLayoutEffect(() => {
    const size = gl.getDrawingBufferSize(new THREE.Vector2());
    const W = size.x;
    const H = size.y;
    if (res.rt.width !== W || res.rt.height !== H) res.rt.setSize(W, H);
    const pxScale = H / 720;
    const cam = makeCamera(frame, W / H);
    camRef.current = cam;

    const s = res.starMat.uniforms;
    s.uRes.value.set(W, H);
    s.uPxScale.value = pxScale;
    // travel in double precision on the CPU, wrapped before reaching the GPU
    s.uTravelMod.value = travel(frame) % (2 * HALF);
    s.uStreak.value = fieldSpeed(frame) * STREAK_FRAMES;
    const warp = warpAmount(frame);
    s.uWarp.value = warp;

    const p = res.postMat.uniforms;
    p.tScene.value = res.rt.texture;
    p.uRes.value.set(W, H);
    p.uPxScale.value = pxScale;
    p.uFrame.value = frame;
    p.uWarp.value = warp;
    const th = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    p.uTanHalf.value.set(th * cam.aspect, th);
    p.uCamRot.value.setFromMatrix4(cam.matrixWorld);

    bodiesAt(frame).forEach((b, i) => {
      const scr = projectToPx(cam, b.pos, W, H);
      const visible = scr !== null && scr.x > -W && scr.x < 2 * W && scr.y > -H && scr.y < 2 * H;
      const r = scr ? pixelRadius(b.radius, b.pos.length(), H) : 0;
      // GL fragment coordinates have their origin bottom-left
      p.uBody.value[i].set(scr ? scr.x : 0, scr ? H - scr.y : 0, r);
      p.uBodyCore.value[i].set(...b.core);
      p.uBodyGlow.value[i].set(...b.glow);
      p.uBodyParams.value[i].set(b.intensity, b.glowSize, b.granulation, visible ? 1 : 0);
    });
  });

  useFrame(() => {
    const cam = camRef.current;
    if (!cam) return;
    gl.setRenderTarget(res.rt);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, false, false);
    gl.render(res.starScene, cam);
    gl.setRenderTarget(null);
    gl.render(res.postScene, res.postCam);
  }, 1);

  return null;
};

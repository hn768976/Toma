import React, { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { continueRender, delayRender } from "remotion";
import { GLStage, FrameRenderer } from "../lib/GLStage";
import { packStops, lin } from "../lib/color";
import { FullscreenPass, fullscreenMaterial, hdrTarget } from "../lib/gl";
import { PostChain } from "../lib/post";
import { loopPhase, TAU } from "../lib/loop";
import type { LEDRow } from "../versions";
import { getLandMask, MASK_BOTTOM, MASK_TOP } from "./landMask";
import { LED_FRAG, LED_VERT } from "./ledShader";

// The prompt suggested ~300 LEDs with a line every 6; the references measure ~118 LEDs across
// the frame with a panel line every 4 LEDs (step-7 fix, see README).
export const LEDS_ACROSS = 120;
export const PANEL_EVERY = 4;

// ---- 1D Panel Glide geometry --------------------------------------------------------
const MAP_W = 16; // world units for the map's 360 degrees
const MAP_H = MAP_W * (9 / 16); // the map fills a 16:9 frame with square LEDs
const PLANE_W = MAP_W * 1.5;
const PLANE_H = MAP_H * 1.6;
const TILT = (-25 * Math.PI) / 180;
const GLIDE_FROM = { lon: 8, lat: 50 }; // Europe
const GLIDE_TO = { lon: 98, lat: 38 }; // Asia
const CAM_OFFSET = new THREE.Vector3(1.2, -1.0, 8.2); // from the target, in world space
const FOV = 38;
const DOF_K = 0.055; // CoC radius (fraction of frame height) per unit of |1 - dF/d|
const DOF_MAX = 0.05;

// Map framing, measured from the references: land spans the full width (Alaska at the left
// edge, Chukotka at the right) with a thin dark margin above Greenland and below Cape Horn.
const LON_LEFT = -171;
const LON_SPAN = 358;
const LAT_TOP = 93;
const LAT_BOTTOM = -67;

const mapToPlane = (lon: number, lat: number) =>
  new THREE.Vector2(
    ((lon - LON_LEFT) / LON_SPAN - 0.5) * MAP_W,
    MAP_H / 2 - ((LAT_TOP - lat) / (LAT_TOP - LAT_BOTTOM)) * MAP_H,
  );

const DOF_FRAG = /* glsl */ `
uniform sampler2D tSrc;
uniform vec2 uRes;
uniform float uFocus;
uniform float uK;
uniform float uMaxR;
in vec2 vUv;
out vec4 outColor;
const int N = 64;
void main() {
  vec4 c0 = textureLod(tSrc, vUv, 0.0);
  float d = c0.a;
  float r = min(uK * uRes.y * abs(1.0 - uFocus / d), uMaxR * uRes.y);
  if (r < 0.6) { outColor = vec4(c0.rgb, 1.0); return; }
  // Fixed Vogel-disc pattern; mip level chosen from the sample spacing so the gather is
  // smooth at every radius.
  float lod = log2(max(1.0, r * 1.9 / sqrt(float(N))));
  vec3 acc = vec3(0.0);
  for (int i = 0; i < N; i++) {
    float fi = float(i) + 0.5;
    float rad = sqrt(fi / float(N)) * r;
    float a = fi * 2.39996323;
    vec2 o = vec2(cos(a), sin(a)) * rad / uRes;
    acc += textureLod(tSrc, vUv + o, lod).rgb;
  }
  outColor = vec4(acc / float(N), 1.0);
}`;

const makeRenderer = (row: LEDRow, mask: THREE.Texture) =>
  (gl: THREE.WebGLRenderer, w: number, h: number): FrameRenderer => {
    const glide = row.mode === "glide";
    const uniforms: Record<string, THREE.IUniform> = {
      uMask: { value: mask },
      uGrid: { value: new THREE.Vector2() },
      uMapRect: { value: new THREE.Vector4(0, 0, 1, 1) },
      uMaskLat: { value: new THREE.Vector2(MASK_TOP, MASK_BOTTOM) },
      uLon: { value: new THREE.Vector2(LON_LEFT, LON_SPAN) },
      uLat: { value: new THREE.Vector2(LAT_TOP, LAT_BOTTOM) },
      uSoft: { value: row.soft },
      uMottle: { value: row.mottle },
      uGapFill: { value: row.gapFill },
      uLineW: { value: row.lineWidth },
      uHiAmt: { value: row.hiAmount },
      uCoastGlow: { value: row.coastGlow },
      uT: { value: 0 },
      uLand: { value: packStops(row.land) },
      uOcean: { value: packStops(row.ocean) },
      uLine: { value: packStops(row.line) },
      uBg: { value: packStops(row.bg) },
      uLandHi: { value: lin(row.landHi) },
      uLandLevel: { value: row.landLevel },
      uOceanLevel: { value: row.oceanLevel },
      uLineLevel: { value: row.lineLevel },
      uMod: { value: row.modAmount },
      uPanelEvery: { value: PANEL_EVERY },
      uHalo: { value: row.halo },
      uHaloStrength: { value: row.haloStrength },
      uWriteDepth: { value: glide ? 1 : 0 },
    };
    const material = new THREE.RawShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: LED_VERT,
      fragmentShader: LED_FRAG,
      uniforms,
      depthTest: false,
      depthWrite: false,
    });
    const scene = new THREE.Scene();
    let camera: THREE.Camera;
    let plane: THREE.Mesh;
    const aspect = w / h;
    if (!glide) {
      // Flat: plane exactly fills the orthographic frame; 300 square LEDs across.
      plane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
      camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 2);
      camera.position.z = 1;
      (uniforms.uGrid.value as THREE.Vector2).set(LEDS_ACROSS, LEDS_ACROSS / aspect);
    } else {
      plane = new THREE.Mesh(new THREE.PlaneGeometry(PLANE_W, PLANE_H), material);
      plane.rotation.x = TILT;
      const pitch = MAP_W / LEDS_ACROSS;
      (uniforms.uGrid.value as THREE.Vector2).set(PLANE_W / pitch, PLANE_H / pitch);
      (uniforms.uMapRect.value as THREE.Vector4).set(
        (PLANE_W - MAP_W) / 2 / PLANE_W,
        (PLANE_H - MAP_H) / 2 / PLANE_H,
        MAP_W / PLANE_W,
        MAP_H / PLANE_H,
      );
      const cam = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 100);
      camera = cam;
    }
    plane.frustumCulled = false;
    scene.add(plane);
    plane.updateMatrixWorld(true);

    const sceneRT = hdrTarget(w, h, glide);
    const dofRT = glide ? hdrTarget(w, h) : null;
    const pass = new FullscreenPass();
    const dof = fullscreenMaterial(DOF_FRAG, {
      tSrc: { value: sceneRT.texture },
      uRes: { value: new THREE.Vector2(w, h) },
      uFocus: { value: 1 },
      uK: { value: DOF_K },
      uMaxR: { value: DOF_MAX },
    });
    const post = new PostChain(w, h, {
      blurMix: row.blurMix,
      bloom: row.bloom,
      threshold: row.bloomThreshold,
      knee: 0.25,
      exposure: 1,
      shoulder: 0.8,
      huePreserve: row.huePreserve,
      vignette: row.vignette,
      grain: 0.015,
      grainFade: false,
    });

    const from = mapToPlane(GLIDE_FROM.lon, GLIDE_FROM.lat);
    const to = mapToPlane(GLIDE_TO.lon, GLIDE_TO.lat);
    const target = new THREE.Vector3();

    return {
      render(frame) {
        const t = loopPhase(frame);
        uniforms.uT.value = t;
        if (glide) {
          // Closed path: out to Asia and back, eased turnarounds (cosine), one lap.
          const s = 0.5 - 0.5 * Math.cos(TAU * t);
          target.set(from.x + (to.x - from.x) * s, from.y + (to.y - from.y) * s, 0);
          target.applyMatrix4(plane.matrixWorld);
          const cam = camera as THREE.PerspectiveCamera;
          cam.position.copy(target).add(CAM_OFFSET);
          cam.up.set(0, 1, 0);
          cam.lookAt(target);
          cam.updateMatrixWorld(true);
          dof.uniforms.uFocus.value = CAM_OFFSET.length();
        }
        gl.setRenderTarget(sceneRT);
        gl.setClearColor(0x000000, 1);
        gl.clear(true, true, false);
        gl.render(scene, camera);
        let src = sceneRT.texture;
        if (glide && dofRT) {
          pass.render(gl, dof, dofRT);
          src = dofRT.texture;
        }
        post.render(gl, src, frame);
      },
      dispose() {
        sceneRT.dispose();
        dofRT?.dispose();
        material.dispose();
        dof.dispose();
        post.dispose();
      },
    };
  };

export const LEDMap: React.FC<{ row: LEDRow }> = ({ row }) => {
  const [mask, setMask] = useState<THREE.Texture | null>(null);
  const [handle] = useState(() => delayRender("Building land mask"));
  useEffect(() => {
    setMask(getLandMask());
    continueRender(handle);
  }, [handle]);
  const factory = useMemo(() => (mask ? makeRenderer(row, mask) : null), [row, mask]);
  if (!factory) return null;
  return <GLStage factory={factory} />;
};

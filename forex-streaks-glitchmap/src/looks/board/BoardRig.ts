import * as THREE from "three";
import { Bloom } from "../../gfx/bloom";
import { GLSL_FINISH } from "../../gfx/finish.glsl";
import { Pass, makeRT } from "../../gfx/pass";
import type { Rig, RigFactory } from "../../gfx/ThreeStage";
import { loopFrame, LOOP_FRAMES, TAU } from "../../lib/loop";
import { BoardTexture } from "./BoardTexture";
import type { BoardPalette } from "./data";

// ---------------------------------------------------------------------------
// Look 1: Rate Board. A Canvas 2D board texture on a large plane tilted away
// from a low camera; the texture slides toward the camera by exactly one tile
// (8 rows) per 600 frames. DoF is a fixed-pattern gather pass (no temporal
// accumulation). Everything is a function of the loop frame.
// ---------------------------------------------------------------------------

const TILE_W = 0.44; // metres: one tile = 8 rows of 0.055 m (8:1 rows)
const TILE_H = 0.44;
const CAM_H = 0.23;
const FOV = 50;
const PITCH = THREE.MathUtils.degToRad(-35);

const BOARD_VERT = /* glsl */ `
varying vec3 vWorld;
varying float vDepth;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 v = viewMatrix * w;
  vDepth = -v.z;
  gl_Position = projectionMatrix * v;
}`;

const BOARD_FRAG = /* glsl */ `
uniform sampler2D tBoard;
uniform float uSlide;     // metres the board has slid toward the camera
uniform vec2 uTile;       // tile size in metres
uniform float uFocus;     // focus depth (m)
uniform float uBand;      // half-width of the sharp band, in 1 - focus/depth units
uniform float uRmax;      // max circle of confusion in pixels
uniform float uGain;
uniform float uYaw;       // the board is yawed so its columns lean toward the upper right
varying vec3 vWorld;
varying float vDepth;
void main() {
  float cy = cos(uYaw);
  float sy = sin(uYaw);
  float x = vWorld.x * cy + vWorld.z * sy;
  float c = -(-vWorld.x * sy + vWorld.z * cy) + uSlide;
  vec2 g = vec2(x / uTile.x, c / uTile.y);
  float column = floor(g.x);
  // every horizontal repeat starts 3 rows further down the tile (row index mod 8)
  vec2 uv = vec2(g.x, g.y + column * 3.0 / 8.0);
  vec3 tex = textureGrad(tBoard, uv, dFdx(g), dFdy(g)).rgb;
  float xx = 1.0 - uFocus / vDepth;
  float t = clamp((abs(xx) - uBand) / 0.62, 0.0, 1.0);
  float coc = uRmax * pow(t, 1.1);
  // far rows fall into darkness a little
  float fade = mix(1.0, 0.55, smoothstep(2.5, 14.0, vDepth));
  gl_FragColor = vec4(tex * uGain * fade, coc);
}`;

// Depth of field: a fixed-pattern gather (same Vogel-disc taps for every pixel
// and every frame, no temporal accumulation). Strong blur is gathered at half
// resolution (a quarter of the cost, indistinguishable for radii >= 8 px); a
// small full-resolution gather covers the soft transition next to the sharp band.
const DOF_GATHER = /* glsl */ `
vec3 gather(sampler2D tex, vec2 uv, float R, float lodBias, vec2 res, vec4 c0, const int N) {
  vec3 acc = vec3(0.0);
  float wsum = 0.0;
  float lod = max(0.0, log2(R) - lodBias);
  for (int i = 0; i < N; i++) {
    float rr = sqrt((float(i) + 0.5) / float(N));
    float th = float(i) * 2.39996323;
    vec2 o = rr * R * vec2(cos(th), sin(th));
    vec4 s = textureLod(tex, uv + o / res, lod);
    float dist = length(o);
    float cover = clamp(s.a - dist * 0.55 + 1.0, 0.0, 1.0);   // the sample's own blur reaches this pixel
    float lum = dot(s.rgb, vec3(0.2126, 0.7152, 0.0722));
    float w = cover * (1.0 + 6.0 * lum * lum);                   // bright text blooms into soft blobs
    acc += s.rgb * w;
    wsum += w;
  }
  return wsum > 1e-4 ? acc / wsum : c0.rgb;
}`;

const DOF_HALF_FRAG = /* glsl */ `
uniform sampler2D tColor; // rgb + circle of confusion (px) in alpha, with mipmaps
uniform vec2 uRes;        // full resolution
varying vec2 vUv;
${DOF_GATHER}
void main() {
  vec4 c0 = textureLod(tColor, vUv, 1.0);
  float R = c0.a;
  if (R < 1.5) { gl_FragColor = c0; return; }
  gl_FragColor = vec4(gather(tColor, vUv, R, 1.5, uRes, c0, 24), R);
}`;

const DOF_COMBINE_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tHalf;
uniform vec2 uRes;
varying vec2 vUv;
${DOF_GATHER}
void main() {
  vec4 c0 = texture2D(tColor, vUv);
  float R = c0.a;
  if (R < 0.6) { gl_FragColor = c0; return; }
  float blend = smoothstep(3.0, 8.0, R);
  vec3 col = c0.rgb;
  if (blend < 0.999) col = gather(tColor, vUv, R, 0.9, uRes, c0, 12);
  vec3 lo = texture2D(tHalf, vUv).rgb;
  gl_FragColor = vec4(mix(col, lo, blend), R);
}`;

const COMPOSITE_FRAG = /* glsl */ `
uniform sampler2D tColor;
uniform sampler2D tBloom;
uniform vec2 uRes;
uniform vec3 uGlowLL;
uniform vec3 uGlowUR;
uniform float uLoopFrame;
uniform float uBloom;
uniform float uChroma;
uniform float uVignette;
uniform float uGrain;
uniform float uGrainSize;
uniform float uExposure;
uniform float uRmax;
varying vec2 vUv;
${GLSL_FINISH}
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 c = vUv - 0.5;
  float blur = clamp(texture2D(tColor, vUv).a / uRmax, 0.0, 1.0);
  float ca = uChroma * blur;
  vec3 col;
  col.r = texture2D(tColor, vUv + c * ca).r;
  col.g = texture2D(tColor, vUv).g;
  col.b = texture2D(tColor, vUv - c * ca).b;

  // screen-space glows: lower left (35% of the frame wide), upper right (25%)
  vec2 pLL = (vUv - vec2(0.115, 0.015)) * vec2(aspect, 1.0);
  float dLL = length(pLL) / (0.35 * aspect);
  float gLL = 0.45 * exp(-pow(dLL * 2.2, 1.5)) + 4.0 * exp(-pow(dLL * 5.5, 2.0));
  vec2 pUR = (vUv - vec2(0.975, 0.9)) * vec2(aspect, 1.0);
  float dUR = length(pUR) / (0.25 * aspect);
  float gUR = 0.55 * exp(-pow(dUR * 2.0, 1.4)) + 2.4 * exp(-pow(dUR * 4.5, 2.0));
  // the glows also light the board a little
  col *= 1.0 + 0.9 * (gLL + gUR) * 0.5;
  col += uGlowLL * gLL + uGlowUR * gUR;

  col += texture2D(tBloom, vUv).rgb * uBloom;
  col = 1.0 - exp(-col * uExposure);
  float vig = 1.0 - uVignette * smoothstep(0.35, 1.05, length(c * vec2(1.0, 0.85)) * 1.55);
  col *= vig;
  gl_FragColor = vec4(finish(col, gl_FragCoord.xy, uLoopFrame, uGrain, uGrainSize), 1.0);
}`;

export const createBoardRig = (palette: BoardPalette): RigFactory => (gl, w, h): Rig => {
  gl.autoClear = false;
  gl.toneMapping = THREE.NoToneMapping;
  const scale = w / 3840;
  const texSize = w >= 2560 ? 4096 : 2048;
  const board = new BoardTexture(texSize, palette);
  board.texture.anisotropy = gl.capabilities.getMaxAnisotropy();

  const camera = new THREE.PerspectiveCamera(FOV, w / h, 0.05, 200);
  camera.rotation.order = "YXZ";

  const rmax = 0.03 * h; // largest circle of confusion in px
  const boardMat = new THREE.ShaderMaterial({
    vertexShader: BOARD_VERT,
    fragmentShader: BOARD_FRAG,
    uniforms: {
      tBoard: { value: board.texture },
      uSlide: { value: 0 },
      uTile: { value: new THREE.Vector2(TILE_W, TILE_H) },
      uFocus: { value: 0.6 },
      uBand: { value: 0.26 },
      uRmax: { value: rmax },
      uGain: { value: 1.0 },
      uYaw: { value: 0 },
    },
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(80, 160), boardMat);
  plane.rotation.x = -Math.PI / 2;
  plane.position.set(0, 0, -70);
  plane.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(plane);

  const sceneRT = makeRT(w, h, { mipmaps: true });
  sceneRT.texture.minFilter = THREE.LinearMipmapNearestFilter;
  const dofHalfRT = makeRT(Math.ceil(w / 2), Math.ceil(h / 2));
  const dofRT = makeRT(w, h);
  const dofHalf = new Pass(DOF_HALF_FRAG, { tColor: { value: sceneRT.texture }, uRes: { value: new THREE.Vector2(w, h) } });
  const dofCombine = new Pass(DOF_COMBINE_FRAG, {
    tColor: { value: sceneRT.texture },
    tHalf: { value: dofHalfRT.texture },
    uRes: { value: new THREE.Vector2(w, h) },
  });
  const bloom = new Bloom(w, h, 6);
  const composite = new Pass(COMPOSITE_FRAG, {
    tColor: { value: dofRT.texture },
    tBloom: { value: null },
    uRes: { value: new THREE.Vector2(w, h) },
    uGlowLL: { value: new THREE.Color(palette.glowLL) },
    uGlowUR: { value: new THREE.Color(palette.glowUR) },
    uLoopFrame: { value: 0 },
    uBloom: { value: 0.45 },
    uChroma: { value: 0.012 },
    uVignette: { value: 0.4 },
    uGrain: { value: 0.015 },
    uGrainSize: { value: Math.max(1, Math.round(scale * 1.5)) },
    uExposure: { value: 1.0 },
    uRmax: { value: rmax },
  });

  const placeCamera = (phase: number): void => {
    const a = TAU * phase; // whole cycles only
    camera.position.set(0.016 * Math.sin(a + 0.4), CAM_H + 0.012 * Math.sin(2 * a + 1.0), 0.02 * Math.sin(a + 2.1));
    camera.rotation.set(
      PITCH + THREE.MathUtils.degToRad(0.6) * Math.sin(a + 1.7),
      THREE.MathUtils.degToRad(1.3) * Math.sin(a + 0.2),
      THREE.MathUtils.degToRad(0.9) * Math.sin(2 * a + 0.9),
    );
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
  };

  // focus depth: where the ray through a point a bit below screen centre meets the board
  placeCamera(0);
  const focusDepth = ((): number => {
    const dir = new THREE.Vector3(0, -0.42, 0.5).unproject(camera).sub(camera.position).normalize();
    const t = -camera.position.y / dir.y;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    return t * dir.dot(fwd);
  })();
  boardMat.uniforms.uFocus.value = focusDepth;

  return {
    render(frame: number): void {
      const f = loopFrame(frame);
      const phase = f / LOOP_FRAMES;
      placeCamera(phase);
      board.draw(f);
      boardMat.uniforms.uSlide.value = TILE_H * phase; // exactly one tile (8 rows) per loop

      gl.setRenderTarget(sceneRT);
      gl.setClearColor(0x000000, 1);
      gl.clear(true, false, false);
      gl.render(scene, camera);
      dofHalf.render(gl, dofHalfRT);
      dofCombine.render(gl, dofRT);
      const bloomTex = bloom.render(gl, dofRT.texture, w, h, 0.65);
      composite.material.uniforms.tBloom.value = bloomTex;
      composite.material.uniforms.uLoopFrame.value = f;
      composite.render(gl, null);
    },
    dispose(): void {
      board.texture.dispose();
      boardMat.dispose();
      plane.geometry.dispose();
      sceneRT.dispose();
      dofRT.dispose();
      dofHalfRT.dispose();
      dofHalf.dispose();
      dofCombine.dispose();
      bloom.dispose();
      composite.dispose();
    },
  };
};

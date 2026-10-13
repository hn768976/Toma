// Glitter Vortex renderer on PixiJS 8 (WebGL2). Points are projected from
// 3D in a custom vertex shader; size and blur come from the distance to the
// focal depth. The stage is rendered manually once per Remotion frame: no
// ticker, no clock. Post: bloom chain + finish (vignette, grain, dither).
import { autoDetectRenderer, Container, Geometry, Mesh, RenderTexture, Shader, TextureSource, UniformGroup, type Renderer } from "pixi.js";
import * as THREE from "three";
import { FINISH_GLSL } from "../../lib/glsl";
import { hexToLinear, LOOP } from "../../lib/random";
import { buildParticles, COUNT, DISC_R, GlitterVersion, STRIDE } from "./particles";

const PARTICLE_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition;            // quad corner -1..1
in vec4 aA;                   // r, theta0, y, turns per loop
in vec4 aB;                   // size, id, sparkle bias, -
in vec3 aColor;
uniform mat4 uView; uniform mat4 uProj;
uniform float uFrame; uniform vec2 uRes; uniform float uFocus; uniform float uNearK; uniform float uFarK; uniform float uGain; uniform float uCamY;
out vec2 vP; out vec3 vColor; out float vSharp; out float vStar;
uint hashU(uint x) { x ^= x >> 16; x *= 0x7feb352du; x ^= x >> 15; x *= 0x846ca68bu; x ^= x >> 16; return x; }
float h01(uint a, uint b) { return float(hashU(a * 1664525u + hashU(b + 1013904223u)) & 0xffffffu) / 16777216.0; }
void main() {
  float theta = aA.y + 6.28318530718 * aA.w * uFrame / ${LOOP.toFixed(1)};
  vec3 world = vec3(aA.x * cos(theta), aA.z, aA.x * sin(theta));
  vec4 view = uView * vec4(world, 1.0);
  float dist = -view.z;
  float scale = uRes.y / 720.0;
  float core = 1.5 * aB.x * scale;                       // in-focus radius (px)
  float x = uFocus / max(dist, 0.05) - 1.0;
  float coc = abs(x) * (x > 0.0 ? uNearK : uFarK) * uRes.y;
  float sharp = 1.0 - smoothstep(core * 1.2, core * 3.5, coc);
  float rDisc = max(core, coc);
  float rSprite = mix(rDisc + scale, core * 5.5, sharp);  // stars need room for their spikes
  // twinkle: hash of (id, floor(frame/2)) blended to the next bucket
  uint id = uint(aB.y);
  float b = floor(uFrame / 2.0);
  float fr = (uFrame - b * 2.0) / 2.0;
  float s0 = h01(id, uint(mod(b, 300.0))), s1 = h01(id, uint(mod(b + 1.0, 300.0)));
  float sparkle = mix(s0, s1, smoothstep(0.0, 1.0, fr));
  sparkle = pow(sparkle, 4.0 - 2.0 * aB.z);
  // brightness = base x (0.5 + 0.5 x sparkle); the base is heavy-tailed so a few
  // thousand points read as distinct lights over a fine gold dust
  float bright = (0.5 + 0.5 * sparkle) * (0.3 + 2.4 * pow(aB.z, 6.0));
  float energy = pow(core / rDisc, 1.05);
  float farDim = min(1.0, pow(uFocus / max(dist, 0.05), 2.6)); // keeps the dense far arms from blowing out
  // grazing views stack many particles per pixel: dim them by the view angle
  float graze = mix(0.06, 1.0, smoothstep(0.12, 0.6, (uCamY - world.y) / max(dist, 0.05)));
  vColor = graze * aColor * bright * uGain * mix(max(energy, 0.01) * 1.1, 0.9 * farDim, sharp);
  vSharp = sharp;
  vStar = core / rSprite;
  vP = aPosition;
  vec4 clip = uProj * view;
  clip.xy += aPosition * rSprite * 2.0 / uRes * clip.w;
  gl_Position = clip;
}`;
const PARTICLE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vP; in vec3 vColor; in float vSharp; in float vStar;
out vec4 finalColor;
void main() {
  float r = length(vP);
  // out of focus: soft disc with a slightly brighter rim
  float disc = clamp((1.0 - r) * 6.0, 0.0, 1.0) * (0.75 + 0.25 * smoothstep(0.5, 0.92, r));
  // in focus: tiny bright 4-point star
  vec2 q = vP / vStar;                       // in core radii
  float coreG = exp(-dot(q, q) * 0.9);
  float spikes = exp(-abs(q.x) * 0.55) * exp(-q.y * q.y * 3.0) + exp(-abs(q.y) * 0.55) * exp(-q.x * q.x * 3.0);
  float star = (coreG + 0.18 * spikes + 0.12 * exp(-dot(q, q) * 0.15)) * (1.0 - smoothstep(0.8, 1.0, r));
  finalColor = vec4(vColor * mix(disc, star, vSharp), 1.0);
}`;

const HAZE_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition; uniform mat4 uView; uniform mat4 uProj;
out vec2 vD;
void main() { vD = aPosition * ${(DISC_R * 1.4).toFixed(2)}; gl_Position = uProj * uView * vec4(vD.x, 0.0, vD.y, 1.0); }`;
const HAZE_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vD; uniform vec3 uHaze; uniform vec3 uHazeCore;
out vec4 finalColor;
void main() {
  float r = length(vD) / ${DISC_R.toFixed(2)};
  vec3 c = uHazeCore * exp(-r * r / 0.02) * 0.08 + uHaze * (exp(-r * r / 0.15) * 0.12 + exp(-r * r / 0.9) * 0.08);
  finalColor = vec4(c, 1.0);
}`;

const FS_VERT = /* glsl */ `#version 300 es
precision highp float;
in vec2 aPosition; out vec2 vUv;
void main() { vUv = aPosition * 0.5 + 0.5; gl_Position = vec4(aPosition, 0.0, 1.0); }`;
const DOWN_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uPrefilter; uniform float uThreshold;
out vec4 finalColor;
vec3 T(vec2 o) { return min(texture(uSrc, vUv + uTexel * o).rgb, vec3(64.0)); }
void main() {
  vec3 col = T(vec2(0)) * 0.125 + (T(vec2(-2,-2)) + T(vec2(2,-2)) + T(vec2(-2,2)) + T(vec2(2,2))) * 0.03125
    + (T(vec2(0,-2)) + T(vec2(-2,0)) + T(vec2(2,0)) + T(vec2(0,2))) * 0.0625
    + (T(vec2(-1,-1)) + T(vec2(1,-1)) + T(vec2(-1,1)) + T(vec2(1,1))) * 0.125;
  if (uPrefilter > 0.5) { float br = max(col.r, max(col.g, col.b)); col *= max(br - uThreshold, 0.0) / max(br, 1e-4); }
  finalColor = vec4(col, 1.0);
}`;
const UP_FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec2 vUv; uniform sampler2D uSrc; uniform sampler2D uBase; uniform vec2 uTexel;
out vec4 finalColor;
vec3 T(vec2 o) { return texture(uSrc, vUv + uTexel * o).rgb; }
void main() {
  vec3 s = T(vec2(-1,-1)) + 2.0 * T(vec2(0,-1)) + T(vec2(1,-1)) + 2.0 * T(vec2(-1,0)) + 4.0 * T(vec2(0)) + 2.0 * T(vec2(1,0)) + T(vec2(-1,1)) + 2.0 * T(vec2(0,1)) + T(vec2(1,1));
  finalColor = vec4(texture(uBase, vUv).rgb + s / 16.0, 1.0);
}`;
const FINAL_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in vec2 vUv; uniform sampler2D uScene; uniform sampler2D uBloom;
uniform float uBloomStrength; uniform float uFrame; uniform vec3 uSky;
out vec4 finalColor;
${FINISH_GLSL}
void main() {
  vec3 c = texture(uScene, vUv).rgb + texture(uBloom, vUv).rgb * uBloomStrength;
  c += uSky * smoothstep(0.9, 0.0, vUv.y) * 0.006;  // near black at the top, faintly warmed lower down
  c = softClip(min(c, vec3(1e3)), 0.72);
  finalColor = vec4(finish(c, vUv, floor(gl_FragCoord.xy), uFrame, 0.55, 0.015, 0.0), 1.0);
}`;

const quadGeometry = () =>
  new Geometry({
    attributes: { aPosition: [-1, -1, 1, -1, 1, 1, -1, 1] },
    indexBuffer: [0, 1, 2, 0, 2, 3],
  });

export type GlitterEngine = { render: (loopFrame: number) => void; destroy: () => void };

export const createGlitterEngine = async (
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  v: GlitterVersion,
): Promise<GlitterEngine> => {
  const renderer: Renderer = await autoDetectRenderer({
    preference: "webgl",
    canvas,
    width,
    height,
    resolution: 1,
    antialias: false,
    preserveDrawingBuffer: true,
    backgroundColor: 0x000000,
    backgroundAlpha: 1,
    autoDensity: false,
    clearBeforeRender: true,
    hello: false,
  });

  const rt = (w: number, h: number) =>
    RenderTexture.create({ width: Math.max(1, w), height: Math.max(1, h), resolution: 1, format: "rgba16float", antialias: false, scaleMode: "linear" });

  // camera
  const cam = new THREE.PerspectiveCamera(52, width / height, 0.05, 200);
  const view = new Float32Array(16), proj = new Float32Array(16);

  // particles
  const data = buildParticles(v);
  const buf = data; // interleaved instance buffer
  const geom = new Geometry({
    attributes: {
      aPosition: [-1, -1, 1, -1, 1, 1, -1, 1],
      aA: { buffer: buf, format: "float32x4", stride: STRIDE * 4, offset: 0, instance: true },
      aB: { buffer: buf, format: "float32x4", stride: STRIDE * 4, offset: 16, instance: true },
      aColor: { buffer: buf, format: "float32x3", stride: STRIDE * 4, offset: 32, instance: true },
    },
    indexBuffer: [0, 1, 2, 0, 2, 3],
    instanceCount: COUNT,
  });
  const camGroup = new UniformGroup({
    uView: { value: view, type: "mat4x4<f32>" },
    uProj: { value: proj, type: "mat4x4<f32>" },
    uFrame: { value: 0, type: "f32" },
    uRes: { value: new Float32Array([width, height]), type: "vec2<f32>" },
    uFocus: { value: 1, type: "f32" },
    uNearK: { value: 0.045, type: "f32" },
    uFarK: { value: 0.012, type: "f32" },
    uGain: { value: 1.0, type: "f32" },
    uCamY: { value: 1, type: "f32" },
  });
  const cu = camGroup.uniforms as { uFrame: number; uFocus: number; uNearK: number; uFarK: number; uCamY: number };
  const particleShader = Shader.from({ gl: { vertex: PARTICLE_VERT, fragment: PARTICLE_FRAG, name: "glitter-particles" }, resources: { cam: camGroup } });
  const particles = new Mesh({ geometry: geom as never, shader: particleShader });
  particles.blendMode = "add";

  const hazeShader = Shader.from({
    gl: { vertex: HAZE_VERT, fragment: HAZE_FRAG, name: "glitter-haze" },
    resources: {
      cam: camGroup,
      haze: {
        uHaze: { value: new Float32Array(hexToLinear(v.haze)), type: "vec3<f32>" },
        uHazeCore: { value: new Float32Array(hexToLinear(v.hazeCore)), type: "vec3<f32>" },
      },
    },
  });
  const haze = new Mesh({ geometry: quadGeometry() as never, shader: hazeShader });
  haze.blendMode = "add";

  // additive blend modes only apply to children, so render via a container
  const stage = new Container();
  stage.addChild(haze, particles);
  const sceneRT = rt(width, height);

  // bloom chain
  const levels = 7;
  const down: RenderTexture[] = [], up: RenderTexture[] = [];
  let w = width, h = height;
  for (let i = 0; i < levels; i++) {
    w = Math.max(1, Math.floor(w / 2));
    h = Math.max(1, Math.floor(h / 2));
    down.push(rt(w, h));
    up.push(rt(w, h));
  }
  const fsGeom = quadGeometry();
  const downShader = Shader.from({
    gl: { vertex: FS_VERT, fragment: DOWN_FRAG, name: "glitter-down" },
    resources: { uSrc: sceneRT.source, p: { uTexel: { value: new Float32Array(2), type: "vec2<f32>" }, uPrefilter: { value: 1, type: "f32" }, uThreshold: { value: 0.0, type: "f32" } } },
  });
  const upShader = Shader.from({
    gl: { vertex: FS_VERT, fragment: UP_FRAG, name: "glitter-up" },
    resources: { uSrc: sceneRT.source, uBase: sceneRT.source, p: { uTexel: { value: new Float32Array(2), type: "vec2<f32>" } } },
  });
  const finalShader = Shader.from({
    gl: { vertex: FS_VERT, fragment: FINAL_FRAG, name: "glitter-final" },
    resources: {
      uScene: sceneRT.source,
      uBloom: sceneRT.source,
      p: {
        uBloomStrength: { value: 0.1, type: "f32" },
        uFrame: { value: 0, type: "f32" },
        uSky: { value: new Float32Array(hexToLinear(v.haze)), type: "vec3<f32>" },
      },
    },
  });
  const downMesh = new Mesh({ geometry: fsGeom as never, shader: downShader });
  const upMesh = new Mesh({ geometry: fsGeom as never, shader: upShader });
  const finalMesh = new Mesh({ geometry: fsGeom as never, shader: finalShader });
  const setTex = (s: Shader, name: string, src: TextureSource) => { (s.resources as Record<string, unknown>)[name] = src; };

  const render = (f: number) => {
    const ph = (2 * Math.PI * f) / LOOP;
    // camera: ~35° above the disc, over its outer part and looking mostly
    // along the arms (the centre stays off-frame), so the disc fills and
    // overflows the frame. Slight closed sway.
    const camR = 0.78 * DISC_R, camA = THREE.MathUtils.degToRad(-90);
    const h = 0.21 * DISC_R + 0.04 * Math.sin(ph);
    cam.position.set(camR * Math.cos(camA), h, camR * Math.sin(camA));
    // horizontal look direction: rotated from "towards the centre" by ~62°
    const inward = Math.atan2(-cam.position.z, -cam.position.x);
    const yaw = inward + THREE.MathUtils.degToRad(62 + 3 * Math.sin(ph));
    const pitch = THREE.MathUtils.degToRad(-35 + 1.0 * Math.sin(ph));
    const look = new THREE.Vector3(Math.cos(yaw) * Math.cos(pitch), Math.sin(pitch), Math.sin(yaw) * Math.cos(pitch));
    cam.up.set(0, 1, 0);
    cam.lookAt(cam.position.clone().add(look));
    cam.rotateZ(THREE.MathUtils.degToRad(-14));
    const D = h / Math.sin(-pitch); // distance to the disc along the view axis
    cam.updateMatrixWorld();
    cam.updateProjectionMatrix();
    view.set(cam.matrixWorldInverse.elements);
    proj.set(cam.projectionMatrix.elements);
    cu.uFrame = f;
    cu.uCamY = cam.position.y;
    cu.uFocus = D * 1.25;

    renderer.render({ container: stage, target: sceneRT, clear: true, clearColor: [0, 0, 0, 1] });

    let prev: RenderTexture = sceneRT;
    down.forEach((t, i) => {
      setTex(downShader, "uSrc", prev.source);
      const p = downShader.resources.p as { uniforms: { uTexel: Float32Array; uPrefilter: number } };
      p.uniforms.uTexel[0] = 1 / prev.width; p.uniforms.uTexel[1] = 1 / prev.height;
      p.uniforms.uPrefilter = i === 0 ? 1 : 0;
      renderer.render({ container: downMesh, target: t, clear: true });
      prev = t;
    });
    let upSrc: RenderTexture = down[levels - 1];
    for (let i = levels - 2; i >= 0; i--) {
      setTex(upShader, "uSrc", upSrc.source);
      setTex(upShader, "uBase", down[i].source);
      const p = upShader.resources.p as { uniforms: { uTexel: Float32Array } };
      p.uniforms.uTexel[0] = 1 / upSrc.width; p.uniforms.uTexel[1] = 1 / upSrc.height;
      renderer.render({ container: upMesh, target: up[i], clear: true });
      upSrc = up[i];
    }
    setTex(finalShader, "uScene", sceneRT.source);
    setTex(finalShader, "uBloom", upSrc.source);
    (finalShader.resources.p as { uniforms: { uFrame: number } }).uniforms.uFrame = f;
    renderer.render({ container: finalMesh, clear: true });
  };

  return {
    render,
    destroy: () => renderer.destroy(),
  };
};

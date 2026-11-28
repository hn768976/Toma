/**
 * Post pipeline: scene (half-float, 4x MSAA) -> bloom pyramid -> final pass
 * (chromatic aberration, bloom, tinted vignette, exposure, AgX, sRGB, grade,
 * film grain, 1/255 dither). The final pass is the material of the full-screen
 * quad that React Three Fiber draws to the canvas.
 */
import * as THREE from "three";
import { LOOK } from "../look";

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const AGX = THREE.ShaderChunk.tonemapping_pars_fragment.replace(/toneMappingExposure/g, "uExposure");

const halfTarget = (w: number, h: number, samples = 0, depth = false) =>
  new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    samples,
    generateMipmaps: false,
  });

// Bloom buffers have a fixed size, so the glow is the same fraction of the
// frame at 1080p and at 4K.
const BLOOM_W = 480;
const BLOOM_H = 270;

export const createPost = () => {
  const quad = new THREE.PlaneGeometry(2, 2);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const fsScene = new THREE.Scene();
  const fsMesh = new THREE.Mesh(quad);
  fsMesh.frustumCulled = false;
  fsScene.add(fsMesh);

  const downMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { tMap: { value: null }, uTexel: { value: new THREE.Vector2() } },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */ `
uniform sampler2D tMap; uniform vec2 uTexel; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tMap, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture2D(tMap, vUv + uTexel * vec2(0.5, -0.5)).rgb
         + texture2D(tMap, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture2D(tMap, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  gl_FragColor = vec4(c * 0.25, 1.0);
}`,
  });
  const brightMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { tMap: { value: null } },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */ `
uniform sampler2D tMap; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tMap, vUv).rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  float k = smoothstep(${LOOK.bloomThreshold.toFixed(4)}, ${(LOOK.bloomThreshold + LOOK.bloomKnee).toFixed(4)}, l);
  gl_FragColor = vec4(c * k, 1.0);
}`,
  });
  const blurMat = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: { tMap: { value: null }, uDir: { value: new THREE.Vector2() } },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */ `
uniform sampler2D tMap; uniform vec2 uDir; varying vec2 vUv;
void main() {
  vec3 c = texture2D(tMap, vUv).rgb * 0.227027;
  c += (texture2D(tMap, vUv + uDir * 1.384615).rgb + texture2D(tMap, vUv - uDir * 1.384615).rgb) * 0.316216;
  c += (texture2D(tMap, vUv + uDir * 3.230769).rgb + texture2D(tMap, vUv - uDir * 3.230769).rgb) * 0.070270;
  gl_FragColor = vec4(c, 1.0);
}`,
  });

  const finalMaterial = new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
    uniforms: {
      tScene: { value: null },
      tBloom1: { value: null },
      tBloom2: { value: null },
      tBloom3: { value: null },
      uExposure: { value: LOOK.exposure },
      uFrame: { value: 0 },
      uRes: { value: new THREE.Vector2(1920, 1080) },
      uAspect: { value: 16 / 9 },
    },
    vertexShader: FS_VERT,
    fragmentShader: /* glsl */ `
uniform sampler2D tScene; uniform sampler2D tBloom1; uniform sampler2D tBloom2; uniform sampler2D tBloom3;
uniform float uFrame; uniform vec2 uRes; uniform float uAspect;
varying vec2 vUv;
${AGX}
float hash13(vec3 p) {
  p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z);
}
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c * vec2(uAspect, 1.0)) / length(vec2(uAspect, 1.0) * 0.5); // 0 centre .. 1 corner
  // lens: slight lateral chromatic aberration towards the edges
  vec2 ca = c * ${LOOK.chromaticAberration.toFixed(5)} * r * r * 2.0;
  vec3 col = vec3(texture2D(tScene, vUv + ca).r, texture2D(tScene, vUv).g, texture2D(tScene, vUv - ca).b);
  // lens softness: blend with a small blur whose size is fixed relative to the frame
  vec2 so = vec2(1.0 / (1080.0 * uAspect), 1.0 / 1080.0) * 1.45;
  vec3 soft = (texture2D(tScene, vUv + so * vec2(1.0, 0.6)).rgb + texture2D(tScene, vUv + so * vec2(-0.6, 1.0)).rgb
             + texture2D(tScene, vUv + so * vec2(-1.0, -0.6)).rgb + texture2D(tScene, vUv + so * vec2(0.6, -1.0)).rgb) * 0.25;
  col = mix(col, soft, ${LOOK.softness.toFixed(4)});
  // glow
  vec3 bloom = texture2D(tBloom1, vUv).rgb * 0.45 + texture2D(tBloom2, vUv).rgb * 0.33 + texture2D(tBloom3, vUv).rgb * 0.22;
  col += bloom * ${LOOK.bloomStrength.toFixed(4)};
  // tinted vignette (in linear light)
  float v = pow(smoothstep(${LOOK.vignetteStart.toFixed(4)}, 1.0, r), ${LOOK.vignettePower.toFixed(4)});
  col *= mix(vec3(1.0), vec3(${LOOK.vignetteColor.map((x) => x.toFixed(4)).join(", ")}), v);
  // exposure + AgX tone mapping + sRGB
  col = ${LOOK.toneMapping === "ACES" ? "ACESFilmicToneMapping" : "AgXToneMapping"}(col);
  col = sRGBTransferOETF(vec4(col, 1.0)).rgb;
  // grade (display space)
  col = (col - 0.5) * ${LOOK.contrast.toFixed(4)} + 0.5;
  float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(l), col, ${LOOK.saturation.toFixed(4)});
  col = clamp(col * vec3(${LOOK.gain.map((x) => x.toFixed(4)).join(", ")}), 0.0, 1.0);
  // lift: the black level of the picture is a hazy dark teal, never black
  vec3 lift = vec3(${LOOK.lift.map((x) => x.toFixed(4)).join(", ")});
  col = lift + col * (1.0 - lift);
  // film grain: hash of pixel + frame, faded out in pure black
  vec2 px = floor(vUv * uRes);
  // grain is defined on a 1920x1080 grid so 4K and 1080p carry the same grain
  vec2 gp = floor(vUv * vec2(1920.0, 1080.0));
  float g = hash13(vec3(gp, uFrame)) + hash13(vec3(gp + 17.0, uFrame + 3.0)) - 1.0;
  col += g * ${LOOK.grain.toFixed(5)} * smoothstep(0.0, 0.08, l);
  // +-1/255 dither against banding in the soft gradients
  // (a fixed pattern: unlike a per-frame one it survives H.264 on flat areas)
  float d = hash13(vec3(px, 11.0)) - 0.5;
  col += d * (2.0 / 255.0);
  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`,
  });

  let sceneRT: THREE.WebGLRenderTarget | null = null;
  let chain: THREE.WebGLRenderTarget[] = [];
  let bloomA: THREE.WebGLRenderTarget[] = [];
  let bloomB: THREE.WebGLRenderTarget[] = [];
  let curW = 0;
  let curH = 0;

  const setSize = (w: number, h: number) => {
    if (w === curW && h === curH) return;
    curW = w;
    curH = h;
    sceneRT?.dispose();
    [...chain, ...bloomA, ...bloomB].forEach((t) => t.dispose());
    sceneRT = halfTarget(w, h, 4, true);
    chain = [];
    let cw = w;
    let ch = h;
    while (cw / 2 >= BLOOM_W * 2) {
      cw = Math.round(cw / 2);
      ch = Math.round(ch / 2);
      chain.push(halfTarget(cw, ch));
    }
    bloomA = [0, 1, 2].map((i) => halfTarget(BLOOM_W >> i, BLOOM_H >> i));
    bloomB = [0, 1, 2].map((i) => halfTarget(BLOOM_W >> i, BLOOM_H >> i));
    finalMaterial.uniforms.uRes.value.set(w, h);
    finalMaterial.uniforms.uAspect.value = w / h;
  };

  const pass = (gl: THREE.WebGLRenderer, mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget) => {
    fsMesh.material = mat;
    gl.setRenderTarget(target);
    gl.render(fsScene, cam);
  };

  const render = (gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, frame: number) => {
    if (!sceneRT) return;
    gl.setRenderTarget(sceneRT);
    gl.setClearColor(0x000000, 1);
    gl.clear();
    gl.render(scene, camera);

    // downsample to the bloom size
    let src: THREE.Texture = sceneRT.texture;
    let sw = curW;
    let sh = curH;
    for (const t of chain) {
      downMat.uniforms.tMap.value = src;
      downMat.uniforms.uTexel.value.set(1 / sw, 1 / sh);
      pass(gl, downMat, t);
      src = t.texture;
      sw = t.width;
      sh = t.height;
    }
    downMat.uniforms.tMap.value = src;
    downMat.uniforms.uTexel.value.set(1 / sw, 1 / sh);
    pass(gl, downMat, bloomB[0]);
    brightMat.uniforms.tMap.value = bloomB[0].texture;
    pass(gl, brightMat, bloomA[0]);
    for (let i = 0; i < 3; i++) {
      if (i > 0) {
        downMat.uniforms.tMap.value = bloomA[i - 1].texture;
        downMat.uniforms.uTexel.value.set(1 / bloomA[i - 1].width, 1 / bloomA[i - 1].height);
        pass(gl, downMat, bloomA[i]);
      }
      for (let k = 0; k < 2; k++) {
        blurMat.uniforms.tMap.value = bloomA[i].texture;
        blurMat.uniforms.uDir.value.set(1 / bloomA[i].width, 0);
        pass(gl, blurMat, bloomB[i]);
        blurMat.uniforms.tMap.value = bloomB[i].texture;
        blurMat.uniforms.uDir.value.set(0, 1 / bloomA[i].height);
        pass(gl, blurMat, bloomA[i]);
      }
    }
    gl.setRenderTarget(null);
    finalMaterial.uniforms.tScene.value = sceneRT.texture;
    finalMaterial.uniforms.tBloom1.value = bloomA[0].texture;
    finalMaterial.uniforms.tBloom2.value = bloomA[1].texture;
    finalMaterial.uniforms.tBloom3.value = bloomA[2].texture;
    finalMaterial.uniforms.uFrame.value = frame;
  };

  return { quad, finalMaterial, setSize, render };
};

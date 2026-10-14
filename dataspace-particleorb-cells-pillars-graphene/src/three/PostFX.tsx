import { useFrame, useThree } from "@react-three/fiber";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { GRAIN_GLSL } from "../lib/glsl";

export type PostSettings = {
  /** View-space distance that is in perfect focus. */
  focus: number;
  /** Distance over which blur ramps from 0 to max (behind the focus). */
  range: number;
  /** Same, for the near side (defaults to range). */
  nearRange?: number;
  /** Half-width of the sharp zone around the focus. */
  sharpZone?: number;
  /** Max circle-of-confusion radius, in pixels at 720p (scaled with resolution). */
  maxBlur: number;
  /** Max far-side CoC as a fraction of maxBlur (default 1). */
  farMax?: number;
  bloomThreshold?: number;
  bloomStrength?: number;
  /** Bloom tap spacing in quarter-res pixels at 720p. */
  bloomRadius?: number;
  exposure?: number;
  vignette?: number;
  /** Grain amplitude in display units (0.015 = 1.5%). */
  grain: number;
  /** Fade grain to zero in near-black areas. */
  blackFade?: boolean;
  /** Lateral chromatic aberration in px at 720p, at the frame corner. */
  chroma?: number;
};

const FS_VERT = /* glsl */ `
in vec3 position;
void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const BRIGHT_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc; uniform vec2 srcRes; uniform vec2 res; uniform float threshold;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 px = 1.0 / srcRes;
  vec3 c = vec3(0.0);
  // 4x4 box from the full-res source (quarter-res target)
  for (int y = -1; y <= 2; y++) for (int x = -1; x <= 2; x++) {
    c += texture(tSrc, uv + (vec2(x, y) - 0.5) * px).rgb;
  }
  c /= 16.0;
  float l = max(c.r, max(c.g, c.b));
  c *= max(l - threshold, 0.0) / max(l, 1e-4);
  o = vec4(c, 1.0);
}
`;

const BLUR_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc; uniform vec2 res; uniform vec2 dir;
out vec4 o;
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec3 c = texture(tSrc, uv).rgb * 0.1964825501511404;
  vec2 off1 = dir * 1.411764705882353 / res;
  vec2 off2 = dir * 3.2941176470588234 / res;
  vec2 off3 = dir * 5.176470588235294 / res;
  c += (texture(tSrc, uv + off1).rgb + texture(tSrc, uv - off1).rgb) * 0.2969069646728344;
  c += (texture(tSrc, uv + off2).rgb + texture(tSrc, uv - off2).rgb) * 0.09447039785044732;
  c += (texture(tSrc, uv + off3).rgb + texture(tSrc, uv - off3).rgb) * 0.010381362401148057;
  o = vec4(c, 1.0);
}
`;

const COC_GLSL = /* glsl */ `
uniform float near; uniform float far;
uniform float focus; uniform float range; uniform float nearRange; uniform float sharpZone;
uniform float maxBlur; uniform float farMax;
float linDepthRaw(float d){
  float z = d * 2.0 - 1.0;
  return 2.0 * near * far / (far + near - z * (far - near));
}
// circle of confusion in px; background (cleared depth) is treated as sharp:
// the backgrounds are already soft by construction.
float cocRaw(float d){
  if (d >= 0.99999) return 0.0;
  float z = linDepthRaw(d);
  float dz = z - focus;
  float a = max(abs(dz) - sharpZone, 0.0);
  float c = dz > 0.0 ? clamp(a / range, 0.0, farMax) : clamp(a / nearRange, 0.0, 1.0);
  return c * maxBlur;
}
`;

// 1/8-res tile max of the CoC
const TILE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tDepth; uniform vec2 srcRes;
${COC_GLSL}
out vec4 o;
void main(){
  ivec2 base = ivec2(gl_FragCoord.xy) * 8;
  ivec2 lim = ivec2(srcRes) - 1;
  float m = 0.0;
  for (int y = 0; y < 8; y++) for (int x = 0; x < 8; x++) {
    m = max(m, cocRaw(texelFetch(tDepth, min(base + ivec2(x, y), lim), 0).r));
  }
  o = vec4(m, 0.0, 0.0, 1.0);
}
`;

// dilate the tile max by the blur radius (in tiles)
const DILATE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tTile; uniform int radius;
out vec4 o;
void main(){
  ivec2 c = ivec2(gl_FragCoord.xy);
  ivec2 lim = textureSize(tTile, 0) - 1;
  float m = 0.0;
  for (int y = -radius; y <= radius; y++) for (int x = -radius; x <= radius; x++) {
    m = max(m, texelFetch(tTile, clamp(c + ivec2(x, y), ivec2(0), lim), 0).r);
  }
  o = vec4(m, 0.0, 0.0, 1.0);
}
`;

const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tColor; uniform sampler2D tDepth; uniform sampler2D tBloom; uniform sampler2D tTileMax;
uniform vec2 res; uniform float bloomStrength;
${COC_GLSL}
uniform float exposure; uniform float vignette; uniform float grainAmt; uniform float blackFade;
uniform float frame; uniform float chroma;
out vec4 o;
${GRAIN_GLSL}
float depthAt(vec2 uv){ return texture(tDepth, uv).r; }
vec3 sampleCA(vec2 uv, vec2 sh){
  if (chroma <= 0.0) return texture(tColor, uv).rgb;
  return vec3(texture(tColor, uv + sh).r, texture(tColor, uv).g, texture(tColor, uv - sh).b);
}
const int N = 56;
const float GA = 2.39996323;
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  float cd = depthAt(uv);
  float cz = linDepthRaw(cd);
  float cs = cocRaw(cd);
  // lateral chromatic aberration (R/B offsets grow toward the frame edge),
  // applied inside the gather so it is blurred together with the image
  vec2 sh = (uv - 0.5) * chroma * 2.0 / res;
  vec3 col = sampleCA(uv, sh);
  float tileMax = texelFetch(tTileMax, ivec2(gl_FragCoord.xy) / 8, 0).r;
  if (maxBlur > 0.5 && tileMax > 0.5) {
    float tot = 1.0;
    for (int i = 0; i < N; i++) {
      float r = maxBlur * sqrt((float(i) + 0.5) / float(N));
      float a = float(i) * GA;
      vec2 suv = uv + vec2(cos(a), sin(a)) * r / res;
      vec3 sc = sampleCA(suv, sh);
      float sd = depthAt(suv);
      float sz = linDepthRaw(sd);
      float ss = cocRaw(sd);
      if (sz > cz) ss = clamp(ss, 0.0, cs * 2.0);
      float m = smoothstep(r - 0.75, r + 0.75, ss);
      col += mix(col / tot, sc, m);
      tot += 1.0;
    }
    col /= tot;
  }
  col += texture(tBloom, uv).rgb * bloomStrength;
  col *= exposure;
  vec2 vq = uv - 0.5; vq.x *= res.x / res.y;
  col *= 1.0 - vignette * smoothstep(0.35, 1.05, length(vq));
  // gentle shoulder above 0.8 (linear)
  vec3 hi = max(col - 0.8, 0.0);
  col = min(col, 0.8) + hi / (1.0 + hi * 2.5);
  vec3 srgb = linearToSrgb(col);
  srgb = grainDither(srgb, gl_FragCoord.xy, frame, grainAmt, blackFade);
  o = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}
`;

const makeTarget = (w: number, h: number, depth: boolean) => {
  const t = new THREE.WebGLRenderTarget(w, h, {
    type: THREE.HalfFloatType,
    format: THREE.RGBAFormat,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    depthBuffer: depth,
    samples: depth ? 4 : 0,
  });
  if (depth) {
    t.depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType);
    t.depthTexture.minFilter = THREE.NearestFilter;
    t.depthTexture.magFilter = THREE.NearestFilter;
  }
  return t;
};

const fsPass = (frag: string, uniforms: Record<string, THREE.IUniform>) => {
  const mat = new THREE.RawShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FS_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  mesh.frustumCulled = false;
  const scene = new THREE.Scene();
  scene.add(mesh);
  return { scene, mat };
};

/**
 * Takes over R3F rendering: scene -> half-float target (+depth) -> bloom ->
 * DoF/composite/grain/dither -> screen. Rendering happens inside the
 * renderer's own advance() (triggered by @remotion/three once per Remotion
 * frame); nothing here reads a clock — all values come from props that are
 * derived from useCurrentFrame().
 */
export const PostFX: React.FC<{ settings: PostSettings; frame: number }> = ({ settings, frame }) => {
  const { gl } = useThree();

  const res = useMemo(() => {
    const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const main = makeTarget(4, 4, true);
    const bA = makeTarget(4, 4, false);
    const bB = makeTarget(4, 4, false);
    const bright = fsPass(BRIGHT_FRAG, {
      tSrc: { value: null }, srcRes: { value: new THREE.Vector2() }, res: { value: new THREE.Vector2() }, threshold: { value: 1 },
    });
    const blur = fsPass(BLUR_FRAG, { tSrc: { value: null }, res: { value: new THREE.Vector2() }, dir: { value: new THREE.Vector2() } });
    const tileA = makeTarget(4, 4, false);
    const tileB = makeTarget(4, 4, false);
    [tileA, tileB].forEach((t) => { t.texture.minFilter = THREE.NearestFilter; t.texture.magFilter = THREE.NearestFilter; });
    const cocUniforms = () => ({
      near: { value: 0.1 }, far: { value: 100 }, focus: { value: 10 }, range: { value: 10 }, nearRange: { value: 10 },
      sharpZone: { value: 0 }, maxBlur: { value: 0 }, farMax: { value: 1 },
    });
    const tile = fsPass(TILE_FRAG, { tDepth: { value: main.depthTexture }, srcRes: { value: new THREE.Vector2() }, ...cocUniforms() });
    const dilate = fsPass(DILATE_FRAG, { tTile: { value: tileA.texture }, radius: { value: 1 } });
    const comp = fsPass(COMPOSITE_FRAG, {
      tColor: { value: main.texture }, tDepth: { value: main.depthTexture }, tBloom: { value: bA.texture }, tTileMax: { value: tileB.texture },
      res: { value: new THREE.Vector2() }, near: { value: 0.1 }, far: { value: 100 },
      focus: { value: 10 }, range: { value: 10 }, nearRange: { value: 10 }, sharpZone: { value: 0 },
      maxBlur: { value: 0 }, farMax: { value: 1 }, bloomStrength: { value: 0 }, exposure: { value: 1 },
      vignette: { value: 0 }, grainAmt: { value: 0.015 }, blackFade: { value: 0 }, frame: { value: 0 }, chroma: { value: 0 },
    });
    return { ortho, main, bA, bB, bright, blur, comp, tile, dilate, tileA, tileB, size: new THREE.Vector2() };
  }, []);

  useLayoutEffect(() => () => {
    res.main.dispose(); res.bA.dispose(); res.bB.dispose(); res.tileA.dispose(); res.tileB.dispose();
  }, [res]);

  // Uniforms derived from props (this frame). Layout effects run before the
  // passive effect in which @remotion/three calls advance().
  useLayoutEffect(() => {
    const u = res.comp.mat.uniforms;
    u.focus.value = settings.focus;
    u.range.value = settings.range;
    u.nearRange.value = settings.nearRange ?? settings.range;
    u.sharpZone.value = settings.sharpZone ?? 0;
    u.farMax.value = settings.farMax ?? 1;
    u.bloomStrength.value = settings.bloomStrength ?? 0;
    u.exposure.value = settings.exposure ?? 1;
    u.vignette.value = settings.vignette ?? 0;
    u.grainAmt.value = settings.grain;
    u.blackFade.value = settings.blackFade ? 1 : 0;
    u.frame.value = ((frame % 600) + 600) % 600;
    res.bright.mat.uniforms.threshold.value = settings.bloomThreshold ?? 1;
  }, [settings, frame, res]);

  useFrame((state) => {
    const { scene, camera } = state;
    gl.getDrawingBufferSize(res.size);
    const w = Math.max(1, Math.round(res.size.x));
    const h = Math.max(1, Math.round(res.size.y));
    const scale = h / 720;
    if (res.main.width !== w || res.main.height !== h) {
      res.main.setSize(w, h);
      const qw = Math.max(1, Math.round(w / 4));
      const qh = Math.max(1, Math.round(h / 4));
      res.bA.setSize(qw, qh);
      res.bB.setSize(qw, qh);
      res.tileA.setSize(Math.ceil(w / 8), Math.ceil(h / 8));
      res.tileB.setSize(Math.ceil(w / 8), Math.ceil(h / 8));
    }
    const u = res.comp.mat.uniforms;
    const cam = camera as THREE.PerspectiveCamera;
    u.near.value = cam.near;
    u.far.value = cam.far;
    u.res.value.set(w, h);
    u.maxBlur.value = settings.maxBlur * scale;
    u.chroma.value = (settings.chroma ?? 0) * scale;

    // copy CoC parameters to the tile pass
    const tu = res.tile.mat.uniforms;
    for (const k of ["near", "far", "focus", "range", "nearRange", "sharpZone", "maxBlur", "farMax"]) tu[k].value = u[k].value;
    tu.srcRes.value.set(w, h);
    res.dilate.mat.uniforms.radius.value = Math.ceil(u.maxBlur.value / 8) + 1;

    gl.autoClear = true;
    gl.setRenderTarget(res.main);
    gl.clear();
    gl.render(scene, camera);

    if (u.maxBlur.value > 0.5) {
      gl.setRenderTarget(res.tileA); gl.render(res.tile.scene, res.ortho);
      gl.setRenderTarget(res.tileB); gl.render(res.dilate.scene, res.ortho);
    }

    const bloomOn = (settings.bloomStrength ?? 0) > 0;
    if (bloomOn) {
      const qw = res.bA.width, qh = res.bA.height;
      const bu = res.bright.mat.uniforms;
      bu.tSrc.value = res.main.texture; bu.srcRes.value.set(w, h); bu.res.value.set(qw, qh);
      gl.setRenderTarget(res.bA); gl.render(res.bright.scene, res.ortho);
      const r = (settings.bloomRadius ?? 1) * scale;
      const lu = res.blur.mat.uniforms;
      lu.res.value.set(qw, qh);
      for (let pass = 0; pass < 2; pass++) {
        const k = r * (pass + 1);
        lu.tSrc.value = res.bA.texture; lu.dir.value.set(k, 0);
        gl.setRenderTarget(res.bB); gl.render(res.blur.scene, res.ortho);
        lu.tSrc.value = res.bB.texture; lu.dir.value.set(0, k);
        gl.setRenderTarget(res.bA); gl.render(res.blur.scene, res.ortho);
      }
    } else {
      gl.setRenderTarget(res.bA); gl.setClearColor(0x000000, 1); gl.clear();
    }
    gl.setRenderTarget(null);
    gl.render(res.comp.scene, res.ortho);
  }, 1);

  return null;
};

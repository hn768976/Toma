import * as THREE from "three";
import { SIMPLEX } from "../gl/glsl";
import { FullscreenQuad, Post, fullscreenMaterial } from "../gl/post";
import type { LookFactory } from "../gl/Stage";
import { phaseOf } from "../rng";

export type FabricPalette = {
  valley: string;
  slope: string;
  peak: string;
  highlight: string;
  background: string;
};

const SEG_X = 1024;
const SEG_Z = 576;
// Surface extent (world units). Camera sits near z = +6 looking toward -z.
const X0 = -11;
const X1 = 11;
const Z0 = -16;
const Z1 = 5;

// Pass 1: height field. Domain-warped simplex noise; time enters only as a
// point moving around a circle in the 3rd/4th noise dimensions -> seamless loop.
const HEIGHT_FRAG = /* glsl */ `
${SIMPLEX}
uniform float uTh;
uniform vec4 uExtent;   // x0, x1, z0, z1
varying vec2 vUv;
// Folds run along DIR (diagonal on screen): the noise is stretched along it.
const vec2 DIR = vec2(0.819, -0.574);
float heightAt(vec2 xz) {
  vec2 tc = vec2(cos(uTh), sin(uTh));
  vec2 f = vec2(dot(xz, DIR), dot(xz, vec2(-DIR.y, DIR.x)));
  vec2 p = f * vec2(0.3, 0.68);
  vec2 w = vec2(snoise(vec4(p * 0.7, tc * 0.5)), snoise(vec4(p * 0.7 + vec2(5.2, 1.3), tc * 0.5 + 2.0)));
  vec2 q = p + 0.95 * w;
  float h = snoise(vec4(q, tc * 0.45 + vec2(7.0, 3.0)));
  h += 0.08 * snoise(vec4(q * 2.0 + vec2(1.7, 9.2), tc * 0.6 - vec2(4.0, 1.0)));
  // ring-like dimples: a gentle continuous terracing of the field
  h += 0.06 * sin(6.0 * h);
  // pillow profile: broad rounded tops, narrow creases
  h = 1.0 - 2.0 * pow(1.0 - (h * 0.5 + 0.5), 1.6) ;
  return h * 0.85;
}
void main() {
  vec2 xz = vec2(mix(uExtent.x, uExtent.y, vUv.x), mix(uExtent.z, uExtent.w, vUv.y));
  gl_FragColor = vec4(heightAt(xz), 0.0, 0.0, 1.0);
}
`;

// Pass 2: gradient of the height field (central differences), packed with height.
const GRAD_FRAG = /* glsl */ `
uniform sampler2D tH;
uniform vec2 uTexel;
uniform vec2 uCell;  // world size of a texel (x, z)
varying vec2 vUv;
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  ivec2 sz = textureSize(tH, 0) - 1;
  float h = texelFetch(tH, c, 0).r;
  float hx0 = texelFetch(tH, clamp(c - ivec2(1, 0), ivec2(0), sz), 0).r;
  float hx1 = texelFetch(tH, clamp(c + ivec2(1, 0), ivec2(0), sz), 0).r;
  float hz0 = texelFetch(tH, clamp(c - ivec2(0, 1), ivec2(0), sz), 0).r;
  float hz1 = texelFetch(tH, clamp(c + ivec2(0, 1), ivec2(0), sz), 0).r;
  gl_FragColor = vec4(h, (hx1 - hx0) / (2.0 * uCell.x), (hz1 - hz0) / (2.0 * uCell.y), 1.0);
}
`;

const SURF_VERT = /* glsl */ `
uniform sampler2D tHG;
varying vec3 vW;
varying vec2 vUv2;
void main() {
  vUv2 = uv;
  vec4 hg = texture2D(tHG, uv);
  vec3 p = vec3(position.x, hg.r, position.z);
  vW = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

const SURF_FRAG = /* glsl */ `
uniform sampler2D tHG;
uniform vec3 uValley, uSlope, uPeak, uHi, uBg;
uniform float uFreq;
uniform vec4 uExtent;
varying vec3 vW;
varying vec2 vUv2;
const float TAU = 6.28318530718;
void main() {
  vec4 hg = texture2D(tHG, vUv2);
  float h = hg.r;
  vec3 nM = normalize(vec3(-hg.g, 1.0, -hg.b));

  // ---- micro texture: corduroy wales along the folds, covered in fine stitches ----
  const vec2 DIR = vec2(0.819, -0.574);
  vec2 PER = vec2(-DIR.y, DIR.x);
  float across = dot(vW.xz, PER) + 0.1 * h;
  float along = dot(vW.xz, DIR);
  // wales (coarse ribs)
  float a = across * uFreq;
  float fa = fract(a);
  float ridge = 0.5 - 0.5 * cos(TAU * fa);
  float dRidge = 0.5 * TAU * sin(TAU * fa);
  float fwA = length(vec2(dFdx(a), dFdy(a)));
  float detailA = 1.0 - smoothstep(0.17, 0.33, fwA);
  // stitches (fine beads in offset rows), ~3.2x finer than the wales
  float c = across * uFreq * 3.2;
  float e = along * uFreq * 3.0 + 0.5 * c; // diagonal (twill) offset
  float bc = 0.5 - 0.5 * cos(TAU * fract(c));
  float bd = 0.5 - 0.5 * cos(TAU * fract(e));
  float fwB = max(length(vec2(dFdx(c), dFdy(c))), length(vec2(dFdx(e), dFdy(e))));
  float detailB = 1.0 - smoothstep(0.17, 0.33, fwB);
  float stitch = mix(0.25, bc * bd, detailB);
  vec3 gA = vec3(PER.x, 0.0, PER.y) * uFreq;
  vec3 bump = dRidge * gA * (0.05 / uFreq) * detailA;
  vec3 n = normalize(nM - (bump - nM * dot(bump, nM)));
  float mm = mix(0.6, 0.35 + 0.65 * ridge, detailA);
  float pin = stitch * stitch;

  // ---- colour: height + position gradient (teal only toward the right) ----
  float hh = smoothstep(-0.6, 0.9, h);
  float px = smoothstep(1.3, 3.8, vW.x + 0.3 * (vW.z + 1.6));
  float t = clamp(0.45 * hh + 0.55 * px + 0.08, 0.0, 1.0);
  vec3 base = t < 0.5 ? mix(uValley, uSlope, t * 2.0) : mix(uSlope, uPeak, (t - 0.5) * 2.0);

  // ---- light: soft side light, fabric sheen, rim ----
  vec3 V = normalize(cameraPosition - vW);
  vec3 L = normalize(vec3(-0.75, 0.38, 0.55));
  float wrap = max((dot(n, L) + 0.1) / 1.1, 0.0);
  float ndv = max(dot(n, V), 0.0);
  float sheen = pow(1.0 - ndv, 2.0);
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(n, H), 0.0), 18.0);
  float occ = mix(0.45, 1.0, mm) * mix(0.5, 1.0, stitch); // grooves sit in shadow
  float valleyDark = mix(0.3, 1.0, smoothstep(-0.95, -0.3, h));
  vec3 col = base * (0.05 + 1.5 * wrap * wrap) * occ * valleyDark;
  // magenta-pink sheen on the rib crests, even across the surface
  col += uHi * (0.2 * spec * mm + 0.38 * pin * mm * wrap) * valleyDark;
  col += mix(base, uHi, 0.3) * sheen * 0.35 * occ;

  // distance fade into the background
  float d = length(cameraPosition - vW);
  col = mix(col, uBg, smoothstep(14.0, 24.0, d));
  gl_FragColor = vec4(col, 1.0);
}
`;

export const createFabricWaves =
  (pal: FabricPalette): LookFactory =>
  (gl) => {
    const post = new Post(gl, { msaa: 0, depth: true, dof: true });
    const quad = new FullscreenQuad();
    const hw = SEG_X + 1;
    const hh = SEG_Z + 1;
    const opts = {
      type: THREE.FloatType,
      format: THREE.RGBAFormat,
      depthBuffer: false,
      generateMipmaps: false,
    } as const;
    const hRT = new THREE.WebGLRenderTarget(hw, hh, { ...opts, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    const hgRT = new THREE.WebGLRenderTarget(hw, hh, { ...opts, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter });
    const extent = new THREE.Vector4(X0, X1, Z0, Z1);
    const heightMat = fullscreenMaterial(HEIGHT_FRAG, { uTh: { value: 0 }, uExtent: { value: extent } });
    const gradMat = fullscreenMaterial(GRAD_FRAG, {
      tH: { value: hRT.texture },
      uTexel: { value: new THREE.Vector2(1 / hw, 1 / hh) },
      uCell: { value: new THREE.Vector2((X1 - X0) / SEG_X, (Z1 - Z0) / SEG_Z) },
    });

    // plane in XZ; uv.y follows +z so the height texture lines up
    const geo = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0, SEG_X, SEG_Z);
    geo.rotateX(-Math.PI / 2); // plane now in XZ, uv.y=1 at z = -depth/2
    geo.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    // remap uv so v=0 at Z0 and v=1 at Z1, matching the height pass
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      uv.setXY(i, (pos.getX(i) - X0) / (X1 - X0), (pos.getZ(i) - Z0) / (Z1 - Z0));
    }
    // half-texel inset so vertices sample texel centres
    for (let i = 0; i < uv.count; i++) {
      uv.setXY(i, (uv.getX(i) * SEG_X + 0.5) / hw, (uv.getY(i) * SEG_Z + 0.5) / hh);
    }

    const surfMat = new THREE.ShaderMaterial({
      vertexShader: SURF_VERT,
      fragmentShader: SURF_FRAG,
      uniforms: {
        tHG: { value: hgRT.texture },
        uValley: { value: new THREE.Color(pal.valley) },
        uSlope: { value: new THREE.Color(pal.slope) },
        uPeak: { value: new THREE.Color(pal.peak) },
        uHi: { value: new THREE.Color(pal.highlight) },
        uBg: { value: new THREE.Color(pal.background) },
        uFreq: { value: 13.0 },
        uExtent: { value: extent },
      },
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, surfMat);
    mesh.frustumCulled = false;
    const scene = new THREE.Scene();
    scene.add(mesh);
    const camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.3, 60);
    const target = new THREE.Vector3();
    const bg = new THREE.Color(pal.background);

    return {
      render(frame) {
        const t = phaseOf(frame);
        const th = t * Math.PI * 2;
        heightMat.uniforms.uTh.value = th;
        quad.render(gl, heightMat, hRT);
        quad.render(gl, gradMat, hgRT);

        // close, low camera drifting on a closed path
        camera.position.set(0.4 * Math.sin(th), 5.4 + 0.12 * Math.sin(2 * th), 1.6 + 0.25 * Math.cos(th));
        target.set(0.25 * Math.sin(th + 0.8), 0.0, -1.6);
        // slight roll so the focus band runs diagonally across the frame
        camera.up.set(Math.sin(0.28), Math.cos(0.28), 0);
        camera.lookAt(target);
        camera.updateMatrixWorld();

        post.render(
          scene,
          camera,
          frame,
          {
            bloom: 0.6,
            threshold: 0.45,
            knee: 0.4,
            exposure: 1.2,
            saturation: 1.0,
            grain: 0.02,
            dof: { focus: 6.3, focusRange: 1.0, maxCocFrac: 0.015, nearScale: 4.0, farScale: 1.8 },
          },
          bg,
        );
      },
      dispose() {
        post.dispose();
        quad.dispose();
        hRT.dispose();
        hgRT.dispose();
        heightMat.dispose();
        gradMat.dispose();
        geo.dispose();
        surfMat.dispose();
      },
    };
  };

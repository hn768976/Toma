import * as THREE from 'three';
import type {MapRasters} from '../lib/geo';

// World units: x = lon / 10, z = -lat / 10, y up. The ground plane is larger
// than the world so the dark grid continues past the map edges.

export const lonLatToWorld = (lon: number, lat: number, y = 0) => new THREE.Vector3(lon / 10, y, -lat / 10);

const VERT = /* glsl */ `
uniform sampler2D landMask;
uniform sampler2D relief;
uniform float reliefHeight;
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 ll = vec2(wp.x * 10.0, -wp.z * 10.0);
  vec2 uv = vec2((ll.x + 180.0) / 360.0, (ll.y + 90.0) / 180.0);
  if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
    float l = textureLod(landMask, uv, 0.0).r;
    float r = textureLod(relief, uv, 0.0).r;
    wp.y += l * (1.0 - r) * reliefHeight;
  }
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FRAG = /* glsl */ `
uniform sampler2D landMask;
uniform sampler2D landBlur;
uniform sampler2D relief;
uniform sampler2D cityTex;
uniform float dotPitch;
uniform float dotSize;
uniform float reliefBase;
uniform float tileBevel;
uniform float landSpec;
uniform float hotSpeckle;
uniform float reliefContrast;
uniform vec3 landLit;
uniform vec3 landShadow;
uniform vec3 oceanColor;
uniform vec3 coastColor;
uniform vec3 cityColor;
uniform float cityStrength;
uniform vec4 hotspots[12];
uniform vec3 hotColors[12];
uniform int hotCount;
uniform vec3 gridColor;
uniform float gridStep;
uniform vec3 centerWorld;
uniform float fadeRadius;
varying vec3 vWorld;

float hash2(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

void main() {
  vec2 ll = vec2(vWorld.x * 10.0, -vWorld.z * 10.0);
  vec2 uv = vec2((ll.x + 180.0) / 360.0, (ll.y + 90.0) / 180.0);
  float inWorld = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);

  // --- dot grid -----------------------------------------------------------
  vec2 g = ll / dotPitch;
  vec2 cell = floor(g);
  vec2 f = fract(g) - 0.5;
  vec2 cll = (cell + 0.5) * dotPitch;
  vec2 cuv = vec2((cll.x + 180.0) / 360.0, (cll.y + 90.0) / 180.0);
  // explicit LOD = the cell's footprint (cuv is constant per cell, so implicit
  // derivatives would spike at cell borders)
  float lod8k = max(0.0, log2(dotPitch * 8192.0 / 360.0) - 0.5);
  float landC = smoothstep(0.35, 0.65, textureLod(landMask, cuv, lod8k).r) * inWorld * step(-60.0, cll.y);
  float rel = textureLod(relief, cuv, lod8k).r;
  // Natural Earth hillshade: flat terrain ~0.67, lit slopes brighter, shadowed
  // slopes darker. Centre on flat and stretch so relief carries the contrast.
  float shade = clamp(reliefBase + (rel - 0.67) * reliefContrast, 0.0, 1.0);
  float fw = max(fwidth(g.x), fwidth(g.y));
  float d = max(abs(f.x), abs(f.y));
  float dotA = 1.0 - smoothstep(dotSize - fw * 0.75, dotSize + fw * 0.75, d);
  float coverage = 4.0 * dotSize * dotSize;
  dotA = mix(dotA, coverage, smoothstep(0.3, 0.7, fw));
  float hv = hash2(cell);

  vec3 landCol = mix(landShadow, landLit, shade) * (0.7 + 0.6 * hv);
  // raised-tile look: lit top edge, darker lower edge on each square
  float bevel = smoothstep(dotSize * 0.45, dotSize * 0.95, f.y) - 0.5 * smoothstep(dotSize * 0.45, dotSize * 0.95, -f.y);
  landCol *= 1.0 + tileBevel * bevel * 1.4;
  // specular sheen on sunlit slopes (reads as a lit 3D relief surface)
  landCol += vec3(0.55, 0.95, 1.0) * pow(shade, 5.0) * landSpec * (0.6 + 0.8 * hv);
  // coastline: land cells whose neighbourhood is part ocean
  float blur = textureLod(landBlur, cuv, max(0.0, lod8k - 2.0)).r;
  float coast = landC * (1.0 - smoothstep(0.55, 0.92, blur));
  landCol += coastColor * coast;

  // city lights + hotspots (HDR so they bloom)
  float city = textureLod(cityTex, cuv, max(0.0, lod8k - 1.0)).r * cityStrength;
  vec3 glow = cityColor * city * (0.6 + 0.8 * hv);
  vec3 hot = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    if (i >= hotCount) break;
    vec4 h = hotspots[i];
    float dd = length((cll - h.xy) * vec2(cos(radians(cll.y)), 1.0)) / h.z;
    float k = exp(-dd * dd * 2.5) * h.w;
    // speckled: individual tiles flare, like dense city lights
    hot += hotColors[i] * k * mix(0.5 + hv, (0.15 + 2.2 * hv * hv * hv) * step(0.25, hv), hotSpeckle);
    // white-hot core at the centre of each hub
    hot += vec3(1.0, 0.75, 0.4) * smoothstep(0.6, 0.95, k / max(h.w, 1e-3)) * h.w * 0.25 * (0.4 + hv);
  }
  vec3 dotsCol = (landCol + glow + hot) * dotA * landC;

  // faint smooth land underneath the dots
  float landSmooth = smoothstep(0.3, 0.7, texture2D(landMask, uv).r) * inWorld * step(-60.0, ll.y);
  vec3 base = oceanColor + landShadow * 0.22 * landSmooth + (glow + hot) * 0.10 * (1.0 - hotSpeckle * 0.7) * landSmooth;

  // ocean grid
  vec2 gg = ll / gridStep;
  vec2 gw = fwidth(gg);
  vec2 gl = abs(fract(gg - 0.5) - 0.5) / max(gw, 1e-4);
  float line = 1.0 - min(min(gl.x, gl.y), 1.0);
  base += gridColor * line * (1.0 - landSmooth * 0.7);

  vec3 col = base + dotsCol;
  // darken towards the outside of the scene
  float r = length(vWorld.xz - centerWorld.xz) / fadeRadius;
  col *= 1.0 - 0.75 * smoothstep(0.55, 1.0, r);
  gl_FragColor = vec4(col, 1.0);
}
`;

export type MapLook = {
  dotPitch: number;
  dotSize: number;
  landLit: string;
  landShadow: string;
  ocean: string;
  coast: [string, number];
  city: [string, number];
  cityStrength: number;
  grid: [string, number];
  gridStep: number;
  reliefHeight: number;
  reliefBase: number;
  reliefContrast: number;
  tileBevel?: number;
  landSpec?: number;
  hotSpeckle?: number;
};

export type Hotspot = {lon: number; lat: number; radius: number; intensity: number; color: string};

const linear = (hex: string, k = 1) => new THREE.Color(hex).multiplyScalar(k);

export const makeMapMaterial = (
  textures: {land: THREE.Texture; landBlur: THREE.Texture; relief: THREE.Texture; city: THREE.Texture},
  look: MapLook,
  hotspots: Hotspot[],
  center: THREE.Vector3,
  fadeRadius: number,
) => {
  const hs = new Array(12).fill(0).map(() => new THREE.Vector4());
  const hc = new Array(12).fill(0).map(() => new THREE.Color());
  hotspots.slice(0, 12).forEach((h, i) => {
    hs[i].set(h.lon, h.lat, h.radius, h.intensity);
    hc[i].copy(linear(h.color));
  });
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      landMask: {value: textures.land},
      landBlur: {value: textures.landBlur},
      relief: {value: textures.relief},
      cityTex: {value: textures.city},
      reliefHeight: {value: look.reliefHeight},
      dotPitch: {value: look.dotPitch},
      dotSize: {value: look.dotSize},
      reliefBase: {value: look.reliefBase},
      tileBevel: {value: look.tileBevel ?? 0},
      landSpec: {value: look.landSpec ?? 0},
      hotSpeckle: {value: look.hotSpeckle ?? 0},
      reliefContrast: {value: look.reliefContrast},
      landLit: {value: linear(look.landLit)},
      landShadow: {value: linear(look.landShadow)},
      oceanColor: {value: linear(look.ocean)},
      coastColor: {value: linear(look.coast[0], look.coast[1])},
      cityColor: {value: linear(look.city[0], look.city[1])},
      cityStrength: {value: look.cityStrength},
      hotspots: {value: hs},
      hotColors: {value: hc},
      hotCount: {value: Math.min(12, hotspots.length)},
      gridColor: {value: linear(look.grid[0], look.grid[1])},
      gridStep: {value: look.gridStep},
      centerWorld: {value: center},
      fadeRadius: {value: fadeRadius},
    },
  });
};

export const canvasTexture = (c: HTMLCanvasElement | HTMLImageElement, srgb: boolean, mips = true) => {
  const t = new THREE.Texture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.generateMipmaps = mips;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = 4;
  t.needsUpdate = true;
  return t;
};

export const makeMapTextures = (r: MapRasters) => ({
  land: canvasTexture(r.land, false),
  landBlur: canvasTexture(r.landBlur, false),
  relief: canvasTexture(r.relief, false),
  city: canvasTexture(r.city, false),
});

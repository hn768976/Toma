import React, { useMemo } from "react";
import * as THREE from "three";
import { Element } from "../data/elements";

// Hologram element tile. Face printed in glowing ink on thin glass:
// Z top-left, symbol centred, name + mass at the bottom. See-through, so the
// back face reads mirrored. Texture channels: R = crisp ink, G = soft glow.

export const TILE_W = 0.82;
export const TILE_H = 1;
const CW = 410;
const CH = 500;
const SS = 2; // canvas supersample

const texCache = new Map<string, THREE.Texture>();

function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, size: number, maxW: number) {
  let s = size;
  ctx.font = `${weight} ${s}px Inter`;
  while (ctx.measureText(text).width > maxW && s > 8) {
    s -= 1;
    ctx.font = `${weight} ${s}px Inter`;
  }
}

function drawInk(ctx: CanvasRenderingContext2D, el: Element, outline: boolean) {
  const w = CW * SS;
  const h = CH * SS;
  ctx.save();
  ctx.scale(SS, SS);
  ctx.fillStyle = "#fff";
  ctx.strokeStyle = "#fff";
  if (outline) {
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.roundRect(22, 22, CW - 44, CH - 44, 20);
    ctx.stroke();
  }
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  ctx.font = "400 46px Inter";
  ctx.fillText(String(el.z), 50, 92);
  ctx.textAlign = "center";
  fitFont(ctx, el.symbol, 600, 210, CW - 110);
  ctx.fillText(el.symbol, CW / 2, 318);
  fitFont(ctx, el.name, 400, 40, CW - 90);
  ctx.fillText(el.name, CW / 2, 392);
  ctx.font = "400 38px Inter";
  ctx.fillText(el.mass, CW / 2, 440);
  ctx.restore();
  void w;
  void h;
}

export function tileTexture(el: Element): THREE.Texture {
  const hit = texCache.get(el.symbol);
  if (hit) return hit;
  const w = CW * SS;
  const h = CH * SS;
  const crisp = document.createElement("canvas");
  crisp.width = w;
  crisp.height = h;
  const c1 = crisp.getContext("2d")!;
  drawInk(c1, el, true);

  const glow = document.createElement("canvas");
  glow.width = w;
  glow.height = h;
  const c2 = glow.getContext("2d")!;
  c2.filter = `blur(${10 * SS}px)`;
  drawInk(c2, el, true);
  c2.filter = `blur(${3 * SS}px)`;
  drawInk(c2, el, true);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const co = out.getContext("2d")!;
  const a = c1.getImageData(0, 0, w, h).data;
  const b = c2.getImageData(0, 0, w, h).data;
  const img = co.createImageData(w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = a[i + 3];
    d[i + 1] = Math.min(255, b[i + 3] * 1.6);
    d[i + 2] = 0;
    d[i + 3] = 255;
  }
  co.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  texCache.set(el.symbol, tex);
  return tex;
}

const TILE_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const TILE_FRAG = /* glsl */ `
uniform sampler2D map;
uniform vec3 tint;
uniform float intensity;
uniform float shimmer;
uniform float fill;
uniform float opacity;
uniform float overMode; // 0 = additive glow (dark scenes), 1 = premultiplied over (light scenes)
varying vec2 vUv;
void main() {
  vec3 t = texture2D(map, vUv).rgb;
  float ink = t.r;
  float glow = t.g;
  float band = exp(-pow((vUv.x * 0.8 + vUv.y * 0.6 - shimmer) * 4.0, 2.0));
  vec3 hot = mix(tint, vec3(1.0), 0.28 * (1.0 - overMode));
  vec3 glass = mix(tint, vec3(0.05, 0.055, 0.06), overMode);
  vec3 c = hot * ink * intensity * (1.0 + 0.8 * band)
         + tint * glow * intensity * 0.55
         + glass * fill * (0.6 + 0.4 * band);
  float cover = clamp(ink * 0.95 + glow * 0.45 + fill * 2.2, 0.0, 1.0);
  gl_FragColor = vec4(c * opacity, cover * opacity * overMode);
}`;

export function tileMaterial(el: Element, color: string, over = false) {
  return new THREE.ShaderMaterial({
    vertexShader: TILE_VERT,
    fragmentShader: TILE_FRAG,
    uniforms: {
      map: { value: tileTexture(el) },
      tint: { value: new THREE.Color(color) },
      intensity: { value: 3 },
      shimmer: { value: 0 },
      fill: { value: 0.1 },
      opacity: { value: 1 },
      overMode: { value: over ? 1 : 0 },
    },
    transparent: true,
    blending: THREE.CustomBlending,
    blendEquation: THREE.AddEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
    // no depth write: the DoF/AO read the surface behind, which sits at the
    // tile's own depth (tiles stand on the floor), and nothing halos around it
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

export const Tile: React.FC<{
  el: Element;
  color: string;
  size: number;
  intensity: number;
  shimmer: number;
  opacity?: number;
  fill?: number;
  position: [number, number, number];
  rotation: [number, number, number];
  over?: boolean;
}> = ({ el, color, size, intensity, shimmer, opacity = 1, fill = 0.1, position, rotation, over = false }) => {
  const material = useMemo(() => tileMaterial(el, color, over), [el, color, over]);
  material.uniforms.intensity.value = intensity;
  material.uniforms.shimmer.value = shimmer;
  material.uniforms.opacity.value = opacity;
  material.uniforms.fill.value = fill;
  return (
    <mesh position={position} rotation={rotation} scale={size} material={material} renderOrder={10}>
      <planeGeometry args={[TILE_W, TILE_H]} />
    </mesh>
  );
};

// Soft radial glow decal (floor light pools, bokeh).
let radialTex: THREE.Texture | null = null;
export function radialTexture(): THREE.Texture {
  if (radialTex) return radialTex;
  const s = 256;
  const c = document.createElement("canvas");
  c.width = s;
  c.height = s;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++)
    for (let x = 0; x < s; x++) {
      const dx = (x + 0.5) / s - 0.5;
      const dy = (y + 0.5) / s - 0.5;
      const r = Math.sqrt(dx * dx + dy * dy) * 2;
      const v = Math.max(0, 1 - r);
      const g = Math.round(255 * v * v * (3 - 2 * v));
      const i = (y * s + x) * 4;
      img.data[i] = g;
      img.data[i + 1] = g;
      img.data[i + 2] = g;
      img.data[i + 3] = 255;
    }
  ctx.putImageData(img, 0, 0);
  radialTex = new THREE.CanvasTexture(c);
  radialTex.colorSpace = THREE.NoColorSpace;
  radialTex.needsUpdate = true;
  return radialTex;
}

export const GlowDecal: React.FC<{
  color: string;
  intensity: number;
  position: [number, number, number];
  scale: [number, number];
  rotationY?: number;
}> = ({ color, intensity, position, scale, rotationY = 0 }) => {
  const c = useMemo(() => new THREE.Color(color), [color]);
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, rotationY]} scale={[scale[0], scale[1], 1]} renderOrder={5}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={radialTexture()}
        color={c.clone().multiplyScalar(intensity)}
        transparent
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
};

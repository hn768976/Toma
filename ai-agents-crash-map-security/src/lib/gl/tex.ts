import * as THREE from "three";

export const makeCanvas = (w: number, h: number) => {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
};

// Canvas → texture with mipmaps and maximum (up to 16×) anisotropic filtering.
export const canvasTexture = (canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer, mip = true) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.NoColorSpace;
  t.generateMipmaps = mip;
  t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  t.premultiplyAlpha = true;
  t.needsUpdate = true;
  return t;
};

export const hexToVec3 = (hex: string) => {
  const c = new THREE.Color(hex);
  return new THREE.Vector3(c.r, c.g, c.b);
};

export const rgba = (hex: string, a: number) => {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)},${a})`;
};

// Standard premultiplied-alpha blending for textures uploaded premultiplied.
export const premulBlend = <M extends THREE.Material>(m: M, additive = false): M => {
  m.transparent = true;
  m.blending = THREE.CustomBlending;
  m.blendSrc = THREE.OneFactor;
  m.blendDst = additive ? THREE.OneFactor : THREE.OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = THREE.OneFactor;
  m.blendDstAlpha = THREE.OneMinusSrcAlphaFactor;
  m.depthWrite = false;
  return m;
};

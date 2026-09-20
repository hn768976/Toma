import * as THREE from "three";

// Small helpers shared by the three scenes.
//
// Every material here is additive with depth testing off: the plates are
// built out of emissive slabs of light, so there is nothing to occlude,
// and order-independence is what lets ThreeStage composite depth bands
// separately.

/** One geometry for every quad in a scene; meshes are scaled instead. */
export const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

/**
 * Snapshots a 2D canvas into a GPU texture.
 *
 * Deliberately a DataTexture over the pixel buffer rather than a
 * CanvasTexture over the element. A canvas is a live surface the browser
 * may re-back at any time, and in headless Chromium driving both WebGL
 * and WebGPU the 2D backing store is dropped between scene setup and the
 * first upload — the texture then uploads as fully transparent and the
 * mesh renders invisibly. Copying the pixels out once at build time
 * makes the texture independent of the canvas's fate.
 */
export const makeCanvasTexture = (
  canvas: HTMLCanvasElement,
  repeat = false,
): THREE.DataTexture => {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error("makeCanvasTexture: no 2D context to read back");
  }
  const { width, height } = canvas;
  const pixels = new Uint8Array(
    ctx.getImageData(0, 0, width, height).data.buffer,
  );

  const texture = new THREE.DataTexture(
    pixels,
    width,
    height,
    THREE.RGBAFormat,
    THREE.UnsignedByteType,
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  // Canvas pixels start at the top-left; UVs start at the bottom-left.
  texture.flipY = true;
  texture.unpackAlignment = 4;
  // Code sampled at a slant aliases badly without this; three clamps the
  // value to whatever the device actually supports.
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
};

/**
 * A sub-rectangle of a shared sheet. Clones share the underlying
 * `Source`, so three uploads the sheet once no matter how many panels
 * sample it.
 */
export const subTexture = (
  sheet: THREE.Texture,
  offsetX: number,
  offsetY: number,
  repeatX: number,
  repeatY: number,
): THREE.Texture => {
  const sub = sheet.clone();
  sub.wrapS = THREE.RepeatWrapping;
  sub.wrapT = THREE.RepeatWrapping;
  sub.offset.set(offsetX, offsetY);
  sub.repeat.set(repeatX, repeatY);
  sub.needsUpdate = true;
  return sub;
};

export const additive = (
  map: THREE.Texture | null,
  opacity: number,
  color = 0xffffff,
): THREE.MeshBasicMaterial =>
  new THREE.MeshBasicMaterial({
    map,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

export const quad = (
  material: THREE.Material,
  width: number,
  height: number,
): THREE.Mesh => {
  const mesh = new THREE.Mesh(UNIT_PLANE, material);
  mesh.scale.set(width, height, 1);
  return mesh;
};

export const additiveLineMaterial = (
  color: number,
  opacity: number,
): THREE.LineBasicMaterial =>
  new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });

/** Frees every GPU resource a scene owns, except the shared unit plane. */
export const disposeScene = (scene: THREE.Scene) => {
  const seen = new Set<THREE.Material | THREE.BufferGeometry>();
  scene.traverse((object) => {
    const withGeo = object as THREE.Mesh;
    if (withGeo.geometry && withGeo.geometry !== UNIT_PLANE) {
      if (!seen.has(withGeo.geometry)) {
        seen.add(withGeo.geometry);
        withGeo.geometry.dispose();
      }
    }
    const material = (object as THREE.Mesh).material;
    const list = Array.isArray(material) ? material : material ? [material] : [];
    for (const item of list) {
      if (seen.has(item)) {
        continue;
      }
      seen.add(item);
      const map = (item as THREE.MeshBasicMaterial).map;
      map?.dispose();
      item.dispose();
    }
  });
  scene.clear();
};

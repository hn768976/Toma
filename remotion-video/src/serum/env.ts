/**
 * Studio environment map.
 *
 * Transmissive materials get most of their character from what they refract,
 * so the environment is doing more work here than the lights are. The HDRI is
 * decoded and parsed once at module-evaluation time and handed to three as a
 * plain equirectangular DataTexture; three's cube-UV cache turns it into a
 * PMREM behind the scenes on first use.
 *
 * Parsing synchronously at module level (rather than through a loader and
 * Suspense) keeps the render path free of async work, which matters because
 * Remotion screenshots a frame as soon as React settles -- a suspended
 * environment would show up as an unlit frame.
 *
 * HDRI: "studio_small" (Poly Haven, CC0), vendored into
 * src/serum/assets/studio-hdri.js so the project stays self-contained and
 * needs no network at render time. See README for credit.
 */
import * as THREE from 'three';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader.js';
// Vendored into the project so the zip is self-contained and the render path
// needs no network. See src/serum/assets/studio-hdri.js for provenance.
// @ts-expect-error -- plain JS module, no types needed for a string export
import studioExrDataUriTyped from './assets/studio-hdri.js';

const studioExrDataUri: string = studioExrDataUriTyped as string;

const decodeBase64 = (dataUri: string): ArrayBuffer => {
  const base64 = dataUri.slice(dataUri.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
};

let cached: THREE.DataTexture | null = null;

export const getStudioEnvironment = (): THREE.DataTexture => {
  if (cached) return cached;
  const parsed = new EXRLoader().parse(decodeBase64(studioExrDataUri));
  const texture = new THREE.DataTexture(
    parsed.data as unknown as Uint16Array,
    parsed.width,
    parsed.height,
    parsed.format,
    parsed.type,
  );
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.LinearSRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  cached = texture;
  return texture;
};

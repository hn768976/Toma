import * as THREE from "three";

/**
 * Sky, ground and lighting rigs.
 *
 * The sky is a plain vertical gradient with no cloud layer, per the brief.
 * It is built as a 1px-wide gradient texture on a back-facing sphere rather
 * than a shader: a sphere's default UVs already run v from pole to pole, so
 * the gradient maps exactly, and the result needs no node materials and works
 * identically on every renderer tier.
 */

export type SkySpec = {
  /** Colour at the horizon. */
  horizon: string;
  /** Colour at the zenith. */
  zenith: string;
  /** Haze band sitting just above the horizon line. */
  haze: string;
  /** How far up the haze reaches, 0..1. */
  hazeHeight: number;
};

export type SunSpec = {
  color: string;
  intensity: number;
  /** Compass direction in radians; 0 looks down +Z. */
  azimuth: number;
  /** Height above the horizon in radians. */
  elevation: number;
  castShadow: boolean;
  /** Half-extent of the orthographic shadow frustum, metres. */
  shadowRadius?: number;
  shadowMapSize?: number;
};

export type EnvironmentSpec = {
  sky: SkySpec;
  sun: SunSpec;
  hemi: { sky: string; ground: string; intensity: number };
  ambient: { color: string; intensity: number };
  ground: { color: string; roughness: number; visible: boolean };
  fog?: { color: string; near: number; far: number };
  /** Renderer tone-mapping exposure. */
  exposure: number;
};

const gradientTexture = (spec: SkySpec): THREE.DataTexture => {
  const H = 256;
  const data = new Uint8Array(H * 4);
  const horizon = new THREE.Color(spec.horizon);
  const zenith = new THREE.Color(spec.zenith);
  const haze = new THREE.Color(spec.haze);
  const tmp = new THREE.Color();

  for (let i = 0; i < H; i++) {
    // Sphere UV v runs 0 at the bottom pole to 1 at the top.
    const v = i / (H - 1);
    // Below the horizon the sky is never seen -- ground covers it -- so the
    // lower half just holds the horizon colour.
    const up = Math.max(0, (v - 0.5) / 0.5);

    // Haze first, then the climb to zenith above it.
    const hazeMix = 1 - Math.min(1, up / Math.max(0.0001, spec.hazeHeight));
    tmp.copy(horizon).lerp(zenith, Math.pow(up, 0.75));
    tmp.lerp(haze, hazeMix * 0.85);

    // The colours above are in the linear working space, which is the right
    // place to interpolate. The texture is tagged sRGB, so encode on the way
    // out or the sky comes back several stops dark.
    tmp.convertLinearToSRGB();
    const o = i * 4;
    data[o] = Math.round(tmp.r * 255);
    data[o + 1] = Math.round(tmp.g * 255);
    data[o + 2] = Math.round(tmp.b * 255);
    data[o + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, 1, H, THREE.RGBAFormat);
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
};

export type BuiltEnvironment = {
  sun: THREE.DirectionalLight;
  dispose: () => void;
};

export const applyEnvironment = (
  scene: THREE.Scene,
  spec: EnvironmentSpec,
): BuiltEnvironment => {
  const disposables: { dispose: () => void }[] = [];

  // --- Sky dome ---------------------------------------------------------
  const skyTex = gradientTexture(spec.sky);
  const skyGeo = new THREE.SphereGeometry(1400, 32, 24);
  const skyMat = new THREE.MeshBasicMaterial({
    map: skyTex,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  // Drawn first and never occluding anything.
  sky.renderOrder = -1000;
  scene.add(sky);
  disposables.push(skyTex, skyGeo, skyMat);

  // --- Ground -----------------------------------------------------------
  if (spec.ground.visible) {
    const groundGeo = new THREE.PlaneGeometry(2600, 2600);
    const groundMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(spec.ground.color),
      roughness: spec.ground.roughness,
      metalness: 0,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    disposables.push(groundGeo, groundMat);
  }

  // --- Lights -----------------------------------------------------------
  const sun = new THREE.DirectionalLight(
    new THREE.Color(spec.sun.color),
    spec.sun.intensity,
  );
  const r = 260;
  sun.position.set(
    Math.sin(spec.sun.azimuth) * Math.cos(spec.sun.elevation) * r,
    Math.sin(spec.sun.elevation) * r,
    Math.cos(spec.sun.azimuth) * Math.cos(spec.sun.elevation) * r,
  );
  sun.castShadow = spec.sun.castShadow;
  if (spec.sun.castShadow) {
    const extent = spec.sun.shadowRadius ?? 70;
    const size = spec.sun.shadowMapSize ?? 2048;
    sun.shadow.mapSize.set(size, size);
    sun.shadow.camera.left = -extent;
    sun.shadow.camera.right = extent;
    sun.shadow.camera.top = extent;
    sun.shadow.camera.bottom = -extent;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = r * 2.2;
    // Containers are large, flat-sided and close together, so the bias has to
    // be generous or the corrugation self-shadows into stripes.
    sun.shadow.bias = -0.0012;
    sun.shadow.normalBias = 0.05;
  }
  scene.add(sun);
  scene.add(sun.target);

  const hemi = new THREE.HemisphereLight(
    new THREE.Color(spec.hemi.sky),
    new THREE.Color(spec.hemi.ground),
    spec.hemi.intensity,
  );
  scene.add(hemi);

  const ambient = new THREE.AmbientLight(
    new THREE.Color(spec.ambient.color),
    spec.ambient.intensity,
  );
  scene.add(ambient);

  if (spec.fog) {
    scene.fog = new THREE.Fog(
      new THREE.Color(spec.fog.color),
      spec.fog.near,
      spec.fog.far,
    );
  }

  return {
    sun,
    dispose: () => disposables.forEach((d) => d.dispose()),
  };
};
